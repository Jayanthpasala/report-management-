
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJsonResponse = (text: string) => {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  }
  return cleaned;
};

export const parsePaymentSegregation = async (base64Data: string, mimeType: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract payment segregation data. MANDATORY: Payment methods MUST be exactly one of: 'Card', 'UPI', 'Cash', 'Online'. For 'amount', return a PURE NUMBER. Format: Array of objects with date (YYYY-MM-DD), paymentMethod, and amount." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, description: "Must be Card, UPI, Cash, or Online" },
            amount: { type: Type.NUMBER }
          },
          required: ["date", "paymentMethod", "amount"]
        }
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(response.text));
  } catch (e) {
    console.error("Failed to parse Payment response", e);
    return [];
  }
};

export const parseItemWiseBreakdown = async (base64Data: string, mimeType: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract item-wise sales. For 'amount', return a PURE NUMBER without currency symbols. Format: Array of objects with date (YYYY-MM-DD), itemCategory, itemName, quantity (number), and amount (number)." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            itemCategory: { type: Type.STRING },
            itemName: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            amount: { type: Type.NUMBER }
          },
          required: ["date", "itemCategory", "itemName", "quantity", "amount"]
        }
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(response.text));
  } catch (e) {
    return [];
  }
};

export const parseVendorBill = async (base64Data: string, mimeType: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract invoice details. amount must be a number without symbols. currency must be 3-letter ISO code." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendorName: { type: Type.STRING },
          date: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          category: { type: Type.STRING }
        },
        required: ["vendorName", "date", "amount", "currency", "category"]
      }
    }
  });

  try {
    return JSON.parse(cleanJsonResponse(response.text));
  } catch (e) {
    return null;
  }
};
