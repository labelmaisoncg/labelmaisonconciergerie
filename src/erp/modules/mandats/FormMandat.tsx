import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Modal, Select, Prerequis } from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { COMMISSION_CIBLE_MAX, COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { AUJOURDHUI, ajouterJours, euros, versCentimes } from '../../data/format';
import type { Mandat } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  mandat?: Mandat;
  /** Valeurs initiales en création (ex. depuis une fiche propriétaire). */
  preselection?: { proprietaireId?: string; logementId?: string };
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

function prochaineReference(mandats: Mandat[]): string {
  const annee = AUJOURDHUI.slice(0, 4);
  const max = mandats
    .map((m) => m.reference.match(new RegExp(`^LM-M-${annee}-(\\d+)$`))?.[1])
    .filter(Boolean)
    .reduce((a, n) => Math.max(a, Number(n)), 0);
  return `LM-M-${annee}-${String(max + 1).padStart(3, '0')}`;
}

export function FormMandat({ ouvert, onFermer, mandat, preselection, onEnregistre }: Props) {
  const { proprietaires, logements, mandats, upsert } = useErp();
  const vierge = (): Saisie => ({
    proprietaireId: mandat?.proprietaireId ?? preselection?.proprietaireId ?? '',
    logementId: mandat?.logementId ?? preselection?.logementId ?? '',
    commissionPct: String(mandat?.commissionPct ?? COMMISSION_CIBLE_MIN),
    fraisMenage: mandat ? String(mandat.fraisMenageCentimes / 100).replace('.', ',') : '45',
    dateDebut: mandat?.dateDebut ?? ajouterJours(AUJOURDHUI, 14),
    periodeEssaiFin: mandat?.periodeEssaiFin ?? ajouterJours(AUJOURDHUI, 14 + 92),
    preavisJours: String(mandat?.preavisJours ?? 90),
  });
  const [s, setS] = useState<Saisie>(vierge);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Saisie, string>>>({});

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
      (m) => m.logementId === s.logementId && m.id !== mandat?.id && (m.statut === 'signe' || m.statut === 'envoye'),
    );
    if (!mandat && doublon) err.logementId = `Ce logement a déjà un mandat en cours (${doublon.reference}).`;
    setErreurs(err);
    if (Object.keys(err).length) return;

    const suivant: Mandat = {
      ...(mandat ?? { id: nouvelId('man'), reference: prochaineReference(mandats), statut: 'brouillon' as const, documentUrl: undefined }),
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
      description={mandat ? undefined : 'Créé en brouillon. Il devra être envoyé puis signé avant toute activation du logement.'}
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
