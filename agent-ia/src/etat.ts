/**
 * État de l'onboarding, en mémoire.
 *
 * ⚠️ PROVISOIRE. Une conversation d'onboarding s'étale sur plusieurs jours et
 * doit reprendre là où elle s'est arrêtée ; en serverless, cette mémoire meurt
 * à chaque démarrage à froid. Supabase la remplace à l'étape 1 bis — les tables
 * `conciergeries`, `logements` et `onboarding` du README.
 *
 * Ce module existe pour pouvoir tester la conversation dès maintenant, sans
 * attendre la base.
 */

export type Logement = {
  id: string; // property_id Channex
  titre: string;
  airbnbConnecte: boolean;
  bookingConnecte: boolean;
};

export type Conciergerie = {
  chatId: string;
  nom: string;
  groupId: string; // group_id Channex
  logements: Logement[];
};

const parChatId = new Map<string, Conciergerie>();

export const conciergerieDe = (chatId: string | number): Conciergerie | undefined =>
  parChatId.get(String(chatId));

export const enregistrerConciergerie = (c: Conciergerie): void => {
  parChatId.set(c.chatId, c);
};

export const logementPar = (c: Conciergerie, nom: string): Logement | undefined => {
  const n = nom.trim().toLowerCase();
  return (
    c.logements.find((l) => l.titre.toLowerCase() === n) ??
    c.logements.find((l) => l.titre.toLowerCase().includes(n))
  );
};
