/**
 * Nouvelle réservation directe, pas à pas (kit ui/Assistant.tsx) : le
 * logement, les dates (contrôle de chevauchement : surbooking refusé), le
 * voyageur, les montants, puis le récapitulatif. Rien n'est enregistré avant
 * « Créer la réservation » ; les règles sont dans data/creation-reservation.ts
 * (les ménages sont sortis de l'ERP, octobre 2026).
 */
import { useId, useMemo, useRef, useState } from 'react';
import { Alert, Assistant, CHAMP_ASSISTANT, ChoixListe, Compteur, Field, Input, InputEuros, NBSP, Prerequis, RecapAssistant, SearchInput, insecables, useParcours } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, euros, jourMois, pluriel } from '../../../data/format';
import { brouillonModifie, dateLisible } from '../../../data/parcours-assistant';
import {
  ECRANS_RESERVATION,
  SANS_CHAMP_RESERVATION,
  brouillonReservation,
  ditParLEncadre,
  chevauchements,
  erreursReservation,
  logementsReservables,
  menageDuMandat,
  montantsReservation,
  nuitsReservation,
  recapReservation,
  reservationDepuisBrouillon,
  type BrouillonReservation,
  type EcranReservation,
} from '../../../data/creation-reservation';
import type { Reservation } from '../../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (r: Reservation) => void;
}

export function ModalNouvelleReservation({ ouvert, onFermer, onCree }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf.
  return <AssistantReservation onFermer={onFermer} onCree={onCree} />;
}

const QUESTIONS: Record<EcranReservation, { question: string; aide?: string }> = {
  logement: { question: `Quel logement${NBSP}?`, aide: 'Séjour réservé hors plateformes.' },
  dates: { question: `Quelles dates${NBSP}?` },
  voyageur: { question: `Qui voyage${NBSP}?` },
  montants: { question: `Combien paie le voyageur${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

/** Au-delà, la liste des logements se filtre. */
const SEUIL_RECHERCHE = 6;

const idChamp = (cle: string) => `assistant-reservation-${cle}`;

function AssistantReservation({ onFermer, onCree }: Omit<Props, 'ouvert'>) {
  const d = useErp();
  const [b, setB] = useState<BrouillonReservation>(() => brouillonReservation(AUJOURDHUI));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const reservables = useMemo(() => logementsReservables(d.logements).sort((x, y) => x.nom.localeCompare(y.nom, 'fr')), [d.logements]);
  const ctx = { logements: d.logements, reservations: d.reservations, mandats: d.mandats, aujourdhui: AUJOURDHUI };
  const p = useParcours<EcranReservation>({ ecrans: ECRANS_RESERVATION, idChamp, sansChamp: SANS_CHAMP_RESERVATION });
  const ecran = p.ecran;
  const erreurs = erreursReservation(ecran, b, ctx);
  // Le chevauchement est dit par l'encadré rouge, pas une seconde fois au pied.
  const etat = p.etat(erreurs, ditParLEncadre);
  const maj = (patch: Partial<BrouillonReservation>) => setB((x) => ({ ...x, ...patch }));

  const creer = () => {
    if (envoi) return;
    const r = reservationDepuisBrouillon(b, { ...ctx, id: nouvelId('res') });
    // Une réservation arrivée entre-temps sur ces dates… : retour à l'écran à corriger.
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursReservation('recapitulatif', b, ctx)));
    setEnvoi(true);
    d.upsert('reservations', r.reservation);
    onCree(r.reservation);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, creer);
  // Aucun logement réservable : l'assistant ne peut pas aboutir, il dit quoi faire.
  const bloque = ecran === 'logement' && !reservables.length;
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      // « directe » est dit par l'aide du premier écran : à 320 px, le titre tient sur une ligne entre les deux ronds de 44 px.
      titre="Nouvelle réservation"
      ecrans={ECRANS_RESERVATION}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer la réservation')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={bloque}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette réservation${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'logement' &&
        (bloque ? (
          d.logements.length ? (
            <Prerequis
              manque="Aucun logement actif pour l’instant."
              detail="Un logement devient réservable quand son mandat est signé et sa liste de lancement terminée."
              lien="/erp/logements"
              action="Voir les logements"
            />
          ) : (
            <Prerequis manque="Vous n’avez pas encore de logement." detail="Une réservation se fait toujours dans un logement." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
          )
        ) : (
          <EcranLogement b={b} maj={maj} logements={reservables} continuer={continuer} titreId={titreId} />
        ))}
      {ecran === 'dates' && <EcranDates b={b} maj={maj} ctx={ctx} erreur={etat.erreurChamp} quitter={p.quitter} />}
      {ecran === 'voyageur' && <EcranVoyageur b={b} maj={maj} capacite={reservables.find((l) => l.id === b.logementId)?.capacite} erreur={etat.erreurChamp} quitter={p.quitter} />}
      {ecran === 'montants' && <EcranMontants b={b} maj={maj} ctx={ctx} erreur={etat.erreurChamp} quitter={p.quitter} />}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapReservation(b, ctx).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">Bloquez aussi ces dates sur Airbnb et Booking.com{NBSP}: l’ERP ne modifie pas les calendriers.</p>
        </RecapAssistant>
      )}
    </Assistant>
  );
}

type Contexte = Parameters<typeof erreursReservation>[2];

interface PropsEcran {
  b: BrouillonReservation;
  maj: (patch: Partial<BrouillonReservation>) => void;
  erreur: (cle: string) => string | undefined;
  quitter: (cle: string) => void;
}

function EcranLogement({
  b,
  maj,
  logements,
  continuer,
  titreId,
}: Pick<PropsEcran, 'b' | 'maj'> & { logements: ReturnType<typeof logementsReservables>; continuer: () => void; titreId: string }) {
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLocaleLowerCase('fr');
  const visibles = q ? logements.filter((l) => `${l.nom} ${l.ville}`.toLocaleLowerCase('fr').includes(q)) : logements;
  const choisir = (logementId: string) => {
    const l = logements.find((x) => x.id === logementId);
    // Le nombre de voyageurs proposé reste dans la capacité du logement.
    maj({ logementId, ...(l && b.nbPersonnes > Math.max(1, l.capacite) ? { nbPersonnes: Math.max(1, l.capacite) } : {}) });
  };
  return (
    <>
      {logements.length > SEUIL_RECHERCHE && (
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom ou ville" label="Rechercher un logement" className="mb-3 sm:w-full" />
      )}
      {visibles.length ? (
        <ChoixListe
          options={visibles.map((l) => ({ valeur: l.id, libelle: l.nom, detail: `${l.ville} · ${pluriel(l.capacite, 'voyageur')} au plus` }))}
          valeur={b.logementId || undefined}
          onChange={choisir}
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

function EcranDates({ b, maj, ctx, erreur, quitter }: PropsEcran & { ctx: Contexte }) {
  const nuits = nuitsReservation(b);
  const conflits = chevauchements(b, ctx);
  return (
    <>
      {/* Côte à côte dès 360 px ; en dessous, un champ de date n'a pas la place de montrer toute la date. */}
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <Field label="Arrivée" erreur={erreur('arrivee')}>
          <Input
            id={idChamp('arrivee')}
            type="date"
            min={AUJOURDHUI}
            value={b.arrivee}
            onChange={(e) => maj({ arrivee: e.target.value })}
            onBlur={() => quitter('arrivee')}
            className={CHAMP_ASSISTANT}
          />
        </Field>
        <Field label="Départ" erreur={erreur('depart')}>
          <Input
            id={idChamp('depart')}
            type="date"
            min={b.arrivee || AUJOURDHUI}
            value={b.depart}
            onChange={(e) => maj({ depart: e.target.value })}
            onBlur={() => quitter('depart')}
            className={CHAMP_ASSISTANT}
          />
        </Field>
      </div>
      {nuits > 0 && (
        <p className="lm-chiffres mt-3 text-[14px] text-(--lm-encre-2)" aria-live="polite">
          {insecables(`${pluriel(nuits, 'nuit')}, du ${dateLisible(b.arrivee, AUJOURDHUI)} au ${dateLisible(b.depart, AUJOURDHUI)}`)}
        </p>
      )}
      {conflits.length > 0 && (
        <Alert tone="danger" titre={`Dates indisponibles${NBSP}: déjà réservées`} className="mt-4">
          <ul className="mt-1 space-y-1">
            {conflits.map((c) => (
              <li key={c.reservation.id}>
                {c.reservation.voyageur.nom} ({insecables(dateCourte(c.reservation.arrivee))} au {insecables(dateCourte(c.reservation.depart))}){NBSP}:{' '}
                {c.nuits.length > 4
                  ? insecables(`${pluriel(c.nuits.length, 'nuit')} en conflit, du ${dateLisible(c.nuits[0], AUJOURDHUI)} au ${dateLisible(c.nuits[c.nuits.length - 1], AUJOURDHUI)}`)
                  : insecables(`nuit${c.nuits.length > 1 ? 's' : ''} du ${c.nuits.map(jourMois).join(', ')}`)}
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </>
  );
}

function EcranVoyageur({ b, maj, capacite, erreur, quitter }: PropsEcran & { capacite?: number }) {
  return (
    <div className="space-y-4">
      <Field label="Nom du voyageur" erreur={erreur('nom')}>
        <Input
          id={idChamp('nom')}
          value={b.nom}
          onChange={(e) => maj({ nom: e.target.value })}
          onBlur={() => quitter('nom')}
          autoComplete="off"
          placeholder="Prénom Nom"
          className={CHAMP_ASSISTANT}
        />
      </Field>
      <Field label="Pays">
        <Input id={idChamp('pays')} value={b.pays} onChange={(e) => maj({ pays: e.target.value })} autoComplete="off" className={CHAMP_ASSISTANT} />
      </Field>
      <div className="border-y border-(--lm-bord)">
        <Compteur
          as="div"
          libelle={
            <>
              Voyageurs
              {capacite !== undefined && <span className="block text-[12.5px] text-(--lm-encre-3)">{capacite} au plus</span>}
            </>
          }
          valeur={b.nbPersonnes}
          bornes={[1, Math.max(1, capacite ?? 30)]}
          retirer="Retirer un voyageur"
          ajouter="Ajouter un voyageur"
          onChange={(nbPersonnes) => maj({ nbPersonnes })}
        />
      </div>
    </div>
  );
}

function EcranMontants({ b, maj, ctx, erreur, quitter }: PropsEcran & { ctx: Contexte }) {
  const defaut = menageDuMandat(b, ctx);
  const m = montantsReservation(b, ctx);
  const total = Number.isFinite(m.hebergement) && m.hebergement > 0 && Number.isFinite(m.menage) && m.menage >= 0 ? m.hebergement + m.menage : undefined;
  return (
    <div className="space-y-4">
      <Field label="Prix des nuits" aide="Hébergement total, hors frais de ménage." erreur={erreur('hebergement')}>
        <InputEuros id={idChamp('hebergement')} value={b.hebergement} onChange={(e) => maj({ hebergement: e.target.value })} onBlur={() => quitter('hebergement')} placeholder="ex. 360" />
      </Field>
      <Field
        label="Frais de ménage"
        aide={defaut !== undefined ? `Par défaut, ceux du mandat${NBSP}: ${euros(defaut)}.` : 'Selon le mandat du logement.'}
        erreur={erreur('menage')}
      >
        <InputEuros
          id={idChamp('menage')}
          value={b.menage}
          onChange={(e) => maj({ menage: e.target.value })}
          onBlur={() => quitter('menage')}
          placeholder={defaut !== undefined ? String(defaut / 100).replace('.', ',') : ''}
        />
      </Field>
      {total !== undefined && (
        <p className="flex items-baseline justify-between gap-3 border-t border-(--lm-bord) pt-4 text-[15px] text-(--lm-encre)" aria-live="polite">
          <span>Total payé par le voyageur</span>
          <span className="lm-chiffres font-semibold">{euros(total)}</span>
        </p>
      )}
    </div>
  );
}
