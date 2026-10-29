import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Check, Link2Off } from 'lucide-react';
import { espaceOuvert } from '../../data/espaces';
import { adresseRetour, demandeur, lireDemande } from '../../data/oauth-regles';
import { useErp } from '../../data/store';
import { Alert, Button, ButtonLink, Card, EmptyState } from '../../ui';
import { appelerConnecteur } from './_composants/api-connecteur';

const DROITS = [
  'Consulter logements, réservations, messages et chiffres (sans codes d’accès ni wifi)',
  'CRM : ajouter un contact, modifier une fiche, noter un appel',
  'Préparer une réponse à un voyageur, sans jamais l’envoyer, et classer une conversation « terminée »',
  'Rien n’est supprimé, et rien n’est jamais envoyé ni modifié sur les plateformes de réservation',
];

/** Écran plein, sans menu : tous les états sont centrés dans la même colonne. */
function Colonne({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-md pt-10 sm:pt-20">{children}</div>;
}

const OUVRIR_CRM = (
  <ButtonLink to="/erp/crm" variant="secondary">
    Ouvrir le CRM
  </ButtonLink>
);

/**
 * /erp/autoriser-claude : page d'autorisation OAuth ouverte par Claude quand
 * on connecte « Label Maison ». Le gérant accepte ou refuse ; Claude
 * reçoit alors un code (ou un refus) sur son adresse de retour.
 *
 * L'accès donné vaut pour l'espace ouvert, et lui seul : son nom est dans le
 * titre, et le serveur revérifie que la personne en est gérante (en-tête
 * x-erp-espace) avant de créer le code, rangé dans cet espace.
 */
export default function AutoriserClaude() {
  const [params] = useSearchParams();
  const { utilisateur, mode } = useErp();
  const nomEspace = espaceOuvert().nom;
  const lu = useMemo(() => lireDemande(Object.fromEntries(params)), [params]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  // Écran de consentement jamais affiché dans le cadre d'une autre page (détournement de clic).
  if (window.top !== window.self) {
    return (
      <Colonne>
        <EmptyState icone={<Link2Off />} titre="Ouvrez cette page dans son propre onglet" description="Par sécurité, l’autorisation ne s’affiche pas dans une autre page." />
      </Colonne>
    );
  }
  if (!lu.ok) {
    return (
      <Colonne>
        <EmptyState
          icone={<Link2Off />}
          titre="Lien de connexion invalide"
          description={'Relancez la connexion depuis Claude : Paramètres → Connecteurs.'}
          action={OUVRIR_CRM}
        />
      </Colonne>
    );
  }
  if (mode !== 'reel' || utilisateur.role !== 'gerant') {
    return (
      <Colonne>
        <EmptyState
          icone={<Bot />}
          titre="Connexion impossible ici"
          description={mode !== 'reel' ? 'Disponible avec vos données réelles.' : `Seul un gérant de l’espace ${nomEspace} peut connecter Claude.`}
          action={OUVRIR_CRM}
        />
      </Colonne>
    );
  }

  const { demande } = lu;
  const origine = demandeur(demande.redirect_uri);
  const autoriser = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      const r = await appelerConnecteur({ action: 'autoriser', ...Object.fromEntries(params) });
      if (!r.redirection) throw new Error('Réponse incomplète. Réessayez.');
      window.location.assign(r.redirection);
    } catch (e) {
      setErreur((e as Error).message);
      setEnvoi(false);
    }
  };
  const refuser = () => window.location.assign(adresseRetour(demande.redirect_uri, { error: 'access_denied', state: demande.state }));

  return (
    <Colonne>
      <Card>
        <div className="space-y-5">
          <div className="flex size-11 items-center justify-center rounded-full bg-(--lm-surface-2) text-(--lm-encre)">
            <Bot className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="lm-titre text-[24px] leading-tight text-(--lm-encre)">Connecter Claude à l’espace {nomEspace}&nbsp;?</h1>
            <p className="mt-1 text-[14px] text-(--lm-encre-2)">
              Demande venue de <span className="font-medium text-(--lm-encre)">{origine.hote}</span>. Claude ne verra que cet espace&nbsp;: ses logements,
              réservations, messages et son CRM.
            </p>
          </div>
          <ul className="space-y-2 text-[14px] text-(--lm-encre)">
            {DROITS.map((d) => (
              <li key={d} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-(--lm-succes)" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-(--lm-encre-2)">Pour retirer l’accès&nbsp;: CRM → Plus → Connecter à Claude → Déconnecter.</p>
          {origine.local && (
            <Alert tone="alerte" titre="Demande venue d’une application de cet ordinateur. N’autorisez que si vous venez de lancer la connexion depuis Claude Code." />
          )}
          {erreur && <Alert tone="danger" titre={erreur} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={envoi} onClick={refuser}>
              Refuser
            </Button>
            <Button variant="primary" chargement={envoi} onClick={() => void autoriser()}>
              Autoriser
            </Button>
          </div>
        </div>
      </Card>
    </Colonne>
  );
}
