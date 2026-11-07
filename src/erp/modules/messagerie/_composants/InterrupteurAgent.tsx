/**
 * Marche / pause de l'agent, comme un réglage de l'iPhone : l'interrupteur
 * s'applique au toucher, sans bouton « Enregistrer ». Éteint par défaut
 * (REGLAGES_AGENT_DEFAUT) ; une fois allumé par un gérant, il le reste
 * jusqu'à ce qu'un gérant l'éteigne (rien ne l'éteint à sa place).
 *
 * Allumé : le réglage est d'abord écrit dans la base (enregistrerMaintenant),
 * puis l'agent passe tout de suite sur les messages en attente (48 h au plus,
 * agent-messagerie.ts) ; ensuite il répond après chaque nouveau message
 * reçu par la synchronisation, et repasse toutes les 30 minutes.
 *
 * - `useMarcheAgent` : l'état et la bascule, partagés par l'en-tête de la
 *   Messagerie et l'onglet « Votre agent » ;
 * - `InterrupteurAgent` : l'en-tête (interrupteur pour un gérant, la
 *   pastille d'état pour les autres).
 */
import { useState } from 'react';
import { Interrupteur, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { nomPourSignature, reglagesAgent } from '../../../data/reglages';
import { espaceOuvert } from '../../../data/espaces';
import { horodatageMaintenant } from '../../../data/format';
import { reglagesAvecMarche } from '../../../data/messagerie-ia';
import type { PassageAgent } from '../../../data/agent-messagerie';
import { PastilleAgent, oublierEtatAgent, resumePassage, useEtatAgent } from './EtatAgent';
import { appelerServeur } from './serveur';

export interface RetourMarche {
  ton: 'succes' | 'info' | 'danger';
  texte: string;
}

export function useMarcheAgent() {
  const d = useErp();
  const enregistre = reglagesAgent(d, nomPourSignature(espaceOuvert()));
  const peutChanger = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<RetourMarche | null>(null);

  const basculer = async (actif: boolean) => {
    if (!peutChanger || enCours) return;
    setRetour(null);
    d.upsert('reglages', reglagesAvecMarche(enregistre, actif, { le: horodatageMaintenant(), par: d.utilisateur.nom }));
    if (d.mode !== 'reel') return;
    setEnCours(true);
    try {
      // L'agent du site relit le réglage dans la base : il doit y être avant de le lancer.
      const recu = await d.enregistrerMaintenant();
      if (!actif) return;
      if (!recu) {
        setRetour({ ton: 'info', texte: 'Votre agent est allumé. Le réglage part dès le retour du réseau ; il répondra à son prochain passage.' });
        return;
      }
      const r = await appelerServeur<{ ok: boolean; passage: PassageAgent }>('/api/erp-agent', 'POST', { action: 'lancer' });
      const p = r.passage;
      setRetour({
        ton: p.statut === 'fait' ? 'succes' : p.statut === 'erreur' || p.statut === 'budget' ? 'danger' : 'info',
        texte: p.statut === 'fait' ? `Votre agent est allumé. ${resumePassage(p)}` : resumePassage(p),
      });
    } catch (e) {
      setRetour({ ton: 'danger', texte: `Votre agent est allumé, mais son premier passage a échoué : ${e instanceof Error ? e.message : String(e)} Il réessaiera à son prochain passage.` });
    } finally {
      oublierEtatAgent();
      setEnCours(false);
    }
  };

  return { actif: enregistre.actif, peutChanger, enCours, retour, effacerRetour: () => setRetour(null), basculer };
}

/**
 * En-tête de la Messagerie : pour un gérant, l'état et l'interrupteur
 * (marche / pause tout de suite) ; pour les autres, la pastille d'état seule.
 * `marche` : celle de la page, qui affiche le retour du premier passage sous l'en-tête.
 */
export function InterrupteurAgent({ marche: m }: { marche: ReturnType<typeof useMarcheAgent> }) {
  const { etat } = useEtatAgent();
  if (!m.peutChanger) return <PastilleAgent />;
  const branche = !etat || (etat.cles.ia && etat.cles.repull);
  const libelle = !m.actif ? 'Agent en pause' : branche ? 'Agent actif' : 'Agent pas encore branché';
  return (
    <div className="flex items-center gap-3">
      <p role="status" className="inline-flex items-center gap-2 text-[13px] font-medium text-(--lm-encre-2)">
        <span aria-hidden className={cn('size-2 rounded-full', m.actif && branche ? 'bg-(--lm-succes)' : 'bg-(--lm-alerte)')} />
        {libelle}
      </p>
      <Interrupteur actif={m.actif} onChange={(v) => void m.basculer(v)} label="Activer votre agent" disabled={m.enCours} taille="grand" />
    </div>
  );
}
