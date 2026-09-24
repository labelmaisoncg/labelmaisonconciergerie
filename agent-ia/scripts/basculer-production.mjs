#!/usr/bin/env node
/**
 * Bascule du staging Channex vers la production.
 *
 * Les deux environnements sont des comptes séparés : aucun groupe, aucune
 * propriété, aucun canal n'existe des deux côtés. Tous les identifiants Channex
 * stockés en base pointent donc vers des objets qui n'existeront plus après la
 * bascule — d'où l'effacement des données liées.
 *
 * Ce qui est CONSERVÉ : les membres et leurs rôles (dont l'éditeur), pour ne pas
 * avoir à se réinviter soi-même.
 *
 *   node --env-file=.env.local scripts/basculer-production.mjs <CLE_PRODUCTION>
 *   node --env-file=.env.local scripts/basculer-production.mjs <CLE> --appliquer
 *
 * Sans --appliquer, le script se contente de vérifier et d'annoncer.
 */

import postgres from 'postgres';

const cle = process.argv[2];
const appliquer = process.argv.includes('--appliquer');

if (!cle || cle.startsWith('--')) {
  console.error('Usage : node --env-file=.env.local scripts/basculer-production.mjs <CLE_PRODUCTION> [--appliquer]');
  process.exit(1);
}

const PROD = 'https://secure.channex.io';

// --- 1. La clé fonctionne-t-elle vraiment en production ? ---

const appel = async (chemin) => {
  const r = await fetch(`${PROD}/api/v1${chemin}`, { headers: { 'user-api-key': cle } });
  return { code: r.status, corps: await r.text() };
};

console.log('Vérification de la clé sur secure.channex.io…');
const proprietes = await appel('/properties');
if (proprietes.code === 401) {
  console.error('  ✗ Clé refusée (401). Vérifie qu’elle vient bien du compte PRODUCTION.');
  process.exit(1);
}
if (proprietes.code !== 200) {
  console.error(`  ✗ Réponse inattendue ${proprietes.code} : ${proprietes.corps.slice(0, 200)}`);
  process.exit(1);
}

const data = JSON.parse(proprietes.corps);
console.log(`  ✓ Clé valide — ${data.meta?.total ?? 0} propriété(s) sur le compte.`);

// L'app Messaging & Reviews est-elle installée ? Sans elle, la messagerie
// voyageur répond 403 et l'agent ne verra aucun message.
const fils = await appel('/message_threads?pagination%5Blimit%5D=1');
console.log(
  fils.code === 200
    ? '  ✓ Messagerie accessible (app Messaging & Reviews installée).'
    : `  ⚠ Messagerie inaccessible (${fils.code}) — installe l’app « Messaging & Reviews » dans Applications → Manage Apps, sinon les messages voyageurs resteront invisibles.`,
);

// --- 2. Ce qui sera effacé ---

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} });

const compter = async (table) => {
  const [r] = await sql`select count(*)::int as n from ${sql(table)}`;
  return r.n;
};

const tables = ['conciergeries', 'logements', 'liens_connexion', 'conversations', 'menages', 'connaissances', 'souvenirs'];
console.log('\nDonnées liées au staging, à effacer :');
for (const t of tables) console.log(`  ${t} : ${await compter(t)}`);
const membres = await compter('membres');
console.log(`\nConservés : membres (${membres}), dont les rôles.`);

if (!appliquer) {
  console.log('\nRien n’a été modifié. Relance avec --appliquer pour effacer.');
  await sql.end();
  process.exit(0);
}

// --- 3. Effacement, en gardant les membres ---

const roles = await sql`select chat_id, role, prenom from membres`;
await sql`truncate conversations, liens_connexion, actions_en_attente, actions_log,
          souvenirs, initiatives, connaissances, menages, prestataires,
          messages_traites, invitations, logements, membres, conciergeries cascade`;

// On recrée l'éditeur pour qu'il puisse réinviter les conciergeries.
const editeurs = roles.filter((r) => r.role === 'editeur');
for (const e of editeurs) {
  const [c] = await sql`insert into conciergeries (nom) values (${'Label Maison Conciergerie'}) returning id`;
  await sql`insert into membres (conciergerie_id, chat_id, role, prenom)
            values (${c.id}, ${e.chat_id}, 'editeur', ${e.prenom})`;
}

console.log(`\n✓ Base remise à zéro. ${editeurs.length} éditeur(s) rétabli(s).`);
console.log('\nIl reste à faire, côté Vercel :');
console.log('  vercel env rm CHANNEX_API_KEY production --yes');
console.log('  printf %s "<CLE>" | vercel env add CHANNEX_API_KEY production');
console.log('  vercel env rm CHANNEX_BASE_URL production --yes');
console.log('  printf %s "https://secure.channex.io" | vercel env add CHANNEX_BASE_URL production');
console.log('  vercel deploy --prod --yes');
console.log('\nPuis réinviter chaque conciergerie : « invite <nom> ».');

await sql.end();
