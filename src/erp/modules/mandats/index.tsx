import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Mandats : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Mandats" sousTitre="Conditions de gestion signées avec chaque propriétaire." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
