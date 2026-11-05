/**
 * Ajouter un prestataire, pas à pas (kit ui/Assistant.tsx) : son métier, qui
 * il est, comment le joindre, où il intervient, son engagement, puis le
 * récapitulatif. Rien n'est enregistré avant « Créer le prestataire » ;
 * règles et fiche : data/creation-prestataire.ts. Il reste non conforme tant
 * que ses documents ne sont pas déposés.
 */
import { useId, useRef, useState } from 'react';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_PRESTATAIRE,
  SANS_CHAMP_PRESTATAIRE,
  brouillonPrestataire,
  erreursPrestataire,
  prestataireDepuisBrouillon,
  recapPrestataire,
  type BrouillonPrestataire,
  type EcranPrestataire,
} from '../../../data/creation-prestataire';
import { LIBELLES } from '../../../data/libelles';
import { nouvelId, useErp } from '../../../data/store';
import type { Prestataire, TypePrestataire } from '../../../data/types';
import { Assistant, CHAMP_ASSISTANT, ChoixListe, Field, Input, NBSP, RecapAssistant, cn, useParcours } from '../../../ui';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (p: Prestataire) => void;
}

export function PrestataireModal({ ouvert, onFermer, onCree }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf.
  return <AssistantPrestataire onFermer={onFermer} onCree={onCree} />;
}

const QUESTIONS: Record<EcranPrestataire, { question: string; aide?: string }> = {
  metier: { question: `Quel est son métier${NBSP}?` },
  identite: { question: `Qui est-il${NBSP}?` },
  contact: { question: `Comment le joindre${NBSP}?` },
  zone: { question: `Où intervient-il${NBSP}?` },
  engagement: { question: `S’engage-t-il à ne pas sous-traiter${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const METIERS = (Object.keys(LIBELLES.typePrestataire) as TypePrestataire[]).map((t) => ({ valeur: t, libelle: LIBELLES.typePrestataire[t] }));

const idChamp = (cle: string) => `assistant-prestataire-${cle}`;

function AssistantPrestataire({ onFermer, onCree }: Omit<Props, 'ouvert'>) {
  const { upsert } = useErp();
  const [b, setB] = useState<BrouillonPrestataire>(brouillonPrestataire);
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const p = useParcours<EcranPrestataire>({ ecrans: ECRANS_PRESTATAIRE, idChamp, sansChamp: SANS_CHAMP_PRESTATAIRE });
  const ecran = p.ecran;
  const erreurs = erreursPrestataire(ecran, b);
  const etat = p.etat(erreurs);
  const maj = <K extends keyof BrouillonPrestataire>(k: K, v: BrouillonPrestataire[K]) => setB((x) => ({ ...x, [k]: v }));

  const creer = () => {
    if (envoi) return;
    const r = prestataireDepuisBrouillon(b, nouvelId('pre'));
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursPrestataire('recapitulatif', b)));
    setEnvoi(true);
    upsert('prestataires', r.prestataire);
    // Fermer d'abord : ouvert par « ?nouveau=1 », la fermeture retire le paramètre de l'adresse, puis sa fiche s'ouvre.
    onFermer();
    onCree(r.prestataire);
  };
  const continuer = () => p.continuer(erreurs, creer);
  const q = QUESTIONS[ecran];

  const champ = (cle: 'nom' | 'raisonSociale' | 'siret' | 'telephone' | 'email' | 'zone', label: string, extra: { aide?: string; type?: string; inputMode?: 'numeric' | 'email' | 'tel'; placeholder?: string } = {}) => (
    <Field label={label} aide={extra.aide} erreur={etat.erreurChamp(cle)}>
      <Input
        id={idChamp(cle)}
        type={extra.type}
        inputMode={extra.inputMode}
        placeholder={extra.placeholder}
        value={b[cle]}
        onChange={(e) => maj(cle, e.target.value)}
        onBlur={() => p.quitter(cle)}
        autoComplete="off"
        className={CHAMP_ASSISTANT}
      />
    </Field>
  );

  return (
    <Assistant
      titre="Nouveau prestataire"
      ecrans={ECRANS_PRESTATAIRE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le prestataire')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce prestataire${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'metier' && <ChoixListe options={METIERS} valeur={b.type} onChange={(t) => maj('type', t)} onContinuer={continuer} labelledBy={titreId} idPremier={idChamp('type')} />}
      {ecran === 'identite' && (
        <div className="space-y-4">
          {champ('nom', 'Nom de l’intervenant')}
          {champ('raisonSociale', 'Raison sociale', { aide: 'Facultatif.' })}
          {champ('siret', 'SIRET', { inputMode: 'numeric', placeholder: '14 chiffres' })}
        </div>
      )}
      {ecran === 'contact' && (
        <div className="space-y-4">
          {champ('telephone', 'Téléphone', { type: 'tel' })}
          {champ('email', 'E-mail', { type: 'email', inputMode: 'email', aide: 'Facultatif.' })}
        </div>
      )}
      {ecran === 'zone' && champ('zone', 'Zone d’intervention', { aide: 'Villes séparées par des virgules.', placeholder: 'Corbeil-Essonnes, Évry-Courcouronnes' })}
      {ecran === 'engagement' && (
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
            b.sansCascade ? 'border-(--lm-or-texte) bg-(--lm-or-lavis)' : 'border-(--lm-bord-fort) hover:border-(--lm-encre)',
          )}
        >
          <input
            id={idChamp('sansCascade')}
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-(--lm-or-texte)"
            checked={b.sansCascade}
            onChange={(e) => maj('sansCascade', e.target.checked)}
          />
          <span className="text-[15px] text-(--lm-encre)">
            Le prestataire intervient lui-même ou avec ses salariés déclarés. Il s’engage à ne pas sous-traiter, et le linge n’est jamais lavé à son domicile.
          </span>
        </label>
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapPrestataire(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">
            Ajoutez ensuite ses documents et ses tarifs depuis sa fiche. Vous pourrez lui confier des ménages dès que son contrat, son assurance (RC Pro) et son attestation URSSAF seront déposés.
          </p>
        </RecapAssistant>
      )}
    </Assistant>
  );
}
