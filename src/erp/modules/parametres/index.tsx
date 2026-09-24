import { Construction } from 'lucide-react';
import { EmptyState, PageHeader } from '../../ui';

/** Module Paramètres : page provisoire. */
export default function Module() {
  return (
    <>
      <PageHeader titre="Paramètres" sousTitre="Utilisateurs, intégrations et démo." />
      <EmptyState icone={<Construction />} titre="Module en construction" description="Cet écran arrive bientôt dans l’ERP." />
    </>
  );
}
