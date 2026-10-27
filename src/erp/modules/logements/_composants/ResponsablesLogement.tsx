/**
 * Fiche logement, carte « Responsables opérationnels » : les personnes de
 * terrain rattachées au logement (mêmes données que Paramètres → Accès :
 * MembreEquipe.logementIds), qui s'en occupe au quotidien et pendant une
 * absence (affectation ; par défaut, la seule personne qui le suit), leur
 * accès à l'espace opérations, et les « ce logement n'est pas à moi » à
 * traiter. Le gérant rattache une personne existante ici, ou en invite une
 * nouvelle ; les autres comptes voient les noms, sans les accès.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, UserPlus } from 'lucide-react';
import { phraseRemplacement } from '../../../data/acces-gerant';
import { AUJOURDHUI } from '../../../data/format';
import { ROLES_OPERATIONS, affectationsAFiger, quiSuit, remplacantDe, responsableLe, titulaireDe } from '../../../data/operations';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import type { AffectationLogement } from '../../../data/types-operations';
import { Badge, Button, Card, CardHeader, Field, Modal, Select } from '../../../ui';
import { InviterResponsable, Signalements, statutAccesOps } from '../../parametres/Acces';

export function ResponsablesLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const [ajouter, setAjouter] = useState(false);
  const [inviter, setInviter] = useState(false);
  const rattaches = quiSuit(d.donnees.equipe, l.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const signalements = d.donnees.signalementsLogement.filter((s) => s.statut === 'ouvert' && s.logementId === l.id);
  const responsableId = titulaireDe(d.donnees, l.id);
  const remplacantId = remplacantDe(d.donnees, l.id);
  const explicite = !!d.donnees.affectations.find((a) => a.id === l.id)?.responsableId;
  // Aujourd'hui : le titulaire absent est remplacé (même règle que l'espace opérations).
  const absence = phraseRemplacement(responsableLe(d.donnees, l.id, AUJOURDHUI), (id) => d.donnees.equipe.find((m) => m.id === id)?.nom);
  const choix = rattaches.map((m) => ({ valeur: m.id, libelle: m.nom }));
  const affecter = (patch: { responsableId?: string; remplacantId?: string }) => {
    const avant = d.donnees.affectations.find((a) => a.id === l.id);
    const r = 'responsableId' in patch ? patch.responsableId : responsableId;
    let s = 'remplacantId' in patch ? patch.remplacantId : remplacantId;
    if (s && s === r) s = undefined;
    const a: AffectationLogement = { id: l.id, ...(r ? { responsableId: r } : {}), ...(s ? { remplacantId: s } : {}), ...(avant?.pointsControle?.length ? { pointsControle: avant.pointsControle } : {}) };
    d.upsert('affectations', a);
  };

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
      {gerant && signalements.length > 0 && <Signalements liste={signalements} gerant={gerant} imbrique />}
      {rattaches.length ? (
        <ul className="divide-y divide-(--lm-bord)">
          {rattaches.map((m) => {
            const s = statutAccesOps(d.donnees.accesOperations.find((a) => a.id === m.id), m);
            const tel = m.telephone?.replace(/[^\d+]/g, '');
            const charge = m.id === responsableId ? ['Au quotidien', absence].filter(Boolean).join(' · ') : m.id === remplacantId ? 'Pendant une absence' : undefined;
            return (
              <li key={m.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="min-w-0 flex-1">
                  {gerant ? (
                    <Link to={`/erp/parametres/acces?personne=${encodeURIComponent(m.id)}`} className="group block rounded-md focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none">
                      <span className="block truncate text-[13.5px] font-semibold text-(--lm-encre) group-hover:text-(--lm-or-texte)">{m.nom}</span>
                      {/* Le rôle sur le logement est dans les choix plus bas ; ici, seulement l'absence du jour. */}
                      <span className="block truncate text-[12.5px] text-(--lm-encre-2)">{[ROLES_OPERATIONS[m.role], m.id === responsableId ? absence : undefined].filter(Boolean).join(' · ')}</span>
                    </Link>
                  ) : (
                    <>
                      <span className="block truncate text-[13.5px] font-semibold text-(--lm-encre)">{m.nom}</span>
                      <span className="block truncate text-[12.5px] text-(--lm-encre-2)">{[ROLES_OPERATIONS[m.role], charge].filter(Boolean).join(' · ')}</span>
                    </>
                  )}
                  {gerant && (
                    <Badge tone={s.ton} point className="mt-1">
                      {s.texte}
                    </Badge>
                  )}
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
      {gerant && rattaches.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-(--lm-bord) pt-3 sm:grid-cols-2">
          <Field
            label="Au quotidien"
            aide={explicite ? undefined : responsableId ? 'Par défaut : seul agent de terrain sur ce logement.' : 'À choisir : personne n’a les codes ni les incidents.'}
          >
            <Select value={responsableId ?? ''} placeholder="Personne" onChange={(e) => affecter({ responsableId: e.target.value || undefined })} options={choix} />
          </Field>
          <Field label="Pendant une absence">
            <Select value={remplacantId ?? ''} placeholder="Personne" onChange={(e) => affecter({ remplacantId: e.target.value || undefined })} options={choix.filter((c) => c.valeur !== responsableId)} />
          </Field>
        </div>
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
    // Le responsable par défaut d'avant devient un choix enregistré : il garde la charge.
    for (const a of affectationsAFiger(d.donnees, [l.id])) d.upsert('affectations', a);
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
