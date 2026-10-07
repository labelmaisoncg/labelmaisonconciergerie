/** Onglet « Ce que l'agent a fait » : ses réponses, ce qu'il vous a transmis, ce qui vous attend. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Coffee, Hand, MessageCircleReply } from 'lucide-react';
import { Card, EmptyState, FilterChips, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, ajouterJours, dateJour, heure, pluriel } from '../../../data/format';
import { LIBELLE_MOTIF, activiteAgent, enAttenteHumain, formatDelai, statsAgent, type ActiviteAgent } from './logique';

type Periode = 'jour' | '7j';

export function Activite() {
  const d = useErp();
  const [periode, setPeriode] = useState<Periode>('7j');
  const depuis = periode === 'jour' ? AUJOURDHUI : ajouterJours(AUJOURDHUI, -6);
  const activite = useMemo(() => activiteAgent(d.filsMessages, depuis), [d.filsMessages, depuis]);
  const attente = useMemo(() => enAttenteHumain(d.filsMessages), [d.filsMessages]);
  const stats = useMemo(() => statsAgent(d.filsMessages), [d.filsMessages]);
  const nom = (id: string) => d.logements.find((l) => l.id === id)?.nom ?? 'Logement';

  const reponses = activite.filter((a) => a.genre === 'reponse').length;
  const transmis = activite.filter((a) => a.genre === 'transmis').length;
  const quand = periode === 'jour' ? 'Aujourd’hui' : 'Ces 7 derniers jours';

  // Regroupement par jour, du plus récent au plus ancien.
  const jours = useMemo(() => {
    const m = new Map<string, ActiviteAgent[]>();
    for (const a of activite) {
      const j = a.quand.slice(0, 10);
      m.set(j, [...(m.get(j) ?? []), a]);
    }
    return [...m.entries()];
  }, [activite]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-(--lm-encre)">
          {activite.length ? (
            <>
              <strong className="lm-chiffres">{pluriel(reponses, 'réponse')}</strong> de votre agent
              {transmis > 0 && (
                <>
                  , <strong className="lm-chiffres">{pluriel(transmis, 'conversation')}</strong> confiée{transmis > 1 ? 's' : ''} à vous
                </>
              )}
              {stats.delaiMedianMinutes !== undefined && (
                <span className="text-(--lm-encre-2)" title="Délai de réponse habituel (médiane)">
                  {' '}· réponse en {formatDelai(stats.delaiMedianMinutes)}
                </span>
              )}
            </>
          ) : (
            <>{quand}, votre agent n’a rien eu à faire.</>
          )}
        </p>
        <FilterChips
          unique
          label="Période"
          filtres={[
            { cle: 'jour', libelle: 'Aujourd’hui' },
            { cle: '7j', libelle: '7 derniers jours' },
          ]}
          actifs={[periode]}
          onChange={(a) => setPeriode((a[0] as Periode) ?? '7j')}
        />
      </div>

      {/* Une ligne : la liste détaillée est dans Conversations, filtre « Pour vous ». */}
      {attente.length > 0 && (
        <Link
          to="/erp/messagerie"
          className="flex items-center gap-3 rounded-xl border border-(--lm-alerte)/40 bg-(--lm-surface) px-4 py-3 shadow-(--lm-ombre) hover:bg-(--lm-surface-2)"
        >
          <Hand className="size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
          <span className="min-w-0 flex-1 text-[13.5px] font-medium text-(--lm-encre)">
            {pluriel(attente.length, 'voyageur attend', 'voyageurs attendent')} votre réponse
          </span>
          <span className="text-[12.5px] font-medium text-(--lm-or-texte)">Répondre</span>
          <ArrowRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
        </Link>
      )}

      {jours.length === 0 ? (
        <EmptyState
          icone={attente.length ? <Coffee /> : <CheckCircle2 />}
          titre={periode === 'jour' ? 'Rien pour l’instant aujourd’hui.' : 'Une semaine calme.'}
        />
      ) : (
        <div className="space-y-5">
          {jours.map(([jour, liste]) => (
            <section key={jour} aria-label={dateJour(jour)}>
              <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">
                {jour === AUJOURDHUI ? 'Aujourd’hui' : dateJour(jour)}
              </h3>
              <Card flush>
                <ol className="divide-y divide-(--lm-bord)">
                  {liste.map((a) => (
                    <li key={a.id}>
                      <Link to={`/erp/messagerie/${a.fil.id}`} className="flex gap-3 px-4 py-3 hover:bg-(--lm-surface-2)">
                        <span
                          aria-hidden
                          className={cn(
                            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full [&_svg]:size-4',
                            a.genre === 'reponse' ? 'bg-(--lm-or-lavis) text-(--lm-or-texte)' : 'bg-(--lm-alerte-lavis) text-(--lm-alerte)',
                          )}
                        >
                          {a.genre === 'reponse' ? <MessageCircleReply /> : <Hand />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[13.5px] font-medium text-(--lm-encre)">
                              {a.genre === 'reponse' ? `A répondu à ${a.fil.voyageur}` : `Vous a passé ${a.fil.voyageur}`}
                            </span>
                            <span className="text-[12px] text-(--lm-encre-3)">{nom(a.fil.logementId)}</span>
                            <time dateTime={a.quand} className="lm-chiffres ml-auto text-[12px] text-(--lm-encre-3)">
                              {heure(a.quand)}
                            </time>
                          </span>
                          {/* Une ligne secondaire : la raison si l'agent a passé la main, sinon sa réponse. */}
                          {a.genre === 'transmis' && a.motif ? (
                            <span className="mt-0.5 block truncate text-[12.5px] font-medium text-(--lm-alerte)" title={a.texte}>
                              Pourquoi : {LIBELLE_MOTIF[a.motif].titre.toLowerCase()}
                            </span>
                          ) : (
                            <span className="mt-0.5 line-clamp-1 text-[12.5px] text-(--lm-encre-2)">
                              {a.genre === 'reponse' && <Bot className="mr-1 inline size-3.5 text-(--lm-or-texte)" aria-hidden />}
                              {a.texte}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
