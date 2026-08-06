import { GoogleGenAI } from '@google/genai';

let USER_CUSTOM_API_KEY = null;

export const setCustomApiKey = (key) => {
  USER_CUSTOM_API_KEY = key;
};

export const hasApiKey = () => {
  return Boolean(USER_CUSTOM_API_KEY || process.env.GEMINI_API_KEY);
};

export const getAiClient = () => {
  const apiKey = USER_CUSTOM_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Google Gemini API Key is missing.");
  return new GoogleGenAI({ apiKey });
};