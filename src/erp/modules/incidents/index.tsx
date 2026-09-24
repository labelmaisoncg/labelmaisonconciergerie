import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Incidents : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Incidents" sousTitre="Incidents et maintenance." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
