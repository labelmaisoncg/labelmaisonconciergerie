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
  const vide = d.reservations.length === 0;
  const date = format(parseISO(AUJOURDHUI), 'EEEE d MMMM', { locale: fr });
  const heure = new Date().getHours();
  const salut = heure >= 18 ? 'Bonsoir' : 'Bonjour';

  return (
    <>
      <PageHeader
        titre={`${salut} ${d.utilisateur.nom.split(' ')[0]}`}
        sousTitre={date.charAt(0).toUpperCase() + date.slice(1)}
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

      {/* Base encore vide : seule la carte Démarrage parle (un seul état vide, une seule action). */}
      {!vide && <Aujourdhui />}

      {(!vide || elements.length > 0) && (
        <div id="a-faire" className="mb-6 scroll-mt-20">
          <ATraiter elements={elements} />
        </div>
      )}

      {!vide && <VosChiffres />}

      <Drawer
        ouvert={semaine}
        onFermer={() => setSemaine(false)}
        titre="Les 7 prochains jours"
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
