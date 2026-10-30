# GREC Group — Guide du projet (au 30 octobre 2026)

Ce document explique **ce qui est fait, ce qui reste à faire et comment utiliser le site au quotidien**. Il est écrit pour les responsables du projet, pas pour des développeurs. Il ne contient aucun mot de passe : les accès se transmettent séparément.

- Site : **https://grec.group**
- Tableau de bord administrateur : **https://grec.group/admin/**
- Code source : https://github.com/loukmansavplus/Grec-Group (documentation technique : `PASSATION-IA.md`)

---

## 1. En bref

Le nouveau site est **en ligne sur grec.group**. Les comptes et toutes les données sont maintenant dans la **base de données OVH** (celle de l'ancien site) : il n'y a plus de limite d'utilisation liée à un service gratuit, et le site peut accueillir des milliers de membres. Les photos sont stockées sur l'hébergement OVH.

**Les anciens membres n'ont rien à refaire** : ils se connectent avec **leur ancien e-mail et leur ancien mot de passe**.

**Un seul point bloque encore : l'envoi d'e-mails** (voir §4).

---

## 2. Se connecter à l'administration

1. Aller sur **https://grec.group/pages/auth.html**.
2. Saisir l'e-mail et le mot de passe d'un compte administrateur, puis valider.
3. Un lien **« Dashboard »** apparaît dans le menu (ou aller directement sur https://grec.group/admin/).

Comptes administrateurs existants :

| Compte | Mot de passe |
|---|---|
| `admintest@gmail.com` (compte de test, à supprimer en fin de projet) | transmis séparément |
| `admin@grec.group` (ancien administrateur « Super ») | **son mot de passe de l'ancien site** |
| `redacteur@grec.group` (ancien « Rédacteur », mêmes droits) | **son mot de passe de l'ancien site** |

**Ajouter un administrateur** : la personne doit d'abord avoir un compte membre (créé sur le site, ou ancien compte migré). Ensuite, dans l'administration : **Paramètres → « + Créer un compte admin »**, saisir son e-mail. Pour retirer les droits, utiliser la liste des administrateurs au même endroit.

---

## 3. Ce qui est fait

**Migration technique**
- Le site, l'API (le programme qui gère comptes et données) et la base sont tous sur l'hébergement OVH mutualisé, sans serveur supplémentaire à payer.
- La base `hconsuqgrec` de l'ancien site est **réutilisée** : ses tables d'origine (`g_membre`, `g_admin`…) ne sont jamais supprimées ni modifiées dans leur structure ; les nouvelles fonctions ont leurs propres tables.
- **Anciens mots de passe conservés** : à la première connexion d'un ancien membre, le site vérifie son mot de passe dans l'ancienne table, crée son compte moderne et remplace l'ancien chiffrement par un plus sûr. Fonctionne aussi pour les **inscriptions faites sur l'ancien site après la migration** (testé avec un vrai compte).
- Les inscriptions et validations faites sur le nouveau site sont aussi recopiées dans l'ancienne table `g_membre`.
- **Images** : les 24 photos de membres qui étaient chez Cloudinary ont été rapatriées sur l'hébergement. Les nouvelles photos (profil, actualités, partenaires, galerie) y sont envoyées directement, après vérification et réduction automatique de taille.
- Sécurité : session protégée, limitation des tentatives de connexion, droits d'accès contrôlés côté serveur, dossier des images sans exécution de scripts.
- **118 contrôles automatiques** de l'API et **20 contrôles de pages** (ordinateur et mobile) : tous passent.

**Fonctionnement reproduit de l'ancien site**
- Toute nouvelle inscription est **en attente** jusqu'à validation par un administrateur.
- **Annuaire public** des membres : 8 fiches par page, filtres par pays et par activité, recherche. Il n'affiche jamais l'e-mail ni le téléphone.
- Dans l'administration : liste des membres (en attente en premier, 25 par page), valider, masquer, supprimer.

**Design**
- Tableau de bord refait : un menu par section, icônes, cartes compactes.
- Profil public, **profil privé** et **messagerie** refaits dans le même style.
- Boris Djimadja est indiqué comme **Président du GREC**.

**Reprise des données**
- 24 membres validés et 51 inscrits « en attente » de fin 2021 repris avec leur mot de passe d'origine. Environ 3 960 inscriptions automatiques (spam, 2022-2026) **n'ont pas été reprises** volontairement.
- Aucune personne réelle ne s'est inscrite sur la version de démonstration : rien à récupérer de l'ancien service Firebase.

**Sauvegardes déjà faites** (sur l'ordinateur de l'agence, jamais sur GitHub) : export complet de la base avant la bascule, et copie de l'ancien site.

---

## 4. Ce qui reste à faire

| # | À faire | Qui | Remarque |
|---|---|---|---|
| 1 | **E-mails** : « mot de passe oublié » et confirmation d'inscription **ne fonctionnent pas** | Le patron (offre OVH), puis l'agence | Voir la procédure ci-dessous |
| 2 | **Valider (ou rejeter) les 51 inscrits de 2021** | Le client | Administration → Membres |
| 3 | **Annoncer le nouveau site aux membres** : « connectez-vous avec vos identifiants habituels » | Le client | Les e-mails n'étant pas prêts, passer par WhatsApp ou le réseau habituel |
| 4 | **Supprimer le compte de test** `admintest@gmail.com` | L'agence | À demander ; il existe dans l'ancien admin et dans le nouveau |
| 5 | **Changer le mot de passe de la base de données** | Le patron (espace OVH) puis l'agence | Il a transité en clair dans des conversations. Après le changement, mettre à jour `api/config.php` sur le serveur et les 3 fichiers `config.php` de l'ancien site |
| 6 | **Faire une sauvegarde régulière** (base + dossier `uploads/`) | L'agence ou le patron | Voir §5.9 |
| 7 | Décider si la **galerie** reste masquée | Le client | Masquée à sa demande ; gérable dans l'admin |
| 8 | Corriger les contenus signalés : dates de deux articles, photos trop petites (Brice Zohoun, Jocelyne Duval), logo blanc | Le client | Détail dans `PASSATION-IA.md` §6B |
| 9 | Plus tard : changer les clés Firebase et Cloudinary encore existantes (plus utilisées), éventuellement supprimer les anciens comptes | L'agence | Les clés FTP sont conservées à la demande |

**Limites actuelles à connaître**
- Sans e-mail, un membre qui a oublié son mot de passe doit contacter l'équipe ; un administrateur ne peut pas encore lui en définir un depuis le tableau de bord.
- La page de profil n'a pas de fonction « changer mon mot de passe ».
- Un ancien membre dont l'inscription est restée « en attente » voit le message « en attente de validation » à la connexion : c'est normal.

**E-mails : ce qu'il faut faire**
1. Le patron prend chez OVH une **offre e-mail qui permet de créer des boîtes** (par exemple *Email Pro*). L'offre actuelle (MX Plan) ne le permet pas.
2. Créer la boîte **`no-reply@grec.group`** et activer SPF/DKIM (OVH propose de le faire en un clic pour le domaine).
3. Communiquer à l'agence : le mot de passe de cette boîte et le nom du serveur d'envoi indiqué par OVH.
4. L'agence renseigne `api/config.php` sur le serveur (`mail_mode` à `smtp`, plus les champs `smtp_*`) et teste avec une vraie adresse.

---

## 5. Utilisation au quotidien

### 5.1 Valider un nouveau membre
Administration → **Membres**. Les inscrits en attente sont en tête de liste. Cliquer **Valider** : le membre apparaît dans l'annuaire public et peut utiliser la messagerie. **Masquer** retire sa fiche de l'annuaire, **Supprimer** efface le compte. Le membre n'est pas prévenu automatiquement tant que les e-mails ne fonctionnent pas : l'informer soi-même.

### 5.2 Publier une actualité
Administration → **Actualités** : titre, texte, image (envoyée depuis l'ordinateur), puis publier. Un article non publié reste un brouillon invisible du public.

### 5.3 Événements, galerie, partenaires
Même principe dans **Événements**, **Galerie** et **Partenaires** : remplir le formulaire, ajouter l'image, enregistrer. Les partenaires publiés apparaissent sur la page Partenaires.

### 5.4 Modérer les contributions
Administration → **Modération** : les propositions faites par des membres sont à approuver ou refuser avant publication.

### 5.5 Messages reçus et newsletter
Administration → **Messages** : messages du formulaire de contact et adresses inscrites à la newsletter, avec export **CSV**. Le site ne fait que **collecter** les adresses : l'envoi de newsletters demande un outil à part.

### 5.6 Journal d'activité
Administration → **Journal d'activité** : historique des actions faites par les administrateurs.

### 5.7 Ouvrir ou fermer l'ancien site (dossier `grec-old/`)
Il est **fermé** aujourd'hui (accès refusé à tous), car il avait des failles. Pour le rouvrir quelques minutes (par exemple pour consulter son ancien admin : https://grec.group/grec-old/web/login.php), avec un logiciel FTP (FileZilla), dans le dossier `grec-old/` avec les fichiers cachés affichés :
- **Ouvrir** : renommer `.htaccess` en `.htaccess.bloque`, puis `.htaccess.ouvert` en `.htaccess`.
- **Refermer** : renommer `.htaccess` en `.htaccess.ouvert`, puis `.htaccess.bloque` en `.htaccess`.

Ou en une commande : `python deploy/ancien_site.py ouvrir` / `fermer` / `etat` (avec les variables `FTPU` et `FTPPW`). **Le laisser ouvert le moins longtemps possible.**

### 5.8 Publier une modification du site
Le site se publie **à la main** par FTP, il n'y a pas de mise en ligne automatique.
1. Modifier le code, tester en local.
2. `FTPU=… FTPPW=… python deploy/ftp_deploy.py` publie les pages ; `python deploy/ftp_deploy_api.py` (avec `API_CONFIG` pointant sur le fichier de configuration de production) publie l'API.
3. Vérifier : `node tools/audit.mjs` (variable `BASE=https://grec.group`).
4. Ne jamais mettre d'identifiant ou de mot de passe dans un fichier du dépôt : il est public.

### 5.9 Sauvegarder
- **Base de données** : dans phpMyAdmin (OVH), choisir la base `hconsuqgrec` → **Exporter** → format SQL. À faire régulièrement et avant toute grosse modification.
- **Images** : télécharger le dossier `uploads/` par FTP.
- Conserver ces copies **hors de GitHub** (elles contiennent des données personnelles).

### 5.10 Revenir en arrière en cas de problème grave
Le plus simple : republier la version précédente du site depuis GitHub (l'historique permet de retrouver n'importe quelle version). L'ancienne version fonctionnant avec Firebase existe toujours (dernier état avant la bascule : `7974b62`), mais les inscriptions faites sur le nouveau système depuis le 30 octobre n'y seraient pas. À n'utiliser qu'en dernier recours, avec l'agence.

---

## 6. Comment ça marche (schéma simple)

```
Navigateur du visiteur
   │  pages du site (HTML, CSS, JavaScript)  ← hébergement OVH (dossier racine)
   │
   └─► API  https://grec.group/api/…  (PHP)  ← hébergement OVH (dossier api/)
          │  comptes, droits, envoi d'images
          ├─► base MySQL « hconsuqgrec »
          │     tables de l'ancien site : g_membre, g_admin…  (jamais supprimées)
          │     nouvelles tables : app_user, app_doc…
          └─► dossier uploads/  (photos et images)

Dossier grec-old/ : ancien site PHP, fermé ; il partage la même base de données.
```

## 7. Adresses utiles

| Quoi | Où |
|---|---|
| Site | https://grec.group |
| Connexion | https://grec.group/pages/auth.html |
| Administration | https://grec.group/admin/ |
| Test de l'API | https://grec.group/api/health |
| Code | https://github.com/loukmansavplus/Grec-Group |
| Base de données | phpMyAdmin OVH, base `hconsuqgrec` |
