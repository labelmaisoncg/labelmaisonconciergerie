import { Eye, FileSignature, Gift, Scale } from 'lucide-react';
import { Card, CardHeader } from '../../../ui';

const DECISIONS = [
  { icone: Scale, titre: 'Trancher un litige', texte: 'Casse contestée, caution, désaccord avec un voyageur ou un propriétaire.' },
  { icone: Gift, titre: 'Accorder un geste commercial', texte: 'Remboursement, réduction, nuit offerte : l’ERP et l’agent n’engagent jamais d’argent (SPEC §2.8).' },
  { icone: FileSignature, titre: 'Signer un mandat', texte: 'La relation propriétaire et l’engagement contractuel restent entre les mains d’Abdel.' },
  { icone: Eye, titre: 'Faire le contrôle physique', texte: 'L’ERP planifie le contrôle qualité, Kamel se rend sur place et note le ménage.' },
];

/** La philosophie rendue explicite : ce que l'ERP ne fera jamais seul. */
export function HumainSection() {
  return (
    <Card>
      <CardHeader titre="Ce qui reste humain" description="Tout le reste est automatique. Ces décisions demandent un jugement, une signature ou une présence." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {DECISIONS.map(({ icone: Icone, titre, texte }) => (
          <li key={titre} className="flex gap-3 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md bg-(--lm-or-lavis) text-(--lm-or) [&_svg]:size-4">
              <Icone />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-(--lm-encre)">{titre}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-(--lm-encre-2)">{texte}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
