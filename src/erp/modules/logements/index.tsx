import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Logements : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Logements" sousTitre="Fiches, checklist de lancement et annonces." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
