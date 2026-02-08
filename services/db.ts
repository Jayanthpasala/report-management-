import { db, storage } from './firebaseConfig.ts';
import { 
  collection as firestoreCollection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

/**
 * Strips 'undefined' values from an object. 
 * Firestore does not allow 'undefined', so we remove these keys or convert them to null.
 */
const sanitize = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitize);
  } else if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, sanitize(value)])
    );
  }
  return data;
};

/**
 * Uploads a file to Firebase Storage. 
 * Falls back to Base64 data URL if the storage bucket is inaccessible.
 */
export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (e: any) {
    console.warn("Storage upload restricted (Permission Denied). Falling back to Base64 persistence.", e);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};

/**
 * Generic Firestore collection wrapper with sanitization.
 */
export const collection = {
  subscribe: (name: string, callback: (data: any[]) => void) => {
    try {
      const q = query(firestoreCollection(db, name));
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        callback(data);
      }, (error) => {
        console.error(`Firestore Subscription Error [${name}]:`, error);
      });
    } catch (e) {
      console.error(`Firestore setup error for ${name}:`, e);
      return () => {};
    }
  },

  add: async (name: string, item: any) => {
    try {
      const sanitizedItem = sanitize(item);
      if (sanitizedItem.id) {
        await setDoc(doc(db, name, sanitizedItem.id), sanitizedItem);
      } else {
        await addDoc(firestoreCollection(db, name), sanitizedItem);
      }
      return true;
    } catch (e) {
      console.error("Firestore Add Error:", e);
      return false;
    }
  },

  update: async (name: string, id: string, updatedFields: any) => {
    try {
      const sanitizedFields = sanitize(updatedFields);
      const docRef = doc(db, name, id);
      await updateDoc(docRef, sanitizedFields);
      return true;
    } catch (e) {
      console.error("Firestore Update Error:", e);
      return false;
    }
  },

  remove: async (name: string, id: string) => {
    try {
      const docRef = doc(db, name, id);
      await deleteDoc(docRef);
      return true;
    } catch (e) {
      console.error("Firestore Remove Error:", e);
      return false;
    }
  }
};