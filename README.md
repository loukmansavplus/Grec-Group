# GREC Group — Site web

Site du Groupe de Réflexion sur l'Entrepreneuriat et la Créativité au Bénin.

- **Site en ligne** : https://grec-group.web.app
- **Stack** : HTML, Tailwind (CDN), JavaScript sans compilation, Firebase (Auth, Firestore, Hosting), Cloudinary (images)
- **Déploiement** : automatique à chaque `git push` sur `main` (GitHub Actions)

## Démarrage rapide
```bash
git clone https://github.com/loukmansavplus/Grec-Group.git
cd Grec-Group
python -m http.server 8000     # http://localhost:8000
```

## Documentation
- **[SUIVI-PROJET.md](SUIVI-PROJET.md)** : état du projet, architecture, déploiement, ce qui est fait et ce qu'il reste à faire. **À lire en premier.**
- [ADMIN-SETUP.md](ADMIN-SETUP.md) : créer le premier administrateur.

## À retenir
- Quand on modifie un fichier CSS ou JS, **augmenter le numéro de version** (`?v=3`) dans toutes les pages HTML, sinon les navigateurs gardent l'ancienne version.
- Ne jamais commiter de clés ou de fichiers JSON de comptes de service.
