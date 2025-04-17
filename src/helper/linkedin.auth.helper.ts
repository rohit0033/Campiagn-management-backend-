
import axios from 'axios';
// Remove unused import 'get' from 'http'
// import { get } from 'http';
import { CookieJar } from 'tough-cookie';

// Keep User Agent logic here
const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/123.0.0.0 Safari/537.36"
];
export const getUserAgent = () => {
    const index = Math.floor(Math.random() * userAgents.length);
    const userAgent = userAgents[index];
    return userAgent;
};
// Remove this line - it was likely for testing and is unused
// const useragent = getUserAgent();


const AUTH_BASE_URL = "https://www.linkedin.com";

/**
 * Fetches the LinkedIn CSRF token (from JSESSIONID) using an initial request.
 * @param userAgent - The User-Agent string to use for the request.
 * @returns An object containing the CSRF token value and the full JSESSIONID cookie string.
 * @throws {Error} If the request fails or the JSESSIONID cookie is not found.
 */
export async function getLinkedInCsrfInfo(userAgent: string): Promise<{ csrfTokenValue: string; jsessionIdCookieString: string }> {
    const logSection = "getLinkedInCsrfInfo";
    console.log(`[${logSection}] Attempting to fetch CSRF token using User-Agent: ${userAgent}`); // Log the user agent being used

    const initialJar = new CookieJar();
    const initialClient = axios.create({
        headers: {
            'User-Agent': userAgent, // Use the passed userAgent
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        },
        withCredentials: true,
        // @ts-ignore
        jar: initialJar,
        timeout: 15000,
    });

    try {
        const authResponse = await initialClient.get(
            `${AUTH_BASE_URL}/feed/`,
            { maxRedirects: 5 }
        );
        console.log(`[${logSection}] Initial auth request completed with status: ${authResponse.status}`);

        // Get the JSESSIONID cookie string directly from the jar after the request
        const jsessionIdCookieStringFromJar = await initialJar.getCookieString(AUTH_BASE_URL);
        const jsessionMatch = jsessionIdCookieStringFromJar.match(/JSESSIONID="([^"]+)"/);

        if (!jsessionMatch || !jsessionMatch[1]) {
             // Fallback: Check headers if jar didn't capture it as expected
             const cookies = authResponse.headers['set-cookie'];
             if (cookies) {
                 const jsessionCookieHeader = cookies.find((cookie) => cookie.startsWith("JSESSIONID="));
                 if (jsessionCookieHeader) {
                     const headerMatch = jsessionCookieHeader.match(/JSESSIONID="([^"]+)"/);
                     if (headerMatch && headerMatch[1]) {
                         const csrfTokenValue = headerMatch[1];
                         const fullCookie = jsessionCookieHeader.split(';')[0]; // "JSESSIONID=..." part
                         console.log(`[${logSection}] Successfully obtained CSRF token value from header fallback.`);
                         return { csrfTokenValue, jsessionIdCookieString: fullCookie };
                     }
                 }
             }
             // If still not found, throw error
             console.error(`[${logSection}] JSESSIONID cookie not found in jar or headers.`);
             throw new Error("JSESSIONID cookie not found in response.");
        }

        const csrfTokenValue = jsessionMatch[1];
        // Find the specific JSESSIONID cookie string part from the jar's output
        const jsessionIdFullCookie = jsessionIdCookieStringFromJar.split(';').find(c => c.trim().startsWith('JSESSIONID=')) || `JSESSIONID="${csrfTokenValue}"`;


        console.log(`[${logSection}] Successfully obtained CSRF token value from cookie jar.`);
        return { csrfTokenValue, jsessionIdCookieString: jsessionIdFullCookie.trim() };

    } catch (error: any) {
        console.error(`[${logSection}] Error fetching CSRF token:`, error.message);
        if (axios.isAxiosError(error)) {
             console.error(`[${logSection}] Axios error details: Status ${error.response?.status}, Data: ${JSON.stringify(error.response?.data)}`);
        }
        throw new Error(`Failed to obtain LinkedIn CSRF token: ${error.message}`);
    }
}