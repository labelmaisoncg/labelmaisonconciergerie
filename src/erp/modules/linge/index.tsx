import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Plus, WashingMachine } from 'lucide-react';
import { nombre } from '../../data/format';
import { useErp } from '../../data/store';
import { ecartsLinge, fenetreJours } from '../../data/selectors';
import { Aide, Button, MenuActions, PageHeader, Stat, Tabs } from '../../ui';
import { Retour, useRetour } from '../menages/_composants/retour';
import { positionLinge, totalArticles } from './_composants/calculs';
import { Ecarts } from './_composants/Ecarts';
import { Journal } from './_composants/Journal';
import { NouveauMouvement } from './_composants/NouveauMouvement';
import { Stock } from './_composants/Stock';

const VUES = ['stock', 'ecarts', 'journal'] as const;
type Vue = (typeof VUES)[number];

/** Module Linge : stock par logement, écarts d'inventaire, journal des mouvements. */
export default function Linge() {
  const { logements, mouvementsLinge } = useErp();
  const [params, setParams] = useSearchParams();
  const vue: Vue = (VUES as readonly string[]).includes(params.get('vue') ?? '') ? (params.get('vue') as Vue) : 'stock';
  // Lien « ?logement=… » depuis une fiche logement : on s'y place directement.
  const logementFiltre = params.get('logement') ?? undefined;
  const [nouveau, setNouveau] = useState(false);
  const { message, setMessage, fermer } = useRetour();

  const positions = logements.filter((l) => l.statut !== 'sorti').map((l) => positionLinge(l, mouvementsLinge));
  const somme = (k: 'enPlace' | 'sale' | 'blanchisserie') => positions.reduce((s, p) => s + p.total[k], 0);
  const f30 = fenetreJours(30);
  const perdus30 = mouvementsLinge
    .filter((m) => (m.type === 'perte' || m.type === 'rebut') && m.date >= f30.debut && m.date <= f30.fin)
    .reduce((s, m) => s + totalArticles(m), 0);
  const ecarts = ecartsLinge(mouvementsLinge).length;

  return (
    <>
      <PageHeader
        titre="Linge"
        sousTitre="Où sont les draps et les serviettes de chaque logement : en place, sales ou à la blanchisserie."
        actions={
          <>
            <MenuActions actions={[{ libelle: 'Ouvrir le registre de l’équipe terrain', icone: <BookOpen />, href: '/linge' }]} />
            <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
              Noter un mouvement
            </Button>
          </>
        }
      />

      <Aide>
        Le linge de chaque logement est étiqueté et ne se mélange jamais. Il ne se lave jamais chez un prestataire : il part en blanchisserie.
        Chaque étape est notée (sorti sale, envoyé, revenu propre, remis en place) pour savoir à tout moment où il se trouve. Les messages de
        l’équipe terrain restent lisibles dans son registre (menu « … »).
      </Aide>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Propre et en place" valeur={nombre(somme('enPlace'))} icone={<CheckCircle2 />} aide="pièces prêtes pour les prochains voyageurs" />
        <Stat
          label="Sale ou à la blanchisserie"
          valeur={nombre(somme('sale') + somme('blanchisserie'))}
          icone={<WashingMachine />}
          aide={`${nombre(somme('sale'))} à envoyer, ${nombre(somme('blanchisserie'))} en cours de lavage`}
        />
        <Stat
          label="Linge qui manque"
          valeur={nombre(ecarts)}
          icone={<AlertTriangle />}
          tone={ecarts ? 'danger' : 'succes'}
          aide={perdus30 ? `et ${nombre(perdus30)} pièces perdues ou jetées en 30 jours` : 'rien de perdu ces 30 derniers jours'}
        />
      </div>

      <Tabs
        label="Vues du linge"
        actif={vue}
        onChange={(cle) => setParams(cle === 'stock' ? {} : { vue: cle }, { replace: true })}
        onglets={[
          { cle: 'stock', libelle: 'Par logement' },
          { cle: 'ecarts', libelle: 'Ce qui manque', compteur: ecarts },
          { cle: 'journal', libelle: 'Historique', compteur: mouvementsLinge.length },
        ]}
      />

      <Retour message={message} onFermer={fermer} />

      {vue === 'stock' && <Stock logementInitial={logementFiltre} />}
      {vue === 'ecarts' && <Ecarts onMessage={(texte) => setMessage({ ton: 'succes', texte })} />}
      {vue === 'journal' && <Journal logementInitial={logementFiltre} />}

      <NouveauMouvement ouvert={nouveau} onFermer={() => setNouveau(false)} onSucces={(texte) => setMessage({ ton: 'succes', texte })} />
    </>
  );
}
