# Ingrid Ascanio · Miami Mortgage — Website

Bilingual (EN/ES) static site for Ingrid Ascanio, Pioneer Mortgage Funding.
28 pages, no framework, GoHighLevel-ready. Built 2026-07-17 by MPower.

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
`/upload-documents/` `/contact/` — and the full Spanish mirror under `/es/…`
(translated URLs, hreflang-linked, language switcher in the top bar).

## Editing content

Change any text in `src/content/{en,es}/*.json`, then run `node build.mjs`.
Never edit `dist/` by hand — it's overwritten on every build.

## GHL integration — ONE file: `src/js/ghl-config.js`

Every CRM link plugs in there (then rebuild + redeploy):

| Field | What Ingrid provides | What it activates |
|---|---|---|
| `webhookUrl` | Inbound Webhook URL from a GHL workflow | Contact form, upload form, and newsletter POST JSON to it |
| `formUrl` | GHL form link | All "Start your pre-approval" buttons |
| `calendarUrl` | GHL calendar link | All "Book a call" buttons |
| `uploadFormEmbedUrl` | GHL form (with file-upload field) embed URL | Replaces the link-based upload form with true file upload |
| `chatWidgetSrc` + `chatWidgetId` | Chat widget snippet values | Floating AI chat on every page |
| `ga4Id` / `gtmId` / `metaPixelId` | Tracking IDs | GA4 / Tag Manager / Meta Pixel on every page |

**Fallbacks until links are provided (working today):** CTA buttons route to the
contact form; form submissions open a pre-filled email to Ingrid so no lead is
ever dropped. Webhook payloads include `type` (contact / document-upload /
newsletter), `page`, `language`, and all form fields.

## Roxy (the chat assistant)

Roxy is a hand-coded guided chat bubble on every page (EN + ES): keyword-matched
answers from a curated knowledge base (`roxy` section of `global.json`), quick-reply
chips, and every conversation routes toward booking. When Ingrid provides her GHL
AI Chat Widget script (set `chatWidgetSrc` in `ghl-config.js`), it **replaces**
Roxy automatically — name the GHL bot "Roxy" to keep continuity.

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

## ⚠️ Facts to confirm with Ingrid before the real domain goes live

- **NMLS # 1936558** — taken from Pioneer's own billboard artwork. The old demo
  showed a different number and ZoomInfo shows a third. Confirm hers, fix in
  `src/content/{en,es}/global.json`, rebuild.
- **Office address** (2020 Hollywood Blvd, Suite #22) — from the old demo; confirm.
- `SITE_URL` in `build.mjs` — set to the final domain for correct SEO tags/sitemap.
