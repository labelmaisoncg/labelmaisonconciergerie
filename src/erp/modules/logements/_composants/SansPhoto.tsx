import { House, RefreshCw } from 'lucide-react';
import { Button } from '../../../ui';
import { dateCourte } from '../../../data/format';
import { idAirbnbDuLogement } from '../../../data/page-airbnb';
import type { Logement } from '../../../data/types';
import { useSynchroRepull } from '../../parametres/SynchroRepull';

/** Première lettre en majuscule (les raisons commencent par le nom d'une plateforme ou un mot courant). */
const phrase = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * À la place de la galerie quand le logement n'a encore aucune photo : ce que
 * la dernière lecture a trouvé (ou pourquoi rien), en une phrase, et de quoi
 * relancer la mise à jour. Le prix a sa place dans les chiffres, pas ici.
 */
export function SansPhoto({ logement: l }: { logement: Logement }) {
  const s = useSynchroRepull();
  const n = l.repull?.lecture;
  const enPause = !!l.repull?.horsSelection;
  // Un logement en pause n'est lu que par la page publique de son annonce Airbnb.
  const lisible = !enPause || !!idAirbnbDuLogement(l);

  let texte: string;
  if (n?.photos === 'aucune') texte = `${phrase(n.raisonPhotos ?? 'aucune photo transmise par les plateformes')} (lu le ${dateCourte(n.le)}).`;
  else if (!lisible) texte = 'Ce logement est en pause (hors de votre forfait) et n’a pas d’annonce Airbnb dont lire les photos.';
  else texte = 'Les photos de l’annonce arrivent à la prochaine mise à jour.';

  return (
    <section aria-labelledby="sans-photo-titre" className="mb-5 flex flex-col gap-4 rounded-xl bg-(--lm-surface-2) p-4 sm:flex-row sm:items-center sm:p-5">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface) text-(--lm-encre-3)">
        <House className="size-6" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="sans-photo-titre" className="text-[14px] font-semibold text-(--lm-encre)">
          Pas encore de photo
        </h2>
        <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{texte}</p>
        {s.retour && (
          <p role="status" className="mt-1.5 text-[13px] text-(--lm-encre)">
            {s.retour.texte}
          </p>
        )}
      </div>
      {s.disponible && lisible && (
        <Button icone={<RefreshCw />} chargement={s.enCours} disabled={s.enCours} onClick={() => void s.synchroniser()} className="self-start sm:self-center">
          Mettre à jour
        </Button>
      )}
    </section>
  );
}
