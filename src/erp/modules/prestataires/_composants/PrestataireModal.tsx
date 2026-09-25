import { useState } from 'react';
import { LIBELLES } from '../../../data/libelles';
import { nouvelId, useErp } from '../../../data/store';
import type { Prestataire, TypePrestataire } from '../../../data/types';
import { Alert, Button, Field, Input, Modal, Select } from '../../../ui';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (p: Prestataire) => void;
}

const VIDE = { nom: '', raisonSociale: '', siret: '', type: 'menage' as TypePrestataire, telephone: '', email: '', zone: '', sansCascade: false };

/** Création d'un prestataire : il reste non conforme tant que ses documents ne sont pas déposés. */
export function PrestataireModal({ ouvert, onFermer, onCree }: Props) {
  const { upsert } = useErp();
  const [f, setF] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof typeof VIDE, string>>>({});
  const maj = <K extends keyof typeof VIDE>(k: K, v: (typeof VIDE)[K]) => setF((x) => ({ ...x, [k]: v }));

  const fermer = () => {
    setF(VIDE);
    setErreurs({});
    onFermer();
  };

  const creer = () => {
    const e: typeof erreurs = {};
    const siret = f.siret.replace(/\s/g, '');
    if (f.nom.trim().length < 2) e.nom = 'Nom obligatoire.';
    if (!/^\d{14}$/.test(siret)) e.siret = 'Le SIRET compte 14 chiffres : pas de prestataire non déclaré.';
    if (!/^[+\d][\d\s.]{8,}$/.test(f.telephone.trim())) e.telephone = 'Téléphone invalide.';
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Adresse e-mail invalide.';
    if (!f.zone.trim()) e.zone = 'Indiquez au moins une ville.';
    if (!f.sansCascade) e.sansCascade = 'Engagement obligatoire.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    const p: Prestataire = {
      id: nouvelId('pre'),
      nom: f.nom.trim(),
      raisonSociale: f.raisonSociale.trim() || undefined,
      siret,
      type: f.type,
      telephone: f.telephone.trim(),
      email: f.email.trim() || undefined,
      zone: f.zone.split(',').map((v) => v.trim()).filter(Boolean),
      statut: 'actif',
      tarifs: [],
      documents: (['contrat', 'rc_pro', 'urssaf', 'kbis'] as const).map((type) => ({ type, statut: 'manquant' as const })),
      missionsRealisees: 0,
    };
    upsert('prestataires', p);
    onCree(p);
    fermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      taille="lg"
      titre="Ajouter un prestataire"
      description="Vous pourrez lui confier des ménages dès que son contrat, son assurance (RC Pro) et son attestation URSSAF seront déposés."
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>Annuler</Button>
          <Button variant="primary" onClick={creer}>Créer le prestataire</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom de l’intervenant" requis erreur={erreurs.nom}>
          <Input value={f.nom} onChange={(e) => maj('nom', e.target.value)} />
        </Field>
        <Field label="Raison sociale">
          <Input value={f.raisonSociale} onChange={(e) => maj('raisonSociale', e.target.value)} />
        </Field>
        <Field label="SIRET" requis erreur={erreurs.siret}>
          <Input inputMode="numeric" value={f.siret} onChange={(e) => maj('siret', e.target.value)} placeholder="14 chiffres" />
        </Field>
        <Field label="Métier" requis>
          <Select value={f.type} onChange={(e) => maj('type', e.target.value as TypePrestataire)} options={(Object.keys(LIBELLES.typePrestataire) as TypePrestataire[]).map((t) => ({ valeur: t, libelle: LIBELLES.typePrestataire[t] }))} />
        </Field>
        <Field label="Téléphone" requis erreur={erreurs.telephone}>
          <Input type="tel" value={f.telephone} onChange={(e) => maj('telephone', e.target.value)} />
        </Field>
        <Field label="E-mail" erreur={erreurs.email}>
          <Input type="email" value={f.email} onChange={(e) => maj('email', e.target.value)} />
        </Field>
        <Field label="Zone d’intervention" requis aide="Villes séparées par des virgules." erreur={erreurs.zone} className="sm:col-span-2">
          <Input value={f.zone} onChange={(e) => maj('zone', e.target.value)} placeholder="Corbeil-Essonnes, Évry-Courcouronnes" />
        </Field>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-(--lm-or)" checked={f.sansCascade} onChange={(e) => maj('sansCascade', e.target.checked)} />
            <span>
              Le prestataire intervient lui-même ou avec ses salariés déclarés. Il s’engage à ne pas sous-traiter, et le linge n’est jamais lavé à son domicile.
            </span>
          </label>
          {erreurs.sansCascade && <p role="alert" className="mt-1 text-[12px] font-medium text-(--lm-danger)">{erreurs.sansCascade}</p>}
        </div>
        <Alert tone="info" className="sm:col-span-2">Ajoutez ensuite ses documents et ses tarifs depuis sa fiche.</Alert>
      </div>
    </Modal>
  );
}
