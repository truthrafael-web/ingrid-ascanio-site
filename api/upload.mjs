// Direct file upload relay. Runs as a Vercel serverless function.
// Stores attached files in Vercel Blob and returns their links to the page.
//
// DISCONNECTED 2026-09-09 (Rafael's instruction). This relay used to forward
// every submission to a GoHighLevel inbound webhook held in GHL_WEBHOOK_URL.
// That engagement has ended, so the forward is removed at the code level and
// the environment variable is deliberately no longer read. Deleting the var in
// the Vercel dashboard is still worth doing, but this file no longer depends
// on anyone remembering to.
//
// Setup (one-time, in the Vercel dashboard):
//   1. Storage -> Create -> Blob  (auto-sets BLOB_READ_WRITE_TOKEN)
// Without Blob the endpoint returns 501 and the site falls back gracefully.

import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

const MAX_TOTAL = 20 * 1024 * 1024;
const OK_TYPES = /\.(pdf|jpe?g|png|heic|zip|docx?|xlsx?)$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(501).json({ error: 'Blob storage not configured' });

  try {
    // Vercel node functions expose the raw request; use the Web API via Request
    const form = await new Request(`https://x${req.url}`, {
      method: 'POST',
      headers: req.headers,
      body: req,
      duplex: 'half',
    }).formData();

    const fields = {};
    const files = [];
    let total = 0;
    for (const [key, value] of form.entries()) {
      if (typeof value === 'object' && value && typeof value.arrayBuffer === 'function') {
        if (!OK_TYPES.test(value.name || '')) continue;
        total += value.size || 0;
        if (total > MAX_TOTAL) return res.status(413).json({ error: 'Files exceed 20 MB total' });
        files.push(value);
      } else if (key !== 'company') {
        fields[key] = String(value);
      }
    }

    const uploaded = [];
    for (const f of files) {
      const safe = (f.name || 'document').replace(/[^\w.\-]+/g, '_');
      const stamp = new Date().toISOString().slice(0, 10);
      const blob = await put(`ingrid-uploads/${stamp}/${Date.now()}-${safe}`, f, {
        access: 'public',
        addRandomSuffix: true,
      });
      uploaded.push({ name: f.name, size: f.size, url: blob.url });
    }

    const payload = {
      ...fields,
      files: uploaded,
      files_summary: uploaded.map(u => `${u.name}: ${u.url}`).join('\n'),
    };

    // No outbound forward. Files are stored and their links returned to the
    // page, which reports success to the visitor. Nothing leaves for a CRM.
    console.info('upload stored, not forwarded', payload.files_summary);

    return res.status(200).json({ ok: true, files: uploaded.length });
  } catch (err) {
    console.error('upload error', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
