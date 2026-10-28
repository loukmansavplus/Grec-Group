# GREC Group — Site web

Site du Groupe de Réflexion sur l'Entrepreneuriat et la Créativité au Bénin.

- **Site en ligne** : https://grec.group (hébergement OVH, publié par FTP)
- **Dépôt** : https://github.com/loukmansavplus/Grec-Group (branche `main`, public)
- **Stack** : HTML, Tailwind CSS **compilé**, JavaScript sans framework, Firebase (Authentication + Firestore), Cloudinary (images)
- **Déploiement** : **manuel** par FTP (`deploy/ftp_deploy.py`). Aucun déploiement automatique.

> **Reprise du projet (humain ou agent IA) : lire d'abord [PASSATION-IA.md](PASSATION-IA.md)** : ce qui est fait, ce qui reste à faire, procédures et pièges connus.
> [SUIVI-PROJET.md](SUIVI-PROJET.md) est le journal historique.

## Démarrage rapide
```bash
git clone https://github.com/loukmansavplus/Grec-Group.git
cd Grec-Group
python -m http.server 8000        # puis http://localhost:8000
```
Aucune compilation n'est nécessaire pour tester. Pour recompiler le CSS Tailwind après avoir changé des classes :
```bash
npm install && npm run build:css  # puis commiter css/tailwind.css et css/tailwind-admin.css
```
Contrôle automatique dans Chrome : `npm install --no-save puppeteer-core` puis `node tools/audit.mjs`.

## Structure
```
index.html, 404.html, robots.txt, sitemap.xml
pages/   about, actualites, membres, partenaires, auth, register, profil, profil-public, chat, galerie (masquée)
admin/   tableau de bord administrateur
css/     style.css + tailwind.css / tailwind-admin.css (générés)
js/      firebase-config.js, utils.js, chat.js, contributions.js, articles-data.js
Assets/  images        deploy/  publication FTP et .htaccess OVH        tools/  contrôle automatique
firestore.rules, firestore.indexes.json   règles et index de la base Firebase
```

## Sécurité
Ne jamais commiter de clé, mot de passe, fichier de compte de service ou identifiant FTP : ce dépôt est **public**.
