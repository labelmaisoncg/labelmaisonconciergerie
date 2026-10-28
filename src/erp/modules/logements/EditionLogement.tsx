import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button, Drawer, Field, Input, Select } from '../../ui';
import { FormProprietaire } from '../proprietaires/FormProprietaire';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../data/constantes';
import { AUJOURDHUI } from '../../data/format';
import { TYPES_LIT, erreursSaisieLogement, logementDepuisSaisie, saisieInitiale, type ErreursLogement, type SaisieLogement } from '../../data/creation-logement';
import { enregistrerLogement } from './_composants/enregistrerLogement';
import type { Logement, Serrure, StatutLogement, TypeLogement } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  /** Absent : création d'un nouveau logement (statut « En préparation »). La liste passe par l'assistant pas à pas. */
  logement?: Logement;
  onCree?: (id: string) => void;
}

const TYPES = Object.entries(LIBELLES.typeLogement).map(([valeur, libelle]) => ({ valeur, libelle }));
const SERRURES = Object.entries(LIBELLES.serrure).map(([valeur, libelle]) => ({ valeur, libelle }));
const DPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((v) => ({ valeur: v, libelle: v }));
/** « En préparation » : pas encore en location (logement créé à la main ou par le dossier propriétaire). */
const STATUTS: { valeur: StatutLogement; libelle: string }[] = [
  { valeur: 'actif', libelle: 'Actif' },
  { valeur: 'pause', libelle: 'En pause' },
  { valeur: 'lancement', libelle: 'En préparation' },
  { valeur: 'sorti', libelle: 'Sorti (plus géré)' },
];

/**
 * Formulaire d'un logement (modification, et création hors liste). Saisie,
 * contrôles et logement enregistré viennent de data/creation-logement.ts,
 * comme pour l'assistant de création : les deux ne peuvent pas diverger.
 */
export function EditionLogement({ ouvert, onFermer, logement, onCree }: Props) {
  const d = useErp();
  const { proprietaires } = d;
  const [nouveauProprietaire, setNouveauProprietaire] = useState(false);
  const [s, setS] = useState<SaisieLogement>(() => saisieInitiale(logement));
  const [erreurs, setErreurs] = useState<ErreursLogement>({});

  useEffect(() => {
    if (ouvert) {
      setS(saisieInitiale(logement));
      setErreurs({});
    }
  }, [ouvert, logement]);

  const maj = <K extends keyof SaisieLogement>(k: K, v: SaisieLogement[K]) => setS((x) => ({ ...x, [k]: v }));

  const enregistrer = (ev: FormEvent) => {
    ev.preventDefault();
    const e = erreursSaisieLogement(s);
    setErreurs(e);
    if (Object.keys(e).length) return;
    const aEnregistrer = logementDepuisSaisie(s, logement ?? nouvelId('log'), AUJOURDHUI);
    enregistrerLogement(d, aEnregistrer);
    onFermer();
    if (!logement) onCree?.(aEnregistrer.id);
  };

  return (
    <>
    <Drawer
      ouvert={ouvert}
      onFermer={onFermer}
      titre={logement ? `Modifier ${logement.nom}` : 'Nouveau logement'}
      sousTitre={logement ? undefined : 'Il démarre « En préparation ».'}
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
        {logement && (
          <Field label="Statut" className="sm:col-span-2">
            <Select value={s.statut} onChange={(e) => maj('statut', e.target.value as StatutLogement)} options={STATUTS} />
          </Field>
        )}
        <Field label="Nom du logement" requis erreur={erreurs.nom} className="sm:col-span-2">
          <Input value={s.nom} onChange={(e) => maj('nom', e.target.value)} placeholder="Ex. Corbeil Rives de Seine" />
        </Field>
        <Field label="Propriétaire" requis erreur={erreurs.proprietaireId} className="sm:col-span-2">
          <Select
            value={s.proprietaireId}
            onChange={(e) => maj('proprietaireId', e.target.value)}
            placeholder={proprietaires.length ? 'Choisir un propriétaire' : 'Aucun propriétaire : ajoutez-le'}
            options={proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
          />
        </Field>
        <button
          type="button"
          onClick={() => setNouveauProprietaire(true)}
          className="-mt-2 inline-flex h-8 items-center gap-1 justify-self-start text-[13px] font-medium text-(--lm-or-texte) hover:underline sm:col-span-2"
        >
          <Plus className="size-3.5" aria-hidden />
          Nouveau propriétaire
        </button>
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
            {TYPES_LIT.map((t) => (
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
        <Field label="N° d’enregistrement meublé de tourisme" erreur={erreurs.numeroEnregistrement} className="sm:col-span-2">
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
      </form>
    </Drawer>
    {/* Hors du panneau : une fenêtre par-dessus, pas dedans. */}
    <FormProprietaire ouvert={nouveauProprietaire} onFermer={() => setNouveauProprietaire(false)} onCree={(id) => maj('proprietaireId', id)} />
    </>
  );
}
