"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMessageFromProfileUrlAPI = exports.generateMessageFromProfileUrl = exports.generateMessageFromProfileData = void 0;
const ai_message_service_1 = require("../services/ai-message.service");
const linkedin_scrapper2_1 = require("../services/linkedin-scrapper2");
const linkedin_api_scrappper_1 = require("../services/linkedin-api-scrappper");
const leadsData_Models_1 = __importDefault(require("../models/leadsData.Models"));
async function saveProfileDataToLeads(linkedInUrl, profileData) {
    try {
        await leadsData_Models_1.default.findOneAndUpdate({ linkedInUrl }, {
            $set: {
                name: profileData.name,
                linkedInUrl: profileData.linkedInUrl,
                description: profileData.description,
                jobTitle: profileData.jobTitle,
                currentCompany: profileData.currentCompany,
                location: profileData.location,
                summary: profileData.summary
            }
        }, { upsert: true, new: true });
        console.log(`Saved profile data for ${linkedInUrl} to LeadsData collection`);
    }
    catch (error) {
        console.error(`Error saving profile data for ${linkedInUrl}:`, error);
        // Don't throw the error - we don't want to fail the main request if data saving fails
    }
}
const generateMessageFromProfileData = async (req, res) => {
    try {
        const { name, jobTitle, currentCompany, location, summary, linkedin_url } = req.body;
        if (!name || !jobTitle || !currentCompany) {
            res.status(400).json({ message: "Missing required profile information" });
            return;
        }
        const profileData = {
            name,
            description: null,
            linkedInUrl: linkedin_url,
            jobTitle,
            currentCompany,
            location,
            summary,
        };
        if (profileData.name) {
            // Save data in the background - don't await
            saveProfileDataToLeads(linkedin_url, profileData).catch(err => console.error("Failed to save profile data:", err));
        }
        const message = await (0, ai_message_service_1.generatePersonalizedMessage)(profileData);
        res.status(200).json({ message });
    }
    catch (error) {
        console.error("Error generating message from profile data:", error);
        res
            .status(500)
            .json({
            message: "Failed to generate personalized message",
            error: error.message,
        });
    }
};
exports.generateMessageFromProfileData = generateMessageFromProfileData;
// Generate a personalized message based on LinkedIn profile URL (scraping)
// Add this import at the top
// Then update the generateMessageFromProfileUrl function to add a third fallback option:
const generateMessageFromProfileUrl = async (req, res) => {
    try {
        const { linkedin_url, session_cookie } = req.body;
        if (!linkedin_url) {
            res.status(400).json({ message: "LinkedIn profile URL is required" });
            return;
        }
        // Get cookie from request or environment
        const cookieToUse = session_cookie || process.env.SESSION_COOKIE;
        let profileData;
        let error;
        // Try method 1: Regular scraping
        try {
            console.log("Attempting to scrape with provided cookie...");
            profileData = await (0, linkedin_scrapper2_1.scrapeLinkedInProfile2)(linkedin_url, cookieToUse, false // Not using persistent session
            );
        }
        catch (err) {
            error = err;
            console.warn("Cookie-based scraping failed:", err.message);
            // Try method 2: Persistent session
            if (!err.message.includes("requires authentication") &&
                !err.message.includes("login required")) {
                try {
                    console.log("Attempting fallback with persistent session...");
                    profileData = await (0, linkedin_scrapper2_1.scrapeLinkedInProfile2)(linkedin_url, "", // Empty cookie
                    true // Using persistent session
                    );
                }
                catch (persistentErr) {
                    console.error("Persistent session scraping also failed:", persistentErr.message);
                    // Try method 3: API-based scraping as final fallback
                    try {
                        console.log("Attempting API-based scraping as final fallback...");
                        profileData = await (0, linkedin_api_scrappper_1.scrapeLinkedInProfileViaAPI)(linkedin_url, cookieToUse);
                    }
                    catch (apiErr) {
                        console.error("API-based scraping also failed:", apiErr.message);
                        // Use the original error
                        throw error;
                    }
                }
            }
            else {
                throw err; // Re-throw auth errors
            }
        }
        // Generate message based on profile data
        let message = "Unable to generate personalized message with limited profile data.";
        // Check if we have enough data to generate a message
        if (profileData && profileData.name) {
            try {
                message = await (0, ai_message_service_1.generatePersonalizedMessage)(profileData);
            }
            catch (msgError) {
                console.error("Error generating message:", msgError);
                // Continue with default message
            }
        }
        // Always return whatever data we were able to get
        res.status(200).json({
            profileData,
            message,
            limited: !profileData.currentCompany || !profileData.jobTitle
        });
    }
    catch (error) {
        console.error("Error processing LinkedIn profile:", error);
        res.status(500).json({
            message: "Failed to generate personalized message",
            error: error.message
        });
    }
};
exports.generateMessageFromProfileUrl = generateMessageFromProfileUrl;
/**
 * Generate a personalized message using only the LinkedIn API scraping method
 * This approach tends to be more reliable than HTML-based scraping
 */
const generateMessageFromProfileUrlAPI = async (req, res) => {
    try {
        const { linkedin_url, session_cookie } = req.body;
        if (!linkedin_url) {
            res.status(400).json({ message: "LinkedIn profile URL is required" });
            return;
        }
        const cookieToUse = session_cookie || "AQEDAUoaEmMATyq7AAABlgVIQYAAAAGWKVTFgE0AMiLcZZ4h6vwFzIpSvKZ8gKOMXsiHesw_Zsm-ynSp2vpsmlRO2sjE8Ko6KcOBx_UZSvtbAkW2WJyRQHQSvmRp-iLQZfu50dRtMRDPJfda2iX9CUCZ";
        if (!cookieToUse) {
            res.status(400).json({ message: "LinkedIn session cookie (li_at) is required" });
            return;
        }
        console.log(`Using API-based scraping for profile: ${linkedin_url}`);
        // Get profile data using only the API method
        const profileData = await (0, linkedin_api_scrappper_1.scrapeLinkedInProfileViaAPI)(linkedin_url, cookieToUse);
        if (!profileData) {
            res.status(404).json({ message: "Profile data not found" });
        }
        // Make sure profileData matches our local ProfileData interface
        const conformedProfileData = {
            name: profileData.name,
            linkedInUrl: linkedin_url, // Ensure linkedInUrl is set
            description: profileData.description,
            jobTitle: profileData.jobTitle,
            currentCompany: profileData.currentCompany,
            location: profileData.location,
            summary: profileData.summary
        };
        if (conformedProfileData.name) {
            // Save data in the background - don't await
            saveProfileDataToLeads(linkedin_url, conformedProfileData).catch(err => console.error("Failed to save profile data:", err));
        }
        // Generate message based on profile data
        let message = "Unable to generate personalized message with limited profile data.";
        // Check if we have enough data to generate a message
        if (profileData && profileData.name) {
            try {
                message = await (0, ai_message_service_1.generatePersonalizedMessage)(profileData);
            }
            catch (msgError) {
                console.error("Error generating message:", msgError);
                // Continue with default message
            }
        }
        // Return the data and message
        res.status(200).json({
            profileData,
            message,
            limited: !profileData.currentCompany || !profileData.jobTitle,
            source: "linkedin-api"
        });
    }
    catch (error) {
        console.error("Error processing LinkedIn profile via API:", error);
        res.status(500).json({
            message: "Failed to generate personalized message using API method",
            error: error.message
        });
    }
};
exports.generateMessageFromProfileUrlAPI = generateMessageFromProfileUrlAPI;
