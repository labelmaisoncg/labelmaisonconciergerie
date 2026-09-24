import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Commercial : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Commercial" sousTitre="Pipeline propriétaires et lancement des mandats." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
