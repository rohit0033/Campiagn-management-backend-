import { LinkedInProfileScraper } from 'linkedin-profile-scraper';

// Keep the ProfileData interface the same to maintain compatibility
export interface ProfileData {
  name: string | null;
  description: string | null;
  jobTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  summary: string | null;
}

/**
 * Scrapes a LinkedIn profile and returns structured data
 * @param linkedin_url The LinkedIn profile URL to scrape
 * @param sessionCookieValue LinkedIn session cookie (li_at)
 * @param usePersistentSession Whether to use a persistent browser session
 * @returns ProfileData object with scraped information
 */
export async function scrapeLinkedInProfile2(
  linkedin_url: string,
  sessionCookieValue?: string,
  usePersistentSession: boolean = false
): Promise<ProfileData> {
  try {
    console.log(`Scraping LinkedIn profile: ${linkedin_url}`);
    console.log(`Session mode: ${usePersistentSession ? 'Persistent' : 'Cookie-based'}`);
    
    if (!sessionCookieValue && !usePersistentSession) {
      throw new Error("LinkedIn session cookie (\"li_at\") value is required and must be a string.");
    }
    
    // Create the scraper instance
    const scraper = new LinkedInProfileScraper({
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
    if (result.userProfile?.location) {
      const loc = result.userProfile.location;
      const parts = [loc.city, loc.province, loc.country].filter(Boolean);
      locationStr = parts.length > 0 ? parts.join(', ') : null;
    }
    
    // Convert the result to our ProfileData interface
    const profileData: ProfileData = {
      name: result.userProfile?.fullName || null,
      description: result.userProfile?.title || null,
      jobTitle: result.experiences?.[0]?.title || null,
      currentCompany: result.experiences?.[0]?.company || null,
      location: locationStr,
      summary: result.userProfile?.description || null // Note: May be null in many cases
    };
    
    // Clean up if not using persistent session
    if (!usePersistentSession) {
      await scraper.close();
    }
    
    return profileData;
  } catch (error: any) {
    console.error("Error scraping LinkedIn profile:", error);
    throw new Error(`Failed to scrape profile: ${error.message}`);
  }
}