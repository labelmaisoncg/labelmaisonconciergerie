import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Assistant,
  Button,
  CHAMP_ASSISTANT,
  ChoixCourts,
  ChoixListe,
  Field,
  Input,
  InputEuros,
  Interrupteur,
  Modal,
  NBSP,
  Prerequis,
  RecapAssistant,
  Select,
  cn,
  useParcours,
} from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import {
  SANS_CHAMP_MANDAT,
  brouillonMandat,
  ecransMandat,
  erreursMandat,
  mandatDepuisBrouillon,
  pourcentage,
  prochaineReference,
  recapMandat,
  type BrouillonMandat,
  type EcranMandat,
} from '../../data/creation-mandat';
import { AUJOURDHUI, ajouterJours, dateCourte, euros, jourMois, versCentimes } from '../../data/format';
import { brouillonModifie } from '../../data/parcours-assistant';
import type { Mandat } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  mandat?: Mandat;
  /** Valeurs initiales en création (ex. depuis une fiche propriétaire). */
  /** `dejaSigne` : proposer « Mandat déjà signé » (ex. après un changement de propriétaire, depuis la fiche). */
  preselection?: { proprietaireId?: string; logementId?: string; dateDebut?: string; dejaSigne?: boolean };
  onEnregistre?: (m: Mandat) => void;
}

interface Saisie {
  proprietaireId: string;
  logementId: string;
  commissionPct: string;
  fraisMenage: string;
  dateDebut: string;
  periodeEssaiFin: string;
  preavisJours: string;
}

/**
 * Création (AssistantMandat, pas à pas) ou modification (ModificationMandat,
 * le formulaire) d'un mandat. Règles de la création : data/creation-mandat.ts.
 */
export function FormMandat(props: Props) {
  if (props.mandat) return <ModificationMandat {...props} />;
  // Monté à chaque ouverture : un brouillon neuf.
  return props.ouvert ? <AssistantMandat preselection={props.preselection} onFermer={props.onFermer} onEnregistre={props.onEnregistre} /> : null;
}

/* ---------------------------------------------------------------- création */

const QUESTIONS: Record<EcranMandat, { question: string; aide?: string }> = {
  signe: { question: `Le mandat est-il déjà signé${NBSP}?`, aide: 'Signé, il s’applique dès la date de début. Sinon, il est créé en brouillon, à envoyer puis à signer.' },
  proprietaire: { question: `Avec quel propriétaire${NBSP}?` },
  logement: { question: `Pour quel logement${NBSP}?` },
  commission: { question: `Quelle commission${NBSP}?`, aide: `Cible${NBSP}: ${COMMISSION_CIBLE_MIN} à ${COMMISSION_CIBLE_MAX}${NBSP}%.` },
  menage: { question: `Quels frais de ménage${NBSP}?`, aide: 'Par séjour.' },
  dates: { question: `Quelles sont les dates du mandat${NBSP}?` },
  preavis: { question: `Quel préavis${NBSP}?`, aide: 'Pour mettre fin au mandat.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
] as const;

const idChamp = (cle: string) => `assistant-mandat-${cle}`;

/** L'année seulement quand ce n'est pas l'année en cours. */
const jour = (iso: string) => (iso.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois(iso) : dateCourte(iso));

function AssistantMandat({ preselection, onFermer, onEnregistre }: Pick<Props, 'preselection' | 'onFermer' | 'onEnregistre'>) {
  const { proprietaires, logements, mandats, upsert } = useErp();
  const proposerSigne = preselection?.dejaSigne !== undefined;
  // Fiche logement, factures : le propriétaire et le logement sont déjà connus, leurs écrans sont sautés.
  const ecrans = ecransMandat(proposerSigne, preselection);
  const [b, setB] = useState<BrouillonMandat>(() => brouillonMandat(preselection, AUJOURDHUI));
  const depart = useRef(b);
  const titreId = useId();
  const p = useParcours<EcranMandat>({ ecrans, idChamp, sansChamp: SANS_CHAMP_MANDAT });
  const ecran = p.ecran;
  const erreurs = erreursMandat(ecran, b, mandats);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonMandat>) => setB((x) => ({ ...x, ...patch }));
  const logementsDispo = logements.filter((l) => !b.proprietaireId || l.proprietaireId === b.proprietaireId);
  const pct = pourcentage(b);
  const nomProprietaire = (id: string) => proprietaires.find((x) => x.id === id)?.nom ?? '';
  const nomLogement = (id: string) => logements.find((x) => x.id === id)?.nom ?? '';

  const creer = () => {
    const r = mandatDepuisBrouillon(b, { mandats, id: nouvelId('man'), aujourdhui: AUJOURDHUI, proposerSigne });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursMandat('recapitulatif', b, mandats)));
    upsert('mandats', r.mandat);
    onEnregistre?.(r.mandat);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, creer);
  // Base vide, ou propriétaire sans logement : un mandat lie un propriétaire à un logement.
  const manque =
    ecran === 'proprietaire' && !proprietaires.length
      ? 'proprietaire'
      : ecran === 'logement' && !logements.length
        ? 'logement'
        : ecran === 'logement' && !logementsDispo.length
          ? 'logementDuProprietaire'
          : undefined;
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Nouveau mandat"
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le mandat')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={!!manque}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce mandat${NBSP}?`}
      onFermer={onFermer}
    >
      {ecran === 'signe' && (
        <ChoixCourts
          options={OUI_NON}
          valeur={b.signe ? 'oui' : 'non'}
          onChange={(v) => maj({ signe: v === 'oui' })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('signe')}
          className="grid-cols-2"
        />
      )}
      {ecran === 'proprietaire' &&
        (manque ? (
          <Prerequis manque="Vous n’avez pas encore de propriétaire." detail="Un mandat lie un propriétaire à un logement." lien="/erp/proprietaires?nouveau=1" action="Nouveau propriétaire" />
        ) : (
          <ChoixListe
            options={[...proprietaires].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')).map((x) => ({ valeur: x.id, libelle: x.nom }))}
            valeur={b.proprietaireId || undefined}
            // Un autre propriétaire : le logement choisi ne vaut plus.
            onChange={(proprietaireId) => maj({ proprietaireId, logementId: proprietaireId === b.proprietaireId ? b.logementId : '' })}
            onContinuer={continuer}
            labelledBy={titreId}
            idPremier={idChamp('proprietaireId')}
          />
        ))}
      {ecran === 'logement' &&
        (manque === 'logement' ? (
          <Prerequis manque="Vous n’avez pas encore de logement." detail="Ajoutez le logement confié avant de créer son mandat." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
        ) : manque === 'logementDuProprietaire' ? (
          <Prerequis
            manque="Ce propriétaire n’a pas encore de logement."
            detail={`Attribuez-lui d’abord le sien, depuis Paramètres${NBSP}→${NBSP}Accès.`}
            lien="/erp/parametres/acces"
            action="Ouvrir Accès"
          />
        ) : (
          <ChoixListe
            options={logementsDispo.map((l) => ({ valeur: l.id, libelle: l.nom, detail: l.ville }))}
            valeur={b.logementId || undefined}
            onChange={(logementId) => maj({ logementId })}
            onContinuer={continuer}
            labelledBy={titreId}
            idPremier={idChamp('logementId')}
          />
        ))}
      {ecran === 'commission' && (
        <>
          <Field label="Commission (%)" erreur={etat.erreurChamp('commissionPct')}>
            <Input
              id={idChamp('commissionPct')}
              inputMode="decimal"
              value={b.commissionPct}
              onChange={(e) => maj({ commissionPct: e.target.value })}
              onBlur={() => p.quitter('commissionPct')}
              autoComplete="off"
              className={cn(CHAMP_ASSISTANT, 'sm:max-w-40')}
            />
          </Field>
          {pct > 0 && pct < COMMISSION_CIBLE_MIN && (
            // La cible est déjà dans l'aide de l'écran : l'alerte ne la répète pas.
            <Alert tone="alerte" titre="Commission sous la cible" className="mt-4">
              Un taux inférieur doit rester exceptionnel.
            </Alert>
          )}
        </>
      )}
      {ecran === 'menage' && (
        <Field label="Frais de ménage" erreur={etat.erreurChamp('fraisMenage')}>
          <InputEuros id={idChamp('fraisMenage')} value={b.fraisMenage} onChange={(e) => maj({ fraisMenage: e.target.value })} onBlur={() => p.quitter('fraisMenage')} className="sm:max-w-48" />
        </Field>
      )}
      {ecran === 'dates' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Début" erreur={etat.erreurChamp('dateDebut')}>
            <Input id={idChamp('dateDebut')} type="date" value={b.dateDebut} onChange={(e) => maj({ dateDebut: e.target.value })} onBlur={() => p.quitter('dateDebut')} className={CHAMP_ASSISTANT} />
          </Field>
          <Field label="Fin de la période d’essai" aide="Facultatif." erreur={etat.erreurChamp('periodeEssaiFin')}>
            <Input
              id={idChamp('periodeEssaiFin')}
              type="date"
              value={b.periodeEssaiFin}
              onChange={(e) => maj({ periodeEssaiFin: e.target.value })}
              onBlur={() => p.quitter('periodeEssaiFin')}
              className={CHAMP_ASSISTANT}
            />
          </Field>
        </div>
      )}
      {ecran === 'preavis' && (
        <Field label="Préavis (jours)" erreur={etat.erreurChamp('preavisJours')}>
          <Input
            id={idChamp('preavisJours')}
            inputMode="numeric"
            value={b.preavisJours}
            onChange={(e) => maj({ preavisJours: e.target.value })}
            onBlur={() => p.quitter('preavisJours')}
            autoComplete="off"
            className={cn(CHAMP_ASSISTANT, 'sm:max-w-40')}
          />
        </Field>
      )}
      {ecran === 'recapitulatif' && (
        // Propriétaire et logement venus de la fiche : leurs lignes restent, sans « Modifier » (pas d'écran pour les changer).
        <RecapAssistant
          lignes={recapMandat(b, { proposerSigne, nomProprietaire, nomLogement, jour, euros }).map((l) => ({ ...l, onModifier: ecrans.includes(l.ecran) ? () => p.modifier(l.ecran) : undefined }))}
        />
      )}
    </Assistant>
  );
}

/* ------------------------------------------------------------ modification */

function ModificationMandat({ ouvert, onFermer, mandat, preselection, onEnregistre }: Props) {
  const { proprietaires, logements, mandats, upsert } = useErp();
  const vierge = (): Saisie => ({
    proprietaireId: mandat?.proprietaireId ?? preselection?.proprietaireId ?? '',
    logementId: mandat?.logementId ?? preselection?.logementId ?? '',
    commissionPct: String(mandat?.commissionPct ?? COMMISSION_CIBLE_MIN),
    fraisMenage: mandat ? String(mandat.fraisMenageCentimes / 100).replace('.', ',') : '45',
    dateDebut: mandat?.dateDebut ?? preselection?.dateDebut ?? ajouterJours(AUJOURDHUI, 14),
    periodeEssaiFin: mandat?.periodeEssaiFin ?? ajouterJours(preselection?.dateDebut ?? ajouterJours(AUJOURDHUI, 14), 92),
    preavisJours: String(mandat?.preavisJours ?? 90),
  });
  const [s, setS] = useState<Saisie>(vierge);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Saisie, string>>>({});
  const proposerSigne = !mandat && preselection?.dejaSigne !== undefined;
  const [signe, setSigne] = useState(!!preselection?.dejaSigne);

  useEffect(() => {
    if (ouvert) {
      setS(vierge());
      setErreurs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, mandat?.id]);

  const maj = (k: keyof Saisie, v: string) => setS((x) => ({ ...x, [k]: v }));
  const logementsDispo = logements.filter((l) => !s.proprietaireId || l.proprietaireId === s.proprietaireId);
  const pct = Number(s.commissionPct.replace(',', '.'));

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    const err: Partial<Record<keyof Saisie, string>> = {};
    if (!s.proprietaireId) err.proprietaireId = 'Choisissez le propriétaire.';
    if (!s.logementId) err.logementId = 'Choisissez le logement.';
    if (!(pct > 0 && pct <= 50)) err.commissionPct = 'Pourcentage entre 0 et 50.';
    const frais = versCentimes(s.fraisMenage);
    if (!(frais >= 0)) err.fraisMenage = 'Montant en euros, ex. 45 ou 45,50.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.dateDebut)) err.dateDebut = 'Date obligatoire.';
    if (s.periodeEssaiFin && s.periodeEssaiFin <= s.dateDebut) err.periodeEssaiFin = 'Doit être après la date de début.';
    if (!/^\d+$/.test(s.preavisJours)) err.preavisJours = 'Nombre de jours.';
    const doublon = mandats.find(
      (m) => m.logementId === s.logementId && m.proprietaireId === s.proprietaireId && m.id !== mandat?.id && (m.statut === 'signe' || m.statut === 'envoye'),
    );
    if (!mandat && doublon) err.logementId = `Ce logement a déjà un mandat en cours (${doublon.reference}).`;
    setErreurs(err);
    if (Object.keys(err).length) return;

    const suivant: Mandat = {
      ...(mandat ??
        (proposerSigne && signe
          ? { id: nouvelId('man'), reference: prochaineReference(mandats, AUJOURDHUI), statut: 'signe' as const, signeLe: s.dateDebut, documentUrl: undefined }
          : { id: nouvelId('man'), reference: prochaineReference(mandats, AUJOURDHUI), statut: 'brouillon' as const, documentUrl: undefined })),
      proprietaireId: s.proprietaireId,
      logementId: s.logementId,
      commissionPct: pct,
      fraisMenageCentimes: frais,
      dateDebut: s.dateDebut,
      periodeEssaiFin: s.periodeEssaiFin || undefined,
      preavisJours: Number(s.preavisJours),
    };
    upsert('mandats', suivant);
    onEnregistre?.(suivant);
    onFermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={mandat ? `Modifier ${mandat.reference}` : 'Nouveau mandat'}
      description={
        mandat
          ? undefined
          : proposerSigne && signe
            ? 'Mandat déjà signé : il s’applique dès la date de début.'
            : 'Créé en brouillon. Il devra être envoyé puis signé avant toute activation du logement.'
      }
      pied={
        <>
          <Button onClick={onFermer}>Annuler</Button>
          <Button variant="primary" type="submit" form="form-mandat">
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="form-mandat" onSubmit={enregistrer} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* En tête : il change le sens de l'enregistrement (signé tout de suite ou brouillon). */}
        {proposerSigne && (
          <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <span className="text-[13.5px] text-(--lm-encre)">Mandat déjà signé</span>
            <Interrupteur actif={signe} label="Mandat déjà signé" onChange={setSigne} />
          </div>
        )}
        {!mandat && !proprietaires.length ? (
          <Prerequis className="sm:col-span-2" manque="Vous n’avez pas encore de propriétaire." detail="Un mandat lie un propriétaire à un logement." lien="/erp/proprietaires?nouveau=1" action="Nouveau propriétaire" />
        ) : !mandat && !logements.length ? (
          <Prerequis className="sm:col-span-2" manque="Vous n’avez pas encore de logement." detail="Ajoutez le logement confié avant de créer son mandat." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
        ) : null}
        <Field label="Propriétaire" requis erreur={erreurs.proprietaireId}>
          <Select
            value={s.proprietaireId}
            onChange={(e) => setS((x) => ({ ...x, proprietaireId: e.target.value, logementId: '' }))}
            placeholder="Choisir"
            options={proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
          />
        </Field>
        <Field label="Logement" requis erreur={erreurs.logementId}>
          <Select value={s.logementId} onChange={(e) => maj('logementId', e.target.value)} placeholder="Choisir" options={logementsDispo.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        </Field>
        <Field label="Commission (%)" requis erreur={erreurs.commissionPct} aide={`Cible : ${COMMISSION_CIBLE_MIN} à ${COMMISSION_CIBLE_MAX} %.`}>
          <Input value={s.commissionPct} onChange={(e) => maj('commissionPct', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Frais de ménage (€)" requis erreur={erreurs.fraisMenage} aide={Number.isFinite(versCentimes(s.fraisMenage)) ? `${euros(versCentimes(s.fraisMenage))} par séjour` : undefined}>
          <Input value={s.fraisMenage} onChange={(e) => maj('fraisMenage', e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Date de début" requis erreur={erreurs.dateDebut}>
          <Input type="date" value={s.dateDebut} onChange={(e) => maj('dateDebut', e.target.value)} />
        </Field>
        <Field label="Fin de période d’essai" erreur={erreurs.periodeEssaiFin}>
          <Input type="date" value={s.periodeEssaiFin} onChange={(e) => maj('periodeEssaiFin', e.target.value)} />
        </Field>
        <Field label="Préavis (jours)" requis erreur={erreurs.preavisJours}>
          <Input value={s.preavisJours} onChange={(e) => maj('preavisJours', e.target.value)} inputMode="numeric" />
        </Field>
        {pct > 0 && pct < COMMISSION_CIBLE_MIN && (
          <Alert tone="alerte" titre="Commission sous la cible" className="sm:col-span-2">
            Les nouveaux mandats se signent entre {COMMISSION_CIBLE_MIN} et {COMMISSION_CIBLE_MAX} %. Un taux inférieur doit rester exceptionnel.
          </Alert>
        )}
      </form>
    </Modal>
  );
}
