import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, BrowserContext } from 'puppeteer';
import { getUserAgent } from '../helper/linkedin.auth.helper';

// Basic console log fallback
const statusLog = (section: string, message: string, isError = false) => { // Added isError flag
    const timestamp = new Date().toISOString();
    const logFunc = isError ? console.error : console.log; // Use console.error for errors
    logFunc(`[${timestamp}] [${section}]: ${message}`);
};

puppeteer.use(StealthPlugin());

// --- Hardcoded Sender Profile URN ---
// !!! Ensure this is your correct URN !!!
const HARDCODED_SENDER_URN: string = "urn:li:fsd_profile:ACoAADntJTgBUt0BPqWwnUoJgVhd8d25XD6b9MM"; // Example, replace if needed

export async function sendLinkedInMessage(
    profileUrl: string,
    sessionCookie: string,
    message: string
): Promise<void> {
    const logSection = "sendLinkedInMessage (Href Method - Hardcoded URN)";
    if (!sessionCookie || !profileUrl || !message) {
        throw new Error("Missing required parameters: profileUrl, sessionCookie, or message.");
    }
    // --- Validate Hardcoded URN ---
    if (!HARDCODED_SENDER_URN || HARDCODED_SENDER_URN === "urn:li:fsd_profile:REPLACE_THIS_WITH_YOUR_ACTUAL_URN" || !(HARDCODED_SENDER_URN.startsWith('urn:li:fsd_profile:') || HARDCODED_SENDER_URN.startsWith('urn:li:member:'))) {
         if (!HARDCODED_SENDER_URN.match(/^urn:li:(fsd_profile|member):[^,]+(,.+)?$/)) {
            throw new Error("Invalid or placeholder HARDCODED_SENDER_URN. Please set it correctly in the code. Format should be like 'urn:li:fsd_profile:ABC...'");
         }
    }
    const senderMailboxUrn: string = HARDCODED_SENDER_URN.split(',')[0];


    let browser: Browser | null = null;
    let page: Page | null = null;
    const userAgent = getUserAgent();
    let csrfToken: string | null = null;
    let context: BrowserContext | null = null;

    try {
        statusLog(logSection, `Using core sender URN: ${senderMailboxUrn}`);
        statusLog(logSection, "Launching browser (headless: false)...");
        browser = await puppeteer.launch({
            headless: false, // Keep false for debugging
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
        });

        context = browser.defaultBrowserContext();
        page = await context.newPage();
        await page.setUserAgent(userAgent);

        statusLog(logSection, "Setting 'li_at' cookie...");
        const liAtCookie = {
            name: 'li_at', value: sessionCookie, domain: '.linkedin.com',
            path: '/', httpOnly: true, secure: true, url: 'https://www.linkedin.com'
        };
        await context.setCookie(liAtCookie);
        statusLog(logSection, "'li_at' cookie set.");

        statusLog(logSection, `Navigating to target profile page: ${profileUrl}`);
        const messageButtonSelector = 'a.message-anywhere-button';

        try {
            await page.goto(profileUrl, { waitUntil: 'load', timeout: 90000 });
            statusLog(logSection, "Target profile page 'load' event fired.");

             if (page.url().includes("/login") || page.url().includes("/authwall")) {
                 throw new Error("Redirected to login/auth wall when navigating to target profile. Cookie may be invalid or session blocked.");
             }

            statusLog(logSection, "Attempting to get CSRF token from JSESSIONID cookie...");
            const cookies = await page.cookies('https://www.linkedin.com');
            const jsessionidCookie = cookies.find(cookie => cookie.name === 'JSESSIONID');
            if (jsessionidCookie && jsessionidCookie.value) {
                csrfToken = jsessionidCookie.value.replace(/"/g, '');
                statusLog(logSection, `CSRF token obtained from cookie: ${csrfToken}`);
            } else {
                statusLog(logSection, "JSESSIONID cookie not found. CSRF check might fail.", true);
                throw new Error("Failed to obtain CSRF token from JSESSIONID cookie after page load.");
            }

            statusLog(logSection, `Waiting for message button link ('${messageButtonSelector}')...`);
            await page.waitForSelector(messageButtonSelector, { visible: true, timeout: 45000 });
            statusLog(logSection, "Message button link found.");

        } catch (navError: any) {
            statusLog(logSection, `Navigation ('load'), CSRF fetch, or waiting for message button link failed: ${navError.message}`, true);
             if (page && !page.isClosed()) {
                 const screenshotPath = `error_screenshot_nav_csrf_${Date.now()}.png`;
                 try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                 catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`, true); }
             }
             if (navError.message.includes('timeout')) {
                 throw new Error(`Navigation timed out after waiting for 'load' event or message button. Profile page might be too slow, blocked, or selector invalid: ${navError.message}`);
             }
             throw new Error(`Failed during navigation ('load'), CSRF fetch, or waiting for message button link: ${navError.message}`);
        }

        statusLog(logSection, "Extracting href from message button link...");
        const href: string | null = await page.evaluate((selector) => {
            const button = document.querySelector(selector);
            return button ? button.getAttribute('href') : null;
        }, messageButtonSelector);

        if (!href) {
            if (page && !page.isClosed()) {
                 const screenshotPath = `error_screenshot_href_${Date.now()}.png`;
                 try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                 catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`, true); }
            }
            throw new Error(`Could not extract href attribute from selector '${messageButtonSelector}'. Button might not be an <a> tag or href is missing.`);
        }
        statusLog(logSection, `Extracted href: ${href}`);


        // --- Determine API call based on href ---
        let success = false;
        if (href.includes('new?recipients')) {
            // --- NEW CONVERSATION ---
            // *** Reverting to /voyagerMessagingDashMessengerMessages endpoint and payload ***
            statusLog(logSection, "Detected 'new conversation' href.");
            let recipientId: string | null = null;
            let recipientUrn: string | null = null;
            try {
                 const urlParams = new URLSearchParams(href.split('?')[1]);
                 const recipientsParam = urlParams.get('recipients');
                 statusLog(logSection, `Recipient param value: ${recipientsParam}`);

                 if (recipientsParam) {
                     const urnRegex = /urn(?:%3A|:)li(?:%3A|:)(?:fsd_profile|member)(?:%3A|:)([^,)]+)/;
                     const urnMatch = recipientsParam.match(urnRegex);
                     statusLog(logSection, `Recipient URN regex match result: ${JSON.stringify(urnMatch)}`);

                     if (urnMatch && urnMatch[1]) {
                         recipientId = decodeURIComponent(urnMatch[1]);
                         statusLog(logSection, `Recipient ID extraction successful: ${recipientId}`);
                         recipientUrn = recipientId.includes(':') ? recipientId : `urn:li:fsd_profile:${recipientId}`;
                         statusLog(logSection, `Constructed Recipient URN: ${recipientUrn}`);
                     } else {
                         statusLog(logSection, `Regex did not find a valid URN pattern in the recipients parameter.`);
                     }
                 } else {
                     statusLog(logSection, `Recipients parameter was not found in the href query string.`);
                 }

            } catch (e: any) {
                 statusLog(logSection, `Error occurred during recipient ID/URN parsing: ${e.message}`, true);
            }

            if (!recipientId || !recipientUrn) {
                statusLog(logSection, `Final check failed: recipientId or recipientUrn could not be determined from href: ${href}`, true);
                throw new Error(`Could not extract recipient ID/URN from new conversation href: ${href}`);
            }

            statusLog(logSection, "Sending API request to create conversation (using /voyagerMessagingDashMessengerMessages)...");
            success = await page.evaluate(async (csrfTokenFromNode, msgContent, recipientUrnForEval, senderUrnForEval) => {
                // *** UPDATED API URL ***
                const apiUrl = "https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage";
                console.log("[Evaluate New Convo - Dash] Using API URL:", apiUrl);

                const finalSenderUrn = senderUrnForEval;

                const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });

                const generateTrackingIdRawString = (byteLength = 16) => {
                    const bytes = new Uint8Array(byteLength);
                    crypto.getRandomValues(bytes);
                    let binaryString = '';
                    bytes.forEach(byte => { binaryString += String.fromCharCode(byte); });
                    return binaryString;
                };

                const originToken = generateUUID();
                const trackingId = generateTrackingIdRawString();

                // *** UPDATED PAYLOAD STRUCTURE to match user's example ***
                const payload = {
                    message: {
                        body: { attributes: [], text: msgContent },
                        originToken: originToken, // Generated UUID
                        renderContentUnions: []
                    },
                    mailboxUrn: finalSenderUrn, // Sender's URN
                    trackingId: trackingId, // Base64 encoded random bytes
                    dedupeByClientGeneratedToken: false,
                    hostRecipientUrns: [recipientUrnForEval] // Recipient's URN in an array
                };
                console.log("[Evaluate New Convo - Dash] Payload:", JSON.stringify(payload));
                console.log("[Evaluate New Convo - Dash] Generated Tracking ID (Base64):", trackingId);

                try {
                    const response = await fetch(apiUrl, {
                        method: "POST",
                        headers: {
                            "accept": "application/vnd.linkedin.normalized+json+2.1",
                            "accept-language": "en-US,en;q=0.9",
                            "content-type": "application/json; charset=UTF-8",
                            "csrf-token": csrfTokenFromNode,
                            "X-Restli-Protocol-Version": "2.0.0",
                            "sec-fetch-dest": "empty",
                            "sec-fetch-mode": "cors",
                            "sec-fetch-site": "same-origin"
                         },
                        body: JSON.stringify(payload),
                        mode: "cors", credentials: "include"
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`[Evaluate New Convo - Dash] API Error: Status ${response.status}`, response.statusText, errorText.substring(0, 1000));
                    } else {
                        console.log("[Evaluate New Convo - Dash] API Success: Status", response.status);
                    }
                    return response.ok;
                } catch (err: any) {
                    console.error('[Evaluate New Convo - Dash] Fetch Error:', err.message, err.stack);
                    return false;
                }
            }, csrfToken, message, recipientUrn, senderMailboxUrn); // Pass recipientUrn and senderMailboxUrn

        } else {
            // --- EXISTING CONVERSATION (Keep using /events endpoint and split method) ---
             statusLog(logSection, "Detected 'existing conversation' href.");
             let threadId: string | null = null;
             try {
                 threadId = href.split('?')[0]?.split('/messaging/thread/')[1]?.split('/')[0];
             }
             catch(e: any) {
                 statusLog(logSection, `Error parsing thread ID using split method: ${e.message}`, true);
             }

             if (!threadId) {
                 statusLog(logSection, `Could not extract thread ID from existing conversation href using split method: ${href}`, true);
                 throw new Error(`Could not extract thread ID from existing conversation href: ${href}`);
             }
             statusLog(logSection, `Thread ID extracted: ${threadId}`);

             statusLog(logSection, "Sending API request to existing conversation (using /events)...");
             success = await page.evaluate(async (csrfTokenFromNode, msgContent, threadId) => {
                const apiUrl = `https://www.linkedin.com/voyager/api/messaging/conversations/${threadId}/events?action=create`;
                console.log("[Evaluate Existing Convo] Using API URL:", apiUrl);

                const payload = {
                    eventCreate: {
                        value: {
                            "com.linkedin.voyager.messaging.create.MessageCreate": {
                                attributedBody: { text: msgContent, attributes: [] },
                                attachments: []
                            }
                        }
                    },
                    dedupeByClientGeneratedToken: false
                };
                console.log("[Evaluate Existing Convo] Payload:", JSON.stringify(payload));

                try {
                    const response = await fetch(apiUrl, {
                        method: "POST",
                        headers: {
                           "accept": "application/vnd.linkedin.normalized+json+2.1",
                           "accept-language": "en-US,en;q=0.9",
                           "content-type": "application/json; charset=UTF-8",
                           "csrf-token": csrfTokenFromNode,
                           "X-Restli-Protocol-Version": "2.0.0",
                           "sec-fetch-dest": "empty",
                           "sec-fetch-mode": "cors",
                           "sec-fetch-site": "same-origin"
                         },
                        body: JSON.stringify(payload),
                        mode: "cors", credentials: "include"
                    });
                   if (!response.ok) {
                       const errorText = await response.text();
                       console.error(`[Evaluate Existing Convo] API Error: Status ${response.status}`, errorText.substring(0, 1000));
                   } else {
                       console.log("[Evaluate Existing Convo] API Success: Status", response.status);
                   }
                   return response.ok;
                } catch (err: any) {
                   console.error('[Evaluate Existing Convo] Fetch Error:', err.message, err.stack);
                   return false;
                }
            }, csrfToken, message, threadId);
        }

        // --- Finalize ---
        if (success) {
            statusLog(logSection, "Message sending API call returned success (HTTP 2xx).");
        } else {
            if (page && !page.isClosed()) {
                 const screenshotPath = `error_screenshot_api_fail_${Date.now()}.png`;
                 try { await page.screenshot({ path: screenshotPath }); statusLog(logSection, `Error screenshot saved to ${screenshotPath}`); }
                 catch (ssError: any) { statusLog(logSection, `Failed to save screenshot: ${ssError.message}`, true); }
            }
            throw new Error("Message sending API call failed (non-2xx response or fetch error). Check browser console (F12) for details logged within evaluate.");
        }

        statusLog(logSection, "Message sending process finished.");
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
        statusLog(logSection, `Error during LinkedIn message sending: ${error.message}`, true);
        if (error.stack) { console.error(`[${logSection}] Stack trace:`, error.stack); }
        if (page && !page.isClosed() && browser && browser.isConnected()) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const screenshotPath = `error_screenshot_final_${timestamp}.png`;
                await page.screenshot({ path: screenshotPath });
                statusLog(logSection, `Error screenshot saved as ${screenshotPath}`);
            } catch (ssError: any) { statusLog(logSection, `Failed to take error screenshot: ${ssError.message}`, true); }
        }
        // *** Re-enable throwing the error so the calling function knows about the failure ***
        throw error;

    } finally {
        if (browser && browser.isConnected()) {
            statusLog(logSection, "Closing browser in finally block...");
            try {
                 // *** Re-enable browser close ***
                //  await browser.close();
                statusLog(logSection, "Browser closed successfully in finally block.");
            }
            catch (closeErr: any) { statusLog(logSection, `Error closing browser in finally block: ${closeErr.message}`, true); }
        }
    }
}

// --- Example Usage (Placeholder) ---
/*
async function testSendMessage() {
    const profileUrl = "REPLACE_WITH_TARGET_PROFILE_URL";
    const sessionCookieValue = process.env.SESSION_COOKIE || "REPLACE_WITH_YOUR_LI_AT_COOKIE";
    const message = "Hello! This is a test message sent via the Href method (Hardcoded URN).";

    if (sessionCookieValue === "REPLACE_WITH_YOUR_LI_AT_COOKIE" ||
        profileUrl === "REPLACE_WITH_TARGET_PROFILE_URL" ||
        HARDCODED_SENDER_URN.includes("REPLACE")) { // Check placeholder in URN too
        console.warn("Please replace placeholder values for profile URL, session cookie, and HARDCODED_SENDER_URN in the code before testing.");
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