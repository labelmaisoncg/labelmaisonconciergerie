import { useState, type FormEvent } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { pluriel } from '../../data/format';
import type { RoleUtilisateur, Utilisateur } from '../../data/types';
import { Alert, Avatar, Badge, Button, Card, CardHeader, Field, IconButton, Input, Select, Table, type Colonne } from '../../ui';

const ROLES: { role: RoleUtilisateur; description: string; acces: string[] }[] = [
  {
    role: 'gerant',
    description: 'Pilote la société : propriétaires, mandats, finance, paramètres.',
    acces: ['Tous les modules', 'Finance et relevés', 'Utilisateurs et intégrations'],
  },
  {
    role: 'operations',
    description: 'Fait tourner l’exploitation au quotidien.',
    acces: ['Réservations, messagerie', 'Ménages, linge, incidents', 'Prestataires, paiements'],
  },
  {
    role: 'prestataire',
    description: 'Accès limité à ses missions : checklist, photos avant/après, linge.',
    acces: ['Ses missions uniquement', 'Aucune donnée financière', 'Aucune donnée propriétaire'],
  },
  {
    role: 'lecture',
    description: 'Consultation sans modification, par exemple l’expert-comptable.',
    acces: ['Tableaux et relevés en lecture', 'Aucune action'],
  },
];

const TON_ROLE = { gerant: 'or', operations: 'info', prestataire: 'neutre', lecture: 'neutre' } as const;

export default function Utilisateurs() {
  const d = useErp();
  const [message, setMessage] = useState<string>();
  const peutModifier = d.utilisateur.role === 'gerant';

  const [nouveau, setNouveau] = useState({ email: '', nom: '', role: 'operations' as RoleUtilisateur });
  const [ajout, setAjout] = useState<string>();

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
    setAjout(`${nouveau.nom.trim()} ajouté. Créez aussi son compte de connexion dans Supabase (Authentication, Users, Add user) avec la même adresse.`);
  };

  const retirer = (u: Utilisateur) => {
    if (u.id === d.utilisateur.id) return setMessage('Vous ne pouvez pas retirer votre propre accès.');
    if (!window.confirm(`Retirer l’accès de ${u.nom} (${u.email}) à l’ERP ?`)) return;
    d.remove('utilisateurs', u.id);
    setMessage(undefined);
  };

  const colonnes: Colonne<Utilisateur>[] = [
    {
      cle: 'nom',
      titre: 'Utilisateur',
      rendu: (u) => (
        <span className="flex items-center gap-2.5">
          <Avatar nom={u.nom} />
          <span className="min-w-0">
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
          <div className="w-44">
            <Select
              aria-label={`Rôle de ${u.nom}`}
              value={u.role}
              onChange={(e) => changerRole(u, e.target.value as RoleUtilisateur)}
              options={ROLES.map((r) => ({ valeur: r.role, libelle: LIBELLES.role[r.role] }))}
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
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
        {ajout && (
          <Alert tone="succes" className="mb-3">
            {ajout}
          </Alert>
        )}
        <Table legende="Utilisateurs" colonnes={colonnes} lignes={d.utilisateurs} cleLigne={(u) => u.id} vide="Aucun membre enregistré." />
        {peutModifier && (
          <Card className="mt-4">
            <CardHeader titre="Ajouter un membre" description="Donne l’accès à l’ERP à une adresse e-mail, avec son rôle." />
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
                  options={ROLES.map((r) => ({ valeur: r.role, libelle: LIBELLES.role[r.role] }))}
                />
              </Field>
              <Button type="submit" variant="primary" icone={<UserPlus />}>
                Ajouter
              </Button>
            </form>
          </Card>
        )}
        <p className="mt-3 flex items-start gap-2 text-[12.5px] text-(--lm-encre-2)">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          {d.mode === 'reel'
            ? 'Chaque membre se connecte avec son propre compte (e-mail et mot de passe). Les droits sont appliqués par la base elle-même (règles RLS) : gérant et opérations consultent et modifient, lecture consulte seulement, seul un gérant gère les membres. Le rôle prestataire n’a pas encore d’accès.'
            : 'Mode démonstration : les rôles ne sont pas appliqués. En production, chaque membre a son compte et la base applique les droits (règles RLS).'}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {ROLES.map((r) => (
          <Card key={r.role}>
            <CardHeader titre={LIBELLES.role[r.role]} description={r.description} actions={<Badge tone={TON_ROLE[r.role]}>{pluriel(d.utilisateurs.filter((u) => u.role === r.role).length, 'compte')}</Badge>} className="mb-2" />
            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-(--lm-encre-2)">
              {r.acces.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
