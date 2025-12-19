import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// 👇 PASTE YOUR CONFIG FROM GOOGLE HERE AGAIN
const firebaseConfig = {
  apiKey: "AIzaSyA4jcCscCOQ2-pAr5mtnG5kCxtPh2sb430",
  authDomain: "haizur-types.firebaseapp.com",
  databaseURL: "https://haizur-types-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "haizur-types",
  storageBucket: "haizur-types.firebasestorage.app",
  messagingSenderId: "344311091924",
  appId: "1:344311091924:web:4dbf349fbdd02c23f26141",
  measurementId: "G-9EDMPLVYP7"
};

const app = initializeApp(firebaseConfig);

// ⚠️ THIS LINE WAS THE PROBLEM. IT MUST SAY "export"
export const db = getDatabase(app);