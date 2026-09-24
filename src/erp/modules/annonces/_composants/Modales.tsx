import { useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { controlerVersion, LONGUEUR_DESCRIPTION, LONGUEUR_TITRE_MAX } from '../../../annonces/generer';
import type { VersionAnnonce } from '../../../data/types';
import { Alert, Button, Field, Input, Modal, Textarea } from '../../../ui';
import type { Issue } from './actions';

type Retour = (r: Issue) => void;

export function EditionVersion({ version, onValider, onFermer }: {
  version: VersionAnnonce;
  onValider: (texte: Pick<VersionAnnonce, 'titre' | 'accroche' | 'description'>) => Issue;
  onFermer: Retour;
}) {
  const [titre, setTitre] = useState(version.titre);
  const [accroche, setAccroche] = useState(version.accroche);
  const [description, setDescription] = useState(version.description);
  const [erreur, setErreur] = useState<string>();
  const controles = controlerVersion({ titre, accroche, description });

  const envoyer = () => {
    const r = onValider({ titre: titre.trim(), accroche: accroche.trim(), description: description.trim() });
    if (r.ok) onFermer(r);
    else setErreur(r.erreur);
  };

  return (
    <Modal
      ouvert
      taille="lg"
      onFermer={() => onFermer({ ok: true })}
      titre="Modifier puis valider"
      description="Corrigez le texte proposé. Rien d’inventé : chaque atout doit être vrai aujourd’hui."
      pied={
        <>
          <Button variant="ghost" onClick={() => onFermer({ ok: true })}>Annuler</Button>
          <Button variant="primary" icone={<Check />} onClick={envoyer} disabled={controles.length > 0}>
            Enregistrer et valider
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="Titre" requis aide={`${titre.length} / ${LONGUEUR_TITRE_MAX} caractères`}>
          <Input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Accroche (une ligne)" requis>
          <Input value={accroche} onChange={(e) => setAccroche(e.target.value)} />
        </Field>
        <Field
          label="Description"
          requis
          aide={`${description.length} caractères (entre ${LONGUEUR_DESCRIPTION.min} et ${LONGUEUR_DESCRIPTION.max})`}
        >
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={11} />
        </Field>
        {controles.length > 0 && (
          <Alert tone="alerte" titre="À corriger avant validation">
            {controles.join(' ')}
          </Alert>
        )}
        {erreur && <Alert tone="danger">{erreur}</Alert>}
      </div>
    </Modal>
  );
}

export function RejetVersion({ onRejeter, onFermer }: { onRejeter: (motif: string) => Issue; onFermer: Retour }) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string>();
  const envoyer = () => {
    const r = onRejeter(motif);
    if (r.ok) onFermer(r);
    else setErreur(r.erreur);
  };
  return (
    <Modal
      ouvert
      taille="md"
      onFermer={() => onFermer({ ok: true })}
      titre="Rejeter la proposition"
      description="Le mois reste traité : l’agent ne repropose pas de version avant le mois prochain, sauf demande manuelle."
      pied={
        <>
          <Button variant="ghost" onClick={() => onFermer({ ok: true })}>Annuler</Button>
          <Button variant="danger" onClick={envoyer}>Rejeter</Button>
        </>
      }
    >
      <Field label="Motif du rejet" requis erreur={erreur} aide="Il guide les prochaines propositions.">
        <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Ex. : angle télétravail déjà utilisé le mois dernier" />
      </Field>
    </Modal>
  );
}

export function PublicationVersion({ version, onPublier, onFermer }: {
  version: VersionAnnonce;
  onPublier: () => Issue;
  onFermer: Retour;
}) {
  const [copie, setCopie] = useState<'ok' | 'echec'>();
  const [erreur, setErreur] = useState<string>();
  const texte = `${version.titre}\n\n${version.accroche}\n\n${version.description}`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };
  const publier = () => {
    const r = onPublier();
    if (r.ok) onFermer(r);
    else setErreur(r.erreur);
  };

  return (
    <Modal
      ouvert
      taille="lg"
      onFermer={() => onFermer({ ok: true })}
      titre="Publier la version validée"
      pied={
        <>
          <Button icone={copie === 'ok' ? <Check /> : <Copy />} onClick={copier}>
            {copie === 'ok' ? 'Texte copié' : 'Copier le texte'}
          </Button>
          <Button variant="primary" icone={<Send />} onClick={publier}>
            Marquer comme publiée
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert tone="info" titre="Mode démonstration">
          En production, publication via Channex si l’API le permet, sinon copier-coller dans Airbnb : bouton Copier le texte.
        </Alert>
        {copie === 'echec' && <Alert tone="alerte">Copie impossible dans ce navigateur : sélectionnez le texte ci-dessous.</Alert>}
        <Field label="Texte à publier">
          <Textarea readOnly value={texte} rows={10} />
        </Field>
        {erreur && <Alert tone="danger">{erreur}</Alert>}
      </div>
    </Modal>
  );
}
