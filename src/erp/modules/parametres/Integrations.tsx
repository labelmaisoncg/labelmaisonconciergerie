import type { ReactNode } from 'react';
import { Bot, Database, Mail, Send } from 'lucide-react';
import { useErp } from '../../data/store';
import { Badge, Card, type Ton } from '../../ui';
import { CarteSynchroRepull } from './SynchroRepull';

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
    nom: 'Anthropic',
    role: 'Le « cerveau » de votre agent de messagerie. Il ne promet jamais d’argent : remboursements et gestes commerciaux restent à vous.',
    icone: <Bot />,
    etat: 'Crédits épuisés',
    ton: 'danger',
    besoin: 'Il faut recharger des crédits (solde : 0 $). Conseil : un plafond de 50 $ par mois.',
    details: ['Clé API côté serveur uniquement', 'Plafond de dépense mensuel dans la console'],
  },
  {
    nom: 'Supabase',
    role: 'L’endroit où sont gardées vos données, vos comptes et vos photos.',
    icone: <Database />,
    etat: 'Démo locale',
    ton: 'neutre',
    besoin: 'En production, l’ERP utilise la base Supabase de Label Maison (supabase/erp-installation.sql).',
    details: ['Mode démo : développement local uniquement (VITE_ERP_DEMO=1)'],
  },
  {
    nom: 'Resend',
    role: 'L’envoi des e-mails automatiques.',
    icone: <Mail />,
    etat: 'Actif',
    ton: 'succes',
    besoin: 'Actif (formulaires du site).',
    details: ['Piste : envoyer aussi les relevés propriétaires'],
  },
  {
    nom: 'Telegram',
    role: 'Les alertes envoyées à l’équipe sur Telegram.',
    icone: <Send />,
    etat: 'Configuré',
    ton: 'succes',
    besoin: 'Bot configuré.',
  },
];

/** Supabase en production : la base est branchée, l'état vient de la synchronisation. */
const SUPABASE_REEL: Integration = {
  nom: 'Supabase',
  role: 'L’endroit où sont gardées vos données, les comptes de l’équipe et les photos.',
  icone: <Database />,
  etat: 'Connectée',
  ton: 'succes',
  besoin: 'Tout fonctionne : chaque changement est enregistré tout de suite et visible par toute l’équipe.',
  details: ['Accès par compte individuel (e-mail et mot de passe)', 'Droits appliqués par la base (règles RLS)', 'Historique de chaque version (erp.historique)'],
};

export default function Integrations() {
  const { mode, synchro } = useErp();
  const liste = INTEGRATIONS.map((i) => {
    if (i.nom !== 'Supabase' || mode !== 'reel') return i;
    if (synchro && !synchro.enLigne) return { ...SUPABASE_REEL, etat: 'Hors ligne', ton: 'alerte' as Ton };
    if (synchro?.statut === 'erreur') return { ...SUPABASE_REEL, etat: 'Enregistrement en échec', ton: 'danger' as Ton };
    return SUPABASE_REEL;
  });
  return (
    <>
      <div className="mb-4">
        <CarteSynchroRepull />
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {liste.map((i) => (
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
                <p className="text-[11.5px] font-medium tracking-wide text-(--lm-encre-3) uppercase">{i.ton === 'succes' ? 'État' : 'Pour passer en production'}</p>
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
    </>
  );
}
