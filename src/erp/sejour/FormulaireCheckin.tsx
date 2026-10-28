/**
 * Formulaire du check-in en ligne : heure d'arrivée, voyageurs, nationalité
 * et, pour les voyageurs étrangers seulement, la fiche de police (une par
 * voyageur de 15 ans et plus). Contrôlé ici avec la même règle que le
 * serveur (lireSaisieCheckin), qui contrôle de nouveau à l'envoi.
 */
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Alert, Button, Field, Input, Select, cn } from '../ui';
import { MAX_ENFANTS_PAR_FICHE, MESSAGES_ERREURS, lireSaisieCheckin, type ChampCheckin, type ErreurCheckin, type FichePolice, type LangueSejour, type SaisieCheckin, type VueSejour } from '../data/sejour';
import { TEXTES } from './textes';

/** Champs de 16 px au moins : l'iPhone ne zoome pas dessus. */
const CHAMP = 'h-11 text-[16px]';

type FicheBrouillon = Omit<FichePolice, 'enfants'> & { enfants: number };
const ficheVide = (): FicheBrouillon => ({ nom: '', prenoms: '', naissanceLe: '', naissanceLieu: '', nationalite: '', domicile: '', enfants: 0 });

export interface FormulaireCheckinProps {
  vue: VueSejour;
  langue: LangueSejour;
  aujourdhui: string;
  /** Envoi : null si c'est enregistré, sinon les champs refusés par le serveur ou un message. */
  onEnvoyer: (saisie: SaisieCheckin) => Promise<{ erreurs?: ErreurCheckin[]; message?: string } | null>;
  onAnnuler?: () => void;
  onVoirReglement?: () => void;
}

/** Choix à deux réponses, en grosses cases (un vrai groupe de boutons radio). */
function Choix({ nom, valeur, options, onChange, legende, erreur }: { nom: string; valeur: boolean | null; options: [string, string]; onChange: (v: boolean) => void; legende: string; erreur?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">{legende}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((libelle, i) => {
          const v = i === 0;
          return (
            <label
              key={libelle}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-[15px] transition-colors focus-within:ring-4 focus-within:ring-(--lm-or-lavis)',
                valeur === v ? 'border-(--lm-or) bg-(--lm-or-lavis) text-(--lm-brun)' : 'border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre)',
              )}
            >
              <input type="radio" name={nom} className="size-4 accent-(--lm-or-texte)" checked={valeur === v} onChange={() => onChange(v)} />
              {libelle}
            </label>
          );
        })}
      </div>
      {erreur && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
      )}
    </fieldset>
  );
}

export function FormulaireCheckin({ vue, langue, aujourdhui, onEnvoyer, onAnnuler, onVoirReglement }: FormulaireCheckinProps) {
  const t = TEXTES[langue];
  const id = useId();
  const avant = vue.checkin.saisie;
  // Fiches déjà envoyées : jamais renvoyées par le lien, seulement leur nombre. Gardées telles quelles, ou remplies de nouveau.
  const envoyees = vue.checkin.fichesEnvoyees;
  const [garder, setGarder] = useState(!!envoyees?.fiches);
  const [heure, setHeure] = useState(avant?.arriveeEstimee ?? '');
  const [nb, setNb] = useState(avant?.nbPersonnes ?? Math.min(Math.max(1, vue.voyageurs), vue.logement.capacite));
  const [tousFrancais, setTousFrancais] = useState<boolean | null>(avant ? avant.tousFrancais : null);
  const [fiches, setFiches] = useState<FicheBrouillon[]>(avant?.fiches?.length ? avant.fiches.map((f) => ({ ...f })) : [ficheVide()]);
  const [regles, setRegles] = useState(!!avant);
  const [erreurs, setErreurs] = useState<ErreurCheckin[]>([]);
  const [message, setMessage] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const erreur = (champ: ChampCheckin, fiche?: number): string | undefined =>
    erreurs.some((e) => e.champ === champ && e.fiche === fiche) ? MESSAGES_ERREURS[champ][langue] : undefined;
  /** Un champ corrigé n'est plus signalé (le message général tombe quand plus rien ne l'est). */
  const corrige = (champ: ChampCheckin, fiche?: number) =>
    setErreurs((l) => {
      const reste = l.filter((e) => !(e.champ === champ && e.fiche === fiche) && !(champ === 'nbPersonnes' && e.champ === 'fiches'));
      if (l.length && !reste.length) setMessage(undefined);
      return reste;
    });
  const majFiche = (i: number, k: keyof FicheBrouillon, v: string | number) => {
    setFiches((l) => l.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
    corrige(k, i);
  };
  const max = vue.logement.capacite;

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(undefined);
    const garde = tousFrancais === false && garder && !!envoyees?.fiches;
    const brut = { arriveeEstimee: heure, nbPersonnes: nb, reglesAcceptees: regles, tousFrancais, fiches: tousFrancais === false && !garde ? fiches : [], ...(garde ? { garderFiches: true } : {}) };
    // Fiches gardées : comptées ici (nombre de personnes), reprises et contrôlées par le serveur.
    const comptees = garde ? Array.from({ length: envoyees!.fiches }, (_, i) => ({ ...ficheVide(), enfants: i === 0 ? envoyees!.personnes - envoyees!.fiches : 0 })) : undefined;
    const lu = lireSaisieCheckin(brut, { maxPersonnes: max, aujourdhui, ...(comptees ? { fichesPrecedentes: comptees } : {}) });
    if (!lu.ok) {
      setErreurs(lu.erreurs);
      setMessage(t.verifier);
      return;
    }
    setErreurs([]);
    setEnCours(true);
    const r = await onEnvoyer(garde ? { ...lu.saisie, fiches: [], garderFiches: true } : lu.saisie);
    setEnCours(false);
    if (r) {
      setErreurs(r.erreurs ?? []);
      setMessage(r.message ?? t.verifier);
    }
  };

  const champFiche = (i: number, k: 'nom' | 'prenoms' | 'naissanceLieu' | 'nationalite' | 'domicile', libelle: ReactNode, o: { auto?: string; aide?: string; max: number }) => (
    <Field label={libelle} requis erreur={erreur(k, i)} aide={o.aide}>
      <Input className={CHAMP} value={fiches[i][k]} maxLength={o.max} autoComplete={i === 0 && o.auto ? o.auto : 'off'} onChange={(e) => majFiche(i, k, e.target.value)} />
    </Field>
  );

  return (
    <form onSubmit={envoyer} noValidate className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t.heureArrivee} requis erreur={erreur('arriveeEstimee')} aide={t.heureArriveeAide(vue.logement.heureArrivee) || undefined}>
          <Input
            type="time"
            step={300}
            className={CHAMP}
            value={heure}
            onChange={(e) => {
              setHeure(e.target.value);
              corrige('arriveeEstimee');
            }}
          />
        </Field>
        <Field label={t.nbVoyageurs} requis erreur={erreur('nbPersonnes')}>
          <Select
            className={CHAMP}
            value={String(nb)}
            onChange={(e) => {
              setNb(Number(e.target.value));
              corrige('nbPersonnes');
            }}
            options={Array.from({ length: max }, (_, i) => ({ valeur: String(i + 1), libelle: String(i + 1) }))}
          />
        </Field>
      </div>

      <Choix
        nom={`${id}-nationalite`}
        legende={t.nationaliteQuestion}
        valeur={tousFrancais}
        options={[t.tousFrancais, t.etrangers]}
        onChange={(v) => {
          setTousFrancais(v);
          corrige('tousFrancais');
        }}
        erreur={erreur('tousFrancais')}
      />

      {tousFrancais === false && garder && !!envoyees?.fiches && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 sm:p-4">
          <p className="text-[13.5px] text-(--lm-encre-2)">{t.fichesGardees(envoyees.fiches)}</p>
          {erreur('fiches') && <p role="alert" className="text-[12.5px] font-medium text-(--lm-danger)">{erreur('fiches')}</p>}
          <Button variant="secondary" size="sm" onClick={() => setGarder(false)}>
            {t.remplirDeNouveau}
          </Button>
        </div>
      )}

      {tousFrancais === false && !(garder && !!envoyees?.fiches) && (
        <div className="flex flex-col gap-4">
          {!!envoyees?.fiches && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setGarder(true)}>
              {t.garderFiches}
            </Button>
          )}
          <p className="text-[13.5px] text-(--lm-encre-2)">{t.ficheExplication}</p>
          {erreur('fiches') && <p role="alert" className="text-[12.5px] font-medium text-(--lm-danger)">{erreur('fiches')}</p>}
          {fiches.map((_, i) => (
            <div key={i} role="group" aria-labelledby={`${id}-fiche-${i}`} className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 id={`${id}-fiche-${i}`} className="text-[14px] font-semibold text-(--lm-encre)">
                  {t.voyageurN(i + 1)}
                </h3>
                {fiches.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icone={<X />}
                    onClick={() => {
                      // Les fiches suivantes changent de numéro : leurs erreurs ne vaudraient plus.
                      setFiches((l) => l.filter((__, j) => j !== i));
                      setErreurs([]);
                    }}
                  >
                    {t.retirer}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {champFiche(i, 'nom', t.nom, { auto: 'family-name', max: 80 })}
                {champFiche(i, 'prenoms', t.prenoms, { auto: 'given-name', max: 80 })}
                <Field label={t.naissanceLe} requis erreur={erreur('naissanceLe', i)}>
                  <Input
                    type="date"
                    className={CHAMP}
                    min="1900-01-01"
                    max={aujourdhui}
                    value={fiches[i].naissanceLe}
                    autoComplete={i === 0 ? 'bday' : 'off'}
                    onChange={(e) => majFiche(i, 'naissanceLe', e.target.value)}
                  />
                </Field>
                {champFiche(i, 'naissanceLieu', t.naissanceLieu, { aide: t.naissanceLieuAide, max: 80 })}
                {champFiche(i, 'nationalite', t.nationalite, { max: 60 })}
                <Field label={t.enfants} erreur={erreur('enfants', i)}>
                  <Select
                    className={CHAMP}
                    value={String(fiches[i].enfants)}
                    onChange={(e) => majFiche(i, 'enfants', Number(e.target.value))}
                    options={Array.from({ length: MAX_ENFANTS_PAR_FICHE + 1 }, (_, n) => ({ valeur: String(n), libelle: String(n) }))}
                  />
                </Field>
                <div className="sm:col-span-2">{champFiche(i, 'domicile', t.domicile, { auto: 'street-address', max: 200 })}</div>
              </div>
            </div>
          ))}
          {fiches.length < nb && (
            <Button
              variant="secondary"
              icone={<Plus />}
              className="self-start"
              onClick={() => {
                setFiches((l) => [...l, ficheVide()]);
                corrige('fiches');
              }}
            >
              {t.ajouterVoyageur}
            </Button>
          )}
        </div>
      )}

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-(--lm-encre)">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-(--lm-or-texte)"
            checked={regles}
            onChange={(e) => {
              setRegles(e.target.checked);
              corrige('reglesAcceptees');
            }}
            aria-invalid={erreur('reglesAcceptees') ? true : undefined}
          />
          <span>
            {t.accepte}
            {onVoirReglement && (
              <>
                {' '}
                <button type="button" onClick={onVoirReglement} className="font-medium text-(--lm-or-texte) underline-offset-2 hover:underline">
                  {t.voirReglement}
                </button>
              </>
            )}
          </span>
        </label>
        {erreur('reglesAcceptees') && (
          <p role="alert" className="mt-1.5 text-[12px] font-medium text-(--lm-danger)">
            {erreur('reglesAcceptees')}
          </p>
        )}
      </div>

      <p className="text-[12.5px] leading-relaxed text-(--lm-encre-3)">
        {t.confidentialite}
        {tousFrancais === false ? ` ${t.signature}` : ''}
      </p>

      {message && <Alert tone="danger">{message}</Alert>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {onAnnuler && (
          <Button variant="ghost" size="lg" onClick={onAnnuler}>
            {t.annuler}
          </Button>
        )}
        <Button variant="primary" size="lg" type="submit" chargement={enCours} className="sm:min-w-40">
          {t.envoyer}
        </Button>
      </div>
    </form>
  );
}
