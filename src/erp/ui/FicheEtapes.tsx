import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { erreurChamp, lignesRecapitulatif, type Champ, type Etape, type LigneRecapitulatif, type Valeurs } from '../data/etapes-formulaire';
import { Button } from './Button';
import { cn } from './cn';
import { Field, Input, Select, Textarea } from './Field';
import { Modal } from './Modal';

/**
 * Fiche modifiable d'un formulaire en étapes (même schéma que l'assistant du
 * site, src/app/ui/Wizard.tsx) : une ligne par réponse, regroupées par partie ;
 * chaque ligne ouvre une petite fenêtre avec un seul champ.
 */
export interface FicheEtapesProps {
  etapes: Etape[];
  valeurs: Valeurs;
  onChange: (v: Valeurs) => void;
  lectureSeule?: boolean;
}

export function FicheEtapes({ etapes, valeurs, onChange, lectureSeule }: FicheEtapesProps) {
  const [ouverte, setOuverte] = useState<LigneRecapitulatif>();
  const lignes = lignesRecapitulatif(etapes, valeurs);
  const parties = [...new Set(lignes.map((l) => l.partie))];

  return (
    <div className="space-y-5">
      {parties.map((partie) => (
        <section key={partie} aria-labelledby={`fiche-${partie}`}>
          <h3 id={`fiche-${partie}`} className="mb-1.5 text-[12px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">
            {partie}
          </h3>
          <ul className="divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)">
            {lignes
              .filter((l) => l.partie === partie)
              .map((l) => {
                const contenu = (
                  <>
                    <span className="w-2/5 shrink-0 text-[13px] text-(--lm-encre-2)">{l.libelle}</span>
                    <span className={cn('min-w-0 flex-1 text-[13.5px] break-words', l.valeur ? 'text-(--lm-encre)' : 'text-(--lm-encre-3)')}>{l.valeur || '—'}</span>
                  </>
                );
                return (
                  <li key={l.champ.id}>
                    {lectureSeule ? (
                      <div className="flex gap-3 px-3 py-2.5">{contenu}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOuverte(l)}
                        aria-label={`Modifier : ${l.libelle}`}
                        className="flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset"
                      >
                        {contenu}
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      {ouverte && (
        <FenetreChamp
          ligne={ouverte}
          valeur={valeurs[ouverte.champ.id]}
          onFermer={() => setOuverte(undefined)}
          onEnregistrer={(x) => {
            const v = { ...valeurs };
            if (x === undefined) delete v[ouverte.champ.id];
            else v[ouverte.champ.id] = x;
            onChange(v);
            setOuverte(undefined);
          }}
        />
      )}
    </div>
  );
}

/** Petite fenêtre : un seul champ, validé avec les mêmes règles que l'assistant. */
function FenetreChamp({ ligne, valeur, onFermer, onEnregistrer }: { ligne: LigneRecapitulatif; valeur: unknown; onFermer: () => void; onEnregistrer: (v: unknown) => void }) {
  const c = ligne.champ;
  const [brouillon, setBrouillon] = useState<unknown>(valeur);
  const [erreur, setErreur] = useState('');
  const vide = (x: unknown) => x === '' || x === undefined || (Array.isArray(x) && !x.length) || (typeof x === 'object' && x !== null && !Array.isArray(x) && !Object.keys(x).length);
  const enregistrer = () => {
    const x = vide(brouillon) ? undefined : brouillon;
    const err = erreurChamp(c, x);
    if (err) return setErreur(err);
    onEnregistrer(x);
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      taille="sm"
      titre={ligne.etape.champs.length === 1 ? ligne.etape.question : c.libelle}
      description={ligne.etape.champs.length === 1 ? ligne.etape.aide : ligne.etape.question}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" onClick={enregistrer}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        <SaisieChamp champ={c} valeur={brouillon} erreur={erreur} onChange={(x) => (setBrouillon(x), setErreur(''))} />
      </form>
    </Modal>
  );
}

function SaisieChamp({ champ: c, valeur, erreur, onChange }: { champ: Champ; valeur: unknown; erreur: string; onChange: (v: unknown) => void }) {
  const options = c.options ?? [];
  switch (c.type) {
    case 'choix':
      return (
        <Field label={c.libelle} erreur={erreur}>
          <Select
            value={String(valeur ?? '')}
            onChange={(e) => onChange(e.target.value)}
            options={[{ valeur: '', libelle: c.requis ? 'Choisir…' : '—' }, ...options.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))]}
          />
        </Field>
      );
    case 'multi':
    case 'case': {
      const liste = c.type === 'case' ? [{ valeur: 'oui', libelle: c.libelle }] : options;
      const choisis = c.type === 'case' ? (valeur === true ? ['oui'] : []) : ((valeur as string[] | undefined) ?? []);
      return (
        <fieldset>
          <legend className="sr-only">{c.libelle}</legend>
          <div className="space-y-1">
            {liste.map((o) => (
              <label key={o.valeur} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 text-[13.5px] text-(--lm-encre)">
                <input
                  type="checkbox"
                  checked={choisis.includes(o.valeur)}
                  onChange={(e) => {
                    if (c.type === 'case') return onChange(e.target.checked ? true : undefined);
                    onChange(e.target.checked ? [...choisis, o.valeur] : choisis.filter((x) => x !== o.valeur));
                  }}
                  className="size-4 accent-(--lm-or)"
                />
                {o.libelle}
              </label>
            ))}
          </div>
          {erreur && (
            <p role="alert" className="mt-1 text-[12px] font-medium text-(--lm-danger)">
              {erreur}
            </p>
          )}
        </fieldset>
      );
    }
    case 'grille': {
      const r = (valeur as Record<string, string> | undefined) ?? {};
      return (
        <div className="space-y-2">
          {(c.elements ?? []).map((el) => (
            <Field key={el.id} label={el.libelle}>
              <Select
                value={r[el.id] ?? ''}
                onChange={(e) => {
                  const n = { ...r };
                  if (e.target.value) n[el.id] = e.target.value;
                  else delete n[el.id];
                  onChange(n);
                }}
                options={[{ valeur: '', libelle: '—' }, ...options.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))]}
              />
            </Field>
          ))}
          {erreur && <p role="alert" className="text-[12px] font-medium text-(--lm-danger)">{erreur}</p>}
        </div>
      );
    }
    case 'quantites': {
      const r = (valeur as Record<string, number> | undefined) ?? {};
      return (
        <div className="space-y-2">
          {(c.elements ?? []).map((el) => (
            <Field key={el.id} label={el.libelle}>
              <Input
                inputMode="numeric"
                value={r[el.id] ? String(r[el.id]) : ''}
                onChange={(e) => {
                  const n = { ...r };
                  const x = Number(e.target.value.replace(/\D/g, ''));
                  if (x > 0) n[el.id] = x;
                  else delete n[el.id];
                  onChange(n);
                }}
              />
            </Field>
          ))}
          {erreur && <p role="alert" className="text-[12px] font-medium text-(--lm-danger)">{erreur}</p>}
        </div>
      );
    }
    case 'zone':
      return (
        <Field label={c.libelle} erreur={erreur}>
          <Textarea rows={4} value={String(valeur ?? '')} placeholder={c.placeholder} onChange={(e) => onChange(e.target.value)} autoFocus />
        </Field>
      );
    default:
      return (
        <Field label={c.libelle} erreur={erreur}>
          <Input
            type={c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : c.type === 'date' ? 'date' : 'text'}
            inputMode={c.type === 'nombre' || c.format ? 'numeric' : undefined}
            value={String(valeur ?? '')}
            placeholder={c.placeholder}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
          />
        </Field>
      );
  }
}
