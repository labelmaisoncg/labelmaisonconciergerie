import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Check, Link2Off } from 'lucide-react';
import { adresseRetour, demandeur, lireDemande } from '../../data/oauth-regles';
import { useErp } from '../../data/store';
import { Alert, Button, ButtonLink, Card, EmptyState } from '../../ui';
import { appelerConnecteur } from './_composants/api-connecteur';

const DROITS = ['Consulter les contacts et leur historique', 'Ajouter un contact, modifier une fiche, noter un appel', 'Rien ne peut être supprimé'];

/**
 * /erp/autoriser-claude : page d'autorisation OAuth ouverte par Claude quand
 * on connecte « CRM Label Maison ». Le gérant accepte ou refuse ; Claude
 * reçoit alors un code (ou un refus) sur son adresse de retour.
 */
/** Écran plein, sans menu : tous les états sont centrés dans la même colonne. */
function Colonne({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-md pt-10 sm:pt-20">{children}</div>;
}

const OUVRIR_CRM = (
  <ButtonLink to="/erp/crm" variant="secondary">
    Ouvrir le CRM
  </ButtonLink>
);

export default function AutoriserClaude() {
  const [params] = useSearchParams();
  const { utilisateur, mode } = useErp();
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
          description="Relancez la connexion depuis Claude : Paramètres → Connecteurs → CRM Label Maison."
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
          description={mode !== 'reel' ? 'Disponible avec vos données réelles.' : 'Seul un gérant peut connecter Claude au CRM.'}
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
          <div className="flex size-11 items-center justify-center rounded-full bg-(--lm-or-lavis) text-(--lm-or-texte)">
            <Bot className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="lm-serif text-[24px] leading-tight text-(--lm-encre)">Connecter Claude au CRM ?</h1>
            <p className="mt-1 text-[14px] text-(--lm-encre-2)">
              Demande venue de <span className="font-medium text-(--lm-encre)">{origine.hote}</span>, pour le CRM de Label Maison.
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
          <p className="text-[12.5px] text-(--lm-encre-2)">Pour retirer l’accès : CRM → Plus → Connecter à Claude → Déconnecter.</p>
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
