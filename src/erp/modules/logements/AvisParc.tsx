/**
 * Avis des voyageurs sur tous les logements (/erp/logements/avis), à côté
 * de la liste des logements : trois repères (note, nombre d'avis, tendance),
 * les avis à lire en premier, ce qui revient (thèmes et fréquence) et le
 * tableau par logement. Logements sortis à part ; 12 derniers mois.
 * Sur téléphone : repères, avis à lire, ce qui revient, puis le tableau.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, PageHeader, Section, Table, type Colonne } from '../../ui';
import { useErp } from '../../data/store';
import { AUJOURDHUI, note, pluriel } from '../../data/format';
import { analyseParc, themesDominants, type SyntheseAvis } from '../../data/avis';
import type { Logement } from '../../data/types';
import { BarresThemes, LigneAvis, PanneauAvis, SansAvis } from './_composants/Avis';
import { OngletsLogements } from './_composants/OngletsLogements';

const TENDANCE = { hausse: 'En hausse', baisse: 'En baisse', stable: 'Stable' } as const;

/** « Bruit (5) · Literie (3) » ; vide : rien de récurrent. */
function themes(s: SyntheseAvis, sens: 'positif' | 'negatif'): string {
  return themesDominants(s, sens)
    .map((t) => `${t.libelle} (${sens === 'positif' ? t.positifs : t.negatifs})`)
    .join(' · ');
}

type Ligne = { logement: Logement; synthese: SyntheseAvis };

const PAR_PAGE = 5;

export default function AvisParc() {
  const d = useErp();
  const naviguer = useNavigate();
  const a = useMemo(() => analyseParc(d, AUJOURDHUI), [d]);
  const [tous, setTous] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const noms = useMemo(() => new Map(d.logements.map((l) => [l.id, l.nom])), [d.logements]);
  const p = a.parc;
  const aLire = tous ? p.aLire : p.aLire.slice(0, PAR_PAGE);
  const choisi = p.avis.find((x) => x.reservationId === ouvert);

  const colonnes: Colonne<Ligne>[] = [
    {
      cle: 'logement',
      titre: 'Logement',
      rendu: ({ logement: l }) => (
        <span className="block min-w-0">
          <span className="block font-medium text-(--lm-encre)">{l.nom}</span>
          <span className="block text-[12px] text-(--lm-encre-2)">{l.ville}</span>
        </span>
      ),
      tri: (x, y) => x.logement.nom.localeCompare(y.logement.nom, 'fr'),
    },
    {
      cle: 'note',
      titre: 'Note',
      align: 'droite',
      rendu: ({ synthese: s }) => (
        <span className="block">
          <span className="lm-chiffres block font-medium text-(--lm-encre)">{s.noteMoyenne === undefined ? '-' : note(s.noteMoyenne)}</span>
          <span className="block text-[12px] whitespace-nowrap text-(--lm-encre-2)">{pluriel(s.nombre, 'avis', 'avis')}</span>
        </span>
      ),
      tri: (x, y) => (x.synthese.noteMoyenne ?? 6) - (y.synthese.noteMoyenne ?? 6),
    },
    {
      cle: 'revoir',
      titre: 'À revoir',
      rendu: ({ synthese: s }) => themes(s, 'negatif') || <span className="text-(--lm-encre-3)">Rien de récurrent</span>,
    },
    { cle: 'forts', titre: 'Points forts', masquerMobile: true, rendu: ({ synthese: s }) => themes(s, 'positif') || <span className="text-(--lm-encre-3)">-</span> },
    {
      cle: 'tendance',
      titre: 'Tendance',
      masquerMobile: true,
      rendu: ({ synthese: s }) =>
        s.tendance ? <span className="whitespace-nowrap">{TENDANCE[s.tendance.sens]}</span> : <span className="text-(--lm-encre-3)">Pas assez d’avis</span>,
    },
  ];

  const reperes: { libelle: string; valeur: string; detail?: string }[] = [
    // La période une seule fois : tout l'écran porte sur les 12 derniers mois.
    { libelle: 'Note', valeur: p.noteMoyenne === undefined ? '-' : `${note(p.noteMoyenne)} / 5`, detail: '12 mois' },
    { libelle: 'Avis', valeur: String(p.nombre) },
    {
      libelle: 'Tendance',
      valeur: p.tendance ? TENDANCE[p.tendance.sens] : '-',
      detail: p.tendance ? `${p.tendance.nbRecents} derniers avis\u00a0:\u00a0${note(p.tendance.recente)}` : 'Pas assez d’avis',
    },
  ];

  return (
    <>
      <PageHeader titre="Logements" />
      <OngletsLogements />

      {!p.nombre ? (
        <SansAvis connecte={d.logements.some((l) => l.repull?.id)} />
      ) : (
        // Téléphone : les deux colonnes s'effacent (contents) et l'ordre suit order-* ; ordinateur : deux colonnes.
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="contents lg:col-span-2 lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            <Card flush className="order-1 min-w-0">
              <dl className="grid grid-cols-3 divide-x divide-(--lm-bord)">
                {reperes.map((e) => (
                  <div key={e.libelle} className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-4">
                    <dt className="truncate text-[12px] font-medium text-(--lm-encre-2) sm:text-[12.5px]">{e.libelle}</dt>
                    <dd className="lm-chiffres mt-1 truncate text-[17px] leading-tight font-semibold text-(--lm-encre) min-[390px]:text-[19px] sm:text-[22px]">{e.valeur}</dd>
                    {e.detail && <dd className="mt-0.5 text-[11.5px] leading-snug text-(--lm-encre-3)">{e.detail}</dd>}
                  </div>
                ))}
              </dl>
            </Card>

            <Card flush className="order-2 min-w-0">
              <div className="p-4 pb-0 sm:p-5 sm:pb-0">
                <CardHeader
                  titre="À lire en premier"
                  description={p.aLire.length ? `${pluriel(p.aLire.length, 'avis négatif ou mitigé', 'avis négatifs ou mitigés')}, les plus récents d’abord` : 'Aucun avis négatif.'}
                />
              </div>
              {aLire.length > 0 && (
                <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
                  {aLire.map((x) => (
                    <LigneAvis key={x.reservationId} avis={x} logement={noms.get(x.logementId)} onOuvrir={() => setOuvert(x.reservationId)} />
                  ))}
                </ul>
              )}
              {p.aLire.length > PAR_PAGE && (
                <div className="border-t border-(--lm-bord) px-4 py-2.5 sm:px-5">
                  <button
                    type="button"
                    aria-expanded={tous}
                    onClick={() => setTous((t) => !t)}
                    className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline"
                  >
                    {tous ? 'Réduire' : `Voir les ${p.aLire.length - PAR_PAGE} autres`}
                  </button>
                </div>
              )}
            </Card>

            <Section titre="Par logement" className="order-4 mb-0 min-w-0 sm:mb-0">
              <Table
                legende="Avis par logement : note, thèmes à revoir, points forts, tendance"
                colonnes={colonnes}
                lignes={a.logements}
                cleLigne={(x) => x.logement.id}
                onLigneClick={(x) => naviguer(`/erp/logements/${x.logement.id}#avis`)}
              />
            </Section>
          </div>

          <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
            <Card className="order-3 min-w-0">
              <CardHeader titre="Ce qui revient" description={`Part des ${pluriel(p.nombreCommentes, 'avis commenté', 'avis commentés')} qui en parlent`} />
              <BarresThemes synthese={p} max={6} />
            </Card>
          </div>
        </div>
      )}

      {choisi && <PanneauAvis avis={choisi} ouvert onFermer={() => setOuvert(null)} />}
    </>
  );
}
