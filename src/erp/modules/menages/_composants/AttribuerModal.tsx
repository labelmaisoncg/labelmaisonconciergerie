import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import { prestataireConforme } from '../../../data/selectors';
import type { Mission, TypePrestataire } from '../../../data/types';
import { Alert, Button, Field, Modal, Select } from '../../../ui';

interface Props {
  mission: Mission | null;
  onFermer: () => void;
  onSucces: (texte: string) => void;
}

const TYPE_ATTENDU: Record<Mission['type'], TypePrestataire[]> = {
  menage: ['menage'],
  controle: ['menage', 'autre'],
  linge: ['linge', 'menage'],
  maintenance: ['maintenance', 'serrurier', 'autre'],
};

/** Attribution d'une mission : la règle SPEC §2.3 est vérifiée par le store. */
export function AttribuerModal({ mission, onFermer, onSucces }: Props) {
  const { prestataires, logements, attribuerMission } = useErp();
  const [choix, setChoix] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = () => {
    setChoix('');
    setErreur(null);
    onFermer();
  };

  if (!mission) return null;
  const logement = logements.find((l) => l.id === mission.logementId);
  const candidats = prestataires
    .filter((p) => p.statut !== 'sorti')
    .map((p) => ({ p, verdict: prestataireConforme(p), adapte: TYPE_ATTENDU[mission.type].includes(p.type) }))
    .sort((a, b) => Number(b.verdict.ok) - Number(a.verdict.ok) || Number(b.adapte) - Number(a.adapte));
  const selection = candidats.find((c) => c.p.id === choix);

  const valider = () => {
    if (!choix) return setErreur('Choisissez un prestataire.');
    const r = attribuerMission(mission.id, choix);
    if (!r.ok) return setErreur(r.erreur);
    onSucces(`Mission attribuée à ${selection?.p.nom ?? 'ce prestataire'}.`);
    fermer();
  };

  return (
    <Modal
      ouvert
      onFermer={fermer}
      titre="Attribuer la mission"
      description={`${LIBELLES.typeMission[mission.type]} · ${logement?.nom ?? ''}`}
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>
            Annuler
          </Button>
          <Button variant="primary" onClick={valider}>
            Attribuer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Prestataire" requis aide="Seuls les prestataires en règle peuvent recevoir une mission.">
          <Select
            value={choix}
            placeholder="Choisir un prestataire"
            onChange={(e) => {
              setChoix(e.target.value);
              setErreur(null);
            }}
            options={candidats.map(({ p, verdict, adapte }) => ({
              valeur: p.id,
              libelle: `${p.nom} (${LIBELLES.typePrestataire[p.type]})${verdict.ok ? '' : ' · non conforme'}${adapte ? '' : ' · hors métier'}`,
            }))}
          />
        </Field>
        {selection && !selection.verdict.ok && !erreur && (
          <Alert tone="alerte" icone={<ShieldAlert />} titre="Contrat, RC Pro ou URSSAF manquant ou expiré">
            {selection.verdict.raisons.join(' ')} L’attribution sera refusée.
          </Alert>
        )}
        {erreur && (
          <Alert
            tone="danger"
            titre={selection && !selection.verdict.ok ? 'Attribution refusée : contrat, RC Pro ou URSSAF manquant ou expiré' : 'Attribution refusée'}
          >
            {erreur}
          </Alert>
        )}
        <p className="text-[12.5px] text-(--lm-encre-3)">
          Sous-traitance en cascade interdite : la personne qui intervient est le prestataire sous contrat ou son salarié déclaré.
        </p>
      </div>
    </Modal>
  );
}
