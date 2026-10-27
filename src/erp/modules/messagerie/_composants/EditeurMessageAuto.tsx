/**
 * Panneau d'un message automatique : heure d'envoi, texte (variables en
 * pastilles à toucher), aperçu avec un vrai séjour à venir, et texte propre
 * à un logement. Enregistré dans `reglages` (élément 'messages-programmes').
 *
 * À l'écran, les variables s'écrivent par leur libellé (« {Prénom} »,
 * « {Heure d’arrivée} ») ; en base et à l'envoi, par leur clé (« {prenom} ») :
 * texteAffiche / texteStocke (data/messages-programmes.ts).
 */
import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Lock, Plus, TriangleAlert, X } from 'lucide-react';
import { Button, Drawer, Field, IconButton, Select, Textarea } from '../../../ui';
import { AUJOURDHUI, dateJour, ecartJours, pluriel } from '../../../data/format';
import {
  HEURES_ENVOI,
  LIBELLES_DECLENCHEURS,
  VARIABLES,
  codesAutorises,
  filDuSejour,
  guidePourMessage,
  momentHorsFenetreCodes,
  rendreMessage,
  secretEcritDansModele,
  sejoursPourApercu,
  texteAffiche,
  texteStocke,
  variablesDuTexte,
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
  /** Textes déjà convertis pour la base (clés des variables). */
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

/** Textes propres aux logements, d'une forme à l'autre (écran ↔ base). */
const convertir = (propres: Record<string, ModeleLogement> | undefined, f: (t: string) => string): Record<string, ModeleLogement> =>
  Object.fromEntries(Object.entries(propres ?? {}).map(([id, m]) => [id, m.texte !== undefined ? { ...m, texte: f(m.texte) } : m]));

export function EditeurMessageAuto(p: EditeurMessageAutoProps) {
  // Le panneau est remonté à chaque ouverture (clé du parent) : l'état repart du modèle enregistré.
  const k = p.declencheur;
  const [texte, setTexte] = useState(() => texteAffiche(p.modele?.texte ?? ''));
  const [heure, setHeure] = useState(p.modele?.heure);
  const [propres, setPropres] = useState<Record<string, ModeleLogement>>(() => convertir(p.modele?.logements, texteAffiche));
  const zone = useRef<HTMLTextAreaElement>(null);

  // Séjours qui recevront vraiment le message (Airbnb, Booking.com, conversation de plateforme).
  const sejours = useMemo(() => (k ? sejoursPourApercu(p.reservations, k, AUJOURDHUI, p.fils).slice(0, 15) : []), [k, p.reservations, p.fils]);
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
    const modele = texteStocke(propre?.texte?.trim() ? propre.texte : texte);
    const variables = variablesDuTexte(modele);
    return {
      ...rendreMessage(modele, { reservation: sejour, logement, fil, signature: p.signature, lienGuide: lien, aujourdhui: jour }),
      jour,
      coupe: propre?.actif === false,
      demandeCodes: variables.includes('acces') || variables.includes('wifi'),
    };
  }, [sejour, k, p.fils, p.signature, logement, propres, texte]);

  // Code ou wifi écrit en toutes lettres, pour un moment qui part souvent hors des 48 h (confirmation,
  // départ, avis) : prévenu quel que soit le séjour de l'aperçu.
  const secretEnClair = useMemo(
    () => !!k && ((momentHorsFenetreCodes(k) && secretEcritDansModele(texteStocke(texte), convertir(propres, texteStocke), p.logements)) || (!!apercu?.codesEnClair && !apercu.coupe)),
    [k, texte, propres, p.logements, apercu],
  );

  if (!k || !p.modele) return null;
  const libelle = LIBELLES_DECLENCHEURS[k];

  const inserer = (nom: string) => {
    const el = zone.current;
    const jeton = `{${nom}}`;
    if (!el) return setTexte((t) => `${t}${jeton}`);
    const debut = el.selectionStart ?? texte.length;
    const fin = el.selectionEnd ?? texte.length;
    setTexte(`${texte.slice(0, debut)}${jeton}${texte.slice(fin)}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(debut + jeton.length, debut + jeton.length);
    });
  };

  const sansPropre = p.logements.filter((l) => l.statut !== 'sorti' && !propres[l.id]);
  const nbPropres = Object.keys(propres).length;
  const vide = !texte.trim();
  const enregistrer = () => p.onEnregistrer(k, { texte: texteStocke(texte), ...(heure ? { heure } : {}), logements: convertir(propres, texteStocke) });

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
            <Button variant="primary" disabled={vide} onClick={enregistrer}>
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
          {secretEnClair && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-[12.5px] font-medium text-(--lm-danger)">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Ce texte contient un code ou le wifi en toutes lettres : il ne partira que dans les 48&nbsp;h avant l’arrivée ou pendant le séjour. Utilisez
                plutôt «&nbsp;Accès et clés&nbsp;» et «&nbsp;Wifi&nbsp;».
              </span>
            </p>
          )}
          {p.modifiable && (
            <div className="mt-2.5">
              <p className="mb-1.5 text-[12px] text-(--lm-encre-3)">Touchez pour ajouter :</p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Pastille key={v.cle} libelle={v.libelle} sensible={v.sensible} onClick={() => inserer(v.libelle)} />
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
            <p className="text-[13px] text-(--lm-encre-2)">Pas de séjour à venir sur Airbnb ou Booking.com pour l’aperçu.</p>
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
              {/* Code écrit en toutes lettres : signalé sous le texte, quel que soit le séjour choisi. */}
              {!secretEnClair && !apercu.codes && apercu.demandeCodes && !apercu.coupe && (
                <p className="mt-2 flex items-center gap-1 text-[12px] text-(--lm-encre-2)">
                  <Lock className="size-3 shrink-0" aria-hidden />
                  Accès et wifi retirés : {joursAvant(apercu.jour, sejour.arrivee)}.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Repli sans cadre (comme « Avancé ») : ses champs ne sont pas dans un second cadre aussi arrondi qu'eux. */}
        <details className="group" open={nbPropres > 0}>
          <summary className="-my-1.5 inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
            Texte différent pour un logement{nbPropres ? ` (${nbPropres})` : ''}
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 border-t border-(--lm-bord) pt-3">
            {nbPropres > 0 && (
              <ul className="mb-3 divide-y divide-(--lm-bord)">
                {Object.entries(propres).map(([id, m]) => (
                  <li key={id} className="py-3 first:pt-0">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-medium text-(--lm-encre)">{nomLogement(id)}</p>
                      {p.modifiable && (
                        <IconButton label={`Retirer le texte de ${nomLogement(id)}`} size="sm" onClick={() => setPropres((x) => Object.fromEntries(Object.entries(x).filter(([cle]) => cle !== id)))}>
                          <X />
                        </IconButton>
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
                  </li>
                ))}
              </ul>
            )}
            {p.modifiable && sansPropre.length > 0 ? (
              <Select
                aria-label="Ajouter un logement"
                value=""
                placeholder="Ajouter un logement…"
                className="text-[13px]"
                onChange={(e) => e.target.value && setPropres((x) => ({ ...x, [e.target.value]: { texte } }))}
                options={sansPropre.map((l) => ({ valeur: l.id, libelle: l.nom }))}
              />
            ) : (
              !nbPropres && <p className="text-[13px] text-(--lm-encre-2)">Le même texte pour tous les logements.</p>
            )}
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
