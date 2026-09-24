import { useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, nombre } from '../../data/format';
import type { NomCollection } from '../../data/types';
import { Alert, Button, Card, CardHeader, Modal } from '../../ui';

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
  recommandations: 'Recommandations propriétaires',
  versionsAnnonce: 'Versions d’annonces',
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader
          titre="Mode de données"
          description={d.mode === 'demo' ? 'Données de démonstration, enregistrées dans ce navigateur uniquement.' : 'Connecté à la base Supabase.'}
        />
        {fait && (
          <Alert tone="succes" className="mb-3">
            {fait}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button icone={<Download />} onClick={exporter}>
            Exporter en JSON
          </Button>
          <Button variant="danger" icone={<RotateCcw />} onClick={() => setConfirmation(true)} disabled={d.mode !== 'demo'}>
            Réinitialiser la démo
          </Button>
        </div>
        <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">
          La réinitialisation recharge le jeu de démonstration d’origine : toutes les modifications faites dans la maquette sont perdues. Exportez d’abord si besoin.
        </p>
      </Card>
      <Card flush>
        <div className="p-4 pb-2 sm:p-5 sm:pb-2">
          <CardHeader titre="Contenu actuel" className="mb-1" />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 px-4 pb-4 text-[13px] sm:px-5">
          {(Object.keys(LIBELLES_COLLECTIONS) as NomCollection[]).map((c) => (
            <div key={c} className="flex justify-between border-b border-(--lm-bord) py-1.5">
              <dt className="text-(--lm-encre-2)">{LIBELLES_COLLECTIONS[c]}</dt>
              <dd className="lm-chiffres font-medium">{nombre(d.donnees[c].length)}</dd>
            </div>
          ))}
        </dl>
      </Card>
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
    </div>
  );
}
