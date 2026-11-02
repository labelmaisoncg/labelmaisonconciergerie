/**
 * Auto-contrôle des règles des logements sans réseau : lien d'annonce Airbnb
 * saisi par l'équipe, ordre des photos (équipe d'abord), prix de la nuit
 * (plateforme, prix de base, puis moyenne constatée), volet terrain
 * (saisie ↔ logement, rôles de contact, fuitesTerrain pour la cloison).
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-logements.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-logements.mjs \
 *     && node /tmp/verifier-logements.mjs
 */
import { extraireIdAirbnb, idAirbnbDuLogement, lienAnnonceAirbnb } from './page-airbnb';
import { photosLogement, prixNuit } from '../modules/logements/_composants/stats';
import { LOGEMENTS } from './seed-referentiel';
import {
  CHAMPS_MENAGE,
  LIBELLE_ROLE_CONTACT,
  ROLES_CONTACT,
  appliquerTerrain,
  contactsRenseignes,
  erreursTerrain,
  fuitesTerrain,
  lienTelephone,
  menageRenseigne,
  nouveauContactSaisi,
  saisieTerrainInitiale,
  techniqueRenseignee,
  terrainDepuisSaisie,
} from './terrain';
import type { Logement } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

/** Logement minimal pour ces règles. */
const logement = (x: Partial<Logement> = {}): Logement =>
  ({
    id: 'log-x',
    nom: 'Studio',
    annonces: [],
    statut: 'actif',
    ...x,
  }) as Logement;

section('Lien de l’annonce Airbnb saisi par l’équipe');
for (const [lien, id] of [
  ['https://www.airbnb.fr/rooms/20669368', '20669368'],
  ['https://www.airbnb.com/rooms/20669368?adults=2&check_in=2026-11-02', '20669368'],
  ['airbnb.fr/rooms/123456', '123456'],
  ['  https://fr.airbnb.ca/rooms/42#photos  ', '42'],
  ['https://www.airbnb.co.uk/rooms/plus/987', '987'],
  ['https://airbnb.fr/rooms/55/', '55'],
] as const) {
  verifier(extraireIdAirbnb(lien) === id, `« ${lien.trim()} » → ${id} (${extraireIdAirbnb(lien)})`);
}
for (const lien of ['https://abnb.me/abc', 'https://www.booking.com/hotel/fr/x.html', 'https://www.airbnb.fr/rooms/abc', 'https://evil.example/airbnb.fr/rooms/1', 'https://airbnb.fr.evil.com/rooms/1', '']) {
  verifier(extraireIdAirbnb(lien) === undefined, `refusé : « ${lien} »`);
}
verifier(lienAnnonceAirbnb('123') === 'https://www.airbnb.fr/rooms/123', 'lien enregistré sous sa forme canonique');
verifier(
  idAirbnbDuLogement(logement({ annonces: [{ canal: 'booking', connecte: true }, { canal: 'airbnb', url: lienAnnonceAirbnb('77'), connecte: false }] })) === '77',
  'annonce uniquement Booking.com + lien Airbnb saisi : l’id Airbnb est connu',
);
verifier(idAirbnbDuLogement(logement({ annonces: [{ canal: 'booking', connecte: true }] })) === undefined, 'annonce uniquement Booking.com : pas d’id Airbnb');

section('Photos : celles de l’équipe d’abord');
{
  const l = logement({
    photosEquipe: ['stockage://erp-fichiers/logements/log-x/photos/b.jpg', 'stockage://erp-fichiers/logements/log-x/photos/a.jpg'],
    photos: ['https://a0.muscache.com/im/pictures/1.jpg', 'https://a0.muscache.com/im/pictures/2.jpg'],
    photoUrl: 'https://a0.muscache.com/im/pictures/1.jpg',
  });
  verifier(
    JSON.stringify(photosLogement(l)) ===
      JSON.stringify(['stockage://erp-fichiers/logements/log-x/photos/b.jpg', 'stockage://erp-fichiers/logements/log-x/photos/a.jpg', 'https://a0.muscache.com/im/pictures/1.jpg', 'https://a0.muscache.com/im/pictures/2.jpg']),
    `équipe d’abord (dans l’ordre choisi), plateformes ensuite, sans doublon (${JSON.stringify(photosLogement(l))})`,
  );
  verifier(
    JSON.stringify(photosLogement(logement({ photoUrl: 'stockage://erp-fichiers/logements/101.jpg', photos: ['https://cdn.x/1.jpg'] }))) === '["stockage://erp-fichiers/logements/101.jpg","https://cdn.x/1.jpg"]',
    'ancienne photo déposée (photoUrl « stockage:// ») : gardée, en premier',
  );
  verifier(JSON.stringify(photosLogement(logement({ photoUrl: 'https://cdn.x/couverture.jpg' }))) === '["https://cdn.x/couverture.jpg"]', 'seule la couverture de l’annonce : affichée');
  verifier(photosLogement(logement()).length === 0, 'aucune photo : liste vide (aplat neutre)');
}

section('Prix de la nuit : plateforme, prix de base, puis moyenne constatée');
{
  const aujourdhui = '2026-10-26';
  const tarifs = { devise: 'EUR', luLe: '2026-10-26T06:17:00+01:00', jours: [{ date: '2026-10-26', prixCentimes: 12000, libre: true }] };
  verifier(prixNuit(logement({ tarifs }), { adr90: 9500, aujourdhui })?.source === 'soir', 'prix de ce soir d’abord');
  verifier(prixNuit(logement({ descriptif: { prix: { devise: 'EUR', nuit: 11000 } } }), { adr90: 9500, aujourdhui })?.source === 'base', 'puis prix de base de l’annonce');
  const c = prixNuit(logement(), { adr90: 9500, aujourdhui });
  verifier(c?.source === 'constate' && c.centimes === 9500, `puis moyenne constatée sur 90 jours (${JSON.stringify(c)})`);
  verifier(prixNuit(logement(), { adr90: 0, aujourdhui }) === undefined && prixNuit(logement(), { aujourdhui }) === undefined, 'sans séjour récent : pas de prix');
}

section('Terrain : ménage, qui appeler, technique (équipe seulement)');
{
  verifier(
    ROLES_CONTACT.length === 6 && ROLES_CONTACT.map((r) => LIBELLE_ROLE_CONTACT[r]).join() === 'Ménage,Maintenance,Serrurier,Urgence,Propriétaire,Autre',
    'six rôles de contact, libellés français',
  );
  const vide = saisieTerrainInitiale(logement());
  verifier(JSON.stringify(terrainDepuisSaisie(vide)) === '{}' && vide.contacts.length === 0, 'saisie vide : aucun volet enregistré (ni {} ni [])');
  const s = saisieTerrainInitiale(logement());
  s.menage.duree = '  2 h 30 ';
  s.contacts = [
    { ...nouveauContactSaisi('serrurier'), nom: ' Serrurerie du Quai ', telephone: '06 00 00 00 02 ', note: '' },
    { ...nouveauContactSaisi('menage'), nom: '', telephone: '', note: '' },
    { ...nouveauContactSaisi('autre'), nom: '', telephone: '06 00 00 00 09', note: '' },
  ];
  s.technique.disjoncteur = 'Entrée, au-dessus de la porte';
  verifier(erreursTerrain(s).contacts[s.contacts[2].cle] !== undefined && erreursTerrain(s).contacts[s.contacts[1].cle] === undefined, 'un téléphone sans nom : erreur ; une ligne vide : ignorée');
  const t = terrainDepuisSaisie({ ...s, contacts: s.contacts.slice(0, 2) });
  verifier(
    t.menage?.duree === '2 h 30' && !('produits' in (t.menage ?? {})) && t.contacts?.length === 1 && t.contacts[0].nom === 'Serrurerie du Quai' && t.contacts[0].telephone === '06 00 00 00 02' && !('note' in t.contacts[0]) && t.technique?.disjoncteur && Object.keys(t.technique).length === 1,
    `textes nettoyés, lignes sans nom ignorées, champs vides absents (${JSON.stringify(t)})`,
  );
  const avec = appliquerTerrain(logement({ menage: { duree: '1 h' }, contacts: [{ role: 'menage', nom: 'Nadia' }], technique: { notes: 'x' } }), vide);
  verifier(!('menage' in avec) && !('contacts' in avec) && !('technique' in avec) && avec.nom === 'Studio', 'tout effacé dans le formulaire : les trois volets disparaissent du logement');
  verifier(menageRenseigne({ duree: ' ' }) === false && menageRenseigne({ consignes: 'x' }) && techniqueRenseignee({ notes: 'n' }) && !techniqueRenseignee({}) && contactsRenseignes([{ role: 'autre', nom: ' ' }]).length === 0, 'volet renseigné : au moins un champ non vide');
  verifier(lienTelephone('06 00 00 00 01') === 'tel:0600000001' && lienTelephone('+33 6 00 00 00 01') === 'tel:+33600000001' && lienTelephone('à prévenir') === undefined, 'lien tel: chiffres et « + » seulement, rien sans numéro');
  const l = logement({ menage: { consignes: 'MENAGE-PRIVE' }, contacts: [{ role: 'urgence', nom: 'CONTACT-PRIVE', telephone: '06 00 00 00 09', note: 'ok' }], technique: { compteurGaz: 'TECHNIQUE-PRIVE' } });
  const fuites = fuitesTerrain('… CONTACT-PRIVE … 06 00 00 00 09 … TECHNIQUE-PRIVE …', l);
  verifier(fuites.join() === 'CONTACT-PRIVE,06 00 00 00 09,TECHNIQUE-PRIVE' && fuitesTerrain('rien', l).length === 0 && fuitesTerrain('ok', l).length === 0, `fuitesTerrain : les valeurs retrouvées, 3 caractères au moins (${fuites.join(', ')})`);
  const court = logement({ menage: { duree: '3 h', produits: '2 h 30' } });
  verifier(
    fuitesTerrain('Arrivée à 13 h, départ 12 h 30.', court).length === 0 && fuitesTerrain('Ménage : 3 h.', court).join() === '3 h' && fuitesTerrain('(2 h 30)', court).join() === '2 h 30',
    'fuitesTerrain : une valeur n’est retrouvée qu’entière (« 3 h » n’est pas dans « 13 h »), pas de faux positif sur une heure',
  );
}

/* --------------------------------------------- typographie du volet terrain */

/**
 * Espaces insécables avant « : ; ? ! » et « » », après « « » : dans les
 * textes français du volet terrain (chaînes et textes JSX des trois fichiers
 * de l'écran) et dans les valeurs de démo du seed. Les commentaires ne
 * comptent pas.
 */
const ESPACE_FAUTIVE = /\S [:;?!»]|« /;
function chainesDu(code: string): string[] {
  const sansCommentaires = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const chaines = [...sansCommentaires.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '');
  // Texte JSX entre deux balises (jamais du code : ni parenthèse, ni « = », ni « ; », ni guillemet entre un « => » et un « < »).
  const jsx = [...sansCommentaires.matchAll(/>([^<>{}=;()'"`]+)</g)].map((m) => m[1]);
  return [...chaines, ...jsx].filter((t) => /[\p{L}]{3,}/u.test(t));
}

async function typographie() {
  section('Typographie du volet terrain : insécables avant « : ; ? ! »');
  const valeursDemo = LOGEMENTS.flatMap((l) => [...Object.values(l.menage ?? {}), ...(l.contacts ?? []).flatMap((c) => [c.nom, c.telephone, c.note]), ...Object.values(l.technique ?? {})]).filter((v): v is string => !!v);
  const fautivesDemo = valeursDemo.filter((v) => ESPACE_FAUTIVE.test(v));
  verifier(valeursDemo.length > 0 && fautivesDemo.length === 0, `seed : ${valeursDemo.length} valeurs du volet terrain, aucune espace normale avant une ponctuation double (${fautivesDemo.join(' | ')})`);
  verifier(LIBELLE_ROLE_CONTACT.menage === 'Ménage' && !CHAMPS_MENAGE.some((c) => ESPACE_FAUTIVE.test(c.aide) || ESPACE_FAUTIVE.test(c.libelle)), 'libellés et aides du module : insécables en place');

  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (!proc?.versions?.node) return;
  const nomFs = 'node:fs';
  const nomChemins = 'node:path';
  const fs = (await import(/* @vite-ignore */ nomFs)) as { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean };
  const chemins = (await import(/* @vite-ignore */ nomChemins)) as { join: (...p: string[]) => string; dirname: (p: string) => string };
  let racine = proc.cwd();
  for (let i = 0; i < 6 && !fs.existsSync(chemins.join(racine, 'package.json')); i++) racine = chemins.dirname(racine);
  const fichiers = ['src/erp/data/terrain.ts', 'src/erp/modules/logements/onglets/Terrain.tsx', 'src/erp/modules/logements/EditionLogement.tsx'];
  if (!fs.existsSync(chemins.join(racine, fichiers[0]))) return;
  for (const f of fichiers) {
    const fautives = chainesDu(fs.readFileSync(chemins.join(racine, f), 'utf8')).filter((t) => ESPACE_FAUTIVE.test(t));
    verifier(fautives.length === 0, `${f} : aucune espace normale avant « : ; ? ! » dans les textes (${fautives.map((t) => t.slice(0, 60)).join(' | ')})`);
  }
}

void typographie().then(() => {
  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
});
