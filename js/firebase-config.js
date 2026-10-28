// ============================================================
//  GREC GROUP — Firebase Configuration
//  Remplacez les valeurs ci-dessous par celles de votre
//  projet Firebase (Console > Paramètres > Config SDK)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDYtG45C8gPNiaJZBHzQ6ViY_iZiCffngs",
  authDomain: "grec-group-f43b0.firebaseapp.com",
  projectId: "grec-group-f43b0",
  storageBucket: "grec-group-f43b0.firebasestorage.app",
  messagingSenderId: "977516136401",
  appId: "1:977516136401:web:36396a64277be4d86702f0"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);

// ── Dossier de base du site (racine du domaine OU sous-dossier comme /grec-site/) ──
const SITE_ROOT = (function () {
  try { return new URL('../', document.currentScript.src).pathname; } catch (e) { return '/'; }
})();


// Services exportés (utilisés dans tout le site)
const auth      = firebase.auth();
const db        = firebase.firestore();
const storage   = (firebase.storage && typeof firebase.storage === "function") ? firebase.storage() : null;

// ── Firestore Settings ──────────────────────────────────────
db.settings({ experimentalForceLongPolling: false });

// ── Collections References ──────────────────────────────────
const COLLECTIONS = {
  MEMBRES:     "membres",
  ADMINS:      "admins",
  ACTUALITES:  "actualites",
  EVENEMENTS:  "evenements",
  CONTRIBUTIONS: "contributions",
  GALERIE:     "galerie",
  PARTENAIRES: "partenaires",
  NEWSLETTER:  "newsletter",
  CONTACTS:    "contacts",
  CHATS:       "chats"
};

// ── Auth Roles ───────────────────────────────────────────────
const ROLES = {
  ADMIN:   "admin",
  MEMBRE:  "membre"
};

// ── Validation des contributions membres ─────────────────────
const VALIDATION_STATUS = {
  PENDING:  "en_attente",
  APPROVED: "valide",
  REJECTED: "refuse"
};

const VALIDATION_LABELS = {
  en_attente: "En attente",
  valide:     "Validé",
  refuse:     "Refusé"
};

// ── Storage Paths ────────────────────────────────────────────
const STORAGE_PATHS = {
  MEMBRES:        "membres/photos/",
  ACTUALITES:     "actualites/images/",
  EVENEMENTS:     "evenements/images/",
  CONTRIBUTIONS:  "contributions/",
  GALERIE:        "galerie/"
  ,PARTENAIRES:    "partenaires/logos/"
};

// ── Cloudinary (uploads images depuis le navigateur) ───────
const CLOUDINARY = {
  CLOUD_NAME: "ezloqmpj",
  UPLOAD_PRESET: "grec-upload",
  UPLOAD_URL: "https://api.cloudinary.com/v1_1/ezloqmpj/image/upload"
};
console.log("Firebase connecté :", firebase.app().name);

