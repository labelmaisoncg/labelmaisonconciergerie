import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { annoncesVisibles, cleFermees, fermerAnnonce, lireFermees, type AnnonceEquipe } from '../../../data/annonces-equipe';
import { espaceOuvert } from '../../../data/espaces';
import { jourMois } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Button, Card, cn } from '../../../ui';

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
 * opérations, lecture) : une carte, une ligne par annonce publiée que la
 * personne n'a pas encore fermée. « J'ai lu » reste sur l'appareil, propre à
 * l'espace et à la personne : rien n'est écrit dans la base.
 */
export function AnnoncesEquipe() {
  const d = useErp();
  const cle = cleFermees(espaceOuvert().id, d.utilisateur.id || d.utilisateur.email);
  const [fermees, setFermees] = useState(() => lire(cle));
  const titreId = useId();
  const visibles = annoncesVisibles(d.annoncesEquipe, fermees);
  if (!visibles.length) return null;

  const fermer = (id: string) => {
    // Avec ce qu'un autre onglet a pu fermer entre-temps.
    const suivant = fermerAnnonce([...new Set([...lire(cle), ...fermees])], id);
    setFermees(suivant);
    retenir(cle, suivant);
  };

  return (
    <Card role="region" aria-labelledby={titreId} className="mb-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-[18px]">
          <Megaphone />
        </span>
        <h2 id={titreId} className="text-[16px] font-semibold text-(--lm-encre)">
          {visibles.length > 1 ? 'Annonces à l’équipe' : 'Annonce à l’équipe'}
        </h2>
      </div>
      <ul className="mt-3 divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
        {visibles.map((a) => (
          <LigneAnnonce key={a.id} annonce={a} onLu={() => fermer(a.id)} />
        ))}
      </ul>
    </Card>
  );
}

/** Une annonce : titre, texte sur 4 lignes au plus (« Lire la suite »), auteur · date, « J'ai lu ». */
function LigneAnnonce({ annonce: a, onLu }: { annonce: AnnonceEquipe; onLu: () => void }) {
  const [deplie, setDeplie] = useState(false);
  const [coupe, setCoupe] = useState(false);
  const texte = useRef<HTMLParagraphElement>(null);
  const texteId = useId();

  // « Lire la suite » seulement si le texte dépasse vraiment les 4 lignes (largeur de l'écran comprise).
  useLayoutEffect(() => {
    const el = texte.current;
    if (!el || deplie) return;
    const mesurer = () => setCoupe(el.scrollHeight > el.clientHeight + 1);
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [a.texte, deplie]);

  return (
    <li className="py-3 last:pb-0">
      <h3 className="text-[15px] font-semibold break-words text-(--lm-encre)">{a.titre}</h3>
      {a.texte && (
        <p
          ref={texte}
          id={texteId}
          className={cn('mt-1 text-[13.5px] leading-relaxed break-words whitespace-pre-line text-(--lm-encre-2)', !deplie && 'line-clamp-4')}
        >
          {/* Replié : sans ligne vide entre les paragraphes, les 4 lignes montrent du texte. */}
          {deplie ? a.texte : a.texte.replace(/\n{2,}/g, '\n')}
        </p>
      )}
      {(coupe || deplie) && (
        <button
          type="button"
          aria-expanded={deplie}
          aria-controls={texteId}
          onClick={() => setDeplie((o) => !o)}
          className="inline-flex h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline"
        >
          {deplie ? 'Réduire' : 'Lire la suite'}
        </button>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[12.5px] text-(--lm-encre-3)">
          {a.publieePar ? `${a.publieePar} · ` : ''}
          {jourMois(a.publieeLe)}
        </p>
        <Button size="sm" variant="secondary" onClick={onLu} aria-label={`J’ai lu : ${a.titre}`}>
          J’ai lu
        </Button>
      </div>
    </li>
  );
}
