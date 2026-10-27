import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, nombre } from '../../data/format';
import type { NomCollection } from '../../data/types';
import { Alert, Button, Card, CardHeader, Modal, Repli } from '../../ui';

const LIBELLES_COLLECTIONS: Record<NomCollection, string> = {
  proprietaires: 'Propriétaires',
  mandats: 'Mandats',
  logements: 'Logements',
  reservations: 'Réservations',
  filsMessages: 'Conversations',
  missions: 'Missions',
  prestataires: 'Prestataires',
  mouvementsLinge: 'Mouvements de linge',
  incidents: 'Incidents',
  factures: 'Factures',
  paiementsPrestataires: 'Paiements prestataires',
  charges: 'Charges',
  prospects: 'Prospects',
  crm: 'CRM (contacts à appeler)',
  dossiers: 'Dossiers propriétaires',
  recommandations: 'Recommandations propriétaires',
  versionsAnnonce: 'Versions d’annonces',
  reglages: 'Réglages (agent, messages automatiques, société, numérotation des factures)',
  accesProprietaires: 'Accès à l’espace propriétaire',
  documentsProprietaire: 'Documents partagés aux propriétaires',
  bilansProprietaire: 'Bilans mensuels des propriétaires',
  equipe: 'Équipe de terrain',
  accesOperations: 'Accès à l’espace opérations',
  affectations: 'Qui suit chaque logement',
  absences: 'Absences de l’équipe de terrain',
  controles: 'Contrôles qualité',
  signalementsLogement: 'Logements signalés par l’équipe de terrain',
  envoisProgrammes: 'Messages automatiques envoyés',
  avisADeposer: 'Avis à déposer sur les voyageurs',
  conseilsPrix: 'Prix conseillés (réglages et décisions)',
  annoncesEquipe: 'Annonces à l’équipe',
  utilisateurs: 'Utilisateurs',
  journal: 'Journal',
};

export default function Donnees() {
  const d = useErp();
  const [confirmation, setConfirmation] = useState(false);
  const [fait, setFait] = useState<string>();

  const exporter = () => {
    try {
      const blob = new Blob([JSON.stringify(d.donnees, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `label-maison-erp-${AUJOURDHUI}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setFait('Export téléchargé.');
    } catch {
      setFait('Export impossible dans ce navigateur.');
    }
  };

  const reinitialiser = () => {
    d.reinitialiserDemo();
    setConfirmation(false);
    setFait('Données de démonstration réinitialisées.');
  };

  return (
    <>
      <Card>
        <CardHeader
          titre="Sauvegarde"
          description={d.mode === 'demo' ? 'Démonstration : données enregistrées dans ce navigateur uniquement.' : 'Vos données sont enregistrées en ligne et partagées avec l’équipe. Vous pouvez aussi en garder une copie.'}
        />
        {fait && (
          <Alert tone="succes" className="mb-3">
            {fait}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button icone={<Download />} onClick={exporter}>
            Télécharger une sauvegarde
          </Button>
          {d.mode === 'demo' && (
            <Button variant="danger" icone={<RotateCcw />} onClick={() => setConfirmation(true)}>
              Réinitialiser la démo
            </Button>
          )}
        </div>
      </Card>
      <Repli titre="Ce que contient la sauvegarde">
        <dl className="grid gap-x-6 text-[13px] sm:grid-cols-2">
          {(Object.keys(LIBELLES_COLLECTIONS) as NomCollection[]).filter((c) => d.donnees[c].length > 0).map((c) => (
            <div key={c} className="flex justify-between border-b border-(--lm-bord) py-1.5">
              <dt className="text-(--lm-encre-2)">{LIBELLES_COLLECTIONS[c]}</dt>
              <dd className="lm-chiffres font-medium">{nombre(d.donnees[c].length)}</dd>
            </div>
          ))}
        </dl>
      </Repli>
      <Modal
        ouvert={confirmation}
        onFermer={() => setConfirmation(false)}
        taille="sm"
        titre="Réinitialiser la démo ?"
        description="Toutes les modifications faites dans la maquette seront remplacées par le jeu de démonstration d’origine."
        pied={
          <>
            <Button variant="ghost" onClick={() => setConfirmation(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={reinitialiser}>
              Réinitialiser
            </Button>
          </>
        }
      />
    </>
  );
}
