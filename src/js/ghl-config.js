// ============================================================
//  GHL integration config — Ingrid Ascanio · Miami Mortgage
//  ONE place for every GoHighLevel link, embed, and tracking ID.
//  Fill these in as Ingrid provides them; everything on the site
//  picks them up automatically. Leave "" to use the built-in
//  fallback (buttons route to the contact form / phone).
// ============================================================
window.GHL = {
  // Inbound webhook that receives ALL site form submissions as JSON
  // (contact form, upload form, newsletter). From GHL:
  // Automation → Workflow → Inbound Webhook trigger → copy URL.
  webhookUrl: "https://services.leadconnectorhq.com/hooks/cpmixVyQPia8RJXe7Ukw/webhook-trigger/1d5b0053-9df3-4616-91f7-d95e3f28b13d",

  // Full URL of the GHL form for "Start your pre-approval" CTAs.
  // Opens in a new tab. Leave "" to send clicks to the contact form.
  formUrl: "",

  // Full URL of the GHL calendar for "Book a call" CTAs.
  calendarUrl: "",

  // GHL form (with file-upload field) to EMBED on /upload-documents/.
  // Paste the iframe embed URL. When set, it replaces the built-in
  // link-based upload form.
  uploadFormEmbedUrl: "",

  // GHL chat widget script URL (Sites → Chat Widget → Get Code).
  // Example: "https://widgets.leadconnectorhq.com/loader.js"
  chatWidgetSrc: "",
  chatWidgetResourcesUrl: "",   // data-resources-url from the same snippet
  chatWidgetId: "",             // data-widget-id from the same snippet

  // Tracking IDs — injected on every page when non-empty.
  ga4Id: "",        // e.g. "G-XXXXXXXXXX"
  gtmId: "",        // e.g. "GTM-XXXXXXX"
  metaPixelId: "",  // e.g. "1234567890"
};
