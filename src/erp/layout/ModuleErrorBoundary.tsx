import { Component, type ErrorInfo, type ReactNode } from 'react';
import { estErreurDeChargement, rechargerUneFois } from '../../app/securite/rechargement';
import { Alert, Button } from '../ui';

interface Props {
  children: ReactNode;
}
interface Etat {
  erreur: Error | null;
}

/** Isole la panne d'un module : le reste de l'ERP reste utilisable. */
export class ModuleErrorBoundary extends Component<Props, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('[erp] module en erreur', erreur, info.componentStack);
    // Écran d'une ancienne version introuvable après un déploiement.
    if (estErreurDeChargement(erreur)) rechargerUneFois();
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <Alert
        tone="danger"
        titre="Cet écran a rencontré une erreur"
        actions={
          <Button size="sm" onClick={() => window.location.reload()}>
            Recharger la page
          </Button>
        }
      >
        {this.state.erreur.message}
      </Alert>
    );
  }
}
