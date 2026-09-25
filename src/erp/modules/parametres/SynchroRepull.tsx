/**
 * Synchronisation Repull dans l'ERP : état (dernier passage, bilan, appels
 * consommés) et bouton « Synchroniser maintenant ».
 *
 * Le travail se fait côté serveur (api/erp-repull-sync.ts) : l'ERP envoie
 * seulement le jeton de la session Supabase. Les éléments importés arrivent
 * ensuite en direct (Supabase Realtime) ; le moteur d'automatisations est
 * relancé juste après pour créer les ménages des nouvelles réservations.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { ACTION_JOURNAL_REPULL } from '../../data/repull';
import type { EtatRepull, ResultatLancement } from '../../data/repull-synchro';
import { useErp } from '../../data/store';
import { obtenirClient } from '../../data/supabase';
import { dateHeure, nombre } from '../../data/format';
import { Alert, Badge, Button, Card, CardHeader, ProgressBar, type Ton } from '../../ui';

/** Tableau de bord Repull, où les propriétaires connectent leurs comptes. */
export const URL_TABLEAU_REPULL = 'https://repull.dev/dashboard';

const moisCourant = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' }).format(new Date());

interface Retour {
  ton: Ton;
  texte: string;
}

/** État partagé par la carte (Paramètres) et la ligne compacte (Réservations). */
export function useSynchroRepull() {
  const { mode, journal, lancerAutomatisations, lectureSeule } = useErp();
  const [etat, setEtat] = useState<EtatRepull | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);

  const relire = useCallback(async () => {
    if (mode !== 'reel') return;
    try {
      const { data } = await obtenirClient().from('enregistrements').select('donnees').eq('collection', 'repull').eq('id', 'etat').maybeSingle();
      setEtat(((data as { donnees?: EtatRepull } | null)?.donnees ?? null) as EtatRepull | null);
    } catch {
      /* affichage seulement */
    }
  }, [mode]);

  useEffect(() => {
    void relire();
  }, [relire]);

  const derniere = useMemo(
    () =>
      journal
        .filter((j) => j.action === ACTION_JOURNAL_REPULL)
        .sort((a, b) => Date.parse(b.horodatage) - Date.parse(a.horodatage))[0],
    [journal],
  );

  const synchroniser = useCallback(async () => {
    if (mode !== 'reel' || enCours) return;
    setEnCours(true);
    setRetour(null);
    try {
      const { data } = await obtenirClient().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) {
        setRetour({ ton: 'danger', texte: 'Session expirée : reconnectez-vous à l’ERP.' });
        return;
      }
      const r = await fetch('/api/erp-repull-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
      });
      const corps = (await r.json().catch(() => ({}))) as Partial<ResultatLancement> & { erreur?: string };
      if (corps.etat) setEtat(corps.etat);
      if (!r.ok) {
        setRetour({ ton: 'danger', texte: corps.erreur ?? `La synchronisation a échoué (erreur ${r.status}).` });
        return;
      }
      if (corps.statut === 'limite') setRetour({ ton: 'info', texte: corps.message ?? 'Synchronisation faite il y a moins de 10 minutes.' });
      else if (corps.statut === 'budget') setRetour({ ton: 'danger', texte: corps.message ?? 'Part mensuelle des appels Repull épuisée.' });
      else if (!corps.ok) setRetour({ ton: 'alerte', texte: corps.message ?? 'Synchronisation terminée avec des erreurs.' });
      else {
        const b = corps.bilan;
        const nouveaux = b ? b.logements.crees + b.reservations.crees + b.fils.crees : 0;
        const modifies = b ? b.logements.modifies + b.reservations.modifies + b.fils.modifies : 0;
        setRetour({
          ton: 'succes',
          texte:
            (nouveaux || modifies ? `Synchronisé : ${nouveaux} nouveauté${nouveaux > 1 ? 's' : ''}, ${modifies} mise${modifies > 1 ? 's' : ''} à jour.` : 'Synchronisé : rien de nouveau.') +
            (b && !b.complet ? ' Passage partiel : la suite viendra au prochain passage.' : ''),
        });
        // Les lignes arrivent par le temps réel : on laisse le temps, puis on crée les ménages.
        window.setTimeout(() => lancerAutomatisations(), 3000);
      }
    } catch {
      setRetour({ ton: 'danger', texte: 'Serveur injoignable : vérifiez la connexion et réessayez.' });
    } finally {
      setEnCours(false);
    }
  }, [mode, enCours, lancerAutomatisations]);

  const mois = moisCourant();
  const etatDuMois = etat && etat.mois === mois ? etat : null;
  const quota = etatDuMois?.quota && etatDuMois.quota.utilise !== undefined ? etatDuMois.quota : null;

  return {
    disponible: mode === 'reel' && !lectureSeule,
    demo: mode !== 'reel',
    etat: etatDuMois,
    quota,
    derniere,
    enCours,
    retour,
    synchroniser,
  };
}

/** Carte complète (Paramètres → Intégrations). */
export function CarteSynchroRepull() {
  const s = useSynchroRepull();
  const appelsErp = s.etat?.appelsMois ?? 0;
  const budget = s.etat?.budgetMois ?? 400;
  const quotaMois = s.quota?.limite ?? s.etat?.quotaMois ?? 1000;
  const utilises = s.quota?.utilise;
  const part = budget ? appelsErp / budget : 0;
  const b = s.etat?.dernierBilan;

  return (
    <Card>
      <CardHeader
        titre="Repull : Airbnb, Booking.com et autres plateformes"
        description="Annonces, réservations, voyageurs, messages et avis arrivent seuls dans l’ERP : chaque matin, et à la demande."
        actions={
          <Button variant="primary" icone={<RefreshCw />} chargement={s.enCours} disabled={!s.disponible || s.enCours} onClick={() => void s.synchroniser()}>
            Synchroniser maintenant
          </Button>
        }
      />
      {s.demo && <Alert tone="neutre" className="mb-3">Indisponible en démo locale : la synchronisation écrit dans la base de production.</Alert>}
      {s.retour && (
        <Alert tone={s.retour.ton} className="mb-3">
          {s.retour.texte}
        </Alert>
      )}
      <dl className="grid gap-3 text-[13.5px] sm:grid-cols-2">
        <div>
          <dt className="text-[12px] text-(--lm-encre-3)">Dernière synchronisation</dt>
          <dd className="font-medium">
            {s.derniere ? dateHeure(s.derniere.horodatage) : s.etat?.derniereSynchro ? dateHeure(s.etat.derniereSynchro) : 'Jamais'}
            {b && !b.complet && (
              <Badge tone="alerte" className="ml-2">
                Partielle
              </Badge>
            )}
          </dd>
          {s.derniere && <dd className="mt-1 text-[12.5px] text-(--lm-encre-2)">{s.derniere.details}</dd>}
        </div>
        <div>
          <dt className="text-[12px] text-(--lm-encre-3)">Appels Repull ce mois</dt>
          <dd className="lm-chiffres font-medium">
            {utilises !== undefined ? `${nombre(utilises)} / ${nombre(quotaMois ?? 1000)}` : `${nombre(appelsErp)} / ${nombre(quotaMois ?? 1000)} (ERP seul)`}
          </dd>
          <dd className="mt-1 text-[12.5px] text-(--lm-encre-2)">
            Part de l’ERP : {nombre(appelsErp)} / {nombre(budget)}
            {s.quota?.luLe ? ` · compte relevé le ${dateHeure(s.quota.luLe)}` : ''}
          </dd>
          <ProgressBar className="mt-2" valeur={part} tone={part >= 1 ? 'danger' : part >= 0.8 ? 'alerte' : 'or'} label="Part mensuelle des appels Repull de l’ERP" />
        </div>
      </dl>
      <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">
        Un nouveau compte ou une nouvelle annonce ?{' '}
        <a href={URL_TABLEAU_REPULL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-(--lm-or) hover:underline">
          Connectez-le dans Repull <ExternalLink className="size-3.5" aria-hidden />
        </a>{' '}
        : il arrive ici à la synchronisation suivante. Pas plus d’une synchronisation manuelle toutes les 10 minutes, pour ménager le quota d’appels.
      </p>
    </Card>
  );
}

/** Ligne compacte (en-tête des Réservations). */
export function LigneSynchroRepull({ className }: { className?: string }) {
  const s = useSynchroRepull();
  if (s.demo) return null;
  return (
    <Alert
      tone={s.retour?.ton ?? 'neutre'}
      className={className}
      actions={
        <Button size="sm" variant="secondary" icone={<RefreshCw />} chargement={s.enCours} disabled={!s.disponible || s.enCours} onClick={() => void s.synchroniser()}>
          Synchroniser
        </Button>
      }
    >
      {s.retour?.texte ??
        (s.derniere
          ? `Airbnb et Booking.com synchronisés par Repull, dernier passage le ${dateHeure(s.derniere.horodatage)}.`
          : 'Airbnb et Booking.com : synchronisation par Repull, pas encore de passage.')}
    </Alert>
  );
}
