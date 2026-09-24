import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Ménages : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Ménages" sousTitre="Missions de ménage, preuves et validation." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
