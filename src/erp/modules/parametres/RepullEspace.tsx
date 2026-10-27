/**
 * Paramètres → Plateformes, espace d'une conciergerie invitée (pas Label
 * Maison, qui garde ses clés dans Vercel) : son propre compte Repull.
 *
 * Le gérant colle la clé de SON compte Repull ; le serveur l'essaie chez
 * Repull (lecture seule) puis la range dans le coffre de Supabase
 * (api/erp-espaces.ts → erp.enregistrer_secret_espace). Une clé refusée par
 * Repull n'est jamais rangée. Elle ne revient jamais au navigateur : l'écran
 * dit seulement « Clé enregistrée » et propose de la remplacer. Repliés sous
 * la carte (« Avancé ») : l'espace de travail Repull, s'il en a plusieurs, et
 * le secret du webhook (mises à jour en temps réel).
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

type Quoi = 'cle' | 'workspace' | 'secret';

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
  const [enCours, setEnCours] = useState<Quoi | null>(null);
  // Chaque message reste près de ce qu'il concerne : la clé dans la carte, le reste dans « Avancé ».
  const [retour, setRetour] = useState<{ ou: Quoi; ton: 'succes' | 'danger'; texte: string } | null>(null);
  const [copie, setCopie] = useState(false);

  const relire = useCallback(async () => {
    if (d.mode !== 'reel' || !gerant) return;
    try {
      const e = await appelerRouteGerant<EtatRepullEspace>(`${API}?action=repull`, undefined, INDISPONIBLE);
      setEtat(e);
      setWorkspace(e.workspace ?? '');
    } catch (e) {
      setRetour({ ou: 'cle', ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
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

  const enregistrer = async (corps: Record<string, unknown>, quoi: Quoi, succes: string) => {
    setEnCours(quoi);
    setRetour(null);
    try {
      const e = await appelerRouteGerant<EtatRepullEspace>(API, { action: 'repull', ...corps }, INDISPONIBLE);
      setEtat(e);
      setWorkspace(e.workspace ?? '');
      setRetour({ ou: quoi, ton: 'succes', texte: succes });
      if (quoi === 'cle') setCle('');
      if (quoi === 'secret') setSecret('');
    } catch (e) {
      setRetour({ ou: quoi, ton: 'danger', texte: e instanceof Error ? e.message : INDISPONIBLE });
    } finally {
      setEnCours(null);
    }
  };

  const envoyerCle = (e: FormEvent) => {
    e.preventDefault();
    if (!cle.trim()) return setRetour({ ou: 'cle', ton: 'danger', texte: 'Collez la clé de votre compte Repull.' });
    // Après la clé, la synchronisation apparaît plus bas, avec « Gérer vos connexions » : l'étape suivante.
    void enregistrer({ cle: cle.trim() }, 'cle', 'Clé vérifiée par Repull et enregistrée. Étape suivante : « Gérer vos connexions », plus bas.');
  };

  const envoyerWorkspace = (e: FormEvent) => {
    e.preventDefault();
    void enregistrer({ workspace: workspace.trim() }, 'workspace', workspace.trim() ? 'Espace de travail enregistré.' : 'Espace de travail retiré : celui du compte est utilisé.');
  };

  const envoyerSecret = (e: FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return setRetour({ ou: 'secret', ton: 'danger', texte: 'Collez le secret du webhook donné par Repull.' });
    void enregistrer({ secretWebhook: secret.trim() }, 'secret', 'Secret du webhook enregistré : les nouveautés arriveront en temps réel.');
  };

  const message = (ou: Quoi) =>
    retour?.ou === ou ? (
      <Alert tone={retour.ton} className="mt-3">
        {retour.texte}
      </Alert>
    ) : null;

  return (
    <>
      <Card>
        <CardHeader
          titre="Votre compte Repull"
          description="Repull relie vos comptes Airbnb, Booking.com… à l’ERP, en lecture seule : vos prix et calendriers ne sont jamais modifiés."
          actions={etat ? etat.cle ? <Badge tone="succes">Clé enregistrée</Badge> : <Badge tone="alerte">Pas encore de clé</Badge> : null}
        />
        <form onSubmit={envoyerCle} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            className="flex-1"
            label={etat?.cle ? 'Remplacer la clé' : 'Clé de votre compte Repull'}
            aide={etat?.cle ? 'Collez une nouvelle clé seulement pour remplacer celle enregistrée.' : 'Dans Repull : Settings → API keys. Vérifiée auprès de Repull, puis gardée dans un coffre chiffré, jamais affichée.'}
          >
            <Input type="password" autoComplete="off" spellCheck={false} value={cle} onChange={(e) => setCle(e.target.value)} placeholder="sk_live_…" />
          </Field>
          {/* Principal tant que la clé manque ; ensuite, la synchronisation devient l'action principale de la page. */}
          <Button type="submit" variant={etat?.cle ? 'secondary' : 'primary'} icone={<KeyRound />} chargement={enCours === 'cle'} disabled={!!enCours}>
            Enregistrer
          </Button>
        </form>
        {message('cle')}
      </Card>
      <Repli titre="Avancé : mises à jour en temps réel">
        <div className="space-y-5 text-[13.5px] text-(--lm-encre-2)">
          <form onSubmit={envoyerWorkspace} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field className="flex-1" label="Espace de travail Repull (si vous en avez plusieurs)" aide="Laissez vide pour utiliser celui de votre compte.">
              <Input autoComplete="off" spellCheck={false} value={workspace} maxLength={64} onChange={(e) => setWorkspace(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" chargement={enCours === 'workspace'} disabled={!!enCours}>
              Enregistrer
            </Button>
          </form>
          {message('workspace')}
          <div className="space-y-3">
            <p>
              Sans webhook, tout arrive chaque matin et avec « Synchroniser maintenant ». Avec l’offre Repull qui les inclut, ajoutez dans Repull cette adresse
              de webhook, puis collez ici le secret qu’il vous donne.
            </p>
            {etat?.adresseWebhook && (
              <p className="flex flex-wrap items-center gap-2">
                <code className="text-[12.5px] text-(--lm-encre) [overflow-wrap:anywhere]">{etat.adresseWebhook}</code>
                <Button
                  size="sm"
                  variant="secondary"
                  icone={<Copy />}
                  onClick={() =>
                    void navigator.clipboard
                      ?.writeText(etat.adresseWebhook!)
                      .then(() => setCopie(true))
                      .catch(() => undefined)
                  }
                >
                  {copie ? 'Adresse copiée' : 'Copier l’adresse'}
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
            {message('secret')}
            {etat?.webhook && <Badge tone="succes">Secret enregistré</Badge>}
          </div>
        </div>
      </Repli>
    </>
  );
}
