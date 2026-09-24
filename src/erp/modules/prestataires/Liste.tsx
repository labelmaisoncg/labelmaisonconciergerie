import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileWarning, Plus, ShieldCheck, Star, Users } from 'lucide-react';
import { dateCourte, nombre, note, pluriel } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { useErp } from '../../data/store';
import { documentsAlertes, libelleDocument, prestataireConforme } from '../../data/selectors';
import type { Prestataire, StatutPrestataire, TypePrestataire } from '../../data/types';
import { Button, Card, CardHeader, PageHeader, Select, Stat, StatusBadge, Table, Toolbar, type Colonne } from '../../ui';
import { BadgeConformite, BadgeDocument, RegleConformite } from './_composants/conformite';
import { PrestataireModal } from './_composants/PrestataireModal';

export function Liste() {
  const { prestataires } = useErp();
  const naviguer = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [conformite, setConformite] = useState<string[]>([]);
  const [type, setType] = useState('');
  const [statut, setStatut] = useState('');
  const [creation, setCreation] = useState(false);

  const actifs = prestataires.filter((p) => p.statut === 'actif');
  const conformes = actifs.filter((p) => prestataireConforme(p).ok).length;
  const alertes = documentsAlertes(prestataires);
  const notes = prestataires.filter((p) => p.noteMoyenne !== undefined && p.statut !== 'sorti');
  const moyenne = notes.length ? notes.reduce((s, p) => s + p.noteMoyenne!, 0) / notes.length : undefined;

  const q = recherche.trim().toLowerCase();
  const lignes = prestataires.filter((p) => {
    const ok = prestataireConforme(p).ok;
    return (
      (!conformite.length || conformite.includes(ok ? 'oui' : 'non')) &&
      (!type || p.type === type) &&
      (!statut || p.statut === statut) &&
      (!q || `${p.nom} ${p.raisonSociale ?? ''} ${p.zone.join(' ')}`.toLowerCase().includes(q))
    );
  });

  const colonnes: Colonne<Prestataire>[] = [
    {
      cle: 'nom',
      titre: 'Prestataire',
      rendu: (p) => (
        <div className="min-w-0">
          <p className="font-medium text-(--lm-encre)">{p.nom}</p>
          {p.raisonSociale && <p className="truncate text-[12px] text-(--lm-encre-3)">{p.raisonSociale}</p>}
        </div>
      ),
      tri: (a, b) => a.nom.localeCompare(b.nom),
    },
    { cle: 'type', titre: 'Métier', rendu: (p) => LIBELLES.typePrestataire[p.type], masquerMobile: true },
    { cle: 'zone', titre: 'Zone', rendu: (p) => <span className="line-clamp-1 max-w-56 text-(--lm-encre-2)">{p.zone.join(', ')}</span>, masquerMobile: true },
    {
      cle: 'conformite',
      titre: 'Conformité',
      rendu: (p) => {
        const v = prestataireConforme(p);
        return (
          <div className="flex flex-col items-start gap-0.5">
            <BadgeConformite prestataire={p} />
            {!v.ok && <span className="max-w-64 text-[12px] text-(--lm-danger)">{v.raisons.join(' ')}</span>}
          </div>
        );
      },
      tri: (a, b) => Number(prestataireConforme(a).ok) - Number(prestataireConforme(b).ok),
    },
    { cle: 'note', titre: 'Note', align: 'droite', rendu: (p) => <span className="lm-chiffres">{note(p.noteMoyenne)}</span>, tri: (a, b) => (a.noteMoyenne ?? 0) - (b.noteMoyenne ?? 0) },
    { cle: 'missions', titre: 'Missions', align: 'droite', rendu: (p) => <span className="lm-chiffres">{nombre(p.missionsRealisees)}</span>, tri: (a, b) => a.missionsRealisees - b.missionsRealisees, masquerMobile: true },
    { cle: 'statut', titre: 'Statut', rendu: (p) => <StatusBadge type="statutPrestataire" valeur={p.statut} /> },
  ];

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Prestataires' }]}
        titre="Prestataires"
        sousTitre="Qui intervient dans nos logements, est-il en règle, travaille-t-il bien ?"
        actions={<Button variant="primary" icone={<Plus />} onClick={() => setCreation(true)}>Nouveau prestataire</Button>}
      />
      <RegleConformite className="mb-5" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Prestataires actifs" valeur={nombre(actifs.length)} icone={<Users />} />
        <Stat label="Conformes" valeur={`${conformes}/${actifs.length}`} icone={<ShieldCheck />} tone={conformes < actifs.length ? 'danger' : 'succes'} aide="parmi les actifs" />
        <Stat label="Documents expirés ou < 30 j" valeur={nombre(alertes.length)} icone={<FileWarning />} tone={alertes.length ? 'alerte' : 'succes'} />
        <Stat label="Note moyenne" valeur={note(moyenne)} icone={<Star />} aide="contrôles et voyageurs" />
      </div>

      {alertes.length > 0 && (
        <Card flush className="mb-5">
          <CardHeader className="px-4 pt-4 sm:px-5" titre="Documents à renouveler" description="Relancez le prestataire avant l’échéance : un document expiré bloque toute attribution." />
          <ul className="divide-y divide-(--lm-bord)">
            {alertes.map((a) => (
              <li key={`${a.prestataire.id}-${a.document.type}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] sm:px-5">
                <Link to={`/erp/prestataires/${a.prestataire.id}`} className="font-medium hover:text-(--lm-or) hover:underline">{a.prestataire.nom}</Link>
                <span className="text-(--lm-encre-2)">{libelleDocument(a.document.type)}</span>
                <span className="lm-chiffres text-(--lm-encre-3)">
                  {a.statut === 'manquant' ? 'non fourni' : a.statut === 'expire' ? `expiré depuis ${pluriel(-a.joursRestants, 'jour')}` : `expire le ${dateCourte(a.document.valideJusquau!)} (${pluriel(a.joursRestants, 'jour')})`}
                </span>
                <span className="ml-auto"><BadgeDocument etat={a.statut} /></span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Nom, zone...', label: 'Rechercher un prestataire' }}
        filtres={{ filtres: [{ cle: 'oui', libelle: 'Conformes' }, { cle: 'non', libelle: 'Non conformes' }], actifs: conformite, onChange: setConformite, unique: true, label: 'Filtrer par conformité' }}
      >
        <div className="grid grid-cols-2 gap-2 sm:w-80">
          <Select aria-label="Métier" value={type} onChange={(e) => setType(e.target.value)} placeholder="Tous métiers" options={(Object.keys(LIBELLES.typePrestataire) as TypePrestataire[]).map((t) => ({ valeur: t, libelle: LIBELLES.typePrestataire[t] }))} />
          <Select aria-label="Statut" value={statut} onChange={(e) => setStatut(e.target.value)} placeholder="Tous statuts" options={(Object.keys(LIBELLES.statutPrestataire) as StatutPrestataire[]).map((s) => ({ valeur: s, libelle: LIBELLES.statutPrestataire[s] }))} />
        </div>
      </Toolbar>

      <Table colonnes={colonnes} lignes={lignes} cleLigne={(p) => p.id} onLigneClick={(p) => naviguer(`/erp/prestataires/${p.id}`)} legende="Prestataires" triInitial={{ cle: 'nom', sens: 'asc' }} vide="Aucun prestataire ne correspond aux filtres." />

      <PrestataireModal ouvert={creation} onFermer={() => setCreation(false)} onCree={(p) => naviguer(`/erp/prestataires/${p.id}`)} />
    </>
  );
}
