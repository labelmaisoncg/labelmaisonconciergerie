import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AUJOURDHUI, dateCourte, ecartJours, pluriel } from '../../../data/format';
import { useErp } from '../../../data/store';
import { ecartsLinge, type EcartLinge } from '../../../data/selectors';
import { Button, EmptyState, StatusBadge, Table, type Colonne } from '../../../ui';
import { refEnvoi } from './calculs';

/** Écarts d'inventaire (SPEC §2.6) : chaque écart doit devenir un incident. */
export function Ecarts({ onMessage }: { onMessage: (texte: string) => void }) {
  const { mouvementsLinge, logements, incidents, prestataires, creerIncident } = useErp();
  const ecarts = ecartsLinge(mouvementsLinge);
  /** Incident déjà ouvert pour cet écart : par référence d'envoi, sinon même logement, même article, après l'envoi. */
  const incidentDe = (e: EcartLinge) =>
    incidents.find(
      (i) =>
        i.categorie === 'linge' &&
        i.description.toLowerCase().includes(e.article.toLowerCase()) &&
        (i.description.includes(refEnvoi(e.envoiId)) || (i.logementId === e.logementId && i.date >= e.date)),
    );

  const creer = (e: EcartLinge) => {
    const logement = logements.find((l) => l.id === e.logementId);
    const envoi = mouvementsLinge.find((m) => m.id === e.envoiId);
    const blanchisseur = prestataires.find((p) => p.id === envoi?.prestataireId);
    const i = creerIncident({
      logementId: e.logementId,
      date: AUJOURDHUI,
      categorie: 'linge',
      gravite: e.manquant >= 3 ? 'haute' : 'moyenne',
      description: `Écart d’inventaire : ${pluriel(e.manquant, 'article')} « ${e.article} » non revenu${e.manquant > 1 ? 's' : ''} de blanchisserie (envoi du ${dateCourte(e.date)}${blanchisseur ? `, ${blanchisseur.nom}` : ''}). ${refEnvoi(e.envoiId)}.`,
      refacturable: blanchisseur ? 'prestataire' : 'aucun',
      responsable: 'Kamel',
    });
    onMessage(`Incident créé pour ${logement?.nom ?? 'le logement'} (${i.id}).`);
  };

  const colonnes: Colonne<EcartLinge>[] = [
    { cle: 'date', titre: 'Envoi du', rendu: (e) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(e.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'logement', titre: 'Logement', rendu: (e) => <span className="font-medium">{logements.find((l) => l.id === e.logementId)?.nom}</span> },
    { cle: 'article', titre: 'Article', rendu: (e) => e.article },
    { cle: 'manquant', titre: 'Manquant', align: 'droite', rendu: (e) => <span className="lm-chiffres font-semibold text-(--lm-danger)">{e.manquant}</span>, tri: (a, b) => a.manquant - b.manquant },
    { cle: 'retard', titre: 'Retard', rendu: (e) => pluriel(ecartJours(e.date, AUJOURDHUI), 'jour'), masquerMobile: true },
    {
      cle: 'incident',
      titre: 'Incident',
      rendu: (e) => {
        const i = incidentDe(e);
        return i ? (
          <Link to={`/erp/incidents?id=${i.id}`} className="inline-flex" aria-label={`Voir l’incident ${i.id}`}>
            <StatusBadge type="statutIncident" valeur={i.statut} />
          </Link>
        ) : (
          <Button size="sm" variant="danger" icone={<AlertTriangle />} onClick={() => creer(e)}>
            Créer un incident
          </Button>
        );
      },
    },
  ];

  if (!ecarts.length)
    return <EmptyState icone={<CheckCircle2 />} titre="Rien ne manque" description="Tout le linge envoyé en blanchisserie est revenu dans les délais (5 jours)." />;

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-(--lm-encre-2)">
        Articles envoyés en blanchisserie depuis plus de 5 jours et non revenus. Un écart d’inventaire est un incident : il est tracé, chiffré et, si besoin, refacturé.
      </p>
      <Table colonnes={colonnes} lignes={ecarts} cleLigne={(e) => `${e.envoiId}-${e.article}`} legende="Écarts d’inventaire" dense triInitial={{ cle: 'date', sens: 'desc' }} />
    </div>
  );
}
