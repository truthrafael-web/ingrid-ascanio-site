# Ingrid Ascanio · Miami Mortgage — Website

Bilingual (EN/ES) static site for Ingrid Ascanio, Pioneer Mortgage Funding.
30 pages (incl. Privacy Policy + Terms & Conditions, EN/ES), no framework,
GoHighLevel-ready. Built 2026-07-17 by MPower; live on https://miamipmf.com.

## Structure

```
Website/
├── build.mjs            # the builder: content JSON → dist/ HTML (node build.mjs)
├── src/
│   ├── content/en/*.json  ← ALL English copy lives here (edit → rebuild)
│   ├── content/es/*.json  ← ALL Spanish copy lives here
│   ├── css/site.css       # the one stylesheet
│   └── js/main.js         # interactions + GHL wiring
│   └── js/ghl-config.js   # ★ THE integration file (see below)
├── assets/              # fonts (self-hosted), images, favicon
└── dist/                # generated site — deploy THIS folder
```

Pages: `/` `/buy/` `/refinance/` `/loan-options/` + 7 program pages `/about/`
`/upload-documents/` `/contact/` `/privacy/` `/terms/` — and the full Spanish
mirror under `/es/…` (translated URLs, hreflang-linked, language switcher in the
top bar). Legal-page content lives in `src/content/{en,es}/legal.json`, rendered
by `renderLegal()`; footer links to them site-wide.

## Editing content

Change any text in `src/content/{en,es}/*.json`, then run `node build.mjs`.
Never edit `dist/` by hand — it's overwritten on every build.

## GHL integration — ONE file: `src/js/ghl-config.js`

Every CRM link plugs in there (then rebuild + redeploy):

| Field | What Ingrid provides | What it activates |
|---|---|---|
| `webhookUrl` | Inbound Webhook URL from a GHL workflow | Contact form and upload form POST JSON to it |
| `formUrl` | GHL form link | All "Start your pre-approval" buttons |
| `calendarUrl` | GHL calendar link | All "Book a call" buttons |
| `uploadFormEmbedUrl` | GHL form (with file-upload field) embed URL | Replaces the link-based upload form with true file upload |
| `ga4Id` / `gtmId` / `metaPixelId` | Tracking IDs | GA4 / Tag Manager / Meta Pixel on every page |

**Status (2026-07-20): `webhookUrl` is SET and live** — contact/upload
forms POST every submission to the GHL inbound webhook (verified: real live form
fill → HTTP 200 + success message). ⚠️ **But a submission only becomes a CRM
contact if the GHL inbound-webhook *workflow* creates/updates a contact from the
payload AND is published.** As of launch, the webhook returns 200 but no contact
was created (her workflows are still draft) — that's a GHL-side workflow fix, not
a website fix.

**Fallbacks until the other links are provided (working today):** CTA buttons route
to the contact form; if `webhookUrl` were ever cleared, submissions open a
pre-filled email to Ingrid so no lead is dropped. Webhook payloads include `type`
(contact / document-upload), `page`, `language`, and all form fields.

## Roxy — the corner widget · REBUILT 2026-08-21

Bottom-right on every page. **Roxy is a menu, not a chat.** She carries **five actions and
nothing else** — Rafael's instruction: "three to five extremely prominent things that customers
need to know", no AI agent. There is no message box anywhere in the widget (a scripted check
asserts `panel.querySelector('input, textarea')` is null on every page).

The five, in order, each with a one-line explanation of what actually happens:

| Action | Goes to | Why it's separate |
|---|---|---|
| Book a call with Ingrid | `GHL.calendarUrl`, new tab | the visitor picks the time |
| Have Ingrid call you | `/contact/#contact-form` | Ingrid picks the time |
| Call or text Ingrid now | `tel:` from `person.phoneHref` | no waiting at all |
| See the loan options | `/loan-options/` | what she can do |
| Who Ingrid is | `/about/` | who she is |

The three "reach her" rows look redundant and are not: they are the three different ways a
person is willing to start a conversation, and the subtitle on each says which one they're
choosing. The phone row prints the real number so a desktop visitor can read it without a
`tel:` handler.

**History.** The original "Roxy" (2026-07-17) was a hand-coded messenger with an AI-assistant
persona and a fake message box; it was removed 2026-07-23 (`d29589a`) because nothing answered
it. Its replacement, a neutral **"Quick Help"** launcher with a `?` icon, a search box and a
Questions tab (`eafa3f7`), shipped the same day. This pass restores the **name and the face**
Ingrid asked for while keeping the no-AI ruling: `quickhelp` → `roxy` in both `global.json`
files, `qh-` → `roxy-` across `site.css` and `main.js`, the search box dropped (real keyword
search over 8 items is machinery nobody needs), and the two-tab bar replaced by one quiet
**"Common questions"** link in the panel footer. **The 8 curated FAQs are carried over byte-identical
in EN and ES** and still deep-link to the matching page; they are now a second layer rather than
half the widget.

Roxy has **no photo**. She is not Ingrid and is not a real person, so she gets a gold monogram
`R` in the site's serif rather than a face a visitor could mistake for staff.

**Content:** `roxy` block in `src/content/{en,es}/global.json`. The phone subtitle interpolates
`{phone}` from `person.phone` at render time, so the number still lives in exactly one place
(see "Phone number" below). **Build payload:** `build.mjs` ships `roxy`, `phone` and `phoneHref`
into `window.SITE_I18N`.

**The attention bubble (added 2026-08-21, Rafael's instruction).** A navy speech bubble rises from
the pill **4 seconds after every page load and again every 5 minutes**, auto-hiding after 10 seconds:
"Hey, it's Roxy. / Ingrid's assistant. Open me for the fastest ways to reach her." Clicking anywhere
on it opens the panel; the `×` closes just that appearance and the 5-minute beat continues. The pill
pulses gold three times while it is up. Interval lives in content as `roxy.teaser.everyMinutes`.

⚠️ **The booking nudge now yields the corner.** `.nudge` (the 16-second "Book a 15-minute call" pop-up)
is fixed to the same bottom-right slot and stays until dismissed, so the first version of this guard
deferred Roxy's bubble forever, which a scripted clock test caught. On each beat Roxy now **retires the
booking nudge** (removes `.show`, sets the `nudged` session flag) and takes the corner. Nothing is lost:
its single CTA is Roxy's first row. Roxy's bubble is in turn suppressed entirely while the panel is open.

**Verified 2026-08-21** by scripted browser run over EN home / contact / about and ES home /
contacto: launcher opens, five cards present, every `href` resolves (no `#`), no message box,
FAQ layer opens, an article renders, both back steps work, zero console errors. Rendered and
looked at on 1440px desktop and a 390px phone in Spanish (the longer language) — all five
actions fit without scrolling.

## Newsletter signup — REMOVED 2026-07-25 · LIVE 2026-07-26 (`57a9ab4`)

The footer's fourth column was an email-capture form ("South Florida market notes").
Removed at Rafael's direction — same reasoning as the chat widget: no one is writing
or sending that newsletter, so a subscribe box promised something that doesn't exist.
Its form, JS wiring (`data-ghl-newsletter`), CSS (`.news-form`/`.footer-news`) and the
`newsletter` content block in both `global.json` files are gone; the webhook no longer
receives a `newsletter` payload type.

The column is now **"Get started"** — the slot the content model always anticipated
(`footer.getStartedTitle` existed in EN + ES but rendered nowhere). It carries the site's
three real conversion paths, reusing the existing `cta.*` strings so wording never drifts
from the rest of the site: pre-approval → `formUrl`, book a call → `calendarUrl`, and the
callback form. Both action links carry the contact page as their literal `href`, so they
still work with JavaScript disabled; `main.js` swaps in the GHL URL when one is set. A
fourth link switches language, pointing at the current page's `altPath` (not the home
page), so it holds your place.

Also moved in the same pass: the long "Serving Miami, Hollywood…" service-area line went
from the tail of the brand column to a **full-width band** under the columns. In column 1
it made that column run roughly double the height of the other three and left the right
half of the footer visibly empty once the newsletter form was gone.

## Direct file upload

`/upload-documents/` accepts real file attachments (drag-drop, 20 MB total).
Files go to `/api/upload` (a Vercel serverless function) → stored in Vercel Blob →
links forwarded as JSON to the GHL webhook. One-time setup in the Vercel dashboard:

1. Storage → Create → **Blob** (auto-sets `BLOB_READ_WRITE_TOKEN`)
2. Settings → Environment Variables → `GHL_WEBHOOK_URL` = Ingrid's inbound webhook

Until that's done (or on any non-Vercel host) the form falls back gracefully:
metadata + share-link go through the client-side webhook/email path instead.

## Tests

`_tests/roxy-and-consent.mjs` checks Roxy's attention bubble and the contact-form consent gate in a
real browser. The bubble runs on a **mocked clock**, so the 5-minute beat is verified in milliseconds
instead of waited out, and the webhook is intercepted, so running it **never posts to Ingrid's real
GHL**. It is what caught the bubble/booking-nudge corner collision on 2026-08-21.

```
node build.mjs && (cd dist && python3 -m http.server 8899 &)
cd "<repo root>/Automations/reference-scanner"          # the folder that has playwright installed
node "<this folder>/_tests/roxy-and-consent.mjs"
# against a protected preview:
BASE=https://<preview>.vercel.app SHARE='?_vercel_share=...' node "<...>/_tests/roxy-and-consent.mjs"
```

Nothing here is served: `_tests/` sits outside `dist/`.

## Deploy

Deploy the **`Website/` folder as the project root** on Vercel (needed so the
`/api` function ships): `npx vercel` from this folder, or import via dashboard.
`vercel.json` already sets the build (`node build.mjs`) and output (`dist`).
Plain-static hosts work too — everything except direct file upload degrades cleanly.

## Em dashes removed sitewide · 2026-08-20 · LIVE (`1d0fd97`)

Rafael's instruction: no em dashes (`—`) anywhere on the site. **1,120 served
occurrences went to 0** across all 31 built pages, EN and ES. Verified on the live
domain after deploy: all 30 sitemap URLs plus the 404 page, `site.css`, `main.js`
and `ghl-config.js` return zero.

Method: 281 em dashes in `src/content/**/*.json` across 253 strings, each rewritten
by hand-chosen punctuation rather than a blanket find-replace (a bare deletion leaves
broken sentences). Choice per site: period where the clause stands alone, colon where
it introduces a list, comma for a light aside, parentheses for a bracketed aside, and
`·` for title/label separators (the separator this site already used elsewhere).

**Only punctuation moved.** A word-level diff of every page against a pristine
pre-change build shows 28 of 31 pages with *zero* word changes and three deliberate
additions, all grammar-forced by turning a dash into a sentence break:
`2016 — today` → `2016 to today`, `2016 — hoy` → `2016 a hoy`, and
`— ofertas FHA cierran` → `. Las ofertas FHA cierran` (Spanish needs the article).

Four non-content spots also fed dashes to the page and were changed:
`.know-list li::before` in `site.css` (the gold dash bullet on "what to know" lists,
now an en dash `–` so the design is unchanged), two JSON-LD `name` template literals in
`build.mjs`, and one upload-fallback string in `main.js` that posts to the CRM.
Comments inside the three files a browser downloads (`site.css`, `main.js`,
`ghl-config.js`) were cleaned too. **21 em dashes remain in `build.mjs` and
`api/upload.mjs`** — both are code comments in files never served to a visitor.

Deliberately untouched: en dashes in ranges (`24–48 hours`, `2025–2026`) are not em
dashes; Pioneer's `footer.equalHousing` disclaimer (930 chars, verified byte-identical,
contained none); and every NMLS title string.

Two strings here are compliance-adjacent and changed by **punctuation only, words
byte-identical**: `footer.brokerLine` ("Mortgage broker only. Not a mortgage lender…")
and the Privacy SMS-consent paragraph (`legal.json` `privacy.blocks[58]`).

**Shipped in the same commit — one NMLS title miss.** The homepage meta description
still read "Ingrid Ascanio, licensed **loan originator**", the only title left on the
site outside Lauren Brownell's permitted set (2026-08-19 above); it survived that pass
because it is invisible on the page. Now "licensed Mortgage Loan Originator", which
fixes it in four places at once: `meta description`, `og:description`,
`twitter:description` and the JSON-LD. The ES homepage already read correctly.

Still deliberately as-is: the two "loan officers" in the EN/ES About hero
("Most loan officers learned lending from the sales side" / "La mayoría de los
oficiales de préstamo…"). That is the profession in general, not Ingrid's title, so
the compliance instruction does not reach it — the same call recorded 2026-08-19.

## Pioneer compliance changes — 2026-08-19 · LIVE (`857775c`)

Three changes PMF compliance (Lauren Brownell, admin coordinator) required before
approving the site. Her email of 2026-08-17 is the spec; Rafael's instruction was
to follow it to the letter, so nothing beyond it was touched.

1. **Titles must match NMLS.** "Loan Officer" is not a permitted title — only
   "Branch Manager" or "Mortgage Loan Originator". Now **"Branch Manager &
   Mortgage Loan Originator"** everywhere it describes Ingrid. She flagged three
   visible spots; it was in 24, most of them invisible on the page: `person.title`
   in `global.json` (header, hero card, schema `jobTitle`), `home.json` `withLabel`
   and `imageAlt`, the About eyebrow, the Road Here current role, both `legal.json`
   files (Privacy + Terms), `seo.bio`, `portraitAlt`, `occupationName`, and every
   Spanish meta title. **Spanish keeps the English title** — it is the title of
   record in NMLS, and the site already left "Branch Manager" untranslated.
2. **Footer** — dropped `Inc.` from the company name and removed the multi-state
   licensing sentence (`footer.legalLine`, EN + ES). `footer.equalHousing` now
   carries **Pioneer's own supplied disclaimer, byte-identical to her email** —
   extracted from the `.eml` programmatically rather than retyped. That text
   contains a broken sentence ("Specified rates may not be available for all
   borrowers. interest rates, and program guidelines, and are subject to change")
   which is **deliberately preserved**; fix it at Pioneer's end, not here. The ES
   footer carries it in English on purpose — a self-translated compliance
   disclaimer would be an unreviewed second version.
3. **Road Here** — removed the company names beside former positions. Without
   employment dates a reader could take them as current employers. Reordered
   resume-style, most recent first, Pioneer at the top as she asked. Pioneer stays
   named; it is the current employer.

Two "loan officers" survive, in the EN and ES About hero body ("Most loan officers
learned lending from the sales side"). That is the profession in general, not her
title, so her instruction does not reach it. Rafael was shown this and left it.

Side effect worth knowing: the Road Here section had been listing **"Globex
Lending"** and **"Legal Save"** as former employers. Those read as placeholder
names rather than real companies. Change 3 deleted them, but her actual work
history has never been sourced — do not reintroduce company names without it.

## Contact form — SMS CONSENT NOW REQUIRED 2026-08-21

`consent_sms` carries `required`. The form will not submit without it, so **every lead that reaches
GHL is textable**. Unticked, Submit is blocked and the status line reads "Please check the consent box
below, then send your message again." (ES: "Por favor marca la casilla…"), on top of the browser's own
bubble on the box. Copy lives in `form.consent` in both `global.json` files, rendered as `data-consent`
on `.form-status`.

⚠️ **`consent_marketing` stays OPTIONAL and unchecked, and must never get `required`.** Rafael asked for
both boxes to be mandatory; he was shown that mandatory *marketing* consent is not valid express consent,
is the pattern an A2P reviewer looks for, and carries TCPA damages of $500 to $1,500 per text, and he
chose the SMS-only gate (2026-08-21). This is a deliberate partial reversal of `3750397`, which had
removed `required` from both. The reasoning is repeated as a comment above `renderContact()` in
`build.mjs` so the next person to touch it sees it before the code.

Neither box is pre-checked. Checkbox state still posts as explicit `"yes"` / `"no"`.

## Contact form — RESTRUCTURED 2026-08-05 · LIVE (`0193935`)

Rebuilt to the carrier consent layout required for SMS (A2P) registration:
First name / Last name split, then Phone, Email, "What brings you here?" and the
details textarea — **all required except Last name** — then two consent
checkboxes and a Privacy Policy | Terms link row under Submit. EN and ES.

Two things here are deliberate, not oversights:

- **Neither box is pre-checked, and the marketing box is optional.** This reverses
  the 2026-07-23 pre-checked default (`2cc8c4a`). A pre-checked or mandatory
  marketing consent is not valid express written consent, and a registration
  reviewer looking at this form would see that.
- **`main.js` still sends `name`.** The form collects `first_name` / `last_name`,
  but her GHL workflow maps First name from `{{inboundWebhookRequest.name}}`.
  `collect()` joins first + last back into `name` alongside the new keys —
  drop that and contact creation stops silently. Checkbox state is written as
  explicit `"yes"` / `"no"` so an unchecked box records as a refusal rather than
  as a question never asked.

New webhook keys available to map into GHL custom fields: `first_name`,
`last_name`, `consent_sms`, `consent_marketing`.

## Phone number — CHANGED 2026-07-27 · LIVE (`0014de4`)

Sitewide number is **(786) 250-0922** (was `(786) 554-8830`). Rafael's direction.
It lives in three formats and all three must move together:

- `src/content/{en,es}/global.json` — `phone` (display), `phoneHref` (`tel:`), form-error copy
- `src/content/{en,es}/legal.json` — SMS opt-out, Privacy contact, Terms contact
- `build.mjs` — 4 structured-data `telephone`/`servicePhone` fields (hardcoded, not read
  from content; easy to miss)
- `src/js/main.js` — `data-fallback="phone"` href

The `(305) 555-0100` on the contact/upload forms is **not** a listed number — it's the
placeholder in the visitor's own Phone field. Leave it.

Still open: her **GHL sub-account** carries the old number, so CRM-sent SMS/email can
disagree with the site. Not touched here.

## ⚠️ Facts to confirm with Ingrid before the real domain goes live

- **NMLS # 1936558** — taken from Pioneer's own billboard artwork. The old demo
  showed a different number and ZoomInfo shows a third. Confirm hers, fix in
  `src/content/{en,es}/global.json`, rebuild.
- **Office address** (2020 Hollywood Blvd, Suite #22) — from the old demo; confirm.
- `SITE_URL` in `build.mjs` — set to the final domain for correct SEO tags/sitemap.
