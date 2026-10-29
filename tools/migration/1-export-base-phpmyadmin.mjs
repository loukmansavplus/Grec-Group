// Export COMPLET (lecture seule) de l'ancienne base via phpMyAdmin OVH -> dossier local hors dépôt.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const BASE = 'https://phpmyadmin.cluster024.hosting.ovh.net/';
const DB = 'hconsuqgrec';
const OUT = 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const client = await page.createCDPSession();
await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT.replace(/\//g, '\\'), eventsEnabled: true });

await page.goto(`${BASE}?pma_username=${DB}&pma_servername=${DB}.mysql.db`, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#input_password', { timeout: 20000 });
await page.evaluate((u) => { const e = document.querySelector('#input_username'); if (e) e.value = u; }, process.env.PMAUSER);
await page.type('#input_password', process.env.PMAPW);
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }), page.click('#input_go')]);
if (await page.$('#input_password')) { console.log('Connexion refusée'); await browser.close(); process.exit(1); }
console.log('Connexion phpMyAdmin : OK');

const token = await page.evaluate(() => (document.querySelector('input[name="token"]') || {}).value || (window.CommonParams && CommonParams.get('token')) || '');
await page.goto(`${BASE}index.php?route=/database/export&db=${DB}&token=${encodeURIComponent(token)}`, { waitUntil: 'networkidle2', timeout: 60000 });
const before = new Set(fs.readdirSync(OUT));
await page.waitForSelector('#buttonGo', { timeout: 20000 });
await page.click('#buttonGo');
// attend l'apparition d'un fichier complet
let file = null;
for (let i = 0; i < 60 && !file; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  file = fs.readdirSync(OUT).find((f) => !before.has(f) && !f.endsWith('.crdownload'));
}
console.log(file ? 'Export reçu : ' + file + ' (' + Math.round(fs.statSync(OUT + '/' + file).size / 1024) + ' Ko)' : 'Aucun fichier reçu');
await browser.close();
