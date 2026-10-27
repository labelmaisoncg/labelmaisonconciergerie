/**
 * Premier écran d'une conciergerie invitée par Label Maison : le compte est
 * connecté, adresse confirmée, sans espace encore, avec une invitation en
 * attente (erp.qui_suis_je → invitations_espace). Un seul champ, le nom,
 * prérempli ; « Créer l'espace » appelle erp.creer_espace : la personne en
 * devient gérante et l'ERP s'ouvre dans ce nouvel espace, vide, avec ses
 * premiers pas (Repull, équipe, propriétaires, agent).
 *
 * Aucun accès au store ici : l'écran s'affiche avant que les données existent.
 */
import { useState, type FormEvent } from 'react';
import { LogOut, Sparkles } from 'lucide-react';
import { creerEspace } from '../data/supabase';
import type { Espace, InvitationEspace } from '../data/espaces';
import { dateCourte } from '../data/format';
import { Alert, Button, Field, Input } from '../ui';

interface Props {
  email: string;
  invitation: InvitationEspace;
  /** Espace créé (ou déjà créé par un essai précédent) : l'ouvrir. */
  onCree: (espace: Espace) => void;
  onDeconnecter: () => void;
}

export function CreerEspace({ email, invitation, onCree, onDeconnecter }: Props) {
  const [nom, setNom] = useState(invitation.nom);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    if (enCours) return;
    if (!nom.trim()) return setErreur('Donnez le nom de votre conciergerie.');
    setEnCours(true);
    setErreur(undefined);
    const r = await creerEspace(nom);
    if (!r.ok) {
      setEnCours(false);
      return setErreur(r.erreur);
    }
    onCree(r.espace);
  };

  const fin = invitation.expireLe ? dateCourte(invitation.expireLe.slice(0, 10)) : '';

  return (
    <main translate="no" className="flex min-h-screen items-center justify-center bg-(--lm-fond) px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-(--lm-bord) bg-(--lm-surface) p-6 shadow-(--lm-ombre) sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            <span aria-hidden className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-[18px]">
              <Sparkles />
            </span>
            <div className="min-w-0">
              <h1 className="lm-serif text-[24px] leading-tight text-(--lm-encre)">Créez l’espace de votre conciergerie</h1>
              <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">
                Vos logements, réservations, messages et équipes, rien qu’à vous. Vous en serez le gérant.
              </p>
            </div>
          </div>
          <form onSubmit={creer} noValidate className="grid gap-4">
            <Field label="Nom de votre conciergerie" aide="Il apparaît pour votre équipe, vos propriétaires et dans la signature de l’agent.">
              <Input value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} autoFocus autoComplete="organization" />
            </Field>
            {erreur && (
              <Alert tone="danger" className="py-2">
                {erreur}
              </Alert>
            )}
            <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<Sparkles />}>
              Créer l’espace
            </Button>
          </form>
          <p className="mt-4 text-[12.5px] text-(--lm-encre-2)">
            Invitation pour <strong className="break-all text-(--lm-encre)">{email}</strong>
            {fin ? `, valable jusqu’au ${fin}.` : '.'}
          </p>
          <button
            type="button"
            onClick={onDeconnecter}
            className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-[13px] font-medium text-(--lm-encre-2) hover:text-(--lm-encre) hover:underline"
          >
            <LogOut className="size-4" aria-hidden />
            Ce n’est pas moi : se déconnecter
          </button>
        </div>
      </div>
    </main>
  );
}
