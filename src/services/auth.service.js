// Authentication Service
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from 'firebase/auth';
import { auth, db } from '../config/firebase.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

class AuthService {
    async signup(email, password, displayName) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update profile
        await updateProfile(user, { displayName });

        // Create user document
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            photoURL: null,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
        });

        return user;
    }

    async login(email, password) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Update last login
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            lastLogin: serverTimestamp()
        }, { merge: true });

        return userCredential.user;
    }

    async logout() {
        await signOut(auth);
    }

    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch user profile
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                callback({ ...user, ...userData });
            } else {
                callback(null);
            }
        });
    }

    getCurrentUser() {
        return auth.currentUser;
    }
}

export default new AuthService();
