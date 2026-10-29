// Test des règles Firestore en conditions réelles (comptes jetables, supprimés à la fin).
// Usage : KEYFILE=<clé compte de service> ADMIN_EMAIL=<admin> ADMIN_PW=<mot de passe> node tools/tester-regles.cjs
// Attendu : « 24 contrôles conformes, 1 non conformes » (le 1 = liste d'articles sans filtre, refusée par conception : le site filtre sur publie == true).
const path = require('path'), fs = require('fs');
const admin = require('firebase-admin'); // exécuter depuis la racine du dépôt (npm install)
const key = JSON.parse(fs.readFileSync(process.env.KEYFILE, 'utf8'));
const P = 'grec-group-f43b0';
admin.initializeApp({ credential: admin.credential.cert(key), projectId: P });
const API = fs.readFileSync(path.join(__dirname, '../js/firebase-config.js'), 'utf8').match(/apiKey:\s*"([^"]+)"/)[1];
const FS = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const db = admin.firestore(), auth = admin.auth();
const T = Date.now();
let ok = 0, ko = 0;

const val = (v) => typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : { stringValue: String(v) };
const fields = (o) => ({ fields: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)])) });
async function call(method, p, token, body) {
  const r = await fetch(FS + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(fields(body)) : undefined });
  return r.status;
}
function check(label, got, expectAllowed) {
  const allowed = got === 200;
  const good = allowed === expectAllowed;
  good ? ok++ : ko++;
  console.log((good ? 'OK   ' : 'ÉCHEC') + '  ' + label + '  -> ' + (allowed ? 'autorisé' : 'refusé (' + got + ')') + (good ? '' : '   <-- ATTENDU : ' + (expectAllowed ? 'autorisé' : 'refusé')));
}
async function login(email, password) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json(); if (!r.ok) throw new Error('login ' + email + ' : ' + (j.error && j.error.message)); return j.idToken;
}
async function mkUser(tag, statut) {
  const email = `tmp-test-${tag}-${T}@example.invalid`, password = 'Test-' + T + '-Zz!';
  const u = await auth.createUser({ uid: `tmp-${tag}-${T}`, email, password, emailVerified: true });
  if (statut) await db.collection('membres').doc(u.uid).set({ nom: 'Test ' + tag, email, telephone: '0000', pays: 'Bénin', secteur: 'Coaching', statut, role: 'membre', publicProfileEnabled: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  return { uid: u.uid, email, token: await login(email, password) };
}

(async () => {
  const sample = (await db.collection('membres').where('legacySource', '==', 'ancien-site-php').limit(1).get()).docs[0].id;
  const created = [];
  try {
    const pending = await mkUser('pend', 'en_attente'); created.push(pending.uid);
    const active = await mkUser('act', 'actif'); created.push(active.uid);
    const fresh = await mkUser('new', null); created.push(fresh.uid);

    console.log('\n=== VISITEUR (non connecté)');
    check('lire l\'annuaire public (liste)', await call('GET', '/annuaire?pageSize=1'), true);
    check('lire une fiche de l\'annuaire', await call('GET', '/annuaire/' + sample), true);
    check('lire la liste des membres (e-mails, téléphones)', await call('GET', '/membres?pageSize=1'), false);
    check('lire le profil complet d\'un membre', await call('GET', '/membres/' + sample), false);
    check('lire les articles publiés', await call('GET', '/actualites?pageSize=1'), true);
    check('écrire dans l\'annuaire', await call('PATCH', '/annuaire/zz-visiteur', null, { nom: 'x' }), false);

    console.log('\n=== MEMBRE EN ATTENTE (inscrit, pas encore validé)');
    check('lire son propre profil', await call('GET', '/membres/' + pending.uid, pending.token), true);
    check('lire le profil d\'un autre membre', await call('GET', '/membres/' + sample, pending.token), false);
    check('lister les membres', await call('GET', '/membres?pageSize=1', pending.token), false);
    check('créer une conversation (messagerie)', await call('PATCH', '/chats/zz-' + T, pending.token, { participants: [pending.uid, sample] }), false);
    check('lire l\'annuaire public', await call('GET', '/annuaire?pageSize=1', pending.token), true);
    check('s\'auto-valider (statut -> actif)', await call('PATCH', '/membres/' + pending.uid + '?updateMask.fieldPaths=statut', pending.token, { statut: 'actif' }), false);

    console.log('\n=== MEMBRE ACTIF (validé)');
    check('lister les membres', await call('GET', '/membres?pageSize=1', active.token), true);
    check('lire le profil d\'un autre membre', await call('GET', '/membres/' + sample, active.token), true);
    check('publier sa fiche dans l\'annuaire (champs publics)', await call('PATCH', '/annuaire/' + active.uid, active.token, { nom: 'Test act', secteur: 'Coaching', pays: 'Bénin', bio: 'x', showPhoto: true }), true);
    check('publier sa fiche avec un champ privé (email)', await call('PATCH', '/annuaire/' + active.uid, active.token, { nom: 'Test act', email: 'a@b.c' }), false);
    check('modifier la fiche d\'un AUTRE membre dans l\'annuaire', await call('PATCH', '/annuaire/' + sample, active.token, { nom: 'piraté' }), false);
    check('s\'attribuer le rôle administrateur', await call('PATCH', '/admins/' + active.uid, active.token, { uid: active.uid, active: true, role: 'admin' }), false);

    console.log('\n=== NOUVELLE INSCRIPTION (contournement de la validation)');
    check('créer son profil avec statut "actif"', await call('PATCH', '/membres/' + fresh.uid, fresh.token, { nom: 'Test new', email: 'x@y.z', statut: 'actif', role: 'membre' }), false);
    check('créer son profil avec statut "en_attente"', await call('PATCH', '/membres/' + fresh.uid, fresh.token, { nom: 'Test new', email: 'x@y.z', statut: 'en_attente', role: 'membre' }), true);

    console.log('\n=== ADMINISTRATEUR (admin@grec.group)');
    const adm = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PW); // compte administrateur existant (variables d'environnement)
    check('lister les membres', await call('GET', '/membres?pageSize=1', adm), true);
    check('valider un membre en attente', await call('PATCH', '/membres/' + pending.uid + '?updateMask.fieldPaths=statut', adm, { statut: 'actif' }), true);
    check('écrire dans l\'annuaire', await call('PATCH', '/annuaire/' + pending.uid, adm, { nom: 'Test pend' }), true);
    check('lire les inscriptions newsletter', await call('GET', '/newsletter?pageSize=1', adm), true);
    console.log('\n=== MÊME MEMBRE, après validation par l\'administrateur');
    check('lister les membres (devenu actif)', await call('GET', '/membres?pageSize=1', pending.token), true);
  } finally {
    for (const uid of created) { await auth.deleteUser(uid).catch(() => {}); await db.collection('membres').doc(uid).delete().catch(() => {}); await db.collection('annuaire').doc(uid).delete().catch(() => {}); }
    await db.collection('chats').doc('zz-' + T).delete().catch(() => {});
    console.log('\nComptes et données de test supprimés.');
  }
  console.log(`\nRÉSULTAT : ${ok} contrôles conformes, ${ko} non conformes.`);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.log('ERREUR', e.message); process.exit(2); });
