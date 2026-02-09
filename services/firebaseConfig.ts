// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCVj7X7CRTByLG7YF3IlYNofMVFI5D41Kk",
    authDomain: "abhigyan-gurukul.firebaseapp.com",
    projectId: "abhigyan-gurukul",
    storageBucket: "abhigyan-gurukul.firebasestorage.app",
    messagingSenderId: "871374608648",
    appId: "1:871374608648:web:fc1124bba966c56d63f4bd",
    measurementId: "G-93N8W9YQPZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage = getStorage(app);

export { app, analytics, storage };
