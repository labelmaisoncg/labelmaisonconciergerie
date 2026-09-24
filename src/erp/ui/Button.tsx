import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export type VarianteBouton = 'primary' | 'secondary' | 'ghost' | 'danger';
export type TailleBouton = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBouton;
  size?: TailleBouton;
  icone?: ReactNode;
  iconeFin?: ReactNode;
  chargement?: boolean;
}

const VARIANTES: Record<VarianteBouton, string> = {
  primary: 'bg-(--lm-or) text-white hover:bg-(--lm-brun) shadow-sm',
  secondary: 'bg-(--lm-surface) text-(--lm-encre) border border-(--lm-bord-fort) hover:bg-(--lm-surface-2)',
  ghost: 'bg-transparent text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis) hover:text-(--lm-encre)',
  danger: 'bg-(--lm-danger) text-white hover:brightness-95 shadow-sm',
};

const TAILLES: Record<TailleBouton, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icone, iconeFin, chargement, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4',
        VARIANTES[variant],
        TAILLES[size],
        className,
      )}
      {...rest}
    >
      {chargement ? <Loader2 className="animate-spin" aria-hidden /> : icone}
      {children}
      {iconeFin}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'icone' | 'iconeFin' | 'children'> {
  /** Libellé accessible obligatoire (pas de texte visible). */
  label: string;
  children: ReactNode;
}

/** Bouton carré ne contenant qu'une icône. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', className, children, ...rest },
  ref,
) {
  const carre = { sm: 'w-8 px-0', md: 'w-9 px-0', lg: 'w-11 px-0' }[size];
  return (
    <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} className={cn(carre, className)} {...rest}>
      {children}
    </Button>
  );
});
