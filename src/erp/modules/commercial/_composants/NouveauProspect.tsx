/**
 * Nouveau prospect, pas à pas (kit ui/Assistant.tsx), éventuellement
 * pré-rempli (simulateur) : le propriétaire, le bien, le revenu attendu,
 * d'où il vient et qui le suit, l'étape, la prochaine action, une note, puis
 * le récapitulatif. Rien n'est enregistré avant « Créer le prospect » ;
 * règles et fiche : data/creation-prospect.ts (les mêmes que la fiche).
 */
import { useId, useRef, useState } from 'react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_PROSPECT,
  RESPONSABLES,
  brouillonDe,
  creationProspect,
  erreursEcranProspect,
  recapProspect,
  type BrouillonProspect,
  type EcranProspect,
} from '../../../data/creation-prospect';
import type { EtapeProspect, Prospect, SourceProspect } from '../../../data/types';
import { Assistant, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, Field, Input, InputEuros, NBSP, RecapAssistant, Textarea, useParcours } from '../../../ui';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  initial?: Partial<Prospect>;
  /** Prospect créé (la page ferme l'assistant et le dit). */
  onCree: (p: Prospect) => void;
}

export function NouveauProspect({ ouvert, ...props }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf (pré-rempli par le simulateur s'il y a lieu).
  return <AssistantProspect {...props} />;
}

const QUESTIONS: Record<EcranProspect, { question: string; aide?: string }> = {
  proprietaire: { question: `Qui est le propriétaire${NBSP}?`, aide: 'Un propriétaire intéressé par la gestion de son bien.' },
  bien: { question: `Quel bien${NBSP}?` },
  revenu: { question: `Combien peut-il rapporter${NBSP}?` },
  origine: { question: `D’où vient-il${NBSP}?` },
  etape: { question: `Où en êtes-vous${NBSP}?`, aide: 'Il entre dans le pipeline à cette étape.' },
  action: { question: `Quelle est la prochaine action${NBSP}?` },
  notes: { question: `Une note${NBSP}?`, aide: 'Facultatif.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const SOURCES = (Object.keys(LIBELLES.sourceProspect) as SourceProspect[]).map((s) => ({ valeur: s, libelle: LIBELLES.sourceProspect[s] }));
const ETAPES = ([...ETAPES_PIPELINE, 'perdu'] as EtapeProspect[]).map((e) => ({ valeur: e, libelle: LIBELLES.etapeProspect[e] }));

/** Choix sans champ à eux : leur erreur est dite au-dessus de « Continuer ». */
const SANS_CHAMP = new Set(['source', 'responsable', 'etape']);

const idChamp = (cle: string) => `assistant-prospect-${cle}`;

function AssistantProspect({ onFermer, initial, onCree }: Omit<Props, 'ouvert'>) {
  const { upsert } = useErp();
  const [b, setB] = useState<BrouillonProspect>(() => brouillonDe({ prochaineAction: 'Premier appel de qualification', prochaineActionLe: AUJOURDHUI, ...initial }));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const responsableId = useId();
  const p = useParcours<EcranProspect>({ ecrans: ECRANS_PROSPECT, idChamp, sansChamp: SANS_CHAMP });
  const ecran = p.ecran;
  const erreurs = erreursEcranProspect(ecran, b);
  const etat = p.etat(erreurs);
  const maj = <K extends keyof BrouillonProspect>(k: K, v: BrouillonProspect[K]) => setB((x) => ({ ...x, [k]: v }));

  const creer = () => {
    if (envoi) return;
    const r = creationProspect(b, { id: nouvelId('pst'), creeLe: AUJOURDHUI });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursEcranProspect('recapitulatif', b)));
    setEnvoi(true);
    upsert('prospects', r.prospect);
    onCree(r.prospect);
  };
  const continuer = () => p.continuer(erreurs, creer);
  const q = QUESTIONS[ecran];
  const champ = (cle: 'nom' | 'ville' | 'typeBien' | 'prochaineAction', label: string, placeholder?: string) => (
    <Field label={label} erreur={etat.erreurChamp(cle)}>
      <Input id={idChamp(cle)} value={b[cle]} onChange={(e) => maj(cle, e.target.value)} onBlur={() => p.quitter(cle)} placeholder={placeholder} autoComplete="off" className={CHAMP_ASSISTANT} />
    </Field>
  );
  const enRetard = b.prochaineActionLe && b.prochaineActionLe < AUJOURDHUI;

  return (
    <Assistant
      titre="Nouveau prospect"
      ecrans={ECRANS_PROSPECT}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le prospect')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce prospect${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'proprietaire' && champ('nom', 'Propriétaire', 'Nom et prénom, ou SCI')}
      {ecran === 'bien' && (
        <div className="space-y-4">
          {champ('ville', 'Ville', 'Évry-Courcouronnes')}
          {champ('typeBien', 'Type de bien', 'T2 45 m²')}
        </div>
      )}
      {ecran === 'revenu' && (
        <Field label="Revenu annuel estimé" aide="Revenu locatif net des frais de plateforme." erreur={etat.erreurChamp('revenu')}>
          <InputEuros id={idChamp('revenu')} value={b.revenu} onChange={(e) => maj('revenu', e.target.value)} onBlur={() => p.quitter('revenu')} placeholder="18000" className="lm-chiffres" />
        </Field>
      )}
      {ecran === 'origine' && (
        <>
          <ChoixListe options={SOURCES} valeur={b.source} onChange={(s) => maj('source', s)} onContinuer={continuer} labelledBy={titreId} />
          <div className="mt-6 border-t border-(--lm-bord) pt-5">
            <p id={responsableId} className="text-[15px] font-medium text-(--lm-encre)">
              Qui le suit{NBSP}?
            </p>
            <ChoixCourts options={RESPONSABLES} valeur={b.responsable} onChange={(r) => maj('responsable', r)} onContinuer={continuer} labelledBy={responsableId} className="mt-2 grid-cols-2" />
          </div>
        </>
      )}
      {ecran === 'etape' && (
        <>
          <ChoixListe options={ETAPES} valeur={b.etape} onChange={(e) => maj('etape', e)} onContinuer={continuer} labelledBy={titreId} />
          {b.etape === 'signe' && <p className="mt-3 text-[13px] text-(--lm-encre-2)">Pour un nouveau mandat, passez plutôt par «{NBSP}Lancer un mandat{NBSP}».</p>}
        </>
      )}
      {ecran === 'action' && (
        <div className="space-y-4">
          {champ('prochaineAction', 'Prochaine action', 'Rappeler, envoyer l’estimation…')}
          <Field label="Date de l’action" erreur={etat.erreurChamp('prochaineActionLe')} aide={enRetard ? `Date dépassée${NBSP}: action en retard.` : 'Laissez les deux vides s’il n’y a rien de prévu.'}>
            <Input id={idChamp('prochaineActionLe')} type="date" value={b.prochaineActionLe} onChange={(e) => maj('prochaineActionLe', e.target.value)} onBlur={() => p.quitter('prochaineActionLe')} className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'notes' && (
        <Field label="Notes">
          <Textarea id={idChamp('notes')} rows={4} value={b.notes} onChange={(e) => maj('notes', e.target.value)} placeholder="Contexte, objections, parrain…" className="text-[16px]" />
        </Field>
      )}
      {ecran === 'recapitulatif' && <RecapAssistant lignes={recapProspect(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))} />}
    </Assistant>
  );
}
