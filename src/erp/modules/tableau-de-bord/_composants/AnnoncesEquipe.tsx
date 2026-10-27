import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { annoncesVisibles, cleFermees, fermerAnnonce, lireFermees } from '../../../data/annonces-equipe';
import { espaceOuvert } from '../../../data/espaces';
import { jourMois } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Button } from '../../../ui';

/** Annonces fermées sur cet appareil (rien de lisible : aucune). */
function lire(cle: string): string[] {
  try {
    return lireFermees(window.localStorage.getItem(cle));
  } catch {
    return [];
  }
}

function retenir(cle: string, ids: string[]): void {
  try {
    window.localStorage.setItem(cle, JSON.stringify(ids));
  } catch {
    /* préférence non retenue : l'annonce reviendra au prochain chargement */
  }
}

/**
 * Annonces à l'équipe, en haut de l'Accueil de chaque membre (gérant,
 * opérations, lecture) : celles que le gérant a publiées et que la personne
 * n'a pas encore fermées. « J'ai lu » reste sur l'appareil, propre à
 * l'espace et à la personne : rien n'est écrit dans la base.
 */
export function AnnoncesEquipe() {
  const d = useErp();
  const cle = cleFermees(espaceOuvert().id, d.utilisateur.id || d.utilisateur.email);
  const [fermees, setFermees] = useState(() => lire(cle));
  const visibles = annoncesVisibles(d.annoncesEquipe, fermees);
  if (!visibles.length) return null;

  const fermer = (id: string) => {
    // Avec ce qu'un autre onglet a pu fermer entre-temps.
    const suivant = fermerAnnonce([...new Set([...lire(cle), ...fermees])], id);
    setFermees(suivant);
    retenir(cle, suivant);
  };

  return (
    <div className="mb-6 flex flex-col gap-3">
      {visibles.map((a) => (
        <section
          key={a.id}
          aria-labelledby={`annonce-equipe-${a.id}`}
          className="rounded-xl border border-(--lm-bord) bg-(--lm-surface) px-4 py-3.5 shadow-(--lm-ombre) sm:px-5"
        >
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-[18px]">
              <Megaphone />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={`annonce-equipe-${a.id}`} className="text-[15px] font-semibold break-words text-(--lm-encre)">
                <span className="sr-only">Annonce à l’équipe : </span>
                {a.titre}
              </h2>
              {a.texte && <p className="mt-1 text-[13.5px] leading-relaxed break-words whitespace-pre-line text-(--lm-encre-2)">{a.texte}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[12.5px] text-(--lm-encre-3)">
                  {a.publieePar ? `${a.publieePar} · ` : ''}
                  {jourMois(a.publieeLe)}
                </p>
                <Button size="sm" variant="secondary" onClick={() => fermer(a.id)}>
                  J’ai lu
                </Button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
