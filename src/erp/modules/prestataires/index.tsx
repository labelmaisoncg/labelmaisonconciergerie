import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Prestataires : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Prestataires" sousTitre="Qui intervient, est-il en règle, est-il bon." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
