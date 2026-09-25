import { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, Eye, Loader2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useErp } from '../data/store';
import { pluriel } from '../data/format';
import { Button, cn } from '../ui';

const ponctuer = (m?: string) => (!m ? '' : /[.!?]$/.test(m) ? m : `${m}.`);

/** Pastille de l'en-tête : enregistré, enregistrement en cours, hors ligne, échec. */
export function IndicateurSynchro() {
  const { synchro, mode } = useErp();
  const envoi = synchro?.statut === 'envoi';
  // Un envoi rapide ne fait pas clignoter l'en-tête.
  const [envoiVisible, setEnvoiVisible] = useState(false);
  useEffect(() => {
    if (!envoi) return setEnvoiVisible(false);
    const t = setTimeout(() => setEnvoiVisible(true), 800);
    return () => clearTimeout(t);
  }, [envoi]);

  if (mode !== 'reel' || !synchro) return null;
  const attente = synchro.enAttente > 0 ? ` · ${pluriel(synchro.enAttente, 'modification')} en attente` : '';

  let ton = 'text-(--lm-encre-3)';
  let icone = <Cloud aria-hidden />;
  let texte = 'Enregistré';
  let titre = 'Toutes les modifications sont enregistrées dans la base.';
  if (!synchro.enLigne) {
    ton = 'text-(--lm-alerte) bg-(--lm-alerte-lavis)';
    icone = <WifiOff aria-hidden />;
    texte = 'Hors ligne';
    titre = `Pas de réseau${attente}. Tout partira au retour de la connexion.`;
  } else if (synchro.statut === 'erreur') {
    ton = 'text-(--lm-danger) bg-(--lm-danger-lavis)';
    icone = <AlertTriangle aria-hidden />;
    texte = 'Non enregistré';
    titre = `${synchro.message ?? 'Enregistrement échoué'}${attente}. Nouvel essai automatique.`;
  } else if (envoiVisible) {
    icone = <Loader2 aria-hidden className="animate-spin" />;
    texte = 'Enregistrement…';
    titre = `Envoi en cours${attente}.`;
  } else if (synchro.tempsReel === 'deconnecte') {
    titre = 'Enregistré. Le direct est interrompu : les changements des autres membres arriveront à la reconnexion.';
  }

  return (
    <span
      role="status"
      title={titre}
      className={cn('hidden h-7 shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-medium sm:inline-flex [&_svg]:size-3.5', ton)}
    >
      {icone}
      <span className={cn(texte === 'Enregistré' && 'hidden xl:inline')}>{texte}</span>
      <span className="sr-only">{titre}</span>
    </span>
  );
}

/** Bandeau persistant en cas d'échec ou de coupure, et avertissements ponctuels. */
export function AlerteSynchro() {
  const { synchro, relancerEnregistrement, avertissement, fermerAvertissement } = useErp();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const enEchec = !!synchro && (synchro.statut === 'erreur' || !synchro.enLigne) && (synchro.enAttente > 0 || !synchro.enLigne);

  useEffect(() => {
    if (!enEchec) return;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enEchec]);

  if (!enEchec && !avertissement) return null;
  const secondes = synchro?.prochainEssai ? Math.max(0, Math.ceil((synchro.prochainEssai - maintenant) / 1000)) : null;

  return (
    <div className="lm-sans-impression pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]">
      {enEchec && synchro && (
        <div role="alert" className="lm-apparition pointer-events-auto w-full rounded-xl border border-(--lm-alerte)/40 bg-(--lm-surface) p-3.5 shadow-(--lm-ombre-haute)">
          <div className="flex items-start gap-2.5">
            {synchro.enLigne ? (
              <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-(--lm-danger)" aria-hidden />
            ) : (
              <WifiOff className="mt-0.5 size-[18px] shrink-0 text-(--lm-alerte)" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-semibold text-(--lm-encre)">
                {synchro.enLigne ? 'Enregistrement échoué, nouvel essai…' : 'Hors ligne'}
              </p>
              <p className="mt-0.5 text-(--lm-encre-2)">
                {synchro.enAttente > 0
                  ? `${pluriel(synchro.enAttente, 'modification')} en attente, gardée${synchro.enAttente > 1 ? 's' : ''} sur cet appareil. `
                  : ''}
                {synchro.enLigne
                  ? `${ponctuer(synchro.message)}${secondes !== null ? ` Nouvel essai dans ${secondes} s.` : ''}`
                  : 'Tout partira au retour du réseau.'}
              </p>
            </div>
          </div>
          {synchro.enLigne && (
            <div className="mt-2.5 flex justify-end">
              <Button size="sm" icone={<RefreshCw />} onClick={relancerEnregistrement}>
                Réessayer maintenant
              </Button>
            </div>
          )}
        </div>
      )}
      {avertissement && (
        <div role="alert" className="lm-apparition pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-(--lm-danger)/30 bg-(--lm-surface) p-3.5 text-[13px] shadow-(--lm-ombre-haute)">
          <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-(--lm-danger)" aria-hidden />
          <p className="min-w-0 flex-1 text-(--lm-encre)">{avertissement}</p>
          <button type="button" onClick={fermerAvertissement} aria-label="Fermer" className="rounded p-0.5 text-(--lm-encre-3) hover:text-(--lm-encre)">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

/** Compte en lecture seule : rien de ce qui est fait à l'écran n'est enregistré. */
export function BandeauLecture() {
  const { lectureSeule } = useErp();
  if (!lectureSeule) return null;
  return (
    <div className="lm-sans-impression flex items-center gap-2 border-b border-(--lm-bord) bg-(--lm-info-lavis) px-4 py-1.5 text-[12.5px] text-(--lm-encre)">
      <Eye className="size-3.5 shrink-0 text-(--lm-info)" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">Lecture seule</strong> · vos modifications ne sont pas enregistrées.
      </p>
    </div>
  );
}
