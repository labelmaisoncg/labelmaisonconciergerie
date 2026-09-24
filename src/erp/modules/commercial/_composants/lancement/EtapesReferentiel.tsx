import { useErp } from '../../../../data/store';
import { LIBELLES } from '../../../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../../../data/constantes';
import type { Serrure, TypeLogement, TypeProprietaire } from '../../../../data/types';
import { Alert, Field, Input, Select, cn } from '../../../../ui';
import type { BrouillonLancement, Erreurs } from './etat';

export interface PropsEtape {
  b: BrouillonLancement;
  maj: <K extends keyof BrouillonLancement>(k: K, v: BrouillonLancement[K]) => void;
  erreurs: Erreurs;
}

const options = <K extends string>(r: Record<K, string>) => (Object.keys(r) as K[]).map((k) => ({ valeur: k, libelle: r[k] }));

export function EtapeProprietaire({ b, maj, erreurs }: PropsEtape) {
  const { proprietaires, prospects } = useErp();
  const ouverts = prospects.filter((p) => p.etape !== 'signe' && p.etape !== 'perdu');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Prospect concerné" aide="Il passera à l’étape « Signé » à la fin du lancement." className="sm:col-span-2">
        <Select value={b.prospectId} onChange={(e) => maj('prospectId', e.target.value)} placeholder="Aucun (mandat hors pipeline)"
          options={ouverts.map((p) => ({ valeur: p.id, libelle: `${p.nom} · ${p.ville} (${LIBELLES.etapeProspect[p.etape]})` }))} />
      </Field>
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Propriétaire</legend>
        <div className="flex flex-wrap gap-2">
          {(['nouveau', 'existant'] as const).map((m) => (
            <label key={m} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px]',
              b.modeProprio === m ? 'border-(--lm-or) bg-(--lm-or-lavis)' : 'border-(--lm-bord-fort)')}>
              <input type="radio" name="modeProprio" checked={b.modeProprio === m} onChange={() => maj('modeProprio', m)} className="accent-(--lm-or)" />
              {m === 'nouveau' ? 'Nouveau propriétaire' : 'Propriétaire existant'}
            </label>
          ))}
        </div>
      </fieldset>
      {b.modeProprio === 'existant' ? (
        <Field label="Propriétaire existant" requis erreur={erreurs.proprietaireId} className="sm:col-span-2" aide="Pour un deuxième bien confié par le même propriétaire.">
          <Select value={b.proprietaireId} onChange={(e) => maj('proprietaireId', e.target.value)} placeholder="Choisir..."
            options={proprietaires.map((p) => ({ valeur: p.id, libelle: `${p.nom} (${LIBELLES.typeProprietaire[p.type]})` }))} />
        </Field>
      ) : (
        <>
          <Field label="Nom" requis erreur={erreurs.propNom}>
            <Input value={b.propNom} onChange={(e) => maj('propNom', e.target.value)} />
          </Field>
          <Field label="Type">
            <Select value={b.propType} onChange={(e) => maj('propType', e.target.value as TypeProprietaire)} options={options(LIBELLES.typeProprietaire)} />
          </Field>
          <Field label="E-mail" erreur={erreurs.email}>
            <Input type="email" value={b.email} onChange={(e) => maj('email', e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Téléphone" erreur={erreurs.telephone}>
            <Input type="tel" value={b.telephone} onChange={(e) => maj('telephone', e.target.value)} placeholder="06 12 34 56 78" />
          </Field>
          <Field label="Adresse postale" className="sm:col-span-2">
            <Input value={b.propAdresse} onChange={(e) => maj('propAdresse', e.target.value)} />
          </Field>
        </>
      )}
    </div>
  );
}

export function EtapeLogement({ b, maj, erreurs }: PropsEtape) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nom interne" requis erreur={erreurs.logNom} aide="Ex. « Évry Parc T2 ». Utilisé partout dans l’ERP." className="sm:col-span-2">
        <Input value={b.logNom} onChange={(e) => maj('logNom', e.target.value)} />
      </Field>
      <Field label="Adresse" requis erreur={erreurs.adresse} className="sm:col-span-2">
        <Input value={b.adresse} onChange={(e) => maj('adresse', e.target.value)} />
      </Field>
      <Field label="Ville" requis erreur={erreurs.ville}>
        <Input value={b.ville} onChange={(e) => maj('ville', e.target.value)} />
      </Field>
      <Field label="Code postal" requis erreur={erreurs.codePostal}>
        <Input inputMode="numeric" maxLength={5} value={b.codePostal} onChange={(e) => maj('codePostal', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Type">
        <Select value={b.type} onChange={(e) => maj('type', e.target.value as TypeLogement)} options={options(LIBELLES.typeLogement)} />
      </Field>
      <Field label="Surface (m²)" requis erreur={erreurs.surface}>
        <Input inputMode="numeric" value={b.surface} onChange={(e) => maj('surface', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Capacité (personnes)" requis erreur={erreurs.capacite}>
        <Input inputMode="numeric" value={b.capacite} onChange={(e) => maj('capacite', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Chambres" requis erreur={erreurs.chambres}>
        <Input inputMode="numeric" value={b.chambres} onChange={(e) => maj('chambres', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Accès" aide="Code différent à chaque séjour.">
        <Select value={b.serrure} onChange={(e) => maj('serrure', e.target.value as Serrure)} options={options(LIBELLES.serrure)} />
      </Field>
      <label className="flex items-start gap-2 self-end pb-2 text-[13.5px] text-(--lm-encre)">
        <input type="checkbox" checked={b.residencePrincipale} onChange={(e) => maj('residencePrincipale', e.target.checked)} className="mt-0.5 size-4 accent-(--lm-or)" />
        Résidence principale du propriétaire
      </label>
      {b.residencePrincipale && (
        <Alert tone="info" className="sm:col-span-2" titre={`Plafond de ${PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par an`}>
          Une résidence principale ne peut pas être louée plus de {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile. Le compteur sera suivi sur la fiche logement.
        </Alert>
      )}
    </div>
  );
}
