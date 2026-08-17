import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateSessionTitle(userFirstMessage) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return 'New Conversation';

    const genAI = new GoogleGenerativeAI(apiKey);
    // Updated to gemini-2.0-flash for speed and reliability
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    
    const result = await model.generateContent(
      `Summarize the following user request into a concise 3 to 5 word session title. Do not use quotes or punctuation: "${userFirstMessage}"`
    );

    const title = result.response.text();
    if (!title) return 'New Conversation';

    // Remove quotes, line breaks, and extra spaces
    const cleanTitle = title
      .replace(/["'\n\r]/g, '')
      .trim();

    return cleanTitle || 'New Conversation';
  } catch (error) {
    console.error('Title generation fallback active:', error.message);
    return 'New Conversation';
  }
}