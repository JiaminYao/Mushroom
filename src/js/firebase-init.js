// ===== Firebase Client Configuration =====
const firebaseConfig = {
    apiKey: "AIzaSyAt_BowGAilnRZj5s0366W2RSpjJbH-5g8",
    authDomain: "mushroom-game-c7205.firebaseapp.com",
    projectId: "mushroom-game-c7205",
    storageBucket: "mushroom-game-c7205.firebasestorage.app",
    messagingSenderId: "484914785040",
    appId: "1:484914785040:web:51754118f978fc1fea1395",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Auth instance
const auth = firebase.auth();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
