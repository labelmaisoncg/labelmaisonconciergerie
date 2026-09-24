import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Coins, FileSignature, Target } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, euros, jourMois, moisAnnee, periode, pluriel } from '../../../data/format';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import { LIBELLES } from '../../../data/libelles';
import {
  actionsCommercialesDues,
  commissionPotentielle,
  incidentsOuverts,
  logementById,
  proprietaireById,
  prospectsParEtape,
  releveProprietaire,
  signaturesDuMois,
  valeurPipeline,
} from '../../../data/selectors';
import { Avatar, Badge, Card, CardHeader, ProgressBar, Stat } from '../../../ui';
import { moisPrecedent } from './calculs';

interface Appel {
  id: string;
  proprietaireId: string;
  motif: string;
  ton: 'danger' | 'alerte' | 'or' | 'info';
}

export function KpiCommerciaux() {
  const d = useErp();
  const signatures = signaturesDuMois(d.mandats);
  const dues = actionsCommercialesDues(d.prospects);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Valeur du pipeline" valeur={euros(valeurPipeline(d.prospects), true)} icone={<Target />} aide="revenu annuel estimé" to="/erp/commercial" />
      <Stat label="Commission potentielle" valeur={euros(commissionPotentielle(d.prospects, 18), true)} icone={<Coins />} aide="au taux cible de 18 %" />
      <Stat label="Signatures du mois" valeur={signatures.length} icone={<FileSignature />} aide={moisAnnee(AUJOURDHUI)} to="/erp/mandats" />
      <Stat label="Actions commerciales dues" valeur={dues.length} icone={<CalendarClock />} tone={dues.length ? 'alerte' : 'neutre'} to="/erp/commercial" />
    </div>
  );
}

export function PipelineResume() {
  const d = useErp();
  const parEtape = prospectsParEtape(d.prospects);
  const max = Math.max(1, ...ETAPES_PIPELINE.map((e) => parEtape[e].length));
  const signatures = signaturesDuMois(d.mandats);
  return (
    <Card>
      <CardHeader
        titre="Pipeline propriétaires"
        description={`${pluriel(parEtape.perdu.length, 'prospect perdu', 'prospects perdus')} au total.`}
        actions={<Link to="/erp/commercial" className="text-[12.5px] font-medium text-(--lm-or) hover:underline">Ouvrir le pipeline</Link>}
      />
      <ul className="space-y-2.5">
        {ETAPES_PIPELINE.map((e) => {
          const liste = parEtape[e];
          const valeur = liste.reduce((s, p) => s + p.revenuEstimeAnnuelCentimes, 0);
          return (
            <li key={e} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 text-[12.5px]">
              <span className="truncate text-(--lm-encre-2)">{LIBELLES.etapeProspect[e]}</span>
              <ProgressBar valeur={liste.length / max} tone={e === 'signe' ? 'succes' : 'or'} />
              <span className="lm-chiffres w-24 text-right text-(--lm-encre)">
                <span className="font-semibold">{liste.length}</span> · {euros(valeur, true)}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 border-t border-(--lm-bord) pt-3">
        <p className="mb-2 text-[13px] font-semibold text-(--lm-encre)">Signatures du mois</p>
        {signatures.length ? (
          <ul className="space-y-1 text-[12.5px]">
            {signatures.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-(--lm-encre)">{proprietaireById(d, m.proprietaireId)?.nom} · {logementById(d, m.logementId)?.nom}</span>
                <span className="lm-chiffres text-(--lm-encre-2)">{m.commissionPct} %, le {jourMois(m.signeLe!)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-(--lm-encre-3)">Aucun mandat signé ce mois-ci pour l’instant.</p>
        )}
      </div>
    </Card>
  );
}

export function ProprietairesAAppeler() {
  const d = useErp();
  const appels = useMemo<Appel[]>(() => {
    const liste: Appel[] = [];
    for (const m of d.mandats) {
      const log = logementById(d, m.logementId)?.nom ?? 'logement';
      if (m.statut === 'envoye') liste.push({ id: `sig-${m.id}`, proprietaireId: m.proprietaireId, motif: `Mandat ${m.reference} envoyé, pas encore signé (${log}).`, ton: 'danger' });
      if (m.statut === 'signe' && m.commissionPct < 18)
        liste.push({ id: `com-${m.id}`, proprietaireId: m.proprietaireId, motif: `Ancien mandat à ${m.commissionPct} % (${log}) : préparer la migration à 18-20 % au renouvellement.`, ton: 'or' });
    }
    for (const i of incidentsOuverts(d.incidents).filter((x) => x.refacturable === 'proprietaire' || x.gravite === 'haute')) {
      const l = logementById(d, i.logementId);
      if (l) liste.push({ id: `inc-${i.id}`, proprietaireId: l.proprietaireId, motif: `Incident ${LIBELLES.gravite[i.gravite].toLowerCase()} sur ${l.nom} : ${i.description}`, ton: 'alerte' });
    }
    const ordre = { danger: 0, alerte: 1, or: 2, info: 3 };
    return liste.sort((a, b) => ordre[a.ton] - ordre[b.ton]);
  }, [d]);

  return (
    <Card flush>
      <CardHeader className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3" titre="Propriétaires à appeler" description="Signatures en attente, migrations de commission, incidents à expliquer." />
      {appels.length ? (
        <ul className="divide-y divide-(--lm-bord)">
          {appels.slice(0, 8).map((a) => {
            const p = proprietaireById(d, a.proprietaireId);
            return (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <Avatar nom={p?.nom ?? '?'} taille="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <Link to={`/erp/proprietaires/${a.proprietaireId}`} className="text-[13px] font-semibold text-(--lm-encre) hover:text-(--lm-or) hover:underline">
                    {p?.nom ?? 'Propriétaire'}
                  </Link>
                  <p className="text-[12.5px] text-(--lm-encre-2)">{a.motif}</p>
                </div>
                {p?.contact.telephone && (
                  <a href={`tel:${p.contact.telephone.replace(/\s/g, '')}`} className="lm-chiffres shrink-0 text-[12px] text-(--lm-or) hover:underline">
                    {p.contact.telephone}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-[13px] text-(--lm-encre-3)">Personne à rappeler.</p>
      )}
    </Card>
  );
}

export function RelevesAEnvoyer() {
  const d = useErp();
  const per = periode(moisPrecedent(AUJOURDHUI));
  const releves = d.proprietaires
    .map((p) => ({ p, r: releveProprietaire(d.donnees, p.id, per) }))
    .filter((x) => x.r.lignes.length > 0);
  return (
    <Card flush>
      <CardHeader
        className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3"
        titre="Relevés propriétaires à envoyer"
        description={`Relevés de ${moisAnnee(per)} : réservations, montants versés, commission, frais de ménage.`}
        actions={<Link to="/erp/finance" className="text-[12.5px] font-medium text-(--lm-or) hover:underline">Finance</Link>}
      />
      {releves.length ? (
        <ul className="divide-y divide-(--lm-bord)">
          {releves.map(({ p, r }) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px]">
              <span className="min-w-0">
                <span className="font-medium text-(--lm-encre)">{p.nom}</span>
                <span className="text-(--lm-encre-2)"> · {pluriel(r.lignes.length, 'séjour')}</span>
              </span>
              <span className="lm-chiffres flex items-center gap-2">
                <span className="text-(--lm-encre-2)">commission {euros(r.totaux.commission, true)}</span>
                <Badge tone="or">net {euros(r.totaux.net, true)}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-[13px] text-(--lm-encre-3)">Aucun séjour sur la période.</p>
      )}
    </Card>
  );
}
