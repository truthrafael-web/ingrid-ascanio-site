/* Roxy's attention bubble + the contact-form consent gate, checked in a real browser.
 *
 *   node build.mjs && (cd dist && python3 -m http.server 8899 &)
 *   cd "<repo root>/Automations/reference-scanner" && node <path to this file>   # it has playwright
 *   BASE=https://<preview>.vercel.app SHARE='?_vercel_share=...' node <path to this file>
 *
 * The bubble runs on a MOCKED clock (page.clock), so the 5-minute beat is checked in
 * milliseconds rather than by waiting it out. The form's webhook is intercepted, so running
 * this never posts to Ingrid's real GHL. This suite caught the bubble/booking-nudge corner
 * collision on 2026-08-21. Keep it green.
 */
// playwright is resolved from the WORKING directory, not from this file, so the run-from-the
// scanner-folder invocation above works without installing anything into the site repo.
import { createRequire } from 'node:module';
const { chromium } = createRequire(process.cwd() + '/')('playwright');

const BASE = process.env.BASE || 'http://localhost:8899';
const SHARE = process.env.SHARE || '';   // ?_vercel_share=... when hitting a protected preview
const browser = await chromium.launch();
let fails = 0;
const fail = (m) => { console.log('  FAIL: ' + m); fails++; };

/* ---------- 1. the attention bubble ---------- */
for (const [name, url] of [['EN home', BASE + '/'], ['ES home', BASE + '/es/']]) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.clock.install();
  await page.goto(url + SHARE, { waitUntil: 'networkidle' });

  console.log('\n=== ' + name + ' · attention bubble ===');
  const tip = page.locator('.roxy-tip');
  if (await tip.count() === 0) { fail('no .roxy-tip in the DOM'); await page.close(); continue; }

  // before its 4s delay it must be hidden
  await page.clock.runFor(2000);
  if (await tip.evaluate(el => el.classList.contains('show'))) fail('bubble showed before the 4s delay');

  // ...and visible after
  await page.clock.runFor(3000);
  const shown = await tip.evaluate(el => el.classList.contains('show'));
  const text = (await tip.innerText()).replace(/\s+/g, ' ').trim();
  const pulsing = await page.locator('.roxy-btn').evaluate(el => el.classList.contains('nudging'));
  console.log('  first show at ~4s:', shown, '| pulse on pill:', pulsing);
  console.log('  copy:', JSON.stringify(text));
  if (!shown) fail('bubble did not appear on arrival');

  // auto-hides after ~10s
  await page.clock.runFor(11000);
  if (await tip.evaluate(el => el.classList.contains('show'))) fail('bubble never auto-hid');
  else console.log('  auto-hides after ~10s: true');

  // the booking nudge fires at 16s and squats in this same corner until dismissed
  const bookingUp = await page.locator('.nudge').evaluate(el => el.classList.contains('show')).catch(() => false);
  console.log('  booking nudge occupying the corner at this point:', bookingUp);

  // ...and the bubble still comes back on the 5-minute beat, taking the corner back.
  // land just PAST the beat (t=302s), not past its 10s auto-hide, or we'd miss the window.
  await page.clock.runFor(5 * 60 * 1000 - 16000 + 2000);
  const again = await tip.evaluate(el => el.classList.contains('show'));
  const bookingYielded = !(await page.locator('.nudge').evaluate(el => el.classList.contains('show')).catch(() => false));
  console.log('  returns at the 5-minute mark:', again, '| booking nudge yielded:', bookingYielded);
  if (!again) fail('bubble did not return after 5 minutes');
  if (!bookingYielded) fail('two pop-ups are stacked in the same corner');

  // clicking it opens Roxy
  await tip.click();
  const opened = await page.locator('.roxy-panel').evaluate(el => el.classList.contains('open'));
  const tipGone = !(await tip.evaluate(el => el.classList.contains('show')));
  console.log('  click opens Roxy:', opened, '| bubble steps aside:', tipGone);
  if (!opened || !tipGone) fail('click-to-open is broken');

  // and it must never sit on top of the open panel
  await page.clock.runFor(5 * 60 * 1000);
  const clash = await tip.evaluate(el => el.classList.contains('show'));
  if (clash) fail('bubble reappeared while the panel was open');
  else console.log('  suppressed while the panel is open: true');

  if (errs.length) fail('JS errors: ' + errs.join(' | '));
  await page.close();
}

/* ---------- 2. the contact form consent gate ---------- */
for (const [name, url] of [['EN contact', BASE + '/contact/'], ['ES contact', BASE + '/es/contacto/']]) {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  let posted = 0;
  await page.route('**/hooks/**', route => { posted++; route.fulfill({ status: 200, body: 'ok' }); });
  await page.goto(url + SHARE, { waitUntil: 'networkidle' });

  console.log('\n=== ' + name + ' · consent gate ===');
  const req = await page.evaluate(() => ({
    sms: document.querySelector('[name="consent_sms"]').required,
    smsChecked: document.querySelector('[name="consent_sms"]').checked,
    mkt: document.querySelector('[name="consent_marketing"]').required,
    mktChecked: document.querySelector('[name="consent_marketing"]').checked,
  }));
  console.log('  sms required:', req.sms, '(checked by default:', req.smsChecked + ')');
  console.log('  marketing required:', req.mkt, '(checked by default:', req.mktChecked + ')');
  if (!req.sms) fail('sms consent is not required');
  if (req.mkt) fail('marketing consent is required - that is the invalid-consent pattern');
  if (req.smsChecked || req.mktChecked) fail('a consent box ships pre-checked');

  // fill everything EXCEPT the consent box, then try to send
  await page.fill('[name="first_name"]', 'Test');
  await page.fill('[name="phone"]', '3055550100');
  await page.fill('[name="email"]', 'test@example.com');
  await page.selectOption('[name="interest"]', { index: 1 });
  await page.fill('[name="message"]', 'Checking the consent gate.');
  await page.click('#contact-form [type="submit"]');
  await page.waitForTimeout(400);

  const blockedMsg = (await page.locator('#contact-form .form-status').innerText()).trim();
  console.log('  submit with box unticked -> posted:', posted, '| message:', JSON.stringify(blockedMsg));
  if (posted !== 0) fail('form SENT without consent');
  if (!blockedMsg) fail('no error message shown to the visitor');

  // tick it and send again
  await page.check('[name="consent_sms"]');
  await page.click('#contact-form [type="submit"]');
  await page.waitForTimeout(800);
  console.log('  submit with box ticked  -> posted:', posted);
  if (posted !== 1) fail('form did not send after consent was given');

  // and marketing genuinely stays optional: that send just happened with it unticked
  const mktAtSend = await page.evaluate(() => document.querySelector('[name="consent_marketing"]').checked);
  console.log('  it sent with marketing left unticked:', !mktAtSend && posted === 1);
  if (mktAtSend) fail('marketing box got ticked somehow');

  if (errs.length) fail('JS errors: ' + errs.join(' | '));
  await page.close();
}

await browser.close();
console.log('\n' + (fails ? 'FAILURES: ' + fails : 'ALL CHECKS PASSED'));
process.exit(fails ? 1 : 0);
