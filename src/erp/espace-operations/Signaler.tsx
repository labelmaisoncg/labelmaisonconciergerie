import { useEffect, useState } from 'react';
import { jourMois } from '../data/format';
import { Button, Field, Modal, Segmente, Select, Textarea } from '../ui';
import { ChoixPhotos, type PhotoChoisie } from './Photos';
import { useOps } from './commun';

/** Signaler un incident : le logement, urgent ou non, ce qui se passe, des photos. */
export function Signaler({ logementId, onFermer }: { logementId?: string; onFermer: () => void }) {
  const { vue, agir, naviguer, apercu } = useOps();
  const [logement, setLogement] = useState(logementId ?? '');
  const [urgent, setUrgent] = useState(false);
  const [description, setDescription] = useState('');
  const [sejour, setSejour] = useState('');
  const [photos, setPhotos] = useState<PhotoChoisie[]>([]);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  useEffect(() => setSejour(''), [logement]);

  // Séjours du logement dans la fenêtre de l'espace (en cours, tout juste partis, à venir).
  const sejours = vue.sejours.filter((s) => s.logementId === logement);

  const envoyer = async () => {
    if (!logement) return setErreur('Choisissez le logement.');
    if (description.trim().length < 10) return setErreur('Décrivez ce qui se passe (10 caractères au moins).');
    setErreur(undefined);
    setEnCours(true);
    const ok = await agir({ type: 'signaler', logementId: logement, urgent, description: description.trim(), photos: photos.map((p) => p.url), ...(sejour ? { reservationId: sejour } : {}) });
    setEnCours(false);
    if (ok) {
      onFermer();
      naviguer({ onglet: 'incidents', signaler: undefined });
    }
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="lg"
      titre="Signaler un incident"
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" chargement={enCours} disabled={apercu} onClick={() => void envoyer()}>
            Signaler
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Field label="Logement" requis>
          <Select value={logement} placeholder="Choisir" onChange={(e) => setLogement(e.target.value)} options={vue.logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-(--lm-encre)">Priorité</span>
          <Segmente
            label="Priorité"
            valeur={urgent ? 'urgent' : 'normal'}
            onChange={(v) => setUrgent(v === 'urgent')}
            options={[
              { valeur: 'normal', libelle: 'Normal' },
              { valeur: 'urgent', libelle: 'Urgent' },
            ]}
            className="self-start"
          />
          {urgent && <p className="text-[12.5px] text-(--lm-encre-2)">Le gérant et la personne qui suit le logement sont prévenus tout de suite.</p>}
        </div>
        <Field label="Ce qui se passe" requis>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que vous constatez, et ce qu’il faut faire." />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-(--lm-encre)">Photos</span>
          <ChoixPhotos photos={photos} onChange={setPhotos} />
        </div>
        {sejours.length > 0 && (
          <Field label="Séjour concerné">
            <Select
              value={sejour}
              placeholder="Aucun"
              onChange={(e) => setSejour(e.target.value)}
              options={sejours.map((s) => ({ valeur: s.id, libelle: `${s.voyageur}, du ${jourMois(s.arrivee)} au ${jourMois(s.depart)}` }))}
            />
          </Field>
        )}
        {erreur && (
          <p role="alert" className="text-[13px] font-medium text-(--lm-danger)">
            {erreur}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** « Ce logement n'est pas à moi » : le gérant est prévenu, le logement reste là jusqu'à sa réponse. */
export function PasAMoi({ logementId, onFermer }: { logementId: string; onFermer: () => void }) {
  const { agir, nomLogement, apercu } = useOps();
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const envoyer = async () => {
    setEnCours(true);
    const ok = await agir({ type: 'pas-a-moi', logementId, motif: motif.trim() || undefined });
    setEnCours(false);
    if (ok) onFermer();
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Ce logement n’est pas à moi"
      description={`Le gérant reçoit votre message et vérifie. ${nomLogement(logementId)} reste dans votre espace jusqu’à sa réponse.`}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" chargement={enCours} disabled={apercu} onClick={() => void envoyer()}>
            Prévenir le gérant
          </Button>
        </>
      }
    >
      <Field label="Un mot pour le gérant" aide="Facultatif.">
        <Textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. Je ne m’occupe plus de ce logement depuis septembre." maxLength={500} />
      </Field>
    </Modal>
  );
}
