/**
 * Repères locaux et saisonniers utilisés par le générateur d'annonces.
 *
 * Uniquement des faits stables et vérifiables (lieux, gares, sites connus).
 * Aucun événement daté inventé : un événement ponctuel (salon, concert) ne
 * s'ajoute ici qu'une fois confirmé par l'équipe.
 */

export type Saison = 'hiver' | 'printemps' | 'ete' | 'automne';

export const LIBELLES_SAISON: Record<Saison, string> = {
  hiver: 'Hiver',
  printemps: 'Printemps',
  ete: 'Été',
  automne: 'Automne',
};

/** Saison d'un mois 'YYYY-MM'. */
export function saisonDuMois(mois: string): Saison {
  const m = Number(mois.slice(5, 7));
  if (m === 12 || m <= 2) return 'hiver';
  if (m <= 5) return 'printemps';
  if (m <= 8) return 'ete';
  return 'automne';
}

export interface AncrageVille {
  /** Nom court pour le titre, ex. « Évry ». */
  court: string;
  /** Repères cités dans la description (rotation d'un mois à l'autre). */
  reperes: string[];
  /** Public visé par saison : une phrase factuelle. */
  public: Partial<Record<Saison, string>>;
  /** Repère court pour le titre (≤ 18 caractères). */
  titre: string;
}

export const ANCRAGES: Record<string, AncrageVille> = {
  'Évry-Courcouronnes': {
    court: 'Évry',
    titre: 'Génopole',
    reperes: [
      'le Génopole et ses laboratoires',
      'l’université d’Évry Paris-Saclay',
      'le centre commercial Évry 2 et la cathédrale de la Résurrection',
      'le stade de Bondoufle, à quelques minutes en voiture',
    ],
    public: {
      automne: 'Idéal pour les missions au Génopole, les stages et la rentrée universitaire.',
      hiver: 'Pratique pour les formations et missions de début d’année au Génopole.',
      printemps: 'Adapté aux stages de printemps et aux déplacements professionnels.',
      ete: 'Une base calme pour visiter l’Essonne ou rejoindre Paris en RER D.',
    },
  },
  'Corbeil-Essonnes': {
    court: 'Corbeil',
    titre: 'bords de Seine',
    reperes: [
      'les quais de Seine et leurs promenades',
      'le centre historique et ses commerces',
      'la gare RER D de Corbeil-Essonnes',
      'la confluence de l’Essonne et de la Seine',
    ],
    public: {
      automne: 'Pratique pour les chantiers et missions dans le sud de l’Essonne.',
      hiver: 'Un pied-à-terre au calme pour les fêtes en famille dans la région.',
      printemps: 'Parfait pour profiter des balades le long de la Seine.',
      ete: 'Les quais se prêtent aux balades du soir et aux sorties à vélo.',
    },
  },
  Lisses: {
    court: 'Lisses',
    titre: 'au vert',
    reperes: [
      'Évry et le Génopole, à quelques minutes en voiture',
      'les zones d’activités de Lisses',
      'l’aéroport d’Orly, accessible en voiture en une trentaine de minutes',
    ],
    public: {
      automne: 'Apprécié des équipes en mission dans les zones d’activités voisines.',
      hiver: 'Au calme pour se retrouver en famille pendant les fêtes.',
      printemps: 'Le jardin se profite dès les premiers beaux jours.',
      ete: 'Le jardin privatif est un vrai plus aux beaux jours.',
    },
  },
  'Juvisy-sur-Orge': {
    court: 'Juvisy',
    titre: 'gare RER C et D',
    reperes: [
      'la gare de Juvisy, desservie par les RER C et D',
      'l’aéroport d’Orly, tout proche',
      'les bords de Seine et le parc de l’Observatoire Camille Flammarion',
    ],
    public: {
      automne: 'Pratique pour les déplacements pro vers Paris et Orly.',
      hiver: 'Une étape simple avant ou après un vol depuis Orly.',
      printemps: 'Paris est à moins de 20 minutes en RER.',
      ete: 'Une base économique pour visiter Paris en RER.',
    },
  },
  'Soisy-sur-Seine': {
    court: 'Soisy',
    titre: 'vue Seine',
    reperes: [
      'la forêt de Sénart pour les balades',
      'les bords de Seine et le chemin de halage',
      'le centre de Soisy et ses commerces',
    ],
    public: {
      automne: 'Les couleurs de la forêt de Sénart valent le détour en automne.',
      hiver: 'Un grand logement familial pour se retrouver pendant les fêtes.',
      printemps: 'Le chemin de halage se prête aux balades et au vélo.',
      ete: 'La terrasse face à la Seine se profite jusqu’en soirée.',
    },
  },
  Paris: {
    court: 'Paris 14e',
    titre: 'Alésia',
    reperes: [
      'le métro Alésia (ligne 4)',
      'Montparnasse et ses théâtres',
      'le parc Montsouris et la Cité internationale universitaire',
      'la rue d’Alésia et ses commerces',
    ],
    public: {
      automne: 'Idéal pour les salons et séjours pro à Paris, Montparnasse en direct par la ligne 4.',
      hiver: 'Les illuminations de Paris à quelques stations de métro.',
      printemps: 'Le parc Montsouris est à quelques minutes à pied.',
      ete: 'Un pied-à-terre parisien pour visiter la capitale.',
    },
  },
  Massy: {
    court: 'Massy',
    titre: 'gare TGV',
    reperes: [
      'la gare TGV de Massy et le RER B',
      'l’Opéra de Massy',
      'le quartier Atlantis et ses commerces',
      'le plateau de Saclay, à quelques minutes',
    ],
    public: {
      automne: 'Parfait pour les missions sur le plateau de Saclay et les trajets en TGV.',
      hiver: 'Pratique avant un départ en TGV pour les vacances.',
      printemps: 'La saison de l’Opéra de Massy se poursuit au printemps.',
      ete: 'Une étape pratique entre deux trains, Paris à 25 minutes en RER B.',
    },
  },
  Linas: {
    court: 'Linas',
    titre: 'autodrome',
    reperes: [
      'l’autodrome de Linas-Montlhéry',
      'la tour de Montlhéry',
      'la N20 pour rejoindre Paris ou Orly',
    ],
    public: {
      automne: 'Proche de l’autodrome de Linas-Montlhéry et de ses journées de roulage.',
      ete: 'Une maison avec jardin pour les séjours en groupe.',
    },
  },
};

/** Accroche de saison, rattachée aux équipements réellement présents. */
export const SAISONS: Record<Saison, { theme: string; accroche: string; phrase: string }> = {
  automne: {
    theme: 'Rentrée, télétravail et séjours pro',
    accroche: 'Cet automne : télétravail et séjours pro',
    phrase: 'En automne, le logement se prête au télétravail et aux séjours professionnels en semaine, comme aux week-ends cocooning.',
  },
  hiver: {
    theme: 'Fêtes de fin d’année et marchés de Noël',
    accroche: 'Pour les fêtes : un chez-soi chaleureux près des vôtres',
    phrase: 'En hiver, c’est une base confortable pour les fêtes en famille et les marchés de Noël de la région.',
  },
  printemps: {
    theme: 'Week-ends de printemps et stages',
    accroche: 'Au printemps : week-ends au calme et séjours pro',
    phrase: 'Au printemps, profitez des week-ends prolongés et des balades dans les environs.',
  },
  ete: {
    theme: 'Vacances d’été et visites de Paris',
    accroche: 'Cet été : une base pratique pour Paris et l’Essonne',
    phrase: 'En été, c’est une base pratique pour visiter Paris et l’Essonne sans payer le prix de la capitale.',
  },
};
