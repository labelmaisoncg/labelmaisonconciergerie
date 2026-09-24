import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { dateJour } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import { prestataireConforme } from '../../../data/selectors';
import type { Mission } from '../../../data/types';
import { Badge, Card, CardHeader } from '../../../ui';
import { prochaineArrivee, urgence } from './outils';

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="text-(--lm-encre-2)">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-(--lm-encre)">{children}</dd>
    </div>
  );
}

const lien = 'text-(--lm-or) hover:underline';

/** Colonne d'informations d'une mission : logement, séjours, prestataire, paiement. */
export function Infos({ mission: m, tarif }: { mission: Mission; tarif: string }) {
  const d = useErp();
  const logement = d.logements.find((l) => l.id === m.logementId);
  const prestataire = d.prestataires.find((p) => p.id === m.prestataireId);
  const depart = d.reservations.find((r) => r.id === m.reservationId);
  const suivante = prochaineArrivee(m, d.reservations);
  const u = urgence(m, d);
  const conforme = prestataire ? prestataireConforme(prestataire) : undefined;
  const payable = m.statut === 'validee';

  return (
    <>
      <Card>
        <CardHeader titre="Intervention" />
        <dl className="divide-y divide-(--lm-bord) text-[13px]">
          <Ligne label="Logement">
            {logement ? <Link className={lien} to={`/erp/logements/${logement.id}`}>{logement.nom}</Link> : '-'}
          </Ligne>
          <Ligne label="Adresse">{logement ? `${logement.adresse}, ${logement.ville}` : '-'}</Ligne>
          <Ligne label="Type">{LIBELLES.typeMission[m.type]}</Ligne>
          <Ligne label="Fenêtre">
            <span className="lm-chiffres">{m.heureDebut} → prêt avant {m.heureFinMax}</span>
          </Ligne>
          <Ligne label="Prestataire">
            {prestataire ? (
              <span className="flex flex-col items-end gap-1">
                <Link className={lien} to={`/erp/prestataires/${prestataire.id}`}>{prestataire.nom}</Link>
                <Badge tone={conforme?.ok ? 'succes' : 'danger'} point>{conforme?.ok ? 'Conforme' : 'Non conforme'}</Badge>
              </span>
            ) : (
              <span className="text-(--lm-alerte)">Non attribuée</span>
            )}
          </Ligne>
          <Ligne label="Tarif">
            <span className="lm-chiffres">{tarif}</span>
          </Ligne>
          <Ligne label="Paiement">
            <Badge tone={payable ? 'succes' : m.statut === 'refusee' ? 'danger' : 'neutre'}>
              {payable ? 'Payable' : m.statut === 'refusee' ? 'Non payée (refusée)' : 'Bloqué jusqu’à validation'}
            </Badge>
          </Ligne>
        </dl>
      </Card>
      <Card>
        <CardHeader titre="Séjours" />
        <dl className="divide-y divide-(--lm-bord) text-[13px]">
          <Ligne label="Départ">
            {depart ? (
              <Link className={lien} to={`/erp/reservations/${depart.id}`}>
                {depart.voyageur.nom}, <span>{dateJour(depart.depart)}</span>
              </Link>
            ) : (
              'Aucun séjour lié'
            )}
          </Ligne>
          <Ligne label="Arrivée suivante">
            {suivante ? (
              <Link className={lien} to={`/erp/reservations/${suivante.id}`}>
                {suivante.voyageur.nom}, <span>{dateJour(suivante.arrivee)}</span>
              </Link>
            ) : (
              'Aucune'
            )}
          </Ligne>
        </dl>
        {suivante && !['validee', 'annulee'].includes(m.statut) && (
          <Badge tone={u.ton} icone={<Clock />} className="mt-2">
            {u.libelle}
          </Badge>
        )}
      </Card>
    </>
  );
}
