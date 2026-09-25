/**
 * Configuration de l'ERP : mode de données et projet Supabase de Label Maison.
 *
 * - Mode « reel » (production, par défaut) : données dans la base Supabase de
 *   Label Maison, connexion par e-mail et mot de passe.
 * - Mode « demo » : UNIQUEMENT en développement local, quand
 *   VITE_ERP_DEMO=1 est défini au lancement (jeu de démonstration en mémoire).
 *
 * La clé « anon » est publique par conception (elle part dans le navigateur) :
 * ce sont les règles RLS de supabase/erp-installation.sql qui protègent les
 * données. Aucune clé secrète (service_role) ne doit jamais apparaître ici.
 */

/** Lecture tolérante de import.meta.env (absent quand le code tourne sous Node, tests). */
const ENV: Record<string, string | undefined> =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

/** Projet Supabase de Label Maison (valeurs publiques, utilisées si Vercel n'en fournit pas). */
const URL_PAR_DEFAUT = 'https://ftfwnomkbjtlpijdevgx.supabase.co';
const CLE_ANON_PAR_DEFAUT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0Zndub21rYmp0bHBpamRldmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NDE0ODEsImV4cCI6MjEwMzMxNzQ4MX0.rKk8o84gAIw4Acz-kQM8w1Eb3yoc-Ec1cIuaJk6G5qs';

const urlEnv = ENV.VITE_SUPABASE_URL?.trim();
const cleEnv = ENV.VITE_SUPABASE_ANON_KEY?.trim();
// Les deux variables vont ensemble : une URL sans sa clé (ou l'inverse) ne
// fonctionnerait pas, on garde alors le couple par défaut.
const envComplet = !!(urlEnv && cleEnv);

export const SUPABASE_URL = envComplet ? urlEnv! : URL_PAR_DEFAUT;
export const SUPABASE_ANON_KEY = envComplet ? cleEnv! : CLE_ANON_PAR_DEFAUT;

/** Schéma Postgres de l'ERP (exposé à l'API par erp-installation.sql). */
export const SCHEMA_ERP = 'erp';

/** Démo : seulement si VITE_ERP_DEMO=1 (développement local, captures, tests). */
export const MODE_DEMO = ENV.VITE_ERP_DEMO === '1';
export const MODE: 'demo' | 'reel' = MODE_DEMO ? 'demo' : 'reel';

/** Page où revient le lien « mot de passe oublié » (à autoriser dans Supabase, Authentication, URL configuration). */
export const URL_RETOUR_MOT_DE_PASSE = 'https://www.labelmaisoncg.fr/erp';

/** File d'attente des écritures non confirmées (survit à un rechargement). */
export const CLE_FILE_ATTENTE = 'lm-erp-file-attente';
