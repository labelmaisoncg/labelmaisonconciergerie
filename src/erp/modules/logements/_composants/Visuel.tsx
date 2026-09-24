import { cn } from '../../../ui';
import { initiales } from '../../../data/format';
import type { Logement } from '../../../data/types';

const DEGRADES = [
  'linear-gradient(135deg,#F5ECDD 0%,#DCC296 55%,#A97C30 100%)',
  'linear-gradient(140deg,#F1EBE1 0%,#CDBEA3 55%,#6E5A3A 100%)',
  'linear-gradient(130deg,#F8F3EA 0%,#E6D3AE 50%,#C39A4A 100%)',
  'linear-gradient(150deg,#ECE6DC 0%,#BDB09A 60%,#403118 100%)',
  'linear-gradient(160deg,#F4EDE2 0%,#D9C29A 45%,#8C6A2E 100%)',
];

function teinte(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DEGRADES[h % DEGRADES.length];
}

/** Visuel d'un logement : photo réelle, sinon aplat dégradé ivoire et or avec initiales. */
export function VisuelLogement({ logement, className, taille = 'md' }: { logement: Logement; className?: string; taille?: 'sm' | 'md' }) {
  const reelle = logement.photoUrl && !logement.photoUrl.startsWith('demo://');
  if (reelle) {
    return <img src={logement.photoUrl} alt={logement.nom} loading="lazy" className={cn('object-cover', className)} />;
  }
  return (
    <div
      role="img"
      aria-label={`Visuel de ${logement.nom}`}
      className={cn('relative grid place-items-center overflow-hidden', className)}
      style={{ backgroundImage: teinte(logement.id) }}
    >
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 15%, rgba(255,255,255,.55), transparent 45%)' }}
      />
      <span
        aria-hidden
        className={cn('lm-serif relative text-white/95 drop-shadow-[0_1px_6px_rgba(64,49,24,.35)]', taille === 'sm' ? 'text-[15px]' : 'text-[34px]')}
      >
        {initiales(logement.nom)}
      </span>
    </div>
  );
}
