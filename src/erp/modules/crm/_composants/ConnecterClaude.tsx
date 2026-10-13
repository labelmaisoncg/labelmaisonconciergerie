import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { ADRESSE_CONNECTEUR } from '../../../data/oauth-regles';
import { dateHeure, pluriel } from '../../../data/format';
import { Alert, Button, Modal } from '../../../ui';
import { appelerConnecteur } from './api-connecteur';

/**
 * « Connecter à Claude » : l'adresse du connecteur MCP du CRM, à ajouter une
 * fois dans claude.ai. L'adresse ne donne accès à rien seule : Claude demande
 * ensuite l'autorisation d'un gérant dans l'ERP (OAuth, /erp/autoriser-claude).
 */
export function ConnecterClaude({ ouvert, onFermer, demo }: { ouvert: boolean; onFermer: () => void; demo: boolean }) {
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
      description="Une seule fois : ensuite, demandez à Claude « Qui j’appelle aujourd’hui ? » dans n’importe quelle conversation."
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
              <p className="flex items-center gap-1.5 font-medium">
                <Check className="size-4 text-(--lm-succes)" aria-hidden />
                Claude est connecté
                <span className="font-normal text-(--lm-encre-2)">
                  · {pluriel(etat.connexions, 'connexion')}
                  {etat.derniere ? `, dernière le ${dateHeure(etat.derniere)}` : ''}
                </span>
              </p>
              {confirmer ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="text-(--lm-encre-2)">Claude perdra l’accès au CRM partout.</span>
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
                Sur claude.ai : Paramètres → Connecteurs → « Ajouter un connecteur personnalisé ». Nom : CRM Label Maison, URL : l’adresse copiée. Laissez les
                paramètres avancés vides.
              </p>
            </li>
            <li>
              <p className="font-medium">3. Autorisez l’accès</p>
              <p className="text-(--lm-encre-2)">Claude vous demande de vous connecter : l’ERP s’ouvre, cliquez « Autoriser ».</p>
            </li>
            <li>
              <p className="font-medium">4. Essayez</p>
              <p className="text-(--lm-encre-2)">Dans une conversation, activez « CRM Label Maison » et demandez : « Fais-moi le point sur le CRM ».</p>
            </li>
          </ol>
        </div>
      )}
    </Modal>
  );
}
