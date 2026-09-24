import type { ReactNode } from 'react';
import { Bot, CalendarSync, Database, Mail, Send } from 'lucide-react';
import { Badge, Card, type Ton } from '../../ui';

interface Integration {
  nom: string;
  role: string;
  icone: ReactNode;
  etat: string;
  ton: Ton;
  besoin: string;
  details?: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    nom: 'Channex',
    role: 'Channel manager : réservations, calendrier et messagerie Airbnb et Booking.com.',
    icone: <CalendarSync />,
    etat: 'Certification en cours',
    ton: 'alerte',
    besoin:
      'Compte production à ouvrir : environ 140 $ par mois pour 10 logements (130 $ de socle + 0,50 $ par logement + module messagerie 0,50 $ par logement), certification en cours.',
    details: ['Relier chaque logement (channexPropertyId)', 'Webhooks réservations et messages vers l’ERP'],
  },
  {
    nom: 'Anthropic',
    role: 'Agent IA de la messagerie voyageurs. N’engage jamais d’argent : remboursements et gestes commerciaux restent humains.',
    icone: <Bot />,
    etat: 'Crédits épuisés',
    ton: 'danger',
    besoin: 'Crédits à recharger (solde 0 $), plafond 50 $/mois conseillé.',
    details: ['Clé API côté serveur uniquement', 'Plafond de dépense mensuel dans la console'],
  },
  {
    nom: 'Supabase',
    role: 'Base de données, authentification et fichiers de l’ERP.',
    icone: <Database />,
    etat: 'À créer',
    ton: 'alerte',
    besoin: 'Projet à créer (région UE), appliquer supabase/migrations.',
    details: ['Renseigner VITE_SUPABASE_URL et la clé publique', 'Tant que ce n’est pas fait, l’ERP tourne en mode démo'],
  },
  {
    nom: 'Resend',
    role: 'Envoi des e-mails transactionnels.',
    icone: <Mail />,
    etat: 'Actif',
    ton: 'succes',
    besoin: 'Actif (formulaires du site).',
    details: ['Prochaine étape : envoi des relevés propriétaires'],
  },
  {
    nom: 'Telegram',
    role: 'Alertes internes à l’équipe (nouveaux contacts, incidents).',
    icone: <Send />,
    etat: 'Configuré',
    ton: 'succes',
    besoin: 'Bot configuré.',
  },
];

export default function Integrations() {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {INTEGRATIONS.map((i) => (
        <li key={i.nom}>
          <Card className="flex h-full flex-col">
            <div className="flex items-start gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-brun) [&_svg]:size-[18px]">
                {i.icone}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{i.nom}</h3>
                  <Badge tone={i.ton} point>
                    {i.etat}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">{i.role}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-(--lm-surface-2) px-3 py-2 text-[13px]">
              <p className="text-[11.5px] font-medium tracking-wide text-(--lm-encre-3) uppercase">Pour passer en production</p>
              <p className="mt-0.5">{i.besoin}</p>
            </div>
            {i.details && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12.5px] text-(--lm-encre-2)">
                {i.details.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
