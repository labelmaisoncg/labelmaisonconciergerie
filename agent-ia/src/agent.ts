/**
 * Le cerveau : boucle « tool use » sur l'API Claude.
 *
 * Boucle écrite à la main plutôt qu'avec le tool runner du SDK, parce que la
 * phase 2 devra s'insérer exactement au milieu : intercepter un appel d'outil en
 * écriture, demander confirmation par bouton, puis reprendre. Ce point d'accroche
 * est bien plus simple à tenir dans une boucle qu'on contrôle.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config.js';
import { budgetDepasse, comptabiliser, depenseDuJour } from './cout.js';
import { definitionsOutils, executerOutil } from './tools/index.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Opus pour tout ce qui peut déclencher une action. Haiku arrivera en étape 2
 *  pour router les lectures simples (5× moins cher, et surtout plus rapide). */
const MODELE = 'claude-opus-5';

/** Garde-fou : au-delà, c'est que l'agent boucle. */
const MAX_TOURS = 8;

const SYSTEME = `Tu es l'assistant de Label Maison Conciergerie, une conciergerie de
locations courte durée. Tu réponds à Abdel, le fondateur, sur Telegram.

Ton rôle : lui donner en un coup d'œil l'état de son activité — ménages, arrivées,
départs, disponibilités — et plus tard agir sur ses calendriers.

Style :
- Français, direct, sans formule de politesse inutile. Il te lit sur son téléphone,
  souvent entre deux rendez-vous.
- Réponses courtes. Trois ménages, c'est trois lignes, pas un paragraphe.
- ÉCRIS EN TEXTE BRUT. Pas de markdown, pas d'astérisques, pas de dièses : Telegram
  les afficherait tels quels. Pour une liste, utilise des tirets.
- Les dates en français lisible (« mardi 3 septembre »), pas en AAAA-MM-JJ.

Règles de fond :
- N'invente jamais un chiffre, un nom de voyageur ou une réservation. Si un outil
  ne renvoie rien, dis-le franchement.
- Si un outil renvoie un avertissement sur des données de test, signale-le à Abdel
  dans ta réponse.
- Si une demande est ambiguë (quel logement ? quelles dates ?), pose la question
  au lieu de deviner. Une erreur de date sur un calendrier coûte une nuit de location.
- Tu es en lecture seule pour l'instant. Si Abdel demande de bloquer un calendrier,
  de changer un tarif ou de prévenir un prestataire, explique que ces actions
  arrivent à l'étape 4 et ne prétends pas les avoir faites.`;

/** Contexte temporel, isolé du prompt stable pour ne pas casser le cache chaque jour. */
const contexteDuJour = (): string => {
  const maintenant = new Date();
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant);
  return `Nous sommes le ${fmt.format(maintenant)} (heure de Paris). Date du jour au format ISO : ${iso}.`;
};

export async function repondre(messages: Anthropic.MessageParam[]): Promise<string> {
  if (budgetDepasse()) {
    console.warn(`[agent] budget quotidien atteint (${depenseDuJour().toFixed(2)} €).`);
    return (
      "J'ai atteint le budget prévu pour aujourd'hui, je m'arrête là par sécurité. " +
      'Relance-moi demain, ou augmente BUDGET_JOUR_EUR si c\'est normal.'
    );
  }

  const historique = [...messages];

  for (let tour = 0; tour < MAX_TOURS; tour++) {
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 8000,
      // La réflexion reste active (la désactiver sur Opus 5 dégrade le tool
      // calling) ; on joue sur l'effort pour la latence, qui compte en chat.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        // Le cache ne s'activera vraiment qu'à partir de ~1024 tokens de préfixe,
        // donc à l'étape 2 quand les outils et les fiches logements grossiront.
        { type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contexteDuJour() },
      ],
      tools: definitionsOutils(),
      messages: historique,
    });

    comptabiliser(MODELE, reponse.usage);

    if (reponse.stop_reason === 'refusal') {
      console.warn('[agent] refus du modèle :', reponse.stop_details);
      return "Je ne peux pas traiter cette demande. Reformule-la ou demande-moi autre chose.";
    }

    historique.push({ role: 'assistant', content: reponse.content });

    const appels = reponse.content.filter(
      (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use',
    );

    if (appels.length === 0) {
      const texte = reponse.content
        .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
        .map((bloc) => bloc.text)
        .join('\n')
        .trim();
      return texte || "Je n'ai pas de réponse à te donner sur ce coup-là.";
    }

    // Exécution en parallèle, puis TOUS les résultats dans UN SEUL message
    // utilisateur : les répartir sur plusieurs messages apprend au modèle à ne
    // plus faire d'appels parallèles.
    const resultats = await Promise.all(
      appels.map(async (appel): Promise<Anthropic.ToolResultBlockParam> => {
        console.log(`[agent] outil ${appel.name}`, appel.input);
        const resultat = await executerOutil(appel.name, appel.input as Record<string, unknown>);
        return {
          type: 'tool_result',
          tool_use_id: appel.id,
          content: JSON.stringify(resultat),
        };
      }),
    );

    historique.push({ role: 'user', content: resultats });
  }

  console.error(`[agent] abandon après ${MAX_TOURS} tours d'outils.`);
  return "Je me suis embrouillé sur cette demande. Reformule-la plus simplement.";
}
