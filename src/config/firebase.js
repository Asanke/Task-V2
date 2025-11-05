// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyA5e-ryWA8_NvnqVpi3xizpGRSDqbIOZEU",
    authDomain: "task-582ac.firebaseapp.com",
    projectId: "task-582ac",
    storageBucket: "task-582ac.firebasestorage.app",
    messagingSenderId: "234394879623",
    appId: "1:234394879623:web:c6bb2684638992100c1a22",
    measurementId: "G-TYQMKVSBRE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support persistence.');
    }
});

export { app, auth, db, functions };
