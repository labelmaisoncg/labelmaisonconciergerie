import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useErp } from '../../data/store';
import { AUJOURDHUI } from '../../data/format';
import { PageHeader } from '../../ui';
import { ATraiter } from './_composants/ATraiter';
import { Aujourdhui } from './_composants/Aujourdhui';
import { Courbes } from './_composants/Courbes';
import { Demarrage } from './_composants/Demarrage';
import { Indicateurs } from './_composants/Indicateurs';
import { AVenir } from './_composants/AVenir';
import { AnnoncesEquipe } from './_composants/AnnoncesEquipe';
import { Briefing } from './_composants/Briefing';
import { CarteDuJour } from './_composants/CarteDuJour';
import { construireATraiter } from './_composants/aTraiter';
import { PropositionInstallation } from '../parametres/_application/PropositionInstallation';

/**
 * Accueil du channel manager, dans l'ordre où l'on s'en sert : les annonces
 * du gérant à l'équipe (jusqu'à « J'ai lu »), la mise en service (et, sur
 * téléphone, l'installation de l'app), « Votre journée » (le briefing du
 * matin : la journée, puis ce qui attend une action, en un seul bloc), la
 * carte des logements (réservé, libre, ménage, problème : ce qui se passe
 * aujourd'hui), les arrivées et départs de la semaine (ou d'une période
 * choisie), quatre
 * repères sur 30 jours, puis deux courbes. Le détail est à un clic (pages
 * de rubrique, panneaux).
 */
export default function TableauDeBord() {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant';
  const elements = useMemo(() => construireATraiter(d.donnees, undefined, { gerant }), [d.donnees, gerant]);
  const vide = d.reservations.length === 0;
  const date = format(parseISO(AUJOURDHUI), 'EEEE d MMMM', { locale: fr });
  const heure = new Date().getHours();
  const salut = heure >= 18 ? 'Bonsoir' : 'Bonjour';

  return (
    <>
      <PageHeader
        titre={`${salut} ${d.utilisateur.nom.split(' ')[0]}`}
        sousTitre={date.charAt(0).toUpperCase() + date.slice(1)}
      />

      <AnnoncesEquipe />
      <Demarrage />
      <PropositionInstallation />

      {/*
        Votre journée : la journée et ce qui attend, en un seul bloc (il remplace « À faire »
        et les tuiles du jour). Base encore vide : seule la carte Démarrage parle, avec
        « À faire » s'il y a déjà quelque chose (un contact à appeler…).
      */}
      {(!vide || elements.length > 0) && (
        <div id="a-faire" className="mb-6 scroll-mt-20">
          {vide ? <ATraiter elements={elements} /> : <Briefing elements={elements} />}
        </div>
      )}

      {!vide && (
        <>
          <CarteDuJour />
          <Aujourdhui />
          <Indicateurs />
          <AVenir />
          <Courbes />
        </>
      )}

    </>
  );
}
