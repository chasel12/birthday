
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateBirthdayWish = async (name: string): Promise<string> => {
  if (!process.env.API_KEY) return "Wishing you a magical birthday filled with joy and stardust!";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, poetic, and heartwarming birthday wish for ${name}. The theme should involve stars, magic, and sweet cakes. Keep it under 30 words.`,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text || "May your day be as bright as a thousand stars!";
  } catch (error) {
    console.error("Error generating wish:", error);
    return "Wishing you a spectacular year ahead!";
  }
};
