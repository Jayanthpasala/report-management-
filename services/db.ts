
const DB_PREFIX = 'finout_v1_';

export const db = {
  save: (key: string, data: any) => {
    try {
      localStorage.setItem(`${DB_PREFIX}${key}`, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  },
  get: (key: string) => {
    try {
      const item = localStorage.getItem(`${DB_PREFIX}${key}`);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      return null;
    }
  }
};

export const collection = {
  // Simple polling or local state update shim since we no longer use Firebase subscriptions
  subscribe: (name: string, callback: (data: any[]) => void) => {
    const data = db.get(name) || [];
    callback(data);
    
    // Polling as a fallback for local "sync" across components if needed
    const interval = setInterval(() => {
      const newData = db.get(name) || [];
      callback(newData);
    }, 1000);

    return () => clearInterval(interval);
  },

  add: async (name: string, item: any) => {
    const id = item.id || `${name.charAt(0).toUpperCase()}-${Date.now()}`;
    const itemWithId = { ...item, id };
    const localData = db.get(name) || [];
    db.save(name, [...localData, itemWithId]);
    return true;
  },

  update: async (name: string, id: string, updatedItem: any) => {
    const localData = db.get(name) || [];
    const updatedLocal = localData.map((i: any) => i.id === id ? { ...i, ...updatedItem } : i);
    db.save(name, updatedLocal);
    return true;
  },

  remove: async (name: string, id: string) => {
    const localData = db.get(name) || [];
    const filteredLocal = localData.filter((i: any) => i.id !== id);
    db.save(name, filteredLocal);
    return true;
  }
};
