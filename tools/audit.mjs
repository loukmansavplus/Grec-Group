// Contrôle automatique du site dans un vrai navigateur (Chrome headless) : erreurs JS, violations CSP,
// requêtes HTTP en échec, images cassées, débordement horizontal, projet Firebase utilisé.
//
// Installation (une fois, sans toucher à package.json) :   npm install --no-save puppeteer-core
// Usage :   node tools/audit.mjs                       (contrôle https://grec.group)
//           BASE=http://localhost:8000 node tools/audit.mjs   (site local : python -m http.server 8000)
// Variables : BASE (adresse du site), CHROME (chemin de chrome.exe si différent)
import puppeteer from 'puppeteer-core';

const BASE = (process.env.BASE || 'https://grec.group').replace(/\/$/, '');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = ['/', '/pages/about', '/pages/actualites', '/pages/membres', '/pages/partenaires',
  '/pages/auth', '/pages/register', '/pages/profil-public', '/pages/chat', '/admin/'];
const local = BASE.startsWith('http://localhost');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
let problems = 0;
for (const width of [1440, 390]) {
  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    const errors = [], failed = [];
    page.on('console', (m) => { if (m.type() === 'error' || /Content Security|Refused/i.test(m.text())) errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', (e) => errors.push('JS: ' + e.message.slice(0, 140)));
    page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) failed.push(r.status() + ' ' + r.url().replace(BASE, '')); });
    const url = BASE + (local ? p.replace(/^\/pages\/([a-z-]+)$/, '/pages/$1.html') : p);
    try { await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 }); } catch (e) { errors.push('NAVIGATION: ' + e.message.slice(0, 80)); }
    await new Promise((r) => setTimeout(r, 800));
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.getAttribute('src')).slice(0, 4),
      projet: typeof firebase !== 'undefined' && firebase.apps.length ? firebase.app().options.projectId : '-',
    })).catch(() => ({ overflow: 0, broken: [], projet: '?' }));
    const issues = [];
    if (info.overflow > 1) issues.push('débordement horizontal de ' + info.overflow + ' px');
    if (info.broken.length) issues.push('images cassées : ' + info.broken.join(', '));
    const errs = [...new Set(errors)].filter((x) => !/Listen\/channel/.test(x));
    if (errs.length) issues.push('erreurs : ' + errs.join(' | '));
    if (failed.length) issues.push('HTTP : ' + [...new Set(failed)].join(' | '));
    problems += issues.length;
    console.log(`[${width}] ${p.padEnd(22)} ${info.projet.padEnd(18)} ${issues.length ? '\n    - ' + issues.join('\n    - ') : 'OK'}`);
    await page.close();
  }
}
await browser.close();
console.log(problems ? `\n${problems} problème(s) détecté(s).` : '\nAucun problème détecté.');
process.exit(problems ? 1 : 0);
