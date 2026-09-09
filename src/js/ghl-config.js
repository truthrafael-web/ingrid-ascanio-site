// ============================================================
//  Integration config - Ingrid Ascanio · Miami Mortgage
//
//  All CRM integrations are OFF. Every field below is empty on
//  purpose, and the site runs on its own built-in fallbacks:
//
//    webhookUrl ""  -> contact and upload forms open a pre-filled
//                      email to ingrid.ascanio@pmfmortgage.com
//    calendarUrl "" -> every "Book a call" button routes to the
//                      contact form on the same page (or /contact/)
//    formUrl ""     -> "Start your pre-approval" routes to /contact/
//
//  Do not put a third-party CRM URL back in here. If Ingrid adopts
//  her own scheduler or CRM, her own URLs drop straight in and the
//  buttons pick them up on the next build.
// ============================================================
window.GHL = {
  // Inbound webhook that would receive site form submissions as JSON.
  // Empty: submissions become an email to Ingrid instead.
  webhookUrl: "",

  // Full URL of a form for "Start your pre-approval" CTAs.
  // Empty: clicks go to the contact form.
  formUrl: "",

  // Full URL of a booking calendar for "Book a call" CTAs.
  // Empty: clicks go to the contact form.
  calendarUrl: "",

  // Form (with file-upload field) to EMBED on /upload-documents/.
  // Empty: the built-in native upload form is used.
  uploadFormEmbedUrl: "",

  // Tracking IDs - injected on every page when non-empty.
  ga4Id: "",        // e.g. "G-XXXXXXXXXX"
  gtmId: "",        // e.g. "GTM-XXXXXXX"
  metaPixelId: "",  // e.g. "1234567890"
};
