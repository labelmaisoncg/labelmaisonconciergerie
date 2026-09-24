import { useState } from 'react';
import { Route, Routes, useSearchParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, FileText, TrendingUp, X } from 'lucide-react';
import { useErp } from '../../data/store';
import { moisAnnee, nombre, pluriel } from '../../data/format';
import { Alert, Button, EmptyState, PageHeader, Select, Stat, Tabs } from '../../ui';
import type { Issue } from './_composants/actions';
import { CarteAValider } from './_composants/CarteAValider';
import { HistoriqueLogement } from './_composants/Historique';
import { AIDE_EFFET, indicateurs, MOIS_COURANT, SEUIL_ANCIENNETE_JOURS, versionEnLigne } from './_composants/logique';

const ONGLETS = ['a-valider', 'historique'] as const;
type CleOnglet = (typeof ONGLETS)[number];

function PageAnnonces() {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const [retour, setRetour] = useState<Issue>();
  const filtre = params.get('logement') ?? '';
  const actifs = d.logements.filter((l) => l.statut === 'actif');
  const logementFiltre = actifs.find((l) => l.id === filtre);

  const aTraiter = d.versionsAnnonce
    .filter((v) => (v.statut === 'proposee' || v.statut === 'validee') && (!logementFiltre || v.logementId === logementFiltre.id))
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  const k = indicateurs(d);

  const brut = params.get('onglet');
  const defaut: CleOnglet = logementFiltre && !aTraiter.length ? 'historique' : 'a-valider';
  const onglet: CleOnglet = (ONGLETS as readonly string[]).includes(brut ?? '') ? (brut as CleOnglet) : defaut;
  const maj = (patch: Record<string, string | undefined>) => {
    const suivant = new URLSearchParams(params);
    for (const [cle, val] of Object.entries(patch)) {
      if (val) suivant.set(cle, val);
      else suivant.delete(cle);
    }
    setParams(suivant, { replace: true });
  };
  const signaler = (r: Issue) => setRetour(r);

  const effet = k.effetMoyen === undefined ? '-' : `${k.effetMoyen > 0 ? '+' : ''}${nombre(k.effetMoyen, 1)}`;

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Distribution' }, { libelle: 'Annonces' }]}
        titre="Rafraîchissement des annonces"
        sousTitre="Chaque mois, une nouvelle version utile de chaque annonce, validée par un humain. On mesure l’effet sur les réservations."
        actions={
          <div className="w-full sm:w-64">
            <Select
              aria-label="Filtrer par logement"
              value={logementFiltre?.id ?? ''}
              onChange={(e) => maj({ logement: e.target.value || undefined })}
              placeholder="Tous les logements"
              options={actifs.map((l) => ({ valeur: l.id, libelle: l.nom }))}
            />
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Versions à valider ou publier" valeur={k.aValider} tone={k.aValider ? 'alerte' : 'neutre'} icone={<FileText />} aide="Propositions et versions validées" />
        <Stat label={`Publiées en ${moisAnnee(MOIS_COURANT)}`} valeur={k.publieesMois} icone={<CheckCircle2 />} aide={`sur ${actifs.length} logements actifs`} />
        <Stat
          label={`Sans nouvelle version depuis plus de ${SEUIL_ANCIENNETE_JOURS} j`}
          valeur={k.anciens.length}
          tone={k.anciens.length ? 'alerte' : 'neutre'}
          icone={<CalendarClock />}
          aide={k.anciens.map((l) => l.nom).join(', ') || 'Tous à jour'}
        />
        <div title={AIDE_EFFET}>
          <Stat
            label="Effet moyen d’une publication"
            valeur={effet}
            icone={<TrendingUp />}
            aide={`réservations sur 30 j, ${pluriel(k.nbMesures, 'mesure complète', 'mesures complètes')} (arrivées, approximation)`}
          />
        </div>
      </div>

      {retour && (
        <Alert
          tone={retour.ok ? 'succes' : 'danger'}
          className="mb-4"
          actions={<Button size="sm" variant="ghost" icone={<X />} onClick={() => setRetour(undefined)} aria-label="Fermer le message">Fermer</Button>}
        >
          {retour.ok ? retour.message : retour.erreur}
        </Alert>
      )}

      {logementFiltre && (
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[13px] text-(--lm-encre-2)">
          Filtré sur <strong className="text-(--lm-encre)">{logementFiltre.nom}</strong>
          <Button size="sm" variant="ghost" onClick={() => maj({ logement: undefined })}>Voir tous les logements</Button>
        </p>
      )}

      <Tabs
        label="Vues des annonces"
        actif={onglet}
        onChange={(cle) => maj({ onglet: cle === defaut ? undefined : cle })}
        onglets={[
          { cle: 'a-valider', libelle: 'À valider', compteur: aTraiter.length },
          { cle: 'historique', libelle: 'Historique par logement' },
        ]}
      />

      {onglet === 'a-valider' && (
        <div className="flex flex-col gap-4">
          {aTraiter.length ? (
            aTraiter.map((v) => (
              <CarteAValider
                key={v.id}
                version={v}
                logement={d.logements.find((l) => l.id === v.logementId)}
                actuelle={versionEnLigne(d.versionsAnnonce, v.logementId)}
                onRetour={signaler}
              />
            ))
          ) : (
            <EmptyState
              titre="Aucune version en attente"
              description="L’agent propose une nouvelle version de chaque annonce au début de chaque mois."
              icone={<CheckCircle2 />}
            />
          )}
        </div>
      )}

      {onglet === 'historique' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {(logementFiltre ? [logementFiltre] : actifs).map((l) => (
            <HistoriqueLogement key={l.id} logement={l} onRetour={signaler} />
          ))}
        </div>
      )}
    </>
  );
}

/** Module Annonces : rafraîchissement mensuel des descriptions (SPEC §11). */
export default function Annonces() {
  return (
    <Routes>
      <Route index element={<PageAnnonces />} />
      <Route path="*" element={<PageAnnonces />} />
    </Routes>
  );
}
