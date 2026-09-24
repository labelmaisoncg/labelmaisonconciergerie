import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateCourte } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { MouvementLinge, TypeMouvementLinge } from '../../../data/types';
import { Badge, Select, Table, Toolbar, type Colonne, type Ton } from '../../../ui';
import { totalArticles } from './calculs';

const TYPES = Object.keys(LIBELLES.typeMouvementLinge) as TypeMouvementLinge[];
export const TON_MOUVEMENT: Record<TypeMouvementLinge, Ton> = {
  sortie_sale: 'alerte',
  envoi_blanchisserie: 'info',
  retour_propre: 'succes',
  mise_en_place: 'or',
  perte: 'danger',
  rebut: 'neutre',
};

/** Journal de tous les mouvements de linge, du plus récent au plus ancien. */
export function Journal() {
  const { mouvementsLinge, logements, prestataires } = useErp();
  const [types, setTypes] = useState<string[]>([]);
  const [logement, setLogement] = useState('');
  const [prestataire, setPrestataire] = useState('');
  const [recherche, setRecherche] = useState('');

  const q = recherche.trim().toLowerCase();
  const lignes = mouvementsLinge.filter(
    (m) =>
      (!types.length || types.includes(m.type)) &&
      (!logement || m.logementId === logement) &&
      (!prestataire || m.prestataireId === prestataire) &&
      (!q || `${m.articles.map((a) => a.article).join(' ')} ${m.note ?? ''}`.toLowerCase().includes(q)),
  );
  const nomLogement = (id: string) => logements.find((l) => l.id === id)?.nom ?? '';

  const colonnes: Colonne<MouvementLinge>[] = [
    { cle: 'date', titre: 'Date', rendu: (m) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(m.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'type', titre: 'Mouvement', rendu: (m) => <Badge tone={TON_MOUVEMENT[m.type]} point>{LIBELLES.typeMouvementLinge[m.type]}</Badge> },
    { cle: 'logement', titre: 'Logement', rendu: (m) => <span className="font-medium">{nomLogement(m.logementId)}</span>, tri: (a, b) => nomLogement(a.logementId).localeCompare(nomLogement(b.logementId)) },
    {
      cle: 'articles',
      titre: 'Articles',
      masquerMobile: true,
      rendu: (m) => <span className="line-clamp-2 max-w-md text-[12.5px] text-(--lm-encre-2)">{m.articles.map((a) => `${a.quantite} ${a.article}`).join(', ')}</span>,
    },
    { cle: 'total', titre: 'Qté', align: 'droite', rendu: (m) => <span className="lm-chiffres">{totalArticles(m)}</span>, tri: (a, b) => totalArticles(a) - totalArticles(b) },
    { cle: 'prestataire', titre: 'Prestataire', rendu: (m) => prestataires.find((p) => p.id === m.prestataireId)?.nom ?? '-', masquerMobile: true },
    {
      cle: 'mission',
      titre: 'Mission',
      masquerMobile: true,
      rendu: (m) =>
        m.missionId ? (
          <Link to={`/erp/menages/${m.missionId}`} className="text-(--lm-or) hover:underline" onClick={(e) => e.stopPropagation()}>
            Voir
          </Link>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Article, note...', label: 'Rechercher un mouvement' }}
        filtres={{ filtres: TYPES.map((t) => ({ cle: t, libelle: LIBELLES.typeMouvementLinge[t] })), actifs: types, onChange: setTypes, label: 'Filtrer par type' }}
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
        <Select aria-label="Logement" value={logement} onChange={(e) => setLogement(e.target.value)} placeholder="Tous les logements" options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        <Select aria-label="Prestataire" value={prestataire} onChange={(e) => setPrestataire(e.target.value)} placeholder="Tous les prestataires" options={prestataires.map((p) => ({ valeur: p.id, libelle: p.nom }))} />
      </div>
      <Table
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(m) => m.id}
        legende="Journal des mouvements de linge"
        triInitial={{ cle: 'date', sens: 'desc' }}
        dense
        vide="Aucun mouvement ne correspond aux filtres."
      />
      <p className="mt-2 text-[12px] text-(--lm-encre-3)">{lignes.length} mouvement{lignes.length > 1 ? 's' : ''}</p>
    </div>
  );
}
