/**
 * Connexions (/erp/logements/connexions) : connecter Airbnb, Booking.com,
 * VRBO ou un logiciel de gestion, puis choisir les logements à gérer.
 *
 * Tout passe par le serveur (api/erp-repull-connexion.ts) : la clé Repull ne
 * quitte jamais Vercel, l'ERP envoie seulement le jeton de session. L'offre
 * gratuite de Repull permet 3 logements : une fois la limite atteinte, les
 * autres cases sont grisées (et le serveur refuse de toute façon au-delà).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Home, ImageOff, Lock, Plug, RefreshCw, Unplug } from 'lucide-react';
import type {
  AnnonceDecouverte,
  ConnexionPlateforme,
  EtatConnexions,
  FournisseurRepull,
  ResultatSelection,
} from '../../data/repull-connexion';
import { useErp } from '../../data/store';
import { obtenirClient } from '../../data/supabase';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, ProgressBar, Select, Skeleton, cn, type Ton } from '../../ui';

const API = '/api/erp-repull-connexion';

/** Plateformes toujours présentées, dans cet ordre. */
const PRINCIPALES: { id: string; nom: string; aide: string }[] = [
  { id: 'airbnb', nom: 'Airbnb', aide: 'Vous vous connectez avec votre compte Airbnb, puis vous acceptez l’accès.' },
  {
    id: 'booking',
    nom: 'Booking.com',
    aide: 'Booking.com vous demande de choisir Repull comme fournisseur dans votre Extranet, puis votre numéro d’établissement. La page vous guide pas à pas.',
  },
  { id: 'vrbo', nom: 'Vrbo', aide: 'Vous indiquez vos identifiants Vrbo sur la page sécurisée de Repull.' },
];

const NOMS: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com', vrbo: 'Vrbo' };

interface Message {
  ton: Ton;
  texte: string;
}

/** Appel du serveur avec le jeton de la session. */
async function appeler<T>(methode: 'GET' | 'POST', params: Record<string, string>, corps?: unknown): Promise<T> {
  const { data } = await obtenirClient().auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré : reconnectez-vous à l’ERP.');
  let r: Response;
  try {
    r = await fetch(`${API}?${new URLSearchParams(params)}`, {
      method: methode,
      headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
      ...(corps !== undefined ? { body: JSON.stringify(corps) } : {}),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
  }
  const json = (await r.json().catch(() => ({}))) as T & { ok?: boolean; erreur?: string };
  if (!r.ok || json.ok === false) throw new Error(json.erreur ?? `Une erreur est survenue (${r.status}). Réessayez dans un instant.`);
  return json;
}

const pluriel = (n: number, un: string, plusieurs = `${un}s`) => `${n} ${n > 1 ? plusieurs : un}`;

function nomOffre(offre?: string) {
  return { free: 'offre gratuite', starter: 'offre Starter', custom: 'votre offre' }[offre ?? 'free'] ?? 'votre offre';
}

/** Message de fin d'import (« 3 logements importés, 12 réservations, 5 conversations »). */
function texteResultat(r: ResultatSelection): string {
  const debut = `${pluriel(r.logements, 'logement importé', 'logements importés')}, ${pluriel(r.reservations, 'réservation')}, ${pluriel(r.conversations, 'conversation')}.`;
  if (r.partiel) return `${debut} La suite arrive au prochain passage, dans quelques minutes.`;
  return debut;
}

/** Réponse incomplète du serveur (ancienne version en cache, erreur réseau…) : jamais de plantage. */
function normaliserEtat(e: Partial<EtatConnexions> | null | undefined): EtatConnexions {
  const liste = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    ...(e ?? {}),
    ok: true,
    fournisseurs: liste(e?.fournisseurs),
    connexions: liste(e?.connexions),
    annonces: liste(e?.annonces).map((a) => ({ ...a, plateformes: liste(a?.plateformes) })),
    selection: liste(e?.selection),
    limite: e?.limite === undefined ? 3 : e.limite,
    sourceLimite: e?.sourceLimite ?? 'defaut',
    avertissements: liste(e?.avertissements),
    appels: e?.appels ?? { mois: 0, budget: 0 },
  };
}

export default function Connexions() {
  const { mode, utilisateur, lancerAutomatisations, lectureSeule } = useErp();
  const reel = mode === 'reel';
  const gerant = utilisateur.role === 'gerant' && !lectureSeule;
  const [params] = useSearchParams();
  const naviguer = useNavigate();
  const retour = params.get('retour');

  const [etat, setEtat] = useState<EtatConnexions | null>(null);
  const [chargement, setChargement] = useState(reel);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [enregistrement, setEnregistrement] = useState(false);
  const [connexionEnCours, setConnexionEnCours] = useState<string | null>(null);
  const [aDeconnecter, setADeconnecter] = useState<ConnexionPlateforme | null>(null);
  const [deconnexion, setDeconnexion] = useState(false);
  const [autre, setAutre] = useState('');
  const retourTraite = useRef(false);

  const charger = useCallback(
    async (forcer = false) => {
      if (!reel) return null;
      setChargement(true);
      setErreur(null);
      try {
        const e = normaliserEtat(await appeler<EtatConnexions>('GET', { action: 'etat', ...(forcer ? { forcer: '1' } : {}) }));
        setEtat(e);
        setChoix(new Set(e.selection));
        return e;
      } catch (err) {
        setErreur((err as Error).message);
        return null;
      } finally {
        setChargement(false);
      }
    },
    [reel],
  );

  // Premier chargement ; au retour de la page de connexion, tout est relu.
  useEffect(() => {
    if (retourTraite.current) return;
    retourTraite.current = true;
    void (async () => {
      const e = await charger(!!retour);
      if (!retour) return;
      const nom = NOMS[retour] ?? e?.fournisseurs.find((f) => f.id === retour)?.nom ?? retour;
      const echec = /error|fail|cancel|denied/i.test(`${params.get('status') ?? ''} ${params.get('error') ?? ''}`);
      const connecte = !!e?.connexions.some((c) => c.fournisseur === retour && (c.statut === 'active' || c.statut === 'chambres'));
      if (e && connecte && !echec) {
        setMessage({ ton: 'succes', texte: `${nom} est bien connecté. Choisissez maintenant les logements à gérer, plus bas.` });
      } else if (e) {
        setMessage({
          ton: 'alerte',
          texte: `La connexion à ${nom} n’a pas abouti. Vous pouvez réessayer : si vous avez fermé la page avant la fin, rien n’a été enregistré.`,
        });
      }
      naviguer('/erp/logements/connexions', { replace: true });
    })();
  }, [charger, retour, params, naviguer]);

  const [choixAirbnb, setChoixAirbnb] = useState(false);

  const connecter = async (fournisseur: string, acces?: 'full_access' | 'messaging') => {
    // Airbnb : le niveau d'accès se choisit ici, pas sur la page Repull.
    if (fournisseur === 'airbnb' && !acces) {
      setChoixAirbnb(true);
      return;
    }
    setChoixAirbnb(false);
    setConnexionEnCours(fournisseur);
    setMessage(null);
    try {
      const r = await appeler<{ url: string }>('POST', {}, { action: 'connecter', fournisseur, ...(acces ? { acces } : {}) });
      window.location.assign(r.url);
    } catch (err) {
      setMessage({ ton: 'danger', texte: (err as Error).message });
      setConnexionEnCours(null);
    }
  };

  const confirmerDeconnexion = async () => {
    if (!aDeconnecter) return;
    setDeconnexion(true);
    try {
      const r = await appeler<{ annoncesDesactivees: string[] }>('POST', {}, { action: 'deconnecter', fournisseur: aDeconnecter.fournisseur, compte: aDeconnecter.compte });
      const nom = NOMS[aDeconnecter.fournisseur] ?? aDeconnecter.fournisseur;
      setMessage({
        ton: 'succes',
        texte: `${nom} est déconnecté.${r.annoncesDesactivees.length ? ` ${pluriel(r.annoncesDesactivees.length, 'logement mis', 'logements mis')} de côté : ils restent dans l’ERP, en pause.` : ''}`,
      });
      setADeconnecter(null);
      await charger(true);
    } catch (err) {
      setMessage({ ton: 'danger', texte: (err as Error).message });
      setADeconnecter(null);
    } finally {
      setDeconnexion(false);
    }
  };

  const enregistrer = async () => {
    setEnregistrement(true);
    setMessage(null);
    try {
      const r = await appeler<ResultatSelection>('POST', {}, { action: 'selection', ids: [...choix] });
      setMessage({ ton: r.ok ? 'succes' : 'alerte', texte: r.ok ? texteResultat(r) : `${texteResultat(r)} ${r.message ?? ''}`.trim() });
      await charger();
      // Les lignes arrivent par le temps réel : on laisse le temps, puis on crée les ménages.
      window.setTimeout(() => lancerAutomatisations(), 3000);
    } catch (err) {
      setMessage({ ton: 'danger', texte: (err as Error).message });
    } finally {
      setEnregistrement(false);
    }
  };

  const limite = etat?.limite ?? null;
  const atteinte = limite !== null && choix.size >= limite;
  const modifie = useMemo(() => {
    const avant = new Set(etat?.selection ?? []);
    return avant.size !== choix.size || [...choix].some((id) => !avant.has(id));
  }, [etat, choix]);
  const infoLimite = `Vous avez atteint la limite de l’${nomOffre(etat?.offre)} (${pluriel(limite ?? 0, 'logement')}). Passez à l’offre Starter pour en ajouter d’autres.`;

  const basculer = (a: AnnonceDecouverte) => {
    setChoix((c) => {
      const s = new Set(c);
      if (s.has(a.id)) s.delete(a.id);
      else if (limite === null || s.size < limite) s.add(a.id);
      return s;
    });
  };

  const fournisseurs = etat?.fournisseurs ?? [];
  const connexions = etat?.connexions ?? [];
  const autres = fournisseurs.filter((f) => !PRINCIPALES.some((p) => p.id === f.id) && f.statut !== 'coming-soon');
  const autresConnectes = connexions.filter((c) => !PRINCIPALES.some((p) => p.id === c.fournisseur));
  const nomFournisseur = (id: string) => NOMS[id] ?? fournisseurs.find((f) => f.id === id)?.nom ?? id.charAt(0).toUpperCase() + id.slice(1);

  return (
    <div>
      <PageHeader
        titre="Connexions"
        sousTitre="Connectez Airbnb, Booking.com et vos autres plateformes, puis choisissez les logements à gérer dans l’ERP."
        fil={[{ libelle: 'Logements', to: '/erp/logements' }, { libelle: 'Connexions' }]}
        actions={
          reel ? (
            <Button icone={<RefreshCw />} chargement={chargement} onClick={() => void charger(true)}>
              Actualiser
            </Button>
          ) : undefined
        }
      />

      {!reel && (
        <Alert tone="neutre" className="mb-4">
          Vous êtes en démo : rien n’est connecté ici. Avec vos données réelles, vous connecterez vos plateformes sur cette page.
        </Alert>
      )}
      {reel && !gerant && (
        <Alert tone="info" className="mb-4" icone={<Lock />}>
          Seul un gérant peut connecter une plateforme ou choisir les logements. Vous pouvez consulter cette page.
        </Alert>
      )}
      {message && (
        <Alert tone={message.ton} className="mb-4">
          {message.texte}
        </Alert>
      )}
      {erreur && (
        <Alert tone="danger" className="mb-4" titre="Impossible de lire vos connexions" actions={<Button size="sm" onClick={() => void charger(true)}>Réessayer</Button>}>
          {erreur}
        </Alert>
      )}
      {etat?.avertissements.filter((a) => !erreur || !a.startsWith(erreur.slice(0, 40))).map((a) => (
        <Alert key={a} tone="alerte" className="mb-4">
          {a}
        </Alert>
      ))}

      {/* ------------------------------------------------------ plateformes */}
      <section aria-labelledby="titre-plateformes" className="mb-8">
        <h2 id="titre-plateformes" className="mb-1 text-[16px] font-semibold text-(--lm-encre)">
          1. Vos plateformes
        </h2>
        <p className="mb-3 text-[13px] text-(--lm-encre-2)">Un clic sur « Connecter » ouvre la page sécurisée de la plateforme. Vous revenez ici ensuite.</p>
        <div className="grid gap-3 md:grid-cols-3">
          {PRINCIPALES.map((p) => {
            const comptes = connexions.filter((c) => c.fournisseur === p.id);
            const actif = comptes.some((c) => c.statut === 'active');
            const aFinir = !actif && comptes.some((c) => c.statut === 'chambres');
            const logo = fournisseurs.find((f) => f.id === p.id)?.logo;
            return (
              <Card key={p.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <LogoPlateforme nom={p.nom} logo={logo} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-(--lm-encre)">{p.nom}</p>
                    {chargement && !etat ? (
                      <Skeleton className="mt-1 h-4 w-28" />
                    ) : (
                      <Badge tone={actif ? 'succes' : comptes.length ? 'alerte' : 'neutre'} point>
                        {actif ? 'Connecté' : aFinir ? 'Presque fini : chambres à associer' : comptes.length ? 'À reconnecter' : 'Pas encore connecté'}
                      </Badge>
                    )}
                  </div>
                </div>
                {aFinir && (
                  <p className="text-[12.5px] text-(--lm-encre-2)">
                    Booking a bien accepté Repull. Il reste à associer vos chambres à vos logements : cliquez sur « Terminer la connexion », puis suivez la page.
                  </p>
                )}
                {comptes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {comptes.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 text-[13px] text-(--lm-encre-2)">
                        <span className="truncate">{c.nom ?? (c.compte ? `Compte ${c.compte}` : 'Compte connecté')}</span>
                        <Button size="sm" variant="ghost" icone={<Unplug />} disabled={!gerant} onClick={() => setADeconnecter(c)}>
                          Déconnecter
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-(--lm-encre-3)">{p.aide}</p>
                )}
                <Button
                  className="mt-auto"
                  variant={actif ? 'secondary' : 'primary'}
                  icone={<Plug />}
                  chargement={connexionEnCours === p.id}
                  disabled={!reel || !gerant || !!connexionEnCours}
                  onClick={() => void connecter(p.id)}
                >
                  {actif ? 'Ajouter un autre compte' : aFinir ? 'Terminer la connexion' : `Connecter ${p.nom}`}
                </Button>
              </Card>
            );
          })}
        </div>

        <Card className="mt-3">
          <CardHeader titre="Autres logiciels de gestion" description="Vous utilisez déjà un logiciel (Hostaway, Smoobu, Lodgify…) ? Connectez-le : vos logements arrivent avec." />
          {autresConnectes.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {autresConnectes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-[13.5px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge tone={c.statut === 'active' ? 'succes' : 'alerte'} point>
                      {c.statut === 'active' ? 'Connecté' : 'À reconnecter'}
                    </Badge>
                    <span className="truncate font-medium">{nomFournisseur(c.fournisseur)}</span>
                  </span>
                  <Button size="sm" variant="ghost" icone={<Unplug />} disabled={!gerant} onClick={() => setADeconnecter(c)}>
                    Déconnecter
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:w-72">
              <Select
                aria-label="Choisir un logiciel de gestion"
                value={autre}
                onChange={(e) => setAutre(e.target.value)}
                placeholder={autres.length ? 'Choisir un logiciel…' : 'Liste indisponible pour l’instant'}
                options={autres.map((f: FournisseurRepull) => ({ valeur: f.id, libelle: f.statut === 'beta' ? `${f.nom} (bêta)` : f.nom }))}
                disabled={!reel || !autres.length}
              />
            </div>
            <Button icone={<Plug />} disabled={!reel || !gerant || !autre || !!connexionEnCours} chargement={!!autre && connexionEnCours === autre} onClick={() => void connecter(autre)}>
              Connecter
            </Button>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------- logements */}
      <section aria-labelledby="titre-logements">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titre-logements" className="mb-1 text-[16px] font-semibold text-(--lm-encre)">
              2. Choisissez les logements à gérer
            </h2>
            <p className="text-[13px] text-(--lm-encre-2)">Seuls les logements cochés entrent dans l’ERP, avec leurs réservations, leurs messages et leurs avis.</p>
          </div>
          {etat && (
            <div className="min-w-48 text-right">
              <p className="lm-chiffres text-[14px] font-semibold text-(--lm-encre)" aria-live="polite">
                {limite === null ? pluriel(choix.size, 'logement choisi', 'logements choisis') : `${choix.size} / ${pluriel(limite, 'logement')} (${nomOffre(etat.offre)})`}
              </p>
              {limite !== null && <ProgressBar className="mt-1.5" valeur={limite ? choix.size / limite : 0} tone={atteinte ? 'alerte' : 'or'} />}
            </div>
          )}
        </div>

        {etat?.depassement && (
          <Alert tone="alerte" className="mb-3">
            {etat.depassement.message}
          </Alert>
        )}
        {etat && etat.annonces.length > 0 && etat.selection.length === 0 && !message && (
          <Alert tone="info" className="mb-3">
            Choisissez vos logements : rien n’est importé tant que vous ne les avez pas choisis.
          </Alert>
        )}
        {atteinte && etat && etat.annonces.length > choix.size && (
          <p className="mb-3 text-[12.5px] text-(--lm-encre-2)" role="note">
            {infoLimite}
          </p>
        )}

        {chargement && !etat ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : !etat || etat.annonces.length === 0 ? (
          <EmptyState
            icone={<Home />}
            titre="Aucun logement trouvé pour l’instant"
            description={
              reel
                ? 'Connectez une plateforme ci-dessus : vos logements apparaîtront ici. Il faut parfois une minute ou deux après la connexion, puis « Actualiser ».'
                : 'En démo, aucune plateforme n’est connectée.'
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {etat.annonces.map((a) => {
              const coche = choix.has(a.id);
              const bloque = !coche && atteinte;
              const inactif = !gerant || enregistrement;
              return (
                <li key={a.id}>
                  <label
                    title={bloque ? infoLimite : undefined}
                    className={cn(
                      'flex h-full items-center gap-3 rounded-xl border bg-(--lm-surface) p-3 transition-colors',
                      coche ? 'border-(--lm-or) ring-1 ring-(--lm-or-anneau)' : 'border-(--lm-bord)',
                      bloque ? 'cursor-not-allowed opacity-50 grayscale' : inactif ? 'cursor-default' : 'cursor-pointer hover:border-(--lm-or-anneau)',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-(--lm-or)"
                      checked={coche}
                      disabled={bloque || inactif}
                      onChange={() => basculer(a)}
                      aria-describedby={bloque ? `limite-${a.id}` : undefined}
                    />
                    {a.photo ? (
                      <img src={a.photo} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre-3)">
                        <ImageOff className="size-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{a.nom}</span>
                      {a.ville && <span className="block truncate text-[12.5px] text-(--lm-encre-3)">{a.ville}</span>}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {a.plateformes.map((p) => (
                          <Badge key={p} tone={p === 'airbnb' ? 'danger' : p === 'booking' ? 'info' : 'neutre'}>
                            {nomFournisseur(p)}
                          </Badge>
                        ))}
                        {a.importee && (
                          <Badge tone="succes" icone={<Check />}>
                            Dans l’ERP
                          </Badge>
                        )}
                      </span>
                      {bloque && (
                        <span id={`limite-${a.id}`} className="sr-only">
                          {infoLimite}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {etat && etat.annonces.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="primary" size="lg" icone={<Check />} chargement={enregistrement} disabled={!gerant || !modifie || enregistrement} onClick={() => void enregistrer()}>
              Enregistrer mon choix
            </Button>
            {enregistrement ? (
              <p className="text-[13px] text-(--lm-encre-2)" aria-live="polite">
                Import en cours : logements, réservations, messages… Cela peut prendre jusqu’à une minute.
              </p>
            ) : (
              modifie && <p className="text-[13px] text-(--lm-encre-2)">Les logements décochés restent dans l’ERP, en pause. Rien n’est supprimé.</p>
            )}
          </div>
        )}
      </section>

      {etat && etat.annonces.some((a) => a.selectionnee) && (
        <OuvrirCalendriers annonces={etat.annonces.filter((a) => a.selectionnee)} actif={reel && gerant} />
      )}

      <VerificationRepull actif={reel} />

      <Modal
        ouvert={choixAirbnb}
        onFermer={() => setChoixAirbnb(false)}
        taille="sm"
        titre="Connecter Airbnb"
        description="Une seule question avant d’aller sur Airbnb."
        pied={
          <>
            <Button variant="ghost" onClick={() => setChoixAirbnb(false)}>
              Annuler
            </Button>
            <Button variant="primary" icone={<Plug />} onClick={() => void connecter('airbnb', 'messaging')}>
              Continuer vers Airbnb
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-(--lm-encre)">
          L’ERP aura accès <strong>uniquement à la messagerie</strong> Airbnb : lire vos réservations et répondre aux voyageurs.
        </p>
        <p className="mt-2 text-[13px] text-(--lm-encre-2)">
          Votre calendrier, vos prix et vos annonces Airbnb ne seront jamais modifiés : vous continuez à les gérer sur Airbnb comme aujourd’hui.
        </p>
        <p className="mt-3 text-[12.5px] text-(--lm-encre-3)">
          Sur Airbnb, connectez-vous avec le compte hôte qui gère vos annonces, puis cliquez sur « Autoriser ».
        </p>
      </Modal>

      <Modal
        ouvert={!!aDeconnecter}
        onFermer={() => !deconnexion && setADeconnecter(null)}
        titre={`Déconnecter ${aDeconnecter ? nomFournisseur(aDeconnecter.fournisseur) : ''} ?`}
        description="Plus rien n’arrivera de ce compte. Ses logements restent dans l’ERP, en pause, avec leurs réservations. Vous pourrez le reconnecter quand vous voudrez."
        taille="sm"
        pied={
          <>
            <Button onClick={() => setADeconnecter(null)} disabled={deconnexion}>
              Annuler
            </Button>
            <Button variant="danger" icone={<Unplug />} chargement={deconnexion} onClick={() => void confirmerDeconnexion()}>
              Déconnecter
            </Button>
          </>
        }
      />
    </div>
  );
}

function LogoPlateforme({ nom, logo }: { nom: string; logo?: string }) {
  const [casse, setCasse] = useState(false);
  if (logo && !casse) return <img src={logo} alt="" className="size-10 shrink-0 rounded-lg border border-(--lm-bord) bg-white object-contain p-1" onError={() => setCasse(true)} />;
  return (
    <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-[15px] font-semibold text-(--lm-brun)">
      {nom.charAt(0)}
    </span>
  );
}

/* ------------------------------------------------------ vérification Repull */

interface LigneVerif {
  question: string;
  appel: string;
  ok: boolean;
  statut: number;
  resume: string;
  brut: string;
}

/**
 * « Vérifier avec Repull » : ce que Repull sait réellement du compte (clé,
 * connexions, Airbnb, établissements Booking, logements), en clair. Sert à
 * comprendre une connexion qui n'aboutit pas, sans accès technique.
 */
function VerificationRepull({ actif }: { actif: boolean }) {
  const [lignes, setLignes] = useState<LigneVerif[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const verifier = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await appeler<{ lignes?: LigneVerif[] }>('GET', { action: 'diagnostic' });
      setLignes(Array.isArray(r.lignes) ? r.lignes : []);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <section className="mt-8">
      <Card>
        <CardHeader
          titre="Vérifier avec Repull"
          description="Une connexion qui ne s’affiche pas ? Demandez directement à Repull ce qu’il voit de vos comptes. Cela prend quelques secondes."
        />
        <Button icone={<RefreshCw />} chargement={enCours} disabled={!actif || enCours} onClick={() => void verifier()}>
          Vérifier maintenant
        </Button>
        {erreur && (
          <Alert tone="danger" className="mt-3">
            {erreur}
          </Alert>
        )}
        {lignes && (
          <ul className="mt-4 space-y-2">
            {lignes.map((l) => (
              <li key={l.appel} className="rounded-lg border border-(--lm-bord) p-3">
                <p className="flex items-start gap-2 text-[13.5px]">
                  <span aria-hidden className={l.ok ? 'text-(--lm-succes,#2f7d4f)' : 'text-(--lm-danger,#b3261e)'}>
                    {l.ok ? '✓' : '✗'}
                  </span>
                  <span>
                    <span className="font-medium text-(--lm-encre)">{l.question}</span>
                    <br />
                    <span className="text-(--lm-encre-2)">{l.resume}</span>
                  </span>
                </p>
                <details className="mt-2 text-[12px] text-(--lm-encre-3)">
                  <summary className="cursor-pointer">Détails techniques ({l.appel}, {l.statut || 'réseau'})</summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all">{l.brut}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

/* ------------------------------------------------ ouvrir à la réservation */

/** « 12/10/2026-15/10/2026 » ou « 2026-10-12 2026-10-15 » → nuits ISO (départ exclu). */
function nuitsDesPeriodes(texteLibre: string): { nuits: string[]; erreurs: string[] } {
  const nuits: string[] = [];
  const erreurs: string[] = [];
  const versIso = (x: string) => {
    const f = x.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (f) return `${f[3]}-${f[2].padStart(2, '0')}-${f[1].padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(x.trim()) ? x.trim() : '';
  };
  for (const ligne of texteLibre.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const [a, b] = ligne.split(/\s*(?:-|→|au|>)\s*(?=\d)/).map(versIso);
    if (!a || !b || b <= a) {
      erreurs.push(ligne);
      continue;
    }
    for (let t = Date.parse(`${a}T00:00:00Z`); t < Date.parse(`${b}T00:00:00Z`); t += 86_400_000) nuits.push(new Date(t).toISOString().slice(0, 10));
  }
  return { nuits, erreurs };
}

function OuvrirCalendriers({ annonces, actif }: { annonces: EtatConnexions['annonces']; actif: boolean }) {
  const { donnees } = useErp();
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-[16px] font-semibold text-(--lm-encre)">3. Ouvrez vos logements à la réservation</h2>
      <p className="mb-3 text-[13px] text-(--lm-encre-2)">
        Une fois reliés à Repull, vos logements Booking restent fermés tant qu’aucun prix n’est envoyé. Indiquez un prix par nuit : le calendrier
        Booking.com s’ouvre en un clic. Airbnb n’est jamais touché.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {annonces.map((a) => {
          const nuitsErp = new Set<string>();
          for (const r of donnees.reservations) {
            if (r.logementId !== a.logementId || r.statut === 'annulee') continue;
            for (let t = Date.parse(`${r.arrivee}T00:00:00Z`); t < Date.parse(`${r.depart}T00:00:00Z`); t += 86_400_000) {
              nuitsErp.add(new Date(t).toISOString().slice(0, 10));
            }
          }
          return <CarteCalendrier key={a.id} annonce={a} nuitsErp={[...nuitsErp]} actif={actif} />;
        })}
      </div>
    </section>
  );
}

function CarteCalendrier({ annonce, nuitsErp, actif }: { annonce: EtatConnexions['annonces'][number]; nuitsErp: string[]; actif: boolean }) {
  const [prix, setPrix] = useState('');
  const [minNuits, setMinNuits] = useState('1');
  const [jours, setJours] = useState('365');
  const [periodes, setPeriodes] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ton: Ton; texte: string } | null>(null);

  const ouvrir = async () => {
    const { nuits, erreurs } = nuitsDesPeriodes(periodes);
    if (erreurs.length) return setRetour({ ton: 'danger', texte: `Période illisible : « ${erreurs[0]} ». Écrivez par exemple 12/10/2026-15/10/2026.` });
    setEnCours(true);
    setRetour(null);
    try {
      const r = await appeler<{ ouvertes: number; gardeesFermees: number; du: string; au: string }>('POST', {}, {
        action: 'calendrier',
        annonce: annonce.id,
        prix: Number(prix.replace(',', '.')),
        minNuits: Number(minNuits),
        jours: Number(jours),
        bloquees: [...new Set([...nuitsErp, ...nuits])],
      });
      setRetour({
        ton: 'succes',
        texte: `C’est ouvert : ${r.ouvertes} nuits à ${prix} € du ${r.du} au ${r.au}${r.gardeesFermees ? `, ${r.gardeesFermees} nuits déjà réservées gardées fermées` : ''}. Booking met parfois quelques minutes à l’afficher.`,
      });
    } catch (e) {
      setRetour({ ton: 'danger', texte: (e as Error).message });
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="line-clamp-2 text-[14px] font-medium text-(--lm-encre)">{annonce.nom}</p>
        {annonce.ville && <p className="text-[12.5px] text-(--lm-encre-3)">{annonce.ville}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[12px] text-(--lm-encre-2)">
          Prix / nuit (€)
          <input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="75" className="mt-1 w-full rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-2 py-1.5 text-[14px]" />
        </label>
        <label className="text-[12px] text-(--lm-encre-2)">
          Nuits min.
          <input inputMode="numeric" value={minNuits} onChange={(e) => setMinNuits(e.target.value)} className="mt-1 w-full rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-2 py-1.5 text-[14px]" />
        </label>
        <label className="text-[12px] text-(--lm-encre-2)">
          Ouvrir sur
          <select value={jours} onChange={(e) => setJours(e.target.value)} className="mt-1 w-full rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-2 py-1.5 text-[14px]">
            <option value="180">6 mois</option>
            <option value="365">12 mois</option>
            <option value="730">24 mois</option>
          </select>
        </label>
      </div>
      <label className="text-[12px] text-(--lm-encre-2)">
        Nuits déjà réservées sur Booking, à garder fermées (une période par ligne)
        <textarea
          value={periodes}
          onChange={(e) => setPeriodes(e.target.value)}
          rows={3}
          placeholder={'12/10/2026-15/10/2026\n02/11/2026-04/11/2026'}
          className="mt-1 w-full rounded-lg border border-(--lm-bord) bg-(--lm-surface) px-2 py-1.5 text-[13px]"
        />
      </label>
      <p className="text-[11.5px] text-(--lm-encre-3)">
        Important : recopiez ici vos réservations Booking en cours (Extranet → Réservations), sinon ces nuits seraient rouvertes.
        {nuitsErp.length ? ` ${nuitsErp.length} nuits réservées dans l’ERP sont déjà gardées fermées.` : ''}
      </p>
      {retour && (
        <Alert tone={retour.ton} className="py-2">
          {retour.texte}
        </Alert>
      )}
      <Button variant="primary" icone={<Plug />} chargement={enCours} disabled={!actif || enCours || !prix.trim()} onClick={() => void ouvrir()}>
        Ouvrir sur Booking.com
      </Button>
      <p className="text-[11.5px] text-(--lm-encre-3)">N’agit que sur Booking.com : Airbnb n’est jamais modifié.</p>
    </Card>
  );
}
