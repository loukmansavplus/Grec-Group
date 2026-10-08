# GREC GROUP — Site Web Refonte 2025

## Stack Technique
- **HTML5** sémantique
- **Tailwind CSS** (CDN v3)
- **Vanilla JavaScript** (ES6+)
- **Firebase** : Auth · Firestore · Storage · Hosting

---

## Structure du Projet

```
grec-group/
├── index.html               ← Page d'accueil
├── pages/
│   ├── about.html           ← Qui sommes-nous
│   ├── membres.html         ← Annuaire des membres
│   ├── actualites.html      ← Blog / Actualités
│   ├── article.html         ← Détail article
│   ├── galerie.html         ← Galerie photos
│   ├── auth.html            ← Connexion / Inscription
│   └── profil.html          ← Profil membre connecté
├── admin/
│   ├── index.html           ← Dashboard admin
│   ├── membres.html         ← Gérer les membres
│   ├── actualites.html      ← Gérer les articles
│   └── galerie.html         ← Gérer la galerie
├── css/
│   └── style.css            ← Design tokens + styles custom
├── js/
│   ├── firebase-config.js   ← Config Firebase (à remplir)
│   └── utils.js             ← Utilitaires globaux
├── assets/
│   ├── images/              ← Images locales
│   └── icons/               ← SVG icons
├── firestore.rules          ← Règles sécurité DB
├── storage.rules            ← Règles sécurité Storage
└── firebase.json            ← Config hébergement Firebase
```

---

## Configuration Firebase

### 1. Créer le projet Firebase
1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquer **Ajouter un projet** → nommer `grec-group`
3. Désactiver Google Analytics (optionnel)

### 2. Activer les services
- **Authentication** → E-mail/Mot de passe → Activer
- **Firestore** → Créer une base de données → Mode production
- **Storage** → Commencer
- **Hosting** → Commencer

### 3. Récupérer la config SDK
1. Paramètres du projet (⚙️) → Général
2. Faire défiler jusqu'à **Vos applications** → `</>`
3. Enregistrer l'app → copier la config
4. Coller dans `js/firebase-config.js`

### 3.1. Configuration Cloudinary
1. Aller sur https://cloudinary.com/console/settings/upload
2. Créer un preset d'upload non signé
3. Nommer le preset : `grec-upload`
4. Vérifier que le preset est en mode **unsigned**
5. Le preset doit être utilisé dans `js/firebase-config.js`

### 4. Premier admin
Dans Firestore, créer manuellement :
```
Collection: admins
Document ID: [UID de votre compte Firebase Auth]
Champs: { role: "admin", email: "votre@email.com" }
```

---

## Déploiement Firebase Hosting

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Connexion
firebase login

# Initialiser (dans le dossier grec-group/)
firebase init

# Déployer
firebase deploy
```

---

## Collections Firestore

### `membres`
```json
{
  "uid": "string",
  "nom": "string",
  "prenom": "string",
  "email": "string",
  "telephone": "string",
  "pays": "string",
  "secteur": "string",
  "bio": "string",
  "photoURL": "string",
  "entreprise": "string",
  "poste": "string",
  "linkedIn": "string",
  "statut": "actif | en_attente | suspendu",
  "codeEthique": true,
  "createdAt": "timestamp"
}
```

### `actualites`
```json
{
  "titre": "string",
  "slug": "string",
  "contenu": "string",
  "resume": "string",
  "imageURL": "string",
  "auteur": "string",
  "tags": ["string"],
  "publie": true,
  "publishedAt": "timestamp",
  "createdAt": "timestamp"
}
```

### `galerie`
```json
{
  "titre": "string",
  "imageURL": "string",
  "categorie": "evenement | action | membres",
  "date": "timestamp",
  "ordre": "number"
}
```

---

## Migration des membres Firebase Auth vers Firestore

Si certains comptes existent dans Firebase Auth mais pas encore dans `membres`, lance le script de migration :

```bash
npm install
npm run migrate:membres -- --service-account C:\chemin\vers\serviceAccount.json
```

Options utiles :
- `--dry-run` pour simuler sans écrire
- `--upsert` pour mettre à jour aussi les documents déjà présents
- `--skip-disabled` pour ignorer les comptes Auth désactivés

Le script lit `.firebaserc` par défaut, ou tu peux forcer `--project-id grec-group`.
