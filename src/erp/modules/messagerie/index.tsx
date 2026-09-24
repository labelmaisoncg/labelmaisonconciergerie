import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Messagerie : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Messagerie" sousTitre="Échanges avec les voyageurs, agent IA et équipe." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
