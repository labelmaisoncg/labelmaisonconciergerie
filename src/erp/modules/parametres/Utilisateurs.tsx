import { useState, type FormEvent } from 'react';
import { Check, Copy, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { pluriel } from '../../data/format';
import { lienCreationCompte } from '../../data/invitation';
import type { RoleUtilisateur, Utilisateur } from '../../data/types';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Field, IconButton, Input, Repli, Select, Table, type Colonne } from '../../ui';
import { appelerServeur } from '../messagerie/_composants/serveur';

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
}

/**
 * « Envoyer l'invitation » (api/erp-invitation) : un e-mail avec le lien
 * « Créer mon compte » ; sans expéditeur pour l'espace, le lien à copier. Le
 * lien porte l'adresse et un code à usage unique (14 jours). Juste après l'ajout d'un membre, puis à
 * tout moment depuis sa ligne (e-mail perdu, lien jamais ouvert).
 */
function InvitationMembre({ invitation: i, demo, onEnvoyer }: { invitation: Invitation; demo: boolean; onEnvoyer: () => void }) {
  const [copie, setCopie] = useState(false);
  const r = i.resultat;
  const ajout = i.origine === 'ajout';

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
          {!r ? (
            <>
              <p>Envoyez-lui l’invitation&nbsp;: le lien lui permet de créer son compte avec {i.email}.</p>
              <Button className="mt-2" icone={<Mail />} chargement={i.enCours} onClick={onEnvoyer}>
                Envoyer l’invitation
              </Button>
            </>
          ) : r.envoye ? (
            <p>Invitation envoyée à {i.email}.</p>
          ) : r.lien ? (
            <>
              <p>
                {demo ? 'Démonstration : aucun e-mail n’est envoyé.' : 'Nous ne pouvons pas envoyer l’e-mail pour l’instant.'} Copiez ce lien et envoyez-le à {i.nom}{' '}
                (SMS, WhatsApp…).
              </p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={r.lien} onFocus={(e) => e.currentTarget.select()} aria-label={'Lien « Créer mon compte »'} className="text-[12.5px]" />
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
        <Alert tone="danger" className="mb-3">
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

export default function Utilisateurs() {
  const d = useErp();
  const [message, setMessage] = useState<string>();
  const peutModifier = d.utilisateur.role === 'gerant';

  const [nouveau, setNouveau] = useState({ email: '', nom: '', role: 'operations' as RoleUtilisateur });
  const [invitation, setInvitation] = useState<Invitation>();
  const demo = d.mode !== 'reel';

  // Même appel après l'ajout et depuis une ligne ; la réponse ({ envoye, lien? }) dit s'il faut copier le lien.
  const envoyerInvitation = async (nom: string, email: string, origine: Invitation['origine']) => {
    setInvitation({ nom, email, origine, enCours: true });
    try {
      const resultat = demo ? { envoye: false, lien: lienCreationCompte(email) } : await appelerServeur<ResultatInvitation>('/api/erp-invitation', 'POST', { email });
      setInvitation({ nom, email, origine, enCours: false, resultat });
    } catch (e) {
      setInvitation({ nom, email, origine, enCours: false, erreur: (e as Error).message });
    }
  };

  const changerRole = (u: Utilisateur, role: RoleUtilisateur) => {
    if (u.id === d.utilisateur.id && role !== 'gerant' && d.utilisateurs.filter((x) => x.role === 'gerant').length === 1)
      return setMessage('Impossible : il doit rester au moins un gérant.');
    d.upsert('utilisateurs', { ...u, role });
    setMessage(undefined);
  };

  const ajouter = (e: FormEvent) => {
    e.preventDefault();
    const email = nouveau.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage('Adresse e-mail invalide.');
    if (!nouveau.nom.trim()) return setMessage('Indiquez le nom affiché.');
    if (d.utilisateurs.some((u) => u.email.toLowerCase() === email)) return setMessage('Ce membre existe déjà.');
    const id = d.mode === 'reel' ? email : `usr-${Date.now().toString(36)}`;
    d.upsert('utilisateurs', { id, email, nom: nouveau.nom.trim(), role: nouveau.role });
    setNouveau({ email: '', nom: '', role: 'operations' });
    setMessage(undefined);
    setInvitation({ nom: nouveau.nom.trim(), email, origine: 'ajout', enCours: false });
  };

  const retirer = (u: Utilisateur) => {
    if (u.id === d.utilisateur.id) return setMessage('Vous ne pouvez pas retirer votre propre accès.');
    if (!window.confirm(`Retirer l’accès de ${u.nom} (${u.email}) à l’ERP ?`)) return;
    d.remove('utilisateurs', u.id);
    setMessage(undefined);
  };

  /**
   * « Envoyer l'invitation » sur la ligne : gérant, jamais pour soi-même ni
   * pour le rôle prestataire (pas d'accès à l'ERP). La base ne dit pas qui a
   * déjà créé son compte : proposé à chacun. Masqué pendant que l'encadré de
   * l'ajout le propose déjà.
   */
  const invitable = (u: Utilisateur) =>
    peutModifier && u.id !== d.utilisateur.id && u.role !== 'prestataire' && !(invitation?.origine === 'ajout' && invitation.email === u.email && !invitation.resultat);

  const colonnes: Colonne<Utilisateur>[] = [
    {
      cle: 'nom',
      titre: 'Utilisateur',
      rendu: (u) => (
        <span className="flex items-center gap-2.5">
          {/* Sur téléphone, sans avatar : nom, rôle et retrait tiennent dans la largeur. */}
          <span className="hidden sm:block">
            <Avatar nom={u.nom} />
          </span>
          <span className="max-w-[6.5rem] min-w-0 sm:max-w-none">
            <span className="block font-medium">
              {u.nom}
              {u.id === d.utilisateur.id && <span className="ml-1.5 text-[12px] font-normal text-(--lm-encre-3)">(vous)</span>}
            </span>
            <span className="block truncate text-[12px] text-(--lm-encre-3)">{u.email}</span>
            {invitable(u) && (
              <Button
                size="sm"
                variant="ghost"
                icone={<Mail />}
                className="mt-1 -ml-2.5"
                chargement={invitation?.email === u.email && invitation.enCours}
                onClick={() => void envoyerInvitation(u.nom, u.email, 'ligne')}
              >
                {/* Nom lu par les lecteurs d'écran, à la suite du texte visible. */}
                <span className="sm:hidden">
                  Inviter<span className="sr-only"> {u.nom}</span>
                </span>
                <span className="hidden sm:inline">
                  Envoyer l’invitation<span className="sr-only"> à {u.nom}</span>
                </span>
              </Button>
            )}
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
          <div className="w-[8.75rem] sm:w-44">
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
            rendu: (u: Utilisateur) =>
              u.id === d.utilisateur.id ? null : (
                <IconButton label={`Retirer l’accès de ${u.nom}`} size="sm" onClick={() => retirer(u)}>
                  <Trash2 />
                </IconButton>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="max-w-4xl">
      <div>
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
            onEnvoyer={() => void envoyerInvitation(invitation.nom, invitation.email, invitation.origine)}
          />
        )}
        <Table legende="Utilisateurs" colonnes={colonnes} lignes={d.utilisateurs} cleLigne={(u) => u.id} vide="Personne dans l’équipe pour l’instant." />
        {peutModifier && (
          <Card className="mt-4">
            <CardHeader titre="Ajouter quelqu’un" />
            <form onSubmit={ajouter} className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <Field label="E-mail">
                <Input type="email" value={nouveau.email} onChange={(e) => setNouveau((n) => ({ ...n, email: e.target.value }))} />
              </Field>
              <Field label="Nom affiché">
                <Input value={nouveau.nom} onChange={(e) => setNouveau((n) => ({ ...n, nom: e.target.value }))} />
              </Field>
              <Field label="Rôle">
                <Select
                  value={nouveau.role}
                  onChange={(e) => setNouveau((n) => ({ ...n, role: e.target.value as RoleUtilisateur }))}
                  options={rolesProposes()}
                />
              </Field>
              <Button type="submit" variant="primary" icone={<UserPlus />}>
                Ajouter
              </Button>
            </form>
          </Card>
        )}
      </div>
      <Repli className="mt-4" titre="Que peut faire chaque rôle ?">
        <p className="mb-3 flex items-start gap-2 text-[12.5px] text-(--lm-encre-2)">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          {d.mode === 'reel'
            ? 'Chaque membre se connecte avec son propre compte (e-mail et mot de passe). Sans compte, il le crée depuis la page de connexion (« Créer mon compte »), avec l’adresse inscrite ici. Les droits sont vérifiés par la base elle-même : gérant et opérations consultent et modifient, lecture consulte seulement, seul un gérant gère les membres.'
            : 'Mode démonstration : les rôles ne sont pas appliqués. En production, chaque membre a son compte et la base vérifie les droits.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.filter((r) => r.role !== 'prestataire' || d.utilisateurs.some((u) => u.role === 'prestataire')).map((r) => (
            <div key={r.role} className="rounded-lg border border-(--lm-bord) p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold">{LIBELLES.role[r.role]}</p>
                <Badge tone={TON_ROLE[r.role]}>{pluriel(d.utilisateurs.filter((u) => u.role === r.role).length, 'compte')}</Badge>
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
