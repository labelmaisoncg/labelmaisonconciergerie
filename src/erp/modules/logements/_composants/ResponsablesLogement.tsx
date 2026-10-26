/**
 * Fiche logement, carte « Responsables opérationnels » : les personnes de
 * terrain rattachées au logement (mêmes données que Paramètres → Accès :
 * MembreEquipe.logementIds), leur accès à l'espace opérations, et les
 * « ce logement n'est pas à moi » à traiter. Le gérant rattache une personne
 * existante ici, ou en invite une nouvelle.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, UserPlus } from 'lucide-react';
import { ROLES_OPERATIONS } from '../../../data/operations';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import { Badge, Button, Card, CardHeader, Field, Modal, Select } from '../../../ui';
import { InviterResponsable, Signalements, statutAccesOps } from '../../parametres/Acces';

export function ResponsablesLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const [ajouter, setAjouter] = useState(false);
  const [inviter, setInviter] = useState(false);
  const rattaches = d.donnees.equipe.filter((m) => m.actif && m.logementIds.includes(l.id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const signalements = d.donnees.signalementsLogement.filter((s) => s.statut === 'ouvert' && s.logementId === l.id);

  return (
    <Card>
      <CardHeader
        titre="Responsables opérationnels"
        actions={
          gerant && (
            <Link to={`/erp/parametres/acces?logement=${encodeURIComponent(l.id)}`} className="inline-flex h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline">
              Voir dans Accès
            </Link>
          )
        }
      />
      {signalements.length > 0 && <Signalements liste={signalements} gerant={gerant} imbrique />}
      {rattaches.length ? (
        <ul className="divide-y divide-(--lm-bord)">
          {rattaches.map((m) => {
            const s = statutAccesOps(d.donnees.accesOperations.find((a) => a.id === m.id));
            const tel = m.telephone?.replace(/[^\d+]/g, '');
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="min-w-0 flex-1">
                  <Link to={`/erp/parametres/acces?personne=${encodeURIComponent(m.id)}`} className="group block rounded-md focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none">
                    <span className="block truncate text-[13.5px] font-semibold text-(--lm-encre) group-hover:text-(--lm-or-texte)">{m.nom}</span>
                    <span className="block truncate text-[12.5px] text-(--lm-encre-2)">{ROLES_OPERATIONS[m.role]}</span>
                  </Link>
                  <Badge tone={s.ton} point className="mt-1">
                    {s.texte}
                  </Badge>
                </span>
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    aria-label={`Appeler ${m.nom}`}
                    className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--lm-bord-fort) text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-(--lm-encre-2)">Aucun responsable rattaché.</p>
      )}
      {gerant && (
        <div className="mt-3 border-t border-(--lm-bord) pt-3">
          <Button size="sm" icone={<UserPlus />} onClick={() => setAjouter(true)}>
            Ajouter un responsable
          </Button>
        </div>
      )}
      {ajouter && (
        <Rattacher
          logement={l}
          onFermer={() => setAjouter(false)}
          onInviter={() => {
            setAjouter(false);
            setInviter(true);
          }}
        />
      )}
      {inviter && <InviterResponsable onFermer={() => setInviter(false)} logementsInitiaux={[l.id]} />}
    </Card>
  );
}

/** Rattacher une personne déjà dans l'équipe, ou en inviter une nouvelle. */
function Rattacher({ logement: l, onFermer, onInviter }: { logement: Logement; onFermer: () => void; onInviter: () => void }) {
  const d = useErp();
  const libres = d.donnees.equipe.filter((m) => m.actif && !m.logementIds.includes(l.id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const [choisi, setChoisi] = useState('');
  const rattacher = () => {
    if (!choisi) return;
    d.mettreAJour('equipe', choisi, (m) => ({ ...m, logementIds: [...new Set([...m.logementIds, l.id])] }));
    onFermer();
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Ajouter un responsable"
      description={`La personne verra ${l.nom} dans son espace opérations.`}
      pied={
        <>
          <Button variant="ghost" onClick={onInviter}>
            Inviter quelqu’un de nouveau
          </Button>
          <Button variant="primary" disabled={!choisi} onClick={rattacher}>
            Rattacher
          </Button>
        </>
      }
    >
      {libres.length ? (
        <Field label="Personne de l’équipe">
          <Select value={choisi} placeholder="Choisir" onChange={(e) => setChoisi(e.target.value)} options={libres.map((m) => ({ valeur: m.id, libelle: `${m.nom} · ${ROLES_OPERATIONS[m.role]}` }))} />
        </Field>
      ) : (
        <p className="text-[13.5px] text-(--lm-encre-2)">Toute l’équipe suit déjà ce logement. Invitez une nouvelle personne.</p>
      )}
    </Modal>
  );
}
