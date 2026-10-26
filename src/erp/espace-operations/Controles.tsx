import { useState } from 'react';
import { ArrowLeft, Check, ClipboardCheck, RotateCcw, Star } from 'lucide-react';
import { AUJOURDHUI as _AUJOURDHUI } from '../data/format';
import { dateCourte, dateHeure, jourMois } from '../data/format';
import type { ControleOps, ControleQualite } from '../data/types-operations';
import { Badge, Button, EmptyState, Field, Modal, Textarea, cn } from '../ui';
import { ChoixPhotos, type PhotoChoisie } from './Photos';
import { Ligne, Liste, Rubrique, TitreEspace, court, useOps } from './commun';

void _AUJOURDHUI;

/** Un contrôle à faire : le logement, pourquoi et pour quand. */
export function LigneControle({ c }: { c: ControleOps }) {
  const { vue, naviguer, nomLogement } = useOps();
  const s = c.reservationId ? vue.sejours.find((x) => x.id === c.reservationId) : undefined;
  const quand = c.echeance === vue.aujourdhui ? 'aujourd’hui' : `avant le ${jourMois(c.echeance)}`;
  return (
    <Ligne
      ton={c.enRetard ? 'danger' : 'alerte'}
      icone={<ClipboardCheck />}
      titre={nomLogement(c.logementId)}
      sousTitre={[s ? `Départ du ${jourMois(s.depart)}` : 'Contrôle planifié', !c.enRetard && `à faire ${quand}`].filter(Boolean).join(' · ')}
      fin={c.enRetard && <Badge tone="danger">En retard</Badge>}
      onClick={() => naviguer({ controle: c.cle })}
    />
  );
}

/** Contrôles qualité : à faire (après chaque départ, ou planifiés) et faits, par logement. */
export function Controles() {
  const { vue, naviguer, nomLogement, nomMembre } = useOps();
  return (
    <>
      <TitreEspace titre="Contrôles qualité" description="Un contrôle est proposé après chaque départ. Il se remplit sur place, au téléphone." />
      <Rubrique titre={vue.controles.length ? `À faire (${vue.controles.length})` : 'À faire'}>
        {vue.controles.length ? (
          <Liste label="Contrôles à faire">
            {vue.controles.map((c) => (
              <LigneControle key={c.cle} c={c} />
            ))}
          </Liste>
        ) : (
          <EmptyState icone={<ClipboardCheck />} titre="Aucun contrôle à faire." />
        )}
      </Rubrique>
      <Rubrique titre="Faits récemment">
        {vue.historiqueControles.length ? (
          <Liste label="Contrôles faits">
            {vue.historiqueControles.map((c) => {
              const aRevoir = c.points.filter((p) => p.etat === 'a_revoir').length;
              return (
                <Ligne
                  key={c.id}
                  ton={aRevoir ? 'alerte' : 'succes'}
                  icone={<ClipboardCheck />}
                  titre={nomLogement(c.logementId)}
                  sousTitre={[dateCourte((c.realiseLe ?? c.echeance).slice(0, 10)), nomMembre(c.parId), aRevoir ? `${aRevoir} point${aRevoir > 1 ? 's' : ''} à revoir` : 'tout est en ordre']
                    .filter(Boolean)
                    .join(' · ')}
                  fin={
                    c.note !== undefined && (
                      <span className="lm-chiffres inline-flex items-center gap-1 text-[13px] text-(--lm-encre-2)">
                        <Star className="size-3.5 text-(--lm-or-texte)" aria-hidden />
                        {c.note}/5
                      </span>
                    )
                  }
                  onClick={() => naviguer({ controle: c.id })}
                />
              );
            })}
          </Liste>
        ) : (
          <p className="text-[13.5px] text-(--lm-encre-2)">Aucun contrôle fait pour l’instant.</p>
        )}
      </Rubrique>
    </>
  );
}

interface PointBrouillon {
  id: string;
  libelle: string;
  etat?: 'ok' | 'a_revoir';
  commentaire: string;
  photo?: PhotoChoisie;
  photoChangee: boolean;
  incidentId?: string;
}

const brouillonDe = (c: ControleOps | undefined, fait: ControleQualite | undefined): PointBrouillon[] => {
  const base = c?.controle ?? fait;
  if (base) return base.points.map((p) => ({ id: p.id, libelle: p.libelle, etat: p.etat, commentaire: p.commentaire ?? '', photo: p.photo ? { url: p.photo, apercu: p.photo } : undefined, photoChangee: false, incidentId: p.incidentId }));
  return (c?.points ?? []).map((libelle, k) => ({ id: `p${k + 1}`, libelle, commentaire: '', photoChangee: false }));
};

/**
 * Contrôle qualité rempli sur place : pour chaque point, OK ou À revoir, une
 * photo, un commentaire ; puis une note sur 5. Les points à revoir peuvent
 * devenir des incidents, confiés à qui suit le logement.
 */
export function FormulaireControle({ cle, onFermer }: { cle: string; onFermer: () => void }) {
  const { vue, agir, nomLogement, nomMembre, apercu } = useOps();
  const aFaire = vue.controles.find((c) => c.cle === cle);
  const fait = aFaire ? undefined : vue.historiqueControles.find((c) => c.id === cle);
  const existant = aFaire?.controle ?? fait;
  const [points, setPoints] = useState<PointBrouillon[]>(() => brouillonDe(aFaire, fait));
  const [note, setNote] = useState<number | undefined>(existant?.note);
  const [commentaire, setCommentaire] = useState(existant?.commentaire ?? '');
  const [erreur, setErreur] = useState<string>();
  const [proposition, setProposition] = useState(false);
  const [enCours, setEnCours] = useState<string>();

  if (!aFaire && !fait) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState icone={<ClipboardCheck />} titre="Ce contrôle n’est plus à faire." action={<Button onClick={onFermer}>Voir les contrôles</Button>} />
      </div>
    );
  }
  const logementId = (aFaire ?? fait)!.logementId;
  const reservationId = aFaire?.reservationId ?? fait?.reservationId;
  const sejour = reservationId ? vue.sejours.find((s) => s.id === reservationId) : undefined;
  const echeance = aFaire?.echeance ?? fait!.echeance;
  const aRevoirSansIncident = points.filter((p) => p.etat === 'a_revoir' && !p.incidentId);

  const maj = (id: string, patch: Partial<PointBrouillon>) => setPoints((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const envoyer = async (terminer: boolean, avecIncidents: boolean) => {
    setProposition(false);
    if (terminer) {
      const sans = points.filter((p) => !p.etat).length;
      if (sans) return setErreur(sans > 1 ? `${sans} points sans réponse : OK ou À revoir.` : 'Un point sans réponse : OK ou À revoir.');
      if (!note) return setErreur('Donnez une note sur 5.');
    }
    setErreur(undefined);
    setEnCours(terminer ? 'terminer' : 'garder');
    const ok = await agir({
      type: 'controle',
      cle,
      points: points.map((p) => ({ id: p.id, etat: p.etat, commentaire: p.commentaire.trim(), ...(p.photoChangee ? { photo: p.photo?.url ?? '' } : {}) })),
      note,
      commentaire: commentaire.trim(),
      terminer,
      ...(avecIncidents ? { incidentsPour: aRevoirSansIncident.map((p) => p.id) } : {}),
    });
    setEnCours(undefined);
    if (ok) onFermer();
  };

  const enregistrer = () => {
    if (aRevoirSansIncident.length && points.every((p) => p.etat) && note) return setProposition(true);
    void envoyer(true, false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start gap-2">
        <button
          type="button"
          onClick={onFermer}
          aria-label="Retour aux contrôles"
          className="-ml-2 grid size-10 shrink-0 place-items-center rounded-lg text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 pt-1">
          <h1 className="lm-serif text-[24px] leading-tight text-(--lm-brun)">{nomLogement(logementId)}</h1>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">
            {fait
              ? `Fait le ${dateHeure(fait.realiseLe ?? fait.echeance)}${fait.parId ? ` par ${nomMembre(fait.parId)}` : ''}`
              : `${sejour ? `Départ de ${sejour.voyageur} le ${jourMois(sejour.depart)}` : 'Contrôle planifié'} · ${
                  echeance < vue.aujourdhui ? `en retard (prévu le ${jourMois(echeance)})` : echeance === vue.aujourdhui ? 'à faire aujourd’hui' : `à faire avant le ${jourMois(echeance)}`
                }`}
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {points.map((p) => (
          <li key={p.id}>
            <Point p={p} lecture={!!apercu} onChange={(patch) => maj(p.id, patch)} />
          </li>
        ))}
      </ol>

      <section aria-label="Note d’ensemble" className="mt-5 rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-4 shadow-(--lm-ombre)">
        <p className="text-[14px] font-medium text-(--lm-encre)">Note d’ensemble</p>
        <div role="group" aria-label="Note sur 5" className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={!!apercu}
              aria-label={`${n} sur 5`}
              aria-pressed={note === n}
              onClick={() => setNote(n)}
              className="grid size-11 place-items-center rounded-lg text-(--lm-or-texte) hover:bg-(--lm-or-lavis) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none disabled:hover:bg-transparent"
            >
              <Star className={cn('size-7', (note ?? 0) >= n ? 'fill-current' : 'text-(--lm-encre-3)')} aria-hidden />
            </button>
          ))}
        </div>
        <Field label="Commentaire" className="mt-4">
          <Textarea rows={2} value={commentaire} disabled={!!apercu} onChange={(e) => setCommentaire(e.target.value)} placeholder="Ce qu’il faut retenir pour la suite." maxLength={1000} />
        </Field>
      </section>

      {!apercu && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-wrap items-center gap-3 border-t border-(--lm-bord) bg-(--lm-fond) px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          {erreur && (
            <p role="alert" className="w-full text-[13px] font-medium text-(--lm-danger)">
              {erreur}
            </p>
          )}
          {!fait && (
            <Button variant="ghost" chargement={enCours === 'garder'} onClick={() => void envoyer(false, false)}>
              Finir plus tard
            </Button>
          )}
          <Button variant="primary" size="lg" className="ml-auto max-sm:flex-1" icone={<Check />} chargement={enCours === 'terminer'} onClick={enregistrer}>
            {fait ? 'Enregistrer les changements' : 'Enregistrer le contrôle'}
          </Button>
        </div>
      )}

      <Modal
        ouvert={proposition}
        onFermer={() => setProposition(false)}
        titre={aRevoirSansIncident.length > 1 ? `${aRevoirSansIncident.length} points sont à revoir` : 'Un point est à revoir'}
        description={aRevoirSansIncident.length > 1 ? 'Créer un incident pour chacun, confié à qui suit le logement ?' : 'Créer un incident, confié à qui suit le logement ?'}
        pied={
          <>
            <Button variant="ghost" onClick={() => void envoyer(true, false)}>
              Enregistrer sans incident
            </Button>
            <Button variant="primary" onClick={() => void envoyer(true, true)}>
              Créer {aRevoirSansIncident.length > 1 ? 'les incidents' : 'l’incident'}
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-(--lm-encre-2)">
          {aRevoirSansIncident.map((p) => (
            <li key={p.id}>
              {p.libelle}
              {p.commentaire.trim() ? ` : ${p.commentaire.trim()}` : ''}
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

/** Un point du contrôle : OK ou À revoir, photo, commentaire. */
function Point({ p, lecture, onChange }: { p: PointBrouillon; lecture: boolean; onChange: (patch: Partial<PointBrouillon>) => void }) {
  const [note, setNote] = useState(!!p.commentaire);
  const aRevoir = p.etat === 'a_revoir';
  const choix = (etat: 'ok' | 'a_revoir', libelle: string) => (
    <button
      type="button"
      disabled={lecture}
      aria-pressed={p.etat === etat}
      onClick={() => onChange({ etat: p.etat === etat ? undefined : etat })}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13.5px] font-medium focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none',
        p.etat === etat
          ? etat === 'ok'
            ? 'border-(--lm-succes) bg-(--lm-succes-lavis) text-(--lm-encre)'
            : 'border-(--lm-alerte) bg-(--lm-alerte-lavis) text-(--lm-encre)'
          : 'border-(--lm-bord-fort) bg-(--lm-surface) text-(--lm-encre-2) hover:text-(--lm-encre)',
      )}
    >
      {etat === 'ok' ? <Check className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
      {libelle}
    </button>
  );
  return (
    <div className={cn('rounded-xl border bg-(--lm-surface) p-3 shadow-(--lm-ombre) sm:p-4', aRevoir ? 'border-(--lm-alerte)/40' : 'border-(--lm-bord)')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-medium text-(--lm-encre)">{p.libelle}</p>
        <div role="group" aria-label={`${p.libelle} : état`} className="grid grid-cols-2 gap-1.5">
          {choix('ok', 'OK')}
          {choix('a_revoir', 'À revoir')}
        </div>
      </div>
      {(aRevoir || note) && (
        <Field label="Commentaire" className="mt-3">
          <Textarea rows={2} value={p.commentaire} disabled={lecture} onChange={(e) => onChange({ commentaire: e.target.value })} placeholder={aRevoir ? 'Ce qui ne va pas.' : 'Une précision.'} maxLength={500} />
        </Field>
      )}
      <div className="mt-2 flex flex-wrap items-start gap-1.5">
        {lecture ? (
          p.photo && <ChoixPhotos photos={[p.photo]} onChange={() => undefined} max={1} />
        ) : (
          <ChoixPhotos photos={p.photo ? [p.photo] : []} onChange={(l) => onChange({ photo: l[0], photoChangee: true })} max={1} libelle="Photo" variante="ghost" />
        )}
        {!lecture && !aRevoir && !note && (
          <Button variant="ghost" size="sm" onClick={() => setNote(true)}>
            Commentaire
          </Button>
        )}
      </div>
      {p.incidentId && <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Incident créé pour ce point.</p>}
      {aRevoir && !p.incidentId && !lecture && <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Un incident vous sera proposé à l’enregistrement.</p>}
    </div>
  );
}

export { court };
