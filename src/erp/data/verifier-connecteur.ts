/**
 * Vérification des règles pures du connecteur Claude (src/erp/data/oauth-regles.ts)
 * qui décident de QUI connecte Claude : comptes techniques (serveur, compte
 * d'équipe de la configuration) jamais, et « Connecté par … » de la fenêtre
 * « Connecter à Claude ». Le serveur (routes, jetons) : scripts/verifier-espaces-serveur.ts.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-connecteur.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-connecteur.mjs \
 *     && node /tmp/verifier-connecteur.mjs
 */
import { EMAIL_EQUIPE } from './config';
import { EMAIL_SERVEUR } from './espaces';
import {
  MESSAGE_AUTORISER_COMPTE_TECHNIQUE,
  MESSAGE_OAUTH_COMPTE_TECHNIQUE,
  PHRASE_COMPTE_TECHNIQUE,
  connectePar,
  estCompteTechnique,
} from './oauth-regles';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string, detail?: unknown) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}

const EQUIPE = 'equipe@labelmaisoncg.fr';

function main() {
  // Adresses de la configuration (sans VITE_ERP_EMAIL_EQUIPE : l'adresse d'avant).
  verifier(EMAIL_EQUIPE === EQUIPE, 'compte d’équipe par défaut : equipe@labelmaisoncg.fr', EMAIL_EQUIPE);
  verifier(EMAIL_SERVEUR === 'serveur@labelmaisoncg.fr', 'compte serveur : serveur@labelmaisoncg.fr', EMAIL_SERVEUR);

  // Comptes techniques : le serveur et le compte d'équipe, casse et espaces ignorés.
  verifier(estCompteTechnique(EQUIPE, EMAIL_EQUIPE), 'compte d’équipe : technique');
  verifier(estCompteTechnique(EMAIL_SERVEUR, EMAIL_EQUIPE), 'compte serveur : technique');
  verifier(estCompteTechnique('Equipe@LabelMaisonCG.fr', EMAIL_EQUIPE) && estCompteTechnique('SERVEUR@labelmaisoncg.FR', EMAIL_EQUIPE), 'majuscules : toujours techniques');
  verifier(
    estCompteTechnique('  equipe@labelmaisoncg.fr\n', EMAIL_EQUIPE) && estCompteTechnique(' serveur@labelmaisoncg.fr\t', EMAIL_EQUIPE) && estCompteTechnique('equipe @labelmaisoncg.fr', EMAIL_EQUIPE),
    'espaces (début, fin, insécable, au milieu) : retirés',
  );
  verifier(estCompteTechnique(EQUIPE, '  EQUIPE@labelmaisoncg.fr '), 'adresse d’équipe de la configuration : comparée de la même façon');
  for (const email of ['abdel@exemple.invalid', 'gerant-lm@exemple.invalid', 'equipe@exemple.invalid', 'equipe@labelmaisoncg.fr.exemple.invalid', 'xequipe@labelmaisoncg.fr', 'serveur@exemple.invalid', 'serveur', '']) {
    verifier(!estCompteTechnique(email, EMAIL_EQUIPE), `« ${email} » : pas un compte technique`);
  }
  verifier(!estCompteTechnique(undefined, EMAIL_EQUIPE) && !estCompteTechnique(null, EMAIL_EQUIPE) && !estCompteTechnique(42, EMAIL_EQUIPE), 'pas une adresse : pas un compte technique');

  // Adresse d'équipe surchargée (VITE_ERP_EMAIL_EQUIPE) : c'est elle qui compte, le serveur reste technique.
  const SURCHARGE = 'Compte-Commun@Exemple.invalid';
  verifier(estCompteTechnique('compte-commun@exemple.invalid', SURCHARGE) && estCompteTechnique(' COMPTE-COMMUN@exemple.invalid ', SURCHARGE), 'adresse d’équipe surchargée : technique (casse, espaces)');
  verifier(!estCompteTechnique(EQUIPE, SURCHARGE), 'adresse d’équipe surchargée : l’adresse par défaut n’est plus le compte d’équipe');
  verifier(estCompteTechnique(EMAIL_SERVEUR, SURCHARGE), 'adresse d’équipe surchargée : le compte serveur reste technique');
  verifier(!estCompteTechnique('abdel@exemple.invalid', '') && estCompteTechnique(EMAIL_SERVEUR, '') && !estCompteTechnique('', ''), 'adresse d’équipe vide : seul le compte serveur est technique');

  // Messages : français, apostrophes typographiques, espace insécable avant « : ».
  for (const [nom, texte] of [
    ['refus de « Autoriser »', MESSAGE_AUTORISER_COMPTE_TECHNIQUE],
    ['refus du code ou du jeton', MESSAGE_OAUTH_COMPTE_TECHNIQUE],
    ['phrase des écrans', PHRASE_COMPTE_TECHNIQUE],
  ] as const) {
    verifier(!/'/.test(texte) && !/ [:?!%]/.test(texte) && / :/.test(texte), `${nom} : typographie française`, texte);
  }
  verifier(
    MESSAGE_AUTORISER_COMPTE_TECHNIQUE === 'Le compte technique ne peut pas connecter Claude : connectez-vous à l’ERP avec votre propre compte de gérant, puis relancez la connexion depuis Claude.',
    'refus de « Autoriser » : le texte prévu',
  );
  verifier(MESSAGE_OAUTH_COMPTE_TECHNIQUE === 'Connexion faite avec le compte technique : reconnectez Claude avec votre propre compte de gérant.', 'refus du jeton : le texte prévu');
  verifier(PHRASE_COMPTE_TECHNIQUE === 'Vous êtes connecté avec le compte technique : connectez-vous avec votre propre compte pour relier Claude.', 'phrase des écrans : le texte prévu');

  // « Connecté par … » : vous, le nom connu, sinon l'adresse.
  const noms: Record<string, string> = { 'abdel@exemple.invalid': 'Abdel', 'kamel@exemple.invalid': 'Kamel' };
  const nom = (email: string) => noms[email] ?? email;
  verifier(connectePar(['abdel@exemple.invalid'], 'Abdel@Exemple.invalid', nom) === 'Connecté par vous', 'connecté par la personne connectée : « Connecté par vous »');
  verifier(connectePar(['kamel@exemple.invalid'], 'abdel@exemple.invalid', nom) === 'Connecté par Kamel', 'connecté par un autre gérant : son nom');
  verifier(connectePar(['inconnu@exemple.invalid'], 'abdel@exemple.invalid', nom) === 'Connecté par inconnu@exemple.invalid', 'nom inconnu de l’ERP : l’adresse');
  verifier(
    connectePar(['kamel@exemple.invalid', 'abdel@exemple.invalid', 'ABDEL@exemple.invalid '], 'abdel@exemple.invalid', nom) === 'Connecté par vous et Kamel',
    'plusieurs gérants : vous d’abord, chacun une fois',
  );
  verifier(
    connectePar(['kamel@exemple.invalid', 'inconnu@exemple.invalid', 'autre@exemple.invalid'], 'abdel@exemple.invalid', nom) === 'Connecté par Kamel, inconnu@exemple.invalid et autre@exemple.invalid',
    'trois gérants : « , » puis « et »',
  );
  verifier(connectePar([], 'abdel@exemple.invalid', nom) === null && connectePar(['', '  '], 'abdel@exemple.invalid', nom) === null, 'personne à nommer : rien');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
