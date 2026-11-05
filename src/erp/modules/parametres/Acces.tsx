/**
 * Paramètres → Accès (/erp/parametres/acces) : qui voit quoi hors du channel
 * manager. Le gérant invite une personne (propriétaire, responsable de pôle,
 * agent de terrain), coche ses logements et suit son accès ; l'invitation
 * part au nom de l'espace de l'ERP ouvert (Label Maison, Sens…).
 *
 * - Propriétaires : le propriétaire d'un logement est Logement.proprietaireId
 *   (un seul). Cocher un logement d'un autre propriétaire le lui donne ; on
 *   ne décoche pas (« attribuez-le à un autre propriétaire »).
 * - Responsables opérationnels : MembreEquipe.logementIds (plusieurs
 *   logements, et plusieurs personnes par logement), et les « ce logement
 *   n'est pas à moi » à traiter.
 *
 * Accès écrits par le serveur (api/espace-proprietaire.ts,
 * api/espace-operations.ts) ; fiches et logements par le store, comme le
 * reste de l'ERP. Les mêmes liens se gèrent depuis la fiche logement.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Copy, Eye, Mail, Phone, UserPlus, X } from 'lucide-react';
import {
  ECRANS_ABSENCE_GERANT,
  SANS_CHAMP_ABSENCE,
  absenceGerantDepuisBrouillon,
  brouillonAbsenceGerant,
  erreursAbsence,
  recapAbsence,
  type BrouillonAbsence,
  type EcranAbsence,
} from '../../data/creation-absence';
import {
  ECRANS_INVITATION_PROPRIETAIRE,
  SANS_CHAMP_INVITATION_PROPRIETAIRE,
  brouillonInvitationProprietaire,
  erreursInvitationProprietaire,
  invitationProprietaireDepuisBrouillon,
  proprietaireAvecEmail,
  recapInvitationProprietaire,
  transfertsInvitation,
  type BrouillonInvitationProprietaire,
  type EcranInvitationProprietaire,
} from '../../data/creation-invitation-proprietaire';
import { EMAIL_RESPONSABLE } from '../../data/creation-responsable';
import { ficheResponsableInvite, logementsSansPersonne, phrasesTransferts, statutAccesExterne, transfertsProprietaire, type Transfert } from '../../data/acces-gerant';
import { MODE_DEMO } from '../../data/config';
import { espaceOuvert } from '../../data/espaces';
import { AUJOURDHUI, dateCourte, horodatageMaintenant, jourMois } from '../../data/format';
import { affectationsEffectives, remplacantsPossibles, vueOperations } from '../../data/espace-operations';
import { brouillonModifie } from '../../data/parcours-assistant';
import { changerProprietaire } from '../../data/proprietaire';
import {
  ROLES_OPERATIONS,
  ROLES_SUR_LOGEMENT,
  absencesValables,
  affectationsAFiger,
  affectationsSans,
  affecter,
  apercuAbsence,
  roleSurLogement,
  verifierAbsence,
  type RoleSurLogement,
} from '../../data/operations';
import { inviter as inviterProprietaire } from '../../data/proprietaire-acces';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from '../../data/repull';
import { nouvelId, useErp, type ErpContexte } from '../../data/store';
import type { Id, Logement, Proprietaire } from '../../data/types';
import type { AbsenceMembre, AccesOperations, AffectationLogement, MembreEquipe, RoleOperations, SignalementLogement } from '../../data/types-operations';
import {
  Alert,
  Assistant,
  Badge,
  Button,
  CHAMP_ASSISTANT,
  Card,
  ChoixListe,
  Drawer,
  Field,
  Input,
  Interrupteur,
  Modal,
  NBSP,
  RecapAssistant,
  Repli,
  Select,
  classesBouton,
  cn,
  useFenetre,
  useParcours,
} from '../../ui';
import { EspaceOps } from '../../espace-operations/EspaceOps';
import type { ActionsOps, Ecran } from '../../espace-operations/commun';
import { CE_QUE_VOIT_LE_PROPRIETAIRE, PanneauEspace, inviterAvecReessai, statutAcces } from '../logements/_composants/EspaceProprietaireGerant';
import { AssistantResponsable } from '../logements/_composants/AssistantResponsable';
import { RelancesPaiement } from '../logements/_composants/RelancesPaiement';
import { ErreurServeur, appelerServeur } from '../messagerie/_composants/serveur';
import { SupprimerMembre } from './SupprimerMembre';

const API_PROPRIETAIRE = '/api/espace-proprietaire';
const API_OPERATIONS = '/api/espace-operations';
const EMAIL = EMAIL_RESPONSABLE;

export type Invitation = { lien: string; envoye: boolean; email: string };

/** État de l'accès d'un membre de l'équipe (mêmes mots et tons que pour les propriétaires, adresse de sa fiche comprise). */
export function statutAccesOps(a: AccesOperations | undefined, m: Pick<MembreEquipe, 'email'>): { texte: string; ton: 'neutre' | 'succes' | 'alerte' } {
  return statutAccesExterne(a, m.email);
}

export const logementsGeres = (logements: Logement[]) => logements.filter((l) => l.statut !== 'sorti').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

export default function Acces() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const logementFiltre = params.get('logement') ?? undefined;
  const personne = params.get('personne') ?? undefined;
  const [inviterProprietaire, setInviterProprietaire] = useState(false);
  const [inviterResponsable, setInviterResponsable] = useState(false);
  const nomFiltre = logementFiltre ? d.logements.find((l) => l.id === logementFiltre)?.nom : undefined;

  // Accès, invitations et absences : le gérant seul (les autres comptes ne lisent pas les accès).
  if (d.utilisateur.role !== 'gerant') return <p className="text-[13.5px] text-(--lm-encre-2)">Réservé au gérant.</p>;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      {nomFiltre && (
        <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-(--lm-encre-2)">
          <span>
            Personnes liées à <span className="font-medium text-(--lm-encre)">{nomFiltre}</span>
          </span>
          <button
            type="button"
            onClick={() => setParams({})}
            className="inline-flex min-h-8 items-center rounded-md px-1 font-medium lm-lien"
          >
            Tout voir
          </button>
        </div>
      )}
      <Proprietaires logementFiltre={logementFiltre} gerant={gerant} onInviter={() => setInviterProprietaire(true)} />
      <Responsables logementFiltre={logementFiltre} personne={personne} gerant={gerant} onInviter={() => setInviterResponsable(true)} />
      <Repli titre="En savoir plus" description="Ce que voit chacun dans son espace.">
        <div className="space-y-2 text-[13.5px] text-(--lm-encre-2)">
          <p>
            <span className="font-medium text-(--lm-encre)">Propriétaire.</span> {CE_QUE_VOIT_LE_PROPRIETAIRE}
          </p>
          <p>
            <span className="font-medium text-(--lm-encre)">{ROLES_OPERATIONS.pole}.</span> Ses logements, les séjours, les urgences et incidents, les contrôles
            qualité, son équipe, les absences et remplacements.
          </p>
          <p>
            <span className="font-medium text-(--lm-encre)">{ROLES_OPERATIONS.agent}.</span> Ses logements, les incidents qui le concernent et les contrôles à
            faire.
          </p>
          <p>Les voyageurs apparaissent en « Prénom N. », et les consignes d’accès seulement le jour où il y a quelque chose à faire sur place.</p>
          <p>Chaque invitation part au nom de cet espace ; la personne ne voit que ses données.</p>
        </div>
      </Repli>
      {inviterProprietaire && <AssistantInvitationProprietaire onFermer={() => setInviterProprietaire(false)} />}
      {inviterResponsable && <AssistantResponsable onFermer={() => setInviterResponsable(false)} logementsInitiaux={logementFiltre ? [logementFiltre] : []} />}
    </div>
  );
}

/* ------------------------------------------------------------- communs */

function EnTete({ titre, description, action }: { titre: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold text-(--lm-encre)">{titre}</h2>
        <p className="mt-0.5 max-w-2xl text-[13.5px] text-(--lm-encre-2)">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Logements en pastilles (les trois premiers, puis « +N »). */
function Pastilles({ noms, vide }: { noms: string[]; vide: string }) {
  if (!noms.length) return <p className="text-[12.5px] text-(--lm-encre-3)">{vide}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Logements">
      {noms.slice(0, 3).map((n) => (
        <li key={n}>
          <Badge>{n}</Badge>
        </li>
      ))}
      {noms.length > 3 && (
        <li>
          <Badge>+{noms.length - 3}</Badge>
        </li>
      )}
    </ul>
  );
}

/** Lien d'invitation à copier (e-mail non parti, ou à envoyer aussi par SMS). */
export function LienInvitation({ invitation }: { invitation: Invitation }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(invitation.lien);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* copie refusée : le lien reste sélectionnable */
    }
  };
  return (
    <div className="rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-3">
      <p className="text-[13px] text-(--lm-encre)">
        {invitation.envoye
          ? `Invitation envoyée à ${invitation.email}. Vous pouvez aussi envoyer ce lien par SMS ou WhatsApp.`
          : MODE_DEMO
            ? 'Démonstration : aucun e-mail n’est envoyé. Ce lien ouvre l’espace de démonstration.'
            : 'L’e-mail n’a pas pu partir : copiez ce lien et envoyez-le par SMS ou WhatsApp.'}
      </p>
      <div className="mt-2 flex gap-2">
        <Input readOnly value={invitation.lien} onFocus={(e) => e.currentTarget.select()} aria-label="Lien d’invitation" className="text-[12.5px]" />
        <Button variant="secondary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
          {copie ? 'Copié' : 'Copier'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Logements à cocher. `regle` : pour un logement, s'il est verrouillé (coché
 * sans pouvoir le décocher) et la précision à montrer. `pleineHauteur` : dans
 * un assistant, la liste ne défile pas à part (l'écran défile déjà).
 */
export function ListeLogements({
  logements,
  coches,
  onChange,
  regle,
  pleineHauteur,
}: {
  logements: Logement[];
  coches: Id[];
  onChange: (ids: Id[]) => void;
  regle?: (l: Logement) => { verrou?: boolean; detail?: string };
  pleineHauteur?: boolean;
}) {
  return (
    <ul className={cn('divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)', !pleineHauteur && 'max-h-[50vh] overflow-y-auto')}>
      {logements.map((l) => {
        const r = regle?.(l) ?? {};
        const coche = coches.includes(l.id) || !!r.verrou;
        return (
          <li key={l.id}>
            <label className={cn('flex min-h-11 items-center gap-3 px-3 py-2', r.verrou ? 'cursor-default' : 'cursor-pointer hover:bg-(--lm-surface-2)')}>
              <input
                type="checkbox"
                className="size-[18px] shrink-0 accent-(--lm-or-texte)"
                checked={coche}
                disabled={r.verrou}
                onChange={(e) => onChange(e.target.checked ? [...coches, l.id] : coches.filter((x) => x !== l.id))}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">{l.nom}</span>
                {r.detail && <span className="block truncate text-[12px] text-(--lm-encre-2)">{r.detail}</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------- propriétaires */

function Proprietaires({ logementFiltre, gerant, onInviter }: { logementFiltre?: Id; gerant: boolean; onInviter: () => void }) {
  const d = useErp();
  const [choix, setChoix] = useState<Proprietaire | null>(null);
  const [panneau, setPanneau] = useState<Proprietaire | null>(null);
  const proprietaires = d.proprietaires
    .filter((p) => p.id !== ID_PROPRIETAIRE_A_RENSEIGNER)
    .filter((p) => !logementFiltre || d.logements.some((l) => l.id === logementFiltre && l.proprietaireId === p.id))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return (
    <section aria-labelledby="acces-proprietaires">
      <EnTete
        titre="Propriétaires"
        description="Chaque propriétaire ne voit que ses logements."
        action={
          gerant && (
            <Button variant="primary" icone={<UserPlus />} onClick={onInviter}>
              Inviter un propriétaire
            </Button>
          )
        }
      />
      {proprietaires.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {proprietaires.map((p) => {
            const acces = d.donnees.accesProprietaires.find((a) => a.id === p.id);
            const s = statutAcces(acces, p);
            const siens = logementsGeres(d.logements).filter((l) => l.proprietaireId === p.id);
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-(--lm-encre)">{p.nom}</p>
                      <p className="truncate text-[12.5px] text-(--lm-encre-2)">{p.contact.email || 'Pas d’adresse e-mail'}</p>
                    </div>
                    <Badge tone={s.ton} point className="shrink-0">
                      {s.texte}
                    </Badge>
                  </div>
                  <Pastilles noms={siens.map((l) => l.nom)} vide="Aucun logement" />
                  {gerant && (
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-(--lm-bord) pt-3">
                      <Button size="sm" onClick={() => setChoix(p)}>
                        Choisir ses logements
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPanneau(p)}>
                        Gérer
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-(--lm-encre-2)">{logementFiltre ? 'Ce logement n’a pas encore de propriétaire renseigné.' : 'Aucun propriétaire pour l’instant.'}</p>
      )}
      {gerant && !logementFiltre && (
        <div className="mt-6 border-t border-(--lm-bord) pt-5">
          <RelancesPaiement />
        </div>
      )}
      {choix && <LogementsProprietaire proprietaire={choix} onFermer={() => setChoix(null)} />}
      {panneau && <PanneauEspace proprietaire={panneau} onFermer={() => setPanneau(null)} />}
    </section>
  );
}

/** Logements d'un propriétaire : cocher en donne un autre ; ses logements restent cochés (un logement a toujours un propriétaire). */
function LogementsProprietaire({ proprietaire: p, onFermer }: { proprietaire: Proprietaire; onFermer: () => void }) {
  const d = useErp();
  const [coches, setCoches] = useState<Id[]>([]);
  const [aConfirmer, setAConfirmer] = useState<Transfert[]>();
  const logements = logementsGeres(d.logements);
  const nomProprietaire = (id: Id) => (id === ID_PROPRIETAIRE_A_RENSEIGNER ? 'à renseigner' : (d.proprietaires.find((x) => x.id === id)?.nom ?? 'inconnu'));
  const attribuer = () => {
    for (const id of coches) d.mettreAJour('logements', id, (l) => changerProprietaire(l, p.id, AUJOURDHUI));
    onFermer();
  };
  // Un logement d'un autre propriétaire : on le dit avant (il ne le verra plus).
  const enregistrer = () => {
    const transferts = transfertsProprietaire(d.logements, d.proprietaires, coches, p.id, ID_PROPRIETAIRE_A_RENSEIGNER);
    if (transferts.length && !aConfirmer) return setAConfirmer(transferts);
    attribuer();
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={`Logements de ${p.nom}`}
      description="Pour retirer un logement, attribuez-le à un autre propriétaire."
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" onClick={enregistrer} disabled={!coches.length}>
            {aConfirmer ? 'Confirmer' : coches.length > 1 ? `Attribuer ${coches.length} logements` : 'Attribuer'}
          </Button>
        </>
      }
    >
      {aConfirmer && <ConfirmationTransferts transferts={aConfirmer} />}
      <ListeLogements
        logements={logements}
        coches={coches}
        onChange={(ids) => {
          setCoches(ids);
          setAConfirmer(undefined);
        }}
        regle={(l) => (l.proprietaireId === p.id ? { verrou: true, detail: 'À ce propriétaire' } : { detail: `Actuellement : ${nomProprietaire(l.proprietaireId)}` })}
      />
    </Modal>
  );
}

/** Ce que perd l'ancien propriétaire, dit avant d'attribuer. */
function ConfirmationTransferts({ transferts, className = 'mb-3', consigne = 'Confirmez pour attribuer.' }: { transferts: Transfert[]; className?: string; consigne?: string }) {
  return (
    <Alert tone="alerte" className={className}>
      {phrasesTransferts(transferts).map((t) => (
        <span key={t} className="block">
          {t}
        </span>
      ))}
      <span className="block">Les chiffres d’avant restent à {[...new Set(transferts.map((t) => t.ancien))].join(', ')}.</span>
      <span className="block">{consigne}</span>
    </Alert>
  );
}

const idInvitation = (cle: string) => `assistant-invitation-proprietaire-${cle}`;

const QUESTIONS_INVITATION: Record<EcranInvitationProprietaire, { question: string; aide?: string }> = {
  email: { question: `Quelle est son adresse e-mail${NBSP}?`, aide: `Il reçoit un lien personnel, valable 7${NBSP}jours, pour créer son compte et ouvrir son espace.` },
  identite: { question: `Qui est-ce${NBSP}?` },
  logements: { question: `Quels logements verra-t-il${NBSP}?`, aide: 'Il ne voit que ses logements.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

/**
 * Inviter un propriétaire, pas à pas (kit ui/Assistant.tsx) : son adresse
 * e-mail (une fiche avec la même adresse est reprise), qui il est, ses
 * logements, puis le récapitulatif. Règles : data/creation-invitation-proprietaire.ts.
 * Rien n'est écrit avant « Envoyer l'invitation » ; la fiche, les logements
 * et l'invitation s'écrivent ensuite comme avant (envoyer).
 */
function AssistantInvitationProprietaire({ onFermer }: { onFermer: () => void }) {
  const d = useErp();
  const [b, setB] = useState<BrouillonInvitationProprietaire>(brouillonInvitationProprietaire);
  const depart = useRef(b);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [invitation, setInvitation] = useState<Invitation>();
  const titreId = useId();
  const ctx = { proprietaires: d.proprietaires, logements: d.logements, aRenseigner: ID_PROPRIETAIRE_A_RENSEIGNER };
  const etapes = useParcours<EcranInvitationProprietaire>({ ecrans: ECRANS_INVITATION_PROPRIETAIRE, idChamp: idInvitation, sansChamp: SANS_CHAMP_INVITATION_PROPRIETAIRE });
  const ecran = etapes.ecran;
  const erreurs = erreursInvitationProprietaire(ecran, b, ctx);
  const etat = etapes.etat(erreurs);
  const maj = (patch: Partial<BrouillonInvitationProprietaire>) => setB((x) => ({ ...x, ...patch }));
  const nomProprietaire = (id: Id) => (id === ID_PROPRIETAIRE_A_RENSEIGNER ? 'à renseigner' : (d.proprietaires.find((x) => x.id === id)?.nom ?? 'inconnu'));
  const existant = proprietaireAvecEmail(d.proprietaires, b.email);
  // Un logement d'un autre propriétaire : on le dit avant (il ne le verra plus).
  const transferts = transfertsInvitation(b, ctx);
  const logements = logementsGeres(d.logements);

  const envoyer = async () => {
    if (enCours) return;
    const r = invitationProprietaireDepuisBrouillon(b, { proprietaires: d.proprietaires, nouvelId: () => nouvelId('pro'), aujourdhui: horodatageMaintenant().slice(0, 10) });
    if (!r.ok) return etapes.corriger(r.ecran, Object.keys(erreursInvitationProprietaire('recapitulatif', b, ctx)));
    setErreur(undefined);
    setEnCours(true);
    // Fiche existante reprise telle quelle, sans l'ancien IBAN (data/creation-invitation-proprietaire.ts).
    const { proprietaire: p, logementIds: coches, email: adresse } = r.plan;
    d.upsert('proprietaires', p);
    for (const id of coches) d.mettreAJour('logements', id, (l) => changerProprietaire(l, p.id, AUJOURDHUI));
    try {
      if (MODE_DEMO) {
        // Mêmes règles que le serveur (inviter) : l'accès attend le compte ; autre adresse, sessions fermées et compte oublié.
        const acces = d.donnees.accesProprietaires.find((a) => a.id === p.id);
        d.upsert('accesProprietaires', { ...inviterProprietaire(acces, { proprietaireId: p.id, email: adresse, par: d.utilisateur.email, maintenantMs: Date.now() }), emailFiche: adresse });
        setInvitation({ lien: `${window.location.origin}/espace-proprietaire?apercu=${encodeURIComponent(p.id)}`, envoye: false, email: adresse });
      } else {
        const r = await inviterAvecReessai(API_PROPRIETAIRE, { action: 'inviter', proprietaireId: p.id, email: adresse });
        setInvitation({ ...r, email: adresse });
      }
    } catch (e) {
      setErreur(`Fiche et logements enregistrés, mais l’invitation n’est pas partie : ${(e as Error).message}`);
    } finally {
      setEnCours(false);
    }
  };
  const continuer = () => etapes.continuer(erreurs, () => void envoyer());

  // Invitation partie (ou lien de démonstration) : le lien à copier.
  if (invitation) {
    return (
      <Modal
        ouvert
        onFermer={onFermer}
        titre="Inviter un propriétaire"
        description={`Il reçoit un lien personnel, valable 7${NBSP}jours, pour créer son compte et ouvrir son espace.`}
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

  const q = QUESTIONS_INVITATION[ecran];

  return (
    <Assistant
      titre="Inviter un propriétaire"
      ecrans={ECRANS_INVITATION_PROPRIETAIRE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={etapes.libelleSuite('Envoyer l’invitation')}
      onContinuer={continuer}
      onRetour={etapes.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner l’invitation${NBSP}?`}
      envoi={enCours}
      onFermer={onFermer}
    >
      {ecran === 'email' && (
        <Field label="Adresse e-mail" aide={existant ? `Une fiche existe déjà avec cette adresse${NBSP}: elle est reprise.` : undefined} erreur={etat.erreurChamp('email')}>
          <Input
            id={idInvitation('email')}
            type="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            value={b.email}
            onChange={(e) => maj({ email: e.target.value })}
            onBlur={() => etapes.quitter('email')}
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'identite' && (
        <div className="space-y-4">
          <Field label="Nom" aide={existant ? 'Celui de la fiche reprise.' : undefined} erreur={etat.erreurChamp('nom')}>
            <Input
              id={idInvitation('nom')}
              value={existant ? existant.nom : b.nom}
              disabled={!!existant}
              onChange={(e) => maj({ nom: e.target.value })}
              onBlur={() => etapes.quitter('nom')}
              autoComplete="off"
              placeholder="Ex. SCI Les Tilleuls"
              className={CHAMP_ASSISTANT}
            />
          </Field>
          <Field label="Téléphone" aide="Facultatif.">
            <Input
              id={idInvitation('telephone')}
              type="tel"
              value={existant?.contact.telephone || b.telephone}
              disabled={!!existant?.contact.telephone}
              onChange={(e) => maj({ telephone: e.target.value })}
              autoComplete="off"
              className={CHAMP_ASSISTANT}
            />
          </Field>
        </div>
      )}
      {ecran === 'logements' &&
        (logements.length ? (
          <ListeLogements
            logements={logements}
            coches={b.logementIds}
            onChange={(logementIds) => maj({ logementIds })}
            pleineHauteur
            regle={(l) => (existant && l.proprietaireId === existant.id ? { verrou: true, detail: 'À ce propriétaire' } : { detail: `Actuellement${NBSP}: ${nomProprietaire(l.proprietaireId)}` })}
          />
        ) : (
          <p className="text-[14px] text-(--lm-encre-2)">Aucun logement pour l’instant. Vous pourrez lui en attribuer plus tard.</p>
        ))}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapInvitationProprietaire(b, ctx).map((x) => ({ ...x, onModifier: () => etapes.modifier(x.ecran) }))}>
          {transferts.length > 0 && <ConfirmationTransferts transferts={transferts} className="mt-4" consigne="Envoyer l’invitation confirme ce changement." />}
          {erreur && (
            <Alert tone="danger" className="mt-4">
              {erreur}
            </Alert>
          )}
        </RecapAssistant>
      )}
    </Assistant>
  );
}

/* ------------------------------------------------ responsables opérationnels */

function Responsables({ logementFiltre, personne, gerant, onInviter }: { logementFiltre?: Id; personne?: Id; gerant: boolean; onInviter: () => void }) {
  const d = useErp();
  const [, setParams] = useSearchParams();
  const [ouvert, setOuvert] = useState<Id | undefined>(personne);
  useEffect(() => setOuvert(personne), [personne]);
  const nomLogement = (id: Id) => d.logements.find((l) => l.id === id)?.nom ?? 'Logement';
  const membres = [...d.donnees.equipe]
    .filter((m) => !logementFiltre || (m.actif && m.logementIds.includes(logementFiltre)))
    .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, 'fr'));
  const signalements = d.donnees.signalementsLogement.filter((s) => s.statut === 'ouvert' && (!logementFiltre || s.logementId === logementFiltre));
  const fermer = () => {
    setOuvert(undefined);
    if (personne) setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('personne');
      return n;
    });
  };

  return (
    <section aria-labelledby="acces-responsables">
      <EnTete
        titre="Responsables opérationnels"
        description="Chacun ne voit que les logements cochés ici."
        action={
          gerant && (
            <Button icone={<UserPlus />} onClick={onInviter}>
              Inviter un responsable
            </Button>
          )
        }
      />
      {signalements.length > 0 && <Signalements liste={signalements} gerant={gerant} />}
      {membres.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {membres.map((m) => {
            const s = statutAccesOps(d.donnees.accesOperations.find((a) => a.id === m.id), m);
            return (
              <li key={m.id}>
                <Card className={cn('flex h-full flex-col gap-2', !m.actif && 'bg-(--lm-surface-2) shadow-none')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-(--lm-encre)">{m.nom}</p>
                      <p className="truncate text-[12.5px] text-(--lm-encre-2)">{[ROLES_OPERATIONS[m.role], m.email].filter(Boolean).join(' · ')}</p>
                    </div>
                    <Badge tone={m.actif ? s.ton : 'neutre'} point className="shrink-0">
                      {m.actif ? s.texte : 'Hors de l’équipe'}
                    </Badge>
                  </div>
                  <Pastilles noms={m.logementIds.map(nomLogement)} vide="Aucun logement" />
                  {gerant && (
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-(--lm-bord) pt-3">
                      <Button size="sm" onClick={() => setOuvert(m.id)}>
                        Gérer
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13.5px] text-(--lm-encre-2)">{logementFiltre ? 'Aucun responsable rattaché à ce logement.' : 'Aucun responsable pour l’instant.'}</p>
      )}
      {ouvert && d.donnees.equipe.some((m) => m.id === ouvert) && <PanneauResponsable id={ouvert} gerant={gerant} onFermer={fermer} />}
    </section>
  );
}

/**
 * La réponse part sur le téléphone de la personne (app « Opérations »). La
 * base reçoit l'écriture juste après : le serveur répond « pas_encore » tant
 * qu'il ne la voit pas, on réessaie un peu ; le passage du matin rattrape le
 * reste. Rien à montrer : sans notifications activées, rien ne part.
 */
async function prevenirDeLaReponse(id: Id): Promise<void> {
  for (const attente of [1500, 3000, 6000]) {
    await new Promise((r) => window.setTimeout(r, attente));
    try {
      await appelerServeur(API_OPERATIONS, 'POST', { action: 'signalement-traite', id });
      return;
    } catch (e) {
      if (!(e instanceof ErreurServeur) || e.code !== 'pas_encore') return;
    }
  }
}

/** « Ce logement n'est pas à moi » : retirer le logement à la personne, ou confirmer qu'il est bien à elle. */
/** `imbrique` : posé dans une carte (coins plus petits que ceux de la carte). */
export function Signalements({ liste, gerant, imbrique }: { liste: SignalementLogement[]; gerant: boolean; imbrique?: boolean }) {
  const d = useErp();
  const [aConfirmer, setAConfirmer] = useState<Id>();
  const traiter = (s: SignalementLogement, decision: 'retire' | 'confirme') => {
    if (decision === 'retire') {
      d.mettreAJour('equipe', s.membreId, (m) => ({ ...m, logementIds: m.logementIds.filter((x) => x !== s.logementId) }));
      for (const a of affectationsSans(d.donnees.affectations, s.membreId, [s.logementId])) d.upsert('affectations', a);
    }
    d.upsert('signalementsLogement', { ...s, statut: 'traite', decision, traiteLe: horodatageMaintenant(), traitePar: d.utilisateur.nom });
    if (!MODE_DEMO) void prevenirDeLaReponse(s.id);
    setAConfirmer(undefined);
  };
  // Dernière personne sur ce logement : on le dit avant de lui retirer.
  const retirer = (s: SignalementLogement) => {
    if (logementsSansPersonne(d.donnees.equipe, s.membreId, [s.logementId]).length && aConfirmer !== s.id) return setAConfirmer(s.id);
    traiter(s, 'retire');
  };
  return (
    <div className={cn('mb-4 border border-(--lm-alerte)/30 bg-(--lm-alerte-lavis) p-3', imbrique ? 'rounded-lg' : 'rounded-xl')}>
      <p className="mb-2 text-[13.5px] font-semibold text-(--lm-encre)">À traiter : « ce logement n’est pas à moi »</p>
      <ul className="divide-y divide-(--lm-alerte)/20">
        {liste.map((s) => {
          const m = d.donnees.equipe.find((x) => x.id === s.membreId);
          const l = d.logements.find((x) => x.id === s.logementId);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-(--lm-encre)">
                  <span className="font-medium">{m?.nom ?? 'Un membre'}</span> · {l?.nom ?? 'un logement'}
                </p>
                <p className="text-[12.5px] text-(--lm-encre-2)">{[`Le ${dateCourte(s.le.slice(0, 10))}`, s.motif].filter(Boolean).join(' · ')}</p>
              </div>
              {gerant && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => traiter(s, 'confirme')}>
                    Le garder
                  </Button>
                  <Button size="sm" onClick={() => retirer(s)}>
                    {aConfirmer === s.id ? 'Retirer quand même' : 'Lui retirer'}
                  </Button>
                </div>
              )}
              {aConfirmer === s.id && <p className="w-full text-[12.5px] font-medium text-(--lm-encre)">Plus personne ne suivra {l?.nom ?? 'ce logement'}.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Une personne de terrain : fiche, logements et ce dont elle s'occupe, absences, accès (inviter, renvoyer, retirer). */
function PanneauResponsable({ id, gerant, onFermer }: { id: Id; gerant: boolean; onFermer: () => void }) {
  const d = useErp();
  const m = d.donnees.equipe.find((x) => x.id === id)!;
  const acces = d.donnees.accesOperations.find((a) => a.id === id);
  const s = statutAccesOps(acces, m);
  const [fiche, setFiche] = useState<MembreEquipe>(m);
  // Rôles choisis ici, par logement (les autres restent tels qu'ils sont).
  const [roles, setRoles] = useState<Record<Id, RoleSurLogement>>({});
  const [enCours, setEnCours] = useState<'inviter' | 'retirer'>();
  const [erreur, setErreur] = useState<string>();
  const [invitation, setInvitation] = useState<Invitation>();
  const [confirmer, setConfirmer] = useState(false);
  const [apercu, setApercu] = useState(false);
  const change = JSON.stringify(fiche) !== JSON.stringify(m) || Object.keys(roles).length > 0;
  const tel = fiche.telephone?.replace(/[^\d+]/g, '');
  const geres = logementsGeres(d.logements);
  const nomLogement = (l: Id) => d.logements.find((x) => x.id === l)?.nom ?? 'Logement';

  // L'équipe telle qu'elle sera : sert au choix par défaut (seule personne qui suit un logement).
  const equipeApres = d.donnees.equipe.map((x) => (x.id === id ? { ...x, logementIds: fiche.logementIds, actif: fiche.actif } : x));
  const suivis = fiche.actif ? geres.filter((l) => fiche.logementIds.includes(l.id)) : [];
  const roleDe = (l: Id): RoleSurLogement => roles[l] ?? roleSurLogement({ affectations: d.donnees.affectations, equipe: equipeApres }, l, id);
  const quittes = m.logementIds.filter((l) => !fiche.actif || !fiche.logementIds.includes(l));
  const sansPersonne = logementsSansPersonne(d.donnees.equipe, id, quittes).filter((l) => geres.some((x) => x.id === l));

  const enregistrer = () => {
    if (fiche.nom.trim().length < 2) return setErreur('Indiquez le nom.');
    const propre: MembreEquipe = { ...fiche, nom: fiche.nom.trim(), email: fiche.email?.trim().toLowerCase() || undefined, telephone: fiche.telephone?.trim() || undefined };
    let affectations = d.donnees.affectations;
    const ecrire = (a: AffectationLogement) => {
      affectations = [...affectations.filter((x) => x.id !== a.id), a];
      d.upsert('affectations', a);
    };
    // Logements qu'elle rejoint : le responsable par défaut d'avant devient un choix enregistré (personne ne perd la charge sans le savoir).
    const rejoints = propre.actif ? propre.logementIds.filter((l) => !m.actif || !m.logementIds.includes(l)) : [];
    for (const a of affectationsAFiger(d.donnees, rejoints)) ecrire(a);
    d.upsert('equipe', propre);
    // Plus responsable ni remplaçante là où elle n'est plus ; puis les rôles choisis.
    for (const a of affectationsSans(affectations, id, quittes)) ecrire(a);
    for (const [l, role] of Object.entries(roles)) if (propre.actif && propre.logementIds.includes(l)) ecrire(affecter({ affectations, equipe: equipeApres }, l, id, role));
    setRoles({});
    setErreur(undefined);
  };
  const inviter = async () => {
    const adresse = (fiche.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(adresse)) return setErreur('Adresse e-mail invalide.');
    // L'adresse invitée est celle de la fiche : on l'enregistre d'abord.
    if (change) enregistrer();
    setErreur(undefined);
    setEnCours('inviter');
    try {
      if (MODE_DEMO) {
        const autre = !!acces && acces.email !== adresse;
        d.upsert('accesOperations', {
          id,
          membreId: id,
          email: adresse,
          emailFiche: adresse,
          statut: acces?.statut === 'actif' && !autre ? 'actif' : 'invite',
          inviteLe: horodatageMaintenant(),
          invitePar: d.utilisateur.email,
          version: (acces?.version ?? 1) + (autre && acces?.statut === 'actif' ? 1 : 0),
          liens: [],
          ...(acces?.derniereConnexion && !autre ? { derniereConnexion: acces.derniereConnexion } : {}),
        });
        setInvitation({ lien: `${window.location.origin}/espace-operations?apercu=${encodeURIComponent(id)}`, envoye: false, email: adresse });
      } else {
        const r = await inviterAvecReessai(API_OPERATIONS, { action: 'inviter', membreId: id, email: adresse });
        setInvitation({ ...r, email: adresse });
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
    }
  };
  /** Retire son accès ; rend le message d'erreur s'il y en a un (aussi montré sous la section Accès). */
  const retirer = async (): Promise<string | undefined> => {
    setConfirmer(false);
    setErreur(undefined);
    setEnCours('retirer');
    try {
      if (MODE_DEMO) {
        if (acces) d.upsert('accesOperations', { ...acces, statut: 'retire', retireLe: horodatageMaintenant(), version: acces.version + 1, liens: [] });
      } else await appelerServeur(API_OPERATIONS, 'POST', { action: 'retirer', membreId: id });
      return undefined;
    } catch (e) {
      setErreur((e as Error).message);
      return (e as Error).message;
    } finally {
      setEnCours(undefined);
    }
  };

  if (apercu) return <ApercuOps membre={m} onFermer={() => setApercu(false)} />;
  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={m.nom}
      sousTitre={ROLES_OPERATIONS[m.role]}
      largeur="lg"
      actions={gerant ? <SupprimerMembre membre={m} onRetirerAcces={retirer} onRetireDeLEquipe={() => setFiche((f) => ({ ...f, actif: false }))} /> : undefined}
      pied={
        gerant ? (
          <>
            <Button variant="ghost" icone={<Eye />} onClick={() => setApercu(true)}>
              Voir son espace
            </Button>
            <Button variant="primary" disabled={!change} onClick={enregistrer}>
              Enregistrer
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-7 text-[13px]">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom" requis>
            <Input value={fiche.nom} disabled={!gerant} onChange={(e) => setFiche({ ...fiche, nom: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Rôle">
            <Select
              value={fiche.role}
              disabled={!gerant}
              onChange={(e) => setFiche({ ...fiche, role: e.target.value as RoleOperations })}
              options={(Object.keys(ROLES_OPERATIONS) as RoleOperations[]).map((r) => ({ valeur: r, libelle: ROLES_OPERATIONS[r] }))}
            />
          </Field>
          <Field label="Adresse e-mail">
            <Input type="email" value={fiche.email ?? ''} disabled={!gerant} onChange={(e) => setFiche({ ...fiche, email: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Téléphone">
            <Input type="tel" value={fiche.telephone ?? ''} disabled={!gerant} onChange={(e) => setFiche({ ...fiche, telephone: e.target.value })} autoComplete="off" />
          </Field>
          {(tel || fiche.email) && (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {tel && (
                <a href={`tel:${tel}`} className={classesBouton('secondary')}>
                  <Phone className="size-4" aria-hidden />
                  Appeler
                </a>
              )}
              {fiche.email && (
                <a href={`mailto:${fiche.email}`} className={classesBouton('secondary')}>
                  <Mail className="size-4" aria-hidden />
                  Écrire
                </a>
              )}
            </div>
          )}
        </section>

        <section>
          <p className="mb-1 text-[15px] font-semibold text-(--lm-encre)">Ses logements</p>
          <p className="mb-2 text-(--lm-encre-2)">Il ne voit que ceux-là. Un logement peut avoir plusieurs personnes.</p>
          <ListeLogements logements={geres} coches={fiche.logementIds} onChange={(ids) => gerant && setFiche({ ...fiche, logementIds: ids })} />
          {gerant && sansPersonne.length > 0 && (
            <Alert tone="alerte" className="mt-3">
              Plus personne ne suivra {sansPersonne.map(nomLogement).join(', ')}.
            </Alert>
          )}
        </section>

        {suivis.length > 0 && (
          <section>
            <p className="mb-1 text-[15px] font-semibold text-(--lm-encre)">Ce dont il s’occupe</p>
            <p className="mb-2 text-(--lm-encre-2)">Au quotidien, il reçoit les incidents et les consignes d’accès du jour.</p>
            <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
              {suivis.map((l) => (
                <li key={l.id} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                  <span className="min-w-40 flex-1 truncate text-[13.5px] font-medium text-(--lm-encre)">{l.nom}</span>
                  <div className="w-48 shrink-0">
                    <Select
                      aria-label={`Rôle sur ${l.nom}`}
                      value={roleDe(l.id)}
                      disabled={!gerant}
                      onChange={(e) => setRoles({ ...roles, [l.id]: e.target.value as RoleSurLogement })}
                      options={(Object.keys(ROLES_SUR_LOGEMENT) as RoleSurLogement[]).map((r) => ({ valeur: r, libelle: ROLES_SUR_LOGEMENT[r] }))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {gerant && m.actif && <AbsencesGerant membre={m} />}

        <section className="border-t border-(--lm-bord) pt-5">
          <p className="mb-2 text-[15px] font-semibold text-(--lm-encre)">Accès à l’espace opérations</p>
          <div className="mb-3 flex items-center gap-2">
            <Badge tone={s.ton} point>
              {s.texte}
            </Badge>
            {acces && acces.statut !== 'retire' && <span className="truncate text-[12.5px] text-(--lm-encre-2)">{acces.email}</span>}
          </div>
          {gerant && (
            <div className="flex flex-wrap gap-2">
              <Button chargement={enCours === 'inviter'} disabled={!!enCours || !fiche.actif} onClick={() => void inviter()}>
                {acces && acces.statut !== 'retire' ? 'Renvoyer une invitation' : 'Inviter'}
              </Button>
              {acces && acces.statut !== 'retire' && !confirmer && (
                <Button variant="ghost" disabled={!!enCours} onClick={() => setConfirmer(true)}>
                  Retirer l’accès
                </Button>
              )}
            </div>
          )}
          {confirmer && (
            <Alert
              tone="danger"
              className="mt-3"
              actions={
                <>
                  <Button variant="danger" size="sm" chargement={enCours === 'retirer'} onClick={() => void retirer()}>
                    Retirer
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmer(false)}>
                    Annuler
                  </Button>
                </>
              }
            >
              Ses liens ne marchent plus. Son espace se ferme dès qu’elle recharge la page ou ouvre un document.
            </Alert>
          )}
          {invitation && (
            <div className="mt-3">
              <LienInvitation invitation={invitation} />
            </div>
          )}
          {erreur && (
            <p role="alert" className="mt-2 text-[12.5px] font-medium text-(--lm-danger)">
              {erreur}
            </p>
          )}
        </section>

        {gerant && (
          <section className="flex items-center justify-between gap-3 border-t border-(--lm-bord) pt-5">
            <span>
              <span className="block text-[13.5px] font-medium text-(--lm-encre)">Fait partie de l’équipe</span>
              <span className="block text-(--lm-encre-2)">Hors de l’équipe : plus d’accès à l’espace, l’historique reste.</span>
            </span>
            <Interrupteur actif={fiche.actif} label="Fait partie de l’équipe" onChange={(actif) => setFiche({ ...fiche, actif })} />
          </section>
        )}
      </div>
    </Drawer>
  );
}

/**
 * Absences d'une personne, notées par le gérant (seul à pouvoir changer
 * celles-ci ; un responsable de pôle note les siennes dans son espace) :
 * dates, remplaçant parmi ceux qui suivent les mêmes logements, et ce qui
 * change pendant l'absence, calculé comme dans l'espace opérations.
 */
function AbsencesGerant({ membre: m }: { membre: MembreEquipe }) {
  const d = useErp();
  const [edition, setEdition] = useState<AbsenceMembre | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const absences = absencesValables(d.donnees.absences)
    .filter((a) => a.membreId === m.id && a.au >= AUJOURDHUI)
    .sort((a, b) => a.du.localeCompare(b.du));
  const nom = (id?: Id) => (id ? (d.donnees.equipe.find((x) => x.id === id)?.nom ?? 'Personne') : 'Personne');
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-(--lm-encre)">Absences</p>
        <Button size="sm" className="max-sm:min-h-11" onClick={() => setNouvelle(true)}>
          Noter une absence
        </Button>
      </div>
      {absences.length ? (
        <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
          {absences.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-40 flex-1">
                <span className="block text-[13.5px] font-medium text-(--lm-encre)">{a.du === a.au ? `Le ${jourMois(a.du)}` : `Du ${jourMois(a.du)} au ${jourMois(a.au)}`}</span>
                <span className="block text-[12.5px] text-(--lm-encre-2)">
                  {[a.remplacantId ? `Remplaçant : ${nom(a.remplacantId)}` : 'Sans remplaçant choisi', a.parMembreId ? `notée par ${nom(a.parMembreId)}` : undefined, a.motif].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEdition(a)}>
                Modifier
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-(--lm-encre-2)">Aucune absence prévue.</p>
      )}
      {edition && <FormulaireAbsence membre={m} absence={edition} onFermer={() => setEdition(null)} />}
      {nouvelle && <AssistantAbsence membre={m} onFermer={() => setNouvelle(false)} />}
    </section>
  );
}

/** Remplaçants possibles : même règle que dans l'espace opérations (ceux qui suivent déjà tout ce qui leur reviendrait). */
function relaisPossibles(d: ReturnType<typeof useErp>, membreId: Id, dejaChoisi?: Id) {
  const possibles = new Set(remplacantsPossibles({ ...d.donnees, affectations: affectationsEffectives(d.donnees) }, membreId));
  return d.donnees.equipe
    .filter((x) => x.actif && x.id !== membreId && (possibles.has(x.id) || x.id === dejaChoisi))
    .sort((x, y) => x.nom.localeCompare(y.nom, 'fr'))
    .map((x) => ({ valeur: x.id, libelle: x.nom }));
}

/** Date courte, avec l'année seulement quand ce n'est pas l'année en cours. */
const jourAbsence = (iso: string) => (iso.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois(iso) : dateCourte(iso));

const QUESTIONS_ABSENCE: Record<EcranAbsence, { question: string; aide?: string }> = {
  personne: { question: `Qui sera absent${NBSP}?` },
  dates: { question: `Quelles sont les dates de l’absence${NBSP}?`, aide: 'Pendant l’absence, ses logements et ses incidents passent au remplaçant.' },
  remplacant: { question: `Qui reprend ses logements${NBSP}?`, aide: 'Seulement là où le logement n’a pas déjà quelqu’un.' },
  motif: { question: `Pour quel motif${NBSP}?`, aide: 'Facultatif, jamais montré à l’équipe de terrain.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};
const SANS_REMPLACANT = '__personne__';
const idAbsence = (cle: string) => `assistant-absence-${cle}`;

/**
 * Nouvelle absence, pas à pas (kit ui/Assistant.tsx) : les dates, le
 * remplaçant, le motif, puis le récapitulatif avec ce qui change. Rien n'est
 * écrit avant « Créer l'absence » ; règles et absence : data/creation-absence.ts
 * (la même que l'ancienne fenêtre « Noter une absence »).
 */
function AssistantAbsence({ membre: m, onFermer }: { membre: MembreEquipe; onFermer: () => void }) {
  const d = useErp();
  const [b, setB] = useState<BrouillonAbsence>(() => brouillonAbsenceGerant(m.id, AUJOURDHUI));
  const depart = useRef(b);
  const titreId = useId();
  const etapes = useParcours<EcranAbsence>({ ecrans: ECRANS_ABSENCE_GERANT, idChamp: idAbsence, sansChamp: SANS_CHAMP_ABSENCE });
  const ecran = etapes.ecran;
  const erreurs = erreursAbsence(ecran, b, d.donnees.absences);
  const etat = etapes.etat(erreurs);
  const maj = (patch: Partial<BrouillonAbsence>) => setB((x) => ({ ...x, ...patch }));
  const relais = relaisPossibles(d, m.id);
  const nom = (id: Id) => d.donnees.equipe.find((x) => x.id === id)?.nom ?? 'Personne';

  const creer = () => {
    const r = absenceGerantDepuisBrouillon(b, { absences: d.donnees.absences, id: nouvelId('abs'), maintenant: horodatageMaintenant(), par: d.utilisateur.nom });
    if (!r.ok) return etapes.corriger(r.ecran, Object.keys(erreursAbsence('recapitulatif', b, d.donnees.absences)));
    d.upsert('absences', r.valeur);
    onFermer();
  };
  const continuer = () => etapes.continuer(erreurs, creer);
  const q = QUESTIONS_ABSENCE[ecran];

  return (
    <Assistant
      titre="Nouvelle absence"
      ecrans={ECRANS_ABSENCE_GERANT}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={etapes.libelleSuite('Créer l’absence')}
      onContinuer={continuer}
      onRetour={etapes.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette absence${NBSP}?`}
      onFermer={onFermer}
    >
      {ecran === 'dates' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Du">
            <Input id={idAbsence('dates')} type="date" value={b.du} onChange={(e) => maj({ du: e.target.value })} className={CHAMP_ASSISTANT} />
          </Field>
          <Field label="Au (inclus)">
            <Input type="date" value={b.au} min={b.du} onChange={(e) => maj({ au: e.target.value })} className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'remplacant' && (
        <>
          {!relais.length && <p className="mb-3 text-[14px] text-(--lm-encre-2)">Personne ne suit tous ses logements{NBSP}: ajoutez-les d’abord à quelqu’un.</p>}
          <ChoixListe
            options={[{ valeur: SANS_REMPLACANT, libelle: 'Pas de remplaçant choisi' }, ...relais]}
            valeur={b.remplacantId || SANS_REMPLACANT}
            onChange={(v) => maj({ remplacantId: v === SANS_REMPLACANT ? '' : v })}
            onContinuer={continuer}
            labelledBy={titreId}
            idPremier={idAbsence('remplacantId')}
          />
        </>
      )}
      {ecran === 'motif' && (
        <Field label="Motif">
          <Input id={idAbsence('motif')} value={b.motif} onChange={(e) => maj({ motif: e.target.value })} maxLength={200} autoComplete="off" className={CHAMP_ASSISTANT} />
        </Field>
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapAbsence(b, { ecrans: ECRANS_ABSENCE_GERANT, nom, jour: jourAbsence }).map((l) => ({ ...l, onModifier: () => etapes.modifier(l.ecran) }))}>
          <CeQuiChange absence={{ id: '', membreId: m.id, du: b.du, au: b.au, ...(b.remplacantId ? { remplacantId: b.remplacantId } : {}) }} avecRemplacants={relais.length > 0} className="mt-4" />
        </RecapAssistant>
      )}
    </Assistant>
  );
}

function FormulaireAbsence({ membre: m, absence, onFermer }: { membre: MembreEquipe; absence: AbsenceMembre; onFermer: () => void }) {
  const d = useErp();
  const [a, setA] = useState<AbsenceMembre>(absence);
  const [erreur, setErreur] = useState<string>();
  const existante = !!absence.id;
  const relais = relaisPossibles(d, m.id, absence.remplacantId);

  const enregistrer = () => {
    const propre: AbsenceMembre = {
      ...a,
      id: a.id || nouvelId('abs'),
      ...(a.motif?.trim() ? { motif: a.motif.trim() } : { motif: undefined }),
      creeLe: a.creeLe ?? horodatageMaintenant(),
      par: a.par ?? d.utilisateur.nom,
      // Enregistrée par le gérant : elle devient la sienne, un pôle ne peut plus la défaire.
      parMembreId: undefined,
    };
    const probleme = verifierAbsence(propre, d.donnees.absences);
    if (probleme) return setErreur(probleme);
    d.upsert('absences', propre);
    onFermer();
  };
  const annuler = () => {
    d.upsert('absences', { ...a, annuleeLe: horodatageMaintenant() });
    onFermer();
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={existante ? `Absence de ${m.nom}` : 'Noter une absence'}
      description="Pendant l’absence, ses logements et ses incidents passent au remplaçant."
      pied={
        <>
          {existante && (
            <Button variant="ghost" onClick={annuler}>
              Annuler l’absence
            </Button>
          )}
          <Button variant="primary" onClick={enregistrer}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
        {erreur && (
          <Alert tone="danger" className="sm:col-span-2">
            {erreur}
          </Alert>
        )}
        <Field label="Du" requis>
          <Input type="date" value={a.du} onChange={(e) => setA({ ...a, du: e.target.value })} />
        </Field>
        <Field label="Au (inclus)" requis>
          <Input type="date" value={a.au} min={a.du} onChange={(e) => setA({ ...a, au: e.target.value })} />
        </Field>
        <Field
          label="Remplaçant si le logement n’en a pas"
          aide={relais.length ? 'Seulement quelqu’un qui suit déjà ses logements.' : 'Personne ne suit tous ses logements : ajoutez-les d’abord à quelqu’un.'}
          className="sm:col-span-2"
        >
          <Select value={a.remplacantId ?? ''} placeholder="Personne" onChange={(e) => setA({ ...a, remplacantId: e.target.value || undefined })} options={relais} />
        </Field>
        <Field label="Motif" aide="Facultatif, jamais montré à l’équipe de terrain." className="sm:col-span-2">
          <Input value={a.motif ?? ''} onChange={(e) => setA({ ...a, motif: e.target.value })} maxLength={200} />
        </Field>
        <CeQuiChange absence={a} avecRemplacants={relais.length > 0} className="sm:col-span-2" />
      </div>
    </Modal>
  );
}

/** Ce qui change pendant l'absence : ses logements et ses incidents, et qui les reprend (calcul de l'espace opérations). */
function CeQuiChange({ absence: a, avecRemplacants, className }: { absence: AbsenceMembre; avecRemplacants: boolean; className?: string }) {
  const d = useErp();
  const apercu = useMemo(() => apercuAbsence(d.donnees, { ...a, id: a.id || 'nouvelle' }, AUJOURDHUI), [d.donnees, a]);
  const nom = (id?: Id) => (id ? (d.donnees.equipe.find((x) => x.id === id)?.nom ?? 'Personne') : 'Personne');
  const nomLogement = (id: Id) => d.logements.find((x) => x.id === id)?.nom ?? 'Logement';
  const texteIncident = (id: Id) => d.donnees.incidents.find((i) => i.id === id)?.description ?? 'Incident';
  return (
    <section aria-label="Ce qui change" className={cn('rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 text-[13px]', className)}>
      <p className="text-[13.5px] font-semibold text-(--lm-encre)">
        Ce qui change du {jourAbsence(a.du)} au {jourAbsence(a.au)}
      </p>
      {!apercu.logements.length && !apercu.incidents.length ? (
        <p className="mt-1 text-(--lm-encre-2)">Rien à reprendre{NBSP}: aucun logement ni incident ouvert à son nom.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {apercu.logements.map((x) => (
            <li key={x.logementId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-(--lm-encre)">{nomLogement(x.logementId)}</span>
              <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
              <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
            </li>
          ))}
          {apercu.incidents.map((x) => (
            <li key={x.incidentId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-(--lm-encre-2)">Incident · {texteIncident(x.incidentId)}</span>
              <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
              <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Sans remplaçant possible, l'aide du champ dit déjà quoi faire : une seule consigne. */}
      {apercu.sansRemplacant > 0 && avecRemplacants && (
        <p className="mt-2 text-[12.5px] text-(--lm-danger)">
          Personne pour reprendre {apercu.sansRemplacant > 1 ? `${apercu.sansRemplacant}${NBSP}lignes` : 'une ligne'}
          {NBSP}: choisissez un remplaçant.
        </p>
      )}
      <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">Au retour, tout revient à la personne.</p>
    </section>
  );
}

/**
 * Invite un responsable (Paramètres → Accès, assistant « Ajouter un
 * responsable » de la fiche logement) : sa fiche (reprise si l'adresse est
 * déjà connue), les logements qu'il rejoint, puis l'invitation. En démo,
 * aucun e-mail : un lien vers l'aperçu de son espace. Erreur d'envoi : la
 * fiche et les logements restent enregistrés, le message le dit.
 */
export async function inviterResponsable(
  d: ErpContexte,
  saisie: { nom: string; email: string; telephone: string; role?: RoleOperations; logementIds: Id[] },
): Promise<{ invitation: Invitation; erreur?: undefined } | { invitation?: undefined; erreur: string }> {
  const adresse = saisie.email.trim().toLowerCase();
  const { membre: m } = ficheResponsableInvite(d.donnees.equipe, { ...saisie, email: adresse }, () => nouvelId('eq'));
  // Logements qu'elle rejoint : le responsable par défaut d'avant devient un choix enregistré.
  const avant = d.donnees.equipe.find((x) => x.id === m.id);
  for (const a of affectationsAFiger(d.donnees, m.logementIds.filter((l) => !avant?.actif || !avant.logementIds.includes(l)))) d.upsert('affectations', a);
  d.upsert('equipe', m);
  try {
    if (MODE_DEMO) {
      const acces = d.donnees.accesOperations.find((a) => a.id === m.id);
      d.upsert('accesOperations', {
        id: m.id,
        membreId: m.id,
        email: adresse,
        emailFiche: adresse,
        statut: acces?.statut === 'actif' && acces.email === adresse ? 'actif' : 'invite',
        inviteLe: horodatageMaintenant(),
        invitePar: d.utilisateur.email,
        version: acces?.version ?? 1,
        liens: [],
        ...(acces?.derniereConnexion && acces.email === adresse ? { derniereConnexion: acces.derniereConnexion } : {}),
      });
      return { invitation: { lien: `${window.location.origin}/espace-operations?apercu=${encodeURIComponent(m.id)}`, envoye: false, email: adresse } };
    }
    const r = await inviterAvecReessai(API_OPERATIONS, { action: 'inviter', membreId: m.id, email: adresse });
    return { invitation: { ...r, email: adresse } };
  } catch (e) {
    return { erreur: `Fiche et logements enregistrés, mais l’invitation n’est pas partie : ${(e as Error).message}` };
  }
}

/** L'espace tel que la personne le voit, calculé avec les mêmes règles que le serveur ; rien ne s'envoie. */
function ApercuOps({ membre, onFermer }: { membre: MembreEquipe; onFermer: () => void }) {
  const d = useErp();
  const ref = useFenetre<HTMLDivElement>(true, onFermer);
  const [ecran, setEcran] = useState<Ecran>({ onglet: 'aujourdhui' });
  // Au nom de l'espace ouvert, comme le serveur (une personne de Sens voit « Sens »).
  const vue = useMemo(() => vueOperations(d.donnees, membre.id, { aujourdhui: AUJOURDHUI, conciergerie: espaceOuvert().nom }), [d.donnees, membre.id]);
  const actions = useMemo<ActionsOps>(
    () => ({
      agir: async () => ({ ok: false, erreur: 'Aperçu : rien n’est envoyé.' }),
      photo: async () => ({ erreur: 'Aperçu : rien n’est envoyé.' }),
    }),
    [],
  );
  const naviguer = useCallback((e: Partial<Ecran>) => setEcran((x) => ({ ...x, ...e })), []);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Espace de ${membre.nom}`} tabIndex={-1} className="fixed inset-0 z-[60] flex flex-col bg-(--lm-fond) outline-none">
      <div className="flex shrink-0 items-center justify-between gap-3 bg-(--lm-encre) px-4 py-2 text-white">
        <p className="min-w-0 truncate text-[13px] font-medium">Aperçu · ce que voit {membre.nom}</p>
        <button
          type="button"
          onClick={onFermer}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium hover:bg-white/15 focus-visible:outline-white"
        >
          <X className="size-4" aria-hidden />
          Fermer
        </button>
      </div>
      <div className="lm-defilement min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none">
        {vue ? (
          <EspaceOps vue={vue} ecran={ecran} naviguer={naviguer} actions={actions} apercu />
        ) : (
          <p className="p-6 text-center text-[14px] text-(--lm-encre-2)">Cette personne ne fait plus partie de l’équipe : pas d’espace.</p>
        )}
      </div>
    </div>
  );
}
