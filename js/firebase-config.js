// ============================================================
//  GREC GROUP — Firebase Configuration
//  Remplacez les valeurs ci-dessous par celles de votre
//  projet Firebase (Console > Paramètres > Config SDK)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBYE6ODV8x_0SNbhXZxgR6Wz2EIVQftaTc",
  authDomain: "savplus-school.firebaseapp.com",
  projectId: "savplus-school",
  storageBucket: "savplus-school.firebasestorage.app",
  messagingSenderId: "952771003789",
  appId: "1:952771003789:web:35026a68be664fe84429c4"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);

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
  CLOUD_NAME: "dk5lhxtoh",
  UPLOAD_PRESET: "grec-upload",
  UPLOAD_URL: "https://api.cloudinary.com/v1_1/dk5lhxtoh/image/upload"
};
console.log("Firebase connecté :", firebase.app().name);

