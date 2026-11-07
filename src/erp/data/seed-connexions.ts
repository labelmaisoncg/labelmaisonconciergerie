/**
 * Démo de la page Connexions et de « Relier à une annonce » : des annonces
 * fictives, comme si Airbnb et Booking.com étaient connectés. Celles des
 * logements importés de la démo sont « déjà dans l'ERP » (les annonces
 * reliées d'un logement avec lui) ; trois ne le sont pas encore, dont
 * « Maison des Coquelicots » à Linas, l'annonce de « Maison de Linas », créé
 * à la main, et l'annonce Booking.com de « Juvisy Gare ». Aucune donnée
 * réelle, aucun appel.
 * Chargé seulement en démo (import dynamique).
 */
import { canauxPrincipaux, liees } from './annonces-liees';
import type { AnnonceDecouverte, EtatConnexions } from './repull-connexion';
import type { Logement } from './types';

/** Annonces pas encore dans l'ERP (identifiants fictifs). */
const NOUVELLES: AnnonceDecouverte[] = [
  // L'annonce Booking.com de « Juvisy Gare » (qui n'a que son annonce Airbnb) : la cocher demande « Est-ce le même logement ? ».
  {
    id: '219330',
    nom: 'Juvisy Gare · 2 pièces',
    ville: 'Juvisy-sur-Orge',
    photo: '/images/real/logement-suite.jpg',
    statutRepull: 'active',
    plateformes: ['booking'],
    selectionnee: false,
    importee: false,
  },
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
    .flatMap((l) => {
      const plateformes = canauxPrincipaux(l);
      const photo = couverture(l);
      const principale: AnnonceDecouverte = {
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
      // Annonces des autres plateformes reliées à ce logement : sur la même carte.
      const autres: AnnonceDecouverte[] = liees(l).map((x) => ({
        id: x.id,
        nom: x.nom ?? l.nom,
        ville: l.ville,
        statutRepull: 'active',
        plateformes: [x.canal],
        selectionnee: true,
        importee: true,
        logementId: l.id,
      }));
      return [principale, ...autres];
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
