import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Propriétaires : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Propriétaires" sousTitre="Qui nous confie quoi." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
