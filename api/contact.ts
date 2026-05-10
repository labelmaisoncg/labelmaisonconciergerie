import { Resend } from 'resend';

type Payload = {
  type?: 'lead' | 'contact';
  adresse?: string;
  chambres?: string;
  email?: string;
  tel?: string;
  message?: string;
};

const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const row = (label: string, value: unknown): string =>
  value
    ? `<tr><td style="padding:6px 12px;color:#6b6b6b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 12px;color:#0a0a0a;font-size:15px">${escapeHtml(value).replace(/\n/g, '<br />')}</td></tr>`
    : '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res
      .status(500)
      .json({ ok: false, error: 'RESEND_API_KEY non configurée côté serveur.' });
  }

  let body: Payload;
  try {
    body =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Payload) ?? {};
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON invalide.' });
  }

  const { type, adresse, chambres, email, tel, message } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res
      .status(400)
      .json({ ok: false, error: 'Adresse e-mail manquante ou invalide.' });
  }

  const TO = process.env.CONTACT_TO_EMAIL || 'labelmaisonconciergerie@gmail.com';
  const FROM =
    process.env.CONTACT_FROM_EMAIL ||
    'Label Maison Conciergerie <onboarding@resend.dev>';

  const isLead = type === 'lead';
  const subject = isLead
    ? `[Lead] Nouveau prospect — ${adresse || email}`
    : `[Contact] Nouveau message — ${adresse || email}`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.06)">
    <div style="background:#556B2F;color:#fff;padding:20px 24px">
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85">Label Maison Conciergerie</p>
      <h1 style="margin:6px 0 0;font-size:20px">${escapeHtml(isLead ? 'Nouveau prospect' : 'Nouveau message contact')}</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${row('Type', isLead ? 'Lead (page d’accueil)' : 'Formulaire contact')}
      ${row('Adresse du bien', adresse)}
      ${row('Chambres', chambres)}
      ${row('Email', email)}
      ${row('Téléphone', tel)}
      ${row('Message', message)}
    </table>
    <p style="padding:16px 24px;margin:0;color:#6b6b6b;font-size:12px;border-top:1px solid rgba(0,0,0,.06)">Reçu via labelmaisoncgexperience.fr — répondre directement à cet e-mail revient au prospect.</p>
  </div>
</body></html>`;

  const text = [
    isLead ? 'Nouveau prospect (lead)' : 'Nouveau message contact',
    '',
    adresse && `Adresse du bien : ${adresse}`,
    chambres && `Chambres : ${chambres}`,
    `Email : ${email}`,
    tel && `Téléphone : ${tel}`,
    message && `\nMessage :\n${message}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[contact] Resend error:', error);
      return res
        .status(502)
        .json({ ok: false, error: 'Envoi e-mail échoué côté Resend.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] unexpected error:', err);
    return res.status(500).json({ ok: false, error: 'Erreur serveur inattendue.' });
  }
}
