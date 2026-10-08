# Créer le premier administrateur

Les règles Firestore ne reconnaissent plus d'adresse email « admin » codée en dur.
Un administrateur est un document `admins/{UID}` avec `active: true`.

1. Sur le site, créez un compte normal (page d'inscription) avec l'email de l'administrateur.
2. Console Firebase, Authentication, Users : copiez l'**UID** de ce compte.
3. Console Firebase, Firestore Database, Démarrer une collection `admins` :
   - ID du document : l'UID copié
   - champs : `uid` (string, même UID), `email` (string), `role` = `admin` (string), `active` = `true` (boolean)
4. Reconnectez-vous : le lien « Dashboard » apparaît.

Les administrateurs suivants s'ajoutent depuis le tableau de bord (bouton de création d'admin) :
la personne doit d'abord s'être inscrite comme membre.
