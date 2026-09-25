/** Onglet « Ce que l'agent a fait » : ses réponses, ce qu'il vous a transmis, ce qui vous attend. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CheckCircle2, Coffee, Hand, MessageCircleReply } from 'lucide-react';
import { Card, CardHeader, EmptyState, FilterChips, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, ajouterJours, dateJour, heure, pluriel, relatif } from '../../../data/format';
import { LIBELLE_MOTIF, activiteAgent, enAttenteHumain, formatDelai, motifEscalade, statsAgent, type ActiviteAgent } from './logique';

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
              {quand}, votre agent a répondu <strong className="lm-chiffres">{pluriel(reponses, 'fois', 'fois')}</strong>
              {transmis > 0 && (
                <>
                  {' '}et vous a passé la main sur <strong className="lm-chiffres">{pluriel(transmis, 'conversation')}</strong>
                </>
              )}
              .{stats.delaiMedianMinutes !== undefined && <> En général, les voyageurs ont une réponse en {formatDelai(stats.delaiMedianMinutes)}.</>}
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

      {attente.length > 0 && (
        <Card flush className="border-(--lm-alerte)/40">
          <CardHeader
            className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
            titre={`${pluriel(attente.length, 'voyageur attend', 'voyageurs attendent')} votre réponse`}
            description="Votre agent a préféré vous laisser la main. Répondez-leur quand vous pouvez."
          />
          <ul className="divide-y divide-(--lm-bord)">
            {attente.slice(0, 5).map((f) => {
              const motif = f.statut === 'escalade' ? LIBELLE_MOTIF[motifEscalade(f)].titre : 'Pas encore de réponse';
              return (
                <li key={f.id}>
                  <Link to={`/erp/messagerie/${f.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-(--lm-surface-2)">
                    <Hand className="size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">
                        {f.voyageur} <span className="font-normal text-(--lm-encre-3)">· {nom(f.logementId)}</span>
                      </span>
                      <span className="block truncate text-[12.5px] text-(--lm-encre-2)">
                        {motif} · dernier message {relatif(f.dernierMessageLe).replace('\'', '’')}
                      </span>
                    </span>
                    <span className="hidden text-[12.5px] font-medium text-(--lm-or) sm:inline">Répondre</span>
                    <ArrowRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {attente.length > 5 && (
            <p className="border-t border-(--lm-bord) px-4 py-2.5 text-[12.5px]">
              <Link to="/erp/messagerie" className="font-medium text-(--lm-or) hover:underline">
                Voir les {attente.length} conversations
              </Link>
            </p>
          )}
        </Card>
      )}

      {jours.length === 0 ? (
        <EmptyState
          icone={attente.length ? <Coffee /> : <CheckCircle2 />}
          titre={periode === 'jour' ? 'Rien pour l’instant aujourd’hui' : 'Une semaine calme'}
          description={
            periode === 'jour'
              ? 'Aucun voyageur n’a écrit depuis ce matin. Votre agent veille et répondra dès qu’un message arrive.'
              : 'Votre agent n’a envoyé aucune réponse ces 7 derniers jours.'
          }
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
                            a.genre === 'reponse' ? 'bg-(--lm-or-lavis) text-(--lm-or)' : 'bg-(--lm-alerte-lavis) text-(--lm-alerte)',
                          )}
                        >
                          {a.genre === 'reponse' ? <MessageCircleReply /> : <Hand />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[13.5px] font-medium text-(--lm-encre)">
                              {a.genre === 'reponse' ? `A répondu à ${a.fil.voyageur}` : `Vous a passé ${a.fil.voyageur}`}
                            </span>
                            <span className="text-[12px] text-(--lm-encre-3)">
                              {nom(a.fil.logementId)} · {LIBELLES.canal[a.fil.canal]}
                            </span>
                            <time dateTime={a.quand} className="lm-chiffres ml-auto text-[12px] text-(--lm-encre-3)">
                              {heure(a.quand)}
                            </time>
                          </span>
                          {a.genre === 'transmis' && a.motif && (
                            <span className="mt-0.5 block text-[12.5px] font-medium text-(--lm-alerte)">Pourquoi : {LIBELLE_MOTIF[a.motif].titre.toLowerCase()}</span>
                          )}
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-(--lm-encre-2)">
                            {a.genre === 'reponse' && <Bot className="mr-1 inline size-3.5 text-(--lm-or)" aria-hidden />}
                            {a.texte}
                          </span>
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
