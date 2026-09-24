import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, CalendarCheck, Camera, ClipboardCheck, Timer } from 'lucide-react';
import { AUJOURDHUI, nombre, pourcentage } from '../../data/format';
import { useErp } from '../../data/store';
import { fenetreJours, missionsAAttribuerSous, missionsAControler, missionsDuJour, tauxMissionsValideesAvecPhotos } from '../../data/selectors';
import type { Mission } from '../../data/types';
import { PageHeader, Stat, Tabs } from '../../ui';
import { ATraiter } from './_composants/ATraiter';
import { AttribuerModal } from './_composants/AttribuerModal';
import { Controle } from './_composants/Controle';
import { Planning } from './_composants/Planning';
import { RefuserModal } from './_composants/RefuserModal';
import { Retour, useRetour } from './_composants/retour';
import { Toutes } from './_composants/Toutes';
import { delaiMoyenValidation } from './_composants/outils';

const VUES = ['planning', 'a-traiter', 'toutes', 'controle'] as const;
type Vue = (typeof VUES)[number];

export function Liste() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const vue: Vue = (VUES as readonly string[]).includes(params.get('vue') ?? '') ? (params.get('vue') as Vue) : 'planning';
  const [aAttribuer, setAAttribuer] = useState<Mission | null>(null);
  const [aRefuser, setARefuser] = useState<Mission | null>(null);
  const { message, setMessage, traiter, fermer } = useRetour();

  const duJour = missionsDuJour(d.missions, AUJOURDHUI).length;
  const urgentes = missionsAAttribuerSous(d.missions, 48).length;
  const nbAValider = d.missions.filter((m) => m.statut === 'a_valider').length;
  const nbAAttribuer = d.missions.filter((m) => m.statut === 'a_attribuer').length;
  const taux = tauxMissionsValideesAvecPhotos(d.missions, fenetreJours(30));
  const delai = delaiMoyenValidation(d.missions, d.journal);
  const nbControles = missionsAControler(d.missions, d.reservations).filter((m) => m.noteControle === undefined).length;

  const valider = (m: Mission) => traiter(d.validerMission(m.id), 'Mission validée : elle entre dans le prochain paiement du prestataire.', 'Pas de validation, pas de paiement (règle 2.4)');
  const succes = (texte: string) => setMessage({ ton: 'succes', texte });

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Opérations' }, { libelle: 'Ménages' }]}
        titre="Ménages et interventions"
        sousTitre="Chaque départ crée une mission. Elle n’est validée, donc payée, qu’avec la checklist cochée et les photos avant/après horodatées."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Missions du jour" valeur={nombre(duJour)} icone={<CalendarCheck />} />
        <Stat label="À attribuer sous 48 h" valeur={nombre(urgentes)} icone={<AlarmClock />} tone={urgentes ? 'danger' : 'neutre'} aide={`${nbAAttribuer} au total`} />
        <Stat label="À valider" valeur={nombre(nbAValider)} icone={<ClipboardCheck />} tone={nbAValider ? 'alerte' : 'neutre'} />
        <Stat label="Validées avec photos (30 j)" valeur={pourcentage(taux)} icone={<Camera />} tone={taux < 0.9 ? 'alerte' : 'succes'} aide="Objectif 100 %" />
        <Stat
          label={delai.source === 'journal' ? 'Délai moyen de validation' : 'Attente moyenne de validation'}
          valeur={delai.heures === undefined ? '-' : `${nombre(delai.heures, 1)} h`}
          icone={<Timer />}
          aide={
            delai.source === 'journal'
              ? `Sur ${delai.echantillon} validation${delai.echantillon > 1 ? 's' : ''} tracée${delai.echantillon > 1 ? 's' : ''}`
              : `Attente actuelle, ${delai.echantillon} mission${delai.echantillon > 1 ? 's' : ''} à valider`
          }
          tone={delai.heures !== undefined && delai.heures > 24 ? 'alerte' : 'neutre'}
          className="col-span-2 md:col-span-1"
        />
      </div>

      <Tabs
        label="Vues des missions"
        actif={vue}
        onChange={(cle) => setParams(cle === 'planning' ? {} : { vue: cle }, { replace: true })}
        onglets={[
          { cle: 'planning', libelle: 'Planning' },
          { cle: 'a-traiter', libelle: 'À traiter', compteur: nbAAttribuer + nbAValider },
          { cle: 'toutes', libelle: 'Toutes' },
          { cle: 'controle', libelle: 'Contrôle qualité', compteur: nbControles },
        ]}
      />

      <Retour message={message} onFermer={fermer} />

      {vue === 'planning' && <Planning />}
      {vue === 'a-traiter' && <ATraiter onAttribuer={setAAttribuer} onValider={valider} onRefuser={setARefuser} />}
      {vue === 'toutes' && <Toutes />}
      {vue === 'controle' && <Controle onMessage={succes} />}

      <AttribuerModal mission={aAttribuer} onFermer={() => setAAttribuer(null)} onSucces={succes} />
      <RefuserModal mission={aRefuser} onFermer={() => setARefuser(null)} onSucces={(t) => setMessage({ ton: 'info', texte: t })} />
    </>
  );
}
