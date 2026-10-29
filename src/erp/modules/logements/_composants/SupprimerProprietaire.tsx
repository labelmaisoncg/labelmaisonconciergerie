/**
 * « Supprimer le propriétaire » (la corbeille en haut à droite du panneau
 * « Espace propriétaire », PanneauEspace, ouvert par « Gérer » dans
 * Paramètres → Accès), pour le gérant : une fiche créée par erreur, en double
 * ou pour un essai disparaît de l'ERP. Avec un historique, la fenêtre dit
 * pourquoi ; son espace encore ouvert : « Retirer l'accès » (le même geste que
 * la section Accès du panneau : le serveur ferme ses liens et ses sessions).
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
import { PHRASE_LOGEMENTS_PROPRIETAIRE, accesDuProprietaire, peutSupprimerPersonne, phraseConfirmation, verdictSuppressionProprietaire } from '../../../data/suppression-personnes';
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
  const [accesRetire, setAccesRetire] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  if (!peutSupprimerPersonne(d.utilisateur.role, d.lectureSeule)) return null;

  const ouvrir = () => {
    setAccesRetire(false);
    setEchec(null);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);
  // Calculé à l'ouverture, sur les données du moment.
  const verdict = ouvert && !accesRetire ? verdictSuppressionProprietaire({ role: d.utilisateur.role, lectureSeule: d.lectureSeule, proprietaireId: p.id, donnees: d.donnees }) : null;

  const supprimer = () => {
    const nom = p.nom;
    const r = d.supprimerProprietaire(p.id);
    if (!r.ok) return setEchec(r.erreur);
    naviguer(RETOUR, { state: { message: `« ${nom} » a été supprimé.` } });
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
      } else await appelerServeur(API, 'POST', { action: 'retirer', proprietaireId: p.id });
      setAccesRetire(true);
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
  const fermerSeul = (
    <Button variant="primary" onClick={fermer}>
      Fermer
    </Button>
  );
  const boutonRetirer = (
    <Button variant="primary" icone={<UserX />} chargement={enCours} onClick={() => void retirerAcces()}>
      Retirer l’accès
    </Button>
  );

  let titre = '';
  let description: string | undefined;
  let pied: ReactNode = null;
  if (accesRetire) {
    titre = `L’accès de « ${p.nom} » est retiré`;
    description = 'Ses liens ne marchent plus. Son espace se ferme dès qu’il recharge la page ou ouvre un document.';
    pied = fermerSeul;
  } else if (verdict?.ok) {
    titre = `Supprimer « ${p.nom} » ?`;
    description = phraseConfirmation(verdict.avecLui);
    pied = (
      <>
        {annuler}
        <Button variant="danger" icone={<Trash2 />} onClick={supprimer}>
          Supprimer
        </Button>
      </>
    );
  } else if (verdict?.motif === 'historique') {
    const logements = verdict.historique.some((t) => t.cle === 'logements');
    titre = `Impossible de supprimer « ${p.nom} »`;
    description = `Il a ${resumeHistorique(verdict.historique)}.${logements ? ` ${PHRASE_LOGEMENTS_PROPRIETAIRE}` : ''}${verdict.accesOuvert ? ' Son espace propriétaire est encore ouvert.' : ''}`;
    pied = verdict.accesOuvert ? (
      <>
        {annuler}
        {boutonRetirer}
      </>
    ) : (
      fermerSeul
    );
  } else if (verdict?.motif === 'acces') {
    titre = `« ${p.nom} » a encore un accès`;
    description = 'Son espace propriétaire est encore ouvert. Retirez d’abord son accès, puis supprimez la fiche.';
    pied = (
      <>
        {annuler}
        {boutonRetirer}
      </>
    );
  } else if (verdict) {
    titre = 'Suppression impossible';
    description = verdict.message;
    pied = fermerSeul;
  }

  return (
    <>
      <IconButton label="Supprimer le propriétaire" size={size} onClick={ouvrir}>
        <Trash2 />
      </IconButton>
      <Modal ouvert={ouvert} onFermer={fermer} taille="sm" titre={titre} description={description} pied={pied}>
        {echec ? <Alert tone="danger">{echec}</Alert> : undefined}
      </Modal>
    </>
  );
}
