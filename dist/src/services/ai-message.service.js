"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePersonalizedMessage = generatePersonalizedMessage;
exports.generatePersonalizedMessageWithClaude = generatePersonalizedMessageWithClaude;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const openai_1 = __importDefault(require("openai"));
dotenv_1.default.config();
async function generatePersonalizedMessage(profileData) {
    var _a, _b, _c;
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key is not defined in environment variables');
        }
        const openai = new openai_1.default({
            apiKey: apiKey,
        });
        const prompt = `
      Generate a personalized LinkedIn outreach message based on the following profile information:
      
      Name: ${profileData.name}
      Job Title: ${profileData.jobTitle}
      Company: ${profileData.currentCompany}
      Location: ${profileData.location}
      Summary: ${profileData.summary}

      The message should:
      1. Be friendly and professional
      2. Mention their job title and company
      3. Briefly explain how our Campaign Management System can help them with their outreach and increase meetings & sales
      4. End with a clear call to action
      5. Be under 200 characters
    `;
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant that generates personalized LinkedIn outreach messages.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 200
        });
        const message = (_b = (_a = response.choices[0].message.content) === null || _a === void 0 ? void 0 : _a.trim()) !== null && _b !== void 0 ? _b : '';
        return message;
    }
    catch (error) {
        console.error('Error generating personalized message:', error);
        // Fallback message if AI service fails
        const firstName = ((_c = profileData.name) === null || _c === void 0 ? void 0 : _c.split(' ')[0]) || 'there';
        return `Hey ${firstName}, I see you're working as a ${profileData.jobTitle} at ${profileData.currentCompany}. Our tool can help automate your outreach and increase meetings & sales. Let's connect!`;
    }
}
// Alternative implementation using Claude API (Anthropic)
async function generatePersonalizedMessageWithClaude(profileData) {
    try {
        const apiKey = process.env.CLAUDE_API_KEY;
        if (!apiKey) {
            throw new Error('Claude API key is not defined in environment variables');
        }
        const response = await axios_1.default.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 200,
            messages: [
                {
                    role: 'user',
                    content: `Generate a personalized LinkedIn outreach message based on the following profile information:
            
            Name: ${profileData.name}
            Job Title: ${profileData.jobTitle}
            Company: ${profileData.currentCompany}
            Location: ${profileData.location}
            Summary: ${profileData.summary}
            
            The message should:
            1. Be friendly and professional
            2. Mention their job title and company
            3. Briefly explain how our Campaign Management System can help them with their outreach and increase meetings & sales
            4. End with a clear call to action
            5. Be under 200 characters`
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        const message = response.data.content[0].text.trim();
        return message;
    }
    catch (error) {
        console.error('Error generating personalized message with Claude:', error);
        // Use OpenAI as fallback
        return generatePersonalizedMessage(profileData);
    }
}
