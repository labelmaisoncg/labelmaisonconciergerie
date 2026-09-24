import { Plus } from 'lucide-react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import type { Prospect } from '../../../data/types';
import { Button, Modal } from '../../../ui';
import { FormProspect, brouillonDe, versProspect } from './FormProspect';

/** Modal de création d'un prospect, éventuellement pré-rempli (simulateur). */
export function NouveauProspect({
  ouvert,
  onFermer,
  initial,
  onCree,
}: {
  ouvert: boolean;
  onFermer: () => void;
  initial?: Partial<Prospect>;
  onCree: (p: Prospect) => void;
}) {
  const { upsert } = useErp();
  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      taille="lg"
      titre="Nouveau prospect"
      description="Un propriétaire intéressé par la gestion de son bien. Il entre dans le pipeline à l’étape choisie."
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="nouveau-prospect" icone={<Plus />}>
            Créer le prospect
          </Button>
        </>
      }
    >
      {ouvert && (
        <FormProspect
          id="nouveau-prospect"
          initial={brouillonDe({ prochaineAction: 'Premier appel de qualification', prochaineActionLe: AUJOURDHUI, ...initial })}
          onValide={(b) => {
            const p = versProspect(b, { id: nouvelId('pst'), creeLe: AUJOURDHUI });
            upsert('prospects', p);
            onCree(p);
          }}
        />
      )}
    </Modal>
  );
}
