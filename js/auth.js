// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCdD_2OiWmXNoOv4z_9NyAANmZ3-aUIKcY",
    authDomain: "logiaattendance.firebaseapp.com",
    projectId: "logiaattendance",
    storageBucket: "logiaattendance.firebasestorage.app",
    messagingSenderId: "509175398468",
    appId: "1:509175398468:web:c5aef9aa20ed352a27bc11"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Firebase services
export const auth = firebase.auth();
export const db = firebase.firestore();

// Auth Functions
export async function login(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { data: userCredential, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function register(email, password, fullName) {
    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Create profile document in Firestore
        await db.collection('profiles').doc(user.uid).set({
            email: email,
            full_name: fullName,
            password: password, // Storing as requested (not recommended for production)
            role: 'employee',
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { data: userCredential, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
        return { error: null };
    } catch (error) {
        return { error };
    }
}

export async function getSession() {
    return new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

export async function getCurrentUser() {
    return auth.currentUser;
}

// Check auth state on load
export async function checkAuth() {
    const user = await getSession();
    const path = window.location.pathname;
    const isAuthPage = path.includes('index.html') || path.includes('register.html') || path === '/' || path.endsWith('/logia/');

    if (!user && !isAuthPage) {
        window.location.href = 'index.html';
    } else if (user && isAuthPage) {
        window.location.href = 'dashboard.html';
    }
    return user;
}
