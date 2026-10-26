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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Copy, Eye, Mail, Phone, UserPlus, X } from 'lucide-react';
import { MODE_DEMO } from '../../data/config';
import { AUJOURDHUI, dateCourte, horodatageMaintenant } from '../../data/format';
import { vueOperations } from '../../data/espace-operations';
import { ROLES_OPERATIONS } from '../../data/operations';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from '../../data/repull';
import { nouvelId, useErp } from '../../data/store';
import type { Id, Logement, Proprietaire } from '../../data/types';
import type { AccesOperations, MembreEquipe, RoleOperations, SignalementLogement } from '../../data/types-operations';
import { Alert, Badge, Button, Card, Drawer, Field, Input, Interrupteur, Modal, Select, cn, useFenetre } from '../../ui';
import { EspaceOps } from '../../espace-operations/EspaceOps';
import type { ActionsOps, Ecran } from '../../espace-operations/commun';
import { PanneauEspace, statutAcces } from '../logements/_composants/EspaceProprietaireGerant';
import { RelancesPaiement } from '../logements/_composants/RelancesPaiement';
import { appelerServeur, ErreurServeur } from '../messagerie/_composants/serveur';

const API_PROPRIETAIRE = '/api/espace-proprietaire';
const API_OPERATIONS = '/api/espace-operations';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Invitation = { lien: string; envoye: boolean; email: string };

/** Invitation envoyée par le serveur ; la fiche toute neuve peut mettre un instant à arriver en base. */
async function inviterAvecReessai(api: string, corps: Record<string, unknown>): Promise<{ lien: string; envoye: boolean }> {
  let derniere: unknown;
  for (const attente of [0, 1500, 3000, 6000]) {
    if (attente) await new Promise((r) => setTimeout(r, attente));
    try {
      return await appelerServeur<{ lien: string; envoye: boolean }>(api, 'POST', corps);
    } catch (e) {
      derniere = e;
      if (!(e instanceof ErreurServeur) || e.statut !== 404) throw e;
    }
  }
  throw derniere;
}

/** État de l'accès d'un membre de l'équipe (mêmes mots et tons que pour les propriétaires). */
export function statutAccesOps(a: AccesOperations | undefined): { texte: string; ton: 'neutre' | 'succes' | 'alerte' } {
  if (!a) return { texte: 'Pas encore invité', ton: 'neutre' };
  if (a.statut === 'retire') return { texte: `Accès retiré${a.retireLe ? ` le ${dateCourte(a.retireLe.slice(0, 10))}` : ''}`, ton: 'neutre' };
  if (a.statut === 'actif') return { texte: `Connecté${a.derniereConnexion ? ` le ${dateCourte(a.derniereConnexion.slice(0, 10))}` : ''}`, ton: 'succes' };
  return { texte: `Invité le ${dateCourte(a.inviteLe.slice(0, 10))}`, ton: 'alerte' };
}

const logementsGeres = (logements: Logement[]) => logements.filter((l) => l.statut !== 'sorti').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

export default function Acces() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const logementFiltre = params.get('logement') ?? undefined;
  const personne = params.get('personne') ?? undefined;
  const [inviterProprietaire, setInviterProprietaire] = useState(false);
  const [inviterResponsable, setInviterResponsable] = useState(false);
  const nomFiltre = logementFiltre ? d.logements.find((l) => l.id === logementFiltre)?.nom : undefined;

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
            className="inline-flex min-h-8 items-center rounded-md px-1 font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
          >
            Tout voir
          </button>
        </div>
      )}
      <Proprietaires logementFiltre={logementFiltre} gerant={gerant} onInviter={() => setInviterProprietaire(true)} />
      <Responsables logementFiltre={logementFiltre} personne={personne} gerant={gerant} onInviter={() => setInviterResponsable(true)} />
      {inviterProprietaire && <InviterProprietaire onFermer={() => setInviterProprietaire(false)} />}
      {inviterResponsable && <InviterResponsable onFermer={() => setInviterResponsable(false)} logementsInitiaux={logementFiltre ? [logementFiltre] : []} />}
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
    <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3">
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
 * sans pouvoir le décocher) et la précision à montrer.
 */
function ListeLogements({
  logements,
  coches,
  onChange,
  regle,
}: {
  logements: Logement[];
  coches: Id[];
  onChange: (ids: Id[]) => void;
  regle?: (l: Logement) => { verrou?: boolean; detail?: string };
}) {
  return (
    <ul className="max-h-[50vh] divide-y divide-(--lm-bord) overflow-y-auto rounded-lg border border-(--lm-bord)">
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
        description="Chaque propriétaire voit, dans son espace, les logements dont il est propriétaire : réservations, bilans publiés, factures partagées et documents. Rien d’autre."
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
            const s = statutAcces(acces);
            const siens = logementsGeres(d.logements).filter((l) => l.proprietaireId === p.id);
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-(--lm-encre)">{p.nom}</p>
                      <p className="truncate text-[12.5px] text-(--lm-encre-2)">{acces?.email || p.contact.email || 'Pas d’adresse e-mail'}</p>
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
                        {acces && acces.statut !== 'retire' ? 'Gérer l’accès' : 'Inviter'}
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
  const logements = logementsGeres(d.logements);
  const nomProprietaire = (id: Id) => (id === ID_PROPRIETAIRE_A_RENSEIGNER ? 'à renseigner' : (d.proprietaires.find((x) => x.id === id)?.nom ?? 'inconnu'));
  const enregistrer = () => {
    for (const id of coches) d.mettreAJour('logements', id, (l) => ({ ...l, proprietaireId: p.id }));
    onFermer();
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
            {coches.length > 1 ? `Attribuer ${coches.length} logements` : 'Attribuer'}
          </Button>
        </>
      }
    >
      <ListeLogements
        logements={logements}
        coches={coches}
        onChange={setCoches}
        regle={(l) => (l.proprietaireId === p.id ? { verrou: true, detail: 'À ce propriétaire' } : { detail: `Actuellement : ${nomProprietaire(l.proprietaireId)}` })}
      />
    </Modal>
  );
}

/** Inviter un propriétaire : sa fiche (ou celle qui a déjà cette adresse dans cet espace), ses logements, puis l'invitation. */
function InviterProprietaire({ onFermer }: { onFermer: () => void }) {
  const d = useErp();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [coches, setCoches] = useState<Id[]>([]);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [invitation, setInvitation] = useState<Invitation>();
  const nomProprietaire = (id: Id) => (id === ID_PROPRIETAIRE_A_RENSEIGNER ? 'à renseigner' : (d.proprietaires.find((x) => x.id === id)?.nom ?? 'inconnu'));

  const envoyer = async () => {
    const adresse = email.trim().toLowerCase();
    if (nom.trim().length < 2) return setErreur('Indiquez le nom du propriétaire.');
    if (!EMAIL.test(adresse)) return setErreur('Adresse e-mail invalide.');
    setErreur(undefined);
    setEnCours(true);
    const existant = d.proprietaires.find((p) => p.contact.email.trim().toLowerCase() === adresse);
    const p: Proprietaire = existant
      ? { ...existant, nom: existant.nom || nom.trim(), contact: { email: adresse, telephone: existant.contact.telephone || telephone.trim() } }
      : { id: nouvelId('pro'), type: 'particulier', nom: nom.trim(), contact: { email: adresse, telephone: telephone.trim() }, adresse: '', ibanMasque: '', notes: '', creeLe: horodatageMaintenant().slice(0, 10) };
    d.upsert('proprietaires', p);
    for (const id of coches) d.mettreAJour('logements', id, (l) => ({ ...l, proprietaireId: p.id }));
    try {
      if (MODE_DEMO) {
        const acces = d.donnees.accesProprietaires.find((a) => a.id === p.id);
        d.upsert('accesProprietaires', {
          id: p.id,
          proprietaireId: p.id,
          email: adresse,
          statut: acces?.statut === 'actif' ? 'actif' : 'invite',
          inviteLe: new Date().toISOString(),
          invitePar: d.utilisateur.email,
          version: acces?.version ?? 1,
          liens: [],
          ...(acces?.derniereConnexion ? { derniereConnexion: acces.derniereConnexion } : {}),
        });
        setInvitation({ lien: `${window.location.origin}/espace-proprietaire?apercu=${encodeURIComponent(p.id)}`, envoye: false, email: adresse });
      } else {
        const r = await inviterAvecReessai(API_PROPRIETAIRE, { action: 'inviter', proprietaireId: p.id, email: adresse });
        setInvitation({ ...r, email: adresse });
      }
    } catch (e) {
      setErreur(`Fiche et logements enregistrés, mais l’invitation n’est pas partie : ${(e as Error).message}`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre="Inviter un propriétaire"
      description="Il reçoit un lien personnel, valable 7 jours, vers son espace."
      pied={
        invitation ? (
          <Button variant="primary" onClick={onFermer}>
            Terminé
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onFermer}>
              Annuler
            </Button>
            <Button variant="primary" chargement={enCours} onClick={() => void envoyer()}>
              Inviter
            </Button>
          </>
        )
      }
    >
      {invitation ? (
        <LienInvitation invitation={invitation} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom" requis>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" placeholder="Ex. SCI Les Tilleuls" />
          </Field>
          <Field label="Adresse e-mail" requis aide="Une fiche avec cette adresse est reprise, sans doublon.">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Téléphone" aide="Facultatif.">
            <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Ses logements</p>
            <ListeLogements logements={logementsGeres(d.logements)} coches={coches} onChange={setCoches} regle={(l) => ({ detail: `Actuellement : ${nomProprietaire(l.proprietaireId)}` })} />
          </div>
          {erreur && (
            <Alert tone="danger" className="sm:col-span-2">
              {erreur}
            </Alert>
          )}
        </div>
      )}
    </Modal>
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
    .filter((m) => !logementFiltre || m.logementIds.includes(logementFiltre))
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
        description="Responsables de pôle et agents de terrain : chacun voit, dans son espace opérations, seulement les logements cochés ici (réservations, urgences, incidents, contrôles qualité, équipe et remplacements)."
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
            const s = statutAccesOps(d.donnees.accesOperations.find((a) => a.id === m.id));
            return (
              <li key={m.id}>
                <Card className={cn('flex h-full flex-col gap-2', !m.actif && 'opacity-70')}>
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

/** « Ce logement n'est pas à moi » : retirer le logement à la personne, ou confirmer qu'il est bien à elle. */
/** `imbrique` : posé dans une carte (coins plus petits que ceux de la carte). */
export function Signalements({ liste, gerant, imbrique }: { liste: SignalementLogement[]; gerant: boolean; imbrique?: boolean }) {
  const d = useErp();
  const traiter = (s: SignalementLogement, decision: 'retire' | 'confirme') => {
    if (decision === 'retire') d.mettreAJour('equipe', s.membreId, (m) => ({ ...m, logementIds: m.logementIds.filter((x) => x !== s.logementId) }));
    d.upsert('signalementsLogement', { ...s, statut: 'traite', decision, traiteLe: horodatageMaintenant(), traitePar: d.utilisateur.nom });
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
                  <Button size="sm" onClick={() => traiter(s, 'retire')}>
                    Lui retirer
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Une personne de terrain : fiche, logements, accès (inviter, renvoyer, retirer). */
function PanneauResponsable({ id, gerant, onFermer }: { id: Id; gerant: boolean; onFermer: () => void }) {
  const d = useErp();
  const m = d.donnees.equipe.find((x) => x.id === id)!;
  const acces = d.donnees.accesOperations.find((a) => a.id === id);
  const s = statutAccesOps(acces);
  const [fiche, setFiche] = useState<MembreEquipe>(m);
  const [enCours, setEnCours] = useState<'inviter' | 'retirer'>();
  const [erreur, setErreur] = useState<string>();
  const [invitation, setInvitation] = useState<Invitation>();
  const [confirmer, setConfirmer] = useState(false);
  const [apercu, setApercu] = useState(false);
  const change = JSON.stringify(fiche) !== JSON.stringify(m);
  const tel = fiche.telephone?.replace(/[^\d+]/g, '');

  const enregistrer = () => {
    if (fiche.nom.trim().length < 2) return setErreur('Indiquez le nom.');
    d.upsert('equipe', { ...fiche, nom: fiche.nom.trim(), email: fiche.email?.trim().toLowerCase() || undefined, telephone: fiche.telephone?.trim() || undefined });
    setErreur(undefined);
  };
  const inviter = async () => {
    const adresse = (fiche.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(adresse)) return setErreur('Adresse e-mail invalide.');
    if (change) enregistrer();
    setErreur(undefined);
    setEnCours('inviter');
    try {
      if (MODE_DEMO) {
        d.upsert('accesOperations', {
          id,
          membreId: id,
          email: adresse,
          statut: acces?.statut === 'actif' ? 'actif' : 'invite',
          inviteLe: new Date().toISOString(),
          invitePar: d.utilisateur.email,
          version: acces?.version ?? 1,
          liens: [],
          ...(acces?.derniereConnexion ? { derniereConnexion: acces.derniereConnexion } : {}),
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
  const retirer = async () => {
    setConfirmer(false);
    setErreur(undefined);
    setEnCours('retirer');
    try {
      if (MODE_DEMO) {
        if (acces) d.upsert('accesOperations', { ...acces, statut: 'retire', retireLe: new Date().toISOString(), version: acces.version + 1, liens: [] });
      } else await appelerServeur(API_OPERATIONS, 'POST', { action: 'retirer', membreId: id });
    } catch (e) {
      setErreur((e as Error).message);
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
                <a href={`tel:${tel}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--lm-bord-fort) px-3.5 text-sm text-(--lm-encre) hover:bg-(--lm-surface-2)">
                  <Phone className="size-4" aria-hidden />
                  Appeler
                </a>
              )}
              {fiche.email && (
                <a href={`mailto:${fiche.email}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--lm-bord-fort) px-3.5 text-sm text-(--lm-encre) hover:bg-(--lm-surface-2)">
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
          <ListeLogements logements={logementsGeres(d.logements)} coches={fiche.logementIds} onChange={(ids) => gerant && setFiche({ ...fiche, logementIds: ids })} />
        </section>

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
              La personne est déconnectée tout de suite et ses liens ne marchent plus.
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

/** Inviter un responsable : sa fiche dans l'espace ouvert, ses logements, puis l'invitation. */
export function InviterResponsable({ onFermer, logementsInitiaux = [] }: { onFermer: () => void; logementsInitiaux?: Id[] }) {
  const d = useErp();
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [role, setRole] = useState<RoleOperations>('pole');
  const [coches, setCoches] = useState<Id[]>(logementsInitiaux);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [invitation, setInvitation] = useState<Invitation>();
  const logements = useMemo(() => logementsGeres(d.logements), [d.logements]);

  const envoyer = async () => {
    const adresse = email.trim().toLowerCase();
    if (nom.trim().length < 2) return setErreur('Indiquez le nom.');
    if (!EMAIL.test(adresse)) return setErreur('Adresse e-mail invalide.');
    if (!coches.length) return setErreur('Cochez au moins un logement.');
    setErreur(undefined);
    setEnCours(true);
    const existant = d.donnees.equipe.find((m) => (m.email ?? '').toLowerCase() === adresse);
    const m: MembreEquipe = existant
      ? { ...existant, actif: true, role, logementIds: [...new Set([...existant.logementIds, ...coches])], ...(telephone.trim() && !existant.telephone ? { telephone: telephone.trim() } : {}) }
      : { id: nouvelId('eq'), nom: nom.trim(), role, email: adresse, ...(telephone.trim() ? { telephone: telephone.trim() } : {}), logementIds: coches, actif: true };
    d.upsert('equipe', m);
    try {
      if (MODE_DEMO) {
        d.upsert('accesOperations', { id: m.id, membreId: m.id, email: adresse, statut: 'invite', inviteLe: new Date().toISOString(), invitePar: d.utilisateur.email, version: 1, liens: [] });
        setInvitation({ lien: `${window.location.origin}/espace-operations?apercu=${encodeURIComponent(m.id)}`, envoye: false, email: adresse });
      } else {
        const r = await inviterAvecReessai(API_OPERATIONS, { action: 'inviter', membreId: m.id, email: adresse });
        setInvitation({ ...r, email: adresse });
      }
    } catch (e) {
      setErreur(`Fiche et logements enregistrés, mais l’invitation n’est pas partie : ${(e as Error).message}`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre="Inviter un responsable"
      description="Il reçoit un lien personnel, valable 7 jours, vers son espace opérations."
      pied={
        invitation ? (
          <Button variant="primary" onClick={onFermer}>
            Terminé
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onFermer}>
              Annuler
            </Button>
            <Button variant="primary" chargement={enCours} onClick={() => void envoyer()}>
              Inviter
            </Button>
          </>
        )
      }
    >
      {invitation ? (
        <LienInvitation invitation={invitation} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nom" requis>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Rôle">
            <Select value={role} onChange={(e) => setRole(e.target.value as RoleOperations)} options={(Object.keys(ROLES_OPERATIONS) as RoleOperations[]).map((r) => ({ valeur: r, libelle: ROLES_OPERATIONS[r] }))} />
          </Field>
          <Field label="Adresse e-mail" requis>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Téléphone" aide="Facultatif.">
            <Input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="off" />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Ses logements</p>
            <ListeLogements logements={logements} coches={coches} onChange={setCoches} />
          </div>
          {erreur && (
            <Alert tone="danger" className="sm:col-span-2">
              {erreur}
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}

/** L'espace tel que la personne le voit, calculé avec les mêmes règles que le serveur ; rien ne s'envoie. */
function ApercuOps({ membre, onFermer }: { membre: MembreEquipe; onFermer: () => void }) {
  const d = useErp();
  const ref = useFenetre<HTMLDivElement>(true, onFermer);
  const [ecran, setEcran] = useState<Ecran>({ onglet: 'aujourdhui' });
  const vue = useMemo(() => vueOperations(d.donnees, membre.id, { aujourdhui: AUJOURDHUI }), [d.donnees, membre.id]);
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
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] font-medium hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus:outline-none"
        >
          <X className="size-4" aria-hidden />
          Fermer
        </button>
      </div>
      <div className="lm-defilement min-h-0 flex-1 overflow-y-auto">
        {vue ? (
          <EspaceOps vue={vue} ecran={ecran} naviguer={naviguer} actions={actions} apercu />
        ) : (
          <p className="p-6 text-center text-[14px] text-(--lm-encre-2)">Cette personne ne fait plus partie de l’équipe : pas d’espace.</p>
        )}
      </div>
    </div>
  );
}
