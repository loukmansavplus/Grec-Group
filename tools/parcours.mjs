// Parcours complets dans un vrai navigateur : visiteur, inscription, validation par l'admin, connexion, mot de passe oublié, messagerie.
// À lancer sur le site LOCAL de test (base locale) : php -S localhost:8099 -t . api/tests/dev-router.php
//   BASE=http://localhost:8099 ADMIN_EMAIL=... ADMIN_PW=... M1_EMAIL=... M2_EMAIL=... MEMBER_PW=... node tools/parcours.mjs
// Installation : npm install --no-save puppeteer-core
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const BASE = (process.env.BASE || 'http://localhost:8099').replace(/\/$/, '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { ADMIN_EMAIL, ADMIN_PW, M1_EMAIL, M2_EMAIL, MEMBER_PW } = process.env;
const MAILLOG = new URL('../api/mail.log', import.meta.url);
const T = Date.now(), NEW_EMAIL = `parcours-${T}@example.invalid`, NEW_PW = 'Parcours-Test-2026!', NEW_PW2 = 'Nouveau-Mdp-2026!';
const url = (p) => BASE + (p.startsWith('/pages/') && !p.endsWith('.html') ? p + '.html' : p);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0;
const check = (label, cond, detail = '') => { cond ? ok++ : ko++; console.log((cond ? 'OK   ' : 'ÉCHEC') + '  ' + label + (cond || !detail ? '' : '   <-- ' + detail)); };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
async function actor() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.on('dialog', (d) => d.accept());
  return page;
}
async function login(page, email, pw) {
  await page.goto(url('/pages/auth'), { waitUntil: 'networkidle2' });
  await page.type('#login-email', email); await page.type('#login-password', pw);
  await page.evaluate(() => document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
  await sleep(3500);
}
const toast = (page) => page.evaluate(() => (document.querySelector('.toast')?.innerText || '').replace(/\n/g, ' '));
const connected = (page) => page.evaluate(() => !!(window.firebase && firebase.auth().currentUser)).catch(() => false);

try {
  console.log('\n=== VISITEUR');
  const v = await actor();
  await v.goto(url('/'), { waitUntil: 'networkidle2' }); await sleep(2500);
  check('accueil : 4 articles issus de la base', (await v.evaluate(() => document.querySelectorAll('#articles-grid article, #articles-grid > *').length)) === 4);
  check('le site utilise bien l\'API OVH (pas Firebase)', await v.evaluate(() => window.firebase && window.firebase.backend === 'ovh'));
  await v.goto(url('/pages/actualites'), { waitUntil: 'networkidle2' }); await sleep(3000);
  check('actualités : 6 articles sur la page 1 (7 au total, pagination)', (await v.evaluate(() => document.querySelectorAll('#articles-container article').length)) === 6);
  await v.goto(url('/pages/membres'), { waitUntil: 'networkidle2' }); await sleep(3000);
  const mem = await v.evaluate(() => ({ n: document.getElementById('hero-member-count')?.innerText, priv: /@|\+\d{6,}/.test(document.getElementById('membres-grid').innerText) }));
  check('annuaire public : 24 membres, sans e-mail ni téléphone', mem.n === '24' && !mem.priv, JSON.stringify(mem));
  await v.goto(url('/'), { waitUntil: 'networkidle2' });
  await v.evaluate(() => { const i = document.getElementById('newsletter-email'); i.value = 'abonne-' + Date.now() + '@example.invalid'; });
  await v.evaluate(() => document.getElementById('newsletter-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
  await sleep(2500);
  check('inscription à la newsletter', /Abonnement confirmé/.test(await toast(v)), await toast(v));

  console.log('\n=== INSCRIPTION, VALIDATION, CONNEXION');
  const r = await actor();
  await r.goto(url('/pages/register'), { waitUntil: 'networkidle2' });
  await r.type('#reg-prenom', 'Parcours'); await r.type('#reg-nom', 'Test'); await r.type('#reg-email', NEW_EMAIL); await r.type('#reg-phone', '+22900000000');
  await r.select('#reg-pays', 'Bénin'); await r.select('#reg-sector', 'Coaching');
  await r.type('#reg-password', NEW_PW); await r.type('#reg-confirm', NEW_PW);
  await r.evaluate(() => { document.getElementById('reg-ethics').checked = true; });
  await r.evaluate(() => document.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
  await sleep(4500);
  check('inscription : message « demande envoyée »', /demande d'inscription a bien été envoyée/.test(await toast(r)), await toast(r));
  check('inscription : déconnecté aussitôt (en attente de validation)', !(await connected(r)));
  const r2 = await actor();
  await login(r2, NEW_EMAIL, NEW_PW);
  const err = await r2.evaluate(() => document.getElementById('login-email-err')?.innerText || '');
  check('connexion refusée tant que le compte n\'est pas validé', /en attente de validation/.test(err) && !(await connected(r2)), err);

  const a = await actor();
  await login(a, ADMIN_EMAIL, ADMIN_PW);
  await a.goto(url('/admin/'), { waitUntil: 'networkidle2' }); await sleep(4000);
  const dash = await a.evaluate(() => ({ stats: [...document.querySelectorAll('[id^="stat-"]')].map((e) => e.id.replace('stat-', '') + '=' + e.innerText.trim()).join(' '), valider: [...document.querySelectorAll('#member-list [data-action="toggle-member"]')].filter((b) => b.innerText.trim() === 'Valider').length }));
  check('tableau de bord : 78 membres dont 52 en attente (51 anciens + le nouvel inscrit)', /membres=78/.test(dash.stats) && dash.valider === 52, JSON.stringify(dash));
  const clicked = await a.evaluate(() => { const row = [...document.querySelectorAll('#member-list tr')].find((tr) => /Parcours Test/.test(tr.innerText)); if (!row) return false; row.querySelector('[data-action="toggle-member"]').click(); return true; });
  await sleep(3000);
  check('tableau de bord : validation du nouvel inscrit (bouton « Valider »)', clicked && /Membre validé/.test(await toast(a)), await toast(a));
  await v.goto(url('/pages/membres'), { waitUntil: 'networkidle2' }); await sleep(2500);
  check('l\'annuaire public affiche maintenant 25 membres', (await v.evaluate(() => document.getElementById('hero-member-count')?.innerText)) === '25');
  const r3 = await actor();
  await login(r3, NEW_EMAIL, NEW_PW);
  check('connexion réussie après validation', await connected(r3) && /index/.test(r3.url()), r3.url());

  console.log('\n=== MOT DE PASSE OUBLIÉ');
  fs.writeFileSync(MAILLOG, '');
  const f = await actor();
  await f.goto(url('/pages/auth'), { waitUntil: 'networkidle2' });
  await f.type('#login-email', NEW_EMAIL);
  await f.evaluate(() => showForgot());
  await sleep(3000);
  check('demande de lien envoyée', /envoyé/.test(await toast(f)), await toast(f));
  const mail = fs.readFileSync(MAILLOG, 'utf8');
  const tok = (mail.match(/reset-password\.html\?token=([0-9a-f]{64})/) || [])[1];
  check('e-mail de réinitialisation contenant le lien', !!tok && mail.includes('TO: ' + NEW_EMAIL));
  await f.goto(url('/pages/reset-password') + '?token=' + tok, { waitUntil: 'networkidle2' });
  await f.type('#new-password', NEW_PW2); await f.type('#new-confirm', NEW_PW2);
  await f.evaluate(() => document.getElementById('reset-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
  await sleep(3500);
  check('nouveau mot de passe enregistré (page dédiée)', /Mot de passe modifié|auth/.test((await toast(f)) + f.url()), await toast(f));
  const r4 = await actor();
  await login(r4, NEW_EMAIL, NEW_PW2);
  check('connexion avec le nouveau mot de passe', await connected(r4));
  const r5 = await actor();
  await login(r5, NEW_EMAIL, NEW_PW);
  check('l\'ancien mot de passe est refusé', !(await connected(r5)));

  console.log('\n=== MESSAGERIE ENTRE DEUX MEMBRES');
  const c1 = await actor(), c2 = await actor();
  await login(c1, M1_EMAIL, MEMBER_PW); await login(c2, M2_EMAIL, MEMBER_PW);
  check('les deux membres se connectent (membres migrés, actifs)', (await connected(c1)) && (await connected(c2)));
  const uid2 = await c2.evaluate(() => firebase.auth().currentUser.uid);
  await c1.goto(url('/pages/chat'), { waitUntil: 'networkidle2' }); await sleep(3500);
  const found = await c1.evaluate((u) => { const b = document.querySelector(`.chat-user-item[data-uid="${u}"]`); if (!b) return false; b.click(); return true; }, uid2);
  check('le membre 1 retrouve le membre 2 dans la liste', found);
  await sleep(2500);
  const text = 'Bonjour depuis le test ' + T;
  await c1.type('#chat-message-input', text);
  await c1.click('#chat-send-btn'); await sleep(3000);
  check('le membre 1 voit son message', (await c1.evaluate(() => document.getElementById('chat-messages').innerText)).includes(text));
  await c2.goto(url('/pages/chat'), { waitUntil: 'networkidle2' }); await sleep(6000);
  const listTxt = await c2.evaluate(() => document.getElementById('chat-conversations-list').innerText);
  check('le membre 2 voit la conversation reçue', listTxt.trim().length > 0 && !/Aucune conversation/.test(listTxt), listTxt.slice(0, 80));
  await c2.evaluate(() => { const b = document.querySelector('.chat-conversation-item'); if (b) b.click(); });
  await sleep(5000);
  check('le membre 2 lit le message', (await c2.evaluate(() => document.getElementById('chat-messages').innerText)).includes(text));
  // temps réel (par interrogations) : réponse reçue sans recharger la page
  await c2.type('#chat-message-input', 'Réponse ' + T); await c2.click('#chat-send-btn');
  await sleep(9000);
  check('le membre 1 reçoit la réponse sans recharger la page (≤ 9 s)', (await c1.evaluate(() => document.getElementById('chat-messages').innerText)).includes('Réponse ' + T));
} finally {
  console.log(`\nRÉSULTAT : ${ok} contrôles conformes, ${ko} non conformes.`);
  await browser.close();
  process.exit(ko ? 1 : 0);
}
