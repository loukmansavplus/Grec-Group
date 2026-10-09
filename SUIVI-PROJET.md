# GREC Group — Suivi du projet

Document de passation : ce qui est en place, comment reprendre le travail sur un autre poste, et ce qu'il reste à faire.
Dernière mise à jour : 9 octobre 2026.

> **Ce fichier ne contient aucun secret.** Les clés, mots de passe et fichiers JSON de comptes de service ne doivent jamais être ajoutés au dépôt.

---

## 1. En bref

| | |
|---|---|
| **Site en ligne** | https://grec-group.web.app |
| **Dépôt GitHub (à utiliser)** | https://github.com/loukmansavplus/Grec-Group (branche `main`) |
| **Ancien dépôt** | `darkk-kira/grec-site` : plus utilisé |
| **Projet Firebase** | `grec-group` (Auth e-mail/mot de passe, Firestore europe-west1, Hosting) |
| **Images envoyées depuis le site** | Cloudinary, cloud name `onozly6o`, preset non signé `grec-upload` |
| **Déploiement** | Automatique à chaque `git push` sur `main` (GitHub Actions) |
| **Site d'origine repris** | https://grec.group (PHP), dont on reproduit le contenu |

Le site est **statique** (HTML, CSS, JavaScript sans compilation). Seuls Firebase (comptes, données) et Cloudinary (images) sont des services externes.

---

## 2. Reprendre le travail sur un autre PC

### Prérequis
- Git, un navigateur, un éditeur (VS Code).
- Optionnel : Node.js 20+ (pour vérifier la syntaxe des scripts), GitHub CLI `gh`.

### Récupérer le projet
```bash
git clone https://github.com/loukmansavplus/Grec-Group.git
cd Grec-Group
```
Il faut être connecté au compte GitHub `loukmansavplus` (ou avoir été ajouté comme collaborateur du dépôt).

### Tester en local
Aucun build. Servir le dossier avec un petit serveur :
```bash
python -m http.server 8000      # puis ouvrir http://localhost:8000
```
> En local, la connexion Firebase fonctionne parce que `localhost` est autorisé par défaut dans Firebase Auth.

### Publier
```bash
git add <fichiers>
git commit -m "Message clair"
git push origin main
```
Le push déclenche le déploiement (voir §4). Suivre l'avancement : onglet **Actions** du dépôt GitHub (≈ 40 secondes).

### Ne jamais commiter
- Le fichier `API USEFULL` (non suivi, à vérifier : s'il contient des clés, le supprimer ou l'ignorer).
- Toute clé de compte de service (`*.json` de Firebase).
- Les fichiers du dossier `.refact/` (déjà ignoré).

### Outils Firebase en ligne de commande (facultatif)
Inutile pour publier (c'est automatique). Utile pour déployer à la main ou tester les règles :
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes,hosting --project grec-group
```

---

## 3. Architecture

### Arborescence
```
index.html                  Accueil
pages/
  about.html                Qui sommes-nous (équipe dirigeante)
  membres.html              Annuaire / « Notre communauté »
  actualites.html           Articles, événements à venir, newsletter, espace contribution membre
  galerie.html              Galerie photos (collection Firestore « galerie »)
  partenaires.html          Partenaires (collection « partenaires »)
  auth.html / register.html Connexion / inscription
  profil.html               Profil du membre connecté
  profil-public.html        Fiche publique d'un membre
  chat.html                 Messagerie privée entre membres
admin/index.html            Tableau de bord administrateur
css/style.css               Styles communs
js/
  firebase-config.js        Config Firebase + Cloudinary (valeurs publiques)
  utils.js                  Menu, authentification, toasts, échappement HTML, upload Cloudinary
  articles-data.js          Les 7 articles repris de grec.group (secours + source d'import)
  contributions.js          Contributions des membres (articles/événements proposés)
  chat.js                   Messagerie temps réel
Assets/images/              Images du site
firestore.rules             Règles de sécurité Firestore
firestore.indexes.json      Index Firestore
storage.rules               Storage : tout refusé (non utilisé)
firebase.json               Hébergement, en-têtes de sécurité, cache
.github/workflows/firebase-deploy.yml   Déploiement automatique
robots.txt                  Exclut admin, connexion, inscription, chat, profil
```

### Données Firestore
| Collection | Contenu | Qui lit | Qui écrit |
|---|---|---|---|
| `membres/{uid}` | Profil (nom, e-mail, téléphone, secteur, pays…) | **Connectés uniquement** | Le membre (pas `role`/`statut`), l'admin |
| `admins/{uid}` | Un document = un administrateur (`active: true`) | Soi-même ou admin | Admin |
| `actualites` | Articles (`publie`, `publishedAt`, `titre`, `resume`, `contenu`, `imageURL`…) | Public si `publie == true`, sinon admin/auteur | Admin |
| `evenements` | Événements (`date` au format AAAA-MM-JJ, `lieu`, `publie`) | Idem | Admin |
| `contributions` | Propositions des membres, en attente de validation | Auteur et admin | Auteur (création), admin |
| `galerie`, `partenaires` | Photos, logos | Public | Admin |
| `newsletter`, `contacts` | Inscriptions et messages (champs et tailles validés) | Admin | Création publique |
| `chats/{id}` + `messages` | Conversations privées | Les deux participants | Les deux participants |
| `ACTION_LOG` | Journal des actions admin | Admin | Admin |

Les règles sont dans [firestore.rules](firestore.rules). **Un administrateur n'est défini que par l'existence de `admins/{uid}`** : aucune adresse e-mail n'est écrite en dur.

### Articles : fonctionnement
1. Le site lit d'abord la collection `actualites` (articles publiés).
2. **Si elle est vide ou inaccessible**, il affiche les 7 articles de [js/articles-data.js](js/articles-data.js).
3. Dans l'admin, **Actualités → Importer les articles** copie ces 7 articles dans la base (fait le 9 octobre 2026). Ils sont depuis modifiables comme les autres.
4. Les images des articles importés sont enregistrées avec un chemin à la racine (`/Assets/images/...`).

### Photos et Cloudinary
`uploadFile()` dans [js/utils.js](js/utils.js) envoie les images à Cloudinary (preset `grec-upload`, formats jpg/jpeg/png/webp) et enregistre l'URL dans Firestore. Firebase Storage **n'est pas utilisé**.

---

## 4. Déploiement automatique

Fichier : [.github/workflows/firebase-deploy.yml](.github/workflows/firebase-deploy.yml). À chaque push sur `main`, il exécute :
`firebase deploy --only hosting,firestore --project grec-group`
ce qui publie **le site, les règles et les index Firestore**.

- Il utilise le secret GitHub **`FIREBASE_SERVICE_ACCOUNT`** (clé JSON du compte `firebase-adminsdk-fbsvc@grec-group.iam.gserviceaccount.com`).
  Dépôt, Settings, Secrets and variables, Actions.
- Rôles IAM donnés à ce compte : Administrateur Firebase, Administrateur d'index Cloud Datastore, Consommateur Service Usage.
- Si le déploiement échoue sur une autorisation, le message de l'onglet Actions dit quel rôle ajouter (console Google Cloud, IAM).

### ⚠️ Règle essentielle : le cache
Les fichiers CSS et JS sont référencés avec un numéro de version : `style.css?v=3`, `utils.js?v=3`, etc.
**Quand on modifie un fichier CSS ou JS, il faut augmenter ce numéro dans toutes les pages HTML** (rechercher `?v=3` et remplacer), sinon les navigateurs gardent l'ancienne version (jusqu'à 1 heure). Les images, mises en cache 30 jours, doivent changer de nom ou recevoir un `?v=` quand on les remplace.

---

## 5. Administration

### Créer le premier administrateur
Voir [ADMIN-SETUP.md](ADMIN-SETUP.md). En résumé :
1. S'inscrire sur le site (« Devenir membre »).
2. Console Firebase, Authentication, Users : copier l'**UID**.
3. Firestore, collection **`admins`** (avec un **s**), document dont l'ID est l'UID, champs `uid`, `email`, `role = "admin"`, `active = true` (booléen).
4. Se reconnecter : le bouton **Dashboard** apparaît. Adresse : `/admin/`.

### Ce que permet le tableau de bord
Vue d'ensemble, modération des contributions, actualités, événements, galerie, partenaires, membres (activer, rendre public, supprimer), contacts, newsletter, **export CSV** (contacts, newsletter, membres), **liste des administrateurs** avec retrait, journal d'audit.
Si un chargement échoue, un **bandeau rouge** en haut de la page indique la collection et le code d'erreur.

### Limite connue
« Supprimer » un membre efface son profil Firestore **mais pas son compte de connexion** (Firebase Auth). Seul un serveur peut le faire (Cloud Functions, plan Blaze payant), ou une suppression manuelle dans la console, Authentication, Users.

---

## 6. Ce qui a été fait

### Sécurité (audit complet)
- Règles Firestore réécrites : annuaire des membres réservé aux connectés, messagerie limitée aux deux participants, brouillons non lisibles, validation des formulaires publics, impossible de se donner un rôle.
- Plus d'adresse administrateur codée en dur ; Storage verrouillé.
- Échappement HTML de tous les contenus dynamiques ; liens externes sécurisés.
- En-têtes de sécurité (`nosniff`, `X-Frame-Options`, HSTS…), `robots.txt`, `noindex` sur les pages privées.
- Messages d'erreur de connexion à jour (sans révéler si l'e-mail existe).

### Réparations
- Le tableau de bord admin était **inutilisable dans la version reprise** (erreur de syntaxe, fonction `gateAdminAccess` sans en-tête). Réparé.
- Le profil public fonctionne sans connexion pour les membres de l'annuaire (lecture depuis l'adresse), message clair pour les vrais comptes.
- Création d'un administrateur depuis le tableau de bord corrigée.

### Contenu et design
- Fond du hero remplacé, texte plus lisible (voile sombre, ombre).
- Logo du menu sans cadre ni texte ; logo blanc dans le pied de page.
- Photos mises à jour (Boris Djimadja, Jocelyne Duval) ; portraits de l'équipe dirigeante harmonisés (format, fond, taille des visages).
- Des icônes ajoutées (chiffres clés, témoignages, mission/vision, dates).
- Accueil : 4 colonnes d'articles.
- **Page Actualités reconstruite** à partir de https://grec.group/news.php : 7 articles réels (dates, textes complets, images), pagination, détail, événements à venir, newsletter. Les exemples fictifs ont été supprimés.

### Infrastructure
- Nouveau projet Firebase `grec-group`, nouveau Cloudinary, nouveau dépôt GitHub.
- Déploiement automatique (GitHub Actions).
- Fichiers CSS/JS versionnés contre le cache.

---

## 7. Ce qu'il reste à faire

### A. À tester (aucun test navigateur n'a été fait par l'assistant)
- [ ] Accueil et page Actualités : articles, photos, pagination, fenêtre de détail.
- [ ] Événement de test avec une date future : apparaît sur la page Actualités.
- [ ] Galerie : ajout d'une photo puis affichage sur la page Galerie. Idem partenaire.
- [ ] Un **second compte membre** : inscription, connexion, modification du profil avec photo.
- [ ] Contribution d'un membre, puis validation dans l'admin (Modération).
- [ ] Messagerie entre deux comptes.
- [ ] Formulaires de contact et de newsletter (les messages arrivent dans l'admin).

### B. Contenu à confirmer avec le client
- [ ] **Adresses e-mail de contact** : le site affiche `contact@grec.com` et `p.axelle@grec.group` (deux domaines). Quelle est la bonne ?
- [ ] **Date de l'article « Romain Da Costa… Saype »** : 6 février 2021 sur l'ancien site, mais le texte parle de mars.
- [ ] Vérifier les autres pages (membres, galerie, partenaires, « Qui sommes-nous ») : exemples fictifs ou vrai contenu ?
- [ ] Photos trop petites à remplacer : Brice Zohoun (225 px), Jocelyne Duval (188 px), logo blanc (130 px).
- [ ] Les membres de l'ancien site (grec.group) doivent se réinscrire : leurs comptes ne sont pas repris.

### C. Sécurité
- [ ] **Supprimer le fichier JSON de clé du compte de service** de tout ordinateur, et contrôler `API USEFULL`.
- [ ] Vérification d'e-mail à l'inscription (`sendEmailVerification`).
- [ ] Restreindre la clé API Firebase au domaine du site (console Google Cloud, Identifiants).
- [ ] Tester les règles Firestore cas par cas avec l'émulateur Firebase.
- [ ] Décider de l'annuaire : aujourd'hui les vrais profils sont réservés aux connectés. Pour les montrer aux visiteurs, séparer les données publiques (nom, photo, secteur) des privées (e-mail, téléphone).
- [ ] Éventuellement : App Check, limitation des envois de formulaires.

### D. Qualité et performance
- [ ] Remplacer le CDN Tailwind (`cdn.tailwindcss.com`) par un CSS compilé (plus rapide, sans clignotement).
- [ ] Optimiser les images (WebP, tailles adaptées) ; `hero-equipe.jpg` pèse ≈ 400 Ko.
- [ ] `sitemap.xml`, balises de partage (Open Graph) et `canonical` sur les autres pages.
- [ ] Nettoyer le dépôt (`.agents/`, `.claude/` et `vercel.json` retirés le 9 octobre 2026).
- [ ] Supprimer les doublons de fonctions entre `js/utils.js` et `js/contributions.js` (`formatDateFR`, `getMemberDisplayName`, `normalizeValidationStatus`, `getValidationLabel`).
- [ ] Accessibilité : certains boutons `onclick` ne sont pas utilisables au clavier.
- [ ] Éventuellement d'autres icônes (« Qui sommes-nous », annuaire, galerie, menu).

### E. Livraison au client
- [ ] Utiliser une **adresse e-mail dédiée au projet** pour Firebase, Cloudinary et GitHub.
- [ ] Transférer la propriété : projet Firebase, compte Cloudinary (le *cloud name* ne doit pas changer, sinon les images enregistrées cassent), dépôt GitHub.
- [ ] Ajouter le domaine du client dans Firebase Auth, Settings, **Authorized domains**.
- [ ] S'il veut héberger sur son propre serveur : recopier les en-têtes de `firebase.json` dans un `.htaccess` (le déploiement automatique ne s'appliquera plus à cet hébergement).
- [ ] Mettre à jour ce document et le README avec les accès définitifs.

---

## 8. Pièges connus (à lire avant de modifier)
1. **Cache** : toujours incrémenter `?v=` quand on change du CSS/JS (§4).
2. **Règles Firestore** : toute lecture publique doit respecter les règles. Les requêtes publiques sur `actualites` et `evenements` doivent filtrer `publie == true` (sinon refusées) et utilisent des index déjà déclarés.
3. **Annuaire fermé** : `membres` n'est lisible que connecté ; une page publique ne peut pas lire cette collection.
4. **Nom de collection** : `admins` avec un **s**.
5. **Chemin des images enregistrées dans Firestore** : à la racine (`/Assets/images/...`), pour fonctionner depuis `index.html`, `pages/` et `admin/`.
6. **Scripts en ligne** : avant de publier, vérifier la syntaxe (une erreur dans un `<script>` casse toute la page, c'est arrivé sur l'admin).
7. **Fins de ligne** : les avertissements « LF will be replaced by CRLF » de Git sous Windows sont normaux.

---

## 9. Commandes utiles
```bash
git status                                  # fichiers modifiés
git log --oneline -10                       # derniers commits
gh run list --repo loukmansavplus/Grec-Group --limit 3     # état des déploiements
gh run view <id> --log                      # détail d'un déploiement
node --check js/utils.js                    # vérifier la syntaxe d'un fichier JS
```
