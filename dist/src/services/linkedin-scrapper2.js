"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeLinkedInProfile2 = scrapeLinkedInProfile2;
const linkedin_profile_scraper_1 = require("linkedin-profile-scraper");
/**
 * Scrapes a LinkedIn profile and returns structured data
 * @param linkedin_url The LinkedIn profile URL to scrape
 * @param sessionCookieValue LinkedIn session cookie (li_at)
 * @param usePersistentSession Whether to use a persistent browser session
 * @returns ProfileData object with scraped information
 */
async function scrapeLinkedInProfile2(linkedin_url, sessionCookieValue, usePersistentSession = false) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        console.log(`Scraping LinkedIn profile: ${linkedin_url}`);
        console.log(`Session mode: ${usePersistentSession ? 'Persistent' : 'Cookie-based'}`);
        if (!sessionCookieValue && !usePersistentSession) {
            throw new Error("LinkedIn session cookie (\"li_at\") value is required and must be a string.");
        }
        // Create the scraper instance
        const scraper = new linkedin_profile_scraper_1.LinkedInProfileScraper({
            sessionCookieValue: sessionCookieValue || '',
            keepAlive: usePersistentSession
        });
        // Set up the scraper
        console.log("Setting up LinkedIn profile scraper...");
        await scraper.setup();
        // Run the scraper
        console.log("Running LinkedIn profile scraper...");
        const result = await scraper.run(linkedin_url);
        console.log("LinkedIn profile scraping complete.");
        // For debugging
        console.log("Result structure:", JSON.stringify(result, null, 2).substring(0, 500) + '...');
        // Format location as a single string
        let locationStr = null;
        if ((_a = result.userProfile) === null || _a === void 0 ? void 0 : _a.location) {
            const loc = result.userProfile.location;
            const parts = [loc.city, loc.province, loc.country].filter(Boolean);
            locationStr = parts.length > 0 ? parts.join(', ') : null;
        }
        // Convert the result to our ProfileData interface
        const profileData = {
            name: ((_b = result.userProfile) === null || _b === void 0 ? void 0 : _b.fullName) || null,
            description: ((_c = result.userProfile) === null || _c === void 0 ? void 0 : _c.title) || null,
            jobTitle: ((_e = (_d = result.experiences) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.title) || null,
            currentCompany: ((_g = (_f = result.experiences) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.company) || null,
            location: locationStr,
            summary: ((_h = result.userProfile) === null || _h === void 0 ? void 0 : _h.description) || null // Note: May be null in many cases
        };
        // Clean up if not using persistent session
        if (!usePersistentSession) {
            await scraper.close();
        }
        return profileData;
    }
    catch (error) {
        console.error("Error scraping LinkedIn profile:", error);
        throw new Error(`Failed to scrape profile: ${error.message}`);
    }
}
