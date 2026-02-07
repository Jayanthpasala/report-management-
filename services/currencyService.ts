
const API_KEY = '15462bbda90bc7978eaccae6';

export const getExchangeRateToINR = async (fromCurrency: string): Promise<number> => {
  if (fromCurrency === 'INR') return 1;
  
  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${fromCurrency.toUpperCase()}`);
    const data = await response.json();
    
    if (data && data.conversion_rates && data.conversion_rates.INR) {
      console.log(`[FX System] Verified rate for ${fromCurrency}: ${data.conversion_rates.INR}`);
      return data.conversion_rates.INR;
    }
    
    // Fallback to stable static rates if API fails or throttles
    const mockRates: Record<string, number> = {
      'USD': 83.24,
      'EUR': 90.15,
      'GBP': 105.40,
      'AED': 22.66,
      'SGD': 61.85,
      'SAR': 22.19,
      'QAR': 22.86
    };
    const fallback = mockRates[fromCurrency.toUpperCase()] || 83.0;
    console.warn(`[FX System] API unavailable. Using fallback rate for ${fromCurrency}: ${fallback}`);
    return fallback;
  } catch (error) {
    console.error("Currency API Error:", error);
    return 83.0;
  }
};