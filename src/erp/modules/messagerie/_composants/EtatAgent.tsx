/**
 * Bloc « Votre agent, en vrai » de l'onglet Configurer : ce qui est branché
 * côté serveur (clé IA, planification, Telegram — oui ou non, jamais les
 * valeurs), le dernier passage, et le bouton « Lancer l'agent maintenant ».
 *
 * Source : GET /api/erp-agent?action=etat ; bouton : POST { action: 'lancer' }.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Check, Play, RefreshCw, X } from 'lucide-react';
import { Alert, Button, Card, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import type { EtatAgent, PassageAgent } from '../../../data/agent-messagerie';
import { appelerServeur } from './serveur';

interface EtatServeur {
  ok: true;
  cles: { ia: boolean; telegram: boolean; planification: boolean; repull: boolean };
  modele: string;
  actif?: boolean;
  etat: (Omit<EtatAgent, 'verrou'> & { enCours: boolean }) | null;
  avertissement?: string;
}

/** « il y a 12 min », « il y a 3 h », « il y a 2 jours ». */
export function ilYa(horodatage: string | undefined, maintenant = Date.now()): string {
  const t = Date.parse(horodatage ?? '');
  if (!Number.isFinite(t)) return 'jamais';
  const min = Math.max(0, Math.round((maintenant - t) / 60_000));
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return `il y a ${j} jour${j > 1 ? 's' : ''}`;
}

/** Phrase courte d'un passage, pour l'équipe. */
export function resumePassage(p: PassageAgent): string {
  if (p.statut !== 'fait') return p.message;
  if (!p.repondus && !p.transmis) return p.examines ? p.message : 'Aucun message en attente.';
  return p.message;
}

function Ligne({ ok, titre, children }: { ok: boolean | null; titre: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
          ok === null ? 'bg-(--lm-neutre-lavis) text-(--lm-encre-3)' : ok ? 'bg-(--lm-succes)/15 text-(--lm-succes)' : 'bg-(--lm-alerte)/15 text-(--lm-alerte)',
        )}
      >
        {ok === false ? <X className="size-3.5" /> : <Check className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1 text-[13.5px]">
        <span className="font-medium text-(--lm-encre)">{titre}</span>
        <span className="block text-(--lm-encre-2)">{children}</span>
      </span>
    </li>
  );
}

export function EtatAgentServeur({ actifReglage }: { actifReglage: boolean }) {
  const { mode, lectureSeule } = useErp();
  const [etat, setEtat] = useState<EtatServeur | null>(null);
  const [chargement, setChargement] = useState(false);
  const [lancement, setLancement] = useState(false);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'info' | 'danger'; texte: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async () => {
    if (mode !== 'reel') return;
    setChargement(true);
    try {
      setEtat(await appelerServeur<EtatServeur>('/api/erp-agent?action=etat', 'GET'));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setChargement(false);
    }
  }, [mode]);

  useEffect(() => {
    void relire();
  }, [relire]);

  const lancer = async () => {
    setLancement(true);
    setRetour(null);
    try {
      const r = await appelerServeur<{ ok: boolean; passage: PassageAgent }>('/api/erp-agent', 'POST', { action: 'lancer' });
      const p = r.passage;
      setRetour({ ton: p.statut === 'fait' ? 'succes' : p.statut === 'erreur' || p.statut === 'budget' ? 'danger' : 'info', texte: resumePassage(p) });
      void relire();
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof Error ? e.message : String(e) });
    } finally {
      setLancement(false);
    }
  };

  if (mode !== 'reel') {
    return (
      <Card>
        <h3 className="text-[15px] font-semibold text-(--lm-encre)">Votre agent, en vrai</h3>
        <p className="mt-1 text-[13px] text-(--lm-encre-2)">Données de démonstration : l’agent ne tourne que sur l’ERP en ligne.</p>
      </Card>
    );
  }

  const c = etat?.cles;
  const dernier = etat?.etat?.dernier;
  const derniere = etat?.etat?.derniereExecution;
  const actif = etat?.actif ?? actifReglage;

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-(--lm-encre)">Votre agent, en vrai</h3>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">Ce qui est branché sur le site, et ce qu’il a fait à son dernier passage.</p>
        </div>
        <Button size="sm" variant="ghost" icone={<RefreshCw className={cn(chargement && 'animate-spin')} />} onClick={() => void relire()} disabled={chargement}>
          Actualiser
        </Button>
      </div>

      {erreur && (
        <Alert tone="danger" className="mt-3">
          {erreur}
        </Alert>
      )}

      <ul className="mt-2 divide-y divide-(--lm-bord)" aria-busy={chargement}>
        <Ligne ok={etat ? actif : null} titre={actif ? 'Agent actif' : 'Agent en pause'}>
          {actif ? 'Il répond aux voyageurs à chaque passage.' : 'Il ne répond à personne : activez-le plus haut, puis enregistrez.'}
        </Ligne>
        <Ligne ok={c ? c.ia : null} titre={c?.ia ? 'Clé IA : présente' : 'Clé IA : manquante'}>
          {c?.ia ? `Modèle ${etat?.modele}.` : 'Ajoutez ANTHROPIC_API_KEY dans Vercel (Settings → Environment Variables), puis redéployez.'}
        </Ligne>
        <Ligne ok={c ? c.repull : null} titre={c?.repull ? 'Plateformes : reliées' : 'Plateformes : non reliées'}>
          {c?.repull ? 'Les réponses partent sur Airbnb et Booking.com par Repull.' : 'REPULL_API_KEY ou ERP_PASSWORD manque dans Vercel.'}
        </Ligne>
        <Ligne ok={c ? c.planification && !!derniere : null} titre="Planification">
          {derniere ? `Dernier passage ${ilYa(derniere)}.` : 'Pas encore de passage.'}{' '}
          {c && !c.planification
            ? 'CRON_SECRET manque dans Vercel : pas de passage automatique.'
            : 'Passages automatiques toutes les 30 min de 8 h à 23 h (Supabase, supabase/erp-agent-cron.sql), et après chaque synchronisation.'}
        </Ligne>
        <Ligne ok={c ? c.telegram : null} titre={c?.telegram ? 'Telegram : branché' : 'Telegram : pas branché'}>
          {c?.telegram
            ? 'Alertes et copies des réponses envoyées au groupe de l’équipe (si « Sur Telegram » est activé plus bas).'
            : 'Facultatif : ajoutez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID dans Vercel pour être prévenu.'}
        </Ligne>
      </ul>

      {dernier && (
        <p className="mt-2 rounded-lg bg-(--lm-surface-2) px-3 py-2 text-[13px] text-(--lm-encre-2)">
          <span className="font-medium text-(--lm-encre)">Dernier passage ({ilYa(dernier.fin ?? dernier.debut)}) : </span>
          {resumePassage(dernier)}
        </p>
      )}

      {retour && (
        <Alert tone={retour.ton} className="mt-3" actions={<Button size="sm" variant="ghost" onClick={() => setRetour(null)}>OK</Button>}>
          {retour.texte}
        </Alert>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" icone={<Play />} onClick={() => void lancer()} chargement={lancement} disabled={lancement || lectureSeule || !c?.ia || etat?.etat?.enCours}>
          Lancer l’agent maintenant
        </Button>
        <span className="text-[12.5px] text-(--lm-encre-3)">
          {lectureSeule ? 'Réservé aux gérants et aux opérations.' : 'Il relève les nouveaux messages, puis répond ou vous passe la main.'}
        </span>
      </div>
      {etat?.avertissement && <p className="mt-2 text-[12.5px] text-(--lm-alerte)">{etat.avertissement}</p>}
    </Card>
  );
}
