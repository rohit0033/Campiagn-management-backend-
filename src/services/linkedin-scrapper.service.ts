import { Browser, Page, Permission } from "puppeteer";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { proxyManager } from './proxy-manager.service';
// --- Type Definitions ---
export interface ProfileData {
    name: string | null;
    description: string | null;
    jobTitle: string | null;
    currentCompany: string | null;
    location: string | null;
    summary: string | null;
}

// --- Helper Functions ---

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.2210.144',
    // Add more user agents
];

function getRandomUserAgent(): string {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
function delay(min: number, max: number): Promise<void> {
    return new Promise((resolve) => {
        const randomDelay = Math.floor(Math.random() * (max - min + 1) + min);
        setTimeout(resolve, randomDelay);
    });
}

const statusLog = (section: string, message: string, sessionId: string = ""): void => {
    console.log(`[${new Date().toISOString()}] [${section}]${sessionId ? ` [${sessionId}]` : ""}: ${message}`);
};

const getCleanText = (text: string | null | undefined): string | null => {
    return text ? text.replace(/\s+/g, " ").trim() : null;
};

async function autoScroll(page: Page): Promise<void> {
    console.log("[autoScroll] Starting scroll on URL:", page.url());
    try {
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const minDistance = 200;
                const maxDistance = 400;
                const scrollDelayMin = 200;
                const scrollDelayMax = 400;
                let lastScrollHeight = 0;

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    if (scrollHeight === lastScrollHeight && totalHeight > window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                        return;
                    }
                    const distance = Math.floor(Math.random() * (maxDistance - minDistance + 1) + minDistance);
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    lastScrollHeight = scrollHeight;

                    if (totalHeight >= scrollHeight - window.innerHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, Math.floor(Math.random() * (scrollDelayMax - scrollDelayMin + 1) + scrollDelayMin));
            });
        });
        console.log("[autoScroll] Finished scroll on URL:", page.url());
    } catch (error: any) {
        console.error("[autoScroll] Error during scroll:", error.message);
        // Consider how to handle this - maybe resolve anyway?
    }
}

class LinkedInProfileScraper {
    private sessionCookieValue: string;
    private _browser: Browser | null = null;

    get browser(): Browser | null {
        return this._browser;
    }

    constructor(sessionCookieValue: string) {
        this.sessionCookieValue = sessionCookieValue;
        statusLog("constructor", "Scraper initialized.");
    }

// Update the setup method for headless operation
// In the LinkedInProfileScraper class

// Then update the setup method in LinkedInProfileScraper class
async setup(usePersistentSession: boolean = false): Promise<void> {
    const logSection = "setup";
    const userDataDir = usePersistentSession 
        ? `./puppeteer_sessions/session_${Date.now()}` 
        : undefined;

    try {
        statusLog(logSection, "Launching Puppeteer with enhanced stealth...");
        
        // Get a proxy
        const proxy = proxyManager.getNextProxy();
        const proxyArgs = proxy ? [`--proxy-server=http://${proxy.ip}:${proxy.port}`] : [];
        
        if (proxy) {
            statusLog(logSection, `Using proxy: ${proxy.ip}:${proxy.port} (${proxy.country})`);
        } else {
            statusLog(logSection, "No proxy available, using direct connection");
        }
        
        // Enhanced stealth setup 
        const stealthPlugin = StealthPlugin();
        stealthPlugin.enabledEvasions.delete('chrome.runtime');
        stealthPlugin.enabledEvasions.delete('iframe.contentWindow');
        
        puppeteer.use(stealthPlugin);
        
        this._browser = await puppeteer.launch({
            headless: true,
            userDataDir,
            args: [
                ...proxyArgs,
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=1280,800",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-blink-features=AutomationControlled"
            ],
            defaultViewport: {
                width: 1280,
                height: 800
            }
        });
        
        statusLog(logSection, "Puppeteer launched with enhanced stealth.");
    } catch (err: any) {
        statusLog(logSection, `Error launching Puppeteer: ${err.message}`);
        await this.close();
        throw err;
    }
}

    async createPage(): Promise<Page> {
        const logSection = "createPage";
        if (!this.browser) {
            throw new Error("Browser not initialized. Call setup() first.");
        }

        try {
            const page = await this.browser.newPage();
            statusLog(logSection, "New page created.");

            await page.setUserAgent(getRandomUserAgent());
            await page.setViewport({ width: 1200, height: 800 });

            return page;
        } catch (err: any) {
            statusLog(logSection, `Error creating page: ${err.message}`);
            await this.close();
            throw err;
        }
    }

    async scrapeProfile(profileUrl: string): Promise<ProfileData> {
        const logSection = "scrapeProfile";
        const sessionId = Date.now().toString();

        if (!this.browser) {
            throw new Error("Browser not initialized. Call setup() first.");
        }
        if (!profileUrl || !profileUrl.includes("linkedin.com/in/")) {
            throw new Error("Invalid LinkedIn profile URL provided.");
        }

        let page: Page | null = null;
        try {
            page = await this.createPage();
            statusLog(logSection, `Navigating to profile: ${profileUrl}`, sessionId);

            await page.goto(profileUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });
            statusLog(logSection, "Page loaded initially.", sessionId);
            console.log(`[${new Date().toISOString()}] [${logSection}] [${sessionId}]: Current URL after initial load: ${page.url()}`);
            await delay(1000, 3000);

            if (page.url().includes("/login") || page.url().includes("/authwall")) {
                statusLog(
                    logSection,
                    "Redirected to login/auth wall. Cookie might be invalid or expired.",
                    sessionId
                );
                throw new Error("Authentication required. Check your li_at cookie.");
            }

            const currentUrlBeforeScroll = page.url();
            statusLog(
                logSection,
                "Scrolling page to load dynamic content...",
                sessionId
            );
            await autoScroll(page);
            await delay(1500, 4000);
            statusLog(logSection, "Scrolling finished.", sessionId);
            const currentUrlAfterScroll = page.url();
            if (currentUrlBeforeScroll !== currentUrlAfterScroll) {
                console.warn(`[${new Date().toISOString()}] [${logSection}] [${sessionId}]: URL changed during scroll from ${currentUrlBeforeScroll} to ${currentUrlAfterScroll}.`);
                throw new Error("Navigation occurred during scroll.");
            }

            // --- Expand 'About' Section ---
            try {
                const seeMoreButtonSelector =
                    "#about + div .inline-show-more-text__button--light";
                if ((await page.$(seeMoreButtonSelector)) !== null) {
                    statusLog(
                        logSection,
                        `Found "see more" button [${seeMoreButtonSelector}]. Clicking...`,
                        sessionId
                    );
                    await page.click(seeMoreButtonSelector);
                    await delay(800, 2000);
                    statusLog(logSection, 'Clicked "see more" for About.', sessionId);
                } else {
                    statusLog(
                        logSection,
                        `About section "see more" button [${seeMoreButtonSelector}] not found or section already expanded.`,
                        sessionId
                    );
                }
            } catch (err: any) {
                statusLog(
                    logSection,
                    sessionId
                );
            }
            await delay(1200, 3500);

            // --- Extract Data ---
            try {
                statusLog(
                    logSection,
                    "Extracting profile data using updated selectors...",
                    sessionId
                );
                const profileData = await page.evaluate((): ProfileData => {
                    const getText = (selector: string): string | null =>
                        document.querySelector(selector)?.textContent?.trim() || null;

                    const selectors = {
                        name: "h1",
                        title: "div.text-body-medium.break-words",
                        location: "span.text-body-small.inline.t-black--light.break-words",
                        summary: 'div[data-generated-suggestion-target] span[aria-hidden="true"]',
                        experience: {
                            container: '.artdeco-list__item.HgRSOHrqfUbqyNrPmmqMgHtHBXLhdAWHmKP:first-child',
                            wrapper: '.display-flex.flex-row.justify-space-between',
                            jobTitle: '.display-flex.align-items-center.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]:first-of-type',
                            company: 'a.optional-action-target-wrapper.display-flex.flex-column.full-width span.t-14.t-normal > span[aria-hidden="true"]:first-child'
                        }
                    };
                    const name = getText(selectors.name);
                    const location = getText(selectors.location);
                    const description = getText(selectors.title);
                    const summary = getText(selectors.summary);
            
                    // --- Extract current position information ---
                    const jobTitle = getText(selectors.experience.jobTitle);
                    let currentCompany = getText(selectors.experience.company);
                    console.log(`Current Company:`, currentCompany);
            
                    // Clean up company name (remove suffixes like "· Full-time", "· Internship", etc.)
                    if (currentCompany) {
                      currentCompany = currentCompany.split("·")[0].trim();
                    }

                    return {
                        name,
                        description,
                        jobTitle,
                        currentCompany,
                        location,
                        summary,
                    };
                });

                const cleanedData: ProfileData = {
                    name: getCleanText(profileData.name),
                    description: getCleanText(profileData.description),
                    jobTitle: getCleanText(profileData.jobTitle),
                    currentCompany: getCleanText(profileData.currentCompany),
                    location: getCleanText(profileData.location),
                    summary: getCleanText(profileData.summary),
                };

                statusLog(logSection, "Data extraction complete.", sessionId);
                return cleanedData;
            } catch (error: any) {
                statusLog(logSection, `Error during data extraction: ${error.message}`, sessionId);
                console.error(`[${new Date().toISOString()}] [${logSection}] [${sessionId}]: Error during data extraction on URL: ${page.url()}`, error);
                throw new Error(`Data extraction failed: ${error.message}`);
            }
        } catch (err: any) {
            statusLog(logSection, `Error during scraping: ${err.message}`, sessionId);
            throw err;
        } finally {
            if (page) {
                try {
                    await page.close();
                    statusLog(logSection, "Page closed.", sessionId);
                } catch (closeErr: any) {
                    statusLog(
                        logSection,
                        `Error closing page: ${closeErr.message}`,
                        sessionId
                    );
                }
            }
        }
    }

    async close(): Promise<void> {
        const logSection = "close";
        if (this.browser) {
            try {
                await this.browser.close();
                statusLog(logSection, "Browser closed.");
                this._browser = null;
            } catch (err: any) {
                statusLog(logSection, `Error closing browser: ${err.message}`);
            }
        }
    }
}

// Find the scrapeLinkedInProfile function and update it:

export async function scrapeLinkedInProfile(
    linkedin_url: string,
    sessionCookieValue?: string,
    usePersistentSession: boolean = false
): Promise<ProfileData> {
    if (!sessionCookieValue && !usePersistentSession) {
        throw new Error("Either a session cookie or persistent session is required");
    }

    console.log(`Scraping profile: ${linkedin_url}`);
    console.log(`Session mode: ${usePersistentSession ? 'Persistent' : 'Cookie-based'}`);
    
    // Try up to 3 different proxies
    const maxAttempts = 3;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const scraper = new LinkedInProfileScraper(sessionCookieValue || "");
        let page: Page | null = null;
        
        try {
            // If not first attempt, we're retrying with a different proxy
            if (attempt > 0) {
                console.log(`Retry attempt ${attempt} with different proxy...`);
            }
            
            await scraper.setup(usePersistentSession);
            
            // Rest of the implementation...
            // ... Set cookies, create page, navigate, etc.
            
            // 2. Set cookies at browser context level
            if (!usePersistentSession && sessionCookieValue && scraper.browser) {
                const context = scraper.browser.defaultBrowserContext();
                
                // Add more LinkedIn cookies to appear more legitimate
                await context.setCookie(
                    {
                        name: "li_at",
                        value: sessionCookieValue,
                        domain: ".linkedin.com",
                        path: "/",
                        httpOnly: true,
                        secure: true,
                    },
                    {
                        name: "liap",
                        value: "true",
                        domain: ".linkedin.com",
                        path: "/"
                    },
                    {
                        name: "lang",
                        value: "en_US",
                        domain: ".linkedin.com",
                        path: "/"
                    },
                    {
                        name: "JSESSIONID",
                        value: `"ajax:${Math.random().toString(36).substring(2, 15)}"`,
                        domain: ".linkedin.com",
                        path: "/"
                    }
                );
                
                statusLog("scrapeProfile", "Set session cookies for normal session");
            }
            
            // 3. Create page with enhanced anti-detection measures
            page = await scraper.createPage();
            
            // Set extra headers and browser characteristics
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Connection': 'keep-alive',
                'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document'
            });
            
            // Set higher timeout
            await page.setDefaultNavigationTimeout(60000);
            
            // 4. Direct navigation approach
            console.log("Directly navigating to profile URL:", linkedin_url);
            
            // Add random delay to appear more human-like
            await delay(1000, 3000);
            
            const response = await page.goto(linkedin_url, {
                waitUntil: "networkidle2",
                timeout: 60000
            });
            
            // Check response status
            if (!response) {
                throw new Error("Failed to get response from LinkedIn");
            }
            
            const status = response.status();
            console.log(`Navigation response status: ${status}`);
            
            if (status >= 400) {
                throw new Error(`LinkedIn returned error status: ${status}`);
            }
            
            console.log("Current URL after navigation:", page.url());
            
            // 5. Handle authentication/login walls
            if (page.url().includes("/login") || page.url().includes("/authwall")) {
                // Try to extract public data or throw error...
                
                // If we need to retry with a different proxy, throw a specific error type
                throw new Error("Proxy blocked - authentication required");
            }
            
            // 6. If we got here, we have access to the profile - scrape it
            console.log("Successfully accessed profile at URL:", page.url());
            
            // Wait for content to load, scroll, and scrape data
            // ... (rest of the scraping logic)
            
            // Wait for content to load
            await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {
                console.log("Timeout waiting for h1 tag");
            });
            
            // Add random delay before scrolling (human-like behavior)
            await delay(1000, 3000);
            
            // Scroll page with human-like behavior
            await autoScroll(page);
            
            // Add random delay after scrolling
            await delay(1500, 3500);
            
            // 7. Scrape the profile data
            const profileData = await scraper.scrapeProfile(linkedin_url);
            return profileData;
            
        } catch (error: any) {
            lastError = error;
            console.error(`Scraping failed (attempt ${attempt + 1}/${maxAttempts}): ${error.message}`);
            
            // If the error is not a proxy block, don't retry with a different proxy
            if (!error.message.includes("authentication required") && 
                !error.message.includes("Proxy blocked") &&
                !error.message.includes("timeout") &&
                !error.message.includes("net::ERR")) {
                throw error;
            }
            
            // If it's the last attempt, rethrow the error
            if (attempt === maxAttempts - 1) {
                throw error;
            }
            
        } finally {
            if (page) {
                await page.close();
            }
            await scraper.close();
            
            // If not last attempt, wait before retrying
            if (attempt < maxAttempts - 1) {
                const waitTime = Math.floor(Math.random() * 2000) + 3000;
                console.log(`Waiting ${waitTime}ms before next proxy attempt...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error("All proxy attempts failed");
}

// Helper function to extract limited public profile data when behind auth wall
async function extractPublicProfileData(page: Page): Promise<ProfileData> {
    return await page.evaluate(() => {
        const name = document.querySelector('h1')?.textContent?.trim() || null;
        const description = document.querySelector('.top-card-layout__headline')?.textContent?.trim() || null;
        
        return {
            name,
            description,
            jobTitle: null,
            currentCompany: null,
            location: null,
            summary: null
        };
    });
}
// --- Example Usage (for testing) ---
async function runTest() {
    const LINKEDIN_SESSION_COOKIE =
        "YOUR_LI_AT_COOKIE_VALUE_GOES_HERE";
    const PROFILE_URL = "https://www.linkedin.com/in/kunikamalhotra/";

    if (LINKEDIN_SESSION_COOKIE !== "YOUR_LI_AT_COOKIE_VALUE_GOES_HERE") {
        try {
            const profileDataWithCookie: ProfileData = await scrapeLinkedInProfile(
                PROFILE_URL,
                LINKEDIN_SESSION_COOKIE
            );
            console.log("\n--- Scraped Profile Data (with cookie) ---");
            console.log(JSON.stringify(profileDataWithCookie, null, 2));
            console.log("-------------------------------------------\n");
        } catch (error: any) {
            console.error("\n--- SCRAPING FAILED (with cookie) ---");
            console.error(error.message);
            console.error("---------------------------------------\n");
        }
    } else {
        console.warn("\nPlease provide a valid LinkedIn session cookie to test without persistent session.\n");
    }

    console.log("\n--- Testing with persistent session (make sure you've logged in once) ---\n");
    try {
        const profileDataPersistent: ProfileData = await scrapeLinkedInProfile(
            PROFILE_URL,
            undefined,
            true
        );
        console.log("\n--- Scraped Profile Data (persistent session) ---");
        console.log(JSON.stringify(profileDataPersistent, null, 2));
        console.log("-------------------------------------------------\n");
    } catch (error: any) {
        console.error("\n--- SCRAPING FAILED (persistent session) ---");
        console.error(error.message);
        console.error("-------------------------------------------\n");
    }
}

// Execute the test function (optional, for local testing)
// runTest();