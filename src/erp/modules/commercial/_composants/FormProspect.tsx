import { useState, type FormEvent } from 'react';
import { LIBELLES } from '../../../data/libelles';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import { AUJOURDHUI } from '../../../data/format';
import { RESPONSABLES, erreursProspect, type BrouillonProspect, type ErreursProspect } from '../../../data/creation-prospect';
import type { EtapeProspect, Responsable, SourceProspect } from '../../../data/types';
import { Field, Input, Select, Textarea } from '../../../ui';

/** Saisie, contrôles et fiche : data/creation-prospect.ts (partagés avec l'assistant « Nouveau prospect »). */
export { brouillonDe, versProspect, type BrouillonProspect } from '../../../data/creation-prospect';

const opts = <K extends string>(r: Record<K, string>, cles?: readonly K[]) =>
  (cles ?? (Object.keys(r) as K[])).map((k) => ({ valeur: k, libelle: r[k] }));

/** Formulaire prospect de la fiche (Drawer) ; la création passe par l'assistant pas à pas (NouveauProspect). */
export function FormProspect({
  id,
  initial,
  onValide,
  avecEtape = true,
}: {
  id: string;
  initial: BrouillonProspect;
  onValide: (b: BrouillonProspect) => void;
  avecEtape?: boolean;
}) {
  const [b, setB] = useState(initial);
  const [erreurs, setErreurs] = useState<ErreursProspect>({});
  const maj = <K extends keyof BrouillonProspect>(k: K, v: BrouillonProspect[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const soumettre = (ev: FormEvent) => {
    ev.preventDefault();
    const e = erreursProspect(b);
    setErreurs(e);
    if (Object.keys(e).length === 0) onValide(b);
  };

  const enRetard = b.prochaineActionLe && b.prochaineActionLe < AUJOURDHUI;

  return (
    <form id={id} onSubmit={soumettre} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Propriétaire" requis erreur={erreurs.nom} className="sm:col-span-2">
        <Input value={b.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="Nom et prénom, ou SCI" autoComplete="off" />
      </Field>
      <Field label="Ville" requis erreur={erreurs.ville}>
        <Input value={b.ville} onChange={(e) => maj('ville', e.target.value)} placeholder="Évry-Courcouronnes" />
      </Field>
      <Field label="Type de bien" requis erreur={erreurs.typeBien}>
        <Input value={b.typeBien} onChange={(e) => maj('typeBien', e.target.value)} placeholder="T2 45 m²" />
      </Field>
      <Field label="Revenu annuel estimé (€)" requis erreur={erreurs.revenu} aide="Revenu locatif net des frais de plateforme.">
        <Input inputMode="decimal" value={b.revenu} onChange={(e) => maj('revenu', e.target.value)} placeholder="18000" className="lm-chiffres" />
      </Field>
      <Field label="Source">
        <Select value={b.source} onChange={(e) => maj('source', e.target.value as SourceProspect)} options={opts(LIBELLES.sourceProspect)} />
      </Field>
      <Field label="Responsable">
        <Select value={b.responsable} onChange={(e) => maj('responsable', e.target.value as Responsable)} options={RESPONSABLES} />
      </Field>
      {avecEtape && (
        <Field label="Étape" aide={b.etape === 'signe' ? 'Pour un nouveau mandat, passez plutôt par « Lancer un mandat ».' : undefined}>
          <Select value={b.etape} onChange={(e) => maj('etape', e.target.value as EtapeProspect)} options={opts(LIBELLES.etapeProspect, [...ETAPES_PIPELINE, 'perdu'])} />
        </Field>
      )}
      <Field label="Prochaine action" erreur={erreurs.prochaineAction} className={avecEtape ? '' : 'sm:col-span-1'}>
        <Input value={b.prochaineAction} onChange={(e) => maj('prochaineAction', e.target.value)} placeholder="Rappeler, envoyer l’estimation..." />
      </Field>
      <Field label="Date de l’action" erreur={erreurs.prochaineActionLe} aide={enRetard ? 'Date dépassée : action en retard.' : undefined}>
        <Input type="date" value={b.prochaineActionLe} onChange={(e) => maj('prochaineActionLe', e.target.value)} className={enRetard ? 'text-(--lm-danger)' : ''} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <Textarea rows={4} value={b.notes} onChange={(e) => maj('notes', e.target.value)} placeholder="Contexte, objections, parrain..." />
      </Field>
    </form>
  );
}
