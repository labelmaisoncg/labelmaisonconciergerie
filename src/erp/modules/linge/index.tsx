import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Linge : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Linge" sousTitre="Stock par logement et mouvements tracés." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
