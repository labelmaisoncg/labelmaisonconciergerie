/**
 * Signaler un incident, pas à pas (kit ui/Assistant.tsx) : le logement, la
 * date du constat, le type et l'urgence, ce qui s'est passé, les preuves,
 * qui paiera, qui suit, puis le récapitulatif. Rien n'est enregistré avant
 * « Créer l'incident » (creerIncident du store) ; règles :
 * data/creation-incident.ts.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { EMAIL_EQUIPE } from '../../../data/config';
import { AUJOURDHUI, dateCourte } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { estCompteTechnique } from '../../../data/oauth-regles';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_INCIDENT,
  SANS_CHAMP_INCIDENT,
  brouillonIncident,
  erreursIncident,
  incidentDepuisBrouillon,
  recapIncident,
  sejoursConcernes,
  type BrouillonIncident,
  type EcranIncident,
} from '../../../data/creation-incident';
import { useErp } from '../../../data/store';
import type { CategorieIncident, GraviteIncident, Incident, Refacturable } from '../../../data/types';
import { Assistant, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, EnvoiFichier, Field, Input, InputEuros, NBSP, Prerequis, RecapAssistant, SearchInput, Textarea, cn, useParcours } from '../../../ui';

const options = <K extends string>(libelles: Record<K, string>) => (Object.keys(libelles) as K[]).map((k) => ({ valeur: k, libelle: libelles[k] }));

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (i: Incident) => void;
}

/** Déclaration d'un incident, avec preuves et imputation du coût. */
export function NouvelIncident({ ouvert, onFermer, onCree }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf.
  return <AssistantIncident onFermer={onFermer} onCree={onCree} />;
}

const QUESTIONS: Record<EcranIncident, { question: string; aide?: string }> = {
  logement: { question: `Quel logement${NBSP}?` },
  quand: { question: `Quand l’avez-vous constaté${NBSP}?` },
  nature: { question: `Quel type d’incident${NBSP}?` },
  description: { question: `Que s’est-il passé${NBSP}?`, aide: 'Ce qui a été constaté, par qui, et l’impact pour le voyageur.' },
  preuves: { question: `Avez-vous des photos${NBSP}?`, aide: 'Sans preuve, impossible de se faire rembourser.' },
  cout: { question: `Qui paiera${NBSP}?`, aide: `Facultatif${NBSP}: à compléter plus tard si vous ne savez pas encore.` },
  suivi: { question: `Qui suit l’incident${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

/** Au-delà, la liste des logements se filtre. */
const SEUIL_RECHERCHE = 6;
const AUCUN = '__aucun__';

/** Étiquette d'un détail de l'écran (pas une seconde question) : comme celle d'un champ. */
const ETIQUETTE = 'text-[13px] font-semibold text-(--lm-encre)';

const idChamp = (cle: string) => `assistant-incident-${cle}`;

function AssistantIncident({ onFermer, onCree }: Omit<Props, 'ouvert'>) {
  const { logements, reservations, utilisateurs, creerIncident } = useErp();
  const [b, setB] = useState<BrouillonIncident>(() => brouillonIncident(AUJOURDHUI));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const tries = useMemo(() => [...logements].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')), [logements]);
  const ctx = { logements, aujourdhui: AUJOURDHUI };
  const p = useParcours<EcranIncident>({ ecrans: ECRANS_INCIDENT, idChamp, sansChamp: SANS_CHAMP_INCIDENT });
  const ecran = p.ecran;
  const erreurs = erreursIncident(ecran, b, ctx);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonIncident>) => setB((x) => ({ ...x, ...patch }));
  const sejours = sejoursConcernes(reservations, b);
  const responsables = utilisateurs.filter((u) => u.role !== 'prestataire' && !estCompteTechnique(u.email, EMAIL_EQUIPE)).map((u) => u.nom);

  const creer = () => {
    if (envoi) return;
    const r = incidentDepuisBrouillon(b, ctx);
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursIncident('recapitulatif', b, ctx)));
    setEnvoi(true);
    const i = creerIncident(r.incident);
    // Fermer d'abord : ouvert par « ?nouveau=1 », la fermeture retire le paramètre de l'adresse, puis l'incident s'ouvre.
    onFermer();
    onCree(i);
  };
  const continuer = () => p.continuer(erreurs, creer);
  // Aucun logement : un incident se rattache toujours à un logement.
  const bloque = ecran === 'logement' && !logements.length;
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Nouvel incident"
      ecrans={ECRANS_INCIDENT}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer l’incident')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={bloque}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cet incident${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'logement' &&
        (bloque ? (
          <Prerequis manque="Vous n’avez pas encore de logement." detail="Un incident se rattache toujours à un logement." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
        ) : (
          <ChoixLogement
            logements={tries}
            valeur={b.logementId}
            // Autre logement : le séjour choisi ne vaut plus.
            onChange={(logementId) => maj({ logementId, reservationId: '' })}
            continuer={continuer}
            titreId={titreId}
          />
        ))}

      {ecran === 'quand' && (
        <div className="space-y-6">
          <Field label="Date du constat" erreur={etat.erreurChamp('date')}>
            <Input
              id={idChamp('date')}
              type="date"
              max={AUJOURDHUI}
              value={b.date}
              onChange={(e) => {
                const date = e.target.value;
                // Un séjour arrivé après la nouvelle date ne peut plus être concerné.
                maj({ date, ...(b.reservationId && !sejoursConcernes(reservations, { ...b, date }).some((r) => r.id === b.reservationId) ? { reservationId: '' } : {}) });
              }}
              onBlur={() => p.quitter('date')}
              className={cn(CHAMP_ASSISTANT, 'sm:max-w-56')}
            />
          </Field>
          {sejours.length > 0 && (
            <ChoixSejour
              options={[
                { valeur: AUCUN, libelle: 'Aucun séjour en particulier' },
                ...sejours.map((r) => ({ valeur: r.id, libelle: r.voyageur.nom, detail: `${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}` })),
              ]}
              valeur={b.reservationId || AUCUN}
              onChange={(v) => maj({ reservationId: v === AUCUN ? '' : v })}
              continuer={continuer}
            />
          )}
        </div>
      )}

      {ecran === 'nature' && (
        <Nature b={b} maj={maj} continuer={continuer} titreId={titreId} />
      )}

      {ecran === 'description' && (
        <Field label="Description" erreur={etat.erreurChamp('description')}>
          <Textarea
            id={idChamp('description')}
            rows={5}
            value={b.description}
            onChange={(e) => maj({ description: e.target.value })}
            onBlur={() => p.quitter('description')}
            className="text-[16px]"
          />
        </Field>
      )}

      {ecran === 'preuves' && (
        <div className="space-y-4">
          <EnvoiFichier
            dossier={`incidents/${b.logementId || 'sans-logement'}`}
            accept="image/*,application/pdf"
            multiple
            size="md"
            libelle="Joindre des photos ou documents"
            onEnvoye={(urls) => setB((x) => ({ ...x, preuves: [x.preuves.trim(), ...urls].filter(Boolean).join('\n') }))}
          />
          <Field label="Adresses des preuves" aide="Les fichiers joints s’ajoutent ici. Vous pouvez aussi coller une adresse par ligne." erreur={etat.erreurChamp('preuves')}>
            <Textarea
              id={idChamp('preuves')}
              rows={3}
              value={b.preuves}
              onChange={(e) => maj({ preuves: e.target.value })}
              onBlur={() => p.quitter('preuves')}
              placeholder="Adresse d’une photo en ligne"
              className="text-[16px]"
            />
          </Field>
        </div>
      )}

      {ecran === 'cout' && <Cout b={b} maj={maj} erreur={etat.erreurChamp('cout')} quitter={p.quitter} continuer={continuer} />}

      {ecran === 'suivi' && (
        <ChoixListe
          options={[{ valeur: AUCUN, libelle: 'Personne pour l’instant' }, ...responsables.map((nom) => ({ valeur: nom, libelle: nom }))]}
          valeur={b.responsable || AUCUN}
          onChange={(v) => maj({ responsable: v === AUCUN ? '' : v })}
          onContinuer={continuer}
          labelledBy={titreId}
        />
      )}

      {ecran === 'recapitulatif' && <RecapAssistant lignes={recapIncident(b, { logements, reservations, aujourdhui: AUJOURDHUI }).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))} />}
    </Assistant>
  );
}

function ChoixLogement({
  logements,
  valeur,
  onChange,
  continuer,
  titreId,
}: {
  logements: { id: string; nom: string; ville: string }[];
  valeur: string;
  onChange: (id: string) => void;
  continuer: () => void;
  titreId: string;
}) {
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLocaleLowerCase('fr');
  const visibles = q ? logements.filter((l) => `${l.nom} ${l.ville}`.toLocaleLowerCase('fr').includes(q)) : logements;
  return (
    <>
      {logements.length > SEUIL_RECHERCHE && (
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom ou ville" label="Rechercher un logement" className="mb-3 sm:w-full" />
      )}
      {visibles.length ? (
        <ChoixListe
          options={visibles.map((l) => ({ valeur: l.id, libelle: l.nom, detail: l.ville }))}
          valeur={valeur || undefined}
          onChange={onChange}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('logementId')}
        />
      ) : (
        <p className="text-[14px] text-(--lm-encre-2)">Aucun logement ne correspond.</p>
      )}
    </>
  );
}

function ChoixSejour({ options, valeur, onChange, continuer }: { options: { valeur: string; libelle: string; detail?: string }[]; valeur: string; onChange: (v: string) => void; continuer: () => void }) {
  const id = useId();
  const aideId = useId();
  return (
    <div>
      <p id={id} className={ETIQUETTE}>
        Séjour concerné
      </p>
      <p id={aideId} className="mt-0.5 mb-2 text-[12.5px] text-(--lm-encre-3)">
        Facultatif, utile pour refacturer un voyageur.
      </p>
      <ChoixListe options={options} valeur={valeur} onChange={onChange} onContinuer={continuer} labelledBy={id} describedBy={aideId} />
    </div>
  );
}

function Nature({ b, maj, continuer, titreId }: { b: BrouillonIncident; maj: (p: Partial<BrouillonIncident>) => void; continuer: () => void; titreId: string }) {
  const graviteId = useId();
  return (
    <>
      <ChoixCourts
        options={options<CategorieIncident>(LIBELLES.categorieIncident)}
        valeur={b.categorie}
        onChange={(categorie) => maj({ categorie })}
        onContinuer={continuer}
        labelledBy={titreId}
        className="grid-cols-2 sm:grid-cols-3"
      />
      <div className="mt-6 border-t border-(--lm-bord) pt-5">
        <p id={graviteId} className={ETIQUETTE}>
          Urgence
        </p>
        <ChoixCourts
          options={options<GraviteIncident>(LIBELLES.gravite)}
          valeur={b.gravite}
          onChange={(gravite) => maj({ gravite })}
          onContinuer={continuer}
          labelledBy={graviteId}
          className="mt-2 grid-cols-3"
        />
      </div>
    </>
  );
}

function Cout({
  b,
  maj,
  erreur,
  quitter,
  continuer,
}: {
  b: BrouillonIncident;
  maj: (p: Partial<BrouillonIncident>) => void;
  erreur?: string;
  quitter: (cle: string) => void;
  continuer: () => void;
}) {
  const refacturableId = useId();
  return (
    <>
      <p id={refacturableId} className={ETIQUETTE}>
        Refacturable à
      </p>
      <ChoixCourts
        options={options<Refacturable>(LIBELLES.refacturable)}
        valeur={b.refacturable}
        onChange={(refacturable) => maj({ refacturable })}
        onContinuer={continuer}
        labelledBy={refacturableId}
        className="mt-2 grid-cols-2"
      />
      <div className="mt-6">
        <Field label="Coût estimé" erreur={erreur} className="sm:max-w-56">
          <InputEuros id={idChamp('cout')} value={b.cout} onChange={(e) => maj({ cout: e.target.value })} onBlur={() => quitter('cout')} placeholder="0,00" />
        </Field>
      </div>
    </>
  );
}
