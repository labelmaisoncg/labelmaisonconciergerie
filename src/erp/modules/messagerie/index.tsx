/**
 * Messagerie agentique (/erp/messagerie) : les conversations voyageurs
 * (Airbnb, Booking, direct), ce que l'agent a fait, et ses réglages.
 *
 * - /erp/messagerie            Conversations (bureau : liste + conversation + contexte)
 * - /erp/messagerie/:filId     une conversation (mobile : plein écran)
 * - /erp/messagerie/activite   Ce que l'agent a fait
 * - /erp/messagerie/agent      Configurer mon agent
 */
import { useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { EmptyState, PageHeader, Tabs, cn, useRechercheUrl } from '../../ui';
import { useErp } from '../../data/store';
import { reglagesAgent } from '../../data/reglages';
import { logementById, reservationById } from '../../data/selectors';
import { Activite } from './_composants/Activite';
import { Configurer } from './_composants/Configurer';
import { Conversation } from './_composants/Conversation';
import { ListeFils } from './_composants/ListeFils';
import { PanneauContexte } from './_composants/PanneauContexte';
import { correspond, enAttenteHumain, type FiltreFil } from './_composants/logique';

type Onglet = 'conversations' | 'activite' | 'agent';

export default function ModuleMessagerie() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const d = useErp();
  const reglages = reglagesAgent(d);
  const segment = pathname.replace(/^\/erp\/messagerie\/?/, '').split('/')[0] ?? '';
  const onglet: Onglet = segment === 'activite' ? 'activite' : segment === 'agent' ? 'agent' : 'conversations';
  // Sur mobile, une conversation ouverte prend tout l'écran.
  const filOuvert = onglet === 'conversations' && !!segment;
  const attente = enAttenteHumain(d.filsMessages).length;

  return (
    <>
      <div className={cn(filOuvert && 'max-lg:hidden')}>
        <PageHeader
          titre="Messagerie agentique"
          sousTitre="Votre agent répond aux voyageurs à votre place et vous passe la main quand il le faut."
          actions={
            <Link
              to="/erp/messagerie/agent"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-(--lm-bord) bg-(--lm-surface) px-3.5 text-[13px] font-medium text-(--lm-encre) hover:border-(--lm-or-anneau)"
            >
              <span aria-hidden className={cn('size-2 rounded-full', reglages.actif ? 'bg-(--lm-succes)' : 'bg-(--lm-alerte)')} />
              {reglages.actif ? 'Votre agent est actif' : 'Votre agent est en pause'}
            </Link>
          }
        />
        <Tabs
          label="Sections de la messagerie"
          actif={onglet}
          onChange={(c) => navigate(c === 'conversations' ? '/erp/messagerie' : `/erp/messagerie/${c}`)}
          onglets={[
            { cle: 'conversations', libelle: 'Conversations', compteur: attente || undefined },
            { cle: 'activite', libelle: 'Ce que l’agent a fait' },
            { cle: 'agent', libelle: 'Configurer mon agent' },
          ]}
        />
      </div>
      <Routes>
        <Route index element={<Boite />} />
        <Route path="activite" element={<Activite />} />
        <Route path="agent" element={<Configurer />} />
        <Route path=":filId" element={<Boite />} />
      </Routes>
    </>
  );
}

function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function Boite() {
  const { filId } = useParams();
  const d = useErp();
  const [filtre, setFiltre] = useState<FiltreFil>(() => (enAttenteHumain(d.filsMessages).length ? 'a_traiter' : 'tous'));
  const [recherche, setRecherche] = useRechercheUrl();
  const logements = useMemo(() => new Map(d.logements.map((l) => [l.id, l])), [d.logements]);

  const tries = useMemo(() => [...d.filsMessages].sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe)), [d.filsMessages]);
  const visibles = useMemo(() => {
    const q = normaliser(recherche.trim());
    return tries.filter(
      (f) =>
        (q ? true : correspond(f, filtre)) &&
        (!q ||
          normaliser(f.voyageur).includes(q) ||
          normaliser(logements.get(f.logementId)?.nom ?? '').includes(q) ||
          f.messages.some((m) => normaliser(m.texte).includes(q))),
    );
  }, [tries, filtre, recherche, logements]);

  const fil = filId ? d.filsMessages.find((f) => f.id === filId) : undefined;
  const logement = fil ? logementById(d, fil.logementId) : undefined;
  const reservation = fil ? reservationById(d, fil.reservationId) : undefined;

  return (
    <>
      <div className="grid overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre) lg:h-[calc(100vh-250px)] lg:min-h-[540px] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[310px_minmax(0,1fr)_280px]">
        <aside className={cn('min-h-0 border-(--lm-bord) lg:border-r', fil ? 'max-lg:hidden' : 'max-lg:max-h-[75vh]')} aria-label="Liste des conversations">
          <ListeFils
            fils={visibles}
            tous={d.filsMessages}
            logements={logements}
            actifId={fil?.id}
            filtre={filtre}
            onFiltre={setFiltre}
            recherche={recherche}
            onRecherche={setRecherche}
          />
        </aside>

        <section className={cn('min-h-0 min-w-0', !fil && 'max-lg:hidden', fil && 'max-lg:h-[calc(100dvh-120px)]')} aria-label="Conversation">
          {fil ? (
            <Conversation fil={fil} logement={logement} reservation={reservation} />
          ) : (
            <div className="grid h-full place-items-center p-6">
              {!filId && d.filsMessages.length === 0 ? (
                <EmptyState
                  icone={<MessagesSquare />}
                  titre="Pas encore de conversation"
                  description="Les messages de vos voyageurs arrivent ici tout seuls dès que vous avez connecté Airbnb ou Booking et choisi vos logements (bouton « Enregistrer mon choix »)."
                  action={
                    <Link to="/erp/logements/connexions" className="text-[13.5px] font-medium text-(--lm-or) hover:underline">
                      Connecter mes plateformes →
                    </Link>
                  }
                  className="border-none"
                />
              ) : (
                <EmptyState
                  icone={<MessagesSquare />}
                  titre={filId ? 'Cette conversation n’existe plus' : 'Choisissez une conversation'}
                  description={
                    filId
                      ? 'Elle a peut-être été supprimée. Choisissez-en une autre dans la liste.'
                      : 'Celles qui ont besoin de vous sont marquées dans la liste.'
                  }
                  className="border-none"
                />
              )}
            </div>
          )}
        </section>

        {fil && (
          <aside className="lm-defilement min-h-0 overflow-y-auto border-(--lm-bord) max-xl:hidden xl:border-l" aria-label="À propos du voyageur">
            <PanneauContexte fil={fil} logement={logement} reservation={reservation} />
          </aside>
        )}
      </div>

      {fil && (
        <details className="mt-4 rounded-xl border border-(--lm-bord) bg-(--lm-surface) xl:hidden">
          <summary className="cursor-pointer px-4 py-3 text-[13.5px] font-medium text-(--lm-encre)">Réservation, logement et codes d’accès</summary>
          <PanneauContexte fil={fil} logement={logement} reservation={reservation} />
        </details>
      )}
    </>
  );
}
