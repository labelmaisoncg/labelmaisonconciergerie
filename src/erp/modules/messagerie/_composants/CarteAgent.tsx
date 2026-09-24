/** Carte d'état de l'agent IA et rappel repliable de ses règles. */
import { useState } from 'react';
import { Bot, ChevronDown, ScrollText } from 'lucide-react';
import { Badge, Card, cn } from '../../../ui';
import { nombre } from '../../../data/format';
import type { FilMessages } from '../../../data/types';
import { formatDelai, statsAgent } from './logique';

export function CarteAgent({ fils }: { fils: FilMessages[] }) {
  const s = statsAgent(fils);
  return (
    <Card className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-start gap-3 lg:flex-1">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or)">
          <Bot className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-(--lm-encre)">
            Agent IA : en attente d’activation
            <Badge tone="alerte" point>
              Inactif
            </Badge>
          </p>
          <p className="text-[13px] text-(--lm-encre-2)">
            Channex (Messaging &amp; Reviews) et crédits Anthropic requis. Une fois actif, il répond en autonomie et copie chaque réponse au propriétaire sur Telegram.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:shrink-0">
        <Chiffre libelle="Réponses auto 7 j" valeur={nombre(s.reponsesAuto)} />
        <Chiffre libelle="Escalades en cours" valeur={nombre(s.escalades)} alerte={s.escalades > 0} />
        <Chiffre libelle="À traiter" valeur={nombre(s.aTraiter)} alerte={s.aTraiter > 0} />
        <Chiffre libelle="Délai médian" valeur={formatDelai(s.delaiMedianMinutes)} />
      </dl>
    </Card>
  );
}

function Chiffre({ libelle, valeur, alerte }: { libelle: string; valeur: string; alerte?: boolean }) {
  return (
    <div className="rounded-lg bg-(--lm-surface-2) px-3 py-2 lg:min-w-[112px]">
      <dt className="text-[11.5px] text-(--lm-encre-3)">{libelle}</dt>
      <dd className={cn('lm-chiffres text-[18px] font-semibold', alerte ? 'text-(--lm-danger)' : 'text-(--lm-encre)')}>{valeur}</dd>
    </div>
  );
}

const REGLES = [
  ['N’invente rien', 'Si l’information n’est pas dans la fiche logement, il dit qu’il vérifie et escalade.'],
  ['N’engage jamais d’argent', 'Remboursement, remise, supplément, geste commercial : décision humaine.'],
  ['Escalade litiges et dérogations', 'Plainte, conflit, arrivée anticipée, départ tardif : passage à l’équipe.'],
  ['Répond dans la langue du voyageur', 'La réponse suit la langue du dernier message reçu.'],
  ['Codes seulement aux voyageurs confirmés', 'Réservation confirmée sur ce logement, arrivée sous 48 h ou séjour en cours. Jamais pour une simple demande.'],
] as const;

export function ReglesAgent() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Card flush className="mb-4">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls="regles-agent"
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-medium text-(--lm-encre)"
      >
        <ScrollText className="size-4 text-(--lm-or)" aria-hidden />
        Règles de l’agent IA
        <span className="text-[12.5px] font-normal text-(--lm-encre-3)">(elles s’appliquent aussi à l’équipe)</span>
        <ChevronDown className={cn('ml-auto size-4 text-(--lm-encre-3) transition-transform', ouvert && 'rotate-180')} aria-hidden />
      </button>
      {ouvert && (
        <ol id="regles-agent" className="grid gap-3 border-t border-(--lm-bord) px-4 py-3 sm:grid-cols-2 lg:grid-cols-5">
          {REGLES.map(([titre, detail], i) => (
            <li key={titre} className="text-[13px]">
              <p className="font-semibold text-(--lm-encre)">
                <span className="lm-chiffres mr-1 text-(--lm-or)">{i + 1}.</span>
                {titre}
              </p>
              <p className="mt-0.5 text-(--lm-encre-2)">{detail}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
