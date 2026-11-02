/**
 * « Supprimer la fiche » d'un membre de l'équipe de terrain (la corbeille en
 * haut à droite du tiroir, PanneauResponsable dans Acces.tsx), pour le gérant :
 * une fiche créée par erreur, en double ou pour un essai disparaît de l'ERP.
 * Avec un historique, la fenêtre dit pourquoi et propose « Retirer de
 * l'équipe » (actif: false, l'interrupteur du tiroir) ; si son accès est
 * encore ouvert, seulement « Fermer » (l'accès se gère dans le tiroir : on ne
 * le coupe pas depuis un refus). Sans historique mais avec un accès encore
 * ouvert : « Retirer l'accès » (le geste du tiroir, passé en `onRetirerAcces`),
 * puis « Supprimer » dès que le verdict le permet.
 * Règles : data/suppression-personnes.ts.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, UserMinus, UserX } from 'lucide-react';
import { logementsSansPersonne } from '../../data/acces-gerant';
import { MODE_DEMO } from '../../data/config';
import { affectationsSans } from '../../data/operations';
import { useErp } from '../../data/store';
import { resumeHistorique } from '../../data/suppression-logement';
import {
  PHRASE_ACCES_OUVERT_MEMBRE,
  PHRASE_DEJA_HORS_EQUIPE,
  PHRASE_RETIRER_DE_LEQUIPE,
  accesOuvert,
  peutSupprimerPersonne,
  phraseConfirmation,
  verdictSuppressionMembre,
} from '../../data/suppression-personnes';
import type { MembreEquipe } from '../../data/types-operations';
import { Alert, Button, IconButton, Modal } from '../../ui';

export function SupprimerMembre({
  membre: m,
  onRetirerAcces,
  onRetireDeLEquipe,
}: {
  membre: MembreEquipe;
  /** Retire son accès (serveur ou démo) ; rend le message d'erreur, ou rien si c'est fait. */
  onRetirerAcces: () => Promise<string | undefined>;
  /** La fiche affichée dans le tiroir n'est plus « dans l'équipe ». */
  onRetireDeLEquipe: () => void;
}) {
  const d = useErp();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [fait, setFait] = useState<'acces' | 'equipe' | null>(null);
  // Accès retiré depuis la fenêtre : la ligne relue le montre (« Supprimer » possible) ; sinon « Fermer » seul.
  const [relu, setRelu] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  if (!peutSupprimerPersonne(d.utilisateur.role, d.lectureSeule)) return null;

  const ouvrir = () => {
    setFait(null);
    setRelu(false);
    setEchec(null);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);
  // Calculé sur les données du moment : après le retrait de l'accès, « Supprimer » dès qu'il le permet.
  const verdict = ouvert ? verdictSuppressionMembre({ role: d.utilisateur.role, lectureSeule: d.lectureSeule, membreId: m.id, donnees: d.donnees }) : null;

  const supprimer = () => {
    const nom = m.nom;
    const r = d.supprimerMembre(m.id);
    if (!r.ok) return setEchec(r.erreur);
    // Le tiroir se ferme de lui-même (la fiche n'existe plus) ; retour à la liste des responsables.
    naviguer('/erp/parametres/acces', { state: { message: `La fiche de « ${nom} » a été supprimée.` } });
  };

  const retirerAcces = async () => {
    setEchec(null);
    setEnCours(true);
    const erreur = await onRetirerAcces();
    if (erreur) {
      setEnCours(false);
      return setEchec(erreur);
    }
    // En production la ligne est écrite par le serveur : relue (et livrée au store) avant de proposer « Supprimer », jamais sur un verdict périmé.
    const lu = MODE_DEMO ? null : await d.relire('accesOperations', m.id);
    setRelu(MODE_DEMO || (!!lu && !accesOuvert(lu)));
    setEnCours(false);
    setFait('acces');
  };

  // Comme l'interrupteur « Fait partie de l'équipe » : hors de l'équipe, plus responsable ni remplaçant de ses logements.
  const retirerDeLEquipe = () => {
    const r = d.mettreAJour('equipe', m.id, (x) => ({ ...x, actif: false }));
    if (!r.ok) return setEchec(r.erreur);
    for (const a of affectationsSans(d.donnees.affectations, m.id, m.logementIds)) d.upsert('affectations', a);
    onRetireDeLEquipe();
    setFait('equipe');
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
  if (fait === 'acces') {
    titre = `L’accès de « ${m.nom} » est retiré`;
    description = 'Ses liens ne marchent plus. Son espace se ferme au prochain rechargement de la page.';
    pied = relu && verdict?.ok ? (
      <>
        {fermerDiscret}
        {boutonSupprimer}
      </>
    ) : (
      fermerSeul
    );
  } else if (fait === 'equipe') {
    titre = `« ${m.nom} » est hors de l’équipe`;
    description = 'Cette personne n’a plus d’accès à l’espace opérations. Son historique reste.';
    pied = fermerSeul;
  } else if (verdict?.ok) {
    // Logements que plus personne ne suivrait : dits avant le bouton, qui reste disponible.
    const seuls = m.actif ? logementsSansPersonne(d.donnees.equipe, m.id, m.logementIds).map((id) => d.logements.find((l) => l.id === id)?.nom ?? 'Logement') : [];
    titre = `Supprimer « ${m.nom} » ?`;
    description = phraseConfirmation(verdict.avecLui);
    pied = (
      <>
        {seuls.length > 0 && (
          <p role="note" className="mb-1 flex w-full items-start gap-2 text-[13px] text-(--lm-encre)">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
            <span>Plus personne ne suivra {seuls.join(', ')}.</span>
          </p>
        )}
        {annuler}
        {boutonSupprimer}
      </>
    );
  } else if (verdict?.motif === 'historique') {
    titre = `Impossible de supprimer « ${m.nom} »`;
    const suite = verdict.accesOuvert ? PHRASE_ACCES_OUVERT_MEMBRE : verdict.dansLEquipe ? PHRASE_RETIRER_DE_LEQUIPE : PHRASE_DEJA_HORS_EQUIPE;
    description = `Cette fiche a ${resumeHistorique(verdict.historique)}. ${suite}`;
    pied =
      !verdict.accesOuvert && verdict.dansLEquipe ? (
        <>
          {annuler}
          <Button variant="primary" icone={<UserMinus />} onClick={retirerDeLEquipe}>
            Retirer de l’équipe
          </Button>
        </>
      ) : (
        fermerSeul
      );
  } else if (verdict?.motif === 'acces') {
    titre = `« ${m.nom} » a encore un accès`;
    description = 'Son espace opérations est encore ouvert. Retirez d’abord son accès, puis supprimez la fiche.';
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
      <IconButton label="Supprimer la fiche" size="sm" onClick={ouvrir}>
        <Trash2 />
      </IconButton>
      <Modal ouvert={ouvert} onFermer={fermer} taille="sm" titre={titre} description={description} pied={pied}>
        {echec ? <Alert tone="danger">{echec}</Alert> : undefined}
      </Modal>
    </>
  );
}
