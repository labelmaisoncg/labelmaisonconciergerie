// =============================================================================
// /api/crm-agenda/<clé> — agenda des relances du CRM au format iCalendar, pour
// un abonnement (Calendrier d'Apple, Google Agenda, Outlook). Lecture seule :
// rien n'est jamais écrit, ni dans le CRM ni ailleurs.
// Clés : api/_agenda.ts ; contenu : src/erp/data/agenda-crm.ts.
// =============================================================================

import { calendrierRelances } from '../../src/erp/data/agenda-crm.js';
import { horodatageParis } from '../../src/erp/data/repull.js';
import type { ContactCrm } from '../../src/erp/data/types.js';
import { baseErp, configuration } from '../_erp-repull.js';
import { lienAgendaValide } from '../_agenda.js';

export default async function handler(req: any, res: any) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const c = configuration();
  if (!c.motDePasse) {
    console.error('[crm-agenda] ERP_PASSWORD absent : CRM inaccessible.');
    return res.status(503).end();
  }
  const q = req.query?.cle;
  const cle = String(Array.isArray(q) ? q[0] : (q ?? '')).replace(/\.ics$/i, '').trim();
  try {
    const base = baseErp(c);
    const lien = await lienAgendaValide(base, cle);
    // Lien inconnu ou coupé : 404, sans dire lequel des deux.
    if (!lien) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).end();
    }
    const maintenant = horodatageParis();
    const ics = calendrierRelances(await base.lire<ContactCrm>('crm'), { aujourdhui: maintenant.slice(0, 10), maintenant, filtre: lien.filtre });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="relances-crm.ics"');
    // Privé : jamais gardé par un cache partagé (chaque lien a son contenu).
    res.setHeader('Cache-Control', 'private, max-age=300');
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(ics);
  } catch (e) {
    console.error('[crm-agenda]', e);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).end();
  }
}
