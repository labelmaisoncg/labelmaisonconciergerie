import { Plug, Wallet } from 'lucide-react';
import type { Charge, Facture, Reservation } from '../../../data/types';
import { ButtonLink, EmptyState } from '../../../ui';

/** Aucune activité encore : ni séjour, ni dépense, ni facture. */
export function financeSansActivite(d: { reservations: Reservation[]; charges: Charge[]; factures: Facture[] }) {
  return d.reservations.length === 0 && d.charges.length === 0 && d.factures.length === 0;
}

/** Un seul état vide, plutôt que des cartes remplies de « 0 € ». */
export function FinanceVide() {
  return (
    <EmptyState
      icone={<Wallet />}
      titre="Pas encore de chiffres"
      description="Vos chiffres apparaîtront dès la première réservation importée."
      action={
        <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
          Connecter vos annonces
        </ButtonLink>
      }
    />
  );
}
