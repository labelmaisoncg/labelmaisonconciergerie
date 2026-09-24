import { useState, type FormEvent } from 'react';
import { LIBELLES } from '../../../data/libelles';
import { ETAPES_PIPELINE } from '../../../data/constantes';
import { AUJOURDHUI, versCentimes } from '../../../data/format';
import type { EtapeProspect, Prospect, Responsable, SourceProspect } from '../../../data/types';
import { Field, Input, Select, Textarea } from '../../../ui';

export interface BrouillonProspect {
  nom: string;
  ville: string;
  typeBien: string;
  source: SourceProspect;
  responsable: Responsable;
  etape: EtapeProspect;
  revenu: string;
  prochaineAction: string;
  prochaineActionLe: string;
  notes: string;
}

export function brouillonDe(p?: Partial<Prospect>): BrouillonProspect {
  return {
    nom: p?.nom ?? '',
    ville: p?.ville ?? '',
    typeBien: p?.typeBien ?? '',
    source: p?.source ?? 'seo',
    responsable: p?.responsable ?? 'abdel',
    etape: p?.etape ?? 'nouveau',
    revenu: p?.revenuEstimeAnnuelCentimes ? String(Math.round(p.revenuEstimeAnnuelCentimes / 100)) : '',
    prochaineAction: p?.prochaineAction ?? '',
    prochaineActionLe: p?.prochaineActionLe ?? '',
    notes: p?.notes ?? '',
  };
}

type Erreurs = Partial<Record<keyof BrouillonProspect, string>>;

function valider(b: BrouillonProspect): Erreurs {
  const e: Erreurs = {};
  if (b.nom.trim().length < 2) e.nom = 'Indiquez le nom du propriétaire.';
  if (!b.ville.trim()) e.ville = 'Indiquez la ville du bien.';
  if (!b.typeBien.trim()) e.typeBien = 'Décrivez le bien (ex. T2 45 m²).';
  const c = versCentimes(b.revenu);
  if (!b.revenu.trim() || !Number.isFinite(c) || c <= 0) e.revenu = 'Montant annuel en euros, supérieur à 0.';
  if (b.prochaineActionLe && !b.prochaineAction.trim()) e.prochaineAction = 'Précisez l’action prévue à cette date.';
  if (b.prochaineAction.trim() && !b.prochaineActionLe) e.prochaineActionLe = 'Choisissez une date pour cette action.';
  return e;
}

/** Applique le brouillon validé sur un prospect (nouveau ou existant). */
export function versProspect(b: BrouillonProspect, base: Pick<Prospect, 'id' | 'creeLe'>): Prospect {
  return {
    ...base,
    nom: b.nom.trim(),
    ville: b.ville.trim(),
    typeBien: b.typeBien.trim(),
    source: b.source,
    responsable: b.responsable,
    etape: b.etape,
    revenuEstimeAnnuelCentimes: versCentimes(b.revenu),
    prochaineAction: b.prochaineAction.trim() || undefined,
    prochaineActionLe: b.prochaineActionLe || undefined,
    notes: b.notes.trim(),
  };
}

const opts = <K extends string>(r: Record<K, string>, cles?: readonly K[]) =>
  (cles ?? (Object.keys(r) as K[])).map((k) => ({ valeur: k, libelle: r[k] }));

/** Formulaire prospect partagé par la création (Modal) et la fiche (Drawer). */
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
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const maj = <K extends keyof BrouillonProspect>(k: K, v: BrouillonProspect[K]) => {
    setB((x) => ({ ...x, [k]: v }));
    if (erreurs[k]) setErreurs((e) => ({ ...e, [k]: undefined }));
  };

  const soumettre = (ev: FormEvent) => {
    ev.preventDefault();
    const e = valider(b);
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
        <Select value={b.responsable} onChange={(e) => maj('responsable', e.target.value as Responsable)} options={[{ valeur: 'abdel', libelle: 'Abdel' }, { valeur: 'kamel', libelle: 'Kamel' }]} />
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
