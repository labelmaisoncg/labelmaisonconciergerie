/**
 * « Supprimer le logement » (repli « Administratif » de la fiche), pour le
 * gérant : un logement créé par erreur, en double ou pour un essai
 * disparaît de l'ERP. Avec un historique, ou une annonce encore suivie, la
 * fenêtre dit pourquoi et propose la suite : « Passer en Sorti » ou
 * Connexions. Règles : data/suppression-logement.ts.
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Plug, Trash2 } from 'lucide-react';
import { peutSupprimerLogement, resumeHistorique, verdictSuppression } from '../../../data/suppression-logement';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import { Alert, Button, ButtonLink, Modal } from '../../../ui';

const CONNEXIONS = '/erp/logements/connexions';

export function SupprimerLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const [sorti, setSorti] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  if (!peutSupprimerLogement(d.utilisateur.role, d.lectureSeule)) return null;

  const ouvrir = () => {
    setSorti(false);
    setEchec(null);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);
  // Calculé à l'ouverture, sur les données du moment.
  const verdict = ouvert && !sorti ? verdictSuppression({ role: d.utilisateur.role, lectureSeule: d.lectureSeule, logementId: l.id, donnees: d.donnees }) : null;

  const supprimer = () => {
    const nom = l.nom;
    const r = d.supprimerLogement(l.id);
    if (!r.ok) return setEchec(r.erreur);
    naviguer('/erp/logements', { state: { message: `« ${nom} » a été supprimé.` } });
  };

  const passerEnSorti = () => {
    const r = d.mettreAJour('logements', l.id, (x) => ({ ...x, statut: 'sorti' }));
    if (!r.ok) return setEchec(r.erreur);
    setSorti(true);
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

  let titre = '';
  let description: string | undefined;
  let pied: ReactNode = null;
  if (sorti) {
    titre = `« ${l.nom} » est sorti`;
    description = 'Il n’apparaît plus dans les listes ; son historique reste.';
    pied = fermerSeul;
  } else if (verdict?.ok) {
    titre = `Supprimer « ${l.nom} » ?`;
    description = `Il disparaît de l’ERP${verdict.avecLui.length ? `, avec ${verdict.avecLui.join(' et ')}` : ''}.`;
    pied = (
      <>
        {annuler}
        <Button variant="danger" icone={<Trash2 />} onClick={supprimer}>
          Supprimer
        </Button>
      </>
    );
  } else if (verdict?.motif === 'historique') {
    const dejaSorti = l.statut === 'sorti';
    titre = `Impossible de supprimer « ${l.nom} »`;
    description = `Il a ${resumeHistorique(verdict.historique)}. ${
      dejaSorti ? 'Il est déjà « Sorti » : il n’apparaît plus dans les listes, rien n’est perdu.' : 'Passez-le en « Sorti » : il quitte les listes, rien n’est perdu.'
    }`;
    pied = dejaSorti ? (
      fermerSeul
    ) : (
      <>
        {annuler}
        <Button variant="primary" icone={<Archive />} onClick={passerEnSorti}>
          Passer en Sorti
        </Button>
      </>
    );
  } else if (verdict?.motif === 'annonce') {
    titre = `« ${l.nom} » est encore suivi`;
    description = 'Son annonce arrive toujours des plateformes : supprimé, il reviendrait au prochain import. Décochez-la dans Connexions, puis supprimez-le.';
    pied = (
      <>
        {annuler}
        <ButtonLink to={CONNEXIONS} variant="primary" icone={<Plug />}>
          Ouvrir Connexions
        </ButtonLink>
      </>
    );
  } else if (verdict) {
    titre = 'Suppression impossible';
    description = verdict.message;
    pied = fermerSeul;
  }

  return (
    <div className="mt-4 flex justify-end border-t border-(--lm-bord) pt-3">
      <Button size="sm" variant="ghost" icone={<Trash2 />} className="text-(--lm-danger) hover:text-(--lm-danger)" onClick={ouvrir}>
        Supprimer le logement
      </Button>
      <Modal ouvert={ouvert} onFermer={fermer} taille="sm" titre={titre} description={description} pied={pied}>
        {echec ? <Alert tone="danger">{echec}</Alert> : undefined}
      </Modal>
    </div>
  );
}
