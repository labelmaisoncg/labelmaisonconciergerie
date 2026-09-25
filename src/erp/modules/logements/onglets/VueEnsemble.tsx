import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Coins, Percent, Sparkles, Star } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, ProgressBar, Stat, StatusBadge } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { COMMISSION_CIBLE_MIN } from '../../../data/constantes';
import { SANS_DONNEE, AUJOURDHUI, dateCourte, euros, jourMois, note, pluriel, pourcentage } from '../../../data/format';
import {
  avancementChecklist,
  estActive,
  incidentsOuverts,
  mandatDuLogement,
  nuitsAnnee,
  prestataireById,
  proprietaireById,
} from '../../../data/selectors';
import type { Logement } from '../../../data/types';
import { statsLogement } from '../_composants/stats';
import { CompteurNuits } from '../_composants/CompteurNuits';

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13.5px]">
      <dt className="text-(--lm-encre-2)">{libelle}</dt>
      <dd className="text-right font-medium text-(--lm-encre)">{children}</dd>
    </div>
  );
}

const lien = 'inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or) hover:underline';

export function OngletVueEnsemble({ logement: l, allerA }: { logement: Logement; allerA: (onglet: string) => void }) {
  const d = useErp();
  const s = statsLogement(d, l);
  const prop = proprietaireById(d, l.proprietaireId);
  const mandat = mandatDuLogement(d.mandats, l.id);
  const av = avancementChecklist(l);
  const resas = d.reservations
    .filter((r) => r.logementId === l.id && estActive(r) && r.depart >= AUJOURDHUI)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
    .slice(0, 5);
  const menages = d.missions
    .filter((m) => m.logementId === l.id && m.type === 'menage' && m.date >= AUJOURDHUI && m.statut !== 'annulee')
    .sort((a, b) => (a.date + a.heureDebut).localeCompare(b.date + b.heureDebut))
    .slice(0, 5);
  const incidents = incidentsOuverts(d.incidents).filter((i) => i.logementId === l.id);
  const lits = l.lits.map((x) => `${x.nombre} ${LIBELLES.typeLit[x.type].toLowerCase()}`).join(', ') || 'Non renseigné';

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        {l.statut === 'lancement' && (
          <Alert
            tone="or"
            titre={`Logement en lancement : ${av.faits}/${av.total} points de checklist validés`}
            actions={
              <Button size="sm" onClick={() => allerA('lancement')}>
                Voir la checklist
              </Button>
            }
          >
            Il ne sera activé qu’avec un mandat signé et une checklist complète.
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Occupation 30 j" valeur={pourcentage(s.occupation30)} icone={<Percent />} aide={`90 j : ${pourcentage(s.occupation90)}`} />
          <Stat label="Revenu brut 30 j" valeur={euros(s.revenu30, true)} icone={<Coins />} aide={`90 j : ${euros(s.revenu90, true)}`} />
          <Stat label="Commission 30 j" valeur={euros(s.commission30, true)} icone={<Sparkles />} aide={`90 j : ${euros(s.commission90, true)}`} />
          <Stat label="Note voyageurs" valeur={s.note === undefined ? SANS_DONNEE : note(s.note)} icone={<Star />} aide="12 derniers mois" />
        </div>

        <Card flush>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader titre="Prochaines réservations" actions={<Link to={`/erp/reservations?logement=${l.id}`} className={lien}>Calendrier <ArrowRight className="size-3.5" /></Link>} />
          </div>
          {resas.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-(--lm-encre-3)">Aucune réservation à venir.</p>
          ) : (
            <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
              {resas.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                  <CalendarDays className="size-4 text-(--lm-encre-3)" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{r.voyageur.nom}</p>
                    <p className="text-[12px] text-(--lm-encre-2)">
                      Du {jourMois(r.arrivee)} au {jourMois(r.depart)} · {pluriel(r.nuits, 'nuit')} · {pluriel(r.voyageur.nbPersonnes, 'voyageur')}
                    </p>
                  </div>
                  <Badge>{LIBELLES.canal[r.canal]}</Badge>
                  <StatusBadge type="statutReservation" valeur={r.statut} />
                  <span className="lm-chiffres w-20 text-right text-[13.5px] font-medium">{euros(r.montantBrutCentimes, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader titre="Prochains ménages" actions={<Link to="/erp/menages" className={lien}>Ménages <ArrowRight className="size-3.5" /></Link>} />
          </div>
          {menages.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-(--lm-encre-3)">Aucun ménage planifié.</p>
          ) : (
            <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
              {menages.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">
                      {dateCourte(m.date)} · {m.heureDebut} à {m.heureFinMax}
                    </p>
                    <p className="text-[12px] text-(--lm-encre-2)">{prestataireById(d, m.prestataireId)?.nom ?? 'Prestataire à attribuer'}</p>
                  </div>
                  <StatusBadge type="statutMission" valeur={m.statut} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        {l.residencePrincipale && <CompteurNuits compteur={nuitsAnnee(d.reservations, l.id)} />}

        <Card>
          <CardHeader titre="Propriétaire et mandat" />
          <dl className="divide-y divide-(--lm-bord)">
            <Ligne libelle="Propriétaire">
              {prop ? <Link to={`/erp/proprietaires/${prop.id}`} className="text-(--lm-or) hover:underline">{prop.nom}</Link> : 'Inconnu'}
            </Ligne>
            {mandat ? (
              <>
                <Ligne libelle="Mandat">
                  <Link to={`/erp/mandats?mandat=${mandat.id}`} className="text-(--lm-or) hover:underline">{mandat.reference}</Link>
                </Ligne>
                <Ligne libelle="Statut"><StatusBadge type="statutMandat" valeur={mandat.statut} /></Ligne>
                <Ligne libelle="Commission">
                  <span className="lm-chiffres">{mandat.commissionPct} %</span>
                  {mandat.commissionPct < COMMISSION_CIBLE_MIN && <Badge tone="alerte" className="ml-1.5">Sous la cible</Badge>}
                </Ligne>
                <Ligne libelle="Frais de ménage"><span className="lm-chiffres">{euros(mandat.fraisMenageCentimes)}</span></Ligne>
                <Ligne libelle="Début">{dateCourte(mandat.dateDebut)}</Ligne>
                {mandat.periodeEssaiFin && <Ligne libelle="Fin de période d’essai">{dateCourte(mandat.periodeEssaiFin)}</Ligne>}
                {mandat.dateFin && <Ligne libelle="Fin">{dateCourte(mandat.dateFin)}</Ligne>}
              </>
            ) : (
              <Ligne libelle="Mandat"><Badge tone="danger">Aucun mandat</Badge></Ligne>
            )}
          </dl>
        </Card>

        <Card>
          <CardHeader titre="Informations clés" />
          <dl className="divide-y divide-(--lm-bord)">
            <Ligne libelle="Type">{LIBELLES.typeLogement[l.type]}, {l.surfaceM2} m²</Ligne>
            <Ligne libelle="Couchage">{pluriel(l.chambres, 'chambre')}, {lits}</Ligne>
            <Ligne libelle="Accès">{LIBELLES.serrure[l.serrure]}</Ligne>
            <Ligne libelle="DPE">{l.dpe ?? <Badge tone="alerte">Non fourni</Badge>}</Ligne>
            <Ligne libelle="N° d’enregistrement">{l.numeroEnregistrement ?? <Badge tone="alerte">Manquant</Badge>}</Ligne>
            <Ligne libelle="Résidence principale">{l.residencePrincipale ? 'Oui (120 nuits max.)' : 'Non'}</Ligne>
          </dl>
        </Card>

        <Card>
          <CardHeader
            titre={`Incidents ouverts (${incidents.length})`}
            actions={<Link to="/erp/incidents" className={lien}>Incidents <ArrowRight className="size-3.5" /></Link>}
          />
          {incidents.length === 0 ? (
            <p className="text-sm text-(--lm-encre-3)">Aucun incident ouvert.</p>
          ) : (
            <ul className="space-y-2.5">
              {incidents.map((i) => (
                <li key={i.id} className="text-[13.5px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge type="gravite" valeur={i.gravite} />
                    <Badge>{LIBELLES.categorieIncident[i.categorie]}</Badge>
                    <span className="text-[12px] text-(--lm-encre-3)">{dateCourte(i.date)}</span>
                  </div>
                  <p className="mt-1 text-(--lm-encre-2)">{i.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {l.statut !== 'lancement' && av.ratio < 1 && (
          <Card>
            <ProgressBar valeur={av.ratio} label="Checklist de lancement" afficherValeur tone="alerte" />
          </Card>
        )}
      </div>
    </div>
  );
}
