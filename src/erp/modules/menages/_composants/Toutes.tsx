import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { dateCourte, euros } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { Mission, StatutMission, TypeMission } from '../../../data/types';
import { Select, StatusBadge, Table, Toolbar, cn, type Colonne } from '../../../ui';
import { useRechercheUrl } from '../../../ui/useRechercheUrl';

const STATUTS = Object.keys(LIBELLES.statutMission) as StatutMission[];
const TYPES = Object.keys(LIBELLES.typeMission) as TypeMission[];

/** Toutes les missions, filtrables et triables. */
export function Toutes() {
  const { missions, logements, prestataires } = useErp();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useRechercheUrl();
  const [statuts, setStatuts] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [prestataire, setPrestataire] = useState('');
  const [logement, setLogement] = useState('');

  const nomLogement = (id: string) => logements.find((l) => l.id === id)?.nom ?? '';
  const nomPresta = (id?: string) => prestataires.find((p) => p.id === id)?.nom ?? '';

  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return missions.filter(
      (m) =>
        (!statuts.length || statuts.includes(m.statut)) &&
        (!type || m.type === type) &&
        (!prestataire || (prestataire === '_aucun' ? !m.prestataireId : m.prestataireId === prestataire)) &&
        (!logement || m.logementId === logement) &&
        (!q || `${nomLogement(m.logementId)} ${nomPresta(m.prestataireId)} ${m.id}`.toLowerCase().includes(q)),
    );
  }, [missions, recherche, statuts, type, prestataire, logement, logements, prestataires]);

  const colonnes: Colonne<Mission>[] = [
    { cle: 'date', titre: 'Date', rendu: (m) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(m.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'logement', titre: 'Logement', rendu: (m) => <span className="font-medium">{nomLogement(m.logementId)}</span>, tri: (a, b) => nomLogement(a.logementId).localeCompare(nomLogement(b.logementId)) },
    { cle: 'type', titre: 'Type', rendu: (m) => LIBELLES.typeMission[m.type], masquerMobile: true },
    { cle: 'creneau', titre: 'Créneau', rendu: (m) => <span className="lm-chiffres whitespace-nowrap">{m.heureDebut} → {m.heureFinMax}</span>, masquerMobile: true },
    {
      cle: 'prestataire',
      titre: 'Prestataire',
      rendu: (m) => <span className={cn(!m.prestataireId && 'text-(--lm-alerte)')}>{nomPresta(m.prestataireId) || 'Personne'}</span>,
      tri: (a, b) => nomPresta(a.prestataireId).localeCompare(nomPresta(b.prestataireId)),
    },
    { cle: 'statut', titre: 'Statut', rendu: (m) => <StatusBadge type="statutMission" valeur={m.statut} />, tri: (a, b) => a.statut.localeCompare(b.statut) },
    {
      cle: 'preuves',
      titre: 'Preuves',
      masquerMobile: true,
      rendu: (m) => {
        const faits = m.checklist.filter((c) => c.fait).length;
        const avant = m.photos.filter((p) => p.moment === 'avant').length;
        const apres = m.photos.filter((p) => p.moment === 'apres').length;
        return (
          <span className="lm-chiffres inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] text-(--lm-encre-2)">
            <span>{faits}/{m.checklist.length}</span>
            <span className={cn('inline-flex items-center gap-0.5', (!avant || !apres) && 'text-(--lm-alerte)')}>
              <Camera className="size-3.5" aria-label="Photos avant / après" /> {avant}/{apres}
            </span>
          </span>
        );
      },
    },
    { cle: 'tarif', titre: 'Tarif', align: 'droite', rendu: (m) => <span className="lm-chiffres">{euros(m.tarifCentimes)}</span>, tri: (a, b) => a.tarifCentimes - b.tarifCentimes, masquerMobile: true },
  ];

  return (
    <div>
      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Logement, prestataire...', label: 'Rechercher une mission' }}
        filtres={{
          filtres: STATUTS.map((s) => ({ cle: s, libelle: LIBELLES.statutMission[s], compteur: missions.filter((m) => m.statut === s).length })),
          actifs: statuts,
          onChange: setStatuts,
          label: 'Filtrer par statut',
        }}
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <Select aria-label="Type de mission" value={type} onChange={(e) => setType(e.target.value)} placeholder="Tous les types" options={TYPES.map((t) => ({ valeur: t, libelle: LIBELLES.typeMission[t] }))} />
        <Select
          aria-label="Prestataire"
          value={prestataire}
          onChange={(e) => setPrestataire(e.target.value)}
          placeholder="Tous les prestataires"
          options={[{ valeur: '_aucun', libelle: 'Sans personne' }, ...prestataires.map((p) => ({ valeur: p.id, libelle: p.nom }))]}
        />
        <Select aria-label="Logement" value={logement} onChange={(e) => setLogement(e.target.value)} placeholder="Tous les logements" options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
      </div>
      <Table
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(m) => m.id}
        onLigneClick={(m) => naviguer(`/erp/menages/${m.id}`)}
        legende="Toutes les missions"
        triInitial={{ cle: 'date', sens: 'desc' }}
        dense
        vide="Aucun ménage ne correspond. Essayez d’enlever un filtre."
      />
    </div>
  );
}
