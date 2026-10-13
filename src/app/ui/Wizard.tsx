import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Minus, Plus, X } from 'lucide-react';
import {
  erreursEtape,
  estVide,
  etapeFacultative,
  etapesVisibles,
  lignesRecapitulatif,
  type Champ,
  type Etape,
  type Valeurs,
} from '../../erp/data/etapes-formulaire';

/**
 * Assistant « une question par écran », réutilisable avec n'importe quel
 * schéma d'étapes (src/erp/data/etapes-formulaire.ts) :
 * - un seul état (`valeurs`), un seul envoi, à la fin ;
 * - en haut : retour, « Étape X sur N » et sa barre, fermer ;
 * - en bas : « Suivant » (grisé tant qu'un champ obligatoire est vide) et
 *   « Plus tard » sur les étapes facultatives ;
 * - validation à chaque étape, message sous le champ ;
 * - dernière étape : récapitulatif, « Modifier » sur chaque ligne ;
 * - plein écran sur mobile.
 */

const RECAP = '__recapitulatif';

export interface WizardProps {
  etapes: Etape[];
  valeurs: Valeurs;
  onChange: (v: Valeurs) => void;
  /** Envoi final ; une erreur levée s'affiche telle quelle (message en français). */
  onEnvoyer: () => Promise<void>;
  onFermer: () => void;
  /** Étape de départ (reprise d'un brouillon). */
  etapeInitiale?: string;
  /** Étape affichée, pour garder le brouillon à jour. */
  onEtape?: (id: string) => void;
  libelleEnvoi?: string;
  /** Logo ou marque, à gauche de la barre du haut sur ordinateur. */
  marque?: ReactNode;
}

const CHAMP_BASE =
  'w-full rounded-xl border border-[rgba(64,49,24,0.22)] bg-white px-4 text-[17px] text-[var(--foreground)] placeholder:text-[#9A8F7C] focus:border-[var(--color-gold)] focus:ring-2 focus:ring-[rgba(169,124,48,0.35)] focus:outline-none';

const FOCUS = 'focus-visible:ring-2 focus-visible:ring-[rgba(169,124,48,0.5)] focus-visible:outline-none';

export function Wizard({ etapes, valeurs, onChange, onEnvoyer, onFermer, etapeInitiale, onEtape, libelleEnvoi = 'Envoyer', marque }: WizardProps) {
  const visibles = useMemo(() => etapesVisibles(etapes, valeurs), [etapes, valeurs]);
  const [courante, setCourante] = useState<string>(() =>
    etapeInitiale && (etapeInitiale === RECAP || visibles.some((e) => e.id === etapeInitiale)) ? etapeInitiale : (visibles[0]?.id ?? RECAP),
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [retourRecap, setRetourRecap] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState('');
  const titre = useRef<HTMLHeadingElement>(null);
  const zone = useRef<HTMLDivElement>(null);

  const index = courante === RECAP ? visibles.length : Math.max(0, visibles.findIndex((e) => e.id === courante));
  const total = visibles.length + 1;
  const etape = courante === RECAP ? undefined : visibles[index];

  // Nouvelle étape : titre annoncé (lecteurs d'écran), haut de page, brouillon à jour.
  useEffect(() => {
    onEtape?.(courante);
    zone.current?.querySelector('main')?.scrollTo(0, 0);
    const premier = document.querySelector<HTMLElement>('[data-wizard-premier]');
    if (premier && window.matchMedia('(pointer: fine)').matches) premier.focus();
    else titre.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courante]);

  const aller = (id: string) => {
    setErreurs({});
    setCourante(id);
  };

  const suivante = () => (visibles[index + 1]?.id ?? RECAP);

  const valider = (e?: FormEvent) => {
    e?.preventDefault();
    if (!etape) return;
    const err = erreursEtape(etape, valeurs);
    if (Object.keys(err).length) {
      setErreurs(err);
      document.getElementById(`champ-${Object.keys(err)[0]}`)?.focus();
      return;
    }
    if (retourRecap) {
      setRetourRecap(false);
      aller(RECAP);
    } else aller(suivante());
  };

  // « Plus tard » : on passe ; une réponse invalide est retirée plutôt qu'envoyée.
  const plusTard = () => {
    if (!etape) return;
    const err = erreursEtape(etape, valeurs);
    if (Object.keys(err).length) {
      const v = { ...valeurs };
      for (const k of Object.keys(err)) delete v[k];
      onChange(v);
    }
    if (retourRecap) {
      setRetourRecap(false);
      aller(RECAP);
    } else aller(suivante());
  };

  const retour = () => {
    if (retourRecap) {
      setRetourRecap(false);
      return aller(RECAP);
    }
    if (index > 0) aller(visibles[index - 1].id);
  };

  const modifier = (id: string) => {
    setRetourRecap(true);
    aller(id);
  };

  const envoyer = async () => {
    setEnvoi(true);
    setErreurEnvoi('');
    try {
      await onEnvoyer();
    } catch (e) {
      setErreurEnvoi((e as Error).message || 'Envoi impossible. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  };

  const changer = (id: string, valeur: unknown) => {
    const v = { ...valeurs };
    if (valeur === undefined || valeur === '' || (Array.isArray(valeur) && !valeur.length)) delete v[id];
    else v[id] = valeur;
    onChange(v);
    if (erreurs[id]) setErreurs(({ [id]: _, ...reste }) => reste);
  };

  const incomplet = !!etape?.champs.some((c) => c.requis && estVide(c, valeurs[c.id]));
  const facultative = etape ? etapeFacultative(etape) : false;
  const note = etape?.note?.(valeurs);
  const seul = etape?.champs.length === 1 && etape.champs[0].type !== 'case';
  // Une liste (inventaire, quantités) en tête d'étape prend la question pour libellé.
  const parLaQuestion = (c: Champ, i: number) => seul || (i === 0 && (c.type === 'grille' || c.type === 'quantites'));

  return (
    <div ref={zone} className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {/* Barre du haut : retour, progression, fermer */}
      <header className="sticky top-0 z-10 border-b border-[rgba(64,49,24,0.10)] bg-[var(--background)] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={retour}
            disabled={index === 0 && !retourRecap}
            aria-label={retourRecap ? 'Revenir au récapitulatif' : 'Étape précédente'}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[rgba(64,49,24,0.06)] disabled:opacity-30 ${FOCUS}`}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          {marque && <div className="hidden shrink-0 sm:block">{marque}</div>}
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-[#6B6252] tabular-nums">
              Étape {index + 1} sur {total}
            </p>
            <div
              role="progressbar"
              aria-label="Progression"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={index + 1}
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgba(64,49,24,0.10)]"
            >
              <div className="h-full rounded-full bg-[var(--color-gold)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] hover:bg-[rgba(64,49,24,0.06)] ${FOCUS}`}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {etape ? (
        <form onSubmit={valider} noValidate className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 pt-8 pb-10 sm:pt-14">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-gold-dark)] uppercase">{etape.partie}</p>
              <h1 ref={titre} tabIndex={-1} id="wizard-question" className="font-serif-title mt-2 text-[30px] leading-[1.12] focus:outline-none sm:text-[38px]">
                {etape.question}
              </h1>
              {etape.aide && <p className="mt-2 text-[16px] leading-relaxed text-[#6B6252]">{etape.aide}</p>}
              <div className="mt-7 space-y-5">
                {etape.champs.map((c, i) => (
                  <ChampWizard
                    key={c.id}
                    champ={c}
                    valeur={valeurs[c.id]}
                    erreur={erreurs[c.id]}
                    seul={parLaQuestion(c, i)}
                    premier={i === 0}
                    onChange={(x) => changer(c.id, x)}
                  />
                ))}
              </div>
              {note && <p className="mt-6 rounded-xl border-l-4 border-[var(--color-gold)] bg-[#F6EFE2] px-4 py-3 text-[15px] leading-relaxed">{note}</p>}
            </div>
          </main>
          <footer className="border-t border-[rgba(64,49,24,0.10)] bg-[var(--background)] pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-2xl flex-col-reverse gap-2 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3">
              {facultative && (
                <button
                  type="button"
                  onClick={plusTard}
                  className={`h-12 rounded-full px-6 text-[16px] font-semibold text-[var(--color-gold-dark)] hover:bg-[rgba(169,124,48,0.08)] ${FOCUS}`}
                >
                  Plus tard
                </button>
              )}
              <button
                type="submit"
                disabled={incomplet}
                className={`h-14 rounded-full bg-[var(--color-gold-dark)] px-8 text-[17px] font-semibold text-white hover:bg-[#6A4914] disabled:cursor-not-allowed disabled:opacity-40 sm:h-12 sm:min-w-44 ${FOCUS}`}
              >
                {retourRecap ? 'Revenir au récapitulatif' : 'Suivant'}
              </button>
            </div>
          </footer>
        </form>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-4 pt-8 pb-10 sm:pt-14">
              <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-gold-dark)] uppercase">Récapitulatif</p>
              <h1 ref={titre} tabIndex={-1} className="font-serif-title mt-2 text-[30px] leading-[1.12] focus:outline-none sm:text-[38px]">
                Vérifiez vos réponses
              </h1>
              <p className="mt-2 text-[16px] text-[#6B6252]">Touchez « Modifier » pour corriger une réponse.</p>
              <Recapitulatif etapes={etapes} valeurs={valeurs} onModifier={modifier} />
              {erreurEnvoi && (
                <p role="alert" className="mt-6 rounded-xl bg-[#F8E1DE] px-4 py-3 text-[15px] text-[#8A2A22]">
                  {erreurEnvoi}
                </p>
              )}
            </div>
          </main>
          <footer className="border-t border-[rgba(64,49,24,0.10)] bg-[var(--background)] pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-2xl px-4 py-3 sm:justify-end">
              <button
                type="button"
                onClick={() => void envoyer()}
                disabled={envoi}
                aria-busy={envoi}
                className={`h-14 w-full rounded-full bg-[var(--color-gold-dark)] px-8 text-[17px] font-semibold text-white hover:bg-[#6A4914] disabled:cursor-wait disabled:opacity-60 sm:h-12 sm:w-auto ${FOCUS}`}
              >
                {envoi ? 'Envoi en cours…' : libelleEnvoi}
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ récapitulatif */

function Recapitulatif({ etapes, valeurs, onModifier }: { etapes: Etape[]; valeurs: Valeurs; onModifier: (id: string) => void }) {
  const lignes = lignesRecapitulatif(etapes, valeurs);
  const parties = [...new Set(lignes.map((l) => l.partie))];
  return (
    <div className="mt-8 space-y-8">
      {parties.map((partie) => (
        <section key={partie} aria-labelledby={`recap-${partie}`}>
          <h2 id={`recap-${partie}`} className="text-[13px] font-semibold tracking-[0.12em] text-[var(--color-gold-dark)] uppercase">
            {partie}
          </h2>
          <ul className="mt-2 divide-y divide-[rgba(64,49,24,0.10)] rounded-2xl border border-[rgba(64,49,24,0.12)] bg-white">
            {lignes
              .filter((l) => l.partie === partie)
              .map((l) => (
                <li key={l.champ.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[#6B6252]">{l.libelle}</p>
                    <p className={`mt-0.5 text-[15px] leading-snug break-words ${l.valeur ? '' : 'text-[#9A8F7C]'}`}>{l.valeur || 'Non renseigné'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onModifier(l.etape.id)}
                    aria-label={`Modifier : ${l.libelle}`}
                    className={`-my-1 inline-flex h-11 shrink-0 items-center rounded-full px-3 text-[15px] font-semibold text-[var(--color-gold-dark)] hover:bg-[rgba(169,124,48,0.08)] ${FOCUS}`}
                  >
                    Modifier
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- champs */

interface ChampWizardProps {
  champ: Champ;
  valeur: unknown;
  erreur?: string;
  /** Seul champ de l'étape : la question lui sert de libellé. */
  seul: boolean;
  premier: boolean;
  onChange: (v: unknown) => void;
}

function ChampWizard({ champ: c, valeur, erreur, seul, premier, onChange }: ChampWizardProps) {
  const idErreur = useId();
  const natif = !['choix', 'multi', 'case', 'grille', 'quantites'].includes(c.type);
  const commun = {
    id: `champ-${c.id}`,
    'aria-invalid': erreur ? true : undefined,
    'aria-describedby': erreur ? idErreur : undefined,
    // Seul champ : la question sert de libellé. Groupe : le libellé visible (un <label> ne vise pas un groupe).
    ...(seul ? { 'aria-labelledby': 'wizard-question' } : natif || c.type === 'case' ? {} : { 'aria-labelledby': `lbl-${c.id}` }),
    ...(premier ? { 'data-wizard-premier': '' } : {}),
  };
  let saisie: ReactNode;

  switch (c.type) {
    case 'choix':
    case 'multi': {
      const multiple = c.type === 'multi';
      const choisis = multiple ? ((valeur as string[] | undefined) ?? []) : [String(valeur ?? '')];
      const options = c.options ?? [];
      // Dans un groupe, quelques réponses courtes (Mme, M.) : boutons côte à côte plutôt que des cartes.
      if (!seul && !multiple && options.length <= 4 && options.every((o) => o.libelle.length <= 8 && !o.aide)) {
        saisie = (
          <div role="radiogroup" {...commun} className="flex flex-wrap gap-2">
            {options.map((o) => {
              const actif = choisis.includes(o.valeur);
              return (
                <button
                  key={o.valeur}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  onClick={() => onChange(actif ? undefined : o.valeur)}
                  className={`h-12 min-w-20 rounded-full border px-5 text-[16px] font-medium ${FOCUS} ${
                    actif ? 'border-[var(--color-gold-dark)] bg-[var(--color-gold-dark)] text-white' : 'border-[rgba(64,49,24,0.18)] bg-white'
                  }`}
                >
                  {o.libelle}
                </button>
              );
            })}
          </div>
        );
        break;
      }
      saisie = (
        <div role={multiple ? 'group' : 'radiogroup'} {...commun} className="grid gap-2.5">
          {(c.options ?? []).map((o) => {
            const actif = choisis.includes(o.valeur);
            return (
              <button
                key={o.valeur}
                type="button"
                role={multiple ? 'checkbox' : 'radio'}
                aria-checked={actif}
                onClick={() => onChange(multiple ? (actif ? choisis.filter((x) => x !== o.valeur) : [...choisis, o.valeur]) : o.valeur)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${FOCUS} ${
                  actif ? 'border-[var(--color-gold)] bg-[#F6EFE2]' : 'border-[rgba(64,49,24,0.18)] bg-white hover:border-[rgba(169,124,48,0.6)]'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center border-2 ${multiple ? 'rounded-md' : 'rounded-full'} ${
                    actif ? 'border-[var(--color-gold-dark)] bg-[var(--color-gold-dark)] text-white' : 'border-[rgba(64,49,24,0.35)]'
                  }`}
                >
                  {actif && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[17px] leading-snug font-medium">{o.libelle}</span>
                  {o.aide && <span className="block text-[14px] text-[#6B6252]">{o.aide}</span>}
                </span>
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case 'case':
      saisie = (
        <button
          type="button"
          role="checkbox"
          aria-checked={valeur === true}
          {...commun}
          onClick={() => onChange(valeur === true ? undefined : true)}
          className={`flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left ${FOCUS} ${
            valeur === true ? 'border-[var(--color-gold)] bg-[#F6EFE2]' : 'border-[rgba(64,49,24,0.18)] bg-white'
          }`}
        >
          <span
            aria-hidden
            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 ${
              valeur === true ? 'border-[var(--color-gold-dark)] bg-[var(--color-gold-dark)] text-white' : 'border-[rgba(64,49,24,0.35)]'
            }`}
          >
            {valeur === true && <Check className="size-4" strokeWidth={3} />}
          </span>
          <span className="text-[16px] leading-relaxed">{c.libelle}</span>
        </button>
      );
      break;
    case 'grille': {
      const r = (valeur as Record<string, string> | undefined) ?? {};
      saisie = (
        <ul className="divide-y divide-[rgba(64,49,24,0.10)] rounded-2xl border border-[rgba(64,49,24,0.12)] bg-white" {...commun}>
          {(c.elements ?? []).map((el, i) => (
            <li key={el.id} className="px-4 py-3">
              <p id={`el-${c.id}-${el.id}`} className="text-[16px] leading-snug">
                {el.libelle}
                {el.essentiel && <span className="ml-2 align-middle text-[12px] font-semibold text-[var(--color-gold-dark)]">Indispensable</span>}
              </p>
              <div role="radiogroup" aria-labelledby={`el-${c.id}-${el.id}`} className="mt-2 grid grid-cols-3 gap-1.5">
                {(c.options ?? []).map((o, j) => {
                  const actif = r[el.id] === o.valeur;
                  return (
                    <button
                      key={o.valeur}
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      {...(i === 0 && j === 0 && premier ? { 'data-wizard-premier': '' } : {})}
                      onClick={() => {
                        const n = { ...r };
                        if (actif) delete n[el.id];
                        else n[el.id] = o.valeur;
                        onChange(Object.keys(n).length ? n : undefined);
                      }}
                      className={`min-h-11 rounded-lg border px-2 text-[14px] font-medium ${FOCUS} ${
                        actif ? 'border-[var(--color-gold-dark)] bg-[var(--color-gold-dark)] text-white' : 'border-[rgba(64,49,24,0.18)] bg-white text-[var(--foreground)]'
                      }`}
                    >
                      {o.libelle}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      );
      break;
    }
    case 'quantites': {
      const r = (valeur as Record<string, number> | undefined) ?? {};
      const poser = (id: string, n: number) => {
        const x = { ...r };
        if (n > 0) x[id] = Math.min(n, c.max ?? 999);
        else delete x[id];
        onChange(Object.keys(x).length ? x : undefined);
      };
      saisie = (
        <ul className="divide-y divide-[rgba(64,49,24,0.10)] rounded-2xl border border-[rgba(64,49,24,0.12)] bg-white" {...commun}>
          {(c.elements ?? []).map((el) => {
            const n = Number(r[el.id] ?? 0);
            return (
              <li key={el.id} className="flex items-center gap-3 px-4 py-2">
                <span id={`el-${c.id}-${el.id}`} className="min-w-0 flex-1 text-[16px]">
                  {el.libelle}
                </span>
                <button
                  type="button"
                  onClick={() => poser(el.id, n - 1)}
                  disabled={n <= 0}
                  aria-label={`Retirer : ${el.libelle}`}
                  className={`inline-flex size-11 items-center justify-center rounded-full border border-[rgba(64,49,24,0.18)] disabled:opacity-30 ${FOCUS}`}
                >
                  <Minus className="size-4" aria-hidden />
                </button>
                <input
                  inputMode="numeric"
                  aria-labelledby={`el-${c.id}-${el.id}`}
                  value={n || ''}
                  placeholder="0"
                  onChange={(e) => poser(el.id, Number(e.target.value.replace(/\D/g, '')) || 0)}
                  className="h-11 w-14 rounded-lg border border-[rgba(64,49,24,0.18)] text-center text-[17px] tabular-nums focus:border-[var(--color-gold)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => poser(el.id, n + 1)}
                  aria-label={`Ajouter : ${el.libelle}`}
                  className={`inline-flex size-11 items-center justify-center rounded-full border border-[rgba(64,49,24,0.18)] ${FOCUS}`}
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      );
      break;
    }
    case 'zone':
      saisie = (
        <textarea
          {...commun}
          rows={4}
          value={String(valeur ?? '')}
          placeholder={c.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${CHAMP_BASE} py-3 leading-relaxed`}
        />
      );
      break;
    default: {
      const type = c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : c.type === 'date' ? 'date' : 'text';
      const inputMode = c.type === 'nombre' || c.format === 'code_postal' || c.format === 'siren' ? 'numeric' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : undefined;
      saisie = (
        <input
          {...commun}
          type={type}
          inputMode={inputMode}
          autoComplete={c.autocomplete ?? 'off'}
          value={String(valeur ?? '')}
          placeholder={c.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${CHAMP_BASE} h-14`}
        />
      );
    }
  }

  return (
    <div>
      {!seul && c.type !== 'case' && (
        <label id={`lbl-${c.id}`} htmlFor={natif ? `champ-${c.id}` : undefined} className="mb-1.5 block text-[15px] font-semibold">
          {c.libelle}
          {!c.requis && <span className="font-normal text-[#6B6252]"> (facultatif)</span>}
        </label>
      )}
      {saisie}
      {erreur && (
        <p id={idErreur} role="alert" className="mt-2 text-[15px] font-medium text-[#A33A2E]">
          {erreur}
        </p>
      )}
    </div>
  );
}
