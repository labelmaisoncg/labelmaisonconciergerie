import { useState } from 'react';
import { Check, Copy, Ellipsis, Mail, Server, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { EMAIL_EQUIPE } from '../../data/config';
import { estCompteTechnique } from '../../data/oauth-regles';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { insecables, pluriel } from '../../data/format';
import { espaceDesDonnees } from '../../data/espaces';
import { lienCreationCompte } from '../../data/invitation';
import type { RoleUtilisateur, Utilisateur } from '../../data/types';
import { Alert, Avatar, Badge, Button, IconButton, Input, Modal, Repli, Section, Select, Table, type Colonne } from '../../ui';
import { appelerServeur, ErreurServeur } from '../messagerie/_composants/serveur';
import { AssistantMembre } from './AssistantMembre';

/** Réponse de api/erp-invitation : envoyée par e-mail, sinon le lien à copier. */
interface ResultatInvitation {
  envoye: boolean;
  lien?: string;
}

/** L'invitation d'un membre : juste après son ajout, ou renvoyée depuis sa ligne. */
interface Invitation {
  nom: string;
  email: string;
  origine: 'ajout' | 'ligne';
  enCours: boolean;
  resultat?: ResultatInvitation;
  erreur?: string;
  /** Accès déjà activé entre-temps : une information, pas une erreur. */
  deja?: boolean;
}

/**
 * « Envoyer l'invitation » (api/erp-invitation) : un e-mail avec le lien
 * « Créer mon compte » ; sans expéditeur pour l'espace, le lien à copier. Le
 * lien porte l'adresse et un code à usage unique (14 jours). Juste après l'ajout d'un membre, puis à
 * tout moment depuis sa ligne (e-mail perdu, lien jamais ouvert).
 */
function InvitationMembre({ invitation: i, demo, ouvertes, onEnvoyer }: { invitation: Invitation; demo: boolean; ouvertes: boolean; onEnvoyer: () => void }) {
  const [copie, setCopie] = useState(false);
  const r = i.resultat;
  const ajout = i.origine === 'ajout';
  // Renvoi depuis la ligne : le nouveau lien remplace l'ancien (juste après l'ajout, aucun n'est encore parti).
  const remplace = ajout ? '' : ' Un lien envoyé avant ne marche plus.';

  const copier = async () => {
    if (!r?.lien) return;
    try {
      await navigator.clipboard.writeText(r.lien);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* copie refusée : le lien reste sélectionnable */
    }
  };

  return (
    <>
      {(ajout || r) && (
        <Alert tone="succes" className="mb-3" titre={ajout ? `${i.nom} fait partie de l’équipe.` : undefined}>
          {!r && !ouvertes ? (
            <p>Les invitations s’ouvriront à la fin de la mise à jour de l’ERP.</p>
          ) : !r ? (
            <>
              <p>Envoyez-lui l’invitation&nbsp;: le lien lui permet de créer son compte avec {i.email}.</p>
              <Button className="mt-2" icone={<Mail />} chargement={i.enCours} onClick={onEnvoyer}>
                Envoyer l’invitation
              </Button>
            </>
          ) : r.envoye ? (
            <p>
              Invitation envoyée à {i.email}.{remplace}
            </p>
          ) : r.lien ? (
            <>
              <p>
                {demo ? insecables('Démonstration : aucun e-mail n’est envoyé.') : 'Nous ne pouvons pas envoyer l’e-mail pour l’instant.'} Copiez ce lien et envoyez-le à {i.nom}{' '}
                (SMS, WhatsApp…).{remplace}
              </p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={r.lien} onFocus={(e) => e.currentTarget.select()} aria-label={insecables('Lien « Créer mon compte »')} className="text-[12.5px]" />
                <Button icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
                  {copie ? 'Copié' : 'Copier'}
                </Button>
              </div>
            </>
          ) : (
            <p>Nous ne pouvons pas envoyer l’e-mail pour l’instant. Réessayez dans un instant.</p>
          )}
        </Alert>
      )}
      {i.erreur && (
        <Alert tone={i.deja ? 'info' : 'danger'} className="mb-3">
          {i.erreur}
        </Alert>
      )}
    </>
  );
}

const ROLES: { role: RoleUtilisateur; description: string; acces: string[] }[] = [
  {
    role: 'gerant',
    description: 'Pilote tout, y compris l’équipe et les plateformes.',
    acces: ['Tous les modules', 'Équipe et plateformes'],
  },
  {
    role: 'operations',
    description: 'Fait tourner le quotidien.',
    acces: ['Logements et réservations', 'Messagerie et agent', 'CRM'],
  },
  {
    role: 'prestataire',
    description: 'Ancien accès des prestataires de ménage (le ménage passe désormais par BNB Cleaning).',
    acces: ['Aucun accès pour l’instant'],
  },
  {
    role: 'lecture',
    description: 'Consultation sans modification, par exemple l’expert-comptable.',
    acces: ['Tout en lecture', 'Aucune action'],
  },
];

const TON_ROLE = { gerant: 'or', operations: 'neutre', prestataire: 'neutre', lecture: 'neutre' } as const;

/** Rôles proposés : le rôle prestataire n'est plus attribué (gardé s'il l'est déjà). */
const rolesProposes = (actuel?: RoleUtilisateur) =>
  ROLES.filter((r) => r.role !== 'prestataire' || r.role === actuel).map((r) => ({ valeur: r.role, libelle: LIBELLES.role[r.role] }));

/** Rôles de l'assistant « Ajouter quelqu'un » : les mêmes, avec ce que chacun permet. */
const ROLES_AJOUT = ROLES.filter((r) => r.role !== 'prestataire').map((r) => ({ valeur: r.role, libelle: LIBELLES.role[r.role], detail: r.description }));

/**
 * Compte technique (serveur, compte d'équipe) : le serveur lit et écrit la
 * base avec lui. Rangé à part, sans rôle à changer ni accès à retirer, et
 * jamais compté dans l'équipe.
 */
const compteTechnique = (u: Utilisateur) => estCompteTechnique(u.email, EMAIL_EQUIPE);

export default function Utilisateurs() {
  const d = useErp();
  const [message, setMessage] = useState<string>();
  const peutModifier = d.utilisateur.role === 'gerant';

  /** Assistant « Ajouter quelqu'un » ouvert. */
  const [ajout, setAjout] = useState(false);
  const [invitation, setInvitation] = useState<Invitation>();
  /** Membre dont la feuille d'actions est ouverte (téléphone). */
  const [feuille, setFeuille] = useState<Utilisateur | null>(null);
  const demo = d.mode !== 'reel';
  const membres = d.utilisateurs.filter((u) => !compteTechnique(u));
  const techniques = d.utilisateurs.filter(compteTechnique);

  // Même appel après l'ajout et depuis une ligne ; la réponse ({ envoye, lien? }) dit s'il faut copier le lien.
  const envoyerInvitation = async (nom: string, email: string, origine: Invitation['origine']) => {
    setInvitation({ nom, email, origine, enCours: true });
    try {
      const resultat = demo ? { envoye: false, lien: lienCreationCompte(email) } : await appelerServeur<ResultatInvitation>('/api/erp-invitation', 'POST', { email });
      setInvitation({ nom, email, origine, enCours: false, resultat });
    } catch (e) {
      const deja = e instanceof ErreurServeur && e.code === 'deja';
      setInvitation({ nom, email, origine, enCours: false, erreur: (e as Error).message, deja });
    }
  };

  /**
   * Le dernier gérant de l'équipe (comptes techniques à part) ne perd jamais
   * ce rôle ni son accès, qui que ce soit qui le demande : le compte d'équipe,
   * ouvert avec ERP_PASSWORD, ne laisse pas l'espace sans gérant en personne.
   */
  const dernierGerant = (u: Utilisateur) => u.role === 'gerant' && !compteTechnique(u) && membres.filter((x) => x.role === 'gerant').length === 1;

  const changerRole = (u: Utilisateur, role: RoleUtilisateur) => {
    if (role !== 'gerant' && dernierGerant(u)) return setMessage(insecables('Impossible : il doit rester au moins un gérant.'));
    d.upsert('utilisateurs', { ...u, role });
    setMessage(undefined);
  };

  // Ajouté par l'assistant (data/creation-membre.ts) : l'encadré propose aussitôt de lui envoyer l'invitation.
  const ajoute = (u: Utilisateur) => {
    setMessage(undefined);
    setInvitation({ nom: u.nom, email: u.email, origine: 'ajout', enCours: false });
  };

  const retirer = (u: Utilisateur) => {
    if (u.id === d.utilisateur.id) return setMessage('Vous ne pouvez pas retirer votre propre accès.');
    if (dernierGerant(u)) return setMessage(insecables('Impossible : il doit rester au moins un gérant.'));
    if (!window.confirm(insecables(`Retirer l’accès de ${u.nom} (${u.email}) à l’ERP ?`))) return;
    d.remove('utilisateurs', u.id);
    setMessage(undefined);
  };

  const envoiEnCours = (u: Utilisateur) => invitation?.email === u.email && invitation.enCours;
  // Base d'avant les espaces : pas d'invitation (rien ne relierait le compte à sa fiche).
  const invitationsOuvertes = demo || espaceDesDonnees() !== null;

  /**
   * « Envoyer l'invitation » sur la ligne : gérant, jamais pour soi-même ni
   * pour le rôle prestataire (pas d'accès à l'ERP), ni pour qui a déjà
   * activé son accès (compte relié). Masqué pendant que l'encadré de l'ajout
   * le propose déjà, et tant que la base n'est pas passée aux espaces.
   */
  const invitable = (u: Utilisateur) =>
    invitationsOuvertes &&
    peutModifier &&
    u.compteActif !== true &&
    !(invitation?.deja && invitation.email === u.email) &&
    u.id !== d.utilisateur.id &&
    u.role !== 'prestataire' &&
    !(invitation?.origine === 'ajout' && invitation.email === u.email && !invitation.resultat);

  const colonnes: Colonne<Utilisateur>[] = [
    {
      cle: 'nom',
      titre: 'Utilisateur',
      rendu: (u) => (
        <span className="flex items-center gap-2.5">
          {/* Sur téléphone, sans avatar : nom, rôle, invitation et retrait tiennent dans la largeur. */}
          <span className="hidden sm:block">
            <Avatar nom={u.nom} />
          </span>
          <span className="max-w-20 min-w-0 sm:max-w-none">
            <span className="block font-medium">
              {u.nom}
              {u.id === d.utilisateur.id && <span className="ml-1.5 text-[12px] font-normal text-(--lm-encre-3)">(vous)</span>}
            </span>
            <span className="block truncate text-[12px] text-(--lm-encre-3)">{u.email}</span>
          </span>
        </span>
      ),
      tri: (a, b) => a.nom.localeCompare(b.nom),
    },
    {
      cle: 'role',
      titre: 'Rôle',
      rendu: (u) =>
        peutModifier ? (
          <div className="w-[8.5rem] sm:w-44">
            <Select
              aria-label={`Rôle de ${u.nom}`}
              value={u.role}
              onChange={(e) => changerRole(u, e.target.value as RoleUtilisateur)}
              options={rolesProposes(u.role)}
            />
          </div>
        ) : (
          <Badge tone={TON_ROLE[u.role]}>{LIBELLES.role[u.role]}</Badge>
        ),
    },
    ...(peutModifier
      ? [
          {
            cle: 'retirer',
            titre: '',
            align: 'droite' as const,
            // Les actions de la ligne côte à côte (sur téléphone, « … » ouvre une feuille) : la ligne reste nom + e-mail.
            rendu: (u: Utilisateur) =>
              u.id === d.utilisateur.id ? null : (
                <>
                  <IconButton label={`Actions pour ${u.nom}`} size="sm" className="sm:hidden" chargement={envoiEnCours(u)} onClick={() => setFeuille(u)}>
                    {!envoiEnCours(u) && <Ellipsis />}
                  </IconButton>
                  <span className="hidden items-center sm:inline-flex">
                    {invitable(u) && (
                      <IconButton
                        label={`Envoyer l’invitation à ${u.nom}`}
                        size="sm"
                        chargement={envoiEnCours(u)}
                        onClick={() => void envoyerInvitation(u.nom, u.email, 'ligne')}
                      >
                        {!envoiEnCours(u) && <Mail />}
                      </IconButton>
                    )}
                    <IconButton label={`Retirer l’accès de ${u.nom}`} size="sm" onClick={() => retirer(u)}>
                      <Trash2 />
                    </IconButton>
                  </span>
                </>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl">
      {/* En-tête de la liste : l'ajout s'y fait, comme dans les autres listes. */}
      <Section
        titre="Membres"
        description="Les personnes qui ont accès à l’ERP, et leur rôle."
        className="mb-0 sm:mb-0"
        actions={
          peutModifier && (
            <Button variant="primary" icone={<UserPlus />} onClick={() => setAjout(true)}>
              Ajouter quelqu’un
            </Button>
          )
        }
      >
        {message && (
          <Alert tone="danger" className="mb-3">
            {message}
          </Alert>
        )}
        {!peutModifier && (
          <Alert tone="info" className="mb-3">
            Seul un gérant peut modifier les rôles.
          </Alert>
        )}
        {invitation && (
          <InvitationMembre
            key={`${invitation.origine}:${invitation.email}`}
            invitation={invitation}
            demo={demo}
            ouvertes={invitationsOuvertes}
            onEnvoyer={() => void envoyerInvitation(invitation.nom, invitation.email, invitation.origine)}
          />
        )}
        <Table legende="Utilisateurs" colonnes={colonnes} lignes={membres} cleLigne={(u) => u.id} vide="Personne dans l’équipe pour l’instant." />
        {techniques.length > 0 && (
          <ul aria-label="Comptes techniques" className="mt-3 divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord) bg-(--lm-surface)">
            {techniques.map((u) => (
              <li key={u.id} className="flex items-start gap-2.5 px-3 py-2.5 text-[13.5px] sm:px-4">
                <span className="hidden size-8 shrink-0 place-items-center rounded-full bg-(--lm-surface-2) text-(--lm-encre-2) sm:grid" aria-hidden>
                  <Server className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">
                    Compte technique du serveur
                    {u.id === d.utilisateur.id && <span className="ml-1.5 text-[12px] font-normal text-(--lm-encre-3)">(vous)</span>}
                  </span>
                  <span className="block truncate text-[12px] text-(--lm-encre-3)">{u.email}</span>
                  <span className="mt-1 block text-[12.5px] text-(--lm-encre-2)">Il fait tourner le site et la synchronisation des plateformes&nbsp;: ne le supprimez pas.</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <Modal ouvert={!!feuille} onFermer={() => setFeuille(null)} titre={feuille?.nom} description={feuille?.email} taille="sm">
          {feuille && (
            <div className="grid gap-2">
              {invitable(feuille) && (
                <Button
                  icone={<Mail />}
                  onClick={() => {
                    setFeuille(null);
                    void envoyerInvitation(feuille.nom, feuille.email, 'ligne');
                  }}
                >
                  Envoyer l’invitation
                </Button>
              )}
              <Button
                variant="danger"
                icone={<Trash2 />}
                onClick={() => {
                  setFeuille(null);
                  retirer(feuille);
                }}
              >
                Retirer l’accès
              </Button>
            </div>
          )}
        </Modal>
        {ajout && <AssistantMembre roles={ROLES_AJOUT} onFermer={() => setAjout(false)} onAjoute={ajoute} />}
      </Section>
      <Repli className="mt-4" titre="Que peut faire chaque rôle ?">
        <p className="mb-3 flex items-start gap-2 text-[12.5px] text-(--lm-encre-2)">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          {d.mode === 'reel'
            ? insecables('Chaque membre se connecte avec son propre compte (e-mail et mot de passe). Pour créer son compte, il ouvre le lien de son invitation (« Envoyer l’invitation » sur sa ligne la lui envoie). Les droits sont vérifiés par la base elle-même : gérant et opérations consultent et modifient, lecture consulte seulement, seul un gérant gère les membres.')
            : insecables('Mode démonstration : les rôles ne sont pas appliqués. En production, chaque membre a son compte et la base vérifie les droits.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.filter((r) => r.role !== 'prestataire' || membres.some((u) => u.role === 'prestataire')).map((r) => (
            <div key={r.role} className="rounded-lg border border-(--lm-bord) p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold">{LIBELLES.role[r.role]}</p>
                <Badge tone={TON_ROLE[r.role]}>{pluriel(membres.filter((u) => u.role === r.role).length, 'compte')}</Badge>
              </div>
              <p className="mb-1 text-[12.5px] text-(--lm-encre-2)">{r.description}</p>
              <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-(--lm-encre-2)">
                {r.acces.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Repli>
    </div>
  );
}
