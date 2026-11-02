/**
 * « Supprimer la fiche » d'un propriétaire (la corbeille en haut à droite du
 * panneau « Espace propriétaire », PanneauEspace, ouvert par « Gérer » dans
 * Paramètres → Accès), pour le gérant : une fiche créée par erreur, en double
 * ou pour un essai disparaît de l'ERP. Avec un historique, la fenêtre dit
 * pourquoi, et seulement « Fermer » (un espace encore ouvert se gère dans la
 * section Accès du panneau : on ne coupe pas l'accès d'un client depuis un
 * refus). Sans historique mais avec un accès encore ouvert : « Retirer
 * l'accès » (le geste de la section Accès : le serveur ferme ses liens et ses
 * sessions), puis « Supprimer » dès que le verdict le permet.
 * Depuis la fiche d'un logement, le propriétaire a forcément ce logement : la
 * corbeille n'y est pas montrée (le refus serait systématique).
 * Règles : data/suppression-personnes.ts.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, UserX } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import { horodatageMaintenant } from '../../../data/format';
import { useErp } from '../../../data/store';
import { resumeHistorique } from '../../../data/suppression-logement';
import {
  PHRASE_ACCES_OUVERT_PROPRIETAIRE,
  PHRASE_LOGEMENTS_PROPRIETAIRE,
  accesDuProprietaire,
  accesOuvert,
  peutSupprimerPersonne,
  phraseConfirmation,
  verdictSuppressionProprietaire,
} from '../../../data/suppression-personnes';
import type { Proprietaire } from '../../../data/types';
import { Alert, Button, IconButton, Modal } from '../../../ui';
import { appelerServeur } from '../../messagerie/_composants/serveur';

const API = '/api/espace-proprietaire';
/** Après la suppression : la liste des propriétaires (Paramètres → Accès), avec le message. */
const RETOUR = '/erp/parametres/acces';

export function SupprimerProprietaire({ proprietaire: p, size = 'md', onSupprime }: { proprietaire: Proprietaire; size?: 'sm' | 'md'; onSupprime?: () => void }) {
  const d = useErp();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  // Accès retiré depuis la fenêtre : « relu » quand la ligne relue le montre (« Supprimer » possible), sinon « Fermer » seul.
  const [accesRetire, setAccesRetire] = useState<'relu' | 'en_attente' | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  if (!peutSupprimerPersonne(d.utilisateur.role, d.lectureSeule)) return null;

  const ouvrir = () => {
    setAccesRetire(null);
    setEchec(null);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);
  // Calculé sur les données du moment : après le retrait de l'accès, « Supprimer » dès qu'il le permet.
  const verdict = ouvert ? verdictSuppressionProprietaire({ role: d.utilisateur.role, lectureSeule: d.lectureSeule, proprietaireId: p.id, donnees: d.donnees }) : null;

  const supprimer = () => {
    const nom = p.nom;
    const r = d.supprimerProprietaire(p.id);
    if (!r.ok) return setEchec(r.erreur);
    naviguer(RETOUR, { state: { message: `La fiche de « ${nom} » a été supprimée.` } });
    onSupprime?.();
  };

  // Même geste que « Retirer l'accès » de la section Accès (EspaceProprietaireGerant.tsx).
  const retirerAcces = async () => {
    setEchec(null);
    setEnCours(true);
    try {
      if (MODE_DEMO) {
        const acces = accesDuProprietaire(p.id, d.donnees);
        if (acces) d.upsert('accesProprietaires', { ...acces, statut: 'retire', retireLe: horodatageMaintenant(), version: acces.version + 1, liens: [] });
        setAccesRetire('relu');
      } else {
        await appelerServeur(API, 'POST', { action: 'retirer', proprietaireId: p.id });
        // La ligne est écrite par le serveur : relue (et livrée au store) avant de proposer « Supprimer », jamais sur un verdict périmé.
        const lu = await d.relire('accesProprietaires', p.id);
        setAccesRetire(lu && !accesOuvert(lu) ? 'relu' : 'en_attente');
      }
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setEnCours(false);
    }
  };

  const annuler = (
    <Button variant="ghost" onClick={fermer}>
      Annuler
    </Button>
  );
  const fermerDiscret = (
    <Button variant="ghost" onClick={fermer}>
      Fermer
    </Button>
  );
  const fermerSeul = (
    <Button variant="primary" onClick={fermer}>
      Fermer
    </Button>
  );
  const boutonSupprimer = (
    <Button variant="danger" icone={<Trash2 />} onClick={supprimer}>
      Supprimer
    </Button>
  );

  let titre = '';
  let description: string | undefined;
  let pied: ReactNode = null;
  if (accesRetire) {
    titre = `L’accès de « ${p.nom} » est retiré`;
    description = 'Ses liens ne marchent plus. Son espace se ferme au prochain rechargement de la page ou à l’ouverture d’un document.';
    pied = accesRetire === 'relu' && verdict?.ok ? (
      <>
        {fermerDiscret}
        {boutonSupprimer}
      </>
    ) : (
      fermerSeul
    );
  } else if (verdict?.ok) {
    titre = `Supprimer « ${p.nom} » ?`;
    description = phraseConfirmation(verdict.avecLui);
    pied = (
      <>
        {annuler}
        {boutonSupprimer}
      </>
    );
  } else if (verdict?.motif === 'historique') {
    const logements = verdict.historique.some((t) => t.cle === 'logements');
    titre = `Impossible de supprimer « ${p.nom} »`;
    description = `Cette fiche a ${resumeHistorique(verdict.historique)}.${logements ? ` ${PHRASE_LOGEMENTS_PROPRIETAIRE}` : ''}${verdict.accesOuvert ? ` ${PHRASE_ACCES_OUVERT_PROPRIETAIRE}` : ''}`;
    pied = fermerSeul;
  } else if (verdict?.motif === 'acces') {
    titre = `« ${p.nom} » a encore un accès`;
    description = 'Son espace propriétaire est encore ouvert. Retirez d’abord son accès, puis supprimez la fiche.';
    pied = (
      <>
        {annuler}
        <Button variant="primary" icone={<UserX />} chargement={enCours} onClick={() => void retirerAcces()}>
          Retirer l’accès
        </Button>
      </>
    );
  } else if (verdict) {
    titre = 'Suppression impossible';
    description = verdict.message;
    pied = fermerSeul;
  }

  return (
    <>
      <IconButton label="Supprimer la fiche" size={size} onClick={ouvrir}>
        <Trash2 />
      </IconButton>
      <Modal ouvert={ouvert} onFermer={fermer} taille="sm" titre={titre} description={description} pied={pied}>
        {echec ? <Alert tone="danger">{echec}</Alert> : undefined}
      </Modal>
    </>
  );
}
