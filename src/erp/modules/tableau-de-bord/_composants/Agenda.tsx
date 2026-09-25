import { LogIn, LogOut, Sparkles } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateJour } from '../../../data/format';
import { logementById, prochainsJours, prestataireById } from '../../../data/selectors';
import { cn } from '../../../ui';

/** Les 7 prochains jours : arrivées, départs, ménages (affiché dans un panneau de l'accueil). */
export function Agenda() {
  const d = useErp();
  const jours = prochainsJours(d.donnees, 7);
  const nom = (id: string) => logementById(d, id)?.nom ?? 'Logement';

  return (
    <ol className="divide-y divide-(--lm-bord)">
        {jours.map((j) => {
          const vide = !j.arrivees.length && !j.departs.length && !j.missions.length;
          const sansPresta = j.missions.filter((m) => !m.prestataireId).length;
          return (
            <li key={j.date} className="px-4 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className={cn('text-[13px] font-semibold capitalize', j.date === AUJOURDHUI ? 'text-(--lm-or)' : 'text-(--lm-encre)')}>
                  {j.date === AUJOURDHUI ? 'Aujourd’hui' : dateJour(j.date)}
                </p>
                <p className="lm-chiffres flex gap-2.5 text-[12px] text-(--lm-encre-2) [&_svg]:size-3.5">
                  <span className="inline-flex items-center gap-0.5" title="Arrivées"><LogIn aria-hidden />{j.arrivees.length}<span className="sr-only"> arrivées</span></span>
                  <span className="inline-flex items-center gap-0.5" title="Départs"><LogOut aria-hidden />{j.departs.length}<span className="sr-only"> départs</span></span>
                  <span className={cn('inline-flex items-center gap-0.5', sansPresta && 'font-semibold text-(--lm-danger)')} title="Ménages">
                    <Sparkles aria-hidden />{j.missions.length}<span className="sr-only"> ménages</span>
                  </span>
                </p>
              </div>
              {vide ? (
                <p className="text-[12px] text-(--lm-encre-3)">Rien de prévu, journée calme.</p>
              ) : (
                <ul className="space-y-0.5 text-[12px] text-(--lm-encre-2)">
                  {j.arrivees.map((r) => (
                    <li key={`a-${r.id}`} className="truncate">Arrivée · {r.voyageur.nom}, {nom(r.logementId)}</li>
                  ))}
                  {j.departs.map((r) => (
                    <li key={`d-${r.id}`} className="truncate">Départ · {r.voyageur.nom}, {nom(r.logementId)}</li>
                  ))}
                  {j.missions.map((m) => (
                    <li key={`m-${m.id}`} className="truncate">
                      Ménage {m.heureDebut} · {nom(m.logementId)},{' '}
                      {m.prestataireId ? prestataireById(d, m.prestataireId)?.nom : <span className="font-medium text-(--lm-danger)">personne n’est prévu</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
  );
}
