/*
 * no-crm-connection.mjs
 *
 * Guards the 2026-09-09 severance: this site must never again talk to a CRM.
 * Walks every URL in the sitemap in a real browser and fails if ANY page shows
 *   - a non-empty window.GHL.webhookUrl or calendarUrl
 *   - a leadconnector / gohighlevel / msgsndr URL in the DOM
 *   - a network request to one of those hosts
 *   - a data-ghl button left dead (href "#" or empty) after main.js runs
 *   - a tel: link that is not Ingrid's own +17865548830
 *   - a console error, or a message box inside Roxy
 *
 * It is a RENDERED check on purpose: main.js rewrites hrefs at runtime, so a
 * source-file grep passes while the live page is still wired to the CRM.
 *
 * Run:
 *   node build.mjs && (cd dist && python3 -m http.server 8899 &)
 *   cd "<repo root>/Automations/reference-scanner"     # the folder with playwright
 *   DIST="<this repo>/dist" BASE=http://localhost:8899 node "<this folder>/_tests/no-crm-connection.mjs"
 *
 * Negative-tested 2026-09-09: restoring the old webhook and calendar URLs makes
 * it fail on all 30 pages, so a PASS is evidence rather than decoration.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const BASE = process.env.BASE || 'http://localhost:8899';
const DIST = process.env.DIST;

// Every built page, from the sitemap.
const sm = readFileSync(`${DIST}/sitemap.xml`, 'utf8');
const paths = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(m => new URL(m[1]).pathname);

const CRM = /leadconnector|gohighlevel|highlevel|msgsndr/i;
const GHLNUM = /2500922|250-0922/;

let fail = [], checked = 0;
const browser = await chromium.launch();

for (const p of paths) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const crmHits = [], errs = [];
  page.on('request', r => { if (CRM.test(r.url())) crmHits.push(r.url()); });
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));

  await page.goto(BASE + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const out = { dead: [], crmHref: [], tels: new Set(), roxyBook: null, cfg: null, roxyRows: 0 };
    out.cfg = JSON.parse(JSON.stringify(window.GHL || {}));
    document.querySelectorAll('[data-ghl]').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (h === '' || h === '#') out.dead.push((a.textContent || '').trim().slice(0, 40));
      if (/leadconnector|gohighlevel|msgsndr/i.test(h)) out.crmHref.push(h);
    });
    document.querySelectorAll('a[href^="tel:"]').forEach(a => out.tels.add(a.getAttribute('href')));
    document.querySelectorAll('a[href],iframe[src],script[src],link[href]').forEach(el => {
      const v = el.getAttribute('href') || el.getAttribute('src') || '';
      if (/leadconnector|gohighlevel|msgsndr/i.test(v)) out.crmHref.push(v);
    });
    out.tels = [...out.tels];
    return out;
  });

  // Open Roxy and inspect its rows after JS builds them.
  let roxy = { rows: 0, dead: [], bookHref: null };
  const btn = await page.$('.roxy-btn');
  if (btn) {
    await btn.click();
    await page.waitForTimeout(250);
    roxy = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.roxy-panel a[href]')];
      const rows = links.filter(a => a.className.includes('roxy-row') || a.closest('.roxy-list'));
      const use = rows.length ? rows : links;
      return {
        rows: use.length,
        dead: use.filter(a => { const h = a.getAttribute('href'); return !h || h === '#'; })
                 .map(a => (a.textContent || '').trim().slice(0, 40)),
        bookHref: use.length ? use[0].getAttribute('href') : null,
        msgBox: !!document.querySelector('.roxy-panel input, .roxy-panel textarea'),
      };
    });
  }

  const bad = [];
  if (r.cfg.webhookUrl) bad.push(`GHL.webhookUrl still set: ${r.cfg.webhookUrl}`);
  if (r.cfg.calendarUrl) bad.push(`GHL.calendarUrl still set: ${r.cfg.calendarUrl}`);
  if (r.dead.length) bad.push(`dead data-ghl href (#): ${JSON.stringify(r.dead)}`);
  if (r.crmHref.length) bad.push(`CRM url in DOM: ${JSON.stringify(r.crmHref)}`);
  if (crmHits.length) bad.push(`network request to CRM: ${JSON.stringify(crmHits)}`);
  const badTel = r.tels.filter(t => t !== 'tel:+17865548830');
  if (badTel.length) bad.push(`wrong tel: ${JSON.stringify(badTel)}`);
  if (roxy.dead.length) bad.push(`dead Roxy row: ${JSON.stringify(roxy.dead)}`);
  if (roxy.msgBox) bad.push('Roxy has a message box (must not)');
  if (errs.length) bad.push(`console errors: ${JSON.stringify(errs.slice(0, 2))}`);

  checked++;
  if (bad.length) fail.push({ page: p, bad });
  else process.stdout.write('.');
  await ctx.close();
}

console.log(`\n\nPages checked: ${checked}`);
if (fail.length) {
  console.log(`FAILURES on ${fail.length} page(s):`);
  for (const f of fail) { console.log(` ${f.page}`); f.bad.forEach(b => console.log(`    - ${b}`)); }
} else {
  console.log('PASS: no CRM config, no CRM url, no CRM network call, no dead CTA, no wrong tel:, no console error.');
}
await browser.close();
process.exit(fail.length ? 1 : 0);
