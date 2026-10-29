// Tests de l'API GREC (comptes, droits, requêtes). Usage :
//   php api/tests/seed.php && node api/tests/run.mjs        (serveur de test : php -S localhost:8099 -t . api/tests/dev-router.php)
// Variable BASE pour viser un autre serveur (jamais la production : le seed vide les tables).
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:8099';
const MAILLOG = new URL('../mail.log', import.meta.url);
let ok = 0, ko = 0;
const check = (label, cond, detail = '') => { cond ? ok++ : ko++; console.log((cond ? 'OK   ' : 'ÉCHEC') + '  ' + label + (cond || !detail ? '' : '   <-- ' + detail)); };

class Client {
  constructor() { this.cookies = {}; this.csrf = ''; }
  async raw(method, path, body, extraHeaders = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders);
    const cookie = Object.entries(this.cookies).map(([k, v]) => k + '=' + v).join('; ');
    if (cookie) headers.Cookie = cookie;
    if (this.csrf && method === 'POST' && !('X-CSRF-Token' in headers)) headers['X-CSRF-Token'] = this.csrf;
    const res = await fetch(BASE + '/api/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    for (const sc of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const [kv] = sc.split(';'); const i = kv.indexOf('='); this.cookies[kv.slice(0, i)] = kv.slice(i + 1); }
    let json = null; try { json = await res.json(); } catch (e) { /* pas de corps JSON */ }
    if (json && json.csrf) this.csrf = json.csrf;
    return { status: res.status, json };
  }
  async init() { await this.raw('GET', 'auth/me'); return this; }
  post(path, body) { return this.raw('POST', path, body); }
  async login(email, password) { const r = await this.post('auth/login', { email, password }); return r; }
  get(path) { return this.post('db/get', { path }); }
  query(path, where = [], orderBy = [], limit) { return this.post('db/query', { path, where, orderBy, limit }); }
  set(path, data, merge = false) { return this.post('db/set', { path, data, merge }); }
  add(path, data) { return this.post('db/add', { path, data }); }
  del(path) { return this.post('db/delete', { path }); }
}
const mk = async () => new Client().init();
const allowed = (r) => r.status === 200;
const denied = (r) => r.status === 403;
const T = Date.now();
const ts = (ms) => ({ __ts: ms });

(async () => {
  console.log('\n=== SANTÉ ET PROTECTIONS');
  let v = await mk();
  let r = await v.raw('GET', 'health'); check('l\'API répond et la base est joignable', r.status === 200 && r.json.ok === true);
  r = await new Client().raw('POST', 'auth/login', { email: 'a@b.c', password: 'x' }); check('POST sans jeton CSRF refusé', r.status === 403);
  r = await v.raw('POST', 'auth/login', { email: 'a@b.c', password: 'x' }, { 'Content-Type': 'text/plain' }); check('POST non JSON refusé (415)', r.status === 415);
  r = await v.raw('GET', 'inconnu'); check('route inconnue ou méthode interdite refusée', r.status === 405 || r.status === 404);
  for (const f of ['lib/db.php', 'config.php', 'schema.sql']) { const x = await fetch(BASE + '/api/' + f); check('fichier interne non servi : api/' + f, x.status !== 200 || !(await x.text()).includes('<?php') ); }

  console.log('\n=== COMPTES');
  const email = `nouveau-${T}@test.local`;
  let c = await mk();
  r = await c.post('auth/register', { email, password: 'court', displayName: 'X' }); check('mot de passe trop court refusé', r.status === 400 && r.json.error.code === 'auth/weak-password');
  r = await c.post('auth/register', { email: 'pas-un-email', password: 'MotDePasse-123' }); check('e-mail invalide refusé', r.status === 400 && r.json.error.code === 'auth/invalid-email');
  r = await c.post('auth/register', { email, password: 'MotDePasse-123', displayName: 'Nouveau Test' }); check('inscription réussie et connexion automatique', allowed(r) && r.json.user.email === email);
  r = await c.raw('GET', 'auth/me'); check('la session est reconnue (me)', r.json.user && r.json.user.email === email && r.json.user.displayName === 'Nouveau Test');
  const uidNew = r.json.user.uid;
  r = await c.post('auth/profile', { displayName: 'Nom Modifié', photoURL: 'https://exemple.org/a.jpg' }); check('mise à jour du profil de connexion', allowed(r) && r.json.user.displayName === 'Nom Modifié');
  await c.post('auth/logout', {});
  r = await c.raw('GET', 'auth/me'); check('déconnexion effective', r.json.user === null);
  r = await c.post('auth/register', { email, password: 'MotDePasse-123' }); check('e-mail déjà utilisé refusé (409)', r.status === 409 && r.json.error.code === 'auth/email-already-in-use');
  r = await c.login(email, 'mauvais'); check('mauvais mot de passe refusé (401)', r.status === 401 && r.json.error.code === 'auth/invalid-credential');
  r = await c.login(email, 'MotDePasse-123'); check('connexion avec le bon mot de passe', allowed(r));

  console.log('\n=== ANCIEN MOT DE PASSE (SHA-512 du site PHP)');
  let l = await mk();
  r = await l.login('ancien@test.local', 'OldPass!2021'); check('connexion avec le mot de passe de l\'ancien site', allowed(r));
  await l.post('auth/logout', {});
  r = await l.login('ancien@test.local', 'OldPass!2021'); check('2e connexion (hachage modernisé en base)', allowed(r));
  r = await l.login('ancien@test.local', 'faux'); check('mauvais mot de passe refusé après modernisation', r.status === 401);

  console.log('\n=== ANTI FORCE BRUTE');
  const bf = await mk(); let last;
  for (let i = 0; i < 9; i++) last = await bf.login('force-brute@test.local', 'essai' + i);
  check('blocage après trop de tentatives (429)', last.status === 429 && last.json.error.code === 'auth/too-many-requests');

  console.log('\n=== RÉINITIALISATION DU MOT DE PASSE');
  fs.writeFileSync(MAILLOG, '');
  const rs = await mk();
  r = await rs.post('auth/reset', { email }); check('demande de réinitialisation acceptée', allowed(r));
  const mail = fs.readFileSync(MAILLOG, 'utf8');
  const tok = (mail.match(/reset-password\.html\?token=([0-9a-f]{64})/) || [])[1];
  check('un e-mail contenant le lien est envoyé', !!tok && mail.includes('TO: ' + email));
  r = await rs.post('auth/reset', { email: 'inconnu@test.local' }); check('aucune fuite : même réponse pour un compte inconnu', allowed(r) && !fs.readFileSync(MAILLOG, 'utf8').includes('inconnu@test.local'));
  r = await rs.post('auth/reset-confirm', { token: 'x'.repeat(64), password: 'NouveauMdp-456' }); check('lien invalide refusé', r.status === 400);
  r = await rs.post('auth/reset-confirm', { token: tok, password: 'NouveauMdp-456' }); check('nouveau mot de passe enregistré', allowed(r));
  r = await rs.post('auth/reset-confirm', { token: tok, password: 'AutreMdp-789' }); check('le lien ne sert qu\'une fois', r.status === 400);
  r = await (await mk()).login(email, 'NouveauMdp-456'); check('connexion avec le nouveau mot de passe', allowed(r));
  r = await (await mk()).login(email, 'MotDePasse-123'); check('l\'ancien mot de passe ne marche plus', r.status === 401);

  console.log('\n=== VISITEUR (non connecté)');
  v = await mk();
  r = await v.query('annuaire'); check('lire l\'annuaire public (liste)', allowed(r) && r.json.docs.length >= 1);
  r = await v.get('annuaire/legacy-m1'); check('lire une fiche de l\'annuaire', allowed(r) && r.json.exists);
  r = await v.query('membres'); check('lire la liste des membres (e-mails, téléphones)', denied(r));
  r = await v.get('membres/legacy-m1'); check('lire le profil complet d\'un membre', denied(r));
  r = await v.query('actualites', [['publie', '==', true]], [['publishedAt', 'desc']], 2); check('articles publiés, du plus récent, limités à 2', allowed(r) && r.json.docs.length === 2 && r.json.docs[0].id === 'a3' && r.json.docs[1].id === 'a2', JSON.stringify(r.json.docs && r.json.docs.map(d => d.id)));
  r = await v.query('actualites', [['publie', '==', true]], [['publishedAt', 'asc']]); check('tri croissant', allowed(r) && r.json.docs.map(d => d.id).join() === 'a1,a2,a3');
  r = await v.query('actualites'); check('liste des articles sans filtre (brouillons possibles) refusée', denied(r));
  r = await v.get('actualites/a4'); check('lire un brouillon', denied(r));
  r = await v.get('actualites/a1'); check('lire un article publié', allowed(r));
  r = await v.query('evenements', [['publie', '==', true]], [['date', 'asc']], 12); check('événements publiés triés par date (champ texte)', allowed(r) && r.json.docs.length === 1);
  r = await v.query('partenaires', [], [['createdAt', 'desc']]); check('partenaires lisibles', allowed(r));
  r = await v.set('annuaire/zz-visiteur', { nom: 'x' }); check('écrire dans l\'annuaire', denied(r));
  r = await v.set('actualites/zz', { titre: 'x', publie: true }); check('publier un article', denied(r));
  r = await v.add('newsletter', { email: `abonne-${T}@test.local`, subscribedAt: { __sv: true } }); check('s\'abonner à la newsletter (valide)', allowed(r));
  r = await v.add('newsletter', { email: 'pas-un-email', subscribedAt: { __sv: true } }); check('newsletter avec e-mail invalide', denied(r));
  r = await v.add('newsletter', { email: 'ok@test.local', subscribedAt: { __sv: true }, extra: 'pirate' }); check('newsletter avec un champ en trop', denied(r));
  r = await v.add('contacts', { nom: 'Visiteur', email: 'v@test.local', message: 'Bonjour', createdAt: { __sv: true }, source: 'test' }); check('envoyer un message de contact', allowed(r));
  r = await v.add('contacts', { nom: 'V', email: 'v@test.local', message: 'x'.repeat(5001) }); check('message de contact trop long', denied(r));
  r = await v.query('newsletter'); check('lire les abonnés', denied(r));
  r = await v.query('contacts'); check('lire les messages de contact', denied(r));
  r = await v.query('admins'); check('lire la liste des administrateurs', denied(r));

  console.log('\n=== MEMBRE EN ATTENTE');
  const pd = await mk(); await pd.login('attente@test.local', 'PendPass-123');
  r = await pd.get('membres/pend1'); check('lire son propre profil', allowed(r));
  r = await pd.get('membres/legacy-m1'); check('lire le profil d\'un autre membre', denied(r));
  r = await pd.query('membres'); check('lister les membres', denied(r));
  r = await pd.set('chats/zz-' + T, { participants: ['pend1', 'legacy-m1'] }); check('créer une conversation', denied(r));
  r = await pd.query('annuaire'); check('lire l\'annuaire public', allowed(r));
  r = await pd.set('membres/pend1', { statut: 'actif' }, true); check('s\'auto-valider (statut -> actif)', denied(r));
  r = await pd.set('membres/pend1', { role: 'admin' }, true); check('s\'attribuer un autre rôle', denied(r));
  r = await pd.set('membres/pend1', { bio: 'Ma présentation' }, true); check('modifier sa présentation (autorisé)', allowed(r));
  r = await pd.add('contributions', { authorUid: 'pend1', validationStatus: 'en_attente', publie: false, type: 'article' }); check('proposer une contribution (réservé aux actifs)', denied(r));

  console.log('\n=== MEMBRE ACTIF');
  const ac = await mk(); await ac.login('ancien@test.local', 'OldPass!2021');
  r = await ac.query('membres'); check('lister les membres', allowed(r) && r.json.docs.length >= 2);
  r = await ac.get('membres/pend1'); check('lire le profil d\'un autre membre', allowed(r));
  r = await ac.set('annuaire/legacy-m1', { nom: 'Ancien Membre', secteur: 'Coaching', pays: 'Bénin', bio: 'maj', showPhoto: true, updatedAt: { __sv: true } }); check('mettre à jour sa fiche d\'annuaire (champs publics)', allowed(r));
  r = await ac.set('annuaire/legacy-m1', { nom: 'x', email: 'a@b.c' }); check('fiche d\'annuaire avec un champ privé (e-mail)', denied(r));
  r = await ac.set('annuaire/pend1', { nom: 'piraté' }); check('modifier la fiche d\'un AUTRE membre', denied(r));
  r = await ac.set('admins/legacy-m1', { uid: 'legacy-m1', active: true, role: 'admin' }); check('s\'attribuer le rôle administrateur', denied(r));
  r = await ac.set('actualites/zz-' + T, { titre: 'x', publie: true }); check('publier un article', denied(r));
  r = await ac.add('contributions', { authorUid: 'legacy-m1', validationStatus: 'en_attente', publie: false, type: 'article', titre: 'Mon article' }); check('proposer une contribution valide', allowed(r));
  const contribId = r.json && r.json.id;
  r = await ac.add('contributions', { authorUid: 'legacy-m1', validationStatus: 'valide', publie: true, type: 'article' }); check('contribution déjà « validée » (contournement)', denied(r));
  r = await ac.query('contributions', [['authorUid', '==', 'legacy-m1']]); check('lire ses propres contributions', allowed(r) && r.json.docs.length === 1);
  r = await ac.query('contributions', [['authorUid', '==', 'adm1']]); check('lire les contributions d\'un autre', denied(r));
  r = await ac.del('contributions/' + contribId); check('retirer sa contribution encore en attente', allowed(r));

  console.log('\n=== MESSAGERIE');
  const chatId = 'legacy-m1__adm1';
  r = await ac.get('chats/' + chatId); check('un test d\'existence sur une conversation inexistante est possible', allowed(r) && r.json.exists === false);
  r = await ac.set('chats/' + chatId, { participants: ['legacy-m1', 'adm1'], updatedAt: { __sv: true } }, true); check('créer une conversation avec un autre membre', allowed(r));
  r = await ac.set('chats/zz-3', { participants: ['legacy-m1', 'adm1', 'x'] }); check('conversation à 3 participants', denied(r));
  r = await ac.set('chats/zz-autre', { participants: ['adm1', 'pend1'] }); check('créer une conversation dont on est exclu', denied(r));
  r = await ac.add('chats/' + chatId + '/messages', { senderId: 'legacy-m1', text: 'Bonjour', createdAt: { __sv: true } }); check('envoyer un message', allowed(r));
  r = await ac.add('chats/' + chatId + '/messages', { senderId: 'adm1', text: 'usurpation', createdAt: { __sv: true } }); check('envoyer un message au nom d\'un autre', denied(r));
  r = await ac.add('chats/' + chatId + '/messages', { senderId: 'legacy-m1', text: '', createdAt: { __sv: true } }); check('envoyer un message vide', denied(r));
  r = await ac.query('chats/' + chatId + '/messages', [], [['createdAt', 'asc']]); check('lire les messages de sa conversation', allowed(r) && r.json.docs.length === 1);
  r = await ac.query('chats', [['participants', 'array-contains', 'legacy-m1']], [['updatedAt', 'desc']]); check('lister ses conversations', allowed(r) && r.json.docs.length === 1);
  r = await ac.query('chats', [['participants', 'array-contains', 'adm1']]); check('lister les conversations d\'un autre', denied(r));
  r = await ac.query('chats'); check('lister toutes les conversations', denied(r));
  r = await pd.query('chats/' + chatId + '/messages'); check('un tiers lit les messages', denied(r));
  r = await ac.set('chats/' + chatId, { participants: ['legacy-m1', 'pend1'] }, true); check('changer les participants', denied(r));
  r = await ac.set('chats/' + chatId, { lastReadBy: { 'legacy-m1': { __sv: true } } }, true); check('marquer comme lu (fusion de champs)', allowed(r));
  r = await ac.get('chats/' + chatId); check('la fusion conserve les participants', allowed(r) && r.json.data.participants.length === 2 && r.json.data.lastReadBy);

  console.log('\n=== NOUVELLE INSCRIPTION : validation obligatoire');
  const fresh = await mk(); const fe = `inscrit-${T}@test.local`;
  await fresh.post('auth/register', { email: fe, password: 'MotDePasse-123', displayName: 'Inscrit' });
  const fu = (await fresh.raw('GET', 'auth/me')).json.user.uid;
  r = await fresh.set('membres/' + fu, { nom: 'Inscrit', email: fe, statut: 'actif', role: 'membre' }); check('créer son profil avec statut "actif"', denied(r));
  r = await fresh.set('membres/' + fu, { nom: 'Inscrit', email: fe, statut: 'en_attente', role: 'membre', createdAt: { __sv: true } }); check('créer son profil avec statut "en_attente"', allowed(r));
  r = await fresh.set('membres/zz-autre-uid', { nom: 'x', statut: 'en_attente', role: 'membre' }); check('créer le profil d\'un AUTRE compte', denied(r));

  console.log('\n=== ADMINISTRATEUR');
  const ad = await mk(); await ad.login('admin@test.local', 'AdminPass-123');
  r = await ad.query('membres', [], [['createdAt', 'desc']]); check('lister les membres, du plus récent', allowed(r) && r.json.docs.length >= 3);
  r = await ad.query('membres', [['email', '==', 'Ancien@Test.local']], [], 1); check('retrouver un membre par e-mail (insensible à la casse)', allowed(r) && r.json.docs.length === 1 && r.json.docs[0].id === 'legacy-m1');
  r = await ad.query('membres', [['statut', '==', 'en_attente']]); check('filtrer les membres en attente', allowed(r) && r.json.docs.every(d => d.data.statut === 'en_attente') && r.json.docs.length >= 1);
  r = await ad.set('membres/pend1', { statut: 'actif' }, true); check('valider un membre en attente', allowed(r));
  r = await pd.query('membres'); check('le membre validé peut maintenant lister les membres', allowed(r));
  r = await ad.set('annuaire/pend1', { nom: 'Membre Attente' }); check('écrire dans l\'annuaire', allowed(r));
  r = await ad.query('actualites', [], [['publishedAt', 'desc']]); check('lire tous les articles, brouillons compris', allowed(r) && r.json.docs.length === 4);
  r = await ad.set('actualites/a5', { titre: 'Nouveau', publie: true, publishedAt: { __sv: true } }); check('publier un article', allowed(r));
  r = await ad.set('actualites/a5', { titre: 'Nouveau (modifié)' }, true); check('modifier (fusion) un article', allowed(r));
  r = await ad.get('actualites/a5'); check('la fusion conserve les autres champs', r.json.data.publie === true && r.json.data.titre.includes('modifié') && r.json.data.publishedAt && r.json.data.publishedAt.__ts > 0);
  r = await ad.query('newsletter'); check('lire les abonnés à la newsletter', allowed(r) && r.json.docs.length >= 1);
  r = await ad.query('contacts'); check('lire les messages de contact', allowed(r) && r.json.docs.length >= 1);
  r = await ad.post('db/batch', { ops: [{ type: 'set', path: 'partenaires/b1', data: { nom: 'Lot 1', createdAt: { __sv: true } } }, { type: 'set', path: 'partenaires/b2', data: { nom: 'Lot 2', createdAt: { __sv: true } } }] }); check('écriture groupée (lot)', allowed(r));
  r = await ad.post('db/batch', { ops: [{ type: 'set', path: 'partenaires/b3', data: { nom: 'Lot 3' } }, { type: 'inconnue', path: 'partenaires/b4' }] });
  const b3 = await ad.get('partenaires/b3'); check('lot annulé en bloc si une opération est invalide (aucune écriture partielle)', r.status === 400 && b3.json.exists === false);
  r = await ad.del('partenaires/b1'); check('supprimer un partenaire', allowed(r));
  r = await ad.del('membres/' + uidNew); check('supprimer un profil membre', allowed(r));
  r = await ad.add('ACTION_LOG', { action: 'test', timestamp: { __sv: true } }); check('écrire dans le journal d\'audit', allowed(r));
  r = await ad.set('ACTION_LOG/x', { a: 1 }); const r2 = await ad.set('ACTION_LOG/x', { a: 2 }); check('le journal d\'audit n\'est pas modifiable', denied(r2));
  r = await ad.set('inconnue/doc', { a: 1 }); check('collection inconnue : refusée même pour un administrateur', denied(r));
  r = await ad.query('chats'); check('même un administrateur ne lit pas toutes les conversations privées', denied(r));

  console.log(`\nRÉSULTAT : ${ok} contrôles conformes, ${ko} non conformes.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('ERREUR', e); process.exit(2); });
