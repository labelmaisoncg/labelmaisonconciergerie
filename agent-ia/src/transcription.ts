/**
 * Transcription des messages vocaux.
 *
 * Claude ne traite pas l'audio (texte, images et PDF uniquement) : c'est la seule
 * brique non-Anthropic du projet. On passe par Whisper, ~0,003 € pour un vocal
 * de 30 secondes.
 */

import { OPENAI_API_KEY } from './config.js';

/**
 * Vocabulaire injecté dans Whisper pour qu'il ne massacre pas les noms propres.
 * Sans ça, « Etigny » et « Ba'cam » ressortent en bouillie et l'agent agit sur le
 * mauvais logement. À compléter au fur et à mesure des logements et prestataires.
 */
const VOCABULAIRE =
  'Label Maison Conciergerie, Airbnb, Booking, Channex, conciergerie, ménage, ' +
  "check-in, check-out, Massy, Évry, Étigny, Ba'cam Spa, Essonne, Sens, Arpajon, " +
  'Athis-Mons, Brétigny-sur-Orge, love room, logement, voyageur, prestataire.';

export const transcriptionDisponible = (): boolean => Boolean(OPENAI_API_KEY);

export async function transcrire(audio: ArrayBuffer, nomFichier = 'vocal.ogg'): Promise<string> {
  const formulaire = new FormData();
  formulaire.append('file', new Blob([audio]), nomFichier);
  formulaire.append('model', 'whisper-1');
  formulaire.append('language', 'fr');
  formulaire.append('prompt', VOCABULAIRE);

  const reponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formulaire,
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`[transcription] échec ${reponse.status} : ${detail.slice(0, 200)}`);
  }

  const { text } = (await reponse.json()) as { text: string };
  return text.trim();
}
