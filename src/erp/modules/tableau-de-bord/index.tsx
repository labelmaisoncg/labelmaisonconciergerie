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
import { construireATraiter } from './_composants/aTraiter';
import { PropositionInstallation } from '../parametres/_application/PropositionInstallation';

/**
 * Accueil du channel manager, dans l'ordre où l'on s'en sert : la mise en
 * service (et, sur téléphone, l'installation de l'app), ce qui attend une
 * action, les arrivées et départs, quatre repères sur 30 jours, puis deux
 * courbes. Le détail est à un clic (pages de rubrique, panneaux).
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

      <Demarrage />
      <PropositionInstallation />

      {/* Rien à faire : pas de carte « tout est à jour », la page commence par les arrivées. */}
      {elements.length > 0 && (
        <div id="a-faire" className="mb-6 scroll-mt-20">
          <ATraiter elements={elements} />
        </div>
      )}

      {/* Base encore vide : seule la carte Démarrage parle (un seul état vide, une seule action). */}
      {!vide && (
        <>
          <Aujourdhui />
          <Indicateurs />
          <Courbes />
        </>
      )}

    </>
  );
}
