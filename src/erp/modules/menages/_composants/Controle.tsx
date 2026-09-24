import { Link } from 'react-router-dom';
import { ClipboardCheck, Star } from 'lucide-react';
import { dateCourte, note } from '../../../data/format';
import { nouvelId, useErp } from '../../../data/store';
import { missionsAControler } from '../../../data/selectors';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import type { Mission } from '../../../data/types';
import { Alert, Badge, Button, StatusBadge, Table, type Colonne } from '../../../ui';
import { controlePlanifie, nouveauControle } from './outils';

/** Contrôle qualité (SPEC §2.5) : tirage 1 sur 10 et toute note voyageur < 4,5. */
export function Controle({ onMessage }: { onMessage: (texte: string) => void }) {
  const { missions, reservations, logements, prestataires, upsert } = useErp();
  const aControler = missionsAControler(missions, reservations).sort((a, b) => b.date.localeCompare(a.date));

  const planifier = (m: Mission) => {
    const logement = logements.find((l) => l.id === m.logementId);
    const c = nouveauControle(m, nouvelId('mis'), logement);
    upsert('missions', c);
    onMessage(`Contrôle physique planifié le ${dateCourte(c.date)} à ${logement?.nom ?? ''}. Attribuez-le dans « À traiter ».`);
  };

  const colonnes: Colonne<Mission>[] = [
    { cle: 'date', titre: 'Ménage du', rendu: (m) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(m.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    {
      cle: 'logement',
      titre: 'Logement',
      rendu: (m) => (
        <Link to={`/erp/menages/${m.id}`} className="font-medium hover:text-(--lm-or) hover:underline" onClick={(e) => e.stopPropagation()}>
          {logements.find((l) => l.id === m.logementId)?.nom}
        </Link>
      ),
    },
    { cle: 'prestataire', titre: 'Prestataire', rendu: (m) => prestataires.find((p) => p.id === m.prestataireId)?.nom ?? 'Non attribuée', masquerMobile: true },
    {
      cle: 'motif',
      titre: 'Motif',
      rendu: (m) => {
        const r = reservations.find((x) => x.id === m.reservationId);
        const basse = r?.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE;
        return basse ? (
          <Badge tone="danger" icone={<Star />}>Note voyageur {note(r?.noteVoyageur)}</Badge>
        ) : (
          <Badge tone="info">Tirage 1 sur 10</Badge>
        );
      },
    },
    { cle: 'statut', titre: 'Mission', rendu: (m) => <StatusBadge type="statutMission" valeur={m.statut} />, masquerMobile: true },
    {
      cle: 'controle',
      titre: 'Contrôle',
      rendu: (m) => {
        if (m.noteControle !== undefined) return <span className="lm-chiffres font-medium">Noté {m.noteControle}/5</span>;
        const c = controlePlanifie(m, missions);
        if (c)
          return (
            <Link to={`/erp/menages/${c.id}`} className="text-[13px] text-(--lm-info) hover:underline" onClick={(e) => e.stopPropagation()}>
              Planifié le {dateCourte(c.date)}
            </Link>
          );
        return (
          <Button size="sm" variant="secondary" icone={<ClipboardCheck />} onClick={() => planifier(m)}>
            Planifier un contrôle
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Alert tone="or" titre="Contrôle qualité physique">
        Une mission sur dix est tirée au sort pour un contrôle sur place, et toute note voyageur inférieure à {note(SEUIL_NOTE_CONTROLE)} en déclenche un.
        Aucun logement ne reste un mois sans contrôle physique.
      </Alert>
      <Table
        colonnes={colonnes}
        lignes={aControler}
        cleLigne={(m) => m.id}
        legende="Missions à contrôler"
        dense
        vide="Aucune mission à contrôler."
      />
    </div>
  );
}
