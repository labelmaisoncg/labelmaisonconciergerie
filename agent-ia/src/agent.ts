/**
 * Le cerveau : boucle « tool use » sur l'API Claude.
 *
 * Boucle écrite à la main plutôt qu'avec le tool runner du SDK, parce que la
 * confirmation par bouton doit s'insérer exactement au milieu : un outil en
 * écriture dépose une action en attente, la boucle s'arrête, le bot demande
 * confirmation, et l'exécution n'a lieu qu'après le clic. Ce point d'accroche
 * est bien plus simple à tenir dans une boucle qu'on contrôle.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from './config.js';
import { budgetDepasse, comptabiliser, depenseDuJour } from './cout.js';
import { definitionsOutils, executerOutil } from './tools/index.js';
import type { Contexte } from './tools/index.js';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Opus pour la conversation propriétaire et toute écriture. Haiku est réservé
 *  aux réponses voyageurs (cf. messagerie.ts), où le volume fait le coût. */
const MODELE = 'claude-opus-5';

/** Garde-fou : au-delà, c'est que l'agent boucle. */
const MAX_TOURS = 8;

const SYSTEME = `Tu es l'assistant d'exploitation d'une conciergerie de locations
courte durée, joignable sur Telegram. Tu es édité par Label Maison Conciergerie.

Tu gères deux choses : la configuration, puis le quotidien.

CONFIGURATION — ta priorité tant qu'elle n'est pas finie
Rien n'est possible avant d'avoir accès aux données. Dans cet ordre :
1. Le nom de la conciergerie → creer_conciergerie
2. Les logements, un par un → ajouter_logement
3. Le lien Airbnb de chaque logement → lien_connexion
4. Puis le lien Booking → lien_connexion. Lance-le tôt : sa validation prend
   plusieurs jours, autant qu'elle tourne pendant le reste.
5. Après chaque clic annoncé, vérifie → verifier_connexion
6. Les infos que l'API ne donne pas → enregistrer_infos_logement
   (code de boîte à clés, wifi, horaires, consignes)
7. Le livret d'accueil → importer_connaissances

Ne demande jamais ce que tu pourras déduire une fois les comptes connectés :
les annonces, les réservations, les voyageurs. Demande le reste.
Si tu ne sais plus où tu en es, appelle etat_configuration avant de répondre.

QUOTIDIEN — une fois la configuration faite
Ménages, arrivées, départs, planning, disponibilités, fiches logement, et le
blocage des calendriers.

Style :
- Français, direct, sans formule de politesse inutile. On te lit sur un téléphone,
  souvent entre deux rendez-vous.
- Réponses courtes. Trois ménages, c'est trois lignes, pas un paragraphe.
  Une question à la fois pendant la configuration.
- ÉCRIS EN TEXTE BRUT. Pas de markdown, pas d'astérisques, pas de dièses : Telegram
  les afficherait tels quels. Pour une liste, utilise des tirets.
- Les liens, tu les colles tels quels, sans les raccourcir ni les reformater.
- Les dates en français lisible (« mardi 3 septembre »), jamais en AAAA-MM-JJ.

Règles de fond, non négociables :
- N'invente jamais un chiffre, un nom de voyageur, une réservation ou un lien.
  Un lien de connexion ne se fabrique pas : il vient de lien_connexion.
- Si un outil renvoie un avertissement — données de test, environnement staging,
  délai Booking, fiche incomplète — répercute-le à l'utilisateur. Ne le tais jamais.
- Si une demande est ambiguë (quel logement ? quelles dates ?), pose la question
  au lieu de deviner. Une erreur de date sur un calendrier coûte une nuit de location.
- Les outils qui écrivent dans un calendrier ne s'exécutent PAS quand tu les
  appelles : ils préparent l'action et l'utilisateur doit confirmer par un bouton.
  Annonce donc ce qui va se passer, et ne prétends jamais que c'est fait.`;

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

export type Reponse = {
  texte: string;
  /** Tours à ajouter au fil, blocs d'outils compris. Sans eux, le modèle
   *  rejoue les étapes déjà faites au message suivant. */
  tours: Anthropic.MessageParam[];
  actionEnAttente?: { id: string; recap: string };
};

export async function repondre(
  messages: Anthropic.MessageParam[],
  ctx: Contexte,
): Promise<Reponse> {
  if (budgetDepasse()) {
    console.warn(`[agent] budget quotidien atteint (${depenseDuJour().toFixed(2)} €).`);
    return {
      texte:
        "J'ai atteint le budget prévu pour aujourd'hui, je m'arrête là par sécurité. " +
        "Relance-moi demain, ou augmente BUDGET_JOUR_EUR si c'est normal.",
      tours: [],
    };
  }

  const historique = [...messages];
  const nouveaux: Anthropic.MessageParam[] = [];

  for (let tour = 0; tour < MAX_TOURS; tour++) {
    const reponse = await client.messages.create({
      model: MODELE,
      max_tokens: 8000,
      // La réflexion reste active (la désactiver sur Opus 5 dégrade le tool
      // calling) ; on joue sur l'effort pour la latence, qui compte en chat.
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contexteDuJour() },
      ],
      tools: definitionsOutils(),
      messages: historique,
    });

    comptabiliser(MODELE, reponse.usage);

    if (reponse.stop_reason === 'refusal') {
      console.warn('[agent] refus du modèle :', reponse.stop_details);
      return { texte: 'Je ne peux pas traiter cette demande. Reformule-la.', tours: nouveaux };
    }

    const tourAssistant: Anthropic.MessageParam = { role: 'assistant', content: reponse.content };
    historique.push(tourAssistant);
    nouveaux.push(tourAssistant);

    const appels = reponse.content.filter(
      (bloc): bloc is Anthropic.ToolUseBlock => bloc.type === 'tool_use',
    );

    if (appels.length === 0) {
      const texte = reponse.content
        .filter((bloc): bloc is Anthropic.TextBlock => bloc.type === 'text')
        .map((bloc) => bloc.text)
        .join('\n')
        .trim();
      return {
        texte: texte || "Je n'ai pas de réponse à te donner sur ce coup-là.",
        tours: nouveaux,
        actionEnAttente: ctx.actionEnAttente,
      };
    }

    // Exécution en parallèle, puis TOUS les résultats dans UN SEUL message
    // utilisateur : les répartir sur plusieurs messages apprend au modèle à ne
    // plus faire d'appels parallèles.
    const resultats = await Promise.all(
      appels.map(async (appel): Promise<Anthropic.ToolResultBlockParam> => {
        console.log(`[agent] outil ${appel.name}`, appel.input);
        const resultat = await executerOutil(appel.name, appel.input as Record<string, unknown>, ctx);
        return {
          type: 'tool_result',
          tool_use_id: appel.id,
          content: JSON.stringify(resultat),
        };
      }),
    );

    const tourOutils: Anthropic.MessageParam = { role: 'user', content: resultats };
    historique.push(tourOutils);
    nouveaux.push(tourOutils);
  }

  console.error(`[agent] abandon après ${MAX_TOURS} tours d'outils.`);
  return { texte: 'Je me suis embrouillé sur cette demande. Reformule-la plus simplement.', tours: nouveaux };
}
