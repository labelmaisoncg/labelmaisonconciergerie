/** Colonne de gauche : filtres, recherche et liste des conversations. */
import { Link } from 'react-router-dom';
import { Bot, OctagonAlert } from 'lucide-react';
import { Avatar, FilterChips, SearchInput, cn } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, heure, jourMois } from '../../../data/format';
import type { FilMessages, Logement } from '../../../data/types';
import { FILTRES, attendReponse, correspond, type FiltreFil } from './logique';

interface Props {
  fils: FilMessages[];
  tous: FilMessages[];
  logements: Map<string, Logement>;
  actifId?: string;
  filtre: FiltreFil;
  onFiltre: (f: FiltreFil) => void;
  recherche: string;
  onRecherche: (q: string) => void;
}

export function ListeFils({ fils, tous, logements, actifId, filtre, onFiltre, recherche, onRecherche }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2.5 border-b border-(--lm-bord) p-3">
        <SearchInput valeur={recherche} onChange={onRecherche} placeholder="Voyageur, logement, mot…" label="Rechercher une conversation" className="sm:w-full" />
        <FilterChips
          unique
          label="Filtrer les conversations"
          filtres={FILTRES.map((f) => ({ cle: f.cle, libelle: f.libelle, compteur: tous.filter((x) => correspond(x, f.cle)).length }))}
          actifs={[filtre]}
          onChange={(a) => onFiltre((a[0] as FiltreFil) ?? 'tous')}
          className="[&_button]:h-7 [&_button]:px-2.5 [&_button]:text-[12.5px]"
        />
      </div>
      {fils.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-(--lm-encre-3)">{recherche.trim() ? `Aucune conversation ne parle de « ${recherche.trim()} ».` : filtre === 'a_traiter' ? 'Personne n’attend de réponse de votre part. Tout est à jour.' : 'Rien ici pour le moment.'}</p>
      ) : (
        <ul className="lm-defilement min-h-0 flex-1 overflow-y-auto" aria-label="Conversations">
          {fils.map((f) => {
            const dernier = f.messages[f.messages.length - 1];
            const actif = f.id === actifId;
            const attente = attendReponse(f);
            return (
              <li key={f.id}>
                <Link
                  to={`/erp/messagerie/${f.id}`}
                  aria-current={actif ? 'true' : undefined}
                  className={cn(
                    'flex gap-3 border-b border-(--lm-bord) px-3 py-3 transition-colors hover:bg-(--lm-surface-2)',
                    actif && 'bg-(--lm-or-lavis) hover:bg-(--lm-or-lavis)',
                    f.statut === 'escalade' && 'border-l-[3px] border-l-(--lm-danger)',
                  )}
                >
                  <Avatar nom={f.voyageur} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn('truncate text-[13.5px] text-(--lm-encre)', attente ? 'font-semibold' : 'font-medium')}>{f.voyageur}</p>
                      <time className="lm-chiffres shrink-0 text-[11.5px] text-(--lm-encre-3)" dateTime={f.dernierMessageLe}>
                        {f.dernierMessageLe.slice(0, 10) === AUJOURDHUI ? heure(f.dernierMessageLe) : jourMois(f.dernierMessageLe)}
                      </time>
                    </div>
                    <p className="truncate text-[12px] text-(--lm-encre-3)">
                      {logements.get(f.logementId)?.nom ?? 'Logement'} · {LIBELLES.canal[f.canal]}
                    </p>
                    <p className={cn('mt-0.5 line-clamp-1 text-[12.5px]', attente ? 'text-(--lm-encre)' : 'text-(--lm-encre-2)')}>
                      {dernier?.auteur === 'agent' && <Bot className="mr-1 inline size-3.5 text-(--lm-or)" aria-label="Votre agent :" />}
                      {dernier?.auteur === 'hote' && <span className="text-(--lm-encre-3)">Vous : </span>}
                      {dernier?.texte}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {f.statut === 'escalade' && (
                        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-(--lm-danger)">
                          <OctagonAlert className="size-3" aria-hidden /> Transmise à l’équipe
                        </span>
                      )}
                      {attente && <span className="text-[11.5px] font-medium text-(--lm-alerte)">Attend une réponse</span>}
                      {f.statut === 'clos' && <span className="text-[11.5px] text-(--lm-encre-3)">Terminée</span>}
                      {f.statut !== 'clos' && f.traitePar !== 'en_attente' && (
                        <span className="text-[11.5px] text-(--lm-encre-3)">{LIBELLES.traitePar[f.traitePar]}</span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
