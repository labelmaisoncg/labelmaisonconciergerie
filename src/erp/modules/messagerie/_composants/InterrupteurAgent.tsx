/**
 * Marche / pause de l'agent, comme un réglage de l'iPhone : l'interrupteur
 * de l'en-tête de la Messagerie s'applique au toucher, sans bouton
 * « Enregistrer ». Désactivé par défaut (REGLAGES_AGENT_DEFAUT) ; une fois
 * activé par un gérant, il le reste jusqu'à ce qu'un gérant le désactive
 * (rien ne le désactive à sa place).
 *
 * Activé : le réglage est d'abord écrit dans la base (enregistrerMaintenant),
 * puis l'agent passe tout de suite sur les messages en attente (48 h au plus,
 * agent-messagerie.ts) — sauf si le site n'est pas branché (clé IA,
 * plateformes) : il le dit simplement, le détail est dans « Votre agent ».
 * Ensuite il répond après chaque nouveau message reçu par la
 * synchronisation, et repasse toutes les 30 minutes. Pendant ce premier
 * passage, la pause reste possible.
 *
 * - `useMarcheAgent` : l'état et la bascule ;
 * - `InterrupteurAgent` : l'en-tête (l'interrupteur pour un gérant, la
 *   pastille d'état pour les autres).
 */
import { useEffect, useRef, useState } from 'react';
import { Interrupteur, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { nomPourSignature, reglagesAgent } from '../../../data/reglages';
import { espaceOuvert } from '../../../data/espaces';
import { horodatageMaintenant } from '../../../data/format';
import { phraseRetourPassage, reglagesAvecMarche } from '../../../data/messagerie-ia';
import type { PassageAgent } from '../../../data/agent-messagerie';
import { PastilleAgent, oublierEtatAgent, useEtatAgent } from './EtatAgent';
import { appelerServeur } from './serveur';

const NBSP = ' ';

export interface RetourMarche {
  ton: 'succes' | 'info' | 'alerte' | 'danger';
  texte: string;
  /** Lien vers « Votre agent », où se trouve le détail. */
  detail?: boolean;
}

/** Phrases du retour, en clair (jamais les messages techniques du serveur sur l'écran principal). */
export const RETOURS_MARCHE = {
  pasBranche: `Votre agent est activé, mais il ne peut pas encore répondre${NBSP}: un réglage du site manque. Le détail est dans «${NBSP}Votre agent${NBSP}».`,
  echec: 'Votre agent est activé, mais son premier passage n’a pas abouti. Il réessaiera tout seul dans 30 minutes au plus.',
  horsLigneActive: `Votre agent est activé. Le réglage part dès le retour du réseau${NBSP}; il répondra à son prochain passage.`,
  horsLignePause: `La pause part dès le retour du réseau${NBSP}; d’ici là, votre agent peut encore répondre.`,
} as const;

export function useMarcheAgent() {
  const d = useErp();
  const enregistre = reglagesAgent(d, nomPourSignature(espaceOuvert()));
  const { etat } = useEtatAgent();
  const peutChanger = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<RetourMarche | null>(null);
  // Mis en pause pendant le premier passage : son résultat ne s'affiche plus.
  const actifRef = useRef(enregistre.actif);
  useEffect(() => {
    actifRef.current = enregistre.actif;
  }, [enregistre.actif]);

  const basculer = async (actif: boolean) => {
    // La pause est toujours possible ; une nouvelle activation attend la fin du premier passage.
    if (!peutChanger || (enCours && actif)) return;
    setRetour(null);
    actifRef.current = actif;
    d.upsert('reglages', reglagesAvecMarche(enregistre, actif, { le: horodatageMaintenant(), par: d.utilisateur.nom }));
    if (d.mode !== 'reel') return;
    if (!actif) {
      const recu = await d.enregistrerMaintenant();
      if (!recu && !actifRef.current) setRetour({ ton: 'alerte', texte: RETOURS_MARCHE.horsLignePause });
      return;
    }
    setEnCours(true);
    try {
      // L'agent du site relit le réglage dans la base : il doit y être avant de le lancer.
      const recu = await d.enregistrerMaintenant();
      if (!recu) {
        if (actifRef.current) setRetour({ ton: 'info', texte: RETOURS_MARCHE.horsLigneActive });
        return;
      }
      // Site pas branché (clé IA, plateformes) : pas de passage, une phrase simple.
      if (etat && !(etat.cles.ia && etat.cles.repull)) {
        setRetour({ ton: 'alerte', texte: RETOURS_MARCHE.pasBranche, detail: true });
        return;
      }
      const r = await appelerServeur<{ ok: boolean; passage: PassageAgent }>('/api/erp-agent', 'POST', { action: 'lancer' });
      const p = r.passage;
      if (p.statut !== 'fait') {
        if (actifRef.current) setRetour({ ton: 'alerte', texte: RETOURS_MARCHE.echec, detail: true });
        return;
      }
      // Mis en pause pendant le passage : on dit seulement ce qui est parti quand même.
      const enPause = !actifRef.current;
      if (enPause && !p.repondus && !p.erreurs.length) return;
      const phrase = phraseRetourPassage(p, { enPause });
      setRetour({ ton: phrase.detail ? 'alerte' : enPause ? 'info' : 'succes', texte: phrase.texte, detail: phrase.detail });
    } catch {
      if (actifRef.current) setRetour({ ton: 'alerte', texte: RETOURS_MARCHE.echec, detail: true });
    } finally {
      oublierEtatAgent();
      setEnCours(false);
    }
  };

  return { actif: enregistre.actif, peutChanger, enCours, retour, etat, effacerRetour: () => setRetour(null), basculer };
}

/**
 * En-tête de la Messagerie : pour un gérant, l'interrupteur à la place de la
 * pastille d'état, avec son libellé (marche / pause tout de suite, le seul
 * endroit où on le règle) ; pour les autres, la pastille d'état seule.
 * `marche` : celle de la page, qui affiche le retour du premier passage sous l'en-tête.
 */
export function InterrupteurAgent({ marche: m }: { marche: ReturnType<typeof useMarcheAgent> }) {
  if (!m.peutChanger) return <PastilleAgent />;
  const branche = !m.etat || (m.etat.cles.ia && m.etat.cles.repull);
  // Court, pour tenir sur une ligne à 320 px ; mis en pause pendant le passage : « Fin du passage… » (l'activation attend).
  const libelle = m.enCours ? (m.actif ? 'En cours…' : 'Fin du passage…') : !m.actif ? 'Agent en pause' : branche ? 'Agent actif' : 'Agent pas encore branché';
  return (
    <div className="flex items-center gap-3">
      {/* Le libellé dit l'état ; l'interrupteur porte le nom du réglage (son état est lu par aria-checked). */}
      <p className={cn('text-[13px] font-medium', m.actif && !branche && !m.enCours ? 'text-(--lm-alerte)' : 'text-(--lm-encre-2)')}>
        {libelle}
      </p>
      <span className="sr-only" aria-live="polite">
        {m.enCours && m.actif ? 'Premier passage de votre agent en cours.' : ''}
      </span>
      <Interrupteur actif={m.actif} onChange={(v) => void m.basculer(v)} label="Votre agent IA" disabled={m.enCours && !m.actif} taille="grand" />
    </div>
  );
}
