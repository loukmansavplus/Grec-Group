# Migration de l'ancienne base MySQL (site PHP) vers Firebase

Ces scripts ont servi à reprendre les membres de l'ancien site (table `g_membre`) dans le nouveau (Firebase Authentication + Firestore),
**avec leurs mots de passe actuels** (SHA-512 sans sel, importés tels quels : Firebase sait les vérifier).
**Aucun identifiant ni donnée personnelle n'est dans le dépôt.** Les identifiants se passent par variables d'environnement ; l'export SQL et les photos restent **hors du dépôt**
(`Documents\SAUVEGARDE-OVH-ancien-site-2026-10-28\base-de-donnees\`).

| Étape | Script | Ce qu'il fait |
|---|---|---|
| 1 | `1-export-base-phpmyadmin.mjs` | Se connecte à phpMyAdmin OVH (`PMAUSER`, `PMAPW`) et télécharge l'export SQL complet (lecture seule). |
| 2 | `2-analyser-export.py` | Lit l'export, écrit `donnees.json`, affiche structure et comptages. |
| 3 | `3-photos-membres.py` | Récupère par FTP (`FTPU`, `FTPPW`) les photos des membres dans `grec-old/images/` et les envoie sur Cloudinary (`--upload`). |
| 4 | `4-importer-membres.cjs` | Crée les comptes + profils. **Essai à blanc par défaut** ; `--execute` pour écrire ; `--pending2021` pour inclure les inscrits « en attente » de 2021. Nécessite une clé de compte de service (`KEYFILE`). |

Les chemins sont ceux du poste où la migration a été faite : à adapter. Les scripts sont **idempotents côté sélection** (les comptes déjà existants sont ignorés).
Voir `PASSATION-IA.md` (§4 bis) pour les résultats et les décisions restantes.
