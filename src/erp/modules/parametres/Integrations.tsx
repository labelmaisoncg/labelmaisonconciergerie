import type { ReactNode } from 'react';
import { Bot, Database, Mail, Send } from 'lucide-react';
import { useErp } from '../../data/store';
import { Badge, Card, Repli, type Ton } from '../../ui';
import { CarteSynchroRepull } from './SynchroRepull';

interface Integration {
  /** Fournisseur : affiché seulement dans « Avancé ». */
  nom: string;
  /** Ce que fait le service, en mots simples : le titre de la carte. */
  titre: string;
  role: string;
  icone: ReactNode;
  etat: string;
  ton: Ton;
  besoin?: string;
  details?: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    nom: 'Anthropic',
    titre: 'Agent de messagerie',
    role: 'Le « cerveau » de votre agent de messagerie. Il ne promet jamais d’argent : remboursements et gestes commerciaux restent à vous.',
    icone: <Bot />,
    etat: 'Crédits épuisés',
    ton: 'danger',
    besoin: 'Rechargez des crédits pour que l’agent réponde.',
    details: ['Solde : 0 $. Conseil : un plafond de 50 $ par mois', 'Clé API côté serveur uniquement', 'Plafond de dépense mensuel dans la console'],
  },
  {
    nom: 'Supabase',
    titre: 'Vos données',
    role: 'L’endroit où sont gardées vos données, vos comptes et vos photos.',
    icone: <Database />,
    etat: 'Démo locale',
    ton: 'neutre',
    besoin: 'Données de démonstration, dans ce navigateur.',
    details: ['En production, l’ERP utilise la base Supabase de Label Maison (supabase/erp-installation.sql)', 'Mode démo : développement local uniquement (VITE_ERP_DEMO=1)'],
  },
  {
    nom: 'Resend',
    titre: 'E-mails automatiques',
    role: 'L’envoi des e-mails automatiques.',
    icone: <Mail />,
    etat: 'Actif',
    ton: 'succes',
    besoin: 'Pour les formulaires du site.',
    details: ['Piste : envoyer aussi les relevés propriétaires'],
  },
  {
    nom: 'Telegram',
    titre: 'Alertes de l’équipe',
    role: 'Les alertes envoyées à l’équipe sur Telegram.',
    icone: <Send />,
    etat: 'Configuré',
    ton: 'succes',
  },
];

/** Supabase en production : la base est branchée, l'état vient de la synchronisation. */
const SUPABASE_REEL: Integration = {
  nom: 'Supabase',
  titre: 'Vos données',
  role: 'L’endroit où sont gardées vos données, les comptes de l’équipe et les photos.',
  icone: <Database />,
  etat: 'Connectée',
  ton: 'succes',
  besoin: 'Chaque changement est enregistré tout de suite et visible par toute l’équipe.',
  details: ['Accès par compte individuel (e-mail et mot de passe)', 'Droits appliqués par la base (règles RLS)', 'Historique de chaque version (erp.historique)'],
};

export default function Integrations() {
  const { mode, synchro, utilisateur } = useErp();
  const gerant = utilisateur.role === 'gerant';
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
                    <h3 className="text-[15px] font-semibold">{i.titre}</h3>
                    <Badge tone={i.ton} point>
                      {i.etat}
                    </Badge>
                  </div>
                  {i.besoin && <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">{i.besoin}</p>}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {gerant && (
        <Repli
          className="mt-4"
          titre="Avancé"
          description="Détails techniques, pour la personne qui gère le site."
        >
          <ul className="space-y-2 text-[13px]">
            {liste.map((i) => (
              <li key={i.nom}>
                <p className="font-medium text-(--lm-encre)">
                  {i.titre} : {i.nom}
                </p>
                <p className="text-[12.5px] text-(--lm-encre-2)">{i.role}</p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-[12.5px] text-(--lm-encre-2)">
                  {(i.details ?? []).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Repli>
      )}
    </>
  );
}
