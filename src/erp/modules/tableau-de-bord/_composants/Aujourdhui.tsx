import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LogIn, LogOut, Sparkles } from 'lucide-react';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { arriveesDuJour, departsDuJour, logementById, missionsDuJour, prestataireById } from '../../../data/selectors';
import { Badge, Card, StatusBadge, cn } from '../../../ui';

const LIEN = 'inline-flex items-center gap-1.5 text-[13px] font-semibold text-(--lm-encre) hover:text-(--lm-or) [&_svg]:size-4 [&_svg]:text-(--lm-or)';

function Colonne({ titre, icone, n, to, children }: { titre: string; icone: ReactNode; n: number; to: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-(--lm-bord) px-4 py-3 not-first:border-t sm:not-first:border-t-0 lg:not-first:border-l">
      <div className="mb-2 flex items-center justify-between gap-2">
        {to.startsWith('#') ? (
          <a href={to} className={LIEN}>
            {icone}
            {titre}
          </a>
        ) : (
          <Link to={to} className={LIEN}>
            {icone}
            {titre}
          </Link>
        )}
        <span className="lm-chiffres text-[20px] leading-none font-semibold text-(--lm-encre)">{n}</span>
      </div>
      {children}
    </div>
  );
}

const Vide = ({ texte }: { texte: string }) => <p className="text-[12.5px] text-(--lm-encre-3)">{texte}</p>;

/** Bandeau « Aujourd'hui » : arrivées, départs, ménages du jour et alertes. */
export function Aujourdhui({ alertes, urgentes }: { alertes: number; urgentes: number }) {
  const d = useErp();
  const arrivees = arriveesDuJour(d.reservations);
  const departs = departsDuJour(d.reservations);
  const menages = missionsDuJour(d.missions);
  const nomLogement = (id: string) => logementById(d, id)?.nom ?? 'Logement';

  return (
    <Card flush className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.5fr_0.8fr]">
      <Colonne titre="Arrivées" icone={<LogIn />} n={arrivees.length} to="/erp/reservations">
        {arrivees.length ? (
          <ul className="space-y-1 text-[12.5px]">
            {arrivees.map((r) => (
              <li key={r.id} className="truncate">
                <span className="font-medium text-(--lm-encre)">{r.voyageur.nom}</span>
                <span className="text-(--lm-encre-2)"> · {nomLogement(r.logementId)}, {r.voyageur.nbPersonnes} pers., {LIBELLES.canal[r.canal]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vide texte="Aucune arrivée aujourd’hui." />
        )}
      </Colonne>
      <Colonne titre="Départs" icone={<LogOut />} n={departs.length} to="/erp/reservations">
        {departs.length ? (
          <ul className="space-y-1 text-[12.5px]">
            {departs.map((r) => (
              <li key={r.id} className="truncate">
                <span className="font-medium text-(--lm-encre)">{r.voyageur.nom}</span>
                <span className="text-(--lm-encre-2)"> · {nomLogement(r.logementId)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Vide texte="Aucun départ aujourd’hui." />
        )}
      </Colonne>
      <Colonne titre="Ménages du jour" icone={<Sparkles />} n={menages.length} to="/erp/menages">
        {menages.length ? (
          <ul className="space-y-1.5 text-[12.5px]">
            {menages.map((m) => {
              const p = prestataireById(d, m.prestataireId);
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="lm-chiffres text-(--lm-encre-2)">{m.heureDebut}</span>
                  <span className="min-w-0 truncate font-medium text-(--lm-encre)">{nomLogement(m.logementId)}</span>
                  <span className={cn('truncate', p ? 'text-(--lm-encre-2)' : 'font-medium text-(--lm-danger)')}>
                    {p?.nom ?? 'Non attribué'}
                  </span>
                  <StatusBadge type="statutMission" valeur={m.statut} className="ml-auto" />
                </li>
              );
            })}
          </ul>
        ) : (
          <Vide texte="Aucun ménage prévu." />
        )}
      </Colonne>
      <Colonne titre="Alertes" icone={<AlertTriangle />} n={alertes} to="#a-traiter">
        {alertes ? (
          <div className="flex flex-wrap gap-1.5">
            {urgentes > 0 && <Badge tone="danger" point>{urgentes} urgente{urgentes > 1 ? 's' : ''}</Badge>}
            <a href="#a-traiter" className="text-[12.5px] text-(--lm-or) hover:underline">
              Voir la liste
            </a>
          </div>
        ) : (
          <Vide texte="Aucune alerte." />
        )}
      </Colonne>
    </Card>
  );
}
