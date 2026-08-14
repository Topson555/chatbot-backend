import { GoogleGenerativeAI } from '@google/genai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateSessionTitle(userFirstMessage) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const prompt = `Summarize the following user request into a concise 3 to 5 word session title. Do not use quotes or punctuation: "${userFirstMessage}"`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim();
    return title || 'New Conversation';
  } catch (error) {
    console.error('Title generation failed, using fallback:', error.message);
    return 'New Conversation';
  }
}