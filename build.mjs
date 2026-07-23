// Static site builder — Ingrid Ascanio · Miami Mortgage
// Reads src/content/{en,es}/*.json → writes dist/ as plain HTML.
// Run: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const read = (p) => JSON.parse(readFileSync(join(ROOT, 'src/content', p), 'utf8'));

const L = {
  en: {
    global: read('en/global.json'), home: read('en/home.json'), buy: read('en/buy.json'),
    refinance: read('en/refinance.json'), about: read('en/about.json'),
    contact: read('en/contact.json'), upload: read('en/upload.json'), loans: read('en/loans.json'),
    legal: read('en/legal.json'),
    prefix: '',
  },
  es: {
    global: read('es/global.json'), home: read('es/home.json'), buy: read('es/buy.json'),
    refinance: read('es/refinance.json'), about: read('es/about.json'),
    contact: read('es/contact.json'), upload: read('es/upload.json'), loans: read('es/loans.json'),
    legal: read('es/legal.json'),
    prefix: '/es',
  },
};

// Vercel serves www.miamipmf.com as the PRIMARY hostname — the bare apex 308-redirects to it.
// So canonical tags, the sitemap, hreflang and JSON-LD must all say www: a canonical pointing at
// a URL that redirects is a self-contradiction to Google and wastes crawl budget on every page.
// The .replace() coerces a non-www SITE_URL env override to www so the two can't drift apart again.
const SITE_URL = (process.env.SITE_URL || 'https://www.miamipmf.com').replace('://miamipmf.com', '://www.miamipmf.com');

// Cache-busters keyed to FILE CONTENT, not build time. A timestamp changes on every deploy and
// forces every returning visitor to re-download CSS/JS they already have — a self-inflicted
// Core Web Vitals hit. A content hash only changes when the file actually changes.
const hashOf = (p) => createHash('sha1').update(readFileSync(join(ROOT, p))).digest('hex').slice(0, 8);
const V = { css: hashOf('src/css/site.css'), js: hashOf('src/js/main.js'), ghl: hashOf('src/js/ghl-config.js') };

// Real last-modified dates, from git. Google treats <lastmod> as a recrawl hint but ignores it
// site-wide once it catches you lying — so this is best-effort-accurate or absent, never invented.
// Vercel builds from a shallow clone; if git can't answer for a file we fall back to HEAD, then omit.
const HEAD_DATE = (() => {
  try { return execSync('git log -1 --format=%cI', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; }
  catch { return null; }
})();
const lastmodCache = new Map();
function lastmodOf(...files) {
  const key = files.join('|');
  if (lastmodCache.has(key)) return lastmodCache.get(key);
  let newest = null;
  for (const f of files) {
    let d = null;
    try { d = execSync(`git log -1 --format=%cI -- "${f}"`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; }
    catch { d = null; }
    if (d && (!newest || d > newest)) newest = d;
  }
  const out = newest || HEAD_DATE;
  lastmodCache.set(key, out);
  return out;
}

const pages = [];
function pagePath(lang, slug) { return slug ? `${L[lang].prefix}/${slug}/` : (lang === 'en' ? '/' : '/es/'); }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Structured data (JSON-LD): the machine-readable fact sheet Google reads to understand that
// this site is Ingrid — a real loan officer at a real Hollywood, FL branch — rather than just
// a website. Every value below is sourced from global.json or verified externally; nothing invented.
// Geo coordinates verified against the street address via OpenStreetMap (2026-07-21).
//
// WHY IT IS BUILT AS ONE @graph WITH STABLE @ids:
// The query we have to win is a PERSON'S NAME. Against LinkedIn/Instagram/ZoomInfo, this domain
// only wins if Google is certain that miamipmf.com is the *entity home* for the person
// "Ingrid Ascanio". That certainty comes from one connected graph — Person ↔ business ↔ employer
// ↔ page ↔ image — repeated identically on all 32 pages, plus sameAs pointing at every profile
// that currently outranks her. Loose per-page snippets do not consolidate; a graph does.
//
// NOT MARKED UP, DELIBERATELY: aggregateRating/review (no verified reviews exist — fabricating
// them is a manual-action risk and a lie on a client's site) and openingHours (unknown; asking
// beats guessing). Both are on Ingrid's request list instead.
function schemaJsonLd(g, lang, ctx) {
  const p = g.person;
  const s = g.seo;
  const loans = L[lang].loans;
  const BIZ = `${SITE_URL}/#business`;
  const PERSON = `${SITE_URL}/#ingrid`;
  const WEBSITE = `${SITE_URL}/#website`;
  const PIONEER = `${SITE_URL}/#pioneer`;
  const PORTRAIT = `${SITE_URL}/#portrait`;
  const url = SITE_URL + ctx.path;
  const PAGE = `${url}#webpage`;
  const loanId = (slug) => `${SITE_URL}${L[lang].prefix}/${loans.index.slug}/${slug}/#product`;

  // Verified live 2026-07-21. Instagram added this pass: it is currently the #2 result for her
  // name, so declaring it as the same entity is the strongest consolidation signal available.
  const sameAs = [
    'https://www.linkedin.com/in/ingrid-ascanio-8914959',
    'https://www.facebook.com/IngridAscanioTheMortgageOriginator',
    'https://www.instagram.com/ingridcleartoclose/',
    // Her profile on Pioneer's site (verified 200, 2026-07-22) — an employer page about the
    // same person strengthens entity reconciliation. NMLS Consumer Access deliberately NOT
    // listed: it 403s all crawlers (anti-bot wall), so the link would be unverifiable to Google.
    'https://yourkey.com/ingrid-ascanio/',
  ];
  const address = {
    '@type': 'PostalAddress',
    streetAddress: '3325 Hollywood Blvd, Ste 402',
    addressLocality: 'Hollywood',
    addressRegion: 'FL',
    postalCode: '33021',
    addressCountry: 'US',
  };
  const graph = [];

  // One image entity every other node points at, so Google resolves one portrait — not five.
  graph.push({
    '@type': 'ImageObject',
    '@id': PORTRAIT,
    url: `${SITE_URL}/assets/img/ingrid-portrait.jpg`,
    contentUrl: `${SITE_URL}/assets/img/ingrid-portrait.jpg`,
    width: 694,
    height: 800,
    caption: s.portraitAlt,
  });

  // The employer as its own entity. pmfmortgage.com does not resolve; yourkey.com is Pioneer's
  // live site (verified 2026-07-21) — naming it correctly ties her to a company Google already knows.
  graph.push({
    '@type': 'Organization',
    '@id': PIONEER,
    name: p.company,
    url: 'https://yourkey.com/',
    identifier: [{ '@type': 'PropertyValue', propertyID: 'NMLS', name: 'NMLS ID', value: p.companyNmls }],
  });

  graph.push({
    '@type': ['FinancialService', 'LocalBusiness'],
    '@id': BIZ,
    name: `${p.name} — ${p.company}`,
    alternateName: s.businessAlternateName,
    description: g.footer.blurb,
    url: `${SITE_URL}/`,
    image: { '@id': PORTRAIT },
    logo: `${SITE_URL}/assets/img/pmf-logo-transparent.png`,
    telephone: '+1-786-554-8830',
    email: p.email,
    address,
    geo: { '@type': 'GeoCoordinates', latitude: 26.0108783, longitude: -80.1750192 },
    areaServed: s.areaServed,
    availableLanguage: ['English', 'Spanish'],
    knowsLanguage: ['en', 'es'],
    currenciesAccepted: 'USD',
    priceRange: '$$',
    identifier: [{ '@type': 'PropertyValue', propertyID: 'NMLS', name: 'NMLS ID', value: p.companyNmls }],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: '+1-786-554-8830',
      email: p.email,
      availableLanguage: ['English', 'Spanish'],
      areaServed: 'US-FL',
    },
    parentOrganization: { '@id': PIONEER },
    employee: { '@id': PERSON },
    founder: { '@id': PERSON },
    // Ties the business entity to the seven programs that have their own pages — so the
    // branch reads as "a lender that offers these products", not a bare address.
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: loans.index.title,
      itemListElement: loans.programs.map((prog) => ({
        '@type': 'Offer',
        itemOffered: {
          '@id': loanId(prog.slug),
          '@type': 'LoanOrCredit',
          name: prog.h1 || prog.name,
          url: `${SITE_URL}${L[lang].prefix}/${loans.index.slug}/${prog.slug}/`,
        },
      })),
    },
    sameAs,
  });

  graph.push({
    '@type': 'Person',
    '@id': PERSON,
    name: p.name,
    givenName: 'Ingrid',
    familyName: 'Ascanio',
    jobTitle: p.title,
    description: s.bio,
    telephone: '+1-786-554-8830',
    email: p.email,
    image: { '@id': PORTRAIT },
    url: `${SITE_URL}${L[lang].prefix}/${L[lang].about.slug}/`,
    mainEntityOfPage: `${SITE_URL}${L[lang].prefix}/${L[lang].about.slug}/`,
    identifier: [{ '@type': 'PropertyValue', propertyID: 'NMLS', name: 'NMLS ID', value: p.nmls }],
    // A government-registry licence number is the single strongest disambiguator a loan officer
    // has: it distinguishes THIS Ingrid Ascanio from every other person with the name.
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'license',
      name: s.credentialName,
      identifier: p.nmls,
      recognizedBy: { '@type': 'Organization', name: 'Nationwide Multistate Licensing System & Registry (NMLS)', url: 'https://www.nmlsconsumeraccess.org/' },
    },
    hasOccupation: {
      '@type': 'Occupation',
      name: s.occupationName,
      occupationalCategory: '13-2072.00', // O*NET-SOC: Loan Officers
    },
    memberOf: { '@type': 'Organization', name: s.membership, url: 'https://www.famp.org/' },
    award: s.awards,
    knowsAbout: s.knowsAbout,
    knowsLanguage: ['en', 'es'],
    worksFor: { '@id': BIZ },
    workLocation: { '@id': BIZ },
    areaServed: s.areaServed,
    sameAs,
  });

  graph.push({
    '@type': 'WebSite',
    '@id': WEBSITE,
    url: `${SITE_URL}/`,
    name: `${p.name} — ${p.company}`,
    description: g.footer.blurb,
    inLanguage: lang,
    publisher: { '@id': BIZ },
    about: { '@id': PERSON },
  });

  // The page node. /about/ is typed ProfilePage — schema.org's explicit "this page IS the
  // person" declaration, which is exactly the claim we need Google to accept.
  const isProfile = ctx.kind === 'about';
  const types = isProfile ? ['ProfilePage'] : ['WebPage'];
  if (ctx.faq && ctx.faq.length) types.push('FAQPage');
  const page = {
    '@type': types.length === 1 ? types[0] : types,
    '@id': PAGE,
    url,
    name: ctx.title,
    description: ctx.desc,
    inLanguage: lang,
    isPartOf: { '@id': WEBSITE },
    primaryImageOfPage: { '@id': PORTRAIT },
    about: { '@id': ctx.loan ? loanId(ctx.loan.slug) : (isProfile ? PERSON : BIZ) },
  };
  if (ctx.lastmod) page.dateModified = ctx.lastmod;
  if (isProfile) page.mainEntity = { '@id': PERSON };
  if (ctx.faq && ctx.faq.length) {
    page.mainEntity = ctx.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    }));
  }
  if (ctx.crumbs && ctx.crumbs.length) page.breadcrumb = { '@id': `${url}#breadcrumb` };
  graph.push(page);

  // BreadcrumbList still earns a real rich result in 2026 (unlike FAQ): it replaces the raw URL
  // in the search listing with a readable Home › Loan options › FHA trail.
  if (ctx.crumbs && ctx.crumbs.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: ctx.crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: SITE_URL + c.path,
      })),
    });
  }

  // Loan-detail pages describe an actual financial product. No rate, term or amount is asserted
  // anywhere — those change daily and depend on the borrower's file, so claiming one would be false.
  if (ctx.loan) {
    graph.push({
      '@type': ['LoanOrCredit', 'FinancialProduct'],
      '@id': loanId(ctx.loan.slug),
      name: ctx.loan.h1 || ctx.loan.name,
      alternateName: ctx.loan.name,
      description: ctx.loan.intro,
      url,
      category: 'Mortgage',
      loanType: ctx.loan.name,
      provider: { '@id': BIZ },
      areaServed: s.areaServed,
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: url,
        servicePhone: '+1-786-554-8830',
        availableLanguage: ['English', 'Spanish'],
      },
    });
  }

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c'); // never let a stray "<" break out of the script tag
  return `<script type="application/ld+json">${json}</script>`;
}

function head({ g, title, desc, path, altPath, lang, ctx }) {
  const url = SITE_URL + path;
  const isProfile = ctx.kind === 'about';
  // The share card is the first impression every time this link is posted to Instagram, Facebook
  // or LinkedIn — which is precisely the action that will move the name query. A 1200×630 designed
  // card renders as a full-width banner; the raw portrait renders as a cropped thumbnail.
  const ogImage = `${SITE_URL}/assets/img/og-card.jpg`;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="alternate" hreflang="${lang}" href="${url}">
<link rel="alternate" hreflang="${lang === 'en' ? 'es' : 'en'}" href="${SITE_URL}${altPath}">
<link rel="alternate" hreflang="x-default" href="${SITE_URL}${lang === 'en' ? path : altPath}">
<meta property="og:type" content="${isProfile ? 'profile' : 'website'}">
<meta property="og:site_name" content="${esc(g.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(g.seo.portraitAlt)}">
<meta property="og:locale" content="${g.meta.ogLocale}">
<meta property="og:locale:alternate" content="${lang === 'en' ? 'es_US' : 'en_US'}">
${isProfile ? `<meta property="profile:first_name" content="Ingrid">
<meta property="profile:last_name" content="Ascanio">
` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:image:alt" content="${esc(g.seo.portraitAlt)}">
<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/fraunces-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-sans-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css?v=${V.css}">
<script src="/ghl-config.js?v=${V.ghl}" defer></script>
<script src="/assets/main.js?v=${V.js}" defer></script>
${schemaJsonLd(g, lang, { ...ctx, path, title, desc })}
</head>
<body>`;
}

function header(g, path, altPath, ctaHref = '#contact-panel') {
  const menuLinks = g.nav.map((n, i) => {
    const current = path === n.path ? ' aria-current="page"' : '';
    return `<a class="menu-link" href="${n.path}"${current} style="--i:${i}">
      <span class="menu-link-label">${esc(n.label)}</span><small>${esc(n.desc)}</small>
    </a>`;
  }).join('');
  return `
<a class="skip" href="#main">Skip to content</a>
<div class="microbar">
  <span class="microbar-hablamos">${esc(g.microbar.hablamos)}</span>
  <a class="lang-switch" href="${altPath}" title="${esc(g.microbar.switchHint)}" data-lang-switch>
    <span class="lang-on">${esc(g.langLabel)}</span><span class="lang-sep">·</span><span class="lang-off">${esc(g.otherLangLabel)}</span>
  </a>
</div>
<header class="site-header">
  <a class="nameplate" href="${g.lang === 'en' ? '/' : '/es/'}">
    <img class="nameplate-logo" src="/assets/img/pmf-logo-transparent.png" alt="Pioneer Mortgage Funding" width="150" height="58">
    <span class="nameplate-divider" aria-hidden="true"></span>
    <span class="nameplate-person">
      <span class="nameplate-name">Ingrid Ascanio</span>
      <span class="nameplate-sub">${esc(g.person.title)}</span>
    </span>
  </a>
  <div class="header-actions">
    <a class="btn btn-gold" href="${ctaHref}" data-ghl="calendar">${esc(g.cta.secondary)}</a>
    <button class="menu-btn" aria-expanded="false" aria-controls="menu-overlay">
      <span class="menu-btn-glyph" aria-hidden="true"><span></span><span></span></span>${esc(g.menu.label)}
    </button>
  </div>
</header>
<div class="menu-scrim" hidden></div>
<div class="menu-pop" id="menu-overlay" hidden>
  <button class="menu-close" aria-label="${esc(g.menu.close)}">×</button>
  <nav class="menu-links">${menuLinks}</nav>
  <div class="menu-foot">
    <span class="menu-logo-chip"><img src="/assets/img/pmf-logo-transparent.png" alt="Pioneer Mortgage Funding" width="104" height="40" loading="lazy"></span>
    <div class="menu-foot-contact">
      <a href="${g.person.phoneHref}">${esc(g.person.phone)}</a>
      <a href="mailto:${g.person.email}">${esc(g.person.email)}</a>
    </div>
    <a class="btn btn-gold btn-sm" href="#" data-ghl="calendar" data-fallback="contact">${esc(g.cta.secondary)}</a>
  </div>
</div>
<main id="main">`;
}

function contactPanel(g, id = 'contact-panel') {
  return `
<section class="panel-navy contact-panel" id="${id}">
  <div class="contact-panel-inner reveal">
    <p class="eyebrow eyebrow-gold">${esc(g.contactPanel.eyebrow)}</p>
    <h2 class="panel-title">${esc(g.contactPanel.title)}</h2>
    <p class="panel-body">${esc(g.contactPanel.body)}</p>
    <div class="panel-ctas">
      <a class="btn btn-gold btn-xl" href="#" data-ghl="calendar" data-fallback="contact">${esc(g.cta.secondary)}</a>
      <a class="btn btn-ghost btn-xl" href="#" data-ghl="form" data-fallback="contact">${esc(g.cta.primary)}</a>
    </div>
    <div class="panel-direct">
      <span>${esc(g.contactPanel.phoneLabel)} · <a href="${g.person.phoneHref}">${esc(g.person.phone)}</a></span>
      <span>${esc(g.contactPanel.emailLabel)} · <a href="mailto:${g.person.email}">${esc(g.person.email)}</a></span>
    </div>
  </div>
</section>`;
}

function footer(g, loans, pageType) {
  const loanLinks = loans.programs.map(p =>
    `<a href="${L[g.lang].prefix}/${L[g.lang].loans.index.slug}/${p.slug}/">${esc(p.name)}</a>`).join('');
  const pageLinks = g.nav.map(n => `<a href="${n.path}">${esc(n.label)}</a>`).join('');
  const i18n = { lang: g.lang, quickhelp: g.quickhelp, nudge: { ...g.nudge, page: pageType }, calendarFallback: g.nav[4].path };
  return `</main>
<a class="book-bar" href="#" data-ghl="calendar" data-fallback="contact">${esc(g.cta.secondary)}</a>
<footer class="site-footer">
  <div class="footer-grid">
    <div class="footer-brand">
      <span class="footer-logo-chip"><img src="/assets/img/pmf-logo-transparent.png" alt="Pioneer Mortgage Funding" width="180" height="69" loading="lazy"></span>
      <p>${esc(g.footer.blurb)}</p>
      <p class="footer-contact">
        <a href="${g.person.phoneHref}">${esc(g.person.phone)}</a><br>
        <a href="mailto:${g.person.email}">${esc(g.person.email)}</a><br>
        ${esc(g.person.address)}
      </p>
      <p class="footer-areas">${esc(g.seo.areasLine)}</p>
    </div>
    <nav class="footer-col" aria-label="${esc(g.footer.loanOptionsTitle)}"><h3>${esc(g.footer.loanOptionsTitle)}</h3>${loanLinks}</nav>
    <nav class="footer-col" aria-label="${esc(g.footer.companyTitle)}"><h3>${esc(g.footer.companyTitle)}</h3>${pageLinks}</nav>
    <div class="footer-col footer-news">
      <h3>${esc(g.newsletter.title)}</h3>
      <p>${esc(g.newsletter.body)}</p>
      <form class="news-form" data-ghl-newsletter novalidate>
        <input type="email" name="email" required placeholder="${esc(g.newsletter.placeholder)}" aria-label="Email">
        <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn btn-gold btn-sm" type="submit">${esc(g.newsletter.button)}</button>
        <p class="form-status" role="status" data-success="${esc(g.newsletter.success)}" data-error="${esc(g.newsletter.error)}"></p>
      </form>
    </div>
  </div>
  <div class="footer-legal">
    <div class="footer-legal-row">
      <img src="/assets/img/equal-housing-white.png" alt="Equal Housing Opportunity" width="44" height="47" loading="lazy">
      <p>${esc(g.footer.legalLine)}<br>${esc(g.footer.brokerLine)}<br>${esc(g.footer.equalHousing)}</p>
    </div>
    <p class="footer-links">
      <a href="${L[g.lang].prefix}/${L[g.lang].legal.privacy.slug}/">${esc(g.footer.privacy)}</a>
      <a href="${L[g.lang].prefix}/${L[g.lang].legal.terms.slug}/">${esc(g.footer.terms)}</a>
      <a href="${g.footer.nmlsAccessUrl}" rel="noopener" target="_blank">${esc(g.footer.nmlsAccess)}</a>
    </p>
  </div>
</footer>
<script>window.SITE_I18N = ${JSON.stringify(i18n)};</script>
</body>
</html>`;
}

const btn = (label, cls, ghl, fallback) =>
  `<a class="btn ${cls}" href="#" data-ghl="${ghl}" data-fallback="${fallback}">${esc(label)}</a>`;

// Programs are index-aligned across languages (the emit loop already relies on this), so a set
// chosen once by EN slug resolves to the correct translated page and label in both languages.
function relatedPrograms(lang, enSlugs) {
  const c = L[lang].loans;
  return enSlugs.map((sl) => {
    const i = L.en.loans.programs.findIndex((x) => x.slug === sl);
    const prog = c.programs[i];
    return `<a href="${L[lang].prefix}/${c.index.slug}/${prog.slug}/">${esc(prog.name)}</a>`;
  }).join('');
}

function relatedBlock(lang, block, enSlugs) {
  return `
<section class="section related-block reveal">
  <nav class="others"><span>${esc(block.title)}:</span> ${relatedPrograms(lang, enSlugs)}
    <a href="${L[lang].prefix}/${L[lang].loans.index.slug}/">${esc(block.allLink)}</a></nav>
</section>`;
}

// ---------- page renderers ----------
function renderHome(lang) {
  const { global: g, home: h, loans } = L[lang];
  const steps = h.path.steps.map((s, i) => `
    <li class="step3" style="--i:${i}">
      <span class="step3-dot">${i + 1}</span>
      <h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p>
    </li>`).join('');
  const cards = loans.programs.map((p, i) => `
    <a class="program-card reveal ${i === 0 ? 'program-card-featured' : ''}" href="${L[lang].prefix}/${loans.index.slug}/${p.slug}/">
      <h3>${esc(p.name)}</h3>
      <p class="program-tag">${esc(p.tag)}</p>
      ${i === 0 ? `<p class="program-blurb">${esc(p.cardBlurb)}</p>` : ''}
      <span class="program-link">${esc(h.programs.linkLabel)} →</span>
    </a>`).join('');
  const creds = g.credentials.map(c => `<div class="cred"><span class="cred-big">${esc(c.big)}</span><span class="cred-small">${esc(c.small)}</span></div>`).join('');
  return `
<section class="hero">
  <div class="hero-text">
    <h1><span class="eyebrow h1-kicker">${esc(h.hero.eyebrow)}</span>${esc(h.hero.titleA)} <em>${esc(h.hero.titleEm)}</em></h1>
    <p class="hero-body">${esc(h.hero.body)}</p>
    <div class="hero-with">
      <span>${esc(h.hero.withLabel)}</span>
      <img src="/assets/img/pmf-logo-transparent.png" alt="Pioneer Mortgage Funding" width="170" height="65" loading="eager">
    </div>
    <div class="hero-ctas">
      ${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}
      ${btn(g.cta.primary, 'btn-outline btn-xl', 'form', 'contact')}
    </div>
    <p class="hero-trust">${esc(h.hero.trustLine)}</p>
  </div>
  <figure class="hero-figure">
    <div class="hero-arch">
      <img src="/assets/img/ingrid-portrait.jpg" alt="${esc(h.hero.imageAlt)}" width="500" height="576" fetchpriority="high">
    </div>
    <figcaption class="hero-caption id-card">
      <strong>${esc(g.person.name)}</strong>
      <span class="id-rule" aria-hidden="true"></span>
      <span>${esc(g.person.title)}</span>
      <span class="nmls-badge">NMLS #${esc(g.person.nmls)}</span>
      <span class="hero-caption-meta">${esc(h.hero.captionMeta)}</span>
      <a class="id-card-cta" href="${g.nav[3].path}">${esc(h.hero.aboutCta)} →</a>
    </figcaption>
  </figure>
</section>
<section class="cred-strip reveal">${creds}</section>
<section class="panel-navy path-section">
  <div class="path-head reveal">
    <p class="eyebrow eyebrow-gold">${esc(h.path.eyebrow)}</p>
    <h2 class="panel-title">${esc(h.path.title)}</h2>
    <p class="panel-body">${esc(h.path.body)}</p>
  </div>
  <ol class="steps3" id="path">${steps}</ol>
  <div class="path-cta reveal">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
</section>
<section class="section programs-section">
  <div class="section-head reveal">
    <p class="eyebrow">${esc(h.programs.eyebrow)}</p>
    <h2>${esc(h.programs.title)}</h2>
    <p class="section-body">${esc(h.programs.body)}</p>
  </div>
  <div class="program-grid">${cards}</div>
  <p class="section-more reveal"><a class="text-link" href="${L[lang].prefix}/${loans.index.slug}/">${esc(h.programs.allLink)} →</a></p>
</section>
<section class="about-teaser reveal">
  <div class="about-teaser-text">
    <p class="eyebrow">${esc(h.aboutTeaser.eyebrow)}</p>
    <h2>${esc(h.aboutTeaser.title)}</h2>
    <p>${esc(h.aboutTeaser.body)}</p>
    ${h.aboutTeaser.body2 ? `<p>${esc(h.aboutTeaser.body2)}</p>` : ''}
    ${h.aboutTeaser.chips ? `<div class="persona-chips">${h.aboutTeaser.chips.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
    <a class="text-link" href="${g.nav[3].path}">${esc(h.aboutTeaser.link)} →</a>
  </div>
  <figure class="about-photo"><img src="/assets/img/ingrid-portrait-sm.jpg" alt="${esc(g.seo.portraitAltAlt)}" width="300" height="346" loading="lazy"></figure>
</section>
<section class="faq-band">
  <div class="section faq-section">
    <div class="section-head reveal">
      <p class="eyebrow">${esc(h.faq.eyebrow)}</p>
      <h2>${esc(h.faq.title)}</h2>
    </div>
    <div class="faq">${h.faq.items.map(f => `
      <details class="faq-item reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
    </div>
  </div>
</section>
${contactPanel(g)}`;
}

function renderBuy(lang) {
  const { global: g, buy: b } = L[lang];
  const points = b.points.items.map((s, i) => `
    <li class="journey-step reveal">
      <span class="journey-num">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div>
    </li>`).join('');
  const stats = b.firstTime.points.map(p => `<div class="cred"><span class="cred-big">${esc(p.big)}</span><span class="cred-small">${esc(p.small)}</span></div>`).join('');
  return `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(b.hero.eyebrow)}</p>
  <h1 class="reveal">${esc(b.hero.title)}</h1>
  <p class="page-hero-body reveal">${esc(b.hero.body)}</p>
  <div class="page-hero-ctas reveal">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
</section>
<section class="section">
  <div class="section-head reveal"><p class="eyebrow">${esc(b.points.eyebrow)}</p><h2>${esc(b.points.title)}</h2></div>
  <ol class="journey">${points}</ol>
</section>
<section class="panel-warm first-time reveal">
  <div class="first-time-text">
    <p class="eyebrow">${esc(b.firstTime.eyebrow)}</p>
    <h2>${esc(b.firstTime.title)}</h2>
    <p>${esc(b.firstTime.body)}</p>
  </div>
  <div class="first-time-points">${stats}</div>
</section>
${relatedBlock(lang, b.related, ['fha', 'conventional', 'va'])}
${contactPanel(g)}`;
}

function renderRefinance(lang) {
  const { global: g, refinance: r } = L[lang];
  const reasons = r.reasons.items.map((it, i) => `
    <article class="reason reveal">
      <span class="reason-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="reason-text">
        <h3>${esc(it.name)}</h3>
        <p>${esc(it.desc)}</p>
        <p class="reason-detail">${esc(it.detail)}</p>
      </div>
    </article>`).join('');
  return `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(r.hero.eyebrow)}</p>
  <h1 class="reveal">${esc(r.hero.title)}</h1>
  <p class="page-hero-body reveal">${esc(r.hero.body)}</p>
  <div class="page-hero-ctas reveal">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
</section>
<section class="section">
  <div class="section-head reveal"><p class="eyebrow">${esc(r.reasons.eyebrow)}</p><h2>${esc(r.reasons.title)}</h2></div>
  <div class="reasons">${reasons}</div>
</section>
${relatedBlock(lang, r.related, ['conventional', 'fha', 'jumbo'])}
${contactPanel(g)}`;
}

function renderLoanIndex(lang) {
  const { global: g, loans } = L[lang];
  const rows = loans.programs.map(p => `
    <a class="loan-row reveal" href="${L[lang].prefix}/${loans.index.slug}/${p.slug}/">
      <div class="loan-row-name"><h2>${esc(p.name)}</h2><p class="program-tag">${esc(p.tag)}</p></div>
      <p class="loan-row-blurb">${esc(p.cardBlurb)}</p>
      <span class="program-link">${esc(loans.index.detailLabel)} →</span>
    </a>`).join('');
  return `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(loans.index.eyebrow)}</p>
  <h1 class="reveal">${esc(loans.index.title)}</h1>
  <p class="page-hero-body reveal">${esc(loans.index.body)}</p>
</section>
<section class="section loan-rows">${rows}</section>
${contactPanel(g)}`;
}

function renderLoanDetail(lang, p) {
  const { global: g, loans } = L[lang];
  const d = loans.detail;
  const others = loans.programs.filter(x => x.slug !== p.slug).map(x =>
    `<a href="${L[lang].prefix}/${loans.index.slug}/${x.slug}/">${esc(x.name)}</a>`).join('');
  return `
<section class="page-hero page-hero-loan">
  <p class="eyebrow reveal"><a class="crumb" href="${L[lang].prefix}/${loans.index.slug}/">${esc(loans.index.eyebrow)}</a></p>
  <h1 class="reveal">${esc(p.h1 || p.name)}</h1>
  <p class="loan-tagline reveal">${esc(p.tag)}</p>
  <p class="page-hero-body dropcap reveal">${esc(p.intro)}</p>
</section>
<section class="section loan-detail-grid">
  <div class="loan-col reveal">
    <h2 class="loan-h">${esc(d.whoTitle)}</h2>
    <ul class="check-list">${p.who.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    <h2 class="loan-h">${esc(d.knowTitle)}</h2>
    <ul class="know-list">${p.know.map(k => `<li>${esc(k)}</li>`).join('')}</ul>
  </div>
  <div class="loan-col reveal">
    <h2 class="loan-h">${esc(d.howTitle)}</h2>
    <ol class="journey journey-compact">${p.how.map((s, i) => `
      <li class="journey-step"><span class="journey-num">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${esc(s.name)}</h3><p>${esc(s.desc)}</p></div></li>`).join('')}</ol>
    <h2 class="loan-h">${esc(d.faqTitle)}</h2>
    <div class="faq">${p.faq.map(f => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div>
  </div>
</section>
<section class="section cta-block reveal">
  <p class="eyebrow">${esc(d.cta.eyebrow)}</p>
  <h2>${esc(d.cta.title)}</h2>
  <p class="section-body">${esc(d.cta.body)}</p>
  <div class="panel-ctas">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
  <nav class="others"><span>${esc(d.othersTitle)}:</span> ${others}</nav>
</section>
${contactPanel(g)}`;
}

function renderAbout(lang) {
  const { global: g, about: a } = L[lang];
  const timeline = a.timeline.items.map(t => `
    <li class="tl-item reveal">
      <span class="tl-era">${esc(t.era)}</span>
      <div class="tl-text"><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p></div>
    </li>`).join('');
  const values = a.values.items.map(v => `
    <div class="value reveal"><h3>${esc(v.name)}</h3><p>${esc(v.desc)}</p></div>`).join('');
  const recog = a.recognition.items.map(r => `
    <div class="recog reveal"><h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p></div>`).join('');
  return `
<section class="about-hero">
  <div class="about-hero-text">
    <h1 class="reveal"><span class="eyebrow h1-kicker">${esc(a.hero.eyebrow)}</span>${esc(a.hero.title)}</h1>
    <p class="page-hero-body reveal">${esc(a.hero.body)}</p>
    ${a.hero.body2 ? `<p class="page-hero-body reveal">${esc(a.hero.body2)}</p>` : ''}
    <div class="page-hero-ctas reveal">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
  </div>
  <figure class="about-hero-photo reveal">
    <div class="hero-arch hero-arch-sm"><img src="/assets/img/ingrid-portrait.jpg" alt="${esc(g.seo.portraitAlt)}" width="380" height="438"></div>
    <figcaption class="hero-caption id-card">
      <strong>${esc(g.person.name)}</strong>
      <span class="id-rule" aria-hidden="true"></span>
      <span>${esc(g.person.title)}</span>
      <span class="nmls-badge">NMLS #${esc(g.person.nmls)}</span>
    </figcaption>
  </figure>
</section>
<section class="panel-navy tl-section">
  <div class="path-head reveal">
    <p class="eyebrow eyebrow-gold">${esc(a.timeline.eyebrow)}</p>
    <h2 class="panel-title">${esc(a.timeline.title)}</h2>
  </div>
  <ol class="tl">${timeline}</ol>
</section>
<section class="section">
  <div class="section-head reveal"><p class="eyebrow">${esc(a.values.eyebrow)}</p><h2>${esc(a.values.title)}</h2></div>
  <div class="values">${values}</div>
</section>
<section class="panel-warm recog-section">
  <div class="section-head reveal"><p class="eyebrow">${esc(a.recognition.eyebrow)}</p><h2>${esc(a.recognition.title)}</h2></div>
  <div class="recogs">${recog}</div>
</section>
${contactPanel(g)}`;
}

function formField(label, input) { return `<label class="field"><span>${esc(label)}</span>${input}</label>`; }

function renderContact(lang) {
  const { global: g, contact: c } = L[lang];
  const opts = c.form.interestOptions.map(o => `<option>${esc(o)}</option>`).join('');
  return `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(c.hero.eyebrow)}</p>
  <h1 class="reveal">${esc(c.hero.title)}</h1>
  <p class="page-hero-body reveal">${esc(c.hero.body)}</p>
</section>
<section class="section contact-grid">
  <form class="card-form reveal" id="contact-form" data-ghl-contact novalidate>
    <h2>${esc(c.form.title)}</h2>
    ${formField(c.form.name, `<input type="text" name="name" required placeholder="${esc(c.form.namePh)}">`)}
    <div class="field-row">
      ${formField(c.form.email, `<input type="email" name="email" required placeholder="${esc(c.form.emailPh)}">`)}
      ${formField(c.form.phone, `<input type="tel" name="phone" placeholder="${esc(c.form.phonePh)}">`)}
    </div>
    ${formField(c.form.interest, `<select name="interest">${opts}</select>`)}
    ${formField(c.form.message, `<textarea name="message" rows="5" placeholder="${esc(c.form.messagePh)}"></textarea>`)}
    <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <label class="consent"><input type="checkbox" name="consent" required><span>${esc(c.form.consent)}</span></label>
    <button class="btn btn-navy btn-xl" type="submit">${esc(c.form.submit)}</button>
    <p class="form-status" role="status" data-loading="${esc(g.form.loading)}" data-success="${esc(g.form.success)}" data-error="${esc(g.form.error)}"></p>
  </form>
  <aside class="contact-direct reveal">
    <h2>${esc(c.direct.title)}</h2>
    <div class="direct-item direct-book"><h3>${esc(c.direct.bookTitle)}</h3><p>${esc(c.direct.bookDesc)}</p>
      <a class="btn btn-gold btn-xl" href="#" data-ghl="calendar" data-fallback="phone">${esc(c.direct.bookButton)}</a></div>
    <div class="direct-item"><h3>${esc(c.direct.callTitle)}</h3><a class="direct-big" href="${g.person.phoneHref}">${esc(g.person.phone)}</a><p>${esc(c.direct.callDesc)}</p></div>
    <div class="direct-item"><h3>${esc(c.direct.emailTitle)}</h3><a class="direct-big direct-email" href="mailto:${g.person.email}">${esc(g.person.email)}</a><p>${esc(c.direct.emailDesc)}</p></div>
    <div class="direct-item"><h3>${esc(c.direct.visitTitle)}</h3><p class="direct-big-sm">${esc(g.person.address)}</p><p>${esc(c.direct.visitDesc)}</p></div>
  </aside>
</section>`;
}

function renderLegal(lang, doc) {
  const body = doc.blocks.map((b) => {
    if (b.t === 'ul') return `<ul class="legal-list">${b.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
    if (b.t === 'h2') return `<h2 class="legal-h2">${esc(b.text)}</h2>`;
    if (b.t === 'h3') return `<h3 class="legal-h3">${esc(b.text)}</h3>`;
    return `<p>${esc(b.text)}</p>`;
  }).join('\n');
  return `
<section class="page-hero legal-hero">
  <p class="eyebrow reveal">${esc(doc.eyebrow)}</p>
  <h1 class="reveal">${esc(doc.title)}</h1>
  <p class="legal-updated reveal">${esc(doc.updatedLabel)} ${esc(doc.updated)}</p>
</section>
<section class="section legal-section">
  <div class="legal-prose reveal">${body}</div>
</section>`;
}

function renderUpload(lang) {
  const { global: g, upload: u } = L[lang];
  return `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(u.hero.eyebrow)}</p>
  <h1 class="reveal">${esc(u.hero.title)}</h1>
  <p class="page-hero-body reveal">${esc(u.hero.body)}</p>
</section>
<section class="section contact-grid">
  <form class="card-form reveal" id="upload-form" data-ghl-upload novalidate>
    <h2>${esc(u.form.title)}</h2>
    <div class="ghl-upload-slot" data-ghl-upload-slot hidden></div>
    <div class="upload-native" data-ghl-upload-native>
    ${formField(u.form.name, `<input type="text" name="name" required placeholder="${esc(u.form.namePh)}">`)}
    <div class="field-row">
      ${formField(u.form.email, `<input type="email" name="email" required placeholder="${esc(u.form.emailPh)}">`)}
      ${formField(u.form.phone, `<input type="tel" name="phone" placeholder="${esc(u.form.phonePh)}">`)}
    </div>
    ${formField(u.form.property, `<input type="text" name="property" placeholder="${esc(u.form.propertyPh)}">`)}
    <div class="field">
      <span>${esc(u.form.filesLabel)}</span>
      <label class="dropzone" id="dropzone" data-too-big="${esc(u.form.filesTooBig)}" data-selected="${esc(u.form.filesSelected)}" data-remove="${esc(u.form.filesRemove)}">
        <input type="file" id="file-input" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.zip,.doc,.docx,.xls,.xlsx">
        <span class="dropzone-label">${esc(u.form.filesDrop)}</span>
        <span class="dropzone-help">${esc(u.form.filesHelp)}</span>
      </label>
      <ul class="file-list" id="file-list"></ul>
    </div>
    <details class="link-alt">
      <summary>${esc(u.form.orLink)}</summary>
      ${formField(u.form.link, `<input type="url" name="docs_link" placeholder="${esc(u.form.linkPh)}">`)}
      <p class="field-help">${esc(u.form.linkHelp)}</p>
    </details>
    ${formField(u.form.notes, `<textarea name="notes" rows="3" placeholder="${esc(u.form.notesPh)}"></textarea>`)}
    <input type="text" name="company" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-navy btn-xl" type="submit">${esc(u.form.submit)}</button>
    <p class="form-status" role="status" data-loading="${esc(g.form.loading)}" data-success="${esc(g.form.success)}" data-error="${esc(g.form.error)}" data-need="${esc(u.form.needSomething)}"></p>
    </div>
    <p class="field-help secure-note">${esc(u.form.secureNote)}</p>
  </form>
  <aside class="contact-direct reveal">
    <h2>${esc(u.checklist.title)}</h2>
    <p>${esc(u.checklist.intro)}</p>
    <ul class="check-list">${u.checklist.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    <p class="field-help">${esc(u.checklist.tip)}</p>
  </aside>
</section>
${contactPanel(g)}`;
}

// ---------- assemble ----------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// Breadcrumb trails mirror the real URL hierarchy — Home › Loan options › FHA. `kind` is the
// nav index of the section (or null for pages that sit outside the menu, like the legal pages).
function crumbsFor(lang, { navIndex = null, label = null, path = null, parentNavIndex = null } = {}) {
  const g = L[lang].global;
  const home = { name: g.seo.homeCrumb, path: pagePath(lang, '') };
  const crumbs = [home];
  if (parentNavIndex !== null) {
    const parent = g.nav[parentNavIndex];
    crumbs.push({ name: parent.label, path: parent.path });
  }
  if (navIndex !== null) {
    const n = g.nav[navIndex];
    crumbs.push({ name: n.label, path: n.path });
  } else if (label && path) {
    crumbs.push({ name: label, path });
  }
  return crumbs.length > 1 ? crumbs : [];
}

function emit(lang, slug, altSlugOrPath, title, desc, bodyHtml, pageType, ctx = {}) {
  const g = L[lang].global;
  const path = pagePath(lang, slug);
  const altLang = lang === 'en' ? 'es' : 'en';
  const altPath = typeof altSlugOrPath === 'string' && altSlugOrPath.startsWith('/')
    ? altSlugOrPath : pagePath(altLang, altSlugOrPath);
  const lastmod = lastmodOf(...[`src/content/${lang}/global.json`, 'build.mjs', ...(ctx.src ? [ctx.src] : [])]);
  const fullCtx = { ...ctx, kind: ctx.kind || pageType, lastmod };
  // Header CTA must target an anchor that exists on THIS page: the contact page has the
  // form but no contact-panel section; legal pages have neither → send them to /contact/.
  const ctaHref = pageType === 'contact' ? '#contact-form'
    : pageType === 'legal' ? g.nav[4].path : '#contact-panel';
  const html = head({ g, title, desc, path, altPath, lang, ctx: fullCtx }) +
    header(g, path, altPath, ctaHref) + bodyHtml + footer(g, L[lang].loans, pageType);
  const dir = join(DIST, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
  pages.push({ path, lang, altPath, lastmod });
}

for (const lang of ['en', 'es']) {
  const o = L[lang === 'en' ? 'es' : 'en'];
  const c = L[lang];
  const src = (f) => `src/content/${lang}/${f}.json`;
  emit(lang, '', '', c.home.meta.title, c.home.meta.description, renderHome(lang), 'home',
    { src: src('home'), faq: c.home.faq.items });
  emit(lang, c.buy.slug, o.buy.slug, c.buy.meta.title, c.buy.meta.description, renderBuy(lang), 'buy',
    { src: src('buy'), crumbs: crumbsFor(lang, { navIndex: 0 }) });
  emit(lang, c.refinance.slug, o.refinance.slug, c.refinance.meta.title, c.refinance.meta.description, renderRefinance(lang), 'refinance',
    { src: src('refinance'), crumbs: crumbsFor(lang, { navIndex: 1 }) });
  emit(lang, c.loans.index.slug, o.loans.index.slug, c.loans.index.meta.title, c.loans.index.meta.description, renderLoanIndex(lang), 'loans',
    { src: src('loans'), crumbs: crumbsFor(lang, { navIndex: 2 }) });
  for (let i = 0; i < c.loans.programs.length; i++) {
    const p = c.loans.programs[i];
    const altP = o.loans.programs[i];
    const detailPath = `${L[lang].prefix}/${c.loans.index.slug}/${p.slug}/`;
    emit(lang, `${c.loans.index.slug}/${p.slug}`, `${o.loans.index.slug}/${altP.slug}`,
      p.metaTitle || `${p.name}${c.global.meta.titleSuffix}`, p.metaDesc || p.cardBlurb,
      renderLoanDetail(lang, p), 'loans',
      { src: src('loans'), loan: p, faq: p.faq, crumbs: crumbsFor(lang, { parentNavIndex: 2, label: p.h1 || p.name, path: detailPath }) });
  }
  emit(lang, c.about.slug, o.about.slug, c.about.meta.title, c.about.meta.description, renderAbout(lang), 'about',
    { src: src('about'), crumbs: crumbsFor(lang, { navIndex: 3 }) });
  emit(lang, c.contact.slug, o.contact.slug, c.contact.meta.title, c.contact.meta.description, renderContact(lang), 'contact',
    { src: src('contact'), crumbs: crumbsFor(lang, { navIndex: 4 }) });
  emit(lang, c.legal.privacy.slug, o.legal.privacy.slug, c.legal.privacy.metaTitle, c.legal.privacy.metaDesc, renderLegal(lang, c.legal.privacy), 'legal',
    { src: src('legal'), crumbs: crumbsFor(lang, { label: c.legal.privacy.title, path: pagePath(lang, c.legal.privacy.slug) }) });
  emit(lang, c.legal.terms.slug, o.legal.terms.slug, c.legal.terms.metaTitle, c.legal.terms.metaDesc, renderLegal(lang, c.legal.terms), 'legal',
    { src: src('legal'), crumbs: crumbsFor(lang, { label: c.legal.terms.title, path: pagePath(lang, c.legal.terms.slug) }) });
}

// Custom 404. The old WordPress site had far more URLs than the 38 we mapped by hand; anything we
// missed lands here instead of on Vercel's blank default, keeping the visitor (and the crawler)
// inside the site. noindex, because an error page must never compete in search.
{
  const g = L.en.global;
  const nf = g.notFound;
  const body = `
<section class="page-hero">
  <p class="eyebrow reveal">${esc(nf.eyebrow)}</p>
  <h1 class="reveal">${esc(nf.title)}</h1>
  <p class="page-hero-body reveal">${esc(nf.body)}</p>
  <div class="page-hero-ctas reveal">${btn(g.cta.secondary, 'btn-gold btn-xl', 'calendar', 'contact')}</div>
</section>
<section class="section cta-block reveal">
  <nav class="others"><span>${esc(nf.linksTitle)}:</span> ${g.nav.map(n => `<a href="${n.path}">${esc(n.label)}</a>`).join('')}</nav>
</section>`;
  const html = head({ g, title: nf.metaTitle, desc: nf.metaDesc, path: '/404/', altPath: '/404/', lang: 'en', ctx: { kind: 'notfound' } })
      .replace('<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">', '<meta name="robots" content="noindex, follow">')
    + header(g, '/404/', '/es/', g.nav[4].path) + body + footer(g, L.en.loans, 'home');
  writeFileSync(join(DIST, '404.html'), html);
}

// Sitemap. <lastmod> comes from real git commit dates (see lastmodOf) — a recrawl hint Google
// only honours while it stays truthful. The xhtml:link alternates are Google's documented way to
// declare the EN↔ES pairing inside the sitemap itself, reinforcing the hreflang tags in each head.
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
writeFileSync(join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="${XHTML_NS}">\n` +
  pages.map(p => {
    const self = `${SITE_URL}${p.path}`;
    const alt = `${SITE_URL}${p.altPath}`;
    const en = p.lang === 'en' ? self : alt;
    const es = p.lang === 'es' ? self : alt;
    return `  <url>\n    <loc>${self}</loc>\n` +
      (p.lastmod ? `    <lastmod>${p.lastmod}</lastmod>\n` : '') +
      `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="es" href="${es}"/>\n` +
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>\n` +
      `  </url>`;
  }).join('\n') + '\n</urlset>');
// AI crawlers are explicitly welcomed (they don't execute JS, so this static site is natively
// readable to them). The wildcard already allows everything; the named stanzas make the intent
// durable if a future edit tightens the wildcard.
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);

// IndexNow key file — lets us push URL changes straight into Bing's index (which ChatGPT
// leans on) with no webmaster account. The key is permanent; the ping happens post-deploy.
const INDEXNOW_KEY = '7a4accb7237ec7676422eed0b8e764d5';
writeFileSync(join(DIST, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);

cpSync(join(ROOT, 'assets'), join(DIST, 'assets'), { recursive: true });
cpSync(join(ROOT, 'src/css/site.css'), join(DIST, 'assets/site.css'));
cpSync(join(ROOT, 'src/js/main.js'), join(DIST, 'assets/main.js'));
cpSync(join(ROOT, 'src/js/ghl-config.js'), join(DIST, 'ghl-config.js'));

console.log(`Built ${pages.length} pages → dist/`);
