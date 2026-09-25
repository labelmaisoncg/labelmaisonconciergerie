import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, UserPlus } from 'lucide-react';
import { dateJour } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import { missionValidable } from '../../../data/selectors';
import type { Mission } from '../../../data/types';
import { Badge, Button, Card, CardHeader, EmptyState } from '../../../ui';
import { urgence } from './outils';

interface Props {
  onAttribuer: (m: Mission) => void;
  onValider: (m: Mission) => void;
  onRefuser: (m: Mission) => void;
}

/** Deux files de travail : missions sans prestataire (par urgence) et missions à valider. */
export function ATraiter({ onAttribuer, onValider, onRefuser }: Props) {
  const d = useErp();
  const nom = (id?: string) => d.logements.find((l) => l.id === id)?.nom ?? 'Logement inconnu';

  const aAttribuer = d.missions
    .filter((m) => m.statut === 'a_attribuer')
    .map((m) => ({ m, u: urgence(m, d) }))
    .sort((a, b) => (a.u.heures ?? Infinity) - (b.u.heures ?? Infinity) || a.m.date.localeCompare(b.m.date));
  const aValider = d.missions.filter((m) => m.statut === 'a_valider').sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card flush>
        <CardHeader
          className="px-4 pt-4 sm:px-5"
          titre={`Sans personne (${aAttribuer.length})`}
          description="Les plus pressés d’abord : le prochain voyageur arrive bientôt."
        />
        {aAttribuer.length === 0 ? (
          <EmptyState icone={<CheckCircle2 />} titre="Chaque ménage a quelqu’un" description="Personne n’est oublié, tout est prévu." />
        ) : (
          <ul className="divide-y divide-(--lm-bord)">
            {aAttribuer.map(({ m, u }) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link to={`/erp/menages/${m.id}`} className="font-medium text-(--lm-encre) hover:text-(--lm-or) hover:underline">
                    {nom(m.logementId)}
                  </Link>
                  <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2) first-letter:uppercase">
                    {LIBELLES.typeMission[m.type]} · {dateJour(m.date)} · {m.heureDebut} à {m.heureFinMax}
                  </p>
                </div>
                <Badge tone={u.ton} icone={<Clock />}>
                  {u.libelle}
                </Badge>
                <Button size="sm" variant="primary" icone={<UserPlus />} onClick={() => onAttribuer(m)}>
                  Confier
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card flush>
        <CardHeader
          className="px-4 pt-4 sm:px-5"
          titre={`À vérifier (${aValider.length})`}
          description="Vérifiez la liste cochée et les photos avant/après. Un ménage est payé seulement une fois vérifié."
        />
        {aValider.length === 0 ? (
          <EmptyState icone={<CheckCircle2 />} titre="Rien à vérifier" description="Tous les ménages terminés ont été vus." />
        ) : (
          <ul className="divide-y divide-(--lm-bord)">
            {aValider.map((m) => {
              const verdict = missionValidable(m);
              const p = d.prestataires.find((x) => x.id === m.prestataireId);
              const faits = m.checklist.filter((c) => c.fait).length;
              const avant = m.photos.filter((x) => x.moment === 'avant').length;
              const apres = m.photos.filter((x) => x.moment === 'apres').length;
              return (
                <li key={m.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <Link to={`/erp/menages/${m.id}`} className="font-medium text-(--lm-encre) hover:text-(--lm-or) hover:underline">
                        {nom(m.logementId)}
                      </Link>
                      <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2) first-letter:uppercase">
                        {dateJour(m.date)} · {p?.nom ?? 'Sans prestataire'} · checklist {faits}/{m.checklist.length} · photos {avant} avant, {apres} après
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onRefuser(m)}>
                      Refuser
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => onValider(m)}>
                      C’est bon
                    </Button>
                  </div>
                  {!verdict.ok && <p className="mt-1.5 text-[12.5px] font-medium text-(--lm-danger)">Bloquée : {verdict.raisons.join(' ')}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
