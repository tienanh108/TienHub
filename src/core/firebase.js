import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2thMfX5cl7FqnPB-q8WKH5ts7WDJqUAs",
    authDomain: "tienhub-ca5c3.firebaseapp.com",
    databaseURL: "https://tienhub-ca5c3-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tienhub-ca5c3",
    storageBucket: "tienhub-ca5c3.firebasestorage.app",
    messagingSenderId: "51330279386",
    appId: "1:51330279386:web:cf69c206260448f2da02e3",
    measurementId: "G-H90525VMVN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export {
    app,
    auth,
    db
};
