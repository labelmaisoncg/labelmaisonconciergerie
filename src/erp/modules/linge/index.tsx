import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Plus, Shirt, PackageX, WashingMachine } from 'lucide-react';
import { nombre } from '../../data/format';
import { useErp } from '../../data/store';
import { ecartsLinge, fenetreJours } from '../../data/selectors';
import { Alert, Button, PageHeader, Stat, Tabs } from '../../ui';
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
        fil={[{ libelle: 'Opérations' }, { libelle: 'Linge' }]}
        titre="Linge"
        sousTitre="Stock par logement, blanchisserie et écarts d’inventaire. Le linge de chaque logement est étiqueté et ne se mélange pas."
        actions={
          <>
            <a
              href="/linge"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface) px-3.5 text-sm font-medium text-(--lm-encre) hover:bg-(--lm-surface-2) [&_svg]:size-4"
            >
              <BookOpen aria-hidden /> Registre terrain
            </a>
            <Button variant="primary" icone={<Plus />} onClick={() => setNouveau(true)}>
              Nouveau mouvement
            </Button>
          </>
        }
      />

      <Alert tone="or" titre="Règle linge" className="mb-5">
        Le linge ne se lave jamais au domicile d’un prestataire. Chaque mouvement est tracé : sorti sale, envoyé en blanchisserie, revenu propre, mis en place.
        Les messages de l’équipe terrain restent consultables dans le registre terrain.
      </Alert>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="En place" valeur={nombre(somme('enPlace'))} icone={<CheckCircle2 />} aide="articles propres disponibles" />
        <Stat label="Sale à envoyer" valeur={nombre(somme('sale'))} icone={<Shirt />} tone={somme('sale') ? 'alerte' : 'neutre'} />
        <Stat label="En blanchisserie" valeur={nombre(somme('blanchisserie'))} icone={<WashingMachine />} />
        <Stat label="Perdu ou rebut (30 j)" valeur={nombre(perdus30)} icone={<PackageX />} tone={perdus30 ? 'alerte' : 'neutre'} />
        <Stat label="Écarts d’inventaire" valeur={nombre(ecarts)} icone={<AlertTriangle />} tone={ecarts ? 'danger' : 'succes'} className="col-span-2 md:col-span-1" />
      </div>

      <Tabs
        label="Vues du linge"
        actif={vue}
        onChange={(cle) => setParams(cle === 'stock' ? {} : { vue: cle }, { replace: true })}
        onglets={[
          { cle: 'stock', libelle: 'Stock par logement' },
          { cle: 'ecarts', libelle: 'Écarts', compteur: ecarts },
          { cle: 'journal', libelle: 'Journal des mouvements', compteur: mouvementsLinge.length },
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
