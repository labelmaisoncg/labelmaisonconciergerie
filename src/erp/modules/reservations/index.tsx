import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Réservations : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Réservations" sousTitre="Qui dort où, quand, à quel prix." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
