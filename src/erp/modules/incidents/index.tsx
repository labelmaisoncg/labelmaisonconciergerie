import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Receipt, Wallet } from 'lucide-react';
import { dateCourte, euros, nombre } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { useErp } from '../../data/store';
import { fenetreMois, incidentsOuverts } from '../../data/selectors';
import type { CategorieIncident, GraviteIncident, Incident } from '../../data/types';
import { Badge, Button, PageHeader, Select, Stat, StatusBadge, Table, Tabs, Toolbar, type Colonne, useCreationParUrl } from '../../ui';
import { Retour, useRetour } from '../menages/_composants/retour';
import { Board } from './_composants/Board';
import { IncidentDrawer } from './_composants/IncidentDrawer';
import { NouvelIncident } from './_composants/NouvelIncident';
import { useRechercheUrl } from '../../ui/useRechercheUrl';

const GRAVITES = Object.keys(LIBELLES.gravite) as GraviteIncident[];
const CATEGORIES = Object.keys(LIBELLES.categorieIncident) as CategorieIncident[];

/** Module Incidents & maintenance : tout problème constaté, ses preuves, son coût. */
export default function Incidents() {
  const { incidents, logements } = useErp();
  const [params, setParams] = useSearchParams();
  const [vue, setVue] = useState<'tableau' | 'liste'>('tableau');
  const [recherche, setRecherche] = useRechercheUrl();
  const [gravites, setGravites] = useState<string[]>([]);
  const [categorie, setCategorie] = useState('');
  const [logement, setLogement] = useState('');
  const [creation, setCreation] = useCreationParUrl();
  const { message, setMessage, fermer } = useRetour();

  const ouvertId = params.get('id');
  const ouvrir = (i: Incident) => setParams({ id: i.id });
  const nomLogement = (id: string) => logements.find((l) => l.id === id)?.nom ?? '';

  const q = recherche.trim().toLowerCase();
  const filtres = incidents.filter(
    (i) =>
      (!gravites.length || gravites.includes(i.gravite)) &&
      (!categorie || i.categorie === categorie) &&
      (!logement || i.logementId === logement) &&
      (!q || `${i.description} ${nomLogement(i.logementId)} ${i.responsable ?? ''}`.toLowerCase().includes(q)),
  );

  const ouverts = incidentsOuverts(incidents);
  const hautes = ouverts.filter((i) => i.gravite === 'haute').length;
  const mois = fenetreMois();
  const coutMois = incidents.filter((i) => i.date >= mois.debut && i.date < mois.fin).reduce((s, i) => s + (i.coutCentimes ?? 0), 0);
  const aRefacturer = incidents.filter((i) => i.refacturable !== 'aucun' && !i.recupereLe).reduce((s, i) => s + (i.coutCentimes ?? 0), 0);

  const colonnes: Colonne<Incident>[] = [
    { cle: 'date', titre: 'Date', rendu: (i) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(i.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'logement', titre: 'Logement', rendu: (i) => <span className="font-medium">{nomLogement(i.logementId)}</span>, tri: (a, b) => nomLogement(a.logementId).localeCompare(nomLogement(b.logementId)) },
    { cle: 'categorie', titre: 'Catégorie', rendu: (i) => LIBELLES.categorieIncident[i.categorie], masquerMobile: true },
    { cle: 'description', titre: 'Description', masquerMobile: true, rendu: (i) => <span className="line-clamp-1 max-w-sm text-(--lm-encre-2)">{i.description}</span> },
    { cle: 'gravite', titre: 'Gravité', rendu: (i) => <StatusBadge type="gravite" valeur={i.gravite} />, tri: (a, b) => GRAVITES.indexOf(a.gravite) - GRAVITES.indexOf(b.gravite) },
    { cle: 'statut', titre: 'Statut', rendu: (i) => <StatusBadge type="statutIncident" valeur={i.statut} /> },
    { cle: 'cout', titre: 'Coût', align: 'droite', rendu: (i) => <span className="lm-chiffres">{i.coutCentimes !== undefined ? euros(i.coutCentimes) : '-'}</span>, tri: (a, b) => (a.coutCentimes ?? 0) - (b.coutCentimes ?? 0) },
    { cle: 'refacturable', titre: 'Refacturable', masquerMobile: true, rendu: (i) => (i.refacturable === 'aucun' ? <span className="text-(--lm-encre-3)">Non</span> : <Badge tone="or">{LIBELLES.refacturable[i.refacturable]}</Badge>) },
  ];

  return (
    <>
      <PageHeader
        titre="Incidents"
        sousTitre="Casse, panne, ménage raté, linge perdu : tout ce qui cloche, qui s’en occupe et ce que ça coûte."
        actions={<Button variant="primary" icone={<Plus />} onClick={() => setCreation(true)}>Signaler un incident</Button>}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="En cours"
          valeur={nombre(ouverts.length)}
          icone={<AlertTriangle />}
          tone={hautes ? 'danger' : ouverts.length ? 'alerte' : 'succes'}
          aide={ouverts.length ? (hautes ? `dont ${nombre(hautes)} grave${hautes > 1 ? 's' : ''}` : 'rien de grave') : 'tout est réglé'}
        />
        <Stat label="Coût ce mois-ci" valeur={euros(coutMois, true)} icone={<Wallet />} aide="réparations et remplacements" />
        <Stat label="À se faire rembourser" valeur={euros(aRefacturer, true)} icone={<Receipt />} aide="par un voyageur, un propriétaire ou un prestataire" />
      </div>

      <Retour message={message} onFermer={fermer} />

      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Un mot, un logement…', label: 'Rechercher un incident' }}
        filtres={{ filtres: GRAVITES.map((g) => ({ cle: g, libelle: LIBELLES.gravite[g] })), actifs: gravites, onChange: setGravites, label: 'Filtrer par gravité' }}
      >
        <div className="grid grid-cols-2 gap-2 sm:w-96">
          <Select aria-label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Tous les types" options={CATEGORIES.map((c) => ({ valeur: c, libelle: LIBELLES.categorieIncident[c] }))} />
          <Select aria-label="Logement" value={logement} onChange={(e) => setLogement(e.target.value)} placeholder="Tous les logements" options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        </div>
      </Toolbar>

      <Tabs
        label="Affichage"
        actif={vue}
        onChange={(c) => setVue(c as 'tableau' | 'liste')}
        onglets={[
          { cle: 'tableau', libelle: 'Par statut' },
          { cle: 'liste', libelle: 'Liste', compteur: filtres.length },
        ]}
      />

      {vue === 'tableau' ? (
        <Board incidents={filtres} onOuvrir={ouvrir} />
      ) : (
        <Table colonnes={colonnes} lignes={filtres} cleLigne={(i) => i.id} onLigneClick={ouvrir} ligneActive={ouvertId ?? undefined} legende="Incidents" triInitial={{ cle: 'date', sens: 'desc' }} dense vide="Aucun incident ne correspond. Essayez d’enlever un filtre." />
      )}

      <IncidentDrawer incident={incidents.find((i) => i.id === ouvertId)} onFermer={() => setParams({})} />
      <NouvelIncident
        ouvert={creation}
        onFermer={() => setCreation(false)}
        onCree={(i) => {
          setMessage({ ton: 'succes', texte: `C’est noté pour ${nomLogement(i.logementId)}. Pensez à ajouter des photos si vous en avez.` });
          setParams({ id: i.id });
        }}
      />
    </>
  );
}
