import { db, storage } from './firebaseConfig.ts';
import { 
  collection as firestoreCollection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query,
  orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

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
      return () => {}; // Return no-op unsubscription
    }
  },

  add: async (name: string, item: any) => {
    try {
      if (item.id) {
        await setDoc(doc(db, name, item.id), item);
      } else {
        await addDoc(firestoreCollection(db, name), item);
      }
      return true;
    } catch (e) {
      console.error("Firestore Add Error:", e);
      return false;
    }
  },

  update: async (name: string, id: string, updatedItem: any) => {
    try {
      const docRef = doc(db, name, id);
      await updateDoc(docRef, updatedItem);
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