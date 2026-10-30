// Exporte les comptes (SANS mot de passe) et toutes les collections Firestore vers un fichier JSON (hors dépôt), prêt pour l'import MySQL.
// Aucune information d'authentification n'est exportée : les mots de passe font l'objet d'une étape séparée et explicitement validée.
// Usage : KEYFILE=<clé compte de service> node tools/migration/5-exporter-firebase.cjs [dossier-de-sortie]
const fs = require('fs'), path = require('path');
const admin = require('firebase-admin'); // exécuter depuis la racine du dépôt (npm install)
const key = JSON.parse(fs.readFileSync(process.env.KEYFILE, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
const OUT = process.argv[2] || 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees';
const COLLECTIONS = ['membres', 'annuaire', 'admins', 'actualites', 'evenements', 'contributions', 'galerie', 'partenaires', 'newsletter', 'contacts', 'chats', 'ACTION_LOG'];

// Timestamp Firestore -> {"__ts": millisecondes} ; le reste est conservé tel quel
function conv(v) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.toMillis === 'function' && typeof v.seconds === 'number') return { __ts: v.toMillis() };
  if (Array.isArray(v)) return v.map(conv);
  const o = {}; Object.keys(v).forEach((k) => { o[k] = conv(v[k]); }); return o;
}

(async () => {
  const users = [];
  let page;
  do {
    page = await admin.auth().listUsers(1000, page && page.pageToken);
    page.users.forEach((u) => users.push({ uid: u.uid, email: (u.email || '').toLowerCase(), displayName: u.displayName || '', photoURL: u.photoURL || '',
      emailVerified: !!u.emailVerified, disabled: !!u.disabled, createdMs: Date.parse(u.metadata.creationTime) || Date.now(), sha512: null }));
  } while (page.pageToken);

  const docs = [];
  for (const c of COLLECTIONS) {
    const snap = await admin.firestore().collection(c).get();
    for (const d of snap.docs) {
      docs.push({ path: c + '/' + d.id, data: conv(d.data()) });
      if (c === 'chats') {
        const ms = await d.ref.collection('messages').get();
        ms.docs.forEach((m) => docs.push({ path: c + '/' + d.id + '/messages/' + m.id, data: conv(m.data()) }));
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'firebase-export.json'), JSON.stringify({ exportedAt: new Date().toISOString(), users, docs }));
  const byColl = {}; docs.forEach((d) => { const k = d.path.split('/')[0]; byColl[k] = (byColl[k] || 0) + 1; });
  console.log(`Export : ${users.length} comptes (sans mot de passe), ${docs.length} documents`, JSON.stringify(byColl));
  process.exit(0);
})().catch((e) => { console.log('ERREUR', e.message); process.exit(1); });
