/**
 * Installation de l'app Label Maison (écran d'accueil du téléphone, dock de
 * l'ordinateur) : état partagé et étapes, utilisés par la page /erp/installer,
 * Paramètres → Application et la proposition de l'Accueil.
 */
import { useCallback, useEffect, useReducer, useState, type ReactNode } from 'react';
import { Check, Copy, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { appareil, dejaInstallee, estInstallee, installationDirecte, installer, surChangementInstallation, type Appareil } from '../../../data/application';
import { espaceOuvert } from '../../../data/espaces';
import { nomAppAffiche, partageInstallation } from '../../../data/marque-espace';
import { Button, cn } from '../../../ui';

/** Le lien à envoyer à l'équipe (connexion d'abord, puis la page d'installation). */
export const LIEN_INSTALLATION = 'https://www.labelmaisoncg.fr/erp/installer';
export const LIEN_INSTALLATION_COURT = 'labelmaisoncg.fr/erp/installer';

export interface EtatInstallation {
  appareil: Appareil;
  /** Ouverte comme une app (et non dans un onglet). */
  dansLApp: boolean;
  /** Installée sur cet appareil, même si l'on est dans le navigateur. */
  installee: boolean;
  /** Le navigateur installe d'un clic (Chrome, Edge, Android). */
  directe: boolean;
  installer: () => Promise<boolean>;
}

export function useInstallation(): EtatInstallation {
  const [, actualiser] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const arreter = surChangementInstallation(actualiser);
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    mq?.addEventListener?.('change', actualiser);
    return () => {
      arreter();
      mq?.removeEventListener?.('change', actualiser);
    };
  }, []);
  const lancer = useCallback(async () => {
    const ok = await installer();
    actualiser();
    return ok;
  }, []);
  return { appareil: appareil(), dansLApp: estInstallee(), installee: dejaInstallee(), directe: installationDirecte(), installer: lancer };
}

interface Etape {
  texte: ReactNode;
}

const Icone = ({ children }: { children: ReactNode }) => (
  <span aria-hidden className="mx-0.5 inline-grid size-6 place-items-center rounded-md bg-(--lm-surface-2) align-[-6px] text-(--lm-encre) [&_svg]:size-4">
    {children}
  </span>
);

/** Le navigateur conseillé pour installer est-il déjà celui-ci (Safari sur iPhone, Chrome sur Android) ? */
function bonNavigateur(a: Appareil): boolean {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (a === 'iphone') return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/.test(ua);
  if (a === 'android') return /Chrome/.test(ua) && !/EdgA|SamsungBrowser|Firefox|OPR|FBAN|FBAV|Instagram/.test(ua);
  return true;
}

/** Les étapes d'installation, avec les mots de l'appareil. */
export function etapesInstallation(a: Appareil): Etape[] {
  const ouvrir = !bonNavigateur(a);
  if (a === 'iphone') {
    return [
      ...(ouvrir ? [{ texte: <>Ouvrez ce lien dans <strong className="font-semibold">Safari</strong>.</> }] : []),
      {
        texte: (
          <>
            Touchez <Icone><Share /></Icone> <strong className="font-semibold">Partager</strong>, en bas de l’écran (en haut sur iPad).
          </>
        ),
      },
      {
        texte: (
          <>
            Choisissez <Icone><SquarePlus /></Icone> <strong className="font-semibold">Sur l’écran d’accueil</strong>, puis touchez <strong className="font-semibold">Ajouter</strong>.
          </>
        ),
      },
      { texte: <OuvrezLApp suite=" depuis l’écran d’accueil, connectez-vous, puis activez les notifications." /> },
    ];
  }
  if (a === 'android') {
    return [
      ...(ouvrir ? [{ texte: <>Ouvrez ce lien dans <strong className="font-semibold">Chrome</strong>.</> }] : []),
      {
        texte: (
          <>
            Touchez <Icone><EllipsisVertical /></Icone> en haut à droite, puis <strong className="font-semibold">Installer l’application</strong> (ou « Ajouter à l’écran d’accueil »).
          </>
        ),
      },
      { texte: <OuvrezLApp suite=", puis activez les notifications." /> },
    ];
  }
  return [
    { texte: <>Dans <strong className="font-semibold">Chrome</strong> ou <strong className="font-semibold">Edge</strong> : cliquez sur l’icône d’installation, à droite de la barre d’adresse.</> },
    { texte: <>Sur Mac avec <strong className="font-semibold">Safari</strong> : menu Fichier, puis <strong className="font-semibold">Ajouter au Dock</strong>.</> },
    { texte: <OuvrezLApp suite=", puis activez les notifications." /> },
  ];
}

/** « Ouvrez l’app Label Maison… » ; dans un autre espace, sans nom (l'app installée garde le nom de son manifeste). */
export function OuvrezLApp({ suite }: { suite: string }) {
  const nom = nomAppAffiche(espaceOuvert());
  return nom ? (
    <>
      Ouvrez l’app <strong className="font-semibold">{nom}</strong>
      {suite}
    </>
  ) : (
    <>Ouvrez l’app{suite}</>
  );
}

/** Liste numérotée des étapes. */
export function EtapesInstallation({ appareil: a, className }: { appareil: Appareil; className?: string }) {
  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {etapesInstallation(a).map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-(--lm-encre)">
          <span aria-hidden className="lm-chiffres mt-px grid size-6 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-[12.5px] font-semibold text-(--lm-or-texte)">
            {i + 1}
          </span>
          <span className="min-w-0">{e.texte}</span>
        </li>
      ))}
    </ol>
  );
}

/** Le lien à partager, avec « Copier » (et « Partager » quand le téléphone sait le faire). */
export function LienInstallation({ className }: { className?: string }) {
  const [copie, setCopie] = useState(false);
  const partage = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(LIEN_INSTALLATION);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt('Copiez le lien :', LIEN_INSTALLATION);
    }
  };
  const partager = async () => {
    try {
      await navigator.share({ ...partageInstallation(espaceOuvert()), url: LIEN_INSTALLATION });
    } catch {
      /* partage annulé */
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="lm-chiffres min-w-0 flex-1 truncate rounded-lg bg-(--lm-surface-2) px-3 py-1.5 text-[13.5px] text-(--lm-encre)">{LIEN_INSTALLATION_COURT}</span>
      <Button size="sm" variant="secondary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()} aria-live="polite">
        {copie ? 'Copié' : 'Copier'}
      </Button>
      {partage && (
        <Button size="sm" variant="secondary" icone={<Share />} onClick={() => void partager()}>
          Partager
        </Button>
      )}
    </div>
  );
}
