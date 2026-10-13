import { useMemo, useState } from 'react';
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
export default function AutoriserClaude() {
  const [params] = useSearchParams();
  const { utilisateur, mode } = useErp();
  const lu = useMemo(() => lireDemande(Object.fromEntries(params)), [params]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  if (!lu.ok) {
    return (
      <EmptyState
        icone={<Link2Off />}
        titre="Lien de connexion invalide"
        description="Relancez la connexion depuis Claude : Paramètres → Connecteurs → CRM Label Maison."
        action={
          <ButtonLink to="/erp/crm" variant="secondary">
            Ouvrir le CRM
          </ButtonLink>
        }
      />
    );
  }
  if (mode !== 'reel' || utilisateur.role !== 'gerant') {
    return (
      <EmptyState
        icone={<Bot />}
        titre="Connexion impossible ici"
        description={mode !== 'reel' ? 'Disponible avec vos données réelles.' : 'Seul un gérant peut connecter Claude au CRM.'}
      />
    );
  }

  const { demande } = lu;
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
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <Card>
        <div className="space-y-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-(--lm-or-lavis) text-(--lm-or-texte)">
            <Bot className="size-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold text-(--lm-encre)">Connecter Claude au CRM ?</h1>
            <p className="mt-1 text-[14px] text-(--lm-encre-2)">{demandeur(demande.redirect_uri)} demande l’accès au CRM de Label Maison.</p>
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
    </div>
  );
}
