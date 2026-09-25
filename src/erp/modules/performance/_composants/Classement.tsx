import { useNavigate, Link } from 'react-router-dom';
import { CircleDollarSign, Handshake, TrendingUp } from 'lucide-react';
import type { AnalyseParc, LigneParc } from '../../../analyse';
import { euros, nombre } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Badge, Stat, Table, type Colonne } from '../../../ui';
import { Aide, aideKpi, BadgeRecommandation, CelluleKpi, LibelleAide } from './commun';

const ORDRE_RECO = { developper: 0, garder: 1, surveiller: 2, renegocier: 3, sortir: 4 } as const;

export function Synthese({ parc }: { parc: AnalyseParc }) {
  const { recommandations } = useErp();
  const l = parc.lignes;
  const rentables = l.filter((x) => x.analyse.rentable).length;
  const marge = l.reduce((s, x) => s + x.analyse.margeMois, 0);
  const n = (r: string) => l.filter((x) => x.analyse.recommandation === r).length;
  const attente = recommandations.filter((r) => r.statut === 'a_proposer' || r.statut === 'proposee').length;
  const impact = recommandations.filter((r) => r.statut === 'acceptee' || r.statut === 'realisee').reduce((s, r) => s + (r.impactEstimeCentimesMois ?? 0), 0);
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat
        label={<LibelleAide texte="Un logement est rentable quand, sur 90 jours, il vous rapporte plus qu’il ne vous coûte : ménages, dépenses, incidents non remboursés et part des frais généraux.">Logements rentables</LibelleAide>}
        valeur={`${rentables}/${l.length}`}
        icone={<TrendingUp />}
        tone={rentables < l.length ? 'alerte' : 'neutre'}
        aide={n('developper') ? `${n('developper')} à développer` : 'sur les 90 derniers jours'}
      />
      <Stat
        label={<LibelleAide texte={aideKpi('margeMois')}>Ce qu’ils vous rapportent</LibelleAide>}
        valeur={euros(marge, true)}
        icone={<CircleDollarSign />}
        aide={impact ? `par mois · ${euros(impact, true)} de plus attendus grâce aux conseils acceptés` : 'par mois, en moyenne sur 90 jours'}
      />
      <Stat
        label="À revoir avec le propriétaire"
        valeur={n('sortir') + n('renegocier')}
        icone={<Handshake />}
        tone={n('sortir') ? 'danger' : n('renegocier') ? 'alerte' : 'neutre'}
        aide={n('sortir') + n('renegocier') ? `${n('renegocier')} à renégocier, ${n('sortir')} à arrêter` : `${attente} conseil${attente > 1 ? 's' : ''} à proposer`}
      />
    </div>
  );
}

const kpi = (x: LigneParc, cle: string) => x.analyse.kpis.find((k) => k.cle === cle)?.valeur;
const tri = (cle: string) => (a: LigneParc, b: LigneParc) => (kpi(a, cle) ?? -Infinity) - (kpi(b, cle) ?? -Infinity);

export function TableauParc({ parc }: { parc: AnalyseParc }) {
  const naviguer = useNavigate();
  const c = parc.contexte;
  const colonnes: Colonne<LigneParc>[] = [
    { cle: 'rang', titre: '#', rendu: (x) => <span className="lm-chiffres text-(--lm-encre-3)">{x.rang}</span>, largeur: 'w-8' },
    {
      cle: 'logement', titre: 'Logement',
      rendu: (x) => (
        <Link to={`/erp/logements/${x.analyse.logement.id}?onglet=performance`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-(--lm-or) hover:underline">
          {x.analyse.logement.nom}
        </Link>
      ),
      tri: (a, b) => a.analyse.logement.nom.localeCompare(b.analyse.logement.nom),
    },
    {
      cle: 'score', titre: <LibelleAide texte="Score 0-100 : marge 35 %, occupation 20 %, note 20 %, charge opérationnelle 15 %, conformité 10 %.">Score</LibelleAide>,
      rendu: (x) => <span className="lm-chiffres font-semibold">{x.score}</span>, tri: (a, b) => a.score - b.score, align: 'droite',
    },
    {
      cle: 'verdict', titre: 'Verdict',
      rendu: (x) => <span title={x.analyse.justification.join(' ')}><BadgeRecommandation valeur={x.analyse.recommandation} /></span>,
      tri: (a, b) => ORDRE_RECO[a.analyse.recommandation] - ORDRE_RECO[b.analyse.recommandation],
    },
    { cle: 'marge', titre: <LibelleAide texte={aideKpi('margeMois')}>Marge LM / mois</LibelleAide>, rendu: (x) => <CelluleKpi cle="margeMois" valeur={kpi(x, 'margeMois')} />, tri: tri('margeMois'), align: 'droite' },
    { cle: 'occupation', titre: <LibelleAide texte={aideKpi('occupation')}>Occupation</LibelleAide>, rendu: (x) => <CelluleKpi cle="occupation" valeur={kpi(x, 'occupation')} />, tri: tri('occupation'), align: 'droite' },
    {
      cle: 'adr', titre: <LibelleAide texte={`${aideKpi('adr')} Médiane : ${euros(c.medianeAdr, true)}.`}>ADR</LibelleAide>,
      rendu: (x) => <CelluleKpi cle="adr" valeur={kpi(x, 'adr')} affichage={euros(x.analyse.adr90, true)} />, tri: tri('adr'), align: 'droite', masquerMobile: true,
    },
    {
      cle: 'revpar', titre: <LibelleAide texte={`${aideKpi('revpar')} Médiane : ${euros(c.medianeRevpar, true)}.`}>RevPAR vs parc</LibelleAide>,
      rendu: (x) => <CelluleKpi cle="revpar" valeur={kpi(x, 'revpar')} />, tri: tri('revpar'), align: 'droite', masquerMobile: true,
    },
    {
      cle: 'note', titre: <LibelleAide texte={aideKpi('note')}>Note</LibelleAide>,
      rendu: (x) => (
        <span className="inline-flex items-center gap-1">
          <CelluleKpi cle="note" valeur={x.analyse.note12} />
          <span className="text-[11.5px] text-(--lm-encre-3)">({x.analyse.nbAvis12})</span>
        </span>
      ),
      tri: tri('note'), align: 'droite',
    },
    {
      cle: 'defauts', titre: 'Défauts',
      rendu: (x) => {
        const d = x.analyse.defauts;
        const hautes = d.filter((y) => y.gravite === 'haute').length;
        if (!d.length) return <span className="text-(--lm-encre-3)">0</span>;
        return (
          <Badge tone={hautes ? 'danger' : d.some((y) => y.gravite === 'moyenne') ? 'alerte' : 'neutre'} title={d.map((y) => y.titre).join(', ')}>
            {d.length}{hautes ? ` dont ${hautes} grave${hautes > 1 ? 's' : ''}` : ''}
          </Badge>
        );
      },
      tri: (a, b) => a.analyse.defauts.length - b.analyse.defauts.length, align: 'droite',
    },
    {
      cle: 'commission', titre: <LibelleAide texte={aideKpi('commission')}>Commission</LibelleAide>,
      rendu: (x) => <CelluleKpi cle="commission" valeur={x.analyse.commissionPct} />, tri: tri('commission'), align: 'droite', masquerMobile: true,
    },
  ];
  return (
    <>
      <Table
        legende="Classement des biens par score de performance"
        colonnes={colonnes}
        lignes={parc.lignes}
        cleLigne={(x) => x.analyse.logement.id}
        onLigneClick={(x) => naviguer(`/erp/logements/${x.analyse.logement.id}?onglet=performance`)}
        vide="Aucun logement actif à analyser."
      />
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-(--lm-encre-3)">
        <span>Médianes du parc : occupation {nombre(c.medianeOccupation * 100)} %, ADR {euros(c.medianeAdr, true)}, RevPAR {euros(c.medianeRevpar, true)}, marge {euros(c.medianeMargeMois, true)} / mois.</span>
        <span className="inline-flex items-center gap-1">Couleurs : vert bon, ambre correct, rouge faible <Aide texte="Survolez une valeur pour lire son explication. Seuils détaillés dans l’onglet « Comprendre les indicateurs »." /></span>
      </p>
    </>
  );
}
