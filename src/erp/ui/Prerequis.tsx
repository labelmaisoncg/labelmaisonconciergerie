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

/** Formulaire impossible à remplir tant qu'une donnée de base manque (base vide) : on dit quoi faire. */
export function Prerequis({ manque, detail, lien, action, className }: PrerequisProps) {
  return (
    <Alert
      tone="info"
      titre={manque}
      className={className}
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
