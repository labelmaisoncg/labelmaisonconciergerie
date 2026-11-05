import { useId, useRef, useState } from 'react';
import { ArrowRight, Phone, UserX } from 'lucide-react';
import {
  ECRANS_ABSENCE_POLE,
  SANS_CHAMP_ABSENCE,
  actionAbsenceDepuisBrouillon,
  brouillonAbsencePole,
  ecransAbsence,
  erreursAbsence,
  recapAbsence,
  type BrouillonAbsence,
  type EcranAbsence,
} from '../data/creation-absence';
import { jourMois } from '../data/format';
import { ROLES_OPERATIONS, ajouterJours, suiviPar, verifierAbsence } from '../data/operations';
import { brouillonModifie } from '../data/parcours-assistant';
import type { AbsenceMembre } from '../data/types-operations';
import { Alert, Assistant, Avatar, Button, CHAMP_ASSISTANT, ChoixListe, Drawer, Field, Input, NBSP, RecapAssistant, Select, insecables, useParcours } from '../ui';
import { remplacantsPossibles } from '../data/espace-operations';
import { Ligne, Liste, Rubrique, TitreEspace, court, useOps } from './commun';

/** Responsable de pôle : les absences et leurs remplaçants, puis les personnes de ses logements. */
export function Equipe() {
  const { vue, naviguer, apercu } = useOps();
  const nom = (id?: string) => vue.equipe.find((m) => m.id === id)?.nom ?? 'Membre';
  return (
    <>
      <TitreEspace
        titre="Équipe"
        description="Les personnes qui suivent vos logements, et qui les remplace pendant une absence."
        action={
          !apercu && (
            <Button icone={<UserX />} className="max-sm:min-h-11" onClick={() => naviguer({ absence: 'nouvelle' })}>
              Noter une absence
            </Button>
          )
        }
      />
      <Rubrique titre="Absences">
        {vue.absences.length ? (
          <Liste label="Absences en cours et à venir">
            {vue.absences.map((a) => (
              <Ligne
                key={a.id}
                icone={<UserX />}
                titre={nom(a.membreId)}
                sousTitre={a.du <= vue.aujourdhui ? `Absence jusqu’au ${jourMois(a.au)}` : `Absence du ${jourMois(a.du)} au ${jourMois(a.au)}`}
                onClick={() => naviguer({ absence: a.id })}
              />
            ))}
          </Liste>
        ) : (
          <p className="text-[13.5px] text-(--lm-encre-2)">Personne n’est absent dans les semaines qui viennent.</p>
        )}
      </Rubrique>
      <Rubrique titre="Les personnes">
        <ul className="divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
          {vue.equipe.map((m) => {
            const tel = m.telephone?.replace(/[^\d+]/g, '');
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <Avatar nom={m.nom} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{m.id === vue.moi.id ? `${m.nom} (vous)` : m.nom}</span>
                  <span className="block truncate text-[12.5px] text-(--lm-encre-2)">
                    {[ROLES_OPERATIONS[m.role], m.absence ? `absence jusqu’au ${jourMois(m.absence.au)}` : `${m.logementIds.length} logement${m.logementIds.length > 1 ? 's' : ''}`].join(' · ')}
                  </span>
                </span>
                {tel && m.id !== vue.moi.id && (
                  <a
                    href={`tel:${tel}`}
                    aria-label={`Appeler ${m.nom}`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-(--lm-bord-fort) text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)"
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Rubrique>
    </>
  );
}

/** Une absence : la nouvelle se note pas à pas (AssistantAbsence) ; une absence notée s'ouvre dans son panneau. */
export function PanneauAbsence({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { vue } = useOps();
  return vue.absences.some((a) => a.id === id) ? <FenetreAbsence id={id} onFermer={onFermer} /> : <AssistantAbsence onFermer={onFermer} />;
}

/** Date courte, avec l'année seulement quand ce n'est pas celle d'aujourd'hui. */
const jourAvecAnnee = (iso: string, aujourdhui: string) => (iso.slice(0, 4) === aujourdhui.slice(0, 4) ? jourMois(iso) : `${jourMois(iso)} ${iso.slice(0, 4)}`);

const QUESTIONS_ABSENCE: Record<EcranAbsence, { question: string; aide?: string }> = {
  personne: { question: `Qui sera absent${NBSP}?`, aide: 'Pour quelqu’un qui suit aussi d’autres logements, demandez au gérant.' },
  dates: { question: `Quelles sont les dates de l’absence${NBSP}?`, aide: 'Pendant l’absence, ses logements et ses incidents passent au remplaçant.' },
  remplacant: { question: `Qui reprend ses logements${NBSP}?`, aide: 'Seulement là où le logement n’a pas déjà quelqu’un.' },
  motif: { question: `Pour quel motif${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};
const SANS_REMPLACANT = '__personne__';
const idAbsence = (cle: string) => `assistant-absence-ops-${cle}`;

/**
 * Nouvelle absence, pas à pas (kit ui/Assistant.tsx) : la personne absente,
 * les dates, le remplaçant (sauté quand personne ne suit tous ses logements),
 * puis le récapitulatif avec ce qui change. Rien ne part avant « Créer
 * l'absence » ; règles et action : data/creation-absence.ts (la même action
 * « absence » qu'avant). Un refus du serveur reste ici.
 */
function AssistantAbsence({ onFermer }: { onFermer: () => void }) {
  const { vue, actions, annoncer } = useOps();
  const [b, setB] = useState<BrouillonAbsence>(() => brouillonAbsencePole(vue.aujourdhui));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const titreId = useId();
  const absents = vue.equipe.filter((m) => !m.absenceParGerant).map((m) => ({ valeur: m.id, libelle: m.nom, detail: ROLES_OPERATIONS[m.role] }));
  // Seulement ceux qui suivent déjà ce qu'ils reprendraient (sinon ils ne le verraient pas).
  const possibles = new Set(b.membreId ? remplacantsPossibles(vue, b.membreId) : []);
  const remplacants = vue.equipe.filter((m) => m.id !== b.membreId && possibles.has(m.id)).map((m) => ({ valeur: m.id, libelle: m.nom }));
  // Personne ne suit tous ses logements : l'écran du remplaçant n'offrirait rien, il est sauté (dit au récapitulatif).
  const avecRemplacants = !b.membreId || remplacants.length > 0;
  const ecrans = ecransAbsence(ECRANS_ABSENCE_POLE, avecRemplacants);
  const etapes = useParcours<EcranAbsence>({ ecrans, idChamp: idAbsence, sansChamp: SANS_CHAMP_ABSENCE });
  const ecran = etapes.ecran;
  const erreurs = erreursAbsence(ecran, b, vue.absences);
  const etat = etapes.etat(erreurs);
  const maj = (patch: Partial<BrouillonAbsence>) => setB((x) => ({ ...x, ...patch }));
  const nom = (id: string) => vue.equipe.find((m) => m.id === id)?.nom ?? 'Membre';
  const jour = (iso: string) => jourAvecAnnee(iso, vue.aujourdhui);

  const creer = async () => {
    if (envoi) return;
    const r = actionAbsenceDepuisBrouillon(b, vue.absences);
    if (!r.ok) return etapes.corriger(r.ecran, Object.keys(erreursAbsence('recapitulatif', b, vue.absences)));
    setEnvoi(true);
    setErreurEnvoi(undefined);
    const fait = await actions.agir(r.valeur);
    setEnvoi(false);
    if (!fait.ok) return setErreurEnvoi(fait.erreur);
    annoncer(fait.message, 'succes');
    onFermer();
  };
  const continuer = () => etapes.continuer(erreurs, () => void creer());
  const q = QUESTIONS_ABSENCE[ecran];

  return (
    <Assistant
      titre="Nouvelle absence"
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={etapes.libelleSuite('Créer l’absence')}
      onContinuer={continuer}
      onRetour={etapes.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette absence${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'personne' && (
        <ChoixListe
          options={absents}
          valeur={b.membreId || undefined}
          // Une autre personne : le remplaçant choisi ne vaut plus.
          onChange={(membreId) => maj({ membreId, remplacantId: membreId === b.membreId ? b.remplacantId : '' })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idAbsence('membreId')}
        />
      )}
      {ecran === 'dates' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Du">
            <Input id={idAbsence('dates')} type="date" value={b.du} onChange={(e) => maj({ du: e.target.value })} className={CHAMP_ASSISTANT} />
          </Field>
          <Field label="Au (inclus)">
            <Input type="date" value={b.au} min={b.du} onChange={(e) => maj({ au: e.target.value })} className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'remplacant' && (
        <ChoixListe
          options={[{ valeur: SANS_REMPLACANT, libelle: 'Pas de remplaçant choisi' }, ...remplacants]}
          valeur={b.remplacantId || SANS_REMPLACANT}
          onChange={(v) => maj({ remplacantId: v === SANS_REMPLACANT ? '' : v })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idAbsence('remplacantId')}
        />
      )}
      {ecran === 'recapitulatif' && (
        // Remplaçant impossible : la ligne le dit, sans « Modifier » (l'écran a été sauté).
        <RecapAssistant lignes={recapAbsence(b, { ecrans, nom, jour }).map((l) => ({ ...l, onModifier: ecrans.includes(l.ecran) ? () => etapes.modifier(l.ecran) : undefined }))}>
          {b.membreId && (
            <CeQuiChange
              absence={{ id: '', membreId: b.membreId, du: b.du, au: b.au, ...(b.remplacantId ? { remplacantId: b.remplacantId } : {}) }}
              consigne={avecRemplacants ? 'choisissez un remplaçant' : undefined}
              className="mt-4"
            />
          )}
          {erreurEnvoi && (
            <Alert tone="danger" className="mt-4">
              {erreurEnvoi}
            </Alert>
          )}
        </RecapAssistant>
      )}
    </Assistant>
  );
}

/** Une absence notée : la modifier ou l'annuler (en lecture quand le gérant l'a notée), avec ce qui change. */
function FenetreAbsence({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { vue, agir, apercu } = useOps();
  const existante = vue.absences.find((a) => a.id === id);
  const [a, setA] = useState<AbsenceMembre>(() => existante ?? { id: '', membreId: '', du: vue.aujourdhui, au: ajouterJours(vue.aujourdhui, 6) });
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState<string>();
  const membres = vue.equipe.map((m) => ({ valeur: m.id, libelle: m.nom }));
  // Absence notée par le gérant : lui seul la change ; ici, en lecture.
  const duGerant = !!existante && !existante.parMembreId;
  const lecture = !!apercu || duGerant;
  const absentsPossibles = vue.equipe.filter((m) => !m.absenceParGerant || m.id === existante?.membreId).map((m) => ({ valeur: m.id, libelle: m.nom }));
  const nom = (m?: string) => (m ? court(vue.equipe.find((x) => x.id === m)?.nom) : 'Personne');
  // Seulement ceux qui suivent déjà ce qu'ils reprendraient (sinon ils ne le verraient pas) ; le choix déjà fait reste affiché.
  const possibles = new Set(a.membreId ? remplacantsPossibles(vue, a.membreId) : []);
  const remplacants = membres.filter((m) => m.valeur !== a.membreId && (possibles.has(m.valeur) || m.valeur === a.remplacantId));

  const confirmer = async () => {
    const probleme = verifierAbsence({ ...a, id: a.id || 'nouvelle' }, vue.absences);
    if (probleme) return setErreur(probleme);
    setErreur(undefined);
    setEnCours('confirmer');
    const ok = await agir({ type: 'absence', ...(existante ? { id: existante.id } : {}), membreId: a.membreId, du: a.du, au: a.au, remplacantId: a.remplacantId || undefined });
    setEnCours(undefined);
    if (ok) onFermer();
  };
  const annuler = async () => {
    if (!existante) return;
    setEnCours('annuler');
    const ok = await agir({ type: 'absence-annuler', id: existante.id });
    setEnCours(undefined);
    if (ok) onFermer();
  };

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={existante ? `Absence de ${nom(existante.membreId)}` : 'Noter une absence'}
      pied={
        lecture ? undefined : (
          <>
            {existante && (
              <Button variant="ghost" chargement={enCours === 'annuler'} onClick={() => void annuler()}>
                Annuler l’absence
              </Button>
            )}
            <Button variant="primary" chargement={enCours === 'confirmer'} onClick={() => void confirmer()}>
              {existante ? 'Enregistrer' : 'Confirmer l’absence'}
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 text-[13px]">
        {erreur && <Alert tone="danger">{erreur}</Alert>}
        {duGerant && <Alert tone="neutre">Absence notée par le gérant : lui seul peut la modifier.</Alert>}
        <Field label="Personne absente" requis={!lecture} aide={existante ? undefined : 'Pour quelqu’un qui suit aussi d’autres logements, demandez au gérant.'}>
          <Select value={a.membreId} disabled={lecture} placeholder="Choisir" onChange={(e) => setA({ ...a, membreId: e.target.value })} options={absentsPossibles} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Du" requis={!lecture}>
            <Input type="date" value={a.du} disabled={lecture} onChange={(e) => setA({ ...a, du: e.target.value })} />
          </Field>
          <Field label="Au (inclus)" requis={!lecture}>
            <Input type="date" value={a.au} min={a.du} disabled={lecture} onChange={(e) => setA({ ...a, au: e.target.value })} />
          </Field>
        </div>
        <Field
          label="Remplaçant si le logement n’en a pas"
          aide={!lecture && a.membreId && !remplacants.length ? 'Personne ne suit tous ses logements : choisissez un remplaçant dans chaque logement.' : undefined}
        >
          <Select value={a.remplacantId ?? ''} disabled={lecture || !remplacants.length} placeholder="Personne" onChange={(e) => setA({ ...a, remplacantId: e.target.value || undefined })} options={remplacants} />
        </Field>

        {a.membreId && <CeQuiChange absence={a} consigne="choisissez un remplaçant ci-dessus" />}
      </div>
    </Drawer>
  );
}

/**
 * Ce qui change : ses logements et ses incidents ouverts, repris le premier
 * jour de l'absence, et par qui. Sans `consigne` (personne ne peut
 * remplacer), pas de consigne impossible à suivre : les lignes « Personne »
 * le montrent.
 */
function CeQuiChange({ absence: a, consigne, className }: { absence: AbsenceMembre; consigne?: string; className?: string }) {
  const { vue, nomLogement } = useOps();
  const nom = (m?: string) => (m ? court(vue.equipe.find((x) => x.id === m)?.nom) : 'Personne');
  const date = a.du > vue.aujourdhui ? a.du : vue.aujourdhui;
  const avec = { affectations: vue.affectations, absences: [...vue.absences.filter((x) => x.id !== a.id), { ...a, id: a.id || 'nouvelle' }] };
  const logements = vue.affectations.filter((x) => x.responsableId === a.membreId).map((x) => ({ id: x.id, vers: suiviPar(avec, a.membreId, x.id, date).membreId }));
  const incidents = vue.incidents
    .filter((i) => i.statut !== 'resolu' && i.assigneA === a.membreId)
    .map((i) => ({ id: i.id, texte: i.description, vers: suiviPar(avec, a.membreId, i.logementId, date).membreId }));
  const sansPersonne = [...logements, ...incidents].filter((x) => !x.vers).length;
  return (
    <section aria-label="Ce qui change" className={['min-w-0 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 text-[13px]', className].filter(Boolean).join(' ')}>
      <p className="text-[13.5px] font-semibold text-(--lm-encre)">{insecables(`Ce qui change du ${jourAvecAnnee(a.du, vue.aujourdhui)} au ${jourAvecAnnee(a.au, vue.aujourdhui)}`)}</p>
      {!logements.length && !incidents.length ? (
        <p className="mt-1 text-(--lm-encre-2)">Rien à reprendre{NBSP}: aucun logement ni incident ouvert à son nom.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {logements.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-(--lm-encre)">{nomLogement(x.id)}</span>
              <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
              <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
            </li>
          ))}
          {incidents.map((x) => (
            <li key={x.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-(--lm-encre-2)">Incident · {x.texte}</span>
              <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
              <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
            </li>
          ))}
        </ul>
      )}
      {sansPersonne > 0 && consigne && (
        <p className="mt-2 text-[12.5px] text-(--lm-danger)">
          Personne pour reprendre {sansPersonne > 1 ? `${sansPersonne}${NBSP}lignes` : 'une ligne'}
          {NBSP}: {consigne}.
        </p>
      )}
      <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">Au retour, tout revient à la personne.</p>
    </section>
  );
}
