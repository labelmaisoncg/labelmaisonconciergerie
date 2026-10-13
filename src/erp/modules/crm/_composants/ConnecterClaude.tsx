import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { obtenirClient } from '../../../data/supabase';
import { Alert, Button, Modal } from '../../../ui';

/** Adresse du connecteur (réservée aux gérants, calculée par le serveur). */
async function lireAdresse(): Promise<string> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré : reconnectez-vous à l’ERP.');
  const r = await fetch('/api/erp-connecteur-claude', { headers: { Authorization: `Bearer ${jeton}` }, cache: 'no-store' });
  const json = (await r.json().catch(() => ({}))) as { ok?: boolean; url?: string; erreur?: string };
  if (!r.ok || !json.url) throw new Error(json.erreur ?? `Une erreur est survenue (${r.status}). Réessayez dans un instant.`);
  return json.url;
}

/**
 * « Connecter à Claude » : l'adresse du connecteur MCP du CRM, à coller une
 * fois dans claude.ai. Claude peut ensuite lire et tenir le CRM depuis
 * n'importe quelle conversation.
 */
export function ConnecterClaude({ ouvert, onFermer, demo }: { ouvert: boolean; onFermer: () => void; demo: boolean }) {
  const [url, setUrl] = useState('');
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!ouvert || demo || url) return;
    lireAdresse().then(setUrl, (e: Error) => setErreur(e.message));
  }, [ouvert, demo, url]);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur('Copie impossible : sélectionnez l’adresse et copiez-la à la main.');
    }
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Connecter Claude au CRM"
      description="Une seule fois : ensuite, demandez à Claude « Qui j’appelle aujourd’hui ? » dans n’importe quelle conversation."
      pied={
        <Button variant="ghost" onClick={onFermer}>
          Fermer
        </Button>
      }
    >
      {demo ? (
        <Alert tone="neutre" titre="Disponible avec vos données réelles." />
      ) : (
        <ol className="space-y-4 text-[13.5px] text-(--lm-encre)">
          <li>
            <p className="mb-1.5 font-medium">1. Copiez l’adresse du connecteur</p>
            {erreur ? (
              <Alert tone="danger" titre={erreur} />
            ) : (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={url || 'Chargement…'}
                  aria-label="Adresse du connecteur"
                  onFocus={(e) => e.target.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface-2) px-3 font-mono text-[12px] text-(--lm-encre-2)"
                />
                <Button variant="primary" icone={copie ? <Check /> : <Copy />} disabled={!url} onClick={() => void copier()}>
                  {copie ? 'Copiée' : 'Copier'}
                </Button>
              </div>
            )}
            <p className="mt-1.5 text-[12.5px] text-(--lm-encre-2)">Elle donne accès au CRM : ne la partagez qu’avec l’équipe.</p>
          </li>
          <li>
            <p className="font-medium">2. Ajoutez-la dans Claude</p>
            <p className="text-(--lm-encre-2)">
              Sur claude.ai : Paramètres → Connecteurs → « Ajouter un connecteur personnalisé ». Nom : CRM Label Maison, URL : l’adresse copiée.
            </p>
          </li>
          <li>
            <p className="font-medium">3. Essayez</p>
            <p className="text-(--lm-encre-2)">Dans une conversation, activez « CRM Label Maison » et demandez : « Fais-moi le point sur le CRM ».</p>
          </li>
        </ol>
      )}
    </Modal>
  );
}
