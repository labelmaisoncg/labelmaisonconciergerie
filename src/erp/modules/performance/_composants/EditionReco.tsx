import { useEffect, useState } from 'react';
import { dateCourte, euros, versCentimes } from '../../../data/format';
import { useErp } from '../../../data/store';
import type { RecommandationProprietaire, StatutRecommandation } from '../../../data/types';
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '../../../ui';
import { BadgeStatutReco } from './commun';
import { ETAPES, faireAvancer } from './suivi';
import { LIBELLES_STATUT_RECO } from '../../../analyse';

interface Props {
  reco?: RecommandationProprietaire;
  /** Statut visé à l'ouverture (ex. « réalisée » : on demande coût et résultat). */
  cible?: StatutRecommandation;
  onFermer: () => void;
}

/** Détail d'une recommandation : statut, coût, résultat observé. Tout passe par upsert (journalisé). */
export function EditionReco({ reco, cible, onFermer }: Props) {
  const { upsert, logements } = useErp();
  const [statut, setStatut] = useState<StatutRecommandation>('a_proposer');
  const [cout, setCout] = useState('');
  const [resultat, setResultat] = useState('');
  const [detail, setDetail] = useState('');
  const [erreur, setErreur] = useState<string>();

  useEffect(() => {
    if (!reco) return;
    setStatut(cible ?? reco.statut);
    setCout(reco.coutCentimes !== undefined ? String(reco.coutCentimes / 100).replace('.', ',') : '');
    setResultat(reco.resultatObserve ?? '');
    setDetail(reco.detail);
    setErreur(undefined);
  }, [reco, cible]);

  if (!reco) return null;
  const logement = logements.find((l) => l.id === reco.logementId);

  const enregistrer = () => {
    const centimes = cout.trim() ? versCentimes(cout) : undefined;
    if (centimes !== undefined && (Number.isNaN(centimes) || centimes < 0)) return setErreur('Coût illisible : saisissez un montant en euros, ex. 290 ou 290,50.');
    if (statut === 'realisee' && !resultat.trim()) return setErreur('Une amélioration réalisée doit avoir un résultat observé (même provisoire).');
    const base = statut === reco.statut ? reco : faireAvancer(reco, statut);
    upsert('recommandations', { ...base, coutCentimes: centimes, resultatObserve: resultat.trim() || undefined, detail: detail.trim() || reco.detail });
    onFermer();
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={reco.titre}
      description={`${logement?.nom ?? 'Logement'} · créée le ${dateCourte(reco.creeLe)}`}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>Annuler</Button>
          <Button variant="primary" onClick={enregistrer}>Enregistrer</Button>
        </>
      }
    >
      <div className="grid gap-4">
        {erreur && <Alert tone="danger">{erreur}</Alert>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-(--lm-encre-2)">
          <span className="inline-flex items-center gap-1.5">Actuel : <BadgeStatutReco valeur={reco.statut} /></span>
          {reco.proposeeLe && <span>Proposée le {dateCourte(reco.proposeeLe)}</span>}
          {reco.decideeLe && <span>Décidée le {dateCourte(reco.decideeLe)}</span>}
          {reco.realiseeLe && <span>Réalisée le {dateCourte(reco.realiseeLe)}</span>}
          {reco.impactEstimeCentimesMois !== undefined && <span>Impact estimé {euros(reco.impactEstimeCentimesMois, true)} / mois</span>}
        </div>
        <Field label="Statut" aide="Changer le statut date automatiquement l’étape (aujourd’hui).">
          <Select value={statut} onChange={(e) => setStatut(e.target.value as StatutRecommandation)} options={ETAPES.map((s) => ({ valeur: s, libelle: LIBELLES_STATUT_RECO[s] }))} />
        </Field>
        <Field label="Détail proposé au propriétaire">
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
        </Field>
        <Field label="Coût (euros)" aide="Devis ou coût réel, à la charge du porteur.">
          <Input inputMode="decimal" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="ex. 290" />
        </Field>
        <Field label="Résultat observé" aide="Effet constaté après réalisation : note, occupation, incidents, retour du propriétaire." requis={statut === 'realisee'}>
          <Textarea value={resultat} onChange={(e) => setResultat(e.target.value)} rows={3} />
        </Field>
      </div>
    </Modal>
  );
}
