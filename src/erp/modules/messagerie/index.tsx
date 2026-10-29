/**
 * Messagerie (/erp/messagerie) : les conversations voyageurs
 * (Airbnb, Booking, direct), ce que l'agent a fait, et ses réglages.
 *
 * - /erp/messagerie            Conversations (bureau : liste + conversation ; séjour à droite sur grand écran)
 * - /erp/messagerie/:filId     une conversation (mobile : plein écran)
 * - /erp/messagerie/activite   Activité de l'agent
 * - /erp/messagerie/agent      Votre agent (état et réglages)
 * - /erp/messagerie/automatiques  Messages automatiques et leur historique
 */
import { useMemo, useState, type CSSProperties } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, Plug } from 'lucide-react';
import { ButtonLink, EmptyState, PageHeader, Tabs, cn, useRechercheUrl } from '../../ui';
import { useErp } from '../../data/store';
import { logementById, reservationById } from '../../data/selectors';
import { AUJOURDHUI } from '../../data/format';
import { langueFil, trierParUrgence, urgenceFil } from '../../data/messagerie-ia';
import { Activite } from './_composants/Activite';
import { Configurer } from './_composants/Configurer';
import { Conversation } from './_composants/Conversation';
import { PastilleAgent } from './_composants/EtatAgent';
import { ListeFils, type TriFil } from './_composants/ListeFils';
import { MessagesAutomatiques } from './_composants/MessagesAutomatiques';
import { PanneauContexte } from './_composants/PanneauContexte';
import { attendEquipe, correspond, type FiltreFil } from './_composants/logique';
import { useHauteurDisponible } from './_composants/useHauteurDisponible';

type Onglet = 'conversations' | 'activite' | 'agent' | 'automatiques';

export default function ModuleMessagerie() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const segment = pathname.replace(/^\/erp\/messagerie\/?/, '').split('/')[0] ?? '';
  const onglet: Onglet = segment === 'activite' || segment === 'agent' || segment === 'automatiques' ? segment : 'conversations';
  // Sur mobile, une conversation ouverte prend tout l'écran.
  const filOuvert = onglet === 'conversations' && !!segment;

  return (
    <>
      <div className={cn(filOuvert && 'max-lg:hidden')}>
        <PageHeader titre="Messagerie" actions={<PastilleAgent />} />
        <Tabs
          label="Sections de la messagerie"
          actif={onglet}
          onChange={(c) => navigate(c === 'conversations' ? '/erp/messagerie' : `/erp/messagerie/${c}`)}
          onglets={[
            // Le nombre de voyageurs en attente est sur le menu latéral et sur le filtre « À répondre ».
            { cle: 'conversations', libelle: 'Conversations' },
            { cle: 'activite', libelle: 'Activité' },
            { cle: 'agent', libelle: 'Votre agent' },
            { cle: 'automatiques', libelle: 'Messages automatiques' },
          ]}
        />
      </div>
      <Routes>
        <Route index element={<Boite />} />
        <Route path="activite" element={<Activite />} />
        <Route path="agent" element={<Configurer />} />
        <Route path="automatiques" element={<MessagesAutomatiques />} />
        <Route path=":filId" element={<Boite />} />
      </Routes>
    </>
  );
}

function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Boîte de réception. Ordinateur : un panneau à la hauteur de l'écran, la
 * liste à gauche et la conversation à droite (le séjour en 3ᵉ colonne à partir
 * de 1440 px). Mobile : la liste en pleine page, la conversation en plein écran.
 */
function Boite() {
  const { filId } = useParams();
  const d = useErp();
  const [filtre, setFiltre] = useState<FiltreFil>(() => (d.filsMessages.some(attendEquipe) ? 'a_traiter' : 'tous'));
  const [recherche, setRecherche] = useRechercheUrl();
  // 24 px : la marge du bas de page sur ordinateur.
  const [boite, hauteur] = useHauteurDisponible<HTMLDivElement>(24);
  const logements = useMemo(() => new Map(d.logements.map((l) => [l.id, l])), [d.logements]);

  const tries = useMemo(() => [...d.filsMessages].sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe)), [d.filsMessages]);
  // Tri de « À répondre » : urgence (dates du séjour, problème signalé, voyageur mécontent) et langue du voyageur.
  const tri = useMemo(() => {
    const reservations = new Map(d.reservations.map((r) => [r.id, r]));
    return new Map<string, TriFil>(
      d.filsMessages.map((f) => [
        f.id,
        { urgence: attendEquipe(f) ? urgenceFil(f, f.reservationId ? reservations.get(f.reservationId) : undefined, AUJOURDHUI) : { niveau: 0 }, langue: langueFil(f) },
      ]),
    );
  }, [d.filsMessages, d.reservations]);
  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    // « À répondre » : les plus urgentes d'abord, puis les plus récentes.
    if (!q && filtre === 'a_traiter') return trierParUrgence(tries.filter((f) => correspond(f, filtre)), (f) => tri.get(f.id)?.urgence.niveau ?? 0);
    // Une recherche porte sur toutes les conversations, quel que soit le filtre.
    return tries.filter(
      (f) =>
        (q ? true : correspond(f, filtre)) &&
        (!q ||
          normaliser(f.voyageur).includes(q) ||
          normaliser(logements.get(f.logementId)?.nom ?? '').includes(q) ||
          f.messages.some((m) => normaliser(m.texte).includes(q))),
    );
  }, [tries, filtre, recherche, logements, tri]);

  const fil = filId ? d.filsMessages.find((f) => f.id === filId) : undefined;
  const logement = fil ? logementById(d, fil.logementId) : undefined;
  const reservation = fil ? reservationById(d, fil.reservationId) : undefined;

  if (d.filsMessages.length === 0) {
    return (
      <EmptyState
        icone={<MessagesSquare />}
        titre="Pas encore de conversation"
        description="Les messages des voyageurs arrivent ici dès qu’une plateforme est connectée."
        action={
          <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
            Connecter mes plateformes
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div
      ref={boite}
      style={hauteur ? ({ '--hauteur-boite': `${hauteur}px` } as CSSProperties) : undefined}
      className={cn(
        'lg:grid lg:h-(--hauteur-boite) lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-(--lm-bord) lg:bg-(--lm-surface) lg:shadow-(--lm-ombre)',
        fil && 'min-[90rem]:grid-cols-[340px_minmax(0,1fr)_300px]',
      )}
    >
      <aside className={cn('min-h-0 lg:border-r lg:border-(--lm-bord)', filId && 'max-lg:hidden')} aria-label="Liste des conversations">
        <ListeFils
          fils={visibles}
          tous={d.filsMessages}
          logements={logements}
          actifId={fil?.id}
          filtre={filtre}
          onFiltre={setFiltre}
          recherche={recherche}
          onRecherche={setRecherche}
          tri={tri}
        />
      </aside>

      <section
        className={cn('min-h-0 min-w-0 bg-(--lm-surface)', filId ? 'max-lg:fixed max-lg:inset-0 max-lg:z-40' : 'max-lg:hidden')}
        aria-label="Conversation"
      >
        {fil ? (
          <Conversation key={fil.id} fil={fil} logement={logement} reservation={reservation} />
        ) : filId ? (
          <div className="flex h-full flex-col">
            <div className="flex h-14 shrink-0 items-center border-b border-(--lm-bord) px-2 lg:hidden">
              <Link to="/erp/messagerie" aria-label="Retour aux conversations" className="grid size-10 place-items-center rounded-full bg-(--lm-surface-2) text-(--lm-encre) hover:bg-(--lm-neutre-lavis)">
                <ArrowLeft className="size-5" />
              </Link>
            </div>
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState
                icone={<MessagesSquare />}
                titre="Cette conversation n’existe plus"
                action={<ButtonLink to="/erp/messagerie">Voir les conversations</ButtonLink>}
                className="border-none"
              />
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center p-6">
            <EmptyState icone={<MessagesSquare />} titre="Choisissez une conversation" className="border-none" />
          </div>
        )}
      </section>

      {fil && (
        <aside className="lm-defilement hidden min-h-0 overflow-y-auto border-l border-(--lm-bord) min-[90rem]:block" aria-label="Séjour et logement">
          <PanneauContexte fil={fil} logement={logement} reservation={reservation} />
        </aside>
      )}
    </div>
  );
}
