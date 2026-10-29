// Publie firestore.rules sur le projet Firebase (API Firebase Rules) : crée un jeu de règles validé par Google puis le publie.
// Affiche l'identifiant de la version précédente pour pouvoir revenir en arrière.
// Usage : KEYFILE=<clé compte de service du projet grec-group-f43b0> node tools/publier-regles.cjs
// Retour arrière : PATCH .../releases/cloud.firestore avec l'ancien rulesetName (voir PASSATION-IA.md).
const path = require('path'), fs = require('fs');
const admin = require('firebase-admin'); // exécuter depuis la racine du dépôt (npm install)
const key = JSON.parse(fs.readFileSync(process.env.KEYFILE, 'utf8'));
const P = key.project_id;
admin.initializeApp({ credential: admin.credential.cert(key), projectId: P });
const content = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
(async () => {
  const t = (await admin.credential.cert(key).getAccessToken()).access_token;
  const H = { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' };
  const cur = await (await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}/releases/cloud.firestore`, { headers: H })).json();
  console.log('Version publiée AVANT (retour arrière) :', cur.rulesetName);
  const rs = await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}/rulesets`, { method: 'POST', headers: H, body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content }] } }) });
  const rj = await rs.json();
  if (!rs.ok) { console.log('RÈGLES REFUSÉES (non publiées) :', JSON.stringify(rj.error).slice(0, 400)); process.exit(1); }
  const rel = await fetch(`https://firebaserules.googleapis.com/v1/projects/${P}/releases/cloud.firestore`, { method: 'PATCH', headers: H, body: JSON.stringify({ release: { name: `projects/${P}/releases/cloud.firestore`, rulesetName: rj.name } }) });
  console.log(rel.ok ? 'PUBLIÉES : ' + rj.name : 'Publication refusée : ' + JSON.stringify((await rel.json()).error).slice(0, 300));
  process.exit(rel.ok ? 0 : 1);
})().catch((e) => { console.log('ERREUR', e.message); process.exit(1); });
