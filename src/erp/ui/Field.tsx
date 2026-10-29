import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface FieldProps {
  label: ReactNode;
  /** Un seul contrôle : il reçoit id, aria-describedby et aria-invalid. */
  children: ReactElement;
  aide?: ReactNode;
  erreur?: ReactNode;
  requis?: boolean;
  className?: string;
}

/** Champ de formulaire : libellé relié au contrôle, aide et erreur annoncées. */
export function Field({ label, children, aide, erreur, requis, className }: FieldProps) {
  const auto = useId();
  const enfant = isValidElement<{ id?: string }>(children) ? children : null;
  const id = enfant?.props.id ?? auto;
  const aideId = aide ? `${id}-aide` : undefined;
  const erreurId = erreur ? `${id}-erreur` : undefined;
  const decrit = [aideId, erreurId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-semibold text-(--lm-encre)">
        {label}
        {requis && (
          <span aria-hidden className="ml-0.5 text-(--lm-danger)">
            *
          </span>
        )}
      </label>
      {enfant
        ? cloneElement(enfant as ReactElement<Record<string, unknown>>, {
            id,
            'aria-describedby': decrit,
            'aria-invalid': erreur ? true : undefined,
            required: requis || undefined,
          })
        : children}
      {aide && !erreur && (
        <p id={aideId} className="text-[12px] text-(--lm-encre-3)">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={erreurId} role="alert" className="text-[12px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
      )}
    </div>
  );
}

/*
 * Champ à la manière d'Airbnb : filet d'1 px, 8 px d'arrondi, 44 px de haut.
 * Au focus, le bord passe à 2 px d'encre (le second pixel est une ombre
 * intérieure : rien ne bouge), sans halo : bien visible au clavier.
 */
const CHAMP =
  'w-full rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) px-3.5 text-[15px] text-(--lm-encre) placeholder:text-(--lm-encre-3) ' +
  'transition-[border-color,box-shadow] hover:border-(--lm-encre-3) focus:border-(--lm-encre) focus:shadow-[inset_0_0_0_1px_var(--lm-encre)] focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-(--lm-surface-2) aria-[invalid=true]:border-(--lm-danger) aria-[invalid=true]:focus:shadow-[inset_0_0_0_1px_var(--lm-danger)]';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CHAMP, 'h-11', className)} {...rest} />;
});

export interface OptionSelect {
  valeur: string;
  libelle: string;
  desactive?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: OptionSelect[];
  /** Option vide en tête, ex. « Choisir... ». */
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(CHAMP, 'h-11 appearance-none pr-9', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.valeur} value={o.valeur} disabled={o.desactive}>
            {o.libelle}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-(--lm-encre)" />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(CHAMP, 'py-2.5 leading-relaxed', className)} {...rest} />;
});
