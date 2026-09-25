import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, Play, Zap } from 'lucide-react';
import { executerAutomatisations, LIBELLES_DOMAINES, ORDRE_DOMAINES, REGLES, type ResultatMoteur } from '../../automatisations';
import { ajouterJours, AUJOURDHUI, horodatageMaintenant, MAINTENANT, nombre } from '../../data/format';
import { useErp } from '../../data/store';
import type { ElementDe, NomCollection } from '../../data/types';
import { Aide, Button, PageHeader, Section, Stat } from '../../ui';
import { CarteRegle } from './_composants/CarteRegle';
import { HumainSection } from './_composants/HumainSection';
import { JournalAuto } from './_composants/JournalAuto';
import { ResultatExecution } from './_composants/ResultatExecution';
import { useEtatAuto } from './_composants/useEtatAuto';

/** Minutes de travail manuel évitées par action automatique (estimation affichée). */
const MINUTES_PAR_ACTION = 5;

/** Module Automatisations : les règles qui font tourner l'ERP sans intervention. */
export default function Automatisations() {
  const { donnees, upsert } = useErp();
  const { etat, estActive, basculer, ajouterEvenements, viderJournal, clesActives } = useEtatAuto();
  const [resultat, setResultat] = useState<ResultatMoteur | null>(null);
  const [applique, setApplique] = useState(false);

  // Première visite : un passage à blanc pour remplir le journal (rien n'est modifié).
  const amorce = useRef(false);
  useEffect(() => {
    if (amorce.current || etat.evenements.length) return;
    amorce.current = true;
    ajouterEvenements(executerAutomatisations(donnees, { date: AUJOURDHUI, maintenant: MAINTENANT, reglesActives: clesActives }).evenements);
  }, [donnees, etat.evenements.length, ajouterEvenements, clesActives]);

  const lancer = () => {
    const r = executerAutomatisations(donnees, { date: AUJOURDHUI, maintenant: horodatageMaintenant(), reglesActives: clesActives });
    setResultat(r);
    setApplique(false);
    ajouterEvenements(r.evenements);
  };

  const appliquer = () => {
    if (!resultat) return;
    const vus = new Set<string>();
    for (const c of resultat.changements) {
      const cle = `${c.collection}:${c.id}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      const element = (resultat.donnees[c.collection] as { id: string }[]).find((e) => e.id === c.id);
      if (element) upsert(c.collection as NomCollection, element as ElementDe<NomCollection>);
    }
    setApplique(true);
  };

  const depuis = ajouterJours(AUJOURDHUI, -30);
  const recents = useMemo(() => etat.evenements.filter((e) => e.horodatage.slice(0, 10) >= depuis), [etat.evenements, depuis]);
  const compte = (cle: string) => recents.filter((e) => e.regle === cle).length;
  const actions = recents.filter((e) => e.niveau === 'action').length;
  const alertes = recents.filter((e) => e.niveau === 'alerte').length;
  const heures = Math.round((actions * MINUTES_PAR_ACTION) / 6) / 10;

  return (
    <>
      <PageHeader
        titre="Automatisations"
        sousTitre="Ce que l’ERP fait tout seul pour vous. Vous n’avez qu’à regarder les exceptions."
        actions={<Button variant="primary" icone={<Play />} onClick={lancer}>Vérifier maintenant</Button>}
      />

      <Aide titre="Que fait l’ERP tout seul ?">
        Il prévoit un ménage à chaque départ, le confie à un prestataire en règle, organise les contrôles, relance, prépare les paiements et les
        factures du mois. Il tourne à chaque changement et une fois par jour. Chaque règle peut être mise en pause ci-dessous.
      </Aide>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label="Fait tout seul (30 jours)"
          valeur={nombre(actions)}
          icone={<Zap />}
          tone="succes"
          aide={`${clesActives.length} règles sur ${REGLES.length} en marche`}
        />
        <Stat label="Exceptions à regarder" valeur={nombre(alertes)} icone={<AlertTriangle />} tone={alertes ? 'alerte' : 'succes'} aide="sur 30 jours" />
        <Stat label="Temps gagné" valeur={`≈ ${nombre(heures, 1)} h`} icone={<Clock />} aide={`en comptant ${MINUTES_PAR_ACTION} minutes par action`} />
      </div>

      {resultat && (
        <div className="mb-5">
          <ResultatExecution resultat={resultat} applique={applique} onAppliquer={appliquer} onFermer={() => setResultat(null)} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <div className="min-w-0 space-y-6">
          {ORDRE_DOMAINES.map((domaine) => {
            const regles = REGLES.filter((r) => r.domaine === domaine);
            if (!regles.length) return null;
            return (
              <Section key={domaine} titre={LIBELLES_DOMAINES[domaine]}>
                <div className="grid gap-3 md:grid-cols-2">
                  {regles.map((r) => (
                    <CarteRegle key={r.cle} regle={r} active={estActive(r.cle)} declenchements={compte(r.cle)} onBasculer={(v) => basculer(r.cle, v)} />
                  ))}
                </div>
              </Section>
            );
          })}
          <HumainSection />
        </div>
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <JournalAuto evenements={etat.evenements} onVider={viderJournal} />
        </div>
      </div>
    </>
  );
}
