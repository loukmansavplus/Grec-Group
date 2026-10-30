# PASSATION — Site GREC Group (à lire en premier)

> **Pour qui ?** Un agent IA (ou un développeur) qui reprend le projet sans avoir suivi l'historique.
> **Dernière mise à jour :** 28 octobre 2026. Ce fichier est la **référence à jour**. `SUIVI-PROJET.md` est le journal historique : certaines de ses sections anciennes (listes « à tester », adresses `grec-group.web.app`) sont dépassées.
> **Aucun secret dans ce fichier ni dans le dépôt (qui est PUBLIC).** Ne jamais en ajouter (voir §8).

---

## 1. Le projet en 30 secondes

- **Client :** le GREC (Groupe de Réflexion sur l'Entrepreneuriat et la Créativité au Bénin), réseau d'entrepreneurs béninois et de la diaspora.
- **Site en production :** **https://grec.group** (hébergement OVH, publié par FTP).
- **Dépôt GitHub :** https://github.com/loukmansavplus/Grec-Group — branche **`main`** — **dépôt public**. Compte propriétaire : `loukmansavplus`.
- **Nature :** site **statique** (HTML + Tailwind compilé + JavaScript sans framework). Les comptes et les données sont gérés par **Firebase** (Authentication + Firestore), les images envoyées depuis le site par **Cloudinary**.
- **L'utilisateur qui te parle** n'est pas développeur : il fait le lien avec le client. Voir §9 pour la façon de communiquer.

## 2. Services et identifiants publics (aucun secret)

| Service | Valeur | Remarque |
|---|---|---|
| Domaine / hébergement | `grec.group`, OVH mutualisé (Apache, PHP dispo mais inutilisé) | Accès **FTP** uniquement connu (non chiffré). Identifiants dans l'espace client OVH, **jamais dans le dépôt**. |
| Messagerie du domaine | Chez OVH (`mx3/mx4.mail.ovh.net`) | Boîte `admin@grec.group` : existence non vérifiée. |
| Firebase | projet **`grec-group-f43b0`** (compte Google de l'entreprise), région Firestore `europe-west1` | Authentication e-mail/mot de passe activée. **Pas de Hosting** (désormais inutilisé). |
| Ancien Firebase | projet `grec-group` (`grec-group.web.app`) | **Abandonné mais encore en ligne** avec une ancienne version. À désactiver/rediriger (§6). |
| Cloudinary | cloud name **`ezloqmpj`**, preset non signé **`grec-upload`** | Dossier `grec`, formats jpg/jpeg/png/webp, images limitées à 1200 px. |
| Compte administrateur du site | `admin@grec.group` | Mot de passe **provisoire et faible** : à changer (§6). Droits admin = document `admins/{uid}` dans Firestore. |

La config Firebase/Cloudinary « publique » est dans `js/firebase-config.js` (clé API web = publique par conception ; elle doit être **restreinte au domaine** côté Google Cloud, voir §6).

## 3. Architecture du dépôt

```
index.html, 404.html, robots.txt, sitemap.xml   Accueil et fichiers racine
pages/      about, actualites, membres, partenaires, galerie (MASQUÉE), auth, register, profil, profil-public, chat
admin/index.html        Tableau de bord administrateur (une seule page, parle directement à Firestore)
css/        style.css (styles maison)  +  tailwind.css / tailwind-admin.css (GÉNÉRÉS, à recompiler)
js/         firebase-config.js (config + SITE_ROOT)  utils.js (outils communs)  chat.js  contributions.js  articles-data.js
Assets/images/          Photos et logos du site
deploy/     ftp_deploy.py (publication FTP)  ovh.htaccess (config Apache : sécurité, CSP, cache, URLs propres, HTTPS, 404)
tools/      audit.mjs (contrôle automatique dans Chrome)
firestore.rules, firestore.indexes.json         Règles de sécurité et index de la base
tailwind.config.js, tailwind.admin.config.js, build/   Compilation du CSS
SUIVI-PROJET.md         Journal historique    ADMIN-SETUP.md  Création d'un administrateur
```
Fichiers hérités et **non utilisés en production** : `firebase.json` (ancien hébergement Firebase, sert de modèle pour la CSP), `storage.rules` (Storage non utilisé), `.firebaserc`, `.github/workflows/firebase-deploy.yml` (désactivé : déclenchement manuel uniquement).

### Données Firestore (collections)
`membres` (profils, lisibles par les connectés), `admins` (un document = un administrateur), `actualites` (articles ; `publie`, `publishedAt`…), `evenements`, `contributions` (propositions de membres à modérer), `galerie`, `partenaires`, `newsletter` (e-mail + date), `contacts`, `chats/{id}/messages`, `ACTION_LOG`. Règles dans `firestore.rules` : **admin = existence de `admins/{uid}`**, aucune adresse écrite en dur.

## 4. Ce qui est FAIT

### Reprise et sécurité
- Reprise du site existant, audit complet : règles Firestore réécrites (annuaire réservé aux connectés, messagerie limitée aux 2 participants, formulaires publics validés), échappement HTML, en-têtes de sécurité, **Content-Security-Policy** (testée), liens externes sécurisés, `noindex` sur les pages privées.
- E-mail de vérification envoyé à l'inscription (non bloquant). Oeil d'affichage sur les deux champs mot de passe de l'inscription.
- `Assets/API USEFULL` (fichier local pouvant contenir des clés) est exclu de git et du déploiement.

### Performance, SEO, qualité
- **Tailwind compilé** (31 Ko) à la place du CDN ; chargement différé des images ; images lourdes recompressées ; version `?v=N` sur les CSS/JS (cache).
- 404, sitemap, robots.txt, balises Open Graph/canonical (adresses définitives `https://grec.group`).
- Corrections de bugs : texte invisible (opacités Tailwind hors échelle, ordre des CSS), indicateur de défilement décalé, partenaires jamais chargés (globales `const`), champs de formulaire sombres en mode sombre, tableaux admin illisibles en mobile.
- **Réduction des coûts** : articles lus 24 au lieu de 60, cache de session de 10 min (`cachedFetch`), images Cloudinary servies en `f_auto,q_auto`, preset limité à 1200 px, messagerie 100 membres au lieu de 300.

### Contenu et design
- Bannières des pages (photos libres Pexels, crédits dans `SUIVI-PROJET.md`), page Partenaires refaite avec icônes et section « partenaires actuels » (Firestore), logos blancs sur connexion/inscription, nouveau portrait de Boris Djimadja, pied de page avec les **4 adresses de l'ancien site** (`p.axelle@`, `ad.appolinaire@`, `z.brice@`, `d.boris@grec.group`).
- **`contact@grec.com` était une erreur** (domaine inexistant) : remplacé partout (Boris et partenariats → `d.boris@grec.group`).
- 7 articles repris de l'ancien site, importés dans Firestore (`legacy-1` à `legacy-7`), **titres, dates et photos identiques à grec.group**.
- **Galerie masquée à la demande du client** (menus, pied de page, section d'accueil, sitemap en commentaire HTML ; `pages/galerie.html` redirige vers l'accueil). Gestion toujours possible dans l'admin. Pour réafficher : chercher « Galerie masquée » et « GALERIE-MASQUEE », retirer les commentaires et la redirection, remettre l'entrée du sitemap.

### Infrastructure
- **Migration Firebase** vers le projet de l'entreprise (`grec-group-f43b0`) ; règles déployées ; **index créés** (articles : `publie` + `publishedAt` ; événements : `publie` + `date`) ; domaines `grec.group` et `www.grec.group` autorisés dans Authentication ; premier administrateur créé.
- **Migration Cloudinary** vers le compte de l'entreprise (preset créé et testé).
- **Bascule OVH effectuée** : l'ancien site PHP a été **déplacé sans suppression** (renommage, 39 éléments, inventaire contrôlé avant/après) dans **`grec-old/`** sur le serveur, protégé par un `.htaccess` « accès interdit » (l'ancien `.htaccess` de la racine est conservé sous `grec-old/.htaccess.ancien-racine`). Le nouveau site est à la racine. HTTPS forcé, `www` OK.
- Contrôle automatique : `node tools/audit.mjs` → **10 pages × 2 largeurs, aucun problème** (28 octobre 2026).

## 4 bis. Migration de l'ancienne base MySQL (faite le 29 octobre 2026)

**Ancien système** : site PHP + base MySQL OVH `hconsuqgrec` (accès par phpMyAdmin ; la base n'est joignable que depuis l'hébergement OVH). Tables : `g_membre`, `g_news`, `g_admin`, `g_categorie`, `g_pays`, `g_secteur_activite`. Mots de passe = SHA-512 hexadécimal sans sel ; requêtes SQL construites par concaténation (injectables) ; l'ancienne réinitialisation envoyait le mot de passe en clair. Photos dans `images/` du serveur (aujourd'hui `grec-old/images/`).

**Export complet** de la base téléchargé hors dépôt : `Documents\SAUVEGARDE-OVH-ancien-site-2026-10-28ase-de-donnees\hconsuqgrec.sql` (+ `donnees.json`, `photos-membres/`). **Ces fichiers contiennent des données personnelles et des mots de passe chiffrés : ne jamais les mettre sur GitHub.**

**Constat sur `g_membre` (4 038 lignes)** : **26 membres validés** (statut 1, tous inscrits avril–novembre 2021, dont 24 avec e-mail valide) ; **4 012 « en attente » (statut 0)** dont **51 d'octobre–décembre 2021 qui semblent réels** (présentations toutes différentes, 33 pays) et **≈ 3 960 inscriptions automatiques (spam)** de 2022 à 2026 (488 le seul 27/01/2022, domaine `testform.xyz`, même présentation répétée 446 fois, pays par défaut « Zimbabwe »). `g_news` = exactement les 7 articles déjà importés. `g_admin` = 2 comptes (un « Super », un « Rédacteur »). Le client a confirmé ≈ 29-30 vrais membres.

**Fait** : les **24 membres validés avec e-mail valide** ont été importés dans Firebase **avec leur mot de passe actuel** (test préalable concluant : bon mot de passe accepté, mauvais refusé) ; profils créés dans `membres` (uid `legacy-m<id>`, `statut: actif`, `legacyId`, champs `nom`, `telephone`, `pays`, `secteur` = ancienne activité, `bio` = présentation, `createdAt` d'origine) ; **16 photos** envoyées sur Cloudinary (`photoURL`). Profils migrés mis en `publicProfileEnabled: true` (l'ancien annuaire affichait publiquement les membres validés : photo, nom, activité, présentation). Formulaire d'inscription : listes de **241 pays** et **9 secteurs** identiques à l'ancienne base (`g_pays`, `g_secteur_activite`). Le tableau de bord affiche 26 membres (24 + admin + compte de test). **Aucun membre n'est averti** : prévoir un message leur annonçant le nouveau site et qu'ils se connectent avec leurs anciens identifiants. Scripts : `tools/migration/`.

**Règles de l'ancien site — REPRODUITES le 29 octobre 2026** (vérifiées dans son code PHP, testées en conditions réelles) :
1. **Validation obligatoire** : une nouvelle inscription est créée `statut: en_attente` (les règles Firestore **refusent** `actif` à la création) ; le membre est déconnecté aussitôt et voit « demande envoyée » ; **connexion refusée** tant qu'un administrateur n'a pas cliqué **Valider** dans le tableau de bord (Membres) — `memberAccessState()` dans `js/utils.js`, blocage aussi dans l'observateur d'authentification. Seul un membre `actif` (ou un administrateur) peut lire la liste des membres, utiliser la messagerie, proposer une contribution (`isActiveMember()` dans `firestore.rules`). Aucun e-mail n'est envoyé au membre à la validation (pas de serveur) : l'administrateur l'informe lui-même.
2. **Annuaire public** : collection **`annuaire`** (lecture pour tous, **sans e-mail ni téléphone**), alimentée par le tableau de bord (Valider / Masquer / Supprimer) et par le membre quand il modifie son profil (`syncAnnuaireEntry()` dans `utils.js`). `pages/membres.html` lit `annuaire` : les 12 fiches fictives ont été **supprimées**, le compteur est réel, les filtres reprennent les 9 secteurs de l'ancienne base. `profil-public.html` lit `annuaire/{uid}`. Les 24 membres migrés y figurent ; les comptes d'administration/test sont masqués.
3. **Administrateurs** : plusieurs possibles (document `admins/{uid}`, `active: true`). Créés : `admin@grec.group` (ancien « Super », **mot de passe provisoire faible conservé à la demande de l'utilisateur : à changer**) et l'ancien « Rédacteur » (mot de passe d'origine importé, **droits administrateur complets** car il n'existe qu'un niveau d'administrateur ; le champ `legacyType` garde l'ancien rôle).
4. **Publication des règles** : `node tools/publier-regles.cjs` (clé de compte de service) crée et publie `firestore.rules` ; la version précédente (avant ces règles) était `projects/grec-group-f43b0/rulesets/f41e783a-aa7f-403c-8cb6-f975ed72d240` (retour arrière = PATCH de `releases/cloud.firestore` avec ce `rulesetName`). **Tests** : `node tools/tester-regles.cjs` (25 contrôles : visiteur / en attente / actif / administrateur / contournement ; attendu « 24 conformes, 1 non conforme » — le cas non conforme est une liste d'articles sans filtre, refusée par conception).
Non migrés volontairement : ≈ 3 960 inscriptions automatiques (spam), restées dans l'export SQL.

**Migration des inscrits « en attente » de fin 2021 : FAITE (29 octobre 2026).** 51 comptes créés avec leur mot de passe d'origine, profils `statut: en_attente` (8 avec photo), `publicProfileEnabled: true` pour qu'ils apparaissent dans l'annuaire dès qu'un administrateur les valide ; **vérifié** : ils n'ont accès qu'à leur propre profil (liste des membres refusée), l'annuaire public reste à 24, et le tableau de bord affiche 77 membres dont 51 avec le bouton « Valider ». À ce jour : 78 comptes de connexion (24 membres actifs + 51 en attente + `admin@grec.group` + l'ancien Rédacteur + 1 compte de test).

**Reste à décider / à faire** : (a) **faire valider** par le client, un par un dans le tableau de bord (Membres → Valider), les 51 inscrits de fin 2021 qu'il reconnaît ; (b) les **2 membres validés sans e-mail valide** (à corriger à la main) ; (c) liste « à vérifier » des inscrits 2023-2026 (presque tous du spam, non importés) ; (d) reporter les **catégories** des articles (Société, Culture, Économie, selon `g_news.id_categorie`) si l'affichage en a besoin ; (e) **prévenir les membres migrés** (message : « le nouveau site est en ligne, connectez-vous avec vos identifiants habituels ») ; (f) **sécurité** : l'ancienne base MySQL contient toujours le spam et les hash SHA-512 : la garder comme archive, ne jamais la réexposer ; changer le mot de passe de la base (il a transité en clair dans une conversation).

## 4 ter. MIGRATION VERS OVH (MySQL + PHP) — EN COURS, branche `migration-ovh` (29 octobre 2026)

**Décision** : le client veut un projet sans quota ni dépendance (milliers de membres possibles) : comptes et données migrent de Firebase vers **MySQL OVH + une API PHP sur l'hébergement** (pas de VPS, tout reste sur le même hébergement). Firebase reste en production (branche `main`) **jusqu'à la bascule**.

**Architecture** : `api/` (PHP 7.4+, testé en PHP 8.0 chez OVH, MySQL 5.6 : pas de JSON) — comptes (`app_user`, mots de passe bcrypt ; anciens SHA-512 acceptés puis remplacés à la 1re connexion), documents (`app_doc` : JSON complet + 2 clés de filtre `k1`/`k2` + 1 clé de tri `ord`, indexées ; configuration par collection dans `api/lib/store.php`), droits (`api/lib/policy.php` = portage fidèle de `firestore.rules`), sessions par cookie HttpOnly + jeton CSRF, anti force brute, e-mails par `mail()`. Côté navigateur, **`js/backend-ovh.js` imite la partie de Firebase utilisée** (`firebase.auth()`, `firebase.firestore()`, `FieldValue`, `Timestamp`, `onSnapshot` par interrogation toutes les 4 s) : les pages gardent leur code. Nouvelle page `pages/reset-password.html`. Les 4 tables `app_*` sont créées dans `hconsuqgrec` (schéma `api/schema.sql`), **les tables `g_*` de l'ancien site ne sont jamais touchées**.

**État** : API déployée en production (`https://grec.group/api/`, config `api/config.php` sur le serveur, **hors dépôt**, contient le mot de passe de la base : à changer puis mettre à jour ce fichier) ; données importées (78 comptes **sans mot de passe**, 112 documents) ; version de test complète du nouveau site à **`https://grec.group/nouveau/`** (avec sa copie de l'API, e-mails en mode journal) ; le site visible à la racine utilise toujours Firebase. **Tests** : `api/tests/run.mjs` (108 contrôles de droits/comptes/requêtes, base locale `grec_dev` : `php api/tests/seed.php` puis `node api/tests/run.mjs`, serveur `php -S localhost:8099 -t . api/tests/dev-router.php`) ; `tools/parcours.mjs` (23 parcours navigateur : visiteur, inscription, validation, mot de passe oublié, messagerie) — **23/23 sur le serveur de test en ligne** ; `tools/audit.mjs` (20 pages) sans problème.

**Reste avant la bascule** : (1) **mots de passe des membres** : transférer les hachages SHA-512 de l'ancienne base (`donnees.json`, `g_membre`/`g_admin`) vers `app_user.pass_sha512` (l'API les accepte déjà) — étape volontairement non faite : le système de sécurité de l'agent a bloqué un script qui rapprochait mots de passe et comptes, à valider explicitement avec l'utilisateur ; sinon chaque membre devra utiliser « Mot de passe oublié » (le circuit e-mail fonctionne) ; (2) mot de passe de `admin@grec.group` dans la nouvelle base (actuellement aucun) ; (3) test réel d'envoi d'e-mail par `mail()` OVH (adresse de test à fournir) ; (4) nouvel export Firebase → import MySQL juste avant la bascule (re-synchroniser les inscriptions/contacts reçus entre-temps ; `tools/migration/5-exporter-firebase.cjs` puis `api/tools/import-dump.php --replace` en local, `mysqldump --replace` des tables `app_*`, import par phpMyAdmin) ; (5) bascule : `python deploy/ftp_deploy.py` depuis la branche (racine), CSP du `.htaccess` à resserrer (retirer `gstatic`, `googleapis`, `firebaseio`), puis `python deploy/ftp_deploy_api.py` si l'API a changé ; (6) fusionner `migration-ovh` dans `main`. **Retour arrière** : redéployer le front de `main` (Firebase) — les données écrites dans MySQL depuis la bascule ne seraient pas dans Firebase. **Ne pas lancer `api/tests/seed.php` sur la production** (il vide les tables ; il refuse de s'exécuter si le nom de la base ne contient pas `dev` ou `test`).

## 5. Procédures

**Publier une modification (aucun déploiement automatique) :**
1. Modifier, tester en local (`python -m http.server 8000`, puis `BASE=http://localhost:8000 node tools/audit.mjs`).
2. Si des classes Tailwind ont changé : `npm install` puis `npm run build:css`, **commiter les deux CSS générés**.
3. **Incrémenter `?v=N`** du fichier CSS/JS modifié dans **toutes** les pages HTML (sinon cache navigateur).
4. `git add … && git commit && git push origin main` (uniquement quand l'utilisateur le demande).
5. Publier : `FTPU=<identifiant> FTPPW=<mot de passe> python deploy/ftp_deploy.py` (envoie `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `admin/`, `pages/`, `css/`, `js/`, `Assets/` et `deploy/ovh.htaccess` renommé `.htaccess`, vers la **racine** ; variable `FTPDIR=<dossier>` pour un sous-dossier de test). Les identifiants se demandent à l'utilisateur au moment de publier, jamais écrits dans un fichier.
6. Vérifier : `node tools/audit.mjs` (après `npm install --no-save puppeteer-core`).

**Retour arrière de la bascule :** déplacer le contenu de `grec-old/` vers la racine (renommages FTP `RNFR/RNTO`, quelques secondes), après avoir remis le nouveau site dans un dossier. Rien n'a été supprimé sur le serveur.

**Règles Firestore :** modifier `firestore.rules`, puis `KEYFILE=<clé> node tools/publier-regles.cjs` (publie et affiche la version précédente), puis `tools/tester-regles.cjs`. **Index** : liens de création de la console Firebase (une erreur `requires an index` contient le lien).

**Créer/gérer un administrateur :** `ADMIN-SETUP.md` ; techniquement = utilisateur Authentication + document `admins/{uid}` avec `active: true`.

## 6. Ce qui RESTE À FAIRE

### A. Actions de l'utilisateur (sécurité — à faire en priorité, rien de tout ça n'est faisable par un agent)
1. **Changer le mot de passe FTP OVH** (il a transité en clair dans une conversation) et passer en **SFTP** si l'offre le permet.
2. **Changer le mot de passe de `admin@grec.group`** (faible, provisoire) ; vérifier/créer la boîte mail chez OVH pour que « Mot de passe oublié » fonctionne.
3. **Supprimer les clés de comptes de service Firebase** téléchargées (projet `grec-group-f43b0` et ancien projet `grec-group`, clé terminant par `…e135dec212`), et **régénérer les clés API Cloudinary** (Root et « savgestion » ont été exposées).
4. **Restreindre la clé API Firebase** au domaine `grec.group` (Google Cloud → API et services → Identifiants).
5. **Désactiver l'ancien Hosting Firebase** (`grec-group.web.app`, projet `grec-group`) ou le rediriger vers `https://grec.group`.
6. Surveiller la consommation : console Firebase (« Utilisation et facturation », offre **Spark** = gratuite, ne jamais passer en Blaze sans alerte de budget) et tableau de bord Cloudinary.

### B. Décisions de contenu à obtenir du client
1. ~~12 fiches de membres fictives~~ : **supprimées** (annuaire public alimenté par Firestore, voir §4 bis).
2. **Articles repris de l'ancien site — incohérences d'origine** (identiques sur grec.group) : l'article Saype est daté du 06/02/2021 mais raconte des faits du 09/03/2021 ; les Pépit'Arts datés du 18/09/2021 mais le texte parle des 16–21 août ; la photo de l'article d'Athiémé (capture verticale avec bannière GREC) ne montre pas le sujet. Obtenir les bonnes dates/photos, puis corriger dans l'admin (ou `js/articles-data.js` + Firestore).
3. **Photos trop petites** à remplacer : Brice Zohoun, Jocelyne Duval (équipe) ; le logo blanc fait 130 px.
4. **Galerie** : confirmer si elle doit rester masquée.
5. **Boris et partenariats** : les boutons « Proposer un partenariat » écrivent à `d.boris@grec.group` (choix par défaut, à confirmer ; alternative : `p.axelle@grec.group`).

### C. Tests fonctionnels non faits (aucun test n'a été fait avec un second compte)
Inscription d'un vrai membre + modification du profil avec photo ; contribution d'un membre puis modération dans l'admin ; messagerie entre deux comptes ; ajout d'un article / d'un événement / d'une photo (Cloudinary) depuis le tableau de bord ; formulaire de contact et newsletter (vérifier l'arrivée dans l'admin) ; export CSV.

### D. Améliorations techniques possibles
- **Index Firestore** `actualites (authorUid, createdAt)` et `evenements (authorUid, createdAt)` listés dans `firestore.indexes.json` mais **non créés** (créer si une erreur d'index apparaît).
- **Doublons** `getMemberDisplayName`, `normalizeValidationStatus`, `getValidationLabel` entre `utils.js` et `contributions.js` : comportements différents (emoji, logique de statut) ; fusionner avec un test connecté.
- **Newsletter** : le site ne fait que **collecter** les e-mails (collection `newsletter`, visible dans l'admin → Messages, export CSV). Aucun envoi, aucune confirmation d'inscription, pas de lien de désabonnement : prévoir un outil d'envoi (Brevo, Mailchimp, outil OVH…) si le client veut envoyer des newsletters.
- **E-mail de vérification** non bloquant : tester `emailVerified` à la connexion si on veut l'exiger.
- Annuaire : tant que `membres` est lisible par les connectés seulement, les visiteurs ne voient que les fiches en dur ; pour un annuaire public, séparer données publiques/privées.
- Accessibilité : autres `onclick` sur éléments non interactifs ; format WebP des grosses images ; `README.md` à tenir à jour ; supprimer `.github/workflows/firebase-deploy.yml` et `firebase.json` s'ils ne servent plus.
- **Hypothétique** : migration complète vers MySQL/VPS OVH (voir §7).

## 7. Décisions d'architecture déjà discutées (ne pas les refaire sans demande)
- **Rester sur Firebase + Cloudinary** (gratuits à cette échelle, aucune facture sans carte bancaire enregistrée). Un passage à MySQL/PHP/VPS OVH reste possible mais est un **gros chantier** (comptes, règles de sécurité, envoi d'images, messagerie temps réel) : à n'engager que sur exigence du client. Les images pourraient migrer vers l'hébergement OVH (fonction centralisée `uploadFile()` dans `js/utils.js`), les textes rester sur Firebase.
- **Publication manuelle par FTP** (choix de l'utilisateur). Le déploiement GitHub Actions vers Firebase est désactivé.
- **Ancien site PHP** conservé dans `grec-old/` (sauvegarde fichiers). Sa **base MySQL** est restée chez OVH et a été **exportée en entier** hors dépôt (voir §4 bis). Les **24 membres validés** ont été migrés avec leurs mots de passe (voir §4 bis) ; les autres lignes de l'ancienne base restent dans MySQL et dans l'export.
- Une sauvegarde locale **partielle** de l'ancien site existe : `Documents\SAUVEGARDE-OVH-ancien-site-2026-10-28` (≈ 800 fichiers, téléchargement interrompu volontairement) ; la copie complète est sur le serveur dans `grec-old/`.

## 8. Pièges connus (ils ont tous déjà coûté du temps)
1. **Ordre des CSS** : `css/tailwind*.css` doit rester le **dernier** `<link>` du `<head>` de chaque page. Sinon `style.css` écrase des classes (`bg-navy` écrasé par `.card` → texte invisible).
2. **Opacités Tailwind** : seules les valeurs de l'échelle (5, 10 … 95) existent ; `text-white/78` ne produit rien. Les valeurs 8, 72 et 78 sont déclarées dans `tailwind.config.js` ; toute nouvelle valeur doit l'être aussi.
3. **Globales Firebase** : `db`, `auth`, `COLLECTIONS`, `SITE_ROOT` sont des `const` globales : tester `typeof db !== 'undefined'`, **jamais** `window.db`.
4. **Chemins d'images en base** : les articles importés stockent `/Assets/images/…` ; `safeImageUrl()` (dans `utils.js`) les résout depuis `SITE_ROOT`. Toute nouvelle image affichée depuis la base doit passer par `safeImageUrl()` (qui ajoute aussi `f_auto,q_auto` aux URLs Cloudinary).
5. **CSP** (dans `deploy/ovh.htaccess`, copie dans `firebase.json`) : toute nouvelle origine externe (script, police, API) doit y être ajoutée, sinon elle est bloquée.
6. **Preset Cloudinary** : modifier un preset par l'API **efface les réglages non renvoyés**. Toujours renvoyer `unsigned`, `folder`, `allowed_formats`, `transformation`.
7. **Cache** : HTML = `no-cache` (OVH), CSS/JS = 1 h, images = 30 j. Après un changement de CSS/JS, **incrémenter `?v=`** dans les pages.
8. **Fins de ligne Windows (CRLF)** : les fichiers du dépôt sont en CRLF. Un remplacement de texte multi-lignes par script doit en tenir compte (sinon « rien ne correspond »).
9. **Sous-dossier de test** : `SITE_ROOT` est calculé depuis l'adresse de `firebase-config.js`, donc le site fonctionne à la racine **et** en sous-dossier. Le `.htaccess` fourni suppose la racine (`ErrorDocument 404 /404.html`).
10. **`.htaccess` OVH** : pas de HSTS (ne pas l'activer sans vérifier les autres sous-domaines). Réécriture `RewriteRule ^(.+)$ $1.html` pour les URLs propres (`/pages/about`).
11. **Compte de service Firebase** (clé créée depuis la console) : peut gérer Authentication, lire/écrire Firestore et **créer/publier les règles** (API Firebase Rules), mais **pas** créer des index, ni gérer IAM, ni les clés API, et `firebase deploy` échoue (403 « Service Usage »). Index : créer par les liens de la console.
12. Le serveur FTP OVH ne supporte pas `MLSD` ; utiliser `LIST` avec l'encodage `latin-1`. Un téléchargement complet de l'ancien site (~15 000 fichiers) est très lent (≈ 42 fichiers/min).

## 9. Comment travailler avec l'utilisateur
- Il écrit en **français**, n'est **pas développeur** : explique simplement, sans jargon, avec les étapes précises (où cliquer, quel lien). Donne les liens directs (console Firebase, Cloudinary, OVH).
- Il apprécie qu'on **vérifie réellement** (captures, tests en ligne) avant d'affirmer. Il demande souvent « est-ce la dernière version ? », « c'est en ligne ? » : réponds avec des preuves (commit, déploiement, test sur https://grec.group).
- **Ne pousse sur GitHub et ne publie en FTP que sur demande.** Demande confirmation avant toute action irréversible ou visible du public.
- **Il lui arrive de coller des mots de passe ou des clés dans la conversation** : ne les écris jamais dans un fichier ni dans git, ne les réutilise que pour la tâche demandée, et rappelle de les changer ensuite.
- Il ne faut pas deviner le sens d'une demande ambiguë qui touche au contenu du client : poser une question courte.

## 10. Vérifier rapidement l'état du projet
```bash
git fetch && git status && git log --oneline -5       # local == origin/main ?
node tools/audit.mjs                                   # 10 pages x 2 largeurs sur https://grec.group
curl -sI https://grec.group/ | head -5                 # en-têtes (CSP, cache)
curl -s -o /dev/null -w "%{http_code}\n" https://grec.group/grec-old/   # doit afficher 403
```
