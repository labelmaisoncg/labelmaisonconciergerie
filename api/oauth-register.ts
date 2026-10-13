// =============================================================================
// /api/oauth-register — enregistrement dynamique d'un client OAuth (RFC 7591),
// utilisé par Claude quand on ajoute le connecteur « CRM Label Maison ».
//
// Sans état : seules les adresses de retour de Claude sont acceptées
// (src/erp/data/oauth-regles.ts), et elles sont revérifiées à chaque
// autorisation. Le client est public (PKCE, pas de secret).
// =============================================================================

import crypto from 'node:crypto';
import { redirectionPermise } from '../src/erp/data/oauth-regles.js';
import { lireCorps } from './_erp-repull.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'invalid_request', error_description: 'POST attendu.' });
  }
  const corps = lireCorps(req);
  const adresses = corps.redirect_uris;
  if (!Array.isArray(adresses) || !adresses.length || adresses.length > 10 || !adresses.every(redirectionPermise)) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'Seules les adresses de retour de Claude sont acceptées.',
    });
  }
  const nom = typeof corps.client_name === 'string' ? corps.client_name.slice(0, 100) : 'Claude';
  return res.status(201).json({
    client_id: `claude-${crypto.randomBytes(12).toString('hex')}`,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: nom,
    redirect_uris: adresses,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'crm',
  });
}
