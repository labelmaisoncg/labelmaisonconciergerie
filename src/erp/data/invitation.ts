/**
 * « Créer mon compte » : invitation d'un membre de l'équipe (Paramètres →
 * Équipe → Envoyer l'invitation, route api/erp-invitation.ts) ou d'une
 * conciergerie à ouvrir son espace (Paramètres → Espaces, api/erp-espaces.ts).
 *
 * Le lien porte l'adresse et un code à usage unique, après « # » (jamais
 * envoyés au serveur du site) : « /erp#creer=<adresse>&code=<code> ». La base
 * n'en garde que l'empreinte SHA-256 (erp.invitations, erp.invitations_espace),
 * avec une échéance. La page d'accès (middleware.ts) garde le code sur
 * l'appareil (localStorage, CLE_INVITATION) le temps de créer le compte et de
 * confirmer l'adresse ; à la première entrée, /erp/connexion pose le mot de
 * passe choisi, ferme les autres sessions du compte et active l'accès avec ce
 * code (erp.activer) : un compte créé avant, par quelqu'un d'autre, à la même
 * adresse, n'obtient rien. Le lien vise toujours le site fixe, jamais
 * l'adresse de la page qui l'a demandé.
 *
 * Module pur : partagé par le serveur, l'écran Équipe, l'application et les tests.
 */

/** Page d'accès de l'ERP (site fixe, = URL_RETOUR_MOT_DE_PASSE). */
export const ADRESSE_ERP = 'https://www.labelmaisoncg.fr/erp';

export const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Forme d'un code d'invitation (le serveur tire 32 octets en base64url : 43 caractères ; même règle que erp.activer). */
export const CODE_INVITATION = /^[A-Za-z0-9_-]{20,100}$/;

/** Durée d'une invitation (erp.inviter_membre, erp.inviter_espace). */
export const DUREE_INVITATION_JOURS = 14;

export const normaliserEmailInvitation = (email: unknown): string => (typeof email === 'string' ? email.trim().toLowerCase() : '');

export const codeInvitationValide = (code: unknown): code is string => typeof code === 'string' && CODE_INVITATION.test(code);

/** Lien « Créer mon compte » : la page d'accès, l'adresse pré-remplie et le code de l'invitation. */
export const lienCreationCompte = (email: string, code?: string): string =>
  `${ADRESSE_ERP}#creer=${encodeURIComponent(normaliserEmailInvitation(email))}${codeInvitationValide(code) ? `&code=${encodeURIComponent(code)}` : ''}`;

/* ------------------------------------------- code gardé sur l'appareil */

/** Clé de stockage partagée par la page d'accès (middleware.ts) et l'application. */
export const CLE_INVITATION = 'lm-erp-invitation';

export interface InvitationGardee {
  email: string;
  code: string;
  /** Échéance (ms) au-delà de laquelle le code n'est plus proposé. */
  expire: number;
}

/** Lecture tolérante de ce qui est gardé (null : rien de valable, ou échu). */
export function lireInvitationGardee(brut: string | null | undefined, maintenant: number = Date.now()): InvitationGardee | null {
  if (!brut) return null;
  try {
    const x = JSON.parse(brut) as Partial<InvitationGardee>;
    const email = normaliserEmailInvitation(x?.email);
    if (!EMAIL_VALIDE.test(email) || !codeInvitationValide(x?.code) || typeof x?.expire !== 'number' || x.expire <= maintenant) return null;
    return { email, code: x.code, expire: x.expire };
  } catch {
    return null;
  }
}

export const invitationAGarder = (email: string, code: string, maintenant: number = Date.now()): InvitationGardee => ({
  email: normaliserEmailInvitation(email),
  code,
  expire: maintenant + DUREE_INVITATION_JOURS * 24 * 3600_000,
});

/** Code à présenter pour ce compte : seulement s'il a été gardé pour la même adresse. */
export const codePourCompte = (gardee: InvitationGardee | null, email: string): string | undefined =>
  gardee && gardee.email === normaliserEmailInvitation(email) ? gardee.code : undefined;

/* ---------------------------------------------------------------- e-mail */

const echapperHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** E-mail d'invitation d'un membre, au nom de l'espace. */
export function emailInvitation(o: { email: string; espace: string; code?: string }): { sujet: string; text: string; html: string } {
  const lien = lienCreationCompte(o.email, o.code);
  const sujet = `Votre accès à l’ERP ${o.espace}`;
  const consigne = `Ouvrez ce lien sur l’appareil où vous utiliserez l’ERP, avec cette adresse (${o.email}) : choisissez votre mot de passe, puis confirmez l’adresse avec l’e-mail que vous recevrez. Vous avez déjà un compte ? Ouvrez le lien et connectez-vous.`;
  const validite = `Ce lien est personnel : il sert une seule fois et reste valable ${DUREE_INVITATION_JOURS} jours.`;
  const text = [
    'Bonjour,',
    '',
    `Vous faites maintenant partie de l’équipe ${o.espace} dans l’ERP.`,
    '',
    `Créer mon compte : ${lien}`,
    '',
    consigne,
    validite,
    '',
    'Si vous n’attendiez pas ce message, ignorez-le.',
  ].join('\n');
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#14110e">
<p>Bonjour,</p>
<p>Vous faites maintenant partie de l’équipe ${echapperHtml(o.espace)} dans l’ERP.</p>
<p><a href="${echapperHtml(lien)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#8a6424;color:#ffffff;text-decoration:none;font-weight:600">Créer mon compte</a></p>
<p>${echapperHtml(consigne)}</p>
<p style="color:rgba(20,17,14,.68)">${echapperHtml(validite)} Si vous n’attendiez pas ce message, ignorez-le.</p>
</div>`;
  return { sujet, text, html };
}
