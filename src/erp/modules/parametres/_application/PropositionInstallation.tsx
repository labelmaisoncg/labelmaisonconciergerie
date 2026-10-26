import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Button, ButtonLink } from '../../../ui';
import { useInstallation } from './installation';

const CLE_PLUS_TARD = 'lm-erp-installation-plus-tard';

function plusTardChoisi(): boolean {
  try {
    return window.localStorage.getItem(CLE_PLUS_TARD) === '1';
  } catch {
    return false;
  }
}

/**
 * Proposition discrète d'installer l'app (Accueil), sur téléphone ou quand
 * le navigateur sait installer d'un clic. Ne revient jamais après « Plus
 * tard », disparaît une fois l'app installée.
 */
export function PropositionInstallation() {
  const inst = useInstallation();
  const [masquee, setMasquee] = useState(plusTardChoisi);
  if (masquee || inst.installee || (inst.appareil === 'ordinateur' && !inst.directe)) return null;

  const plusTard = () => {
    setMasquee(true);
    try {
      window.localStorage.setItem(CLE_PLUS_TARD, '1');
    } catch {
      /* préférence non retenue : la proposition reviendra au prochain chargement */
    }
  };

  // Pas d'Alert : sur téléphone, ses boutons à droite écraseraient le texte en colonne.
  return (
    <section
      aria-label="Installer l’app"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-(--lm-bord-fort) bg-(--lm-surface-2) px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Smartphone className="mt-0.5 size-[18px] shrink-0 text-(--lm-encre-2)" aria-hidden />
        <div className="min-w-0 text-[13.5px]">
          <p className="font-semibold text-(--lm-encre)">Installez l’app Label Maison</p>
          <p className="mt-0.5 text-(--lm-encre-2)">Une notification à chaque réservation, message ou problème signalé.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-[30px] sm:pl-0">
        {inst.directe ? (
          <Button size="sm" variant="secondary" onClick={() => void inst.installer()}>
            Installer
          </Button>
        ) : (
          <ButtonLink to="/erp/installer" size="sm" variant="secondary">
            Voir comment
          </ButtonLink>
        )}
        <Button size="sm" variant="ghost" onClick={plusTard}>
          Plus tard
        </Button>
      </div>
    </section>
  );
}
