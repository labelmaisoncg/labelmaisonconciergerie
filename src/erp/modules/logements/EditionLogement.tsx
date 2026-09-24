import { useEffect, useState, type FormEvent } from 'react';
import { Button, Callout, Drawer, Field, Input, Select } from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { CHECKLIST_LANCEMENT, PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../data/constantes';
import type { Dpe, Logement, Serrure, TypeLit, TypeLogement } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  /** Absent : création d'un nouveau logement (statut « En lancement »). */
  logement?: Logement;
  onCree?: (id: string) => void;
}

interface Saisie {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  type: TypeLogement;
  surfaceM2: string;
  capacite: string;
  chambres: string;
  lits: Record<TypeLit, string>;
  dpe: string;
  numeroEnregistrement: string;
  residencePrincipale: boolean;
  serrure: Serrure;
  proprietaireId: string;
}

const TYPES = Object.entries(LIBELLES.typeLogement).map(([valeur, libelle]) => ({ valeur, libelle }));
const SERRURES = Object.entries(LIBELLES.serrure).map(([valeur, libelle]) => ({ valeur, libelle }));
const DPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((v) => ({ valeur: v, libelle: v }));

function initial(l?: Logement): Saisie {
  const lits = (t: TypeLit) => String(l?.lits.find((x) => x.type === t)?.nombre ?? 0);
  return {
    nom: l?.nom ?? '',
    adresse: l?.adresse ?? '',
    codePostal: l?.codePostal ?? '',
    ville: l?.ville ?? '',
    type: l?.type ?? 'T2',
    surfaceM2: l ? String(l.surfaceM2) : '',
    capacite: l ? String(l.capacite) : '',
    chambres: l ? String(l.chambres) : '1',
    lits: { double: lits('double'), simple: lits('simple'), canape: lits('canape') },
    dpe: l?.dpe ?? '',
    numeroEnregistrement: l?.numeroEnregistrement ?? '',
    residencePrincipale: l?.residencePrincipale ?? false,
    serrure: l?.serrure ?? 'boite_a_cles',
    proprietaireId: l?.proprietaireId ?? '',
  };
}

const entier = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

export function EditionLogement({ ouvert, onFermer, logement, onCree }: Props) {
  const { proprietaires, upsert } = useErp();
  const [s, setS] = useState<Saisie>(() => initial(logement));
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Saisie, string>>>({});

  useEffect(() => {
    if (ouvert) {
      setS(initial(logement));
      setErreurs({});
    }
  }, [ouvert, logement]);

  const maj = <K extends keyof Saisie>(k: K, v: Saisie[K]) => setS((x) => ({ ...x, [k]: v }));

  const valider = (): boolean => {
    const e: Partial<Record<keyof Saisie, string>> = {};
    if (!s.nom.trim()) e.nom = 'Le nom est obligatoire.';
    if (!s.adresse.trim()) e.adresse = 'L’adresse est obligatoire.';
    if (!/^\d{5}$/.test(s.codePostal.trim())) e.codePostal = 'Code postal à 5 chiffres.';
    if (!s.ville.trim()) e.ville = 'La ville est obligatoire.';
    if (!(entier(s.surfaceM2) > 0)) e.surfaceM2 = 'Surface en m², nombre entier.';
    if (!(entier(s.capacite) > 0)) e.capacite = 'Au moins 1 voyageur.';
    if (Number.isNaN(entier(s.chambres))) e.chambres = 'Nombre entier.';
    if (Object.values(s.lits).some((n) => Number.isNaN(entier(n)))) e.lits = 'Nombres entiers.';
    if (!s.proprietaireId) e.proprietaireId = 'Choisissez le propriétaire.';
    if (s.numeroEnregistrement && !/^[0-9A-Z]{13}$/i.test(s.numeroEnregistrement.trim()))
      e.numeroEnregistrement = 'Format attendu : 13 caractères (ex. 91174000125RX).';
    setErreurs(e);
    return Object.keys(e).length === 0;
  };

  const enregistrer = (ev: FormEvent) => {
    ev.preventDefault();
    if (!valider()) return;
    const lits = (Object.entries(s.lits) as [TypeLit, string][])
      .map(([type, n]) => ({ type, nombre: entier(n) }))
      .filter((x) => x.nombre > 0);
    const base: Logement = logement ?? {
      id: nouvelId('log'),
      nom: '',
      adresse: '',
      ville: '',
      codePostal: '',
      type: 'T2',
      surfaceM2: 0,
      capacite: 0,
      chambres: 0,
      lits: [],
      statut: 'lancement',
      proprietaireId: '',
      residencePrincipale: false,
      serrure: 'boite_a_cles',
      fiche: { wifiNom: '', wifiCode: '', heureArrivee: '16:00', heureDepart: '11:00', acces: '', parking: '', regles: '', equipements: [] },
      dotationLinge: [],
      annonces: [
        { canal: 'airbnb', connecte: false },
        { canal: 'booking', connecte: false },
        { canal: 'direct', connecte: false },
      ],
      checklistLancement: CHECKLIST_LANCEMENT.map((c) => ({ ...c, fait: false })),
    };
    const suivant: Logement = {
      ...base,
      nom: s.nom.trim(),
      adresse: s.adresse.trim(),
      codePostal: s.codePostal.trim(),
      ville: s.ville.trim(),
      type: s.type,
      surfaceM2: entier(s.surfaceM2),
      capacite: entier(s.capacite),
      chambres: entier(s.chambres),
      lits,
      dpe: (s.dpe || undefined) as Dpe | undefined,
      numeroEnregistrement: s.numeroEnregistrement.trim().toUpperCase() || undefined,
      residencePrincipale: s.residencePrincipale,
      serrure: s.serrure,
      proprietaireId: s.proprietaireId,
    };
    upsert('logements', suivant);
    onFermer();
    if (!logement) onCree?.(suivant.id);
  };

  return (
    <Drawer
      ouvert={ouvert}
      onFermer={onFermer}
      titre={logement ? `Modifier ${logement.nom}` : 'Nouveau logement'}
      sousTitre={logement ? 'Informations de base du logement.' : 'Le logement démarre « En lancement » : il ne passera actif qu’avec un mandat signé et une checklist complète.'}
      pied={
        <>
          <Button onClick={onFermer}>Annuler</Button>
          <Button variant="primary" type="submit" form="form-logement">
            {logement ? 'Enregistrer' : 'Créer le logement'}
          </Button>
        </>
      }
    >
      <form id="form-logement" onSubmit={enregistrer} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom du logement" requis erreur={erreurs.nom} className="sm:col-span-2">
          <Input value={s.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="Ex. Corbeil Rives de Seine" />
        </Field>
        <Field label="Propriétaire" requis erreur={erreurs.proprietaireId} className="sm:col-span-2">
          <Select
            value={s.proprietaireId}
            onChange={(e) => maj('proprietaireId', e.target.value)}
            placeholder="Choisir un propriétaire"
            options={proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
          />
        </Field>
        <Field label="Adresse" requis erreur={erreurs.adresse} className="sm:col-span-2">
          <Input value={s.adresse} onChange={(e) => maj('adresse', e.target.value)} autoComplete="street-address" />
        </Field>
        <Field label="Code postal" requis erreur={erreurs.codePostal}>
          <Input value={s.codePostal} onChange={(e) => maj('codePostal', e.target.value)} inputMode="numeric" maxLength={5} />
        </Field>
        <Field label="Ville" requis erreur={erreurs.ville}>
          <Input value={s.ville} onChange={(e) => maj('ville', e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={s.type} onChange={(e) => maj('type', e.target.value as TypeLogement)} options={TYPES} />
        </Field>
        <Field label="Surface (m²)" requis erreur={erreurs.surfaceM2}>
          <Input value={s.surfaceM2} onChange={(e) => maj('surfaceM2', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Capacité (voyageurs)" requis erreur={erreurs.capacite}>
          <Input value={s.capacite} onChange={(e) => maj('capacite', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Chambres" erreur={erreurs.chambres}>
          <Input value={s.chambres} onChange={(e) => maj('chambres', e.target.value)} inputMode="numeric" />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Lits</legend>
          <div className="grid grid-cols-3 gap-3">
            {(['double', 'simple', 'canape'] as TypeLit[]).map((t) => (
              <Field key={t} label={LIBELLES.typeLit[t]}>
                <Input value={s.lits[t]} onChange={(e) => maj('lits', { ...s.lits, [t]: e.target.value })} inputMode="numeric" />
              </Field>
            ))}
          </div>
          {erreurs.lits && <p role="alert" className="mt-1 text-[12px] font-medium text-(--lm-danger)">{erreurs.lits}</p>}
        </fieldset>
        <Field label="DPE">
          <Select value={s.dpe} onChange={(e) => maj('dpe', e.target.value)} placeholder="Non fourni" options={DPES} />
        </Field>
        <Field label="Serrure / accès">
          <Select value={s.serrure} onChange={(e) => maj('serrure', e.target.value as Serrure)} options={SERRURES} />
        </Field>
        <Field label="N° d’enregistrement meublé de tourisme" erreur={erreurs.numeroEnregistrement} aide="Obligatoire pour activer le logement." className="sm:col-span-2">
          <Input value={s.numeroEnregistrement} onChange={(e) => maj('numeroEnregistrement', e.target.value)} placeholder="91174000125RX" />
        </Field>
        <label className="flex items-start gap-2.5 text-[13.5px] sm:col-span-2">
          <input
            type="checkbox"
            checked={s.residencePrincipale}
            onChange={(e) => maj('residencePrincipale', e.target.checked)}
            className="mt-0.5 size-4 accent-(--lm-or)"
          />
          <span>
            Résidence principale du propriétaire
            <span className="block text-[12px] text-(--lm-encre-3)">Location limitée à {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile.</span>
          </span>
        </label>
        {s.serrure === 'cles' && (
          <Callout tone="alerte" className="sm:col-span-2" titre="Accès non sécurisé">
            La remise de clés en main propre ne valide pas le point « Accès sécurisé » de la checklist de lancement.
          </Callout>
        )}
      </form>
    </Drawer>
  );
}
