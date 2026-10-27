import { ChevronLeft, ChevronRight, FileBarChart, Printer } from 'lucide-react';
import { dateCourte, euros, jourMois, nombre, pluriel, pourcentage } from '../data/format';
import { espaceOuvert } from '../data/espaces';
import { logementsSansTaux } from '../data/proprietaire';
import type { BilanVue, ChiffresBilan, VueProprietaire } from '../data/types-proprietaire';
import { ENTREPRISE_LIGNE } from '../modules/finance/_composants/entreprise';
import { Button, Card, EmptyState, cn } from '../ui';
import { bilanDuMois, CANAL, deNom, titreMois } from './commun';

const moins = (c: number) => (c ? `− ${euros(c)}` : euros(0));

function Ligne({ libelle, valeur, fort, detail }: { libelle: string; valeur: string; fort?: boolean; detail?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2 text-[14px]', fort && 'mt-1 border-t border-(--lm-bord) pt-3')}>
      <dt className={fort ? 'font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2)'}>
        {libelle}
        {detail && <span className="ml-1 text-[12.5px] whitespace-nowrap text-(--lm-encre-3)">{detail}</span>}
      </dt>
      <dd className={cn('lm-chiffres shrink-0 text-right', fort ? 'text-[17px] font-semibold text-(--lm-encre)' : 'text-(--lm-encre)')}>{valeur}</dd>
    </div>
  );
}

/** Taux de commission affiché : « 18 % », ou rien si les logements n'ont pas le même. */
function tauxCommission(c: ChiffresBilan): string | undefined {
  const taux = [...new Set(c.logements.map((l) => l.commissionPct).filter((x): x is number => typeof x === 'number'))];
  return taux.length === 1 ? `(${nombre(taux[0], taux[0] % 1 ? 1 : 0)} %)` : undefined;
}

/**
 * Bilan d'un mois, tel que le propriétaire le voit (et l'imprime). Le
 * gérant voit exactement le même avant de publier, avec en plus
 * (`gerant`) « Taux de commission à renseigner » pour un logement sans
 * mandat à ce propriétaire. Sans taux ni commission : pas de ligne
 * « Commission ».
 */
export function BilanDetail({
  bilan,
  proprietaire,
  conciergerie = espaceOuvert().nom,
  onImprimer,
  gerant = false,
}: {
  bilan: Pick<BilanVue, 'mois' | 'commentaire' | 'chiffres'> & { publieLe?: string };
  proprietaire: string;
  /** Nom de la conciergerie (espace) ; sans : l'espace ouvert dans l'ERP. */
  conciergerie?: string;
  onImprimer?: () => void;
  /** Vu par le gérant (aperçu avant publication) : notes qui ne sont que pour lui. */
  gerant?: boolean;
}) {
  const c = bilan.chiffres;
  const t = c.totaux;
  const sansTaux = logementsSansTaux(c);
  const commission = t.commission !== 0 || sansTaux.length < c.logements.length;
  const plusieurs = c.logements.length > 1;
  const nomLogement = (id: string) => c.logements.find((l) => l.logementId === id)?.nom ?? 'Logement';
  return (
    <article className="lm-bilan-imprimable" aria-label={bilanDuMois(c.mois)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="hidden text-[12px] text-(--lm-encre-2) print:block">{conciergerie === 'Label Maison' ? ENTREPRISE_LIGNE : conciergerie}</p>
          <p className="hidden text-[13px] font-medium text-(--lm-encre) print:block">Bilan locatif · {proprietaire}</p>
          <h2 className="lm-serif text-[24px] leading-tight text-(--lm-brun)">{titreMois(c.mois)}</h2>
          {bilan.publieLe && <p className="text-[13px] text-(--lm-encre-2)">Publié le {dateCourte(bilan.publieLe.slice(0, 10))}</p>}
        </div>
        {onImprimer && (
          <Button variant="primary" icone={<Printer />} onClick={onImprimer} className="lm-sans-impression">
            Imprimer ou enregistrer en PDF
          </Button>
        )}
      </header>

      {bilan.commentaire.trim() && (
        <blockquote className="mt-4 rounded-xl border border-(--lm-or-anneau) bg-(--lm-or-lavis) px-4 py-3 text-[14px] whitespace-pre-line text-(--lm-encre)">
          <p className="mb-1 text-[12.5px] font-semibold text-(--lm-brun)">Le mot {deNom(conciergerie)}</p>
          {bilan.commentaire.trim()}
        </blockquote>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-[13px] font-medium text-(--lm-encre-2)">Pour vous ce mois-ci</p>
          <p className="lm-chiffres mt-1 text-[32px] leading-none font-semibold text-(--lm-encre)">{euros(t.net)}</p>
          <dl className="mt-4">
            <Ligne libelle="Encaissé sur les séjours" valeur={euros(t.encaisse)} />
            <Ligne libelle="Frais des plateformes" valeur={moins(t.fraisPlateforme)} />
            <Ligne libelle="Ménage" valeur={moins(t.menage)} />
            {commission && <Ligne libelle={`Commission ${conciergerie}`} detail={tauxCommission(c)} valeur={moins(t.commission)} />}
            <Ligne libelle="Net propriétaire" valeur={euros(t.net)} fort />
          </dl>
          {gerant && sansTaux.length > 0 && (
            <p className="lm-sans-impression mt-3 text-[12.5px] text-(--lm-encre-2)">
              Taux de commission à renseigner{plusieurs ? ` : ${sansTaux.join(', ')}` : ''} (pas de mandat à ce propriétaire).
            </p>
          )}
        </Card>
        <Card>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-[12.5px] text-(--lm-encre-2)">Séjours</dt>
              <dd className="lm-chiffres text-[20px] font-semibold text-(--lm-encre)">{t.sejours}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-(--lm-encre-2)">Nuits</dt>
              <dd className="lm-chiffres text-[20px] font-semibold text-(--lm-encre)">{t.nuits}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-(--lm-encre-2)">Occupation</dt>
              <dd className="lm-chiffres text-[20px] font-semibold text-(--lm-encre)">{pourcentage(c.occupation)}</dd>
            </div>
          </dl>
          {plusieurs && (
            <ul className="mt-4 divide-y divide-(--lm-bord) border-t border-(--lm-bord) text-[13.5px]">
              {c.logements.map((l) => (
                <li key={l.logementId} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-(--lm-encre)">{l.nom}</span>
                    <span className="text-(--lm-encre-2)">
                      {pluriel(l.nuits, 'nuit')} · {pourcentage(l.occupation)}
                    </span>
                  </span>
                  <span className="lm-chiffres shrink-0 font-semibold text-(--lm-encre)">{euros(l.net)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[12.5px] text-(--lm-encre-2)">Un séjour à cheval sur deux mois est compté au prorata de ses nuits dans chaque mois.</p>
        </Card>
      </div>

      <Card flush className="mt-4">
        <p className="border-b border-(--lm-bord) px-4 py-3 text-[14px] font-semibold text-(--lm-encre)">Récapitulatif des séjours</p>
        {c.sejours.length ? (
          <ul className="divide-y divide-(--lm-bord)">
            {c.sejours.map((s) => (
              <li key={`${s.logementId}-${s.arrivee}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-[13.5px] break-inside-avoid">
                <div className="min-w-0">
                  <p className="font-medium text-(--lm-encre)">
                    {jourMois(s.arrivee)} → {jourMois(s.depart)}
                    {plusieurs && <span className="font-normal text-(--lm-encre-2)"> · {nomLogement(s.logementId)}</span>}
                  </p>
                  <p className="text-(--lm-encre-2)">
                    {s.voyageur} · {pluriel(s.nbPersonnes, 'voyageur')} · {CANAL[s.canal]}
                  </p>
                  <p className="text-(--lm-encre-2)">
                    {s.nuits === s.nuitsSejour ? pluriel(s.nuits, 'nuit') : `${s.nuits} nuits sur ${s.nuitsSejour} ce mois-ci`} · encaissé {euros(s.encaisse)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="lm-chiffres font-semibold text-(--lm-encre)">{euros(s.net)}</p>
                  <p className="text-[12px] text-(--lm-encre-2)">pour vous</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-[13.5px] text-(--lm-encre-2)">Aucun séjour ce mois-ci.</p>
        )}
      </Card>
    </article>
  );
}

export function Bilans({ vue, choisi, onChoisir }: { vue: VueProprietaire; choisi?: string; onChoisir: (mois?: string) => void }) {
  const bilan = vue.bilans.find((b) => b.mois === choisi);
  if (!vue.bilans.length) {
    return (
      <>
        <EmptyState
          icone={<FileBarChart />}
          titre="Aucun bilan publié pour l’instant"
          description={`Chaque mois, ${vue.conciergerie.nom} publie ici le bilan de vos séjours : ce qui a été encaissé, les frais et ce qui vous revient.`}
        />
      </>
    );
  }
  if (bilan) {
    const i = vue.bilans.indexOf(bilan);
    const plusRecent = vue.bilans[i - 1];
    const plusAncien = vue.bilans[i + 1];
    const nav =
      'inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none';
    return (
      <>
        <div className="lm-sans-impression mb-4 flex items-center justify-between gap-2">
          <button type="button" className={cn(nav, '-ml-2')} onClick={() => onChoisir(undefined)}>
            <ChevronLeft className="size-4" aria-hidden />
            Tous les bilans
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className={nav} disabled={!plusAncien} aria-label="Bilan précédent" onClick={() => plusAncien && onChoisir(plusAncien.mois)}>
              <ChevronLeft className={cn('size-4', !plusAncien && 'opacity-40')} aria-hidden />
            </button>
            <button type="button" className={nav} disabled={!plusRecent} aria-label="Bilan suivant" onClick={() => plusRecent && onChoisir(plusRecent.mois)}>
              <ChevronRight className={cn('size-4', !plusRecent && 'opacity-40')} aria-hidden />
            </button>
          </div>
        </div>
        <BilanDetail bilan={bilan} proprietaire={vue.proprietaire.nom} conciergerie={vue.conciergerie.nom} onImprimer={() => window.print()} />
      </>
    );
  }
  return (
    <>
      <p className="mb-4 text-[14px] text-(--lm-encre-2)">Le bilan de chaque mois : séjours, nuits, ce qui a été encaissé, les frais et ce qui vous revient.</p>
      <Card flush>
        <ul className="divide-y divide-(--lm-bord)">
          {vue.bilans.map((b) => (
            <li key={b.mois}>
              <button
                type="button"
                onClick={() => onChoisir(b.mois)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-(--lm-encre)">{titreMois(b.mois)}</span>
                  <span className="block text-[13px] text-(--lm-encre-2)">
                    {pluriel(b.chiffres.totaux.nuits, 'nuit')} · {pourcentage(b.chiffres.occupation)} d’occupation
                  </span>
                </span>
                <span className="text-right">
                  <span className="lm-chiffres block text-[15px] font-semibold text-(--lm-encre)">{euros(b.chiffres.totaux.net, true)}</span>
                  <span className="block text-[12px] text-(--lm-encre-2)">pour vous</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
