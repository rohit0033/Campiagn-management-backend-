
// Assuming these imports and helpers are available in the scope
// You might need to adjust paths based on your project structure.
import axios, { AxiosInstance } from 'axios';
import { getLinkedInCsrfInfo, getUserAgent } from '../helper/linkedin.auth.helper'; 
import { CookieJar } from 'tough-cookie';
// const userAgents = [
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
//     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
//     "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
//     "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
//     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0 Safari/537.36"
//   ];

// // Assuming userAgents.ts/js exists
// // import { createAxiosClient } from './helpers'; // Or incorporate its logic
// export const getUserAgent = () => {
//     const index = Math.floor(Math.random() * userAgents.length);
//     const userAgent = userAgents[index];
//     return userAgent;
//   };
// Define the ProfileData interface based on your expected output
interface ProfileData {
  name: string | null;
  description: string | null; // Corresponds to headline
  jobTitle: string | null;    // Corresponds to currentRole
  currentCompany: string | null;
  location: string | null;
  summary: string | null;
}

// --- Helper functions adapted from reference ---

/**
 * Function to extract LinkedIn username from a given URL
 * @param {string} url - The LinkedIn profile URL
 * @returns {string|null} - The extracted username or null if not found
 */
const extractLinkedInUsername = (url: string): string | null => {
  // Added optional trailing slash and query params handling
  const regex = /https:\/\/(?:www\.)?linkedin\.com\/in\/([^/?#]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

/**
 * Extracts the CSRF token from cookies (specifically JSESSIONID).
 * - An array of cookie strings from 'set-cookie' header.
 * @returns {string} The CSRF token.
 * @throws {Error} If JSESSIONID cookie is not found.
 */



export async function scrapeLinkedInProfileViaAPI(
  linkedInUrl: string,
  sessionCookie: string // This is the 'li_at' cookie value
): Promise<ProfileData> {
  if (!sessionCookie) {
    throw new Error('LinkedIn session cookie (li_at) is required');
  }

  const username = extractLinkedInUsername(linkedInUrl);
  if (!username) {
    throw new Error(`Invalid LinkedIn profile URL: ${linkedInUrl}`);
  }

  const userAgent = getUserAgent();
//   const AUTH_BASE_URL = "https://www.linkedin.com";

  try {
    console.log(`Scraping profile for ${username} using User-Agent: ${userAgent}`);
    // Pass the generated userAgent to the helper
    const { csrfTokenValue, jsessionIdCookieString } = await getLinkedInCsrfInfo(userAgent);
    console.log(`Obtained CSRF token: ${csrfTokenValue}, JSESSIONID string: ${jsessionIdCookieString}`);

    // --- Step 2: Prepare headers for the main API call ---
    const finalCookieHeader = `li_at=${sessionCookie}; ${jsessionIdCookieString}`;

    const finalHeaders = {
      'User-Agent': userAgent, // Use the same userAgent for consistency
      'Accept': 'application/vnd.linkedin.normalized+json+2.1',
      'X-Restli-Protocol-Version': '2.0.0',
      'csrf-token': csrfTokenValue,
      'Cookie': finalCookieHeader,
    };

    const finalClient = axios.create({ headers: finalHeaders });

    // --- Step 3: Make the API request to get profile data ---
    const apiUrl = `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${username}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101&count=100`; // Using count=100 as in reference

    const profileApiResponse = await finalClient.get(apiUrl);

    // Update the profile data extraction part (around line 150-160)


const profileData = profileApiResponse.data;

// Debug the structure
console.log("Response structure keys:", Object.keys(profileData));


let profileInfo = null;

// If we have included entities, try to extract profile data from there
if (profileData.included) {
  console.log("Found included data, searching for profile information...");
//   console.log("Included data keys:", profileData);
  // Find the profile information in the included array
// Interface for LinkedIn profile items in the included array
interface LinkedInProfileItem {
    $type: string;
    firstName?: string;
    lastName?: string;
    headline?: string;
    summary?: string;
    [key: string]: any; // For other potential properties
}

profileInfo = profileData.included.find((item: LinkedInProfileItem) => 
        item.$type === "com.linkedin.voyager.dash.identity.profile.Profile");
}

// If we couldn't find profile data through included, check if elements exists
if (!profileInfo && profileData.elements && profileData.elements.length > 0) {
  console.log("Using elements array for profile data");
  profileInfo = profileData.elements[0];
}

// Last resort: try to extract what we can from the main response
if (!profileInfo) {
  console.log("Using main response object for profile data");
  // Look for keys that might contain profile information
  const nameKeys = ["firstName", "lastName", "fullName"];
  const hasProfileData = nameKeys.some(key => profileData[key]);
  
  if (hasProfileData) {
    profileInfo = profileData;
  } else {
    // Try to extract whatever useful info we can find
    profileInfo = {};
    // Look for profile-related data throughout the response
    if (profileData.data && profileData.data.firstName) {
      profileInfo = profileData.data;
    }
  }
}

// If we still couldn't find any profile data, throw an error
if (!profileInfo) {
  console.error("Could not find profile data in the API response");
  console.log("Response snippet:", JSON.stringify(profileData).substring(0, 300) + "...");
  throw new Error(`Failed to extract profile data from LinkedIn API response. Structure unexpected.`);
}

// Now extract the actual profile information
let firstName = profileInfo.firstName || '';
let lastName = profileInfo.lastName || '';
let headline = profileInfo.headline || null;
let summary = profileInfo.summary || null;
let location = null;
if (profileInfo.location) {
    const locationUrn = profileInfo.location['*geo'];
    if (locationUrn) {
      const geoData = profileData.included.find((item: any) => item.entityUrn === locationUrn);
      if (geoData && geoData.defaultLocalizedName) {
        location = geoData.defaultLocalizedName;
      }
    } else if (profileInfo.location.locationName){
        location = profileInfo.location.locationName;
    }
  }

// If we have a "data" property with companies, try to extract current role info
let currentRole = null;
let currentCompany = null;

// Try to find experience information
if (profileData.included) {
  // Look for experience entries
// Define interface for LinkedIn Position items
interface LinkedInPositionItem {
    $type: string;
    title?: string;
    companyName?: string;
    endDate?: {
        month?: number;
        year?: number;
    } | null;
    [key: string]: any; // For other potential properties
}

// Filter experiences with proper typing
const experiences: LinkedInPositionItem[] = profileData.included.filter((item: any): item is LinkedInPositionItem => 
        item.$type === "com.linkedin.voyager.dash.identity.profile.Position");
  
  if (experiences && experiences.length > 0) {
    // Sort by endDate (null/undefined means current position)
    experiences.sort((a, b) => {
      if (!a.endDate) return -1;
      if (!b.endDate) return 1;
      return 0;
    });
    
    // Use the first (most recent) position
    const latestExp = experiences[0];
    currentRole = latestExp.title || null;
    currentCompany = latestExp.companyName || null;
  }
}

// Extract name if it wasn't found directly
if (!firstName && !lastName && profileData.fullName) {
  const nameParts = profileData.fullName.split(' ');
  firstName = nameParts[0] || '';
  lastName = nameParts.slice(1).join(' ') || '';
}

// Build the final profile data object
const result: ProfileData = {
  name: `${firstName} ${lastName}`.trim() || profileData.fullName || null,
  description: headline || profileData.headline || null,
  jobTitle: currentRole || null,
  currentCompany: currentCompany || null,
  location: location || null,
  summary: summary || null
};

// Log the extracted data
console.log("Successfully extracted profile data:", result);

return result;

  } catch (error: any) {
    // Provide more context in the error message
    let errorMessage = `Failed to scrape LinkedIn profile (${username})`;

    if (axios.isAxiosError(error)) {
      errorMessage += `: ${error.message}`;
      if (error.response) {
        errorMessage += ` (Status: ${error.response.status})`;
         // Specifically check for common auth errors
         if (error.response.status === 401 || error.response.status === 403) {
            errorMessage = `Authentication failed for LinkedIn profile (${username}). Session cookie may be invalid/expired or CSRF token mismatch. (Status: ${error.response.status})`;
         } else if (error.response.status === 404) {
             errorMessage = `LinkedIn profile not found for username: ${username}. (Status: 404)`;
         } else if (error.response.status === 429) {
             errorMessage = `Rate limited by LinkedIn while fetching profile (${username}). Please wait before trying again. (Status: 429)`;
         }
       
      } else if (error.request) {
          errorMessage += ' - No response received from LinkedIn.';
      }
    } else if (error instanceof Error) {
        // Include messages from known errors like CSRF token issues
        errorMessage += `: ${error.message}`;
    } else {
        errorMessage += `: An unknown error occurred.`;
    }

    console.error('Error accessing LinkedIn API:', error); // Log the original error
    throw new Error(errorMessage); // Throw the new, more informative error
  }
}

// --- Example Usage (replace with your actual implementation) ---
/*
async function runExample() {
  const profileUrl = "https://www.linkedin.com/in/williamhgates/"; // Example profile
  const li_at_cookie = "YOUR_ACTUAL_LI_AT_COOKIE_VALUE"; // Replace with your valid li_at cookie

  if (li_at_cookie === "YOUR_ACTUAL_LI_AT_COOKIE_VALUE") {
     console.warn("Please replace 'YOUR_ACTUAL_LI_AT_COOKIE_VALUE' with your real li_at cookie.");
     return;
  }

  try {
    console.log(`Attempting to scrape profile: ${profileUrl}`);
    const profile = await scrapeLinkedInProfileViaAPI(profileUrl, li_at_cookie);
    console.log("Scraped Profile Data:");
    console.log(JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error("Scraping failed:", error);
  }
}

runExample();
*/

// --- Required Helper Functions (ensure these are defined/imported) ---

// getUserAgent function (as provided in reference)
// Assuming userAgents.json is in the same directory or path is adjusted
// import userAgents from './userAgents.json';
// export const getUserAgent = (): string => {
//  const index = Math.floor(Math.random() * userAgents.length);
//  const userAgent = userAgents[index];
//  return userAgent;
// };

// Ensure you have installed necessary packages:
// npm install axios tough-cookie
// npm install -D @types/tough-cookie (if using TypeScript)