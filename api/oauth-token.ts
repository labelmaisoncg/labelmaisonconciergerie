// =============================================================================
// /api/oauth-token — point de jeton OAuth 2.1 du connecteur Claude :
//   grant_type=authorization_code (+ code_verifier PKCE)
//   grant_type=refresh_token      (rotation)
// Logique : api/_oauth.ts. Le code et le jeton de rafraîchissement sont
// cherchés dans la base de l'espace qu'ils portent (Label Maison sans préfixe).
// =============================================================================

import { ID_LABEL_MAISON } from '../src/erp/data/espaces.js';
import { espaceDuJeton } from '../src/erp/data/oauth-regles.js';
import { baseErp, configuration, lireCorps } from './_erp-repull.js';
import { espaceOuvertAuJeton } from './_erp-espaces.js';
import { echangerCode, ErreurOAuth, rafraichir } from './_oauth.js';

/** Corps en application/x-www-form-urlencoded (norme) ou en JSON. */
function parametres(req: any): Record<string, string> {
  const b = req.body;
  const brut: Record<string, unknown> =
    typeof b === 'string' && !b.trim().startsWith('{') ? Object.fromEntries(new URLSearchParams(b)) : lireCorps(req);
  return Object.fromEntries(Object.entries(brut).map(([k, v]) => [k, typeof v === 'string' ? v : '']));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'invalid_request', error_description: 'POST attendu.' });
  }
  const c = configuration();
  if (!c.motDePasse) {
    console.error('[oauth-token] ERP_PASSWORD absent : base inaccessible.');
    return res.status(503).json({ error: 'temporarily_unavailable' });
  }
  const p = parametres(req);
  try {
    // Base de l'espace du code ou du jeton (préfixe) ; sans préfixe : Label Maison, comme avant.
    const valeur = p.grant_type === 'refresh_token' ? p.refresh_token : p.code;
    const espace = valeur ? espaceDuJeton(valeur) : ID_LABEL_MAISON;
    const ouvert = espace ? await espaceOuvertAuJeton(c, espace) : null;
    if (valeur && !ouvert && (p.grant_type === 'authorization_code' || p.grant_type === 'refresh_token')) {
      throw new ErreurOAuth('invalid_grant', p.grant_type === 'refresh_token' ? 'Jeton de rafraîchissement inconnu, expiré ou révoqué.' : 'Code inconnu, expiré ou déjà utilisé.');
    }
    const base = ouvert?.base ?? baseErp(c);
    if (p.grant_type === 'authorization_code') {
      return res.status(200).json(await echangerCode(base, { code: p.code, code_verifier: p.code_verifier, redirect_uri: p.redirect_uri, client_id: p.client_id }));
    }
    if (p.grant_type === 'refresh_token') {
      return res.status(200).json(await rafraichir(base, { refresh_token: p.refresh_token, client_id: p.client_id }));
    }
    return res.status(400).json({ error: 'unsupported_grant_type' });
  } catch (e) {
    if (e instanceof ErreurOAuth) return res.status(400).json({ error: e.code, error_description: e.message });
    console.error('[oauth-token]', e);
    return res.status(503).json({ error: 'temporarily_unavailable' });
  }
}
