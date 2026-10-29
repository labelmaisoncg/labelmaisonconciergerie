import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
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

/*
 * Boutons à la manière d'Airbnb, avec nos couleurs : le principal en aplat or
 * (--lm-or-texte, AA avec le texte blanc), le secondaire blanc bordé d'encre,
 * le tertiaire en texte à l'encre souligné au survol (« lm-tertiaire » : il
 * est souligné d'office dans le pied des fenêtres). Tous à plat, 8 px.
 */
const VARIANTES: Record<VarianteBouton, string> = {
  // Action principale : 44 px au moins sur téléphone, quelle que soit la taille.
  primary: 'bg-(--lm-or-texte) text-white hover:bg-(--lm-brun) active:bg-(--lm-brun) max-sm:min-h-11',
  secondary: 'bg-(--lm-surface) text-(--lm-encre) border border-(--lm-encre) hover:bg-(--lm-surface-2) active:bg-(--lm-surface-2)',
  ghost: 'lm-tertiaire bg-transparent text-(--lm-encre) underline-offset-[3px] hover:underline active:bg-(--lm-surface-2)',
  danger: 'bg-(--lm-danger) text-white hover:brightness-95',
};

/** Hauteurs d'Airbnb : 32, 40 et 48 px. */
const TAILLES: Record<TailleBouton, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-[14px] gap-2',
  lg: 'h-12 px-6 text-[16px] gap-2',
};

/** Classes d'un bouton, pour styler un autre élément (lien) à l'identique. */
export function classesBouton(variant: VarianteBouton = 'secondary', size: TailleBouton = 'md', className?: string): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4 [&_svg]:stroke-2',
    VARIANTES[variant],
    TAILLES[size],
    className,
  );
}

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
      className={classesBouton(variant, size, className)}
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

/**
 * Bouton rond ne contenant qu'une icône, signature d'Airbnb (retour, fermer,
 * partager) : sur fond gris clair (« ghost », par défaut) ou blanc bordé
 * (« secondary »). Les autres variantes gardent leur aplat, en rond.
 */
const ICONE_RONDE: Partial<Record<VarianteBouton, string>> = {
  ghost: 'bg-(--lm-surface-2) text-(--lm-encre) no-underline hover:bg-(--lm-neutre-lavis) hover:no-underline',
  secondary: 'border-(--lm-bord-fort) hover:border-(--lm-encre) hover:bg-(--lm-surface)',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', className, children, ...rest },
  ref,
) {
  const rond = { sm: 'size-8 px-0', md: 'size-10 px-0', lg: 'size-12 px-0' }[size];
  return (
    <Button ref={ref} variant={variant} size={size} aria-label={label} title={label} className={cn(rond, 'rounded-full', ICONE_RONDE[variant], className)} {...rest}>
      {children}
    </Button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  variant?: VarianteBouton;
  size?: TailleBouton;
  icone?: ReactNode;
}

/** Lien de navigation présenté comme un bouton. */
export function ButtonLink({ variant = 'secondary', size = 'md', icone, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classesBouton(variant, size, typeof className === 'string' ? className : undefined)} {...rest}>
      {icone}
      {children}
    </Link>
  );
}
