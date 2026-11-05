/**
 * Demandes des propriétaires (/erp/logements/demandes), à côté de la liste
 * des logements et des avis : toutes les questions et demandes envoyées
 * depuis l'espace propriétaire, celles qui attendent une réponse d'abord.
 * Une demande s'ouvre dans un panneau (?demande=<id> : lien de la
 * notification, de « À faire » et de la fiche du propriétaire) ; « Tout voir »
 * depuis la fiche filtre sur lui (?proprietaire=<id>).
 *
 * Pourquoi dans Logements : depuis octobre 2026, le propriétaire se gère dans
 * cette rubrique (carte « Propriétaire » de la fiche logement ; l'ancienne
 * rubrique Propriétaires y mène), et « Avis » y est déjà la vue de tout le
 * parc. Le CRM suit les contacts à appeler avant qu'ils soient clients ; la
 * Messagerie, les voyageurs, que l'agent IA lit : une demande de propriétaire
 * n'a rien à y faire. Réservé au gérant, comme la notification.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { demandeATraiter, peutVoirDemandes } from '../../data/demandes-proprietaires';
import { useErp } from '../../data/store';
import type { DemandeProprietaire, StatutDemandeProprietaire } from '../../data/types';
import { Button, Card, EmptyState, FilterChips, PageHeader } from '../../ui';
import { DetailDemande, LigneDemande } from './_composants/DemandesProprietaires';
import { OngletsLogements } from './_composants/OngletsLogements';

type Filtre = 'a_traiter' | 'repondue' | 'reglee';

const RANG: Record<StatutDemandeProprietaire, number> = { envoyee: 0, vue: 1, repondue: 2, reglee: 3 };
const t = (h: string) => Date.parse(h) || 0;

/** Les nouvelles, puis les vues (les plus anciennes d'abord : elles attendent depuis longtemps), puis les autres (les plus récentes d'abord). */
function trier(a: DemandeProprietaire, b: DemandeProprietaire): number {
  if (RANG[a.statut] !== RANG[b.statut]) return RANG[a.statut] - RANG[b.statut];
  return demandeATraiter(a) ? t(a.creeLe) - t(b.creeLe) : t(b.majLe) - t(a.majLe);
}

const dans = (f: Filtre, x: DemandeProprietaire) => (f === 'a_traiter' ? demandeATraiter(x) : x.statut === f);

export default function DemandesParc() {
  const d = useErp();
  const [parametres, setParametres] = useSearchParams();
  const ouverte = parametres.get('demande') ?? undefined;
  const pour = parametres.get('proprietaire') ?? undefined;
  const [filtres, setFiltres] = useState<string[]>([]);
  const gerant = peutVoirDemandes(d.utilisateur.role);
  const proprietaire = pour ? d.proprietaires.find((p) => p.id === pour) : undefined;

  const toutes = useMemo(
    () => d.donnees.demandesProprietaires.filter((x) => !!x?.id && (!pour || x.proprietaireId === pour)).sort(trier),
    [d.donnees.demandesProprietaires, pour],
  );
  const filtre = filtres[0] as Filtre | undefined;
  const liste = filtre ? toutes.filter((x) => dans(filtre, x)) : toutes;

  const regler = (cle: 'demande' | 'proprietaire', valeur?: string) =>
    setParametres(
      (p) => {
        const n = new URLSearchParams(p);
        if (valeur) n.set(cle, valeur);
        else n.delete(cle);
        return n;
      },
      { replace: cle === 'proprietaire' },
    );

  return (
    <>
      <PageHeader titre="Logements" />
      <OngletsLogements />

      {!gerant ? (
        <EmptyState icone={<Inbox />} titre="Réservé au gérant" description="Les demandes des propriétaires arrivent chez le gérant de l’espace." />
      ) : (
        <>
          {(toutes.length > 0 || proprietaire) && (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {toutes.length > 0 ? (
                <FilterChips
                  unique
                  label="Filtrer les demandes"
                  filtres={[
                    { cle: 'a_traiter', libelle: 'À traiter', compteur: toutes.filter((x) => dans('a_traiter', x)).length },
                    { cle: 'repondue', libelle: 'Répondues', compteur: toutes.filter((x) => dans('repondue', x)).length },
                    { cle: 'reglee', libelle: 'Réglées', compteur: toutes.filter((x) => dans('reglee', x)).length },
                  ]}
                  actifs={filtres}
                  onChange={setFiltres}
                />
              ) : (
                <span aria-hidden />
              )}
              {proprietaire && (
                <p className="text-[13.5px] text-(--lm-encre-2)">
                  Demandes de {proprietaire.nom} ·{' '}
                  <button type="button" onClick={() => regler('proprietaire')} className="inline-flex min-h-8 max-sm:min-h-11 items-center font-medium lm-lien">
                    Tout afficher
                  </button>
                </p>
              )}
            </div>
          )}

          {toutes.length === 0 ? (
            <EmptyState
              icone={<Inbox />}
              titre="Aucune demande pour l’instant"
              description="Les propriétaires vous écrivent depuis leur espace : vous êtes prévenu, et leurs demandes arrivent ici."
            />
          ) : liste.length === 0 ? (
            <EmptyState titre="Aucune demande ne correspond" action={<Button onClick={() => setFiltres([])}>Tout afficher</Button>} />
          ) : (
            <Card flush>
              <ul className="divide-y divide-(--lm-bord)">
                {liste.map((x) => (
                  <li key={x.id}>
                    <LigneDemande demande={x} onOuvrir={() => regler('demande', x.id)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {ouverte && <DetailDemande id={ouverte} onFermer={() => regler('demande')} />}
        </>
      )}
    </>
  );
}
