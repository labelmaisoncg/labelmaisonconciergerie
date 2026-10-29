import { Resend } from 'resend';
import { avecDelai, enregistrerDemandeCrm, notifierNouveauLead, type ResultatCrm } from './_erp-crm.js';
import { EMAIL_SUR } from '../src/erp/data/crm.js';
import { adresseIp, echapperHtml, freinEnvois, provenanceSite } from './_garde-formulaire.js';

type Payload = {
  type?: string;
  adresse?: string;
  chambres?: string;
  email?: string;
  tel?: string;
  /** Nom du champ téléphone des formulaires d'audit envoyés sans JavaScript. */
  telephone?: string;
  message?: string;
  // Champs additionnels du formulaire d'audit (silo SEO Airbnb Essonne)
  prenom?: string;
  ville?: string;
  typeBien?: string;
  page?: string;
  // Champs additionnels du Cercle LabelMaison (programme d'affiliation)
  nom?: string;
  profil?: string;
  dejaProprio?: string;
  // Honeypot anti-spam (doit rester vide)
  website?: string;
};

const escapeHtml = echapperHtml;

const row = (label: string, value: unknown): string =>
  value
    ? `<tr><td style="padding:6px 12px;color:#6b6b6b;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 12px;color:#0a0a0a;font-size:15px">${escapeHtml(value).replace(/\n/g, '<br />')}</td></tr>`
    : '';

/** Au plus 5 envois par adresse IP en 10 minutes (par instance du serveur : un frein, pas un mur). */
const tropDEnvois = freinEnvois(5, 10 * 60_000);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Frein, pas un mur : voir api/_garde-formulaire.ts.
  if (!provenanceSite(req)) {
    return res.status(403).json({ ok: false, error: 'Envoi refusé : utilisez le formulaire du site.' });
  }
  if (tropDEnvois(adresseIp(req))) {
    return res.status(429).json({ ok: false, error: 'Trop d’envois en peu de temps. Réessayez dans quelques minutes ou appelez-nous au +33 7 49 54 83 55.' });
  }

  const apiKey = process.env.RESEND_API_KEY;

  let body: Payload;
  try {
    body =
      typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as Payload) ?? {};
  } catch {
    return res.status(400).json({ ok: false, error: 'JSON invalide.' });
  }

  const { adresse, chambres, email, message, prenom, ville, page, nom, profil, dejaProprio, website } = body;
  const tel = body.tel || body.telephone;
  // Formulaire envoyé sans JavaScript : « type » porte le besoin (« Conciergerie
  // Airbnb »), pas le type de formulaire.
  const typesConnus = ['lead', 'contact', 'audit', 'cercle'];
  const type = typesConnus.includes(String(body.type)) ? body.type : body.prenom || body.page ? 'audit' : 'contact';
  const typeBien = body.typeBien || (typesConnus.includes(String(body.type)) ? undefined : body.type);

  // Honeypot : un bot remplit le champ caché « website ». On répond OK sans envoyer.
  if (website && String(website).trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  if (!email || !EMAIL_SUR.test(email.trim())) {
    return res
      .status(400)
      .json({ ok: false, error: 'Adresse e-mail manquante ou invalide.' });
  }

  const TO = process.env.CONTACT_TO_EMAIL || 'labelmaisonconciergerie@gmail.com';
  const FROM =
    process.env.CONTACT_FROM_EMAIL ||
    'Label Maison Conciergerie <onboarding@resend.dev>';

  const isLead = type === 'lead';
  const isAudit = type === 'audit';
  const isCercle = type === 'cercle';
  const heading = isCercle
    ? 'Nouvelle candidature — Cercle LabelMaison'
    : isAudit
      ? 'Nouvelle demande d’audit'
      : isLead
        ? 'Nouveau prospect'
        : 'Nouveau message contact';
  const subject = isCercle
    ? `[Cercle] Candidature — ${nom || email}`
    : isAudit
      ? `[Audit] Demande — ${ville || page || prenom || email}`
      : isLead
        ? `[Lead] Nouveau prospect — ${adresse || email}`
        : `[Contact] Nouveau message — ${adresse || email}`;

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f4f4f5;padding:24px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.06)">
    <div style="background:#A97C30;color:#fff;padding:20px 24px">
      <p style="margin:0;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85">Label Maison Conciergerie</p>
      <h1 style="margin:6px 0 0;font-size:20px">${escapeHtml(heading)}</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      ${row('Type', isCercle ? 'Candidature Cercle LabelMaison (affiliation)' : isAudit ? 'Demande d’audit (silo Airbnb)' : isLead ? 'Lead (page d’accueil)' : 'Formulaire contact')}
      ${row('Nom et prénom', nom)}
      ${row('Prénom', prenom)}
      ${row('Profil', profil)}
      ${row('A déjà un propriétaire en tête', dejaProprio)}
      ${row('Ville / zone', ville)}
      ${row('Type de bien', typeBien)}
      ${row('Adresse du bien', adresse)}
      ${row('Chambres', chambres)}
      ${row('Email', email)}
      ${row('Téléphone', tel)}
      ${row('Message', message)}
      ${row('Page source', page)}
    </table>
    <p style="padding:0 24px 16px;margin:0"><a href="https://www.labelmaisoncg.fr/erp/crm" style="display:inline-block;background:#8a6424;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 16px;border-radius:8px">Ouvrir dans le CRM</a></p>
    <p style="padding:16px 24px;margin:0;color:#6b6b6b;font-size:12px;border-top:1px solid rgba(0,0,0,.06)">Reçu via labelmaisoncgexperience.fr — répondre directement à cet e-mail revient au prospect.</p>
  </div>
</body></html>`;

  const text = [
    heading,
    '',
    nom && `Nom et prénom : ${nom}`,
    prenom && `Prénom : ${prenom}`,
    profil && `Profil : ${profil}`,
    dejaProprio && `A déjà un propriétaire en tête : ${dejaProprio}`,
    ville && `Ville / zone : ${ville}`,
    typeBien && `Type de bien : ${typeBien}`,
    adresse && `Adresse du bien : ${adresse}`,
    chambres && `Chambres : ${chambres}`,
    `Email : ${email}`,
    tel && `Téléphone : ${tel}`,
    page && `Page source : ${page}`,
    message && `\nMessage :\n${message}`,
    '',
    'Ouvrir dans le CRM : https://www.labelmaisoncg.fr/erp/crm',
  ]
    .filter(Boolean)
    .join('\n');

  // Le CRM de l'ERP (ligne « À appeler ») et l'e-mail partent en parallèle.
  // La demande est acceptée dès que l'un des deux a réussi : un contact
  // n'est jamais perdu parce qu'un seul des deux services est en panne.
  const crm = avecDelai(
    enregistrerDemandeCrm({ type, nom, prenom, email, tel, ville, typeBien, adresse, chambres, message, page, profil }),
    6000,
  ).catch((err): ResultatCrm | null => {
    console.error('[contact] CRM :', err);
    return null;
  });

  const envoi = (async (): Promise<boolean> => {
    if (!apiKey) {
      console.error('[contact] RESEND_API_KEY non configurée côté serveur.');
      return false;
    }
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send({ from: FROM, to: TO, replyTo: email, subject, html, text });
      if (error) {
        console.error('[contact] Resend error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[contact] unexpected error:', err);
      return false;
    }
  })();

  // Notification au gérant (« Nouvelle demande à appeler ») : dès que la ligne CRM est écrite, en même
  // temps que l'e-mail, avant de répondre (une fonction Vercel s'arrête à la réponse), bornée à 3 s,
  // sans effet sur la réponse (au pire 6 s de CRM + 3 s, comme avant l'e-mail).
  const notification = crm.then((r) =>
    r && r.etat !== 'inactif'
      ? avecDelai(notifierNouveauLead(r.contact, r.etat === 'cree'), 3000).catch((err) => {
          console.error('[contact] notification :', err instanceof Error ? err.message : err);
        })
      : undefined,
  );
  const [resultatCrm, mailEnvoye] = await Promise.all([crm, envoi, notification]);
  const crmOk = !!resultatCrm && resultatCrm.etat !== 'inactif';
  if (mailEnvoye || crmOk) return res.status(200).json({ ok: true });
  return res
    .status(502)
    .json({ ok: false, error: 'Envoi impossible pour le moment. Réessayez ou appelez-nous au +33 7 49 54 83 55.' });
}
