/**
 * « Créer mon compte » : invitation d'un membre de l'équipe (Paramètres →
 * Équipe → Envoyer l'invitation, route api/erp-invitation.ts).
 *
 * Le lien ne porte que l'adresse, après « # » (jamais envoyée au serveur) :
 * il n'ouvre rien seul. La page d'accès (middleware.ts) pré-remplit l'adresse,
 * la personne choisit son mot de passe, Supabase lui envoie un lien de
 * confirmation ; c'est cette confirmation ET sa ligne dans les membres de
 * l'espace qui ouvrent l'ERP (/erp/connexion). Le lien vise toujours le site
 * fixe, jamais l'adresse de la page qui l'a demandé.
 *
 * Module pur : partagé par le serveur, l'écran Équipe et les tests.
 */

/** Page d'accès de l'ERP (site fixe, = URL_RETOUR_MOT_DE_PASSE). */
export const ADRESSE_ERP = 'https://www.labelmaisoncg.fr/erp';

export const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normaliserEmailInvitation = (email: unknown): string => (typeof email === 'string' ? email.trim().toLowerCase() : '');

/** Lien « Créer mon compte » : la page d'accès, l'adresse pré-remplie. */
export const lienCreationCompte = (email: string): string => `${ADRESSE_ERP}#creer=${encodeURIComponent(normaliserEmailInvitation(email))}`;

const echapperHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** E-mail d'invitation, au nom de l'espace. */
export function emailInvitation(o: { email: string; espace: string }): { sujet: string; text: string; html: string } {
  const lien = lienCreationCompte(o.email);
  const sujet = `Votre accès à l’ERP ${o.espace}`;
  const text = [
    'Bonjour,',
    '',
    `Vous faites maintenant partie de l’équipe ${o.espace} dans l’ERP.`,
    '',
    `Créer mon compte : ${lien}`,
    '',
    `Utilisez cette adresse (${o.email}) et choisissez votre mot de passe. Vous recevrez ensuite un e-mail de confirmation : ouvrez son lien pour entrer dans l’ERP.`,
    '',
    'Si vous n’attendiez pas ce message, ignorez-le.',
  ].join('\n');
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#14110e">
<p>Bonjour,</p>
<p>Vous faites maintenant partie de l’équipe ${echapperHtml(o.espace)} dans l’ERP.</p>
<p><a href="${echapperHtml(lien)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#8a6424;color:#ffffff;text-decoration:none;font-weight:600">Créer mon compte</a></p>
<p>Utilisez cette adresse (${echapperHtml(o.email)}) et choisissez votre mot de passe. Vous recevrez ensuite un e-mail de confirmation&nbsp;: ouvrez son lien pour entrer dans l’ERP.</p>
<p style="color:rgba(20,17,14,.68)">Si vous n’attendiez pas ce message, ignorez-le.</p>
</div>`;
  return { sujet, text, html };
}
