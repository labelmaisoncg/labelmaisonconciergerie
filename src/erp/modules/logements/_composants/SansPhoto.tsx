import { House, RefreshCw } from 'lucide-react';
import { Button } from '../../../ui';
import { dateCourte } from '../../../data/format';
import { idAirbnbDuLogement } from '../../../data/page-airbnb';
import type { Logement } from '../../../data/types';
import { useSynchroRepull } from '../../parametres/SynchroRepull';
import { AjouterPhotos, LienAirbnb } from './PhotosEquipe';

/** Première lettre en majuscule (les raisons commencent par le nom d'une plateforme ou un mot courant). */
const phrase = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * À la place de la galerie quand le logement n'a encore aucune photo : ce qui
 * se passe en une phrase, et les deux façons d'y remédier (déposer ses
 * photos, ou donner le lien de l'annonce Airbnb dont lire les photos). La
 * raison technique reste repliée sous « Détails ».
 */
export function SansPhoto({ logement: l }: { logement: Logement }) {
  const s = useSynchroRepull();
  const n = l.repull?.lecture;
  const enPause = !!l.repull?.horsSelection;
  const idAirbnb = idAirbnbDuLogement(l);
  const surBooking = (l.repull?.canaux ?? []).some((c) => /booking/i.test(c.plateforme)) || l.annonces.some((a) => a.canal === 'booking');
  const raison = n?.photos === 'aucune' ? `${phrase(n.raisonPhotos ?? 'aucune photo transmise par les plateformes')} (lu le ${dateCourte(n.le)}).` : undefined;

  let texte: string;
  let details: string | undefined;
  if (!idAirbnb) {
    // Booking.com ne transmet ni photos ni contenu à la connexion : ce n'est pas réparable par une mise à jour.
    texte = surBooking
      ? 'Booking.com ne transmet pas les photos à votre connexion. Ajoutez vos photos ou le lien de l’annonce Airbnb.'
      : enPause
        ? 'Ce logement est en pause (hors de votre forfait). Ajoutez vos photos ou le lien de l’annonce Airbnb.'
        : 'Aucune plateforme ne transmet de photos pour ce logement. Ajoutez vos photos ou le lien de l’annonce Airbnb.';
    details = raison;
  } else {
    // Lien Airbnb connu : seule une lecture de sa page explique un manque ; sinon (lien tout juste
    // ajouté), les photos viennent à la prochaine mise à jour.
    texte = raison && /airbnb/i.test(n?.raisonPhotos ?? '') ? raison : 'Les photos de l’annonce Airbnb arrivent à la prochaine mise à jour.';
  }

  return (
    <section aria-labelledby="sans-photo-titre" className="mb-5 flex flex-col gap-4 rounded-xl bg-(--lm-surface-2) p-4 sm:flex-row sm:items-start sm:p-5">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface) text-(--lm-encre-3)">
        <House className="size-6" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="sans-photo-titre" className="text-[14px] font-semibold text-(--lm-encre)">
          Pas encore de photo
        </h2>
        <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{texte}</p>
        {details && (
          <details className="mt-1 text-[12.5px] text-(--lm-encre-2)">
            <summary className="inline-flex h-8 cursor-pointer items-center font-medium text-(--lm-or-texte) hover:underline">Détails</summary>
            <p>{details}</p>
          </details>
        )}
        {s.retour && (
          <p role="status" className="mt-1.5 text-[13px] text-(--lm-encre)">
            {s.retour.texte}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-start gap-2">
          <AjouterPhotos logement={l} />
          <LienAirbnb logement={l} />
          {s.disponible && idAirbnb && (
            <Button size="sm" icone={<RefreshCw />} chargement={s.enCours} disabled={s.enCours} onClick={() => void s.synchroniser()}>
              Mettre à jour
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
