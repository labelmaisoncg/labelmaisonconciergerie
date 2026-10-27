/**
 * Panneau d'un message automatique : heure d'envoi, texte (variables en
 * pastilles à toucher), aperçu avec un vrai séjour à venir, et texte propre
 * à un logement. Enregistré dans `reglages` (élément 'messages-programmes').
 */
import { useMemo, useRef, useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';
import { Button, Drawer, Field, Select, Textarea, cn } from '../../../ui';
import { AUJOURDHUI, dateJour, ecartJours, pluriel } from '../../../data/format';
import {
  HEURES_ENVOI,
  LIBELLES_DECLENCHEURS,
  VARIABLES,
  filDuSejour,
  guidePourMessage,
  codesAutorises,
  rendreMessage,
  sejoursPourApercu,
  type CleVariable,
} from '../../../data/messages-programmes';
import type { FilMessages, Logement, Reservation } from '../../../data/types';
import type { DeclencheurMessage, ModeleLogement, ModeleProgramme } from '../../../data/types-programmes';

export interface EditeurMessageAutoProps {
  declencheur: DeclencheurMessage | null;
  modele?: ModeleProgramme;
  reservations: Reservation[];
  logements: Logement[];
  fils: FilMessages[];
  signature: string;
  modifiable: boolean;
  onFermer: () => void;
  onEnregistrer: (k: DeclencheurMessage, m: Pick<ModeleProgramme, 'texte' | 'heure' | 'logements'>) => void;
}

/** Pastille d'une variable : la touche l'insère là où se trouve le curseur. */
function Pastille({ libelle, sensible, onClick, disabled }: { libelle: string; sensible?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1 rounded-full border border-(--lm-bord-fort) bg-(--lm-surface) px-3 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre) disabled:cursor-not-allowed disabled:opacity-50"
    >
      {sensible ? <Lock className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
      {libelle}
      {sensible && <span className="sr-only"> (envoyé seulement dans les 48 h avant l’arrivée)</span>}
    </button>
  );
}

export function EditeurMessageAuto(p: EditeurMessageAutoProps) {
  // Le panneau est remonté à chaque ouverture (clé du parent) : l'état repart du modèle enregistré.
  const k = p.declencheur;
  const [texte, setTexte] = useState(p.modele?.texte ?? '');
  const [heure, setHeure] = useState(p.modele?.heure);
  const [propres, setPropres] = useState<Record<string, ModeleLogement>>(p.modele?.logements ?? {});
  const zone = useRef<HTMLTextAreaElement>(null);

  const sejours = useMemo(() => (k ? sejoursPourApercu(p.reservations, k, AUJOURDHUI).slice(0, 15) : []), [k, p.reservations]);
  const [sejourId, setSejourId] = useState<string>(() => sejours[0]?.id ?? '');
  const sejour = sejours.find((r) => r.id === sejourId) ?? sejours[0];
  const logement = sejour ? p.logements.find((l) => l.id === sejour.logementId) : undefined;
  const nomLogement = (id: string) => p.logements.find((l) => l.id === id)?.nom ?? 'Logement';

  const apercu = useMemo(() => {
    if (!sejour || !k) return null;
    const fil = filDuSejour(p.fils, sejour.id);
    // L'aperçu se place au moment de l'envoi (la veille de l'arrivée pour les infos d'arrivée).
    const jour = k === 'veille_arrivee' ? addJour(sejour.arrivee, -1) : k === 'jour_depart' ? sejour.depart : k === 'demande_avis' ? addJour(sejour.depart, 1) : AUJOURDHUI;
    const codes = codesAutorises(sejour, fil?.logementId, jour);
    const guide = guidePourMessage(logement?.fiche?.guides, codes);
    const lien = guide ? (guide.media.url?.trim() || 'lien du guide') : undefined;
    const propre = propres[sejour.logementId];
    const modele = propre?.texte?.trim() ? propre.texte : texte;
    return { ...rendreMessage(modele, { reservation: sejour, logement, fil, signature: p.signature, lienGuide: lien, aujourdhui: jour }), jour, coupe: propre?.actif === false };
  }, [sejour, k, p.fils, p.signature, logement, propres, texte]);

  if (!k || !p.modele) return null;
  const libelle = LIBELLES_DECLENCHEURS[k];

  const inserer = (cle: CleVariable) => {
    const el = zone.current;
    const jeton = `{${cle}}`;
    if (!el) return setTexte((t) => `${t}${jeton}`);
    const debut = el.selectionStart ?? texte.length;
    const fin = el.selectionEnd ?? texte.length;
    const suivant = `${texte.slice(0, debut)}${jeton}${texte.slice(fin)}`;
    setTexte(suivant);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(debut + jeton.length, debut + jeton.length);
    });
  };

  const sansPropre = p.logements.filter((l) => l.statut !== 'sorti' && !propres[l.id]);
  const vide = !texte.trim();

  return (
    <Drawer
      ouvert
      onFermer={p.onFermer}
      titre={libelle.titre}
      sousTitre={libelle.quand(heure)}
      pied={
        <>
          <Button variant="ghost" onClick={p.onFermer}>
            {p.modifiable ? 'Annuler' : 'Fermer'}
          </Button>
          {p.modifiable && (
            <Button variant="primary" disabled={vide} onClick={() => p.onEnregistrer(k, { texte, ...(heure ? { heure } : {}), logements: propres })}>
              Enregistrer
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {p.modele.heure !== undefined && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="heure-envoi" className="text-[13px] font-medium text-(--lm-encre)">
              Heure d’envoi
            </label>
            <div className="w-32">
              <Select id="heure-envoi" aria-describedby="heure-envoi-aide" value={heure} disabled={!p.modifiable} onChange={(e) => setHeure(e.target.value)} options={HEURES_ENVOI.map((h) => ({ valeur: h, libelle: h }))} />
            </div>
            <p id="heure-envoi-aide" className="text-[12px] text-(--lm-encre-3)">
              Heure de Paris. Jamais avant 8 h ni après 21 h.
            </p>
          </div>
        )}

        <div>
          <Field label="Message">
            <Textarea ref={zone} rows={10} value={texte} disabled={!p.modifiable} maxLength={3000} onChange={(e) => setTexte(e.target.value)} />
          </Field>
          {vide && <p className="mt-1.5 text-[12px] font-medium text-(--lm-danger)">Le message ne peut pas être vide.</p>}
          {p.modifiable && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[12px] text-(--lm-encre-3)">Touchez pour ajouter :</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Pastille key={v.cle} libelle={v.libelle} sensible={v.sensible} onClick={() => inserer(v.cle)} />
                ))}
              </div>
              <p className="mt-2 flex items-center gap-1 text-[12px] text-(--lm-encre-3)">
                <Lock className="size-3 shrink-0" aria-hidden /> Accès et wifi : seulement dans les 48 h avant l’arrivée, sinon la ligne est retirée.
              </p>
            </div>
          )}
        </div>

        <section aria-labelledby="apercu-titre">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 id="apercu-titre" className="text-[13px] font-medium text-(--lm-encre)">
              Aperçu
            </h3>
            {sejours.length > 1 && (
              <Select
                aria-label="Séjour de l’aperçu"
                value={sejour?.id}
                onChange={(e) => setSejourId(e.target.value)}
                className="h-8 max-w-60 text-[13px]"
                options={sejours.map((r) => ({ valeur: r.id, libelle: `${r.voyageur.nom.split(' ')[0]} · ${dateJour(r.arrivee)}` }))}
              />
            )}
          </div>
          {!sejour || !apercu ? (
            <p className="rounded-lg bg-(--lm-surface-2) px-3.5 py-3 text-[13px] text-(--lm-encre-2)">Pas de séjour à venir pour l’aperçu.</p>
          ) : (
            <div>
              <p className="mb-2 text-[12px] text-(--lm-encre-3)">
                {sejour.voyageur.nom} · {nomLogement(sejour.logementId)}
              </p>
              {apercu.coupe ? (
                <p className="text-[13px] text-(--lm-encre-2)">Pas de message pour ce logement.</p>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-[92%] rounded-[18px] rounded-br-md bg-(--lm-brun) px-3.5 py-2 text-[14px] leading-snug whitespace-pre-line text-white">{apercu.texte}</div>
                </div>
              )}
              {!apercu.codes && texte.match(/\{(acces|wifi)\}/) && !apercu.coupe && (
                <p className="mt-2 flex items-center gap-1 text-[12px] text-(--lm-encre-2)">
                  <Lock className="size-3 shrink-0" aria-hidden />
                  Accès et wifi retirés : {joursAvant(apercu.jour, sejour.arrivee)}.
                </p>
              )}
            </div>
          )}
        </section>

        <details className="group rounded-lg border border-(--lm-bord)" open={Object.keys(propres).length > 0}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-[13.5px] font-medium text-(--lm-encre) [&::-webkit-details-marker]:hidden">
            Texte différent pour un logement
            <span className="text-[12px] font-normal text-(--lm-encre-3)">{Object.keys(propres).length ? pluriel(Object.keys(propres).length, 'logement') : 'Facultatif'}</span>
          </summary>
          <div className="space-y-3 border-t border-(--lm-bord) px-3.5 py-3">
            {Object.entries(propres).map(([id, m]) => (
              <div key={id} className="rounded-md border border-(--lm-bord) bg-(--lm-surface-2) p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-[13.5px] font-medium text-(--lm-encre)">{nomLogement(id)}</p>
                  {p.modifiable && (
                    <button
                      type="button"
                      aria-label={`Retirer le texte de ${nomLogement(id)}`}
                      onClick={() => setPropres((x) => Object.fromEntries(Object.entries(x).filter(([cle]) => cle !== id)))}
                      className="grid size-8 shrink-0 place-items-center rounded-md text-(--lm-encre-3) hover:bg-(--lm-neutre-lavis) hover:text-(--lm-encre)"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <label className="mb-2 flex min-h-8 cursor-pointer items-center gap-2 text-[13px] text-(--lm-encre)">
                  <input
                    type="checkbox"
                    className="size-4 accent-(--lm-or)"
                    checked={m.actif === false}
                    disabled={!p.modifiable}
                    onChange={(e) => setPropres((x) => ({ ...x, [id]: { ...x[id], actif: e.target.checked ? false : undefined } }))}
                  />
                  Ne rien envoyer pour ce logement
                </label>
                {m.actif !== false && (
                  <Textarea
                    aria-label={`Message pour ${nomLogement(id)}`}
                    rows={5}
                    value={m.texte ?? ''}
                    disabled={!p.modifiable}
                    onChange={(e) => setPropres((x) => ({ ...x, [id]: { ...x[id], texte: e.target.value } }))}
                  />
                )}
              </div>
            ))}
            {p.modifiable && sansPropre.length > 0 && (
              <Select
                aria-label="Ajouter un logement"
                value=""
                placeholder="Ajouter un logement…"
                className={cn('text-[13px]')}
                onChange={(e) => e.target.value && setPropres((x) => ({ ...x, [e.target.value]: { texte } }))}
                options={sansPropre.map((l) => ({ valeur: l.id, libelle: l.nom }))}
              />
            )}
            {!Object.keys(propres).length && !p.modifiable && <p className="text-[13px] text-(--lm-encre-2)">Le même texte pour tous les logements.</p>}
          </div>
        </details>
      </div>
    </Drawer>
  );
}

function addJour(date: string, n: number): string {
  const x = new Date(`${date}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** « arrivée dans 5 jours » (au moment de l'envoi), pour dire pourquoi les codes sont retirés. */
function joursAvant(jour: string, arrivee: string): string {
  const n = ecartJours(jour, arrivee);
  return n > 2 ? `l’arrivée est dans ${pluriel(n, 'jour')} au moment de l’envoi` : 'la réservation ne le permet pas';
}
