import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { obtenirClient } from '../../../data/supabase';
import { Alert, Button, Modal } from '../../../ui';

const INDISPONIBLE = 'Connecteur indisponible pour le moment. Réessayez dans un instant.';

type Etat = { fixee: true; url: string } | { fixee: false; existe: boolean };
type Reponse = { ok?: boolean; fixee?: boolean; existe?: boolean; url?: string; erreur?: string };

/** Route réservée aux gérants. Sans `creer` : l'état ; avec : une adresse neuve (l'ancienne est coupée). */
async function appeler(creer = false): Promise<Reponse> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré : reconnectez-vous à l’ERP.');
  let r: Response;
  try {
    r = await fetch('/api/erp-connecteur-claude', {
      method: creer ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${jeton}`, ...(creer ? { 'Content-Type': 'application/json' } : {}) },
      ...(creer ? { body: JSON.stringify({ action: 'creer' }) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new Error(INDISPONIBLE);
  }
  const json = (await r.json().catch(() => ({}))) as Reponse;
  if (!r.ok || !json.ok) throw new Error(json.erreur ?? INDISPONIBLE);
  return json;
}

/**
 * « Connecter à Claude » : l'adresse du connecteur MCP du CRM, à coller une
 * fois dans claude.ai. La base n'en garde que l'empreinte : l'adresse n'est
 * montrée qu'à sa création (sauf adresse fixée par l'administrateur).
 */
export function ConnecterClaude({ ouvert, onFermer, demo }: { ouvert: boolean; onFermer: () => void; demo: boolean }) {
  const [etat, setEtat] = useState<Etat>();
  const [url, setUrl] = useState('');
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!ouvert || demo || etat) return;
    appeler().then(
      (r) => {
        if (r.fixee && r.url) {
          setEtat({ fixee: true, url: r.url });
          setUrl(r.url);
        } else setEtat({ fixee: false, existe: !!r.existe });
      },
      (e: Error) => setErreur(e.message),
    );
  }, [ouvert, demo, etat]);

  // Refermer la fenêtre efface l'adresse affichée : elle ne se revoit pas.
  const fermer = () => {
    if (etat && !etat.fixee) {
      setUrl('');
      if (url) setEtat({ fixee: false, existe: true });
    }
    setConfirmer(false);
    setErreur('');
    onFermer();
  };

  const creer = async () => {
    setEnCours(true);
    setErreur('');
    try {
      const r = await appeler(true);
      if (!r.url) throw new Error(INDISPONIBLE);
      setUrl(r.url);
      setConfirmer(false);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur('Copie impossible : sélectionnez l’adresse et copiez-la à la main.');
    }
  };

  const lienTexte =
    'inline-flex h-8 items-center rounded-md text-[12.5px] font-medium text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none';

  let etape1: React.ReactNode;
  if (url) {
    etape1 = (
      <>
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            aria-label="Adresse du connecteur"
            onFocus={(e) => e.target.select()}
            className="h-9 min-w-0 flex-1 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface-2) px-3 font-mono text-[12px] text-(--lm-encre-2)"
          />
          <Button variant="primary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
            {copie ? 'Copiée' : 'Copier'}
          </Button>
        </div>
        <p className="mt-1.5 text-[12.5px] text-(--lm-encre-2)">
          {etat?.fixee
            ? 'Adresse fixée par l’administrateur. Elle donne accès au CRM : ne la partagez qu’avec l’équipe.'
            : 'Copiez-la maintenant : elle ne sera plus affichée. Elle donne accès au CRM : ne la partagez qu’avec l’équipe.'}
        </p>
      </>
    );
  } else if (!etat) {
    etape1 = erreur ? null : <p className="text-(--lm-encre-2)">Chargement…</p>;
  } else if (!etat.fixee && !etat.existe) {
    etape1 = (
      <Button variant="primary" chargement={enCours} onClick={() => void creer()}>
        Créer l’adresse
      </Button>
    );
  } else if (!etat.fixee) {
    etape1 = (
      <>
        <p className="text-(--lm-encre-2)">Une adresse est déjà active. Pour des raisons de sécurité, elle ne s’affiche qu’une fois.</p>
        {confirmer ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-(--lm-encre-2)">L’adresse actuelle cessera de fonctionner partout.</span>
            <Button size="sm" variant="danger" chargement={enCours} onClick={() => void creer()}>
              Créer une nouvelle adresse
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmer(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmer(true)} className={`mt-1 ${lienTexte}`}>
            Créer une nouvelle adresse…
          </button>
        )}
      </>
    );
  }

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
        <ol className="space-y-4 text-[13.5px] text-(--lm-encre)">
          <li>
            <p className="mb-1.5 font-medium">1. Copiez l’adresse du connecteur</p>
            {erreur && (
              <div className="mb-2">
                <Alert tone="danger" titre={erreur} />
              </div>
            )}
            {etape1}
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
