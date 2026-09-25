import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarRange, Target } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI } from '../../data/format';
import { ButtonLink, Drawer, MenuActions, PageHeader } from '../../ui';
import { Agenda } from './_composants/Agenda';
import { ATraiter } from './_composants/ATraiter';
import { Aujourdhui } from './_composants/Aujourdhui';
import { Demarrage } from './_composants/Demarrage';
import { VosChiffres } from './_composants/VosChiffres';
import { construireATraiter } from './_composants/aTraiter';

/**
 * Accueil : un bonjour, la journée en un coup d'œil, ce qui vous attend et
 * quatre chiffres. Le détail est à un clic (panneaux, pages de rubrique).
 */
export default function TableauDeBord() {
  const d = useErp();
  const [semaine, setSemaine] = useState(false);
  const elements = useMemo(() => construireATraiter(d.donnees), [d.donnees]);
  const urgentes = elements.filter((e) => e.priorite === 1).length;
  const date = format(parseISO(AUJOURDHUI), 'EEEE d MMMM', { locale: fr });
  const heure = new Date().getHours();
  const salut = heure >= 18 ? 'Bonsoir' : 'Bonjour';

  return (
    <>
      <PageHeader
        titre={`${salut} ${d.utilisateur.nom.split(' ')[0]}`}
        sousTitre={
          <>
            Nous sommes {date}.{' '}
            {urgentes ? `${urgentes} sujet${urgentes > 1 ? 's' : ''} à regarder aujourd’hui.` : elements.length ? 'Rien d’urgent aujourd’hui.' : 'Tout est à jour, belle journée !'}
          </>
        }
        actions={
          <MenuActions
            texte
            label="Plus"
            actions={[
              { libelle: 'Les 7 prochains jours', icone: <CalendarRange />, onClick: () => setSemaine(true) },
              { libelle: 'Prospection et propriétaires à rappeler', icone: <Target />, to: '/erp/commercial' },
            ]}
          />
        }
      />

      <Demarrage />

      <Aujourdhui alertes={elements.length} urgentes={urgentes} />

      <div id="a-faire" className="mb-6 scroll-mt-20">
        <ATraiter elements={elements} />
      </div>

      <VosChiffres />

      <Drawer
        ouvert={semaine}
        onFermer={() => setSemaine(false)}
        titre="Les 7 prochains jours"
        sousTitre="Arrivées, départs et ménages, jour par jour."
        pied={
          <ButtonLink to="/erp/reservations" variant="secondary">
            Voir le planning complet
          </ButtonLink>
        }
      >
        <div className="-mx-4 -my-4 sm:-mx-5">
          <Agenda />
        </div>
      </Drawer>
    </>
  );
}
