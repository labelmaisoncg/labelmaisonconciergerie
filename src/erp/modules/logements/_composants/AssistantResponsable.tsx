/**
 * « Ajouter un responsable » de la fiche logement, pas à pas (kit
 * ui/Assistant.tsx) : une personne de l'équipe à rattacher, ou une nouvelle
 * personne à inviter (son e-mail, son nom et son rôle, ses logements). Rien
 * n'est enregistré avant « Rattacher » ou « Inviter » ; règles :
 * data/creation-responsable.ts. Rattacher et inviter écrivent comme avant
 * (affectationsAFiger, logementIds ; inviterResponsable de Paramètres → Accès).
 */
import { useId, useMemo, useRef, useState } from 'react';
import { affectationsAFiger, ROLES_OPERATIONS } from '../../../data/operations';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  NOUVELLE_PERSONNE,
  SANS_CHAMP_RESPONSABLE,
  brouillonResponsable,
  ecranDeLaCleResponsable,
  ecransResponsable,
  erreursResponsable,
  ficheAvecEmail,
  personnesLibres,
  recapResponsable,
  roleRetenu,
  type BrouillonResponsable,
  type EcranResponsable,
} from '../../../data/creation-responsable';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import type { RoleOperations } from '../../../data/types-operations';
import { Alert, Assistant, Button, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, Field, Input, Modal, NBSP, RecapAssistant, useParcours } from '../../../ui';
import { LienInvitation, ListeLogements, inviterResponsable, logementsGeres, type Invitation } from '../../parametres/Acces';

const idChamp = (cle: string) => `assistant-responsable-${cle}`;

const ROLES = (Object.keys(ROLES_OPERATIONS) as RoleOperations[]).map((r) => ({ valeur: r, libelle: ROLES_OPERATIONS[r] }));

export function AssistantResponsable({ logement: l, onFermer }: { logement: Logement; onFermer: () => void }) {
  const d = useErp();
  const equipe = d.donnees.equipe;
  const libres = useMemo(() => personnesLibres(equipe, l.id), [equipe, l.id]);
  const [b, setB] = useState<BrouillonResponsable>(() => brouillonResponsable(l.id, libres));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const [invitation, setInvitation] = useState<Invitation>();
  const titreId = useId();
  const ecrans = ecransResponsable(b.choix);
  const ctx = { equipe, libres };
  const p = useParcours<EcranResponsable>({ ecrans, idChamp, sansChamp: SANS_CHAMP_RESPONSABLE });
  const ecran = p.ecran;
  const erreurs = erreursResponsable(ecran, b, ctx);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonResponsable>) => setB((x) => ({ ...x, ...patch }));
  const nouvelle = b.choix === NOUVELLE_PERSONNE;
  const existant = nouvelle ? ficheAvecEmail(equipe, b.email) : undefined;
  const logements = useMemo(() => logementsGeres(d.logements), [d.logements]);

  const finir = async () => {
    if (envoi) return;
    const tout = Object.keys(erreursResponsable('recapitulatif', b, ctx));
    if (tout.length) return p.corriger(ecranDeLaCleResponsable(tout[0]), tout);
    if (!nouvelle) {
      // Le responsable par défaut d'avant devient un choix enregistré : il garde la charge.
      for (const a of affectationsAFiger(d.donnees, [l.id])) d.upsert('affectations', a);
      d.mettreAJour('equipe', b.choix, (m) => ({ ...m, logementIds: [...new Set([...m.logementIds, l.id])] }));
      onFermer();
      return;
    }
    setEnvoi(true);
    setErreurEnvoi(undefined);
    const r = await inviterResponsable(d, { nom: b.nom, email: b.email, telephone: b.telephone, role: b.role, logementIds: b.logementIds });
    setEnvoi(false);
    if (r.invitation) setInvitation(r.invitation);
    else setErreurEnvoi(r.erreur);
  };
  const continuer = () => p.continuer(erreurs, () => void finir());

  // Invitation partie (ou lien de démonstration) : le lien à copier, comme dans Paramètres → Accès.
  if (invitation) {
    return (
      <Modal
        ouvert
        onFermer={onFermer}
        titre="Inviter un responsable"
        description="Il reçoit un lien personnel, valable 7 jours, vers son espace opérations."
        pied={
          <Button variant="primary" onClick={onFermer}>
            Terminé
          </Button>
        }
      >
        <LienInvitation invitation={invitation} />
      </Modal>
    );
  }

  const questions: Record<EcranResponsable, { question: string; aide?: string }> = {
    qui: { question: `Qui va s’occuper de ${l.nom}${NBSP}?`, aide: 'La personne le verra dans son espace opérations.' },
    email: { question: `Quelle est son adresse e-mail${NBSP}?`, aide: 'Elle reçoit un lien personnel, valable 7 jours, vers son espace opérations.' },
    identite: { question: `Qui est-ce${NBSP}?` },
    logements: { question: `Quels logements suivra-t-elle${NBSP}?` },
    recapitulatif: { question: `Tout est correct${NBSP}?` },
  };
  const q = questions[ecran];

  return (
    <Assistant
      titre="Ajouter un responsable"
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite(nouvelle ? 'Inviter' : 'Rattacher')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner l’ajout${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'qui' && (
        <>
          {!libres.length && <p className="mb-3 text-[14px] text-(--lm-encre-2)">Toute l’équipe suit déjà ce logement.</p>}
          <ChoixListe
            options={[
              ...libres.map((m) => ({ valeur: m.id, libelle: m.nom, detail: ROLES_OPERATIONS[m.role] })),
              { valeur: NOUVELLE_PERSONNE, libelle: 'Une nouvelle personne', detail: 'Invitée par e-mail' },
            ]}
            valeur={b.choix || undefined}
            onChange={(choix) => maj({ choix })}
            onContinuer={continuer}
            labelledBy={titreId}
            idPremier={idChamp('choix')}
          />
        </>
      )}
      {ecran === 'email' && (
        <Field label="Adresse e-mail" aide={existant ? `Une fiche existe déjà avec cette adresse${NBSP}: elle est reprise.` : undefined} erreur={etat.erreurChamp('email')}>
          <Input
            id={idChamp('email')}
            type="email"
            inputMode="email"
            value={b.email}
            onChange={(e) => maj({ email: e.target.value })}
            onBlur={() => p.quitter('email')}
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'identite' && (
        <Identite b={b} maj={maj} existant={existant} erreur={etat.erreurChamp('nom')} quitter={p.quitter} continuer={continuer} />
      )}
      {ecran === 'logements' && (
        <ListeLogements
          logements={logements}
          coches={b.logementIds}
          onChange={(logementIds) => maj({ logementIds })}
          regle={(x) => (existant?.logementIds.includes(x.id) ? { verrou: true, detail: 'Déjà suivi' } : {})}
        />
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapResponsable(b, { equipe, logements: d.logements }).map((x) => ({ ...x, onModifier: () => p.modifier(x.ecran) }))}>
          {erreurEnvoi && (
            <Alert tone="danger" className="mt-4">
              {erreurEnvoi}
            </Alert>
          )}
        </RecapAssistant>
      )}
    </Assistant>
  );
}

function Identite({
  b,
  maj,
  existant,
  erreur,
  quitter,
  continuer,
}: {
  b: BrouillonResponsable;
  maj: (p: Partial<BrouillonResponsable>) => void;
  existant?: { nom: string; telephone?: string; role: RoleOperations };
  erreur?: string;
  quitter: (cle: string) => void;
  continuer: () => void;
}) {
  const roleId = useId();
  const { donnees } = useErp();
  return (
    <div className="space-y-4">
      <Field label="Nom" erreur={erreur}>
        <Input
          id={idChamp('nom')}
          value={existant ? existant.nom : b.nom}
          disabled={!!existant}
          onChange={(e) => maj({ nom: e.target.value })}
          onBlur={() => quitter('nom')}
          autoComplete="off"
          className={CHAMP_ASSISTANT}
        />
      </Field>
      <div>
        <p id={roleId} className="mb-1.5 text-[13px] font-semibold text-(--lm-encre)">
          Rôle
        </p>
        <ChoixCourts options={ROLES} valeur={roleRetenu(b, donnees.equipe)} onChange={(role) => maj({ role })} onContinuer={continuer} labelledBy={roleId} className="grid-cols-1 sm:grid-cols-2" />
      </div>
      <Field label="Téléphone" aide="Facultatif.">
        <Input
          id={idChamp('telephone')}
          type="tel"
          value={existant?.telephone ?? b.telephone}
          disabled={!!existant?.telephone}
          onChange={(e) => maj({ telephone: e.target.value })}
          autoComplete="off"
          className={CHAMP_ASSISTANT}
        />
      </Field>
    </div>
  );
}
