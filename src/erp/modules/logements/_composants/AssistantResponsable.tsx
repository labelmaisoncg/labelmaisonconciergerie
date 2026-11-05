/**
 * « Ajouter un responsable » de la fiche logement, pas à pas (kit
 * ui/Assistant.tsx) : une personne de l'équipe à rattacher, ou une nouvelle
 * personne à inviter (comment la joindre, son nom, son rôle, ses logements :
 * une question par écran). Rien n'est enregistré avant « Rattacher » ou
 * « Envoyer l'invitation » ; règles :
 * data/creation-responsable.ts. Rattacher et inviter écrivent comme avant
 * (affectationsAFiger, logementIds ; inviterResponsable de Paramètres → Accès).
 *
 * Sans logement (Paramètres → Accès, « Inviter un responsable ») : toujours
 * une personne à inviter, sans le premier choix ; les logements de la page
 * filtrée sont cochés d'office. Un espace sans aucun logement le dit dès
 * l'ouverture (Prerequis), avant toute saisie.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { affectationsAFiger, ROLES_OPERATIONS } from '../../../data/operations';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_INVITATION_RESPONSABLE,
  NOUVELLE_PERSONNE,
  SANS_CHAMP_RESPONSABLE,
  brouillonInvitationResponsable,
  brouillonResponsable,
  ecranDeLaCleResponsable,
  ecransResponsable,
  erreursResponsable,
  ficheAvecEmail,
  personnesLibres,
  recapResponsable,
  roleRetenu,
  saisieInvitationResponsable,
  type BrouillonResponsable,
  type EcranResponsable,
} from '../../../data/creation-responsable';
import { useErp } from '../../../data/store';
import type { Id, Logement } from '../../../data/types';
import type { RoleOperations } from '../../../data/types-operations';
import { Alert, Assistant, Button, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, Field, Input, Modal, NBSP, Prerequis, RecapAssistant, insecables, useParcours } from '../../../ui';
import { LienInvitation, ListeLogements, inviterResponsable, logementsGeres, titreInvitationFaite, type Invitation } from '../../parametres/Acces';

const idChamp = (cle: string) => `assistant-responsable-${cle}`;

const ROLES = (Object.keys(ROLES_OPERATIONS) as RoleOperations[]).map((r) => ({ valeur: r, libelle: ROLES_OPERATIONS[r] }));

export function AssistantResponsable({ logement: l, logementsInitiaux = [], onFermer }: { logement?: Logement; logementsInitiaux?: Id[]; onFermer: () => void }) {
  const d = useErp();
  const equipe = d.donnees.equipe;
  const libres = useMemo(() => (l ? personnesLibres(equipe, l.id) : []), [equipe, l]);
  const [b, setB] = useState<BrouillonResponsable>(() => (l ? brouillonResponsable(l.id, libres) : brouillonInvitationResponsable(logementsInitiaux)));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const [invitation, setInvitation] = useState<Invitation>();
  const titreId = useId();
  const ecrans = l ? ecransResponsable(b.choix) : ECRANS_INVITATION_RESPONSABLE;
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
    if (!nouvelle && l) {
      // Le responsable par défaut d'avant devient un choix enregistré : il garde la charge.
      for (const a of affectationsAFiger(d.donnees, [l.id])) d.upsert('affectations', a);
      d.mettreAJour('equipe', b.choix, (m) => ({ ...m, logementIds: [...new Set([...m.logementIds, l.id])] }));
      onFermer();
      return;
    }
    setEnvoi(true);
    setErreurEnvoi(undefined);
    const r = await inviterResponsable(d, saisieInvitationResponsable(b));
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
        titre={titreInvitationFaite(invitation)}
        description={`Il reçoit un lien personnel, valable 7${NBSP}jours, vers son espace opérations.`}
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
    qui: { question: `Qui va s’occuper de ${l?.nom ?? 'ce logement'}${NBSP}?`, aide: 'La personne le verra dans son espace opérations.' },
    email: { question: `Comment la joindre${NBSP}?`, aide: `Elle reçoit un lien personnel, valable 7${NBSP}jours, vers son espace opérations.` },
    nom: { question: `Quel est son nom${NBSP}?` },
    role: { question: `Quel sera son rôle${NBSP}?` },
    logements: { question: `Quels logements suivra cette personne${NBSP}?` },
    recapitulatif: { question: `Tout est correct${NBSP}?` },
  };
  // Aucun logement dans l'espace (Paramètres → Accès, base vide) : un responsable suit toujours au moins un
  // logement. Dit dès l'ouverture, avant toute saisie (« Nouveau logement » quitte l'assistant).
  const sansLogementAuDepart = !l && !logements.length;
  const sansLogement = sansLogementAuDepart || (ecran === 'logements' && !logements.length && !existant?.logementIds.length);
  const q = sansLogementAuDepart ? questions.logements : questions[ecran];

  return (
    <Assistant
      titre={l ? 'Nouveau responsable' : 'Inviter un responsable'}
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite(nouvelle ? 'Envoyer l’invitation' : 'Rattacher')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={sansLogement}
      saisi={brouillonModifie(depart.current, b)}
      abandon={l ? `Abandonner l’ajout${NBSP}?` : `Abandonner l’invitation${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {sansLogement ? (
        <Prerequis manque="Vous n’avez pas encore de logement." detail="Un responsable suit toujours au moins un logement." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
      ) : (
        <>
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
            <div className="space-y-4">
              <Field label="Adresse e-mail" aide={existant ? insecables(`Une fiche existe déjà avec cette adresse${NBSP}: elle est reprise.`) : undefined} erreur={etat.erreurChamp('email')}>
                <Input
                  id={idChamp('email')}
                  type="email"
                  inputMode="email"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={b.email}
                  onChange={(e) => maj({ email: e.target.value })}
                  onBlur={() => p.quitter('email')}
                  autoComplete="off"
                  className={CHAMP_ASSISTANT}
                />
              </Field>
              <Field label="Téléphone" aide={existant?.telephone ? 'Celui de la fiche reprise.' : 'Facultatif.'}>
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
          )}
          {ecran === 'nom' && (
            <Field label="Nom" aide={existant ? 'Celui de la fiche reprise.' : undefined} erreur={etat.erreurChamp('nom')}>
              <Input
                id={idChamp('nom')}
                value={existant ? existant.nom : b.nom}
                disabled={!!existant}
                onChange={(e) => maj({ nom: e.target.value })}
                onBlur={() => p.quitter('nom')}
                autoComplete="off"
                className={CHAMP_ASSISTANT}
              />
            </Field>
          )}
          {ecran === 'role' && (
            <ChoixCourts
              options={ROLES}
              valeur={roleRetenu(b, equipe)}
              onChange={(role) => maj({ role })}
              onContinuer={continuer}
              labelledBy={titreId}
              idPremier={idChamp('role')}
              className="grid-cols-1 sm:grid-cols-2"
            />
          )}
          {ecran === 'logements' && (
            <ListeLogements
              logements={logements}
              coches={b.logementIds}
              onChange={(logementIds) => maj({ logementIds })}
              pleineHauteur
              regle={(x) => (existant?.logementIds.includes(x.id) ? { verrou: true, detail: 'Déjà suivi' } : {})}
            />
          )}
          {ecran === 'recapitulatif' && (
            <RecapAssistant lignes={recapResponsable(b, { equipe, logements: d.logements, sansChoix: !l }).map((x) => ({ ...x, onModifier: () => p.modifier(x.ecran) }))}>
              {erreurEnvoi && (
                <Alert tone="danger" className="mt-4">
                  {erreurEnvoi}
                </Alert>
              )}
            </RecapAssistant>
          )}
        </>
      )}
    </Assistant>
  );
}
