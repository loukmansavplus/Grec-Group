// Migration des membres de l'ancien site vers Firebase (Authentication + Firestore), avec leurs mots de passe actuels.
// Usage : node migrate_members.cjs [--execute] [--pending2021]   (sans --execute : essai à blanc, rien n'est écrit)
const path = require('path'), fs = require('fs');
const REPO = 'C:/Users/HP/Documents/PROJETS SAV+/GREC/Grec-Group';
const admin = require(path.join(REPO, 'node_modules/firebase-admin'));
const key = JSON.parse(fs.readFileSync(process.env.KEYFILE, 'utf8'));
if (key.project_id !== 'grec-group-f43b0') { console.log('ARRET : mauvaise clé'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
const EXECUTE = process.argv.includes('--execute');
const PENDING = process.argv.includes('--pending2021');
const B = 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees/';
const data = JSON.parse(fs.readFileSync(B + 'donnees.json', 'utf8'));
const photos = fs.existsSync(B + 'photos.json') ? JSON.parse(fs.readFileSync(B + 'photos.json', 'utf8')) : {};
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

(async () => {
  const existing = new Set();
  let page = await admin.auth().listUsers(1000);
  page.users.forEach((u) => existing.add((u.email || '').toLowerCase()));

  const rows = data.g_membre.filter((m) => {
    const ok = EMAIL_OK.test(clean(m.email));
    if (m.statut === '1') return ok;
    return PENDING && m.statut === '0' && (m.datecreated || '').startsWith('2021') && ok;
  });
  const skipped = { dejaExistant: [], doublon: [] }, seen = new Set(), todo = [];
  for (const m of rows) {
    const email = clean(m.email).toLowerCase();
    if (existing.has(email)) { skipped.dejaExistant.push(m.id_membre); continue; }
    if (seen.has(email)) { skipped.doublon.push(m.id_membre); continue; }
    seen.add(email);
    todo.push({ m, email });
  }
  const noHash = todo.filter(({ m }) => !/^[0-9a-f]{128}$/.test(m.password || ''));
  console.log(`Sélection : ${rows.length} | à créer : ${todo.length} | déjà existants : ${skipped.dejaExistant.length} | doublons : ${skipped.doublon.length}`);
  console.log(`Avec mot de passe migrable : ${todo.length - noHash.length} | sans mot de passe (lien de réinitialisation à envoyer) : ${noHash.length}`);
  console.log(`Avec photo : ${todo.filter(({ m }) => photos[m.id_membre]).length}`);
  console.log(`Statuts : ${todo.filter(({ m }) => m.statut === '1').length} validés, ${todo.filter(({ m }) => m.statut === '0').length} en attente`);
  if (!EXECUTE) { console.log('\nESSAI À BLANC : rien n\'a été écrit.'); process.exit(0); }

  const T = admin.firestore.Timestamp, FV = admin.firestore.FieldValue;
  const users = todo.map(({ m, email }) => {
    const u = { uid: 'legacy-m' + m.id_membre, email, emailVerified: true, displayName: clean(m.nom_prenom) };
    if (/^[0-9a-f]{128}$/.test(m.password || '')) u.passwordHash = Buffer.from(m.password, 'hex');
    return u;
  });
  const res = await admin.auth().importUsers(users, { hash: { algorithm: 'SHA512', rounds: 1 } });
  console.log(`Comptes importés : ${res.successCount} | échecs : ${res.failureCount}`);
  res.errors.forEach((e) => console.log('  échec index', e.index, e.error.message));

  const failed = new Set(res.errors.map((e) => e.index));
  let batch = admin.firestore().batch(), n = 0, docs = 0;
  for (let i = 0; i < todo.length; i++) {
    if (failed.has(i)) continue;
    const { m, email } = todo[i];
    const ref = admin.firestore().collection('membres').doc('legacy-m' + m.id_membre);
    const created = m.datecreated ? T.fromDate(new Date(m.datecreated.replace(' ', 'T') + 'Z')) : FV.serverTimestamp();
    const doc = {
      nom: clean(m.nom_prenom), prenom: '', nomFamille: '', email, telephone: clean(m.phone), pays: clean(m.pays),
      secteur: clean(m.activite), bio: String(m.presentation || '').trim(), poste: '', ville: '',
      statut: m.statut === '1' ? 'actif' : 'en_attente', codeEthique: true, role: 'membre',
      publicProfileEnabled: false, showPhoto: true, showBio: true, showLocation: true,
      legacyId: Number(m.id_membre), legacySource: 'ancien-site-php', createdAt: created, updatedAt: FV.serverTimestamp(),
    };
    if (photos[m.id_membre]) doc.photoURL = photos[m.id_membre];
    batch.set(ref, doc);
    docs++;
    if (++n === 400) { await batch.commit(); batch = admin.firestore().batch(); n = 0; }
  }
  if (n) await batch.commit();
  console.log('Profils créés dans Firestore :', docs);
  const total = (await admin.auth().listUsers(1000)).users.length;
  const mc = (await admin.firestore().collection('membres').get()).size;
  console.log(`Vérification : ${total} comptes de connexion, ${mc} profils membres.`);
  process.exit(0);
})().catch((e) => { console.log('ERREUR', e.code || '', String(e.message).slice(0, 220)); process.exit(1); });
