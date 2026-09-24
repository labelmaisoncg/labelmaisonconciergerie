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
      <label htmlFor={id} className="text-[13px] font-medium text-(--lm-encre)">
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

const CHAMP =
  'w-full rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) px-3 text-[14px] text-(--lm-encre) placeholder:text-(--lm-encre-3) ' +
  'transition-[border-color,box-shadow] focus:border-(--lm-or) focus:ring-4 focus:ring-(--lm-or-lavis) focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-(--lm-surface-2) aria-[invalid=true]:border-(--lm-danger)';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(CHAMP, 'h-9', className)} {...rest} />;
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
      <select ref={ref} className={cn(CHAMP, 'h-9 appearance-none pr-8', className)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.valeur} value={o.valeur} disabled={o.desactive}>
            {o.libelle}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-(--lm-encre-3)" />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(CHAMP, 'py-2 leading-relaxed', className)} {...rest} />;
});
