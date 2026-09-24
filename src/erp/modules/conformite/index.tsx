import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Conformité : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Conformité" sousTitre="Réglementation, documents et échéances." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
