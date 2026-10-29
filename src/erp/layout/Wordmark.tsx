import { Link } from 'react-router-dom';
import { espaceOuvert } from '../data/espaces';
import { cn } from '../ui';

/** Initiales d'un nom d'espace : « Label Maison » → « LM », « Sens » → « S ». */
const initiales = (nom: string) =>
  nom
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]!.toLocaleUpperCase('fr'))
    .join('') || 'ERP';

/** Marque de la barre latérale, au nom de l'espace ouvert (« LABEL MAISON · ERP », « SENS · ERP »). */
export function Wordmark({ className }: { className?: string }) {
  const nom = espaceOuvert().nom;
  return (
    <Link to="/erp" className={cn('group flex items-center gap-2.5', className)} aria-label={`ERP ${nom}, tableau de bord`}>
      <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-(--lm-brun) text-[13px] font-semibold text-(--lm-sur-brun)">
        {initiales(nom)}
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-[11.5px] font-semibold tracking-[0.18em] text-(--lm-or-texte) [font-variant:small-caps]">{nom}</span>
        <span className="lm-titre mt-1 text-[17px] text-(--lm-encre)">ERP</span>
      </span>
    </Link>
  );
}
