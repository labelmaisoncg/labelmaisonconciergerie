import { euros, dateCourte } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import type { Prospect } from '../../../data/types';
import { Avatar, Badge, StatusBadge, Table, type Colonne } from '../../../ui';
import { NOM_RESPONSABLE, ProchaineAction } from './CarteProspect';

const rangEtape = (p: Prospect) => (p.etape === 'perdu' ? 99 : ETAPES_PIPELINE.indexOf(p.etape));

export function ListeProspects({ prospects, ouvrir, actif }: { prospects: Prospect[]; ouvrir: (p: Prospect) => void; actif?: string }) {
  const colonnes: Colonne<Prospect>[] = [
    {
      cle: 'nom',
      titre: 'Propriétaire',
      tri: (a, b) => a.nom.localeCompare(b.nom),
      rendu: (p) => (
        <div className="min-w-[10rem]">
          <p className="font-medium">{p.nom}</p>
          <p className="text-[12px] text-(--lm-encre-2)">{p.ville} · {p.typeBien}</p>
        </div>
      ),
    },
    { cle: 'etape', titre: 'Étape', tri: (a, b) => rangEtape(a) - rangEtape(b), rendu: (p) => <StatusBadge type="etapeProspect" valeur={p.etape} /> },
    {
      cle: 'revenu',
      titre: 'Revenu estimé',
      align: 'droite',
      tri: (a, b) => a.revenuEstimeAnnuelCentimes - b.revenuEstimeAnnuelCentimes,
      rendu: (p) => euros(p.revenuEstimeAnnuelCentimes, true),
    },
    {
      cle: 'action',
      titre: 'Prochaine action',
      tri: (a, b) => (a.prochaineActionLe ?? '9').localeCompare(b.prochaineActionLe ?? '9'),
      rendu: (p) => <span className="block min-w-[12rem] text-[12.5px]"><ProchaineAction p={p} /></span>,
    },
    { cle: 'source', titre: 'Source', masquerMobile: true, rendu: (p) => <Badge>{LIBELLES.sourceProspect[p.source]}</Badge> },
    {
      cle: 'resp',
      titre: 'Responsable',
      masquerMobile: true,
      rendu: (p) => (
        <span className="inline-flex items-center gap-1.5">
          <Avatar nom={NOM_RESPONSABLE[p.responsable]} taille="sm" />
          {NOM_RESPONSABLE[p.responsable]}
        </span>
      ),
    },
    { cle: 'cree', titre: 'Créé le', masquerMobile: true, tri: (a, b) => a.creeLe.localeCompare(b.creeLe), rendu: (p) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(p.creeLe)}</span> },
  ];
  return (
    <Table
      legende="Prospects du pipeline"
      colonnes={colonnes}
      lignes={prospects}
      cleLigne={(p) => p.id}
      onLigneClick={ouvrir}
      ligneActive={actif}
      triInitial={{ cle: 'action', sens: 'asc' }}
      vide="Aucun prospect ne correspond aux filtres."
    />
  );
}
