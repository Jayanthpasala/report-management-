
const API_KEY = '15462bbda90bc7978eaccae6';

export const getExchangeRateToINR = async (fromCurrency: string): Promise<number> => {
  if (fromCurrency === 'INR') return 1;
  
  try {
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${fromCurrency.toUpperCase()}`);
    const data = await response.json();
    
    if (data && data.conversion_rates && data.conversion_rates.INR) {
      return data.conversion_rates.INR;
    }
    
    // Fallback to static rates if API fails
    const mockRates: Record<string, number> = {
      'USD': 83.24,
      'EUR': 90.15,
      'GBP': 105.40,
      'AED': 22.66
    };
    return mockRates[fromCurrency.toUpperCase()] || 83.0;
  } catch (error) {
    console.error("Currency API Error:", error);
    return 83.0;
  }
};
