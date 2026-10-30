# GREC Group — Site web

Site du Groupe de Réflexion sur l'Entrepreneuriat et la Créativité au Bénin.

- **Site en ligne** : https://grec.group (hébergement OVH mutualisé, publié par FTP)
- **Dépôt** : https://github.com/loukmansavplus/Grec-Group (branche `main`, public)
- **Stack** : HTML, Tailwind CSS **compilé**, JavaScript sans framework ; **API PHP + base MySQL OVH** (`api/`, base `hconsuqgrec`) pour les comptes et les données ; images envoyées dans `uploads/` sur l'hébergement. Plus aucune dépendance à Firebase ni à Cloudinary pour les nouvelles données.
- **Déploiement** : **manuel** par FTP (`deploy/ftp_deploy.py` pour le site, `deploy/ftp_deploy_api.py` pour l'API). Aucun déploiement automatique.

> **Guide du projet (ce qui est fait, ce qui reste, mode d'emploi) : [GUIDE-PROJET.md](GUIDE-PROJET.md).**
>
> **Reprise du projet (humain ou agent IA) : lire d'abord [PASSATION-IA.md](PASSATION-IA.md)** : ce qui est fait, ce qui reste à faire, procédures et pièges connus.
> [SUIVI-PROJET.md](SUIVI-PROJET.md) est le journal historique.

## Démarrage rapide
```bash
git clone https://github.com/loukmansavplus/Grec-Group.git
cd Grec-Group
python -m http.server 8000        # pages statiques seulement (sans API : pas de connexion)
```
Pour tester avec l'API en local (PHP + MariaDB/MySQL, base `grec_dev`) :
```bash
php api/tests/seed.php                                   # remplit la base de test (refuse de tourner sur une base sans « dev » ou « test » dans son nom)
php -S localhost:8099 -t . api/tests/dev-router.php      # site + API sur http://localhost:8099
node api/tests/run.mjs                                   # 118 contrôles (comptes, droits, envoi d'images…)
```
Pour recompiler le CSS Tailwind après avoir changé des classes :
```bash
npm install && npm run build:css  # puis commiter css/tailwind.css et css/tailwind-admin.css
```
Contrôle automatique dans Chrome : `npm install --no-save puppeteer-core` puis `node tools/audit.mjs`.

## Structure
```
index.html, 404.html, robots.txt, sitemap.xml
pages/   about, actualites, membres, partenaires, auth, register, profil, profil-public, chat, galerie (masquée)
admin/   tableau de bord administrateur
api/     API PHP (comptes, documents, envoi d'images, droits) + tests/   (config.php = hors dépôt)
css/     style.css + tailwind.css / tailwind-admin.css (générés)
js/      backend-ovh.js (client de l'API), firebase-config.js, utils.js, chat.js, contributions.js
Assets/  images        deploy/  publication FTP et .htaccess OVH        tools/  contrôles et migration
uploads/ (sur le serveur uniquement) images envoyées par les membres et l'administration
```

## Compte administrateur de test (à supprimer avant la remise définitive)
Connexion : https://grec.group/pages/auth.html avec `admintest@gmail.com`. Le mot de passe est dans le fichier local **`ADMIN-TEST.local.md`** (ignoré par git : ce dépôt est public). Ce compte est aussi présent dans l'ancien admin. Le supprimer quand les tests sont finis.

## Ancien site (dossier `grec-old/`) : l'ouvrir ou le fermer soi-même
L'ancien site PHP est dans `grec-old/` sur le serveur. Il est ouvert ou fermé par **un seul fichier**, `grec-old/.htaccess`. Avec un logiciel FTP (FileZilla…), dans le dossier `grec-old/` (activer l'affichage des fichiers cachés) :

- **Le FERMER** (état normal : plus personne n'y accède) : renommer `.htaccess` en `.htaccess.ouvert`, puis `.htaccess.bloque` en `.htaccess`.
- **Le ROUVRIR** (pour un test sur l'ancien admin, `https://grec.group/grec-old/web/login.php`) : renommer `.htaccess` en `.htaccess.bloque`, puis `.htaccess.ouvert` en `.htaccess`.

Même chose en une commande : `FTPU=<identifiant> FTPPW=<mot de passe> python deploy/ancien_site.py fermer` (ou `ouvrir`). Quand il est ouvert, n'importe qui peut s'y inscrire et attaquer ses failles : le laisser ouvert le moins longtemps possible.

## Images
Les images envoyées (photos de profil, actualités, partenaires, galerie) sont enregistrées par l'API (`POST /api/upload`, connexion obligatoire) dans `uploads/<dossier>/` : vérifiées, réduites à 1600 px et ré-encodées. Les anciennes images Cloudinary sont rapatriées avec `tools/migration/6-images-vers-ovh.php` (mode d'emploi en tête du fichier).

## Sécurité
Ne jamais commiter de clé, mot de passe, fichier de compte de service ou identifiant FTP : ce dépôt est **public**. `api/config.php` (mot de passe de la base) est hors dépôt.
