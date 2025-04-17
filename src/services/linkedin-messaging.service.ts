import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, BrowserContext } from 'puppeteer';
// Remove getLinkedInCsrfInfo import if only using cookie method
// import { getLinkedInCsrfInfo, getUserAgent } from '../helper/linkedin.auth.helper';
import { getUserAgent } from '../helper/linkedin.auth.helper'; // Keep getUserAgent

// Basic console log fallback
const statusLog = (section: string, message: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${section}]: ${message}`);
};


puppeteer.use(StealthPlugin());

export async function sendLinkedInMessage(
    profileUrl: string,
    sessionCookie: string,
    message: string
): Promise<void> {
    const logSection = "sendLinkedInMessage (Href Method)";
    if (!sessionCookie || !profileUrl || !message) {
        throw new Error("Missing required parameters: profileUrl, sessionCookie, or message.");
    }

    let browser: Browser | null = null;
    let page: Page | null = null;
    const userAgent = getUserAgent();
    let csrfToken: string | null = null; // Define csrfToken here

    try {
        // Don't fetch CSRF token initially

        statusLog(logSection, "Launching browser (headless: false)...");
        browser = await puppeteer.launch({
            headless: true, // Keep false for debugging UI/Console
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
        });

        const context: BrowserContext = browser.defaultBrowserContext();
        page = await context.newPage();
        await page.setUserAgent(userAgent);

        statusLog(logSection, "Setting 'li_at' cookie via BrowserContext...");
        const liAtCookie = {
            name: 'li_at', value: sessionCookie, domain: '.linkedin.com',
            path: '/', httpOnly: true, secure: true, url: 'https://www.linkedin.com' // Use base domain
        };
        await context.setCookie(liAtCookie);
        statusLog(logSection, "'li_at' cookie set.");

        statusLog(logSection, `Navigating to profile page: ${profileUrl}`);
        const messageButtonSelector = 'a.message-anywhere-button';

        try {
            await page.goto(profileUrl, { waitUntil: 'load', timeout: 90000 });
            statusLog(logSection, "Profile page 'load' event fired.");

            // --- Fetch CSRF Token from Cookie AFTER page load ---
            statusLog(logSection, "Attempting to get CSRF token from JSESSIONID cookie...");
            const cookies = await page.cookies('https://www.linkedin.com'); // Get cookies for the domain
            const jsessionidCookie = cookies.find(cookie => cookie.name === 'JSESSIONID');

            if (jsessionidCookie && jsessionidCookie.value) {
                // The value is often quoted, remove quotes
                csrfToken = jsessionidCookie.value.replace(/"/g, '');
                statusLog(logSection, `CSRF token obtained from cookie: ${csrfToken}`);
            } else {
                statusLog(logSection, "JSESSIONID cookie not found. CSRF check might fail.");
                throw new Error("Failed to obtain CSRF token from JSESSIONID cookie after page load.");
            }

            // --- Wait for the Message Button Link ---
            statusLog(logSection, `Waiting for message button link ('${messageButtonSelector}')...`);
            await page.waitForSelector(messageButtonSelector, { visible: true, timeout: 45000 });
            statusLog(logSection, "Message button link found.");

        } catch (navError: any) {
            statusLog(logSection, `Navigation, CSRF fetch, or waiting for message button link failed: ${navError.message}`);
            if (page) {
                const screenshotPath = `error_screenshot_nav_csrf_${Date.now()}.png`;
                try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`); }
            }
            throw new Error(`Failed during navigation, CSRF fetch, or waiting for message button link: ${navError.message}`);
        }

        // --- Extract Href ---
        statusLog(logSection, "Extracting href from message button link...");
        const href: string | null = await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            return button ? button.getAttribute('href') : null;
        }, messageButtonSelector);

        if (!href) {
            if (page) {
                 const screenshotPath = `error_screenshot_href_${Date.now()}.png`;
                 try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                 catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`); }
            }
            throw new Error(`Could not extract href attribute from selector '${messageButtonSelector}'. Button might not be an <a> tag or href is missing.`);
        }
        statusLog(logSection, `Extracted href: ${href}`);


        // --- Determine API call based on href ---
        let success = false;
        if (href.includes('new?recipients')) {
            statusLog(logSection, "Detected 'new conversation' href.");
            let recipientId: string | null = null;
            try {
                 const urlParams = new URLSearchParams(href.split('?')[1]);
                 const recipientsParam = urlParams.get('recipients');
                 if (recipientsParam) {
                     const urnMatch = recipientsParam.match(/urn(?:%3A|:)li(?:%3A|:)fsd_profile(?:%3A|:)([^,)]+)/);
                     if (urnMatch && urnMatch[1]) { recipientId = urnMatch[1]; }
                 }
                 if (!recipientId) {
                    statusLog(logSection, "URN extraction from URL params failed, trying fallback split method...");
                    recipientId = href.split(';')[0]?.split('=')[1]?.split('&')[0]?.split('%3A')[3]?.replace(')', '');
                 }
            } catch (e: any) {
                 statusLog(logSection, `Error parsing recipient ID, falling back to original method: ${e.message}`);
                 recipientId = href.split(';')[0]?.split('=')[1]?.split('&')[0]?.split('%3A')[3]?.replace(')', '');
            }

            if (!recipientId) { throw new Error(`Could not extract recipient ID from new conversation href: ${href}`); }
            statusLog(logSection, `Recipient ID extracted: ${recipientId}`);

            statusLog(logSection, "Sending API request to create conversation...");
            success = await page.evaluate(async (csrfTokenFromNode, msgContent, recipientId) => {
                const recipientUrn = `urn:li:fsd_profile:${recipientId}`;
                const apiUrl = "https://www.linkedin.com/voyager/api/messaging/conversations?action=create";
                console.log("[Evaluate New Convo] Using API URL:", apiUrl);
                console.log("[Evaluate New Convo] Recipient URN:", recipientUrn);
                const payload = {
                    keyVersion: "LEGACY_INBOX",
                    conversationCreate: {
                        eventCreate: { value: { "com.linkedin.voyager.messaging.create.MessageCreate": { attributedBody: { text: msgContent, attributes: [] }, attachments: [] } } },
                        recipients: [recipientUrn],
                        subtype: "MEMBER_TO_MEMBER"
                    }
                };
                console.log("[Evaluate New Convo] Payload:", JSON.stringify(payload));
                try {
                    const response = await fetch(apiUrl, {
                        method: "POST",
                        headers: {
                            "accept": "application/vnd.linkedin.normalized+json+2.1",
                            "accept-language": "en-US,en;q=0.9",
                            "content-type": "application/json; charset=UTF-8",
                            "csrf-token": csrfTokenFromNode,
                            "X-Restli-Protocol-Version": "2.0.0"
                        },
                        body: JSON.stringify(payload),
                        mode: "cors", credentials: "include"
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[Evaluate New Convo] API Error: Status ${response.status}`, errorText.substring(0, 1000));
                    } else {
                        console.log("[Evaluate New Convo] API Success: Status", response.status);
                    }
                    return response.ok;
                } catch (err: any) {
                    console.error('[Evaluate New Convo] Fetch Error:', err.message, err.stack);
                    return false;
                }
            }, csrfToken, message, recipientId);

        } else { // Existing conversation - Using /events endpoint
            statusLog(logSection, "Detected 'existing conversation' href.");
            let threadId: string | null = null;
            try {
                threadId = href.split('?')[0]?.split('/messaging/thread/')[1]?.split('/')[0];
            } catch(e: any) {
                statusLog(logSection, `Error parsing thread ID: ${e.message}`);
            }

            if (!threadId) { throw new Error(`Could not extract thread ID from existing conversation href: ${href}`); }
            statusLog(logSection, `Thread ID extracted: ${threadId}`);

            statusLog(logSection, "Sending API request to existing conversation (using /events)...");
            success = await page.evaluate(async (csrfTokenFromNode, msgContent, threadId) => {
                // Use the threadId directly in the URL path
                const apiUrl = `https://www.linkedin.com/voyager/api/messaging/conversations/${threadId}/events?action=create`;
                console.log("[Evaluate Existing Convo] Using API URL:", apiUrl);

                // Refined payload structure for the /events endpoint
                const payload = {
                    eventCreate: {
                        value: {
                            "com.linkedin.voyager.messaging.create.MessageCreate": {
                                attributedBody: {
                                    text: msgContent,
                                    attributes: []
                                },
                                attachments: []
                            }
                        }
                    },
                    dedupeByClientGeneratedToken: false // Include this common parameter
                };
                console.log("[Evaluate Existing Convo] Payload:", JSON.stringify(payload));

                try {
                    const response = await fetch(apiUrl, {
                        method: "POST",
                        headers: { // Ensure all necessary headers are present
                            "accept": "application/vnd.linkedin.normalized+json+2.1",
                            "accept-language": "en-US,en;q=0.9",
                            "content-type": "application/json; charset=UTF-8",
                            "csrf-token": csrfTokenFromNode, // Use the passed token
                            "X-Restli-Protocol-Version": "2.0.0",
                            "sec-fetch-dest": "empty",
                            "sec-fetch-mode": "cors",
                            "sec-fetch-site": "same-origin"
                        },
                        body: JSON.stringify(payload),
                        mode: "cors",
                        credentials: "include"
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[Evaluate Existing Convo] API Error: Status ${response.status}`, errorText.substring(0, 1000)); // Log more error text
                    } else {
                        console.log("[Evaluate Existing Convo] API Success: Status", response.status);
                    }
                    return response.ok;
                } catch (err: any) {
                    console.error('[Evaluate Existing Convo] Fetch Error:', err.message, err.stack);
                    return false;
                }
            }, csrfToken, message, threadId); // Pass the extracted csrfToken and threadId
        }

        // --- Finalize ---
        if (success) {
            statusLog(logSection, "Message sending API call returned success (HTTP 2xx).");
        } else {
            if (page) {
                 const screenshotPath = `error_screenshot_api_fail_${Date.now()}.png`;
                 try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                 catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`); }
            }
            throw new Error("Message sending API call failed (non-2xx response or fetch error). Check browser console (F12) for details logged within evaluate.");
        }

        statusLog(logSection, "Message sending process finished.");
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
        console.error(`[${logSection}] Error during LinkedIn message sending (Href Method):`, error.message);
        if (error.stack) { console.error(`[${logSection}] Stack trace:`, error.stack); }
        if (page && !page.isClosed() && browser && browser.isConnected()) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const screenshotPath = `error_screenshot_final_${timestamp}.png`;
                await page.screenshot({ path: screenshotPath });
                statusLog(logSection, `Error screenshot saved as ${screenshotPath}`);
            } catch (ssError: any) { statusLog(logSection, `Failed to take error screenshot: ${ssError.message}`); }
        }
        throw error; // Propagate
    } finally {
        if (browser) {
            statusLog(logSection, "Closing browser...");
            try {
                await browser.close(); // Ensure browser is closed in final version
                statusLog(logSection, "Browser closed successfully.");
            }
            catch (closeErr: any) { statusLog(logSection, `Error closing browser: ${closeErr.message}`); }
        }
    }
}

// --- Example Usage (Placeholder) ---
/*
async function testSendMessage() {
    const profileUrl = "REPLACE_WITH_TARGET_PROFILE_URL";
    // Ensure SESSION_COOKIE is set in your environment variables or replace the placeholder
    const sessionCookieValue = process.env.SESSION_COOKIE || "REPLACE_WITH_YOUR_LI_AT_COOKIE";
    const message = "Hello! This is a test message sent via the Href method.";

    if (!process.env.SESSION_COOKIE || sessionCookieValue === "REPLACE_WITH_YOUR_LI_AT_COOKIE" || profileUrl === "REPLACE_WITH_TARGET_PROFILE_URL") {
        console.warn("Please replace placeholder values for profile URL and ensure SESSION_COOKIE environment variable is set before testing.");
        return;
    }

    try {
        console.log(`Attempting to send message via Href method to: ${profileUrl}`);
        await sendLinkedInMessage(profileUrl, sessionCookieValue, message);
        console.log("Message sending process via Href method completed successfully.");
    } catch (error) {
        console.error("Message sending via Href method failed:", error);
    }
}

// testSendMessage();
*/