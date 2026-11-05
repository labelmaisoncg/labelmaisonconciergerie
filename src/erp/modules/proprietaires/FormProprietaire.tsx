import { useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react';
import { Assistant, Button, CHAMP_ASSISTANT, ChoixListe, Field, Input, Modal, NBSP, RecapAssistant, Select, Textarea, useParcours } from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { AUJOURDHUI } from '../../data/format';
import { brouillonModifie } from '../../data/parcours-assistant';
import { erreursProprietaire, proprietaireDepuisSaisie, saisieProprietaireInitiale, type ErreursProprietaire, type SaisieProprietaire } from '../../data/creation-logement';
import { ECRANS_PROPRIETAIRE, creationProprietaire, erreursEcranProprietaire, recapProprietaire, type EcranProprietaire } from '../../data/creation-proprietaire';
import type { Proprietaire, TypeProprietaire } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  proprietaire?: Proprietaire;
  onCree?: (id: string) => void;
}

/**
 * Propriétaire : création pas à pas (AssistantProprietaire), modification par
 * le formulaire (ModificationProprietaire). Saisie, contrôles et fiche :
 * data/creation-logement.ts et data/creation-proprietaire.ts (comme
 * l'assistant de création d'un logement).
 */
export function FormProprietaire({ ouvert, onFermer, proprietaire: p, onCree }: Props) {
  if (p) return <ModificationProprietaire ouvert={ouvert} onFermer={onFermer} proprietaire={p} />;
  // Monté à chaque ouverture : un brouillon neuf.
  return ouvert ? <AssistantProprietaire onFermer={onFermer} onCree={onCree} /> : null;
}

type Saisie = SaisieProprietaire;

const TYPES = Object.entries(LIBELLES.typeProprietaire).map(([valeur, libelle]) => ({ valeur, libelle }));

/* ---------------------------------------------------------------- création */

const QUESTIONS: Record<EcranProprietaire, (s: Saisie) => { question: string; aide?: string }> = {
  type: () => ({ question: `Qui est le propriétaire${NBSP}?` }),
  nom: (s) => ({ question: s.type === 'particulier' ? `Quel est son nom${NBSP}?` : `Quelle est sa raison sociale${NBSP}?` }),
  contact: () => ({ question: `Comment le joindre${NBSP}?` }),
  adresse: () => ({ question: `Quelle est son adresse postale${NBSP}?` }),
  notes: () => ({ question: `Une note pour l’équipe${NBSP}?`, aide: 'Facultatif. Elle reste interne, le propriétaire ne la voit pas.' }),
  recapitulatif: () => ({ question: `Tout est correct${NBSP}?` }),
};

const TYPES_DETAIL: Record<TypeProprietaire, string> = {
  particulier: 'Une personne',
  sci: 'Société civile immobilière',
  societe: 'Entreprise (SARL, SAS…)',
};

/** Erreurs sans champ à elles : toujours dites au-dessus de « Continuer ». */
const SANS_CHAMP = new Set(['type']);

const idChamp = (cle: string) => `assistant-proprietaire-${cle}`;

function AssistantProprietaire({ onFermer, onCree }: { onFermer: () => void; onCree?: (id: string) => void }) {
  const { upsert } = useErp();
  const [s, setS] = useState<Saisie>(() => saisieProprietaireInitiale());
  const depart = useRef(s);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const p = useParcours<EcranProprietaire>({ ecrans: ECRANS_PROPRIETAIRE, idChamp, sansChamp: SANS_CHAMP });
  const ecran = p.ecran;
  const erreurs = erreursEcranProprietaire(ecran, s);
  const etat = p.etat(erreurs);
  const maj = <K extends keyof Saisie>(k: K, v: Saisie[K]) => setS((x) => ({ ...x, [k]: v }));

  const creer = () => {
    if (envoi) return;
    const r = creationProprietaire(s, nouvelId('pro'), AUJOURDHUI);
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursEcranProprietaire('recapitulatif', s)));
    setEnvoi(true);
    upsert('proprietaires', r.proprietaire);
    onFermer();
    onCree?.(r.proprietaire.id);
  };
  const continuer = () => p.continuer(erreurs, creer);
  const q = QUESTIONS[ecran](s);

  const champ = (cle: 'nom' | 'email' | 'telephone' | 'adresse', label: string, extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} erreur={etat.erreurChamp(cle)}>
      <Input id={idChamp(cle)} value={s[cle]} onChange={(e) => maj(cle, e.target.value)} onBlur={() => p.quitter(cle)} autoComplete="off" className={CHAMP_ASSISTANT} {...extra} />
    </Field>
  );

  return (
    <Assistant
      titre="Nouveau propriétaire"
      ecrans={ECRANS_PROPRIETAIRE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le propriétaire')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, s)}
      abandon={`Abandonner ce propriétaire${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'type' && (
        <ChoixListe
          options={(Object.keys(LIBELLES.typeProprietaire) as TypeProprietaire[]).map((t) => ({ valeur: t, libelle: LIBELLES.typeProprietaire[t], detail: TYPES_DETAIL[t] }))}
          valeur={s.type}
          onChange={(t) => maj('type', t)}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('type')}
        />
      )}
      {ecran === 'nom' && champ('nom', s.type === 'particulier' ? 'Nom complet' : 'Raison sociale')}
      {ecran === 'contact' && (
        <div className="space-y-4">
          {champ('email', 'E-mail', { type: 'email', inputMode: 'email' })}
          {champ('telephone', 'Téléphone', { type: 'tel' })}
        </div>
      )}
      {ecran === 'adresse' && champ('adresse', 'Adresse postale')}
      {ecran === 'notes' && (
        <Field label="Notes internes">
          <Textarea id={idChamp('notes')} value={s.notes} onChange={(e) => maj('notes', e.target.value)} rows={4} className="text-[16px]" />
        </Field>
      )}
      {ecran === 'recapitulatif' && <RecapAssistant lignes={recapProprietaire(s).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))} />}
    </Assistant>
  );
}

/* ------------------------------------------------------------ modification */

function ModificationProprietaire({ ouvert, onFermer, proprietaire: p }: { ouvert: boolean; onFermer: () => void; proprietaire: Proprietaire }) {
  const { upsert } = useErp();
  const vierge = (): Saisie => saisieProprietaireInitiale(p);
  const [s, setS] = useState<Saisie>(vierge);
  const [erreurs, setErreurs] = useState<ErreursProprietaire>({});

  useEffect(() => {
    if (ouvert) {
      setS(vierge());
      setErreurs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, p.id]);

  const maj = (k: keyof Saisie, v: string) => setS((x) => ({ ...x, [k]: v }));

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    const err = erreursProprietaire(s);
    setErreurs(err);
    if (Object.keys(err).length) return;
    upsert('proprietaires', proprietaireDepuisSaisie(s, p, AUJOURDHUI));
    onFermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={`Modifier ${p.nom}`}
      pied={
        <>
          <Button onClick={onFermer}>Annuler</Button>
          <Button variant="primary" type="submit" form="form-proprietaire">
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="form-proprietaire" onSubmit={enregistrer} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={s.type} onChange={(e) => maj('type', e.target.value)} options={TYPES} />
        </Field>
        <Field label={s.type === 'particulier' ? 'Nom complet' : 'Raison sociale'} requis erreur={erreurs.nom}>
          <Input value={s.nom} onChange={(e) => maj('nom', e.target.value)} />
        </Field>
        <Field label="E-mail" requis erreur={erreurs.email}>
          <Input type="email" value={s.email} onChange={(e) => maj('email', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Téléphone" requis erreur={erreurs.telephone}>
          <Input type="tel" value={s.telephone} onChange={(e) => maj('telephone', e.target.value)} />
        </Field>
        <Field label="Adresse postale" requis erreur={erreurs.adresse} className="sm:col-span-2">
          <Input value={s.adresse} onChange={(e) => maj('adresse', e.target.value)} />
        </Field>
        <Field label="Notes internes" className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => maj('notes', e.target.value)} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}
