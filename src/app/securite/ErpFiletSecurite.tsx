import { Component, type ErrorInfo, type ReactNode } from 'react';
import { estErreurDeChargement, rechargerUneFois } from './rechargement';

interface Etat {
  erreur: Error | null;
}

/**
 * Filet de sécurité autour de tout l'ERP : quoi qu'il arrive, jamais de page
 * blanche. Code d'une nouvelle version introuvable → rechargement automatique ;
 * toute autre panne → écran explicite avec deux sorties.
 */
export class ErpFiletSecurite extends Component<{ children: ReactNode }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('[erp] panne générale', erreur, info.componentStack);
    if (estErreurDeChargement(erreur)) rechargerUneFois();
  }

  private reinitialiser = () => {
    try {
      for (const cle of Object.keys(window.localStorage)) {
        if (cle.startsWith('lm-erp-')) window.localStorage.removeItem(cle);
      }
    } catch {
      /* stockage indisponible : le rechargement suffira */
    }
    window.location.reload();
  };

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;
    const bouton = {
      padding: '12px 20px',
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      border: '1px solid #A97C30',
    } as const;
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#FBFAF8',
          color: '#14110E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#A97C30', fontWeight: 600 }}>
            Label Maison · ERP
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 26, fontWeight: 500, margin: '12px 0' }}>
            L’ERP n’a pas pu s’afficher
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(20,17,14,.66)' }}>
            {estErreurDeChargement(erreur)
              ? 'Une nouvelle version vient d’être mise en ligne. Rechargez la page pour l’obtenir.'
              : 'Une erreur inattendue s’est produite. Rechargez la page ; si elle revient, réinitialisez les données de démonstration enregistrées dans ce navigateur.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
            <button type="button" onClick={() => window.location.reload()} style={{ ...bouton, background: '#A97C30', color: '#fff' }}>
              Recharger la page
            </button>
            <button type="button" onClick={this.reinitialiser} style={{ ...bouton, background: '#fff', color: '#14110E' }}>
              Réinitialiser les données de démo
            </button>
          </div>
          <p style={{ marginTop: 18, fontSize: 12, color: 'rgba(20,17,14,.45)', wordBreak: 'break-word' }}>{erreur.message}</p>
        </div>
      </main>
    );
  }
}
