
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// Fix: Use @firebase/storage to avoid shadowing issues with the local firebase/ directory
import { getStorage } from "@firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAkfHts6pmosmflfpcx7Ryp_8yigpMI3co",
  authDomain: "studio-9549742704-72ccb.firebaseapp.com",
  projectId: "studio-9549742704-72ccb",
  storageBucket: "studio-9549742704-72ccb.firebasestorage.app",
  messagingSenderId: "11514332732",
  appId: "1:11514332732:web:6df8b42f9ee13f6ad36539"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;