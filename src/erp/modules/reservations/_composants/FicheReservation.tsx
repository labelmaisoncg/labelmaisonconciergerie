/**
 * Contenu du détail d'une réservation : séjour, montants, ménage, messages,
 * avis voyageur, incidents. Utilisé par le tiroir et la page dédiée.
 */
import { Link } from 'react-router-dom';
import { MessageSquare, Sparkles, Star } from 'lucide-react';
import { Badge, Card, CardHeader, StatusBadge } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { dateCourte, dateHeure, dateJour, euros, note, pluriel, relatif } from '../../../data/format';
import {
  baseCommissionnable,
  commissionReservation,
  logementById,
  mandatDuLogement,
  netProprietaire,
  prestataireById,
  revenuHebergement,
} from '../../../data/selectors';
import type { Reservation } from '../../../data/types';
import { COULEUR_CANAL } from './outils';

function Ligne({ libelle, valeur, fort, signe }: { libelle: string; valeur: number; fort?: boolean; signe?: '-' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${fort ? 'border-t border-(--lm-bord) pt-2 font-semibold text-(--lm-encre)' : 'text-(--lm-encre-2)'}`}>
      <dt className="text-[13.5px]">{libelle}</dt>
      <dd className="lm-chiffres text-[13.5px] text-(--lm-encre)">
        {signe === '-' && valeur > 0 ? `- ${euros(valeur)}` : euros(valeur)}
      </dd>
    </div>
  );
}

export function PastilleCanal({ canal }: { canal: Reservation['canal'] }) {
  const c = COULEUR_CANAL[canal];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium" style={{ background: c.fond, color: c.texte }}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: c.bord }} />
      {LIBELLES.canal[canal]}
    </span>
  );
}

export function FicheReservation({ r }: { r: Reservation }) {
  const d = useErp();
  const logement = logementById(d, r.logementId);
  const mandat = mandatDuLogement(d.mandats, r.logementId);
  const missions = d.missions.filter((m) => m.reservationId === r.id);
  const fils = d.filsMessages.filter((f) => f.reservationId === r.id);
  const incidents = d.incidents.filter((i) => i.reservationId === r.id);
  const annulee = r.statut === 'annulee';

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader titre="Séjour" actions={<PastilleCanal canal={r.canal} />} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Arrivée</dt>
            <dd className="font-medium">{dateJour(r.arrivee)}</dd>
            <dd className="text-[12px] text-(--lm-encre-3)">{logement?.fiche.heureArrivee ? `dès ${logement.fiche.heureArrivee}` : ''} · {relatif(r.arrivee)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Départ</dt>
            <dd className="font-medium">{dateJour(r.depart)}</dd>
            <dd className="text-[12px] text-(--lm-encre-3)">{logement?.fiche.heureDepart ? `avant ${logement.fiche.heureDepart}` : ''}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Durée</dt>
            <dd className="lm-chiffres font-medium">{pluriel(r.nuits, 'nuit')}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-(--lm-encre-3)">Voyageurs</dt>
            <dd className="lm-chiffres font-medium">
              {pluriel(r.voyageur.nbPersonnes, 'personne')}
              {r.voyageur.pays ? ` · ${r.voyageur.pays}` : ''}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[12px] text-(--lm-encre-3)">Logement</dt>
            <dd className="font-medium">
              {logement ? (
                <Link to={`/erp/logements/${logement.id}`} className="text-(--lm-or) hover:underline">
                  {logement.nom}
                </Link>
              ) : (
                'Logement inconnu'
              )}
              {logement && <span className="font-normal text-(--lm-encre-2)"> · {logement.ville}</span>}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[12px] text-(--lm-encre-3)">Référence Channex</dt>
            <dd className="lm-chiffres">{r.channexBookingId ?? 'Réservation directe, hors Channex'}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader
          titre="Montants"
          description={mandat ? `Mandat ${mandat.reference}, commission ${mandat.commissionPct} %` : 'Aucun mandat : commission non calculée'}
        />
        {annulee && <p className="mb-2 text-[13px] text-(--lm-danger)">Réservation annulée : montants indicatifs, exclus des indicateurs.</p>}
        <dl>
          <Ligne libelle="Montant brut voyageur" valeur={r.montantBrutCentimes} />
          <Ligne libelle="Commission plateforme" valeur={r.commissionPlateformeCentimes} signe="-" />
          <Ligne libelle="Frais de ménage" valeur={r.fraisMenageCentimes} signe="-" />
          <Ligne libelle="Revenu hébergement (brut hors ménage)" valeur={revenuHebergement(r)} />
          <Ligne libelle="Base commissionnable" valeur={baseCommissionnable(r)} fort />
          <Ligne libelle={`Commission Label Maison${mandat ? ` (${mandat.commissionPct} %)` : ''}`} valeur={commissionReservation(r, mandat)} signe="-" />
          <Ligne libelle="Net propriétaire" valeur={netProprietaire(r, mandat)} fort />
        </dl>
        <p className="mt-2 text-[12px] text-(--lm-encre-3)">
          Les frais de ménage reviennent à Label Maison, qui rémunère le prestataire.
        </p>
      </Card>

      <Card>
        <CardHeader titre="Ménage de départ" actions={<Sparkles className="size-4 text-(--lm-or)" aria-hidden />} />
        {missions.length === 0 ? (
          <p className="text-[13px] text-(--lm-encre-3)">{annulee ? 'Aucune mission : séjour annulé.' : 'Aucune mission rattachée.'}</p>
        ) : (
          <ul className="divide-y divide-(--lm-bord)">
            {missions.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link to={`/erp/menages/${m.id}`} className="text-[13.5px] font-medium text-(--lm-encre) hover:text-(--lm-or) hover:underline">
                    {LIBELLES.typeMission[m.type]} du {dateCourte(m.date)}
                  </Link>
                  <p className="text-[12px] text-(--lm-encre-3)">
                    {m.heureDebut} à {m.heureFinMax} · {prestataireById(d, m.prestataireId)?.nom ?? 'Prestataire à attribuer'}
                  </p>
                </div>
                <StatusBadge type="statutMission" valeur={m.statut} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader titre="Messages voyageur" actions={<MessageSquare className="size-4 text-(--lm-or)" aria-hidden />} />
        {fils.length === 0 ? (
          <p className="text-[13px] text-(--lm-encre-3)">Aucun échange enregistré pour ce séjour.</p>
        ) : (
          <ul className="divide-y divide-(--lm-bord)">
            {fils.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link to={`/erp/messagerie/${f.id}`} className="min-w-0 text-[13.5px] font-medium hover:text-(--lm-or) hover:underline">
                  {pluriel(f.messages.length, 'message')} · dernier le {dateHeure(f.dernierMessageLe)}
                </Link>
                <div className="flex gap-1.5">
                  <StatusBadge type="statutFil" valeur={f.statut} />
                  <StatusBadge type="traitePar" valeur={f.traitePar} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(r.noteVoyageur !== undefined || r.commentaireVoyageur) && (
        <Card>
          <CardHeader
            titre="Avis du voyageur"
            actions={
              r.noteVoyageur !== undefined && (
                <Badge tone={r.noteVoyageur < 4.5 ? 'danger' : 'succes'} icone={<Star />}>
                  {note(r.noteVoyageur)} / 5
                </Badge>
              )
            }
          />
          {r.commentaireVoyageur && <blockquote className="border-l-2 border-(--lm-or) pl-3 text-[13.5px] text-(--lm-encre-2) italic">« {r.commentaireVoyageur} »</blockquote>}
          {r.noteVoyageur !== undefined && r.noteVoyageur < 4.5 && (
            <p className="mt-2 text-[12.5px] text-(--lm-danger)">Note inférieure à 4,5 : contrôle qualité déclenché sur le ménage.</p>
          )}
        </Card>
      )}

      <Card>
        <CardHeader titre="Incidents" />
        {incidents.length === 0 ? (
          <p className="text-[13px] text-(--lm-encre-3)">Aucun incident sur ce séjour.</p>
        ) : (
          <ul className="divide-y divide-(--lm-bord)">
            {incidents.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link to={`/erp/incidents/${i.id}`} className="min-w-0 flex-1 text-[13.5px] hover:text-(--lm-or) hover:underline">
                  {LIBELLES.categorieIncident[i.categorie]} : {i.description}
                </Link>
                <StatusBadge type="statutIncident" valeur={i.statut} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
