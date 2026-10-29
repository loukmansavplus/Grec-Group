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

**Fait** : les **24 membres validés avec e-mail valide** ont été importés dans Firebase **avec leur mot de passe actuel** (test préalable concluant : bon mot de passe accepté, mauvais refusé) ; profils créés dans `membres` (uid `legacy-m<id>`, `statut: actif`, `legacyId`, champs `nom`, `telephone`, `pays`, `secteur` = ancienne activité, `bio` = présentation, `createdAt` d'origine) ; **16 photos** envoyées sur Cloudinary (`photoURL`). Profils importés en `publicProfileEnabled: false` (choix prudent, modifiable). Le tableau de bord affiche 26 membres (24 + admin + compte de test). **Aucun membre n'est averti** : prévoir un message leur annonçant le nouveau site et qu'ils se connectent avec leurs anciens identifiants. Scripts : `tools/migration/`.

**Reste à décider avec le client** : (a) importer ou non les **51 inscrits « en attente » de fin 2021** (`--pending2021`, importés avec `statut: en_attente`) ; (b) les **2 anciens administrateurs** (Super / Rédacteur) : les recréer comme administrateurs du nouveau site (même méthode, avec document `admins/{uid}`) ? ; (c) les **2 membres validés sans e-mail valide** (à corriger à la main) ; (d) les **inscrits 2023-2026** (≈ 1 800, quasi tous du spam) : produire une liste « à vérifier » filtrée ; (e) **catégories** des articles (Société, Culture, Économie, selon `g_news.id_categorie`) à reporter dans le champ `categorie` ; (f) aligner les **listes de secteurs (9) et de pays (241)** de l'ancienne base avec le formulaire d'inscription du nouveau site (liste de pays courte, 11 secteurs différents) sans changer le design ; (g) rendre les profils migrés **publics** ou non ; (h) **sécurité** : l'ancienne base MySQL contient toujours les 4 000 lignes de spam et les mots de passe SHA-512 ; la laisser en l'état comme archive, ne pas la réexposer.

## 5. Procédures

**Publier une modification (aucun déploiement automatique) :**
1. Modifier, tester en local (`python -m http.server 8000`, puis `BASE=http://localhost:8000 node tools/audit.mjs`).
2. Si des classes Tailwind ont changé : `npm install` puis `npm run build:css`, **commiter les deux CSS générés**.
3. **Incrémenter `?v=N`** du fichier CSS/JS modifié dans **toutes** les pages HTML (sinon cache navigateur).
4. `git add … && git commit && git push origin main` (uniquement quand l'utilisateur le demande).
5. Publier : `FTPU=<identifiant> FTPPW=<mot de passe> python deploy/ftp_deploy.py` (envoie `index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `admin/`, `pages/`, `css/`, `js/`, `Assets/` et `deploy/ovh.htaccess` renommé `.htaccess`, vers la **racine** ; variable `FTPDIR=<dossier>` pour un sous-dossier de test). Les identifiants se demandent à l'utilisateur au moment de publier, jamais écrits dans un fichier.
6. Vérifier : `node tools/audit.mjs` (après `npm install --no-save puppeteer-core`).

**Retour arrière de la bascule :** déplacer le contenu de `grec-old/` vers la racine (renommages FTP `RNFR/RNTO`, quelques secondes), après avoir remis le nouveau site dans un dossier. Rien n'a été supprimé sur le serveur.

**Règles / index Firestore :** `firestore.rules` et `firestore.indexes.json` ne se déploient plus automatiquement. Publier les règles depuis la console Firebase (Firestore, Règles) ou via `firebase deploy --only firestore --project grec-group-f43b0` (nécessite un compte de service avec les droits « Service Usage » et « Index Admin »). Une erreur `requires an index` dans la console du navigateur contient un lien de création en un clic.

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
1. **12 fiches de membres écrites en dur** dans `pages/membres.html` (Kofi Adjovi, Aïssatou Kéïta…) et le chiffre **« 180+ membres »** (lignes ≈ 508 et 973) : vrais membres ou exemples ? À supprimer/remplacer si fictifs.
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
11. **Compte de service Firebase** : la clé d'administration créée depuis la console n'a pas les droits « Service Usage » ni « Datastore Index Admin » : `firebase deploy` et la création d'index par API sont refusés (403). Utiliser la console pour les index.
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
