import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlarmClock, CalendarCheck, ClipboardCheck } from 'lucide-react';
import { AUJOURDHUI, nombre, pourcentage } from '../../data/format';
import { useErp } from '../../data/store';
import { fenetreJours, missionsAAttribuerSous, missionsAControler, missionsDuJour, nbMenagesPasses, tauxMissionsValideesAvecPhotos } from '../../data/selectors';
import type { Mission } from '../../data/types';
import { PageHeader, Stat, Tabs } from '../../ui';
import { ATraiter } from './_composants/ATraiter';
import { AttribuerModal } from './_composants/AttribuerModal';
import { Controle } from './_composants/Controle';
import { Planning } from './_composants/Planning';
import { RefuserModal } from './_composants/RefuserModal';
import { Retour, useRetour } from './_composants/retour';
import { Toutes } from './_composants/Toutes';

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
  const passees30 = nbMenagesPasses(d.missions, fenetreJours(30));
  const nbControles = missionsAControler(d.missions, d.reservations).filter((m) => m.noteControle === undefined).length;

  const valider = (m: Mission) => traiter(d.validerMission(m.id), 'Ménage vérifié : il sera payé avec le prochain versement du prestataire.', 'Ce ménage ne peut pas encore être vérifié');
  const succes = (texte: string) => setMessage({ ton: 'succes', texte });

  return (
    <>
      <PageHeader
        titre="Ménages"
        sousTitre="Chaque départ de voyageur prévoit un ménage. Il est payé une fois vérifié : liste cochée et photos avant/après."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Aujourd’hui" valeur={nombre(duJour)} icone={<CalendarCheck />} aide={duJour ? 'ménages et interventions prévus' : 'rien de prévu aujourd’hui'} />
        <Stat
          label="Sans personne (48 h)"
          valeur={nombre(urgentes)}
          icone={<AlarmClock />}
          tone={urgentes ? 'danger' : 'neutre'}
          aide={urgentes ? 'à confier vite à quelqu’un' : nbAAttribuer ? `${nbAAttribuer} plus tard, sans personne encore` : 'tout le monde sait où aller'}
        />
        <Stat
          label="À vérifier"
          valeur={nombre(nbAValider)}
          icone={<ClipboardCheck />}
          tone={nbAValider ? 'alerte' : 'neutre'}
          aide={passees30 ? `${pourcentage(taux)} vérifiés avec photos sur 30 jours` : 'pas de ménage ces 30 derniers jours'}
        />
      </div>

      <Tabs
        label="Vues des missions"
        actif={vue}
        onChange={(cle) => setParams(cle === 'planning' ? {} : { vue: cle }, { replace: true })}
        onglets={[
          { cle: 'planning', libelle: 'Planning' },
          { cle: 'a-traiter', libelle: 'À faire', compteur: nbAAttribuer + nbAValider },
          { cle: 'toutes', libelle: 'Toutes' },
          { cle: 'controle', libelle: 'Contrôles surprise', compteur: nbControles },
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
