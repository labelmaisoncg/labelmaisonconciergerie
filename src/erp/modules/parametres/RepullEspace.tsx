/**
 * Paramètres → Plateformes, espace d'une conciergerie invitée (pas Label
 * Maison, qui garde ses clés dans Vercel) : son propre compte Repull.
 *
 * Le gérant colle la clé API de SON compte Repull (et, s'il en a un, le
 * workspace de cette clé) ; le serveur la range dans le coffre de Supabase
 * (api/erp-espaces.ts → erp.enregistrer_secret_espace). Elle ne revient
 * jamais au navigateur : l'écran dit seulement « Clé enregistrée » et
 * propose de la remplacer. Même chose pour le secret du webhook (Avancé).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Copy, KeyRound } from 'lucide-react';
import { useErp } from '../../data/store';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Repli } from '../../ui';
import { appelerRouteGerant } from '../crm/_composants/api-connecteur';

const API = '/api/erp-espaces';
const INDISPONIBLE = 'Réglages Repull indisponibles pour le moment. Réessayez dans un instant.';

interface EtatRepullEspace {
  ok?: boolean;
  erreur?: string;
  labelMaison?: boolean;
  cle?: boolean;
  webhook?: boolean;
  workspace?: string;
  adresseWebhook?: string;
}

/**
 * `surCle` : la clé est-elle enregistrée ? (vrai aussi quand la carte n'a rien
 * à montrer : démonstration, compte qui n'est pas gérant) — la page n'affiche
 * la synchronisation qu'ensuite, pour un seul bouton principal à la fois.
 */
export function CarteRepullEspace({ surCle }: { surCle?: (cle: boolean) => void }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const [etat, setEtat] = useState<EtatRepullEspace | null>(null);
  const [cle, setCle] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [secret, setSecret] = useState('');
  const [enCours, setEnCours] = useState<'cle' | 'secret' | null>(null);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'danger'; texte: string; connexions?: boolean } | null>(null);

  const relire = useCallback(async () => {
    if (d.mode !== 'reel' || !gerant) return;
    try {
      const e = await appelerRouteGerant<EtatRepullEspace>(`${API}?action=repull`, undefined, INDISPONIBLE);
      setEtat(e);
      setWorkspace(e.workspace ?? '');
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    }
  }, [d.mode, gerant]);

  useEffect(() => {
    void relire();
  }, [relire]);

  const sansCarte = d.mode !== 'reel' || !gerant || !!etat?.labelMaison;
  const cleEnregistree = sansCarte || etat?.cle === true;
  useEffect(() => {
    surCle?.(cleEnregistree);
  }, [surCle, cleEnregistree]);

  if (sansCarte) return null;

  // Après la clé, le message mène à l'étape suivante : connecter ses plateformes.
  const enregistrer = async (corps: Record<string, unknown>, quoi: 'cle' | 'secret', succes: string) => {
    setEnCours(quoi);
    setRetour(null);
    try {
      const e = await appelerRouteGerant<EtatRepullEspace>(API, { action: 'repull', ...corps }, INDISPONIBLE);
      setEtat(e);
      setWorkspace(e.workspace ?? '');
      setRetour({ ton: 'succes', texte: succes, connexions: quoi === 'cle' });
      if (quoi === 'cle') setCle('');
      else setSecret('');
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  const envoyerCle = (e: FormEvent) => {
    e.preventDefault();
    if (!cle.trim() && !etat?.cle) return setRetour({ ton: 'danger', texte: 'Collez la clé API de votre compte Repull.' });
    void enregistrer(
      { ...(cle.trim() ? { cle: cle.trim() } : {}), workspace: workspace.trim() },
      'cle',
      'Enregistré. Connectez maintenant vos plateformes.',
    );
  };

  const envoyerSecret = (e: FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return setRetour({ ton: 'danger', texte: 'Collez le secret du webhook donné par Repull.' });
    void enregistrer({ secretWebhook: secret.trim() }, 'secret', 'Secret du webhook enregistré : les nouveautés arriveront en temps réel.');
  };

  return (
    <Card>
      <CardHeader
        titre="Votre compte Repull"
        description="Repull relie vos comptes Airbnb, Booking.com… à l’ERP, en lecture seule : vos prix et calendriers ne sont jamais modifiés."
        actions={etat ? etat.cle ? <Badge tone="succes">Clé enregistrée</Badge> : <Badge tone="alerte">Pas encore de clé</Badge> : null}
      />
      <form onSubmit={envoyerCle} noValidate className="grid gap-3 sm:grid-cols-2">
        <Field
          label={etat?.cle ? 'Remplacer la clé API' : 'Clé API Repull'}
          aide={etat?.cle ? 'Laissez vide pour garder la clé enregistrée.' : 'Dans Repull : Settings → API keys. Elle reste dans un coffre chiffré, jamais affichée.'}
        >
          <Input type="password" autoComplete="off" spellCheck={false} value={cle} onChange={(e) => setCle(e.target.value)} placeholder="sk_live_…" />
        </Field>
        <Field label="Workspace (facultatif)" aide="Seulement si votre compte Repull en a plusieurs.">
          <Input autoComplete="off" spellCheck={false} value={workspace} maxLength={64} onChange={(e) => setWorkspace(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          {/* Principal tant que la clé manque ; ensuite, la synchronisation devient l'action principale de la page. */}
          <Button type="submit" variant={etat?.cle ? 'secondary' : 'primary'} icone={<KeyRound />} chargement={enCours === 'cle'} disabled={!!enCours}>
            Enregistrer
          </Button>
        </div>
      </form>
      {retour && (
        <Alert tone={retour.ton} className="mt-3">
          {retour.texte}
          {retour.connexions && (
            <>
              {' '}
              <Link to="/erp/logements/connexions" className="font-medium text-(--lm-or-texte) hover:underline">
                Ouvrir les connexions
              </Link>
            </>
          )}
        </Alert>
      )}
      <Repli className="mt-3 rounded-lg shadow-none [&>summary]:rounded-lg" titre="Avancé : temps réel (webhook)">
        <div className="space-y-3 text-[13.5px] text-(--lm-encre-2)">
          <p>
            Sans webhook, tout arrive chaque matin et avec « Synchroniser maintenant ». Avec l’offre Repull qui les inclut, ajoutez dans Repull cette adresse de
            webhook, puis collez ici le secret qu’il vous donne.
          </p>
          {etat?.adresseWebhook && (
            <p className="flex flex-wrap items-center gap-2">
              <code className="break-all text-[12.5px] text-(--lm-encre)">{etat.adresseWebhook}</code>
              <Button size="sm" variant="secondary" icone={<Copy />} onClick={() => void navigator.clipboard?.writeText(etat.adresseWebhook!).catch(() => undefined)}>
                Copier l’adresse
              </Button>
            </p>
          )}
          <form onSubmit={envoyerSecret} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label={etat?.webhook ? 'Remplacer le secret du webhook' : 'Secret du webhook'} className="flex-1">
              <Input type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="whsec_…" />
            </Field>
            <Button type="submit" variant="secondary" chargement={enCours === 'secret'} disabled={!!enCours}>
              Enregistrer le secret
            </Button>
          </form>
          {etat?.webhook && <Badge tone="succes">Secret enregistré</Badge>}
        </div>
      </Repli>
    </Card>
  );
}
