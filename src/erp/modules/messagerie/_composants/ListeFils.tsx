/**
 * Liste des conversations : recherche, trois filtres et une ligne par
 * voyageur. Tri de « À répondre » par urgence (index.tsx) : badge « Urgent »
 * discret, rouge seulement pour un problème pendant le séjour ; langue du
 * voyageur quand ce n'est pas le français (« EN »).
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, SearchX } from 'lucide-react';
import { Avatar, Badge, Button, SearchInput, Segmente, cn } from '../../../ui';
import type { FilMessages, Logement } from '../../../data/types';
import { nomLangue, type Urgence } from '../../../data/messagerie-ia';
import { FILTRES, attendEquipe, auteurAffiche, correspond, quandCourt, type FiltreFil } from './logique';

/** Ce que la liste montre du tri : urgence (conversations qui attendent l'équipe) et langue du voyageur. */
export interface TriFil {
  urgence: Urgence;
  langue?: string;
}

interface Props {
  fils: FilMessages[];
  tous: FilMessages[];
  logements: Map<string, Logement>;
  actifId?: string;
  filtre: FiltreFil;
  onFiltre: (f: FiltreFil) => void;
  recherche: string;
  onRecherche: (q: string) => void;
  tri?: Map<string, TriFil>;
}

export function ListeFils({ fils, tous, logements, actifId, filtre, onFiltre, recherche, onRecherche, tri }: Props) {
  const q = recherche.trim();
  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      {/* Mobile : la recherche et les filtres restent sous la barre du haut pendant le défilement. */}
      <div className="space-y-2.5 bg-(--lm-fond) pb-3 max-lg:sticky max-lg:top-14 max-lg:z-10 max-lg:-mx-4 max-lg:px-4 max-lg:pt-1 lg:border-b lg:border-(--lm-bord) lg:bg-(--lm-surface) lg:p-3">
        <SearchInput valeur={recherche} onChange={onRecherche} placeholder="Voyageur, logement…" label="Rechercher une conversation" className="sm:w-full" />
        <Segmente
          label="Filtrer les conversations"
          valeur={filtre}
          onChange={onFiltre}
          options={FILTRES.map((f) => {
            const n = f.cle === 'a_traiter' ? tous.filter((x) => correspond(x, f.cle)).length : 0;
            return { valeur: f.cle, libelle: n ? `${f.libelle} · ${n}` : f.libelle };
          })}
          className={cn('flex w-full [&>button]:flex-1', q && 'opacity-60')}
        />
      </div>

      {fils.length === 0 ? (
        <Vide q={q} filtre={filtre} onEffacer={() => onRecherche('')} onToutes={() => onFiltre('tous')} />
      ) : (
        <ul className="lm-defilement max-lg:-mx-4 max-lg:border-t max-lg:border-(--lm-bord) max-lg:bg-(--lm-surface) lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-label="Conversations">
          {fils.map((f) => {
            const dernier = f.messages[f.messages.length - 1];
            const qui = dernier ? auteurAffiche(dernier, 'apercu') : null;
            const actif = f.id === actifId;
            const attente = attendEquipe(f);
            const t = tri?.get(f.id);
            const urgence = attente ? (t?.urgence.niveau ?? 0) : 0;
            const langue = t?.langue && t.langue !== 'fr' ? t.langue : undefined;
            return (
              <li key={f.id} className="border-b border-(--lm-bord) last:border-b-0 max-lg:last:border-b">
                <Link
                  to={`/erp/messagerie/${f.id}`}
                  aria-current={actif ? 'true' : undefined}
                  className={cn(
                    'flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2) focus-visible:outline-none',
                    actif && 'bg-(--lm-or-lavis) hover:bg-(--lm-or-lavis)',
                  )}
                >
                  <Avatar nom={f.voyageur} taille="lg" />
                  <div className="min-w-0 flex-1">
                    {/* Deux lignes : qui et où, puis le dernier message. */}
                    <div className="flex items-baseline gap-2">
                      <p className="min-w-0 flex-1 truncate text-[14px] text-(--lm-encre)">
                        <span className={attente ? 'font-semibold' : 'font-medium'}>{f.voyageur}</span>
                        <span className="text-[12.5px] text-(--lm-encre-3)"> · {logements.get(f.logementId)?.nom ?? 'Logement'}</span>
                      </p>
                      {langue && (
                        <span className="shrink-0 text-[11px] font-semibold tracking-wide text-(--lm-encre-3)" title={`Écrit en ${nomLangue(langue) ?? langue}`}>
                          <span aria-hidden>{langue.toUpperCase()}</span>
                          <span className="sr-only">Écrit en {nomLangue(langue) ?? langue}</span>
                        </span>
                      )}
                      <time className="lm-chiffres shrink-0 text-[12px] text-(--lm-encre-3)" dateTime={f.dernierMessageLe}>
                        {quandCourt(f.dernierMessageLe)}
                      </time>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={cn('min-w-0 flex-1 truncate text-[13px]', attente ? 'text-(--lm-encre)' : 'text-(--lm-encre-2)')}>
                        {qui && <span className="text-(--lm-encre-3)">{qui} : </span>}
                        {dernier?.texte}
                      </p>
                      {/* « Urgent » en rouge pour un problème pendant le séjour ; sinon le moment en gris (« Arrive aujourd'hui », « Sur place »). */}
                      {urgence >= 2 && (
                        <Badge tone={urgence === 3 ? 'danger' : 'neutre'} title={t?.urgence.raison} className="shrink-0 px-1.5 text-[11.5px]">
                          {t?.urgence.libelle ?? (urgence === 3 ? 'Urgent' : t?.urgence.raison)}
                        </Badge>
                      )}
                      {/* Un seul repère : la pastille dorée « à répondre » (doublée d'un nom en gras et d'un texte lu par les lecteurs d'écran). */}
                      {attente && (
                        <span className="size-2.5 shrink-0 rounded-full bg-(--lm-or)" role="img" aria-label="À répondre" />
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

function Vide({ q, filtre, onEffacer, onToutes }: { q: string; filtre: FiltreFil; onEffacer: () => void; onToutes: () => void }) {
  if (q)
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <SearchX className="mb-2 size-6 text-(--lm-encre-3)" aria-hidden />
        <p className="text-[14px] font-medium text-(--lm-encre)">Aucun résultat pour « {q} »</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={onEffacer}>
          Effacer la recherche
        </Button>
      </div>
    );
  if (filtre === 'a_traiter')
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <CheckCircle2 className="mb-2 size-6 text-(--lm-succes)" aria-hidden />
        <p className="text-[14px] font-medium text-(--lm-encre)">Tout est à jour</p>
        <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">Aucun voyageur n’attend de réponse.</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={onToutes}>
          Voir toutes les conversations
        </Button>
      </div>
    );
  return <p className="px-6 py-12 text-center text-[13.5px] text-(--lm-encre-2)">Aucune conversation terminée.</p>;
}
