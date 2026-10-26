/**
 * Auto-contrôle des règles des logements sans réseau : lien d'annonce Airbnb
 * saisi par l'équipe, ordre des photos (équipe d'abord), prix de la nuit
 * (plateforme, prix de base, puis moyenne constatée).
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-logements.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-logements.mjs \
 *     && node /tmp/verifier-logements.mjs
 */
import { extraireIdAirbnb, idAirbnbDuLogement, lienAnnonceAirbnb } from './page-airbnb';
import { photosLogement, prixNuit } from '../modules/logements/_composants/stats';
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

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
