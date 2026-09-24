import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Tableau de bord : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Tableau de bord" sousTitre="Tout va-t-il bien cette semaine ?" />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
