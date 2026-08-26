/**
 * Vérification des capacités exigées par la certification Channex.
 *
 * ⚠️ CE N'EST PAS LA CERTIFICATION. Channex rejette explicitement les
 * « scripts autonomes postant les valeurs du tableau » : les vrais tests
 * doivent partir du produit, c'est-à-dire de la conversation Telegram.
 *
 * Ce script sert à autre chose, et c'est indispensable avant de se présenter :
 * vérifier que chaque capacité fonctionne réellement contre leur API, et
 * surtout que le GROUPAGE tient — plusieurs plages en un seul appel, ce qu'ils
 * vérifient sur la moitié de leurs tests.
 *
 *   npm run verifier-certification <property_id> <room_type_id> <rate_plan_id>
 */

import * as channex from '../src/channex.ts';

const [P, RT, RP] = process.argv.slice(2);
if (!P || !RT || !RP) {
  console.error('Usage : npm run verifier-certification -- <property_id> <room_type_id> <rate_plan_id>');
  process.exit(1);
}

let reussis = 0;
let echoues = 0;
const ok = (n: string, d = '') => {
  reussis++;
  console.log(`  ✓ ${n}${d ? ' — ' + d : ''}`);
};
const ko = (n: string, e: unknown) => {
  echoues++;
  console.log(`  ✗ ${n} — ${String(e).slice(0, 120)}`);
};
const essai = async (nom: string, detail: string, f: () => Promise<unknown>) => {
  try {
    await f();
    ok(nom, detail);
  } catch (e) {
    ko(nom, e);
  }
};

console.log(`\nVérification contre ${channex.enProduction() ? 'PRODUCTION' : 'staging'}\n`);

await essai('1. Full Data Update', '500 jours, 2 appels', async () => {
  await channex.definirDisponibilites([
    { proprieteId: P, typeChambreId: RT, du: '2026-09-01', au: '2028-01-13', quantite: 1 },
  ]);
  await channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-09-01', au: '2028-01-13', prixParNuit: 110 },
  ]);
});

await essai('2. Single Date, Single Rate', '1 date', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-22', au: '2026-11-22', prixParNuit: 333 },
  ]),
);

await essai('3. Single Date, Multiple Rates', '3 dates en 1 appel', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-21', au: '2026-11-21', prixParNuit: 333 },
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-25', au: '2026-11-25', prixParNuit: 250 },
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-29', au: '2026-11-29', prixParNuit: 180 },
  ]),
);

await essai('4. Multiple Date, Multiple Rates', '3 périodes en 1 appel', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-01', au: '2026-11-10', prixParNuit: 120 },
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-11', au: '2026-11-16', prixParNuit: 140 },
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-17', au: '2026-11-20', prixParNuit: 160 },
  ]),
);

await essai('5. Min Stay', '3 nuits', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-11-01', au: '2026-11-30', sejourMinimum: 3 },
  ]),
);

await essai('6. Stop Sell', 'Noël fermé', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-24', au: '2026-12-26', venteArretee: true },
  ]),
);

await essai('7. Multiple Restrictions', '4 lignes en 1 appel', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-01', au: '2026-12-05', arriveeInterdite: true },
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-06', au: '2026-12-10', departInterdit: true },
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-11', au: '2026-12-15', sejourMinimum: 2 },
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-16', au: '2026-12-20', prixParNuit: 200, venteArretee: false },
  ]),
);

await essai('8. Half-year Update', '6 mois en 1 appel', () =>
  channex.definirTarifs([
    { proprieteId: P, planTarifaireId: RP, du: '2026-12-01', au: '2027-05-01', prixParNuit: 130, sejourMinimum: 2 },
  ]),
);

await essai('9. Single Date Availability', '1 date', () =>
  channex.definirDisponibilites([
    { proprieteId: P, typeChambreId: RT, du: '2026-11-21', au: '2026-11-21', quantite: 0 },
  ]),
);

await essai('10. Multiple Date Availability', '2 périodes en 1 appel', () =>
  channex.definirDisponibilites([
    { proprieteId: P, typeChambreId: RT, du: '2026-11-10', au: '2026-11-16', quantite: 1 },
    { proprieteId: P, typeChambreId: RT, du: '2026-11-17', au: '2026-11-24', quantite: 1 },
  ]),
);

await essai('11. Booking Revisions Feed', 'lecture du flux', async () => {
  const f = await channex.fluxReservations();
  console.log(`      ${f.length} révision(s) non acquittée(s)`);
});

console.log(`\n${reussis} vérifiée(s), ${echoues} en échec.\n`);
console.log('Rappel : la certification elle-même doit être jouée DEPUIS le produit');
console.log('(la conversation Telegram). Channex refuse les scripts de test.\n');
process.exit(echoues > 0 ? 1 : 0);
