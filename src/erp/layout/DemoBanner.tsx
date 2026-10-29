import { useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useErp } from '../data/store';
import { Button, Modal } from '../ui';

/**
 * Bandeau permanent du mode démo (développement local, VITE_ERP_DEMO=1), avec
 * remise à zéro. Jamais affiché en production : les données y sont réelles.
 */
export function DemoBanner() {
  const { demo, reinitialiserDemo } = useErp();
  const [confirmer, setConfirmer] = useState(false);
  if (!demo) return null;
  return (
    <>
      <div className="lm-sans-impression flex items-center gap-2 border-b border-(--lm-bord) bg-(--lm-surface-2) px-4 py-1.5 text-[12.5px] text-(--lm-encre)">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          <strong className="font-semibold">Données de démonstration</strong>
          <span className="hidden sm:inline"> · développement local, rien n’est enregistré dans la base</span>
        </p>
        <button
          type="button"
          onClick={() => setConfirmer(true)}
          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 font-semibold underline underline-offset-[3px] hover:bg-(--lm-neutre-lavis)"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Réinitialiser
        </button>
      </div>
      <Modal
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        taille="sm"
        titre="Réinitialiser la démo ?"
        description="Toutes vos modifications locales seront effacées et le jeu de démonstration rechargé."
        pied={
          <>
            <Button variant="ghost" onClick={() => setConfirmer(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                reinitialiserDemo();
                setConfirmer(false);
              }}
            >
              Réinitialiser
            </Button>
          </>
        }
      />
    </>
  );
}
