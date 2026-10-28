/**
 * Démo de la page Connexions et de « Relier à une annonce » : des annonces
 * fictives, comme si Airbnb et Booking.com étaient connectés. Celles des
 * logements importés de la démo sont « déjà dans l'ERP » ; deux ne le sont
 * pas encore, dont « Maison des Coquelicots » à Linas, l'annonce de
 * « Maison de Linas », créé à la main. Aucune donnée réelle, aucun appel.
 * Chargé seulement en démo (import dynamique).
 */
import type { AnnonceDecouverte, EtatConnexions } from './repull-connexion';
import type { Logement } from './types';

/** Annonces pas encore dans l'ERP (identifiants fictifs). */
const NOUVELLES: AnnonceDecouverte[] = [
  {
    id: '219310',
    nom: 'Maison des Coquelicots',
    ville: 'Linas',
    photo: '/images/real/logement-riad-poster.jpg',
    statutRepull: 'active',
    plateformes: ['airbnb', 'booking'],
    selectionnee: false,
    importee: false,
  },
  {
    id: '219320',
    nom: 'Studio Gare de Brétigny',
    ville: 'Brétigny-sur-Orge',
    statutRepull: 'inactive',
    plateformes: ['booking'],
    selectionnee: false,
    importee: false,
  },
];

const couverture = (l: Logement): string | undefined => l.photos?.[0] ?? (/^\/|^https:\/\//.test(l.photoUrl ?? '') ? l.photoUrl : undefined);

/** État de la page Connexions pour la démo, d'après les logements de la démo. */
export function etatConnexionsDemo(logements: readonly Logement[]): EtatConnexions {
  const importees: AnnonceDecouverte[] = logements
    .filter((l) => l.repull?.id && l.statut !== 'sorti')
    .map((l) => {
      const plateformes = [...new Set(l.annonces.filter((a) => a.canal !== 'direct' && (a.connecte || l.annonces.length === 1)).map((a) => a.canal))];
      const photo = couverture(l);
      return {
        id: l.repull!.id,
        nom: l.nom,
        ville: l.ville,
        ...(photo ? { photo } : {}),
        statutRepull: 'active',
        plateformes: plateformes.length ? plateformes : ['airbnb'],
        selectionnee: !l.repull!.horsSelection,
        importee: !l.repull!.horsSelection,
        logementId: l.id,
      };
    });
  const annonces = [...importees, ...NOUVELLES.filter((a) => !importees.some((x) => x.id === a.id))];
  return {
    ok: true,
    fournisseurs: [],
    connexions: [
      { id: 'demo-airbnb', fournisseur: 'airbnb', statut: 'active', nom: 'Compte hôte de démonstration' },
      { id: 'demo-booking', fournisseur: 'booking', statut: 'active', nom: 'Établissement de démonstration' },
    ],
    annonces,
    selection: annonces.filter((a) => a.selectionnee).map((a) => a.id),
    limite: null,
    offre: 'custom',
    sourceLimite: 'repull',
    avertissements: [],
    appels: { mois: 0, budget: 0 },
  };
}
