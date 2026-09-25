import { useState } from 'react';
import { useErp } from '../../../data/store';
import type { Mission } from '../../../data/types';
import { Alert, Button, Field, Modal, Textarea } from '../../../ui';

interface Props {
  mission: Mission | null;
  onFermer: () => void;
  onSucces: (texte: string) => void;
}

/** Refus d'une mission : commentaire obligatoire, la mission n'est pas payée. */
export function RefuserModal({ mission, onFermer, onSucces }: Props) {
  const { refuserMission } = useErp();
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  const fermer = () => {
    setCommentaire('');
    setErreur(null);
    onFermer();
  };
  if (!mission) return null;

  const valider = () => {
    const texte = commentaire.trim();
    if (texte.length < 10) return setErreur('Décrivez le motif du refus (10 caractères minimum).');
    const r = refuserMission(mission.id, texte);
    if (!r.ok) return setErreur(r.erreur);
    onSucces('Mission refusée. Elle ne sera pas payée ; un repassage peut être demandé.');
    fermer();
  };

  return (
    <Modal
      ouvert
      onFermer={fermer}
      titre="Refuser ce ménage"
      description="Expliquez pourquoi : le prestataire recevra votre message, et il sera gardé en mémoire."
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>
            Annuler
          </Button>
          <Button variant="danger" onClick={valider}>
            Refuser ce ménage
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Motif du refus" requis erreur={erreur}>
          <Textarea
            rows={4}
            value={commentaire}
            placeholder="Ex. salle de bain non faite, linge d’un autre logement, photos floues..."
            onChange={(e) => {
              setCommentaire(e.target.value);
              setErreur(null);
            }}
          />
        </Field>
        <Alert tone="info">Pas de validation, pas de paiement (règle 2.4). Une mission refusée est exclue du prochain paiement.</Alert>
      </div>
    </Modal>
  );
}
