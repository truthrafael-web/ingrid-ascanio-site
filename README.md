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

## Chat / message widget — REMOVED 2026-07-23

The former "Roxy" chat bubble (a hand-coded guided messenger with a fake message
box) was removed at Rafael's direction: no AI agent will be installed, so a
message feature with no real responder was misleading. All of its JS/CSS/content
and the `chatWidget*` config fields are gone; the bottom-right corner is now empty.
A non-chat replacement — quick links + a question→answer search that routes to
existing pages — is under consideration but **not yet built**.

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

## Deploy

Deploy the **`Website/` folder as the project root** on Vercel (needed so the
`/api` function ships): `npx vercel` from this folder, or import via dashboard.
`vercel.json` already sets the build (`node build.mjs`) and output (`dist`).
Plain-static hosts work too — everything except direct file upload degrades cleanly.

## Em dashes removed sitewide · 2026-08-20 · BUILT, NOT YET DEPLOYED

Rafael's instruction: no em dashes (`—`) anywhere on the site. **1,120 served
occurrences went to 0** across all 31 built pages, EN and ES.

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
