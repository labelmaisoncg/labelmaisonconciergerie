// =============================================================================
// Dossier propriétaire reçu du site : enregistrement dans l'ERP (propriétaire,
// logement « en lancement », dossier complet, trace sur le contact du CRM) et
// e-mail récapitulatif pour l'équipe. Écrit avec le compte d'équipe
// (ERP_PASSWORD), comme le CRM. Rien n'est envoyé aux plateformes : le
// logement créé n'a aucun lien Repull, la synchronisation l'ignore.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';
import { noterAppel, telephoneNormalise, trouverDoublon } from '../src/erp/data/crm.js';
import { ETAPES_DOSSIER, nomProprietaire, versLogement, versProprietaire, type DossierProprietaire } from '../src/erp/data/dossier-proprietaire.js';
import { lignesRecapitulatif, type Valeurs } from '../src/erp/data/etapes-formulaire.js';
import { horodatageParis } from '../src/erp/data/repull.js';
import type { ContactCrm, Proprietaire } from '../src/erp/data/types.js';
import { baseErp, configuration } from './_erp-repull.js';
import { echapperHtml } from './_garde-formulaire.js';

const AUTEUR = 'Dossier propriétaire';
const ERP = 'https://www.labelmaisoncg.fr/erp';

const id = (prefixe: string) => `${prefixe}-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
const texte = (v: Valeurs, k: string) => String(v[k] ?? '').trim();

export interface DossierEnregistre {
  dossier: DossierProprietaire;
  proprietaireExistant: boolean;
  nomLogement: string;
}

/** Propriétaire déjà connu (même e-mail ou même téléphone) : on le complète au lieu d'en créer un second. */
function proprietaireConnu(tous: Proprietaire[], v: Valeurs): Proprietaire | undefined {
  const email = texte(v, 'prop.email').toLowerCase();
  const tel = telephoneNormalise(texte(v, 'prop.tel'));
  return tous.find(
    (p) => (email && p.contact?.email?.trim().toLowerCase() === email) || (tel.length >= 9 && telephoneNormalise(p.contact?.telephone) === tel),
  );
}

export async function enregistrerDossier(v: Valeurs): Promise<DossierEnregistre | null> {
  const c = configuration();
  if (!c.motDePasse) return null;
  const base = baseErp(c);
  const maintenant = horodatageParis();
  const aujourdhui = maintenant.slice(0, 10);

  const [proprietaires, contacts] = await Promise.all([base.lire<Proprietaire>('proprietaires'), base.lire<ContactCrm>('crm')]);
  const existant = proprietaireConnu(proprietaires, v);
  const proprietaire = versProprietaire(v, { id: id('pro'), aujourdhui, existant });
  const logement = versLogement(v, { id: id('log'), proprietaireId: proprietaire.id });
  const contact = trouverDoublon(contacts, { email: texte(v, 'prop.email'), telephone: texte(v, 'prop.tel') });
  const dossier: DossierProprietaire = {
    id: id('dos'),
    proprietaireId: proprietaire.id,
    logementId: logement.id,
    ...(contact ? { contactCrmId: contact.id } : {}),
    recuLe: maintenant,
    valeurs: v,
  };

  await base.ecrire('proprietaires', [proprietaire], AUTEUR);
  await base.ecrire('logements', [logement], AUTEUR);
  await base.ecrire('dossiers', [dossier], AUTEUR);
  if (contact) {
    const trace = `Dossier propriétaire reçu : ${logement.nom}. ${ERP}/proprietaires/${proprietaire.id}`;
    await base.ecrire('crm', [noterAppel(contact, 'formulaire', AUTEUR, maintenant, trace)], AUTEUR);
  }
  return { dossier, proprietaireExistant: !!existant, nomLogement: logement.nom };
}

/** E-mail récapitulatif : toutes les réponses, partie par partie. */
export function emailDossier(v: Valeurs, enregistre: DossierEnregistre | null): { sujet: string; html: string; texte: string } {
  const nom = nomProprietaire(v);
  const logement = enregistre?.nomLogement ?? `${texte(v, 'bien.type')} ${texte(v, 'bien.ville')}`.trim();
  const sujet = `Dossier propriétaire : ${nom} · ${logement}`.replace(/[\r\n]+/g, ' ').slice(0, 180);
  const lignes = lignesRecapitulatif(ETAPES_DOSSIER, v).filter((l) => l.valeur);
  const parties = [...new Set(lignes.map((l) => l.partie))];

  const liens = enregistre
    ? [
        [`${ERP}/proprietaires/${enregistre.dossier.proprietaireId}`, enregistre.proprietaireExistant ? 'Fiche du propriétaire (déjà connu)' : 'Fiche du propriétaire'],
        [`${ERP}/logements/${enregistre.dossier.logementId}`, `Logement « ${logement} » (en lancement)`],
      ]
    : [];
  const alerte = enregistre
    ? ''
    : 'Le dossier n’a pas pu être enregistré dans l’ERP : toutes les réponses sont ci-dessous, à saisir à la main.';

  const html = `<!doctype html><html><body style="margin:0;background:#FBF9F4;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2C2418">
<div style="max-width:640px;margin:0 auto;padding:28px 20px">
<p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7C561D;font-weight:600">Dossier propriétaire</p>
<h1 style="margin:8px 0 4px;font-size:24px">${echapperHtml(nom)}</h1>
<p style="margin:0 0 16px;color:#6B6252;font-size:15px">${echapperHtml(logement)} · reçu le ${echapperHtml(new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' }))}</p>
${alerte ? `<p style="background:#F8E1DE;color:#8A2A22;padding:10px 14px;border-radius:8px;font-size:14px">${echapperHtml(alerte)}</p>` : ''}
${liens.map(([href, l]) => `<p style="margin:6px 0"><a href="${echapperHtml(href)}" style="color:#7C561D;font-weight:600">${echapperHtml(l)} →</a></p>`).join('')}
${parties
  .map(
    (p) => `<h2 style="margin:24px 0 8px;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#7C561D">${echapperHtml(p)}</h2>
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #E6DDC9;border-radius:8px">${lignes
      .filter((l) => l.partie === p)
      .map(
        (l) =>
          `<tr><td style="padding:8px 12px;border-bottom:1px solid #F0EADB;color:#6B6252;font-size:13px;vertical-align:top;width:38%">${echapperHtml(l.libelle)}</td><td style="padding:8px 12px;border-bottom:1px solid #F0EADB;font-size:14px">${echapperHtml(l.valeur).replace(/\n/g, '<br />')}</td></tr>`,
      )
      .join('')}</table>`,
  )
  .join('')}
<p style="margin-top:24px;color:#6B6252;font-size:12px">Envoyé depuis labelmaisoncg.fr/dossier-proprietaire. Répondre à cet e-mail écrit au propriétaire.</p>
</div></body></html>`;

  const texteBrut = [
    `Dossier propriétaire : ${nom}`,
    logement,
    alerte,
    ...liens.map(([href, l]) => `${l} : ${href}`),
    ...parties.flatMap((p) => ['', p.toUpperCase(), ...lignes.filter((l) => l.partie === p).map((l) => `${l.libelle} : ${l.valeur}`)]),
  ]
    .filter((x) => x !== undefined)
    .join('\n');

  return { sujet, html, texte: texteBrut };
}
