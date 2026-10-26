import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { dateCourte, euros, jourMois, nombre, pluriel, pourcentage } from '../data/format';
import type { ComparaisonPerformance, FicheLogementVue, LogementVue, MoisPerformance, VueProprietaire } from '../data/types-proprietaire';
import { Badge, Card, cn } from '../ui';
import { BarresMensuelles } from './BarresMensuelles';
import { CANAL, PhotoLogement, Rubrique, TitreEspace, titreMois } from './commun';

/* ------------------------------------------------------------ évolution */

type Evolution = { texte: string; sens: 'hausse' | 'baisse' | 'stable' };

/** Variation en % (ou en points pour un taux) ; rien si l'an dernier vaut 0. */
function evolution(actuel: number, precedent: number, points = false): Evolution | undefined {
  if (points) {
    const d = Math.round((actuel - precedent) * 100);
    return { texte: `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} pt${Math.abs(d) > 1 ? 's' : ''}`, sens: d > 0 ? 'hausse' : d < 0 ? 'baisse' : 'stable' };
  }
  if (!precedent) return undefined;
  const d = Math.round(((actuel - precedent) / precedent) * 100);
  return { texte: `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)} %`, sens: d > 0 ? 'hausse' : d < 0 ? 'baisse' : 'stable' };
}

function Variation({ e }: { e?: Evolution }) {
  if (!e) return null;
  const Icone = e.sens === 'hausse' ? ArrowUpRight : e.sens === 'baisse' ? ArrowDownRight : null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[12.5px] font-medium',
        // Le rouge est réservé aux problèmes : une baisse reste en encre secondaire, flèche et signe à l'appui.
        e.sens === 'hausse' ? 'text-(--lm-succes-texte)' : 'text-(--lm-encre-2)',
      )}
    >
      {Icone && <Icone className="size-3.5" aria-hidden />}
      {e.texte}
    </span>
  );
}

/** Repère : libellé, valeur (chiffres proportionnels), variation sur un an. */
function Repere({ libelle, valeur, detail, variation }: { libelle: string; valeur: string; detail?: ReactNode; variation?: Evolution }) {
  return (
    <div className="min-w-0 bg-(--lm-surface) px-4 py-3.5">
      <dt className="text-[12.5px] text-(--lm-encre-2)">{libelle}</dt>
      <dd className="mt-0.5">
        <span className="block text-[20px] leading-tight font-semibold text-(--lm-encre)">{valeur}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] text-(--lm-encre-2)">
          <Variation e={variation} />
          {detail}
        </span>
      </dd>
    </div>
  );
}

function Reperes({ f }: { f: FicheLogementVue }) {
  const t = f.totaux;
  const c: ComparaisonPerformance | undefined = f.comparaison;
  return (
    // La grille est la carte : filets d'un pixel entre les repères (le fond, vu entre les cases).
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-bord) shadow-(--lm-ombre) sm:grid-cols-4">
      <Repere libelle="Revenu net" valeur={euros(t.net, true)} variation={c && evolution(c.actuel.net, c.precedent.net)} />
      <Repere libelle="Occupation" valeur={pourcentage(t.occupation)} variation={c && evolution(c.actuel.occupation, c.precedent.occupation, true)} />
      <Repere libelle="Prix moyen par nuit" valeur={t.nuits ? euros(t.prixMoyenNuit, true) : '—'} variation={c && evolution(c.actuel.prixMoyenNuit, c.precedent.prixMoyenNuit)} />
      <Repere libelle="Nuits réservées" valeur={nombre(t.nuits)} variation={c && evolution(c.actuel.nuits, c.precedent.nuits)} detail={<span>en {pluriel(t.sejours, 'séjour')}</span>} />
    </dl>
  );
}

/* ---------------------------------------------------------------- fiche */

function periode(f: FicheLogementVue): string {
  const suivis = f.mois.filter((m) => m.suivi);
  if (!suivis.length) return '';
  const de = suivis[0].mois;
  const a = f.mois[f.mois.length - 1].mois;
  return de === a ? titreMois(a) : `${titreMois(de)} – ${titreMois(a).toLowerCase()}`;
}

function TableauMois({ mois }: { mois: MoisPerformance[] }) {
  const th = 'px-2 py-2 text-left text-[12px] font-medium text-(--lm-encre-2) whitespace-nowrap sm:px-3';
  const td = 'lm-chiffres px-2 py-2 text-right whitespace-nowrap sm:px-3';
  // Intitulés courts sur téléphone : le tableau tient sans défiler.
  const titre = (court: string, long: string) => (
    <>
      <span className="sm:hidden">{court}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
  return (
    <details className="group mt-3 border-t border-(--lm-bord) pt-2">
      <summary className="inline-flex min-h-9 cursor-pointer items-center rounded-md text-[13px] font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none">
        Voir les chiffres mois par mois
      </summary>
      <div className="lm-defilement mt-2 -mx-2 overflow-x-auto sm:-mx-3">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-(--lm-bord)">
              <th className={th}>Mois</th>
              <th className={cn(th, 'text-right')}>{titre('Net', 'Net pour vous')}</th>
              <th className={cn(th, 'text-right')}>Nuits</th>
              <th className={cn(th, 'text-right')}>{titre('Occup.', 'Occupation')}</th>
              <th className={cn(th, 'text-right')}>{titre('Prix/nuit', 'Prix moyen par nuit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--lm-bord)">
            {[...mois].reverse().map((m) => (
              <tr key={m.mois}>
                <td className="px-2 py-2 whitespace-nowrap text-(--lm-encre) sm:px-3">{titreMois(m.mois)}</td>
                {m.suivi ? (
                  <>
                    <td className={cn(td, 'font-medium text-(--lm-encre)')}>{euros(m.net, true)}</td>
                    <td className={td}>{m.nuits}</td>
                    <td className={td}>{pourcentage(m.occupation)}</td>
                    <td className={td}>{m.nuits ? euros(m.prixMoyenNuit, true) : '—'}</td>
                  </>
                ) : (
                  <td colSpan={4} className="px-2 py-2 text-right text-(--lm-encre-3) sm:px-3">
                    Pas encore de données
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Etoiles({ note }: { note: number }) {
  return (
    <span role="img" className="inline-flex items-center gap-0.5" aria-label={`${nombre(note, 1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('size-3.5', note >= i - 0.25 ? 'fill-(--lm-or) text-(--lm-or)' : 'text-(--lm-encre-3)')} aria-hidden />
      ))}
    </span>
  );
}

export function FicheLogement({ logement: l, fiche: f, aujourdhui }: { logement: LogementVue; fiche: FicheLogementVue; aujourdhui: string }) {
  const suivi = f.mois.some((m) => m.suivi);
  // Graphique et tableau : à partir du premier mois suivi (avant, l'ERP n'a pas de données).
  const affiches = suivi ? f.mois.slice(f.mois.findIndex((m) => m.suivi)) : [];
  const c = f.comparaison;
  return (
    <>
      {l.photo && <PhotoLogement url={l.photo} nom={l.nom} className="mb-4 aspect-[16/9] w-full rounded-xl sm:aspect-[21/9]" />}
      <h1 className="lm-serif text-[26px] leading-tight text-(--lm-brun) sm:text-[30px]">{l.nom}</h1>
      <p className="text-[14px] text-(--lm-encre-2)">
        {l.ville} · {pluriel(l.capacite, 'voyageur')} · {pluriel(l.chambres, 'chambre')}
      </p>

      <Rubrique titre="Les 12 derniers mois">
        {!suivi ? (
          <p className="text-[14px] text-(--lm-encre-2)">Les performances apparaîtront ici après les premiers séjours.</p>
        ) : (
          <>
            <p className="-mt-2 mb-3 text-[13px] text-(--lm-encre-2)">
              {periode(f)}
              {c ? ` · comparé aux mêmes mois de l’an dernier${c.nbMois < 12 ? ` (${pluriel(c.nbMois, 'mois', 'mois')})` : ''}` : ''}
            </p>
            <Reperes f={f} />
            <Card className="mt-4">
              <p className="text-[14px] font-semibold text-(--lm-encre)">Revenu net par mois</p>
              <p className="mb-8 text-[12.5px] text-(--lm-encre-2)">Ce qui vous revient, après frais des plateformes, ménage et commission.</p>
              <BarresMensuelles mois={affiches} titre={`Revenu net par mois, ${periode(f).toLowerCase()}`} />
              <TableauMois mois={affiches} />
            </Card>
          </>
        )}
      </Rubrique>

      {f.avis && (
        <Rubrique titre="Avis des voyageurs">
          <Card>
            <div className="flex items-center gap-3">
              <p className="text-[32px] leading-none font-semibold text-(--lm-encre)">{nombre(f.avis.moyenne, 1)}</p>
              <div>
                <Etoiles note={f.avis.moyenne} />
                <p className="text-[13px] text-(--lm-encre-2)">Moyenne sur {pluriel(f.avis.nombre, 'avis', 'avis')}</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
              {f.avis.derniers.map((a) => (
                <li key={`${a.date}-${a.voyageur}`} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[14px] font-medium text-(--lm-encre)">{a.voyageur}</p>
                    <Etoiles note={a.note} />
                  </div>
                  <p className="text-[12.5px] text-(--lm-encre-2)">
                    {dateCourte(a.date)} · {CANAL[a.canal]}
                  </p>
                  {a.texte && <p className="mt-1.5 line-clamp-5 text-[14px] whitespace-pre-line text-(--lm-encre)">{a.texte}</p>}
                </li>
              ))}
            </ul>
          </Card>
        </Rubrique>
      )}

      <Rubrique titre="Prochains séjours">
        {f.prochainsSejours.length ? (
          <Card flush>
            <ul className="divide-y divide-(--lm-bord)">
              {f.prochainsSejours.map((s) => {
                const enCours = s.arrivee <= aujourdhui;
                return (
                  <li key={`${s.arrivee}-${s.depart}`} className="px-4 py-3">
                    <p className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span className="font-medium text-(--lm-encre)">
                        {jourMois(s.arrivee)} → {jourMois(s.depart)}
                      </span>
                      {enCours ? <Badge tone="or">En cours</Badge> : <span className="lm-chiffres shrink-0 text-[13px] text-(--lm-encre-2)">{pluriel(s.nuits, 'nuit')}</span>}
                    </p>
                    <p className="text-[13px] text-(--lm-encre-2)">
                      {s.voyageur} · {pluriel(s.nbPersonnes, 'voyageur')} · {CANAL[s.canal]}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <p className="text-[14px] text-(--lm-encre-2)">Aucun séjour prévu pour l’instant.</p>
        )}
      </Rubrique>
    </>
  );
}

/* ---------------------------------------------------------------- onglet */

/**
 * « Mes logements » : la liste (s'il y en a plusieurs), puis la fiche de
 * chacun ; avec un seul logement, sa fiche directement.
 */
export function Logements({ vue, choisi, onChoisir }: { vue: VueProprietaire; choisi?: string; onChoisir: (id?: string) => void }) {
  const fiche = (id: string) => vue.fiches.find((f) => f.logementId === id);
  const seul = vue.logements.length === 1 ? vue.logements[0] : undefined;
  const ouvert = vue.logements.find((l) => l.id === choisi) ?? seul;
  const f = ouvert && fiche(ouvert.id);

  if (ouvert && f) {
    return (
      <>
        {!seul && (
          <button
            type="button"
            onClick={() => onChoisir(undefined)}
            className="lm-sans-impression -ml-2 mb-3 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Mes logements
          </button>
        )}
        <FicheLogement logement={ouvert} fiche={f} aujourdhui={vue.aujourdhui} />
      </>
    );
  }

  return (
    <>
      <TitreEspace titre="Mes logements" description="Le suivi de chaque logement : revenus, occupation, prix moyen, avis et prochains séjours." />
      {vue.logements.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vue.logements.map((l) => {
            const t = fiche(l.id)?.totaux;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onChoisir(l.id)}
                  className="group block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-offset-4 focus:outline-none"
                >
                  <PhotoLogement url={l.photo} nom={l.nom} className="aspect-[4/3] w-full rounded-xl transition-opacity group-hover:opacity-90" />
                  <span className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-(--lm-encre)">{l.nom}</span>
                    <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                  </span>
                  <span className="block text-[13.5px] text-(--lm-encre-2)">{l.ville}</span>
                  {t && t.mois > 0 && (
                    <span className="block text-[13.5px] text-(--lm-encre-2)">
                      12 mois : {euros(t.net, true)} · {pourcentage(t.occupation)} occupé
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[14px] text-(--lm-encre-2)">Aucun logement en gestion pour l’instant.</p>
      )}
    </>
  );
}
