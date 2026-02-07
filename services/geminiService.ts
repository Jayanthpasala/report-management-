import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

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
 * Categorizes strictly by payment method.
 */
export const parsePaymentSegregation = async (base64Data: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { 
          text: `Extract the payment summary from this POS report. 
          STRICT CATEGORIZATION RULES:
          1. UPI: All digital wallet transfers (GPay, PhonePe, Paytm, QR).
          2. Card: All Visa, Mastercard, AMEX, Debit, and Credit swipes.
          3. Cash: Physical currency transactions.
          4. Online: Aggregators like Zomato, Swiggy, or Direct Web orders.
          
          If a specific transaction doesn't fit, use 'Other'.
          Return data as a JSON array of objects with keys: date (YYYY-MM-DD), paymentMethod, amount (number).` 
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            paymentMethod: { type: Type.STRING, description: "Normalized to: Card, UPI, Cash, Online, or Other" },
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
 * Parses item-wise sales breakdown for product ranking and categorization.
 */
export const parseItemWiseBreakdown = async (base64Data: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Extract item-wise sales breakdown. Return a JSON array of objects: date (YYYY-MM-DD), itemCategory, itemName, quantity (number), amount (number)." }
      ]
    },
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
 * Parses vendor bills/invoices for operational expenditure logging.
 */
export const parseVendorBill = async (base64Data: string, mimeType: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Extract invoice details. amount must be a number. currency must be ISO code." }
      ]
    },
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