import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Finance : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Finance" sousTitre="Relevés, factures, paiements et charges." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
