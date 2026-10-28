/**
 * Auto-contrôle des textes d'annonce (cahier A6), sans réseau :
 *   - limites des plateformes écrites avec leur source (Airbnb 50 / 500,
 *     Booking.com 3 à 255) ;
 *   - pour chaque logement de la démo : 3 titres différents et 1 description,
 *     dans les limites d'Airbnb ET de Booking.com, sans aucun problème ;
 *     « autres textes » (variante) toujours valides ;
 *   - garde-fous : équipement absent de la fiche (négations comprises),
 *     promesse, coordonnée, lien, nom d'une plateforme, code d'accès ou wifi,
 *     adresse exacte, nom du propriétaire, emoji, symbole refusé par
 *     Booking.com, majuscules, 6 chiffres de suite ; « télévision » n'est pas
 *     « tél » ;
 *   - rédaction par l'IA (faux Claude, fausse base) : faits sûrs seulement
 *     (ni wifi, ni accès, ni adresse, ni propriétaire), texte refusé remplacé
 *     par celui de la fiche, réponse illisible, plafond du mois compté et
 *     respecté, IA absente, logement inconnu ;
 *   - rien vers les plateformes : aucune écriture d'annonce, aucune nouvelle
 *     fonction Vercel, une seule ligne d'enregistrement dans api/erp-agent.ts.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-annonces.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-annonces.mjs \
 *     && node /tmp/verifier-annonces.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import { COLLECTION_AGENT, ID_ETAT_AGENT, type ClientIA, type EtatAgent } from './agent-messagerie';
import { ErreurAssistant, type OptionsAssistant } from './agent-assistant';
import { ACTION_TEXTES_ANNONCE, FENETRE_TEXTES_MS, MESSAGE_REDACTION_INDISPONIBLE, MESSAGE_TROP_DE_DEMANDES, TEXTES_PAR_QUART_D_HEURE, freinTextesAnnonce, proposerTextesAnnonceIA } from './annonce-ia';
import { DESCRIPTION_MAX, DESCRIPTION_MIN, LIMITES_PLATEFORMES, NOMBRE_TITRES, TITRE_MAX } from '../annonces/limites';
import {
  compteurs,
  contexteAnnonceIA,
  controlerDescription,
  controlerTextes,
  controlerTitre,
  equipementsInventes,
  finaliserTextes,
  libelleCompteur,
  lireTextesIA,
  longueur,
  proposerTextesAnnonce,
  type ContexteControle,
} from '../annonces/textes';
import { ecritureRepullPermise, BaseErp } from './repull-synchro';
import { creerSeed } from './seed';
import type { Logement, Proprietaire } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` : ${JSON.stringify(detail).slice(0, 400)}`}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

/* ------------------------------------------------------------ fichiers */

type Fs = { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean; readdirSync: (p: string) => string[] };
type Chemins = { join: (...p: string[]) => string; dirname: (p: string) => string };
let fs: Fs;
let chemins: Chemins;
let racine = '';
const source = (f: string) => (racine ? fs.readFileSync(chemins.join(racine, f), 'utf8') : '');

/* ------------------------------------------------------ faux Claude et base */

class FausseIA implements ClientIA {
  appels: Anthropic.MessageCreateParamsNonStreaming[] = [];
  reponses: (string | Error)[] = [];
  messages = {
    create: async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      this.appels.push(p);
      const r = this.reponses.shift() ?? '{}';
      if (r instanceof Error) throw r;
      return { id: 'msg', type: 'message', role: 'assistant', model: p.model, content: [{ type: 'text', text: r, citations: null }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 500, output_tokens: 200 } } as unknown as Anthropic.Message;
    },
  };
}

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown; version: number }>();
  ecritures: { collection: string; id: string }[] = [];
  private cle = (c: string, id: string) => `${c}\u0000${id}`;
  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const methode = (init?.method ?? 'GET').toUpperCase();
    if (methode === 'GET') {
      const collection = (url.searchParams.get('collection') ?? '').replace(/^eq\./, '');
      const filtre = url.searchParams.get('id');
      const ids = filtre ? new Set(filtre.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      return json(
        [...this.lignes.values()]
          .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
          .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj_le: `v${l.version}` })),
      );
    }
    if (methode === 'PATCH') {
      const collection = (url.searchParams.get('collection') ?? '').replace(/^eq\./, '');
      const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '');
      const version = (url.searchParams.get('maj_le') ?? '').replace(/^eq\./, '');
      const l = this.lignes.get(this.cle(collection, id));
      if (!l || `v${l.version}` !== version) return json([]);
      l.donnees = (JSON.parse(String(init?.body)) as { donnees: unknown }).donnees;
      l.version++;
      this.ecritures.push({ collection, id });
      return json([{ id }]);
    }
    for (const l of JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: unknown }[]) {
      const avant = this.lignes.get(this.cle(l.collection, l.id));
      this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: l.donnees, version: (avant?.version ?? 0) + 1 });
      this.ecritures.push({ collection: l.collection, id: l.id });
    }
    return new Response(null, { status: 201 });
  };
  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: JSON.parse(JSON.stringify(e)), version: 1 });
  }
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
}

async function principal() {
  // Fichiers du dépôt (Node seulement ; noms en variables : rien n'entre dans le lot du site).
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (proc?.versions?.node) {
    const nomFs = 'node:fs';
    const nomChemins = 'node:path';
    fs = (await import(/* @vite-ignore */ nomFs)) as unknown as Fs;
    chemins = (await import(/* @vite-ignore */ nomChemins)) as unknown as Chemins;
    let dossier = proc.cwd();
    for (let i = 0; i < 6 && !fs.existsSync(chemins.join(dossier, 'package.json')); i++) dossier = chemins.dirname(dossier);
    racine = fs.existsSync(chemins.join(dossier, 'src/erp/annonces/textes.ts')) ? dossier : '';
  }
  const d = creerSeed();
  const nomProprietaire = (l: Logement) => d.proprietaires.find((p) => p.id === l.proprietaireId)?.nom ?? '';

  section('1. Limites des plateformes, avec leur source');
  {
    verifier(LIMITES_PLATEFORMES.airbnb.titre.max === 50 && LIMITES_PLATEFORMES.airbnb.description.max === 500, 'Airbnb : titre 50, description 500');
    verifier(LIMITES_PLATEFORMES.booking.titre.min === 3 && LIMITES_PLATEFORMES.booking.titre.max === 255, 'Booking.com : nom de 3 à 255 caractères');
    verifier(TITRE_MAX === 50 && DESCRIPTION_MAX === 500, 'textes proposés : la limite la plus courte des deux plateformes');
    const limites = source('src/erp/annonces/limites.ts');
    verifier(!racine || (/developers\.booking\.com/.test(limites) && /supercontrol|ownerrez|guesty/i.test(limites) && /airbnb\.com\/help/.test(limites)), 'constantes commentées avec leurs sources (Airbnb, Booking.com)');
    const c = compteurs('é'.repeat(50), 'titre');
    verifier(c.airbnb.ok && c.airbnb.longueur === 50 && !compteurs('x'.repeat(51), 'titre').airbnb.ok && compteurs('x'.repeat(51), 'titre').booking.ok, 'compteur : 50 accents tiennent, 51 dépassent Airbnb mais pas Booking.com');
    verifier(longueur('m²') === 2 && longueur('é') === 1, 'caractères comptés comme les plateformes (accent composé : un caractère)');
    // Compteur lisible sans survol (pas de title) : la ou les plateformes qui le refusent.
    const compteur = (n: number, genre: 'titre' | 'description' = 'titre') => libelleCompteur('x'.repeat(n), genre).texte;
    verifier(compteur(48) === '48 / 50 caractères · Airbnb et Booking.com', 'compteur : « 48 / 50 caractères · Airbnb et Booking.com »', compteur(48));
    verifier(compteur(52) === '52 / 50 caractères · trop long pour Airbnb' && !libelleCompteur('x'.repeat(52), 'titre').ok, 'compteur : « 52 / 50 caractères · trop long pour Airbnb »', compteur(52));
    verifier(compteur(2) === '2 caractères · trop court pour Booking.com', 'compteur : « 2 caractères · trop court pour Booking.com »', compteur(2));
    verifier(compteur(422, 'description') === '422 / 500 caractères · Airbnb et Booking.com', 'compteur de la description : « 422 / 500 caractères · Airbnb et Booking.com »', compteur(422, 'description'));
    verifier(compteur(300) === '300 / 50 caractères · trop long pour Airbnb et Booking.com' && compteur(1) === '1 caractère · trop court pour Booking.com', 'compteur : trop long pour les deux, singulier');
  }

  section('2. Démo : 3 titres et 1 description par logement, dans les limites');
  for (const l of d.logements) {
    const noms = [nomProprietaire(l)];
    for (const variante of [0, 1, 2]) {
      const t = proposerTextesAnnonce(l, { variante, noms });
      const problemes = controlerTextes(t, { logement: l, noms });
      verifier(
        t.titres.length === NOMBRE_TITRES && new Set(t.titres.map((x) => x.toLowerCase())).size === NOMBRE_TITRES && problemes.length === 0,
        `${l.nom} (variante ${variante}) : 3 titres différents, aucun problème`,
        { titres: t.titres, problemes },
      );
      verifier(t.titres.every((x) => longueur(x) <= 50 && longueur(x) >= 3) && longueur(t.description) <= 500 && longueur(t.description) >= DESCRIPTION_MIN, `${l.nom} (variante ${variante}) : limites d’Airbnb et de Booking.com`);
    }
    const a = proposerTextesAnnonce(l, { noms });
    const b = proposerTextesAnnonce(l, { noms });
    verifier(JSON.stringify(a) === JSON.stringify(b), `${l.nom} : mêmes données, mêmes textes`);
    const desc = a.description;
    verifier(desc.includes(String(l.capacite)) && /Couchage/.test(desc), `${l.nom} : la description dit pour combien et le couchage`);
    verifier(!/m2\b/.test(desc) && (!l.surfaceM2 || desc.includes('m²')), `${l.nom} : « m² » gardé tel quel`);
  }
  const lisses = d.logements.find((l) => l.id === 'log-lisses')!;
  const corbeil = d.logements.find((l) => l.id === 'log-corbeil-t2')!;
  verifier(proposerTextesAnnonce(lisses).titres.some((t) => /jardin/i.test(t)), 'l’atout de la fiche (jardin privatif) est dans un titre');
  verifier(proposerTextesAnnonce(corbeil).titres.every((t) => !/jardin|terrasse|piscine/i.test(t)), 'aucun extérieur pour un logement qui n’en a pas');
  {
    const titres = new Set([0, 1, 2].flatMap((v) => proposerTextesAnnonce(corbeil, { variante: v }).titres));
    verifier(titres.size > NOMBRE_TITRES, `« autres textes » : d’autres formulations (${titres.size} titres sur 3 variantes)`);
  }

  section('3. Garde-fous des textes');
  {
    const c: ContexteControle = { logement: corbeil, noms: [nomProprietaire(corbeil)] };
    const codes = (t: string, genre: 'titre' | 'description' = 'titre') => (genre === 'titre' ? controlerTitre(t, c) : controlerDescription(`${t} ${'Logement lumineux et bien équipé. '.repeat(6)}`, c)).map((p) => p.code);
    verifier(codes('2 pièces avec piscine à Corbeil').includes('invente'), 'piscine absente de la fiche : écartée');
    verifier(codes('Appartement climatisé à Corbeil').includes('invente'), 'climatisation absente : écartée');
    verifier(equipementsInventes('Terrasse et vue sur la Seine', corbeil).length === 2, 'terrasse et vue absentes : les deux sont citées');
    verifier(!codes('2 pièces avec wifi fibre à Corbeil').length, 'wifi fibre présent dans la fiche : accepté');
    verifier(!codes('Corbeil, télévision et cuisine équipée', 'description').length, '« télévision » n’est pas « tél » (bornes de mots sans accents)');
    verifier(codes('Le meilleur 2 pièces de Corbeil').includes('promesse') && codes('Calme garanti', 'description').includes('promesse'), 'promesses : « le meilleur », « garanti »');
    verifier(codes('Appelez le 06 12 34 56 78', 'description').includes('coordonnees'), 'téléphone : interdit');
    verifier(codes('Infos sur www.exemple.fr', 'description').includes('coordonnees') && codes('Écrivez à contact@exemple.fr', 'description').includes('coordonnees'), 'site et e-mail : interdits');
    verifier(codes('Réservez en direct pour payer moins', 'description').includes('coordonnees'), '« réservez en direct » : interdit');
    verifier(codes('Le 2 pièces préféré sur Airbnb').includes('coordonnees') && codes('Aussi sur Booking', 'description').includes('coordonnees'), 'nom d’une plateforme : interdit');
    verifier(codes('Voir le lien du guide', 'description').includes('coordonnees') && codes('WhatsApp pour vos questions', 'description').includes('coordonnees'), 'lien, messagerie extérieure : interdits');
    verifier(codes(`Wifi ${corbeil.fiche.wifiCode}`, 'description').includes('code'), 'mot de passe du wifi : jamais');
    const avecCode: Logement = { ...corbeil, fiche: { ...corbeil.fiche, acces: 'Boîte à clés, code 4821.' } };
    verifier(controlerDescription(`Arrivée autonome, code 4 8 2 1. ${'Logement lumineux et bien équipé. '.repeat(6)}`, { logement: avecCode }).some((p) => p.code === 'code'), 'code d’accès (même espacé) : jamais');
    verifier(codes('Au 12 quai des Tanneurs', 'description').includes('personnel') && codes('Joli 2 pièces quai des Tanneurs', 'description').includes('personnel'), 'adresse exacte du logement : jamais');
    verifier(codes(`Chez ${nomProprietaire(corbeil).split(' ').pop()} à Corbeil`).includes('personnel'), 'nom du propriétaire : jamais');
    const juvisy = d.logements.find((l) => l.id === 'log-juvisy')!;
    verifier(!controlerTitre('2 pièces à Juvisy-sur-Orge', { logement: juvisy, noms: ['SCI Val d’Orge Patrimoine'] }).length, 'un mot du nom qui est aussi celui du lieu (« Orge ») ne compte pas');
    verifier(codes('2 pièces 🌿 à Corbeil').includes('forme') && codes('2 PIÈCES À CORBEIL').includes('forme'), 'titre : ni emoji ni tout en majuscules');
    verifier(codes('2 pièces : Corbeil').includes('forme') && codes('2 pièces. Corbeil').includes('forme') && codes('2 pièces | Corbeil').includes('forme'), 'titre : symboles refusés par Booking.com (« : », « . », « | »)');
    verifier(codes('Studio 123456 Corbeil').includes('coordonnees') && !codes('Studio 2 pièces 4 voyageurs').includes('coordonnees'), 'titre : plus de 5 chiffres de suite refusés (numéro de téléphone)');
    verifier(codes('Joli — 2 pièces', 'description').includes('forme'), 'tiret long : jamais');
    verifier(codes('x'.repeat(51)).includes('longueur') && controlerDescription('Trop court.', c).some((p) => p.code === 'longueur') && controlerDescription('a '.repeat(260), c).some((p) => p.code === 'longueur'), 'longueurs : titre au-delà de 50, description trop courte ou au-delà de 500');
    // Négations de la fiche : « Pas de parking privé », « Animaux non admis ».
    const sansParking: Logement = {
      ...corbeil,
      fiche: { ...corbeil.fiche, parking: 'Pas de parking privé, stationnement payant', regles: 'Animaux non admis.' },
      descriptif: { ...corbeil.descriptif, conditions: { ...corbeil.descriptif?.conditions, animaux: false } },
    };
    verifier(equipementsInventes('Parking privé sur place, animaux acceptés', sansParking).length === 2, 'négations de la fiche : « pas de parking privé », « animaux non admis » ne valent pas atout');
    const avecParking: Logement = { ...corbeil, fiche: { ...corbeil.fiche, parking: 'Place privée dans la cour' } };
    verifier(!equipementsInventes('Parking privé sur place', avecParking).length && proposerTextesAnnonce(avecParking).description.includes('Parking privé sur place'), 'parking à soi dans la fiche : « parking privé » permis et cité');
    const vide: Logement = { ...corbeil, fiche: { ...corbeil.fiche, equipements: [] }, ville: 'Inconnue-sur-Mer' };
    const tv = proposerTextesAnnonce(vide);
    verifier(tv.remarques.some((r) => /équipements/.test(r)) && tv.remarques.some((r) => /repères/.test(r)) && controlerTextes(tv, { logement: vide }).length === 0, 'fiche pauvre : textes valides et remarques pour la compléter', tv);
  }

  section('4. Rédaction par l’IA : faits sûrs, textes relus');
  {
    const l = corbeil;
    const ctx = contexteAnnonceIA({ ...l, fiche: { ...l.fiche, acces: 'Boîte à clés, code 4821.', aSavoir: 'Digicode 2468' } });
    verifier(!ctx.includes(l.fiche.wifiCode) && !ctx.includes(l.fiche.wifiNom) && !ctx.includes('4821') && !ctx.includes('2468'), 'contexte : ni wifi, ni accès, ni codes');
    verifier(!ctx.includes(l.adresse) && !ctx.includes(nomProprietaire(l)) && !/Tanneurs/.test(ctx), 'contexte : ni adresse, ni propriétaire');
    // Audit : un code court (3 chiffres) dans le texte libre du parking ne part jamais à l'IA ; seule la catégorie part.
    const portail: Logement = { ...l, fiche: { ...l.fiche, parking: 'Portail du parking : code 482, badge dans la boîte', acces: 'Boîte à clés code 0912' } };
    const ctxPortail = contexteAnnonceIA(portail);
    verifier(!/482|0912|badge|portail/i.test(ctxPortail), 'parking « Portail du parking : code 482 » : ni le code ni le texte libre envoyés à l’IA', ctxPortail.split('\n').filter((x) => /Stationnement/.test(x)));
    const categorie = (parking: string) => contexteAnnonceIA({ ...l, fiche: { ...l.fiche, parking } }).split('\n').find((x) => /Stationnement/.test(x)) ?? '';
    verifier(
      categorie('Place privée dans la cour, portail code 482') === '- Stationnement : parking privé sur place' &&
        categorie('Parking payant à 200 m, code 391 à l’entrée') === '- Stationnement : parking payant à proximité' &&
        categorie('Gratuit dans la rue, place 12') === '- Stationnement : stationnement gratuit dans la rue' &&
        categorie('Voir avec la gardienne, interphone 45B') === '',
      'stationnement : seulement une catégorie (parking privé, payant à proximité, gratuit dans la rue), jamais le texte de la fiche',
    );
    // Autres champs libres envoyés : textes de l'annonce actuelle (titre, description, quartier), équipements, couchage.
    const libres: Logement = {
      ...l,
      fiche: { ...l.fiche, equipements: [...l.fiche.equipements, 'Wifi (code 913)', 'Box, mot de passe soleil'] },
      descriptif: {
        ...l.descriptif,
        titre: 'Joli 2 pièces, digicode 4B7',
        textes: { ...l.descriptif?.textes, description: 'Appartement lumineux. Le portail s’ouvre avec le code 482. Cuisine équipée.', quartier: 'Quartier calme. Cadenas du local vélo : 091.' },
        couchage: [{ piece: 'Chambre', lits: '1 lit double' }, { piece: 'Placard', lits: 'Clés de secours, code 775' }],
      },
    };
    const ctxLibres = contexteAnnonceIA(libres);
    verifier(!/482|913|4b7|091|775|soleil|portail|cadenas|digicode|mot de passe/i.test(ctxLibres) && /Appartement lumineux/.test(ctxLibres) && /Cuisine équipée/.test(ctxLibres) && /Quartier calme/.test(ctxLibres), 'champs libres : les phrases qui parlent d’un accès sont retirées, le reste est gardé', ctxLibres);
    // Ce que rend l'IA : un code court cité, ou recopié de la fiche, est écarté.
    const cite = `Appartement lumineux de 40 m² à Corbeil, pour 4 voyageurs. Arrivée autonome par boîte à clés à partir de 16 h. Le portail du parking s’ouvre avec le code 482. Wifi sur place. `.repeat(2);
    verifier(controlerDescription(cite, { logement: portail }).some((p) => p.code === 'code'), 'description qui cite « code 482 » : écartée (code)');
    verifier(controlerDescription(`Appartement lumineux à Corbeil. Le portail s’ouvre avec le 482. ${'Logement bien équipé. '.repeat(8)}`, { logement: portail }).some((p) => p.code === 'code'), 'le code court de la fiche recopié sans le mot « code » : écarté');
    verifier(!controlerDescription(`Appartement de 40 m² avec wifi fibre 1000 Mb/s, à 300 m de la gare. ${'Logement lumineux et bien équipé. '.repeat(6)}`, { logement: portail }).some((p) => p.code === 'code'), 'surface, débit, distance : pas pris pour un code');
    verifier(l.fiche.equipements.filter((e) => !/fer à repasser/i.test(e)).every((e) => ctx.includes(e)) && /liste fermée/.test(ctx), 'contexte : la liste fermée des équipements');
    const brut = {
      titres: ['2 pièces avec piscine à Corbeil', 'Corbeil bords de Seine, 2 pièces lumineux', 'Appelez-nous au 0612345678', '2 pièces lumineux, wifi fibre, Corbeil.'],
      description: `Appartement lumineux à Corbeil. Contactez-nous au 06 12 34 56 78. ${'Idéal pour quatre voyageurs. '.repeat(10)}`,
    };
    const f = finaliserTextes(brut, l, { noms: [nomProprietaire(l)] });
    verifier(f.titres.length === 3 && controlerTextes(f, { logement: l, noms: [nomProprietaire(l)] }).length === 0, 'après les garde-fous : 3 titres et une description valides', f);
    verifier(!f.titres.some((t) => /piscine|0612/.test(t)) && f.titres.includes('Corbeil bords de Seine, 2 pièces lumineux') && f.titres.includes('2 pièces lumineux, wifi fibre, Corbeil'), 'titre inventé ou avec un numéro écarté ; point final retiré, bons titres gardés', f.titres);
    verifier(f.sources.titres.join() === 'ia,ia,fiche' && f.sources.description === 'fiche' && f.ecartes.length === 3, 'sources et textes écartés notés', f);
    verifier(!/06 12/.test(f.description), 'description avec une coordonnée : remplacée par celle de la fiche');
    verifier(lireTextesIA({ content: [{ type: 'text', text: '```json\n{"titres":["A b c"],"description":"x"}\n```' }], stop_reason: 'end_turn' })?.titres[0] === 'A b c', 'réponse entre balises de code : lue');
    verifier(lireTextesIA({ content: [{ type: 'text', text: 'Je ne peux pas.' }] }) === null && lireTextesIA({ content: [{ type: 'text', text: '{}' }], stop_reason: 'refusal' }) === null, 'réponse illisible ou refus : rien');
    const illisible = finaliserTextes(null, l);
    verifier(illisible.titres.length === 3 && illisible.sources.description === 'fiche' && controlerTextes(illisible, { logement: l }).length === 0, 'IA illisible : les textes de la fiche');
  }

  section('5. Action du serveur (faux Claude, fausse base, plafond)');
  {
    const b = new FausseBase();
    const ia = new FausseIA();
    const l = corbeil;
    b.poser<Logement>('logements', l);
    b.poser<Proprietaire>('proprietaires', d.proprietaires.find((p) => p.id === l.proprietaireId)!);
    const options = (extra: Partial<OptionsAssistant> = {}): OptionsAssistant => ({
      base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: b.fetch as typeof fetch, jeton: async () => 'jeton' }),
      ia,
      par: 'abdel@exemple.invalid',
      maintenant: () => new Date('2026-10-27T10:00:00Z'),
      ...extra,
    });
    ia.reponses.push(JSON.stringify({ titres: ['2 pièces avec wifi fibre à Corbeil', 'Corbeil bords de Seine, 2 pièces pour 4', 'Séjour pro ou week-end à Corbeil'], description: `Appartement 2 pièces à Corbeil pour 4 voyageurs, avec wifi fibre, cuisine équipée et lave-linge. ${'Les quais de Seine sont tout proches. '.repeat(5)}` }));
    const r = await proposerTextesAnnonceIA(options(), l.id);
    verifier(r.titres.length === 3 && r.sources.titres.every((s) => s === 'ia') && r.sources.description === 'ia' && !r.ecartes.length, 'textes valides de l’IA : proposés tels quels', r);
    const appel = ia.appels[0];
    const contenu = String(appel?.messages[0]?.content ?? '');
    verifier(/N'invente rien/.test(String(appel?.system)) && /Label Maison/.test(String(appel?.system)) && !contenu.includes(l.fiche.wifiCode) && !contenu.includes(l.adresse), 'consignes « n’invente rien » au nom de Label Maison ; ni wifi ni adresse envoyés');
    verifier(JSON.stringify(appel?.output_config ?? {}).includes('titres'), 'sortie structurée imposée (titres, description)');
    const etat = b.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT);
    verifier(etat?.iaMois?.appels === 1 && etat.iaMois.mois === '2026-10', 'appel compté dans le plafond du mois de l’espace', etat);
    verifier(!b.ecritures.some((e) => e.collection === 'logements' || e.collection === 'versionsAnnonce'), 'le serveur n’écrit ni le logement ni l’annonce (seulement le compteur du mois)', b.ecritures);

    ia.reponses.push(JSON.stringify({ titres: ['Studio avec piscine et jacuzzi'], description: 'Courte.' }));
    const r2 = await proposerTextesAnnonceIA(options({ nomEspace: 'Sens' }), l.id);
    verifier(r2.titres.length === 3 && !r2.titres.some((t) => /piscine/i.test(t)) && r2.ecartes.length === 2 && r2.sources.description === 'fiche', 'IA qui invente : remplacée par la fiche, écarts notés', r2);
    verifier(/Sens/.test(String(ia.appels[1]?.system)) && !/Label Maison/.test(String(ia.appels[1]?.system)), 'autre espace : son nom, jamais celui de Label Maison');

    const avant = ia.appels.length;
    let erreur: unknown;
    try {
      await proposerTextesAnnonceIA(options({ plafondIAMois: 2 }), l.id);
    } catch (e) {
      erreur = e;
    }
    verifier(erreur instanceof ErreurAssistant && erreur.code === 'plafond' && ia.appels.length === avant, 'plafond du mois atteint : refus clair, l’IA n’est pas appelée');
    try {
      await proposerTextesAnnonceIA(options({ ia: null }), l.id);
      erreur = undefined;
    } catch (e) {
      erreur = e;
    }
    verifier(erreur instanceof ErreurAssistant && erreur.code === 'indisponible' && erreur.message === MESSAGE_REDACTION_INDISPONIBLE, 'sans clé de l’IA : refus clair, les textes de la fiche restent proposés');
    verifier(!/REPULL|Vercel|_KEY|variable/i.test(MESSAGE_REDACTION_INDISPONIBLE) && /textes tirés de la fiche restent proposés/.test(MESSAGE_REDACTION_INDISPONIBLE), 'message d’indisponibilité : ni nom de variable ni hébergeur');

    // Frein par membre : 20 demandes par quart d'heure (comme les brouillons du CRM).
    let t = 0;
    const frein = freinTextesAnnonce(TEXTES_PAR_QUART_D_HEURE, FENETRE_TEXTES_MS, () => t);
    const suite = Array.from({ length: 21 }, () => frein('lm:ops@exemple.invalid'));
    verifier(TEXTES_PAR_QUART_D_HEURE === 20 && FENETRE_TEXTES_MS === 15 * 60_000 && suite.slice(0, 20).every((x) => !x) && suite[20], '20 demandes passent, la 21ᵉ est freinée', suite);
    verifier(!frein('lm:gerant@exemple.invalid') && !frein('sens:ops@exemple.invalid'), 'un autre membre, ou le même dans un autre espace : pas freiné');
    t += FENETRE_TEXTES_MS;
    verifier(!frein('lm:ops@exemple.invalid'), 'un quart d’heure plus tard : de nouveau permis');
    const appelsAvant = ia.appels.length;
    const comptesAvant = b.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.iaMois?.appels;
    try {
      await proposerTextesAnnonceIA(options(), l.id, { tropDeDemandes: () => true });
      erreur = undefined;
    } catch (e) {
      erreur = e;
    }
    verifier(
      erreur instanceof ErreurAssistant && erreur.statut === 429 && erreur.code === 'occupe' && erreur.message === MESSAGE_TROP_DE_DEMANDES && MESSAGE_TROP_DE_DEMANDES === 'Trop de demandes d’un coup : réessayez dans quelques minutes.',
      'demande freinée : 429, « Trop de demandes d’un coup : réessayez dans quelques minutes. »',
      erreur instanceof Error ? erreur.message : erreur,
    );
    verifier(ia.appels.length === appelsAvant && b.get<EtatAgent>(COLLECTION_AGENT, ID_ETAT_AGENT)?.iaMois?.appels === comptesAvant, 'la demande freinée n’appelle pas l’IA et ne compte rien');
    try {
      await proposerTextesAnnonceIA(options(), 'inconnu');
      erreur = undefined;
    } catch (e) {
      erreur = e;
    }
    verifier(erreur instanceof ErreurAssistant && erreur.code === 'introuvable' && ia.appels.length === avant, 'logement inconnu : refus, rien n’est compté');
    ia.reponses.push('pas du json');
    const r3 = await proposerTextesAnnonceIA(options(), l.id);
    verifier(r3.titres.length === 3 && r3.sources.description === 'fiche' && controlerTextes(r3, { logement: l }).length === 0, 'réponse illisible : textes de la fiche');
  }

  section('6. Plateformes en lecture seule, fonctions Vercel');
  {
    verifier(!ecritureRepullPermise('PATCH', '/v1/listings/123', { title: 'Nouveau titre' }) && !ecritureRepullPermise('PUT', '/v1/listings/123/content', { description: 'x' }) && !ecritureRepullPermise('POST', '/v1/listings', {}), 'le verrou refuse toujours l’écriture d’une annonce');
    verifier(ACTION_TEXTES_ANNONCE === 'textes_annonce', 'action « textes_annonce »');
    if (racine) {
      for (const f of ['src/erp/annonces/textes.ts', 'src/erp/annonces/limites.ts', 'src/erp/data/annonce-ia.ts', 'api/_erp-annonces.ts']) {
        const s = source(f).replace(/^\s*(\*|\/\/).*$/gm, '');
        verifier(!/fetch\(|\/v1\/listings|ClientRepull|envoyerMessage|repull-synchro/.test(s), `${f} : ni plateforme ni envoi`);
      }
      for (const f of ['src/erp/annonces/textes.ts', 'src/erp/annonces/limites.ts', 'src/erp/data/annonce-ia.ts']) {
        const relatifs = [...source(f).matchAll(/^import (?!type )[^;]*?from '(\.[^']+)'/gm)].map((m) => m[1]);
        verifier(relatifs.every((i) => i.endsWith('.js')), `${f} : imports relatifs en .js (serveur)`, relatifs);
      }
      const route = source('api/erp-agent.ts');
      const lignes = route.split('\n').filter((x) => /ANNONCES|repondreAnnonces/.test(x));
      verifier(lignes.length === 2 && /import \{ ACTIONS_ANNONCES, repondreAnnonces \} from '\.\/_erp-annonces\.js';/.test(route), 'api/erp-agent.ts : un import et une ligne d’enregistrement', lignes);
      verifier(/repondreAnnonces\(res, !planifie && req\.method === 'POST', corps, espace, email\)/.test(route), 'membre en POST seulement (jamais le passage planifié)');
      const api = source('api/_erp-annonces.ts');
      const codeApi = api.replace(/^\s*\/\/.*$/gm, '');
      verifier(!/variableManquante/.test(codeApi) && /c\.motDePasse/.test(codeApi), 'api/_erp-annonces.ts : la clé Repull n’est pas exigée pour rédiger (seule la base est lue)');
      verifier(!/['`"][^'`"]*(REPULL_API_KEY|Vercel)[^'`"]*['`"]/.test(codeApi) && (codeApi.match(/MESSAGE_REDACTION_INDISPONIBLE/g) ?? []).length >= 3, 'api/_erp-annonces.ts : 503 avec le message simple, jamais « REPULL_API_KEY » ni « Vercel » à l’écran');
      verifier(/freinTextesAnnonce\(\)/.test(codeApi) && /tropDeDemandes\(cle\)/.test(codeApi) && /\$\{c\.espace \?\? ''\}:\$\{par\}/.test(codeApi), 'api/_erp-annonces.ts : frein par membre (espace et e-mail)');
      // 21 depuis le livret du séjour (cahier B2, api/sejour.ts) ; les annonces et les suppléments n'en ajoutent aucune.
      const fonctions = fs.readdirSync(chemins.join(racine, 'api')).filter((f) => /\.ts$/.test(f) && !f.startsWith('_'));
      verifier(fonctions.length === 21 && fonctions.includes('sejour.ts') && !fonctions.some((f) => /annonce|supplement/i.test(f)), 'aucune fonction Vercel pour les annonces (21 fichiers à la racine de api/, dont sejour.ts du livret)', fonctions.length);
      const ecran = source('src/erp/modules/logements/_composants/TextesAnnonce.tsx');
      verifier(/Copier/.test(ecran) && !/Publier|Marquer comme publiée|appelerServeur<[^>]*>\('\/api\/erp-repull/.test(ecran), 'écran : « Copier », jamais « Publier »');
      verifier(/L’ERP ne publie jamais l’annonce/.test(ecran), 'écran : l’ERP ne publie jamais l’annonce (aide)');
      verifier(/aria-live="polite"/.test(ecran) && /libelleCompteur/.test(ecran) && !/title=\{`Airbnb/.test(ecran), 'écran : « Copié » annoncé (aria-live), compteur lisible sans survol');
      verifier(/pour le titre sur Booking\.com/.test(ecran) && /Tirés de la fiche du logement, à copier puis coller vous-même sur Airbnb ou Booking\.com\./.test(ecran), 'écran : une seule phrase d’introduction, « 255 pour le titre »');
    }
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
