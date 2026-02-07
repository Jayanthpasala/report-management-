
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Added safety check for undefined text input
const cleanJsonResponse = (text: string | undefined) => {
  if (!text) return "";
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
  }
  return cleaned;
};

/**
 * Parses payment segregation from POS reports (PDF/Images/Excel).
 * Uses Gemini 3 Pro for high-fidelity extraction and categorization.
 */
export const parsePaymentSegregation = async (base64Data: string, mimeType: string) => {
  // Fix: Instantiate GoogleGenAI right before the call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { 
            text: `Extract payment segregation data from this POS report. 
            MANDATORY CATEGORIZATION: 
            - 'UPI' (includes GPay, PhonePe, Paytm, QR scans)
            - 'Card' (includes Visa, Mastercard, Debit, Credit)
            - 'Cash' (includes physical currency)
            - 'Online' (includes Zomato, Swiggy, Web Orders)
            
            For 'amount', return a PURE NUMBER without currency symbols. 
            Format: Array of objects with date (YYYY-MM-DD), paymentMethod, and amount.` 
          }
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
            paymentMethod: { type: Type.STRING, description: "Must be normalized to: Card, UPI, Cash, or Online" },
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

/**
 * Parses item-wise sales breakdown.
 */
export const parseItemWiseBreakdown = async (base64Data: string, mimeType: string) => {
  // Fix: Instantiate GoogleGenAI right before the call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract item-wise sales data. For 'amount', return a PURE NUMBER without currency symbols. Format: Array of objects with date (YYYY-MM-DD), itemCategory, itemName, quantity (number), and amount (number)." }
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
    console.error("Failed to parse Item-wise response", e);
    return [];
  }
};

/**
 * Parses vendor bills and invoices.
 */
export const parseVendorBill = async (base64Data: string, mimeType: string) => {
  // Fix: Instantiate GoogleGenAI right before the call to ensure the latest API key is used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: "Extract invoice details precisely. 'amount' must be a number without symbols. 'currency' must be the 3-letter ISO code found on the document." }
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
    console.error("Failed to parse Vendor Bill", e);
    return null;
  }
};
