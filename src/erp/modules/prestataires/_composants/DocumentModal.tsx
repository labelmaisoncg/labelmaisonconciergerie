import { useEffect, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { VALIDITE_URSSAF_MOIS } from '../../../data/constantes';
import { AUJOURDHUI, dateCourte } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { DocumentPrestataire, Prestataire, TypeDocument } from '../../../data/types';
import { Alert, Button, Field, Input, Modal, Select } from '../../../ui';

interface Props {
  prestataire: Prestataire;
  /** null : fermé. */
  type: TypeDocument | null;
  onFermer: () => void;
  onSucces: (texte: string) => void;
}

const finUrssaf = (delivrance: string) => format(addMonths(parseISO(delivrance), VALIDITE_URSSAF_MOIS), 'yyyy-MM-dd');

/** Dépôt ou renouvellement d'un document de conformité. */
export function DocumentModal({ prestataire, type: typeInitial, onFermer, onSucces }: Props) {
  const { upsert } = useErp();
  const [type, setType] = useState<TypeDocument>('contrat');
  const [delivrance, setDelivrance] = useState(AUJOURDHUI);
  const [fin, setFin] = useState('');
  const [url, setUrl] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!typeInitial) return;
    const existant = prestataire.documents.find((d) => d.type === typeInitial);
    setType(typeInitial);
    setDelivrance(AUJOURDHUI);
    setFin('');
    setUrl(existant?.url ?? '');
    setErreur(null);
  }, [typeInitial, prestataire]);

  const valideJusquau = type === 'urssaf' ? (delivrance ? finUrssaf(delivrance) : '') : fin;

  const enregistrer = () => {
    if (type === 'urssaf' && !delivrance) return setErreur('Indiquez la date de délivrance de l’attestation.');
    if (type === 'urssaf' && valideJusquau < AUJOURDHUI) return setErreur(`Attestation de plus de ${VALIDITE_URSSAF_MOIS} mois : demandez une attestation de vigilance récente.`);
    if ((type === 'contrat' || type === 'rc_pro') && !fin) return setErreur('Indiquez la date de fin de validité.');
    if (valideJusquau && valideJusquau < AUJOURDHUI) return setErreur('Ce document est déjà expiré : il ne peut pas rendre le prestataire conforme.');
    if (!url.trim()) return setErreur('Joignez le document (adresse du fichier) : sans pièce, pas de conformité.');
    const doc: DocumentPrestataire = { type, statut: 'valide', url: url.trim(), valideJusquau: valideJusquau || undefined };
    const documents = type === 'autre' ? [...prestataire.documents, doc] : [...prestataire.documents.filter((d) => d.type !== type), doc];
    upsert('prestataires', { ...prestataire, documents });
    onSucces(`${LIBELLES.typeDocument[type]} enregistré${valideJusquau ? `, valable jusqu’au ${dateCourte(valideJusquau)}` : ''}.`);
    onFermer();
  };

  return (
    <Modal
      ouvert={typeInitial !== null}
      onFermer={onFermer}
      titre="Mettre à jour un document"
      description={prestataire.nom}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button variant="primary" onClick={enregistrer}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Document" requis>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value as TypeDocument);
              setErreur(null);
            }}
            options={(Object.keys(LIBELLES.typeDocument) as TypeDocument[]).map((t) => ({ valeur: t, libelle: LIBELLES.typeDocument[t] }))}
          />
        </Field>
        {type === 'urssaf' ? (
          <Field label="Date de délivrance" requis aide={valideJusquau ? `Valable ${VALIDITE_URSSAF_MOIS} mois, jusqu’au ${dateCourte(valideJusquau)}.` : undefined}>
            <Input type="date" value={delivrance} max={AUJOURDHUI} onChange={(e) => setDelivrance(e.target.value)} />
          </Field>
        ) : (
          <Field label="Valable jusqu’au" requis={type === 'contrat' || type === 'rc_pro'} aide={type === 'kbis' ? 'Facultatif pour un Kbis.' : undefined}>
            <Input type="date" value={fin} min={AUJOURDHUI} onChange={(e) => setFin(e.target.value)} />
          </Field>
        )}
        <Field label="Fichier (adresse)" requis>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
        </Field>
        {erreur && <Alert tone="danger">{erreur}</Alert>}
      </div>
    </Modal>
  );
}
