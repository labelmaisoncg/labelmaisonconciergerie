import { ArrowRight } from 'lucide-react';
import { Alert } from './Alert';
import { ButtonLink } from './Button';

export interface PrerequisProps {
  /** Ce qui manque, en une phrase. */
  manque: string;
  detail?: string;
  lien: string;
  action: string;
  className?: string;
}

/**
 * Formulaire impossible à remplir tant qu'une donnée de base manque (base vide) : on dit quoi faire.
 * Toujours dans une fenêtre : sur téléphone, le bouton passe sous le texte (à côté, il élargissait
 * la feuille, qui glissait alors sur le côté).
 */
export function Prerequis({ manque, detail, lien, action, className }: PrerequisProps) {
  return (
    <Alert
      tone="info"
      titre={manque}
      className={className}
      actionsDessous
      actions={
        <ButtonLink to={lien} size="sm" variant="primary" icone={<ArrowRight />}>
          {action}
        </ButtonLink>
      }
    >
      {detail}
    </Alert>
  );
}
