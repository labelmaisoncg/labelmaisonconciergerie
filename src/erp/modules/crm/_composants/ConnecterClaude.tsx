import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { espaceOuvert } from '../../../data/espaces';
import { ADRESSE_CONNECTEUR } from '../../../data/oauth-regles';
import { dateHeure, pluriel } from '../../../data/format';
import { Alert, Button, Modal } from '../../../ui';
import { appelerConnecteur } from './api-connecteur';

/**
 * « Connecter à Claude » : l'adresse du connecteur MCP de l'ERP (CRM, logements,
 * réservations, messages), à ajouter une
 * fois dans claude.ai. L'adresse ne donne accès à rien seule : Claude demande
 * ensuite l'autorisation d'un gérant dans l'ERP (OAuth, /erp/autoriser-claude).
 */
export function ConnecterClaude({ ouvert, onFermer, demo }: { ouvert: boolean; onFermer: () => void; demo: boolean }) {
  // Une connexion par espace : celle de l'espace ouvert (le connecteur s'y nomme comme lui).
  const nomEspace = espaceOuvert().nom;
  const [etat, setEtat] = useState<{ connexions: number; derniere?: string }>();
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!ouvert || demo) return;
    appelerConnecteur().then(
      (r) => setEtat({ connexions: r.connexions ?? 0, derniere: r.derniere }),
      () => setEtat(undefined), // l'état est un bonus : les étapes restent valables
    );
  }, [ouvert, demo]);

  const fermer = () => {
    setConfirmer(false);
    setErreur('');
    onFermer();
  };

  const deconnecter = async () => {
    setEnCours(true);
    setErreur('');
    try {
      await appelerConnecteur({ action: 'deconnecter' });
      setEtat({ connexions: 0 });
      setConfirmer(false);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(ADRESSE_CONNECTEUR);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur('Copie impossible : sélectionnez l’adresse et copiez-la à la main.');
    }
  };

  const lienTexte =
    'inline-flex h-8 items-center rounded-md text-[12.5px] font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none';

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      titre="Connecter à Claude"
      description={`Une seule fois : ensuite, Claude suit l’espace ${nomEspace} dans toutes vos conversations.`}
      pied={
        <Button variant="ghost" onClick={fermer}>
          Fermer
        </Button>
      }
    >
      {demo ? (
        <Alert tone="neutre" titre="Disponible avec vos données réelles." />
      ) : (
        <div className="space-y-4 text-[13.5px] text-(--lm-encre)">
          {etat && etat.connexions > 0 && (
            <div className="rounded-lg bg-(--lm-surface-2) px-3 py-2">
              <p className="font-medium">
                <Check className="mr-1.5 inline size-4 align-[-3px] text-(--lm-succes)" aria-hidden />
                Claude est connecté
              </p>
              <p className="text-[12.5px] text-(--lm-encre-2)">
                {pluriel(etat.connexions, 'connexion')}
                {etat.derniere ? ` · dernière le ${dateHeure(etat.derniere)}` : ''}
              </p>
              {confirmer ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-(--lm-encre-2)">Claude perdra l’accès à l’espace {nomEspace} partout.</span>
                  <Button size="sm" variant="danger" chargement={enCours} onClick={() => void deconnecter()}>
                    Déconnecter
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmer(false)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmer(true)} className={lienTexte}>
                  Déconnecter Claude…
                </button>
              )}
            </div>
          )}
          {erreur && <Alert tone="danger" titre={erreur} />}
          <ol className="space-y-4">
            <li>
              <p className="mb-1.5 font-medium">1. Copiez l’adresse du connecteur</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={ADRESSE_CONNECTEUR}
                  aria-label="Adresse du connecteur"
                  onFocus={(e) => e.target.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface-2) px-3 font-mono text-[12px] text-(--lm-encre-2)"
                />
                <Button variant="primary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
                  {copie ? 'Copiée' : 'Copier'}
                </Button>
              </div>
            </li>
            <li>
              <p className="font-medium">2. Ajoutez-la dans Claude</p>
              <p className="text-(--lm-encre-2)">
                Sur claude.ai&nbsp;: Paramètres → Connecteurs → «&nbsp;Ajouter un connecteur personnalisé&nbsp;». Nom&nbsp;: {nomEspace}, URL&nbsp;: l’adresse
                copiée. Laissez les paramètres avancés vides.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Autorisez l’accès</p>
              <p className="text-(--lm-encre-2)">
                Claude vous demande de vous connecter&nbsp;: l’ERP s’ouvre sur l’espace {nomEspace}, cliquez «&nbsp;Autoriser&nbsp;».
              </p>
            </li>
            <li>
              <p className="font-medium">4. Essayez</p>
              <p className="text-(--lm-encre-2)">
                Dans une conversation, activez «&nbsp;{nomEspace}&nbsp;» et demandez&nbsp;: «&nbsp;Fais-moi le point du jour&nbsp;» ou «&nbsp;Qui arrive
                demain&nbsp;?&nbsp;».
              </p>
            </li>
          </ol>
        </div>
      )}
    </Modal>
  );
}
