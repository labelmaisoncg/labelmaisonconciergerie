/**
 * Configuration et garde-fous de sécurité.
 *
 * Règle fondamentale : un bot Telegram est PUBLIC. N'importe qui connaissant son
 * nom peut lui écrire. La whitelist de chat_id est la seule chose qui empêche un
 * inconnu de piloter la conciergerie — elle échoue donc en mode fermé.
 */

const env = (nom: string): string => process.env[nom] ?? '';

export const TELEGRAM_BOT_TOKEN = env('TELEGRAM_BOT_TOKEN');
export const TELEGRAM_SECRET_TOKEN = env('TELEGRAM_SECRET_TOKEN');
export const ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY');
export const OPENAI_API_KEY = env('OPENAI_API_KEY');

/** Liste blanche des chat_id autorisés. Vide = personne. */
export const ALLOWED_CHAT_IDS: ReadonlySet<string> = new Set(
  env('TELEGRAM_ALLOWED_CHAT_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export const chatAutorise = (chatId: number | string): boolean =>
  ALLOWED_CHAT_IDS.has(String(chatId));

/**
 * Vérifie le secret partagé posé sur le webhook via setWebhook.
 * Sans lui, n'importe qui connaissant l'URL Vercel peut simuler des messages.
 * Comparaison à temps constant pour ne pas fuiter le secret octet par octet.
 */
export const secretValide = (recu: string | undefined): boolean =>
  egalTempsConstant(TELEGRAM_SECRET_TOKEN, recu);

/**
 * Comparaison de secrets à temps constant. Un attendu vide ne valide jamais
 * rien : un secret non configuré doit fermer la porte, pas l'ouvrir.
 */
export const egalTempsConstant = (attendu: string | undefined, recu: string | undefined): boolean => {
  if (!attendu) return false;
  const a = Buffer.from(attendu);
  const b = Buffer.from(recu ?? '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
};

/** Vérifie au démarrage que le minimum vital est configuré. */
export const configManquante = (): string[] => {
  const manque: string[] = [];
  if (!TELEGRAM_BOT_TOKEN) manque.push('TELEGRAM_BOT_TOKEN');
  if (!TELEGRAM_SECRET_TOKEN) manque.push('TELEGRAM_SECRET_TOKEN');
  if (!ANTHROPIC_API_KEY) manque.push('ANTHROPIC_API_KEY');
  if (ALLOWED_CHAT_IDS.size === 0) manque.push('TELEGRAM_ALLOWED_CHAT_IDS');
  return manque;
};
