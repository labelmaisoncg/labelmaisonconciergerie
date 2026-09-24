import { Alert, Card, CardHeader, ProgressBar } from '../../../ui';
import { AUJOURDHUI } from '../../../data/format';

interface Compteur {
  nuits: number;
  plafond: number;
  restant: number;
}

/** Compteur des 120 nuits d'une résidence principale (SPEC §2.10). */
export function CompteurNuits({ compteur: c }: { compteur: Compteur }) {
  const ratio = c.nuits / c.plafond;
  const ton = ratio > 1 ? 'danger' : ratio >= 0.85 ? 'alerte' : 'or';
  return (
    <Card>
      <CardHeader titre={`Compteur ${c.plafond} nuits ${AUJOURDHUI.slice(0, 4)}`} description="Résidence principale : plafond légal de location par année civile." />
      <p className="lm-chiffres mb-2 text-[26px] leading-none font-semibold">
        {c.nuits}
        <span className="text-[15px] font-normal text-(--lm-encre-2)"> / {c.plafond} nuits</span>
      </p>
      <ProgressBar valeur={ratio} tone={ton} label={c.restant >= 0 ? `${c.restant} nuits restantes` : 'Plafond dépassé'} afficherValeur />
      {ratio > 1 && (
        <Alert tone="danger" titre="Plafond légal dépassé" className="mt-3">
          {c.nuits - c.plafond} nuits au-delà du plafond. Fermez le calendrier jusqu’au 31 décembre et prévenez le propriétaire.
        </Alert>
      )}
      {ratio >= 0.85 && ratio <= 1 && (
        <Alert tone="alerte" titre="Plafond bientôt atteint" className="mt-3">
          Bloquez les dates au-delà de {c.plafond} nuits sur tous les canaux.
        </Alert>
      )}
    </Card>
  );
}
