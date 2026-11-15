// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBqaOG0ijQuHd20pcvnlUroXSv4fmivAzs",
  authDomain: "book-marathon-japa.firebaseapp.com",
  databaseURL: "https://book-marathon-japa-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "book-marathon-japa",
  storageBucket: "book-marathon-japa.firebasestorage.app",
  messagingSenderId: "944387643701",
  appId: "1:944387643701:web:ac064979548f4b6ce8d47c"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
