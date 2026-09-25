import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Pencil } from 'lucide-react';
import { LIBELLES_STATUT_RECO } from '../../../analyse';
import { dateCourte, euros } from '../../../data/format';
import { useErp } from '../../../data/store';
import type { RecommandationProprietaire, StatutRecommandation } from '../../../data/types';
import { Badge, Button, EmptyState, FilterChips, IconButton, Select, TON_PLEIN, cn } from '../../../ui';
import { EditionReco } from './EditionReco';
import { Proposition } from './Proposition';
import { ETAPES, LIBELLE_IMPACT, LIBELLE_PORTEUR, TRANSITIONS, faireAvancer } from './suivi';
import { TONS_STATUT_RECO } from '../../../analyse';

function Carte({ r, onEditer }: { r: RecommandationProprietaire; onEditer: (r: RecommandationProprietaire, cible?: StatutRecommandation) => void }) {
  const { upsert, logements } = useErp();
  const l = logements.find((x) => x.id === r.logementId);
  const date = r.realiseeLe ?? r.decideeLe ?? r.proposeeLe ?? r.creeLe;
  const verbe = r.realiseeLe ? 'Réalisée' : r.decideeLe ? 'Décidée' : r.proposeeLe ? 'Proposée' : 'Créée';
  return (
    <li className="rounded-lg border border-(--lm-bord) bg-(--lm-surface) p-3 shadow-(--lm-ombre)">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-semibold text-(--lm-encre)">{r.titre}</p>
          <Link to={`/erp/logements/${r.logementId}?onglet=performance`} className="text-[12.5px] text-(--lm-or) hover:underline">
            {l?.nom ?? 'Logement'}
          </Link>
        </div>
        <IconButton label={`Modifier : ${r.titre}`} size="sm" variant="ghost" onClick={() => onEditer(r)}>
          <Pencil />
        </IconButton>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge tone={r.porteur === 'proprietaire' ? 'neutre' : 'or'}>{LIBELLE_PORTEUR[r.porteur]}</Badge>
        {r.impactEstimeCentimesMois !== undefined && (
          <Badge tone="succes" title={`Gain estimé sur le ${r.impactSur ? LIBELLE_IMPACT[r.impactSur] : 'bien'}`}>+{euros(r.impactEstimeCentimesMois, true)} / mois</Badge>
        )}
        {r.coutCentimes !== undefined && <Badge>Coût {euros(r.coutCentimes, true)}</Badge>}
      </div>
      {r.resultatObserve && <p className="mt-2 rounded-md bg-(--lm-surface-2) px-2 py-1.5 text-[12.5px] text-(--lm-encre-2)">{r.resultatObserve}</p>}
      <p className="mt-2 text-[11.5px] text-(--lm-encre-3)">{verbe} le {dateCourte(date)}</p>
      {TRANSITIONS[r.statut].length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TRANSITIONS[r.statut].map((t) => (
            <Button
              key={t.vers}
              size="sm"
              variant={t.variante}
              onClick={() => (t.vers === 'realisee' ? onEditer(r, 'realisee') : upsert('recommandations', faireAvancer(r, t.vers)))}
            >
              {t.libelle}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

/** Tableau de suivi des recommandations, par étape. */
export function Suivi() {
  const { recommandations, proprietaires } = useErp();
  const [proprietaire, setProprietaire] = useState('');
  const [porteurs, setPorteurs] = useState<string[]>([]);
  const [edition, setEdition] = useState<{ r: RecommandationProprietaire; cible?: StatutRecommandation }>();
  const [proposition, setProposition] = useState(false);

  const filtrees = useMemo(
    () =>
      recommandations
        .filter((r) => (!proprietaire || r.proprietaireId === proprietaire) && (!porteurs.length || porteurs.includes(r.porteur)))
        .sort((a, b) => (b.realiseeLe ?? b.decideeLe ?? b.proposeeLe ?? b.creeLe).localeCompare(a.realiseeLe ?? a.decideeLe ?? a.proposeeLe ?? a.creeLe)),
    [recommandations, proprietaire, porteurs],
  );
  const avecReco = proprietaires.filter((p) => recommandations.some((r) => r.proprietaireId === p.id));

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="w-full sm:w-64">
          <label htmlFor="filtre-proprietaire" className="sr-only">Filtrer par propriétaire</label>
          <Select
            id="filtre-proprietaire"
            value={proprietaire}
            onChange={(e) => setProprietaire(e.target.value)}
            placeholder="Tous les propriétaires"
            options={avecReco.map((p) => ({ valeur: p.id, libelle: p.nom }))}
          />
        </div>
        <FilterChips
          label="Porteur"
          filtres={[
            { cle: 'proprietaire', libelle: 'À la charge du propriétaire', compteur: recommandations.filter((r) => r.porteur === 'proprietaire').length },
            { cle: 'label_maison', libelle: 'Porté par Label Maison', compteur: recommandations.filter((r) => r.porteur === 'label_maison').length },
          ]}
          actifs={porteurs}
          onChange={setPorteurs}
        />
        <div className="sm:ml-auto">
          <Button variant="primary" icone={<FileText />} onClick={() => setProposition(true)}>
            Préparer la proposition au propriétaire
          </Button>
        </div>
      </div>

      {filtrees.length === 0 ? (
        <EmptyState titre="Pas encore de conseil" description="Chaque semaine, l’ERP ajoute ici les améliorations repérées sur vos logements." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ETAPES.map((etape) => {
            const liste = filtrees.filter((r) => r.statut === etape);
            return (
              <section key={etape} aria-labelledby={`etape-${etape}`} className="min-w-0 rounded-xl bg-(--lm-surface-2) p-2.5">
                <h3 id={`etape-${etape}`} className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold text-(--lm-encre)">
                  <span aria-hidden className={cn('size-2 rounded-full', TON_PLEIN[TONS_STATUT_RECO[etape]])} />
                  {LIBELLES_STATUT_RECO[etape]}
                  <span className="lm-chiffres ml-auto text-[12px] font-normal text-(--lm-encre-3)">{liste.length}</span>
                </h3>
                {liste.length ? (
                  <ul className="space-y-2">
                    {liste.map((r) => (
                      <Carte key={r.id} r={r} onEditer={(x, cible) => setEdition({ r: x, cible })} />
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 py-3 text-[12.5px] text-(--lm-encre-3)">Rien à cette étape.</p>
                )}
              </section>
            );
          })}
        </div>
      )}

      <EditionReco reco={edition?.r} cible={edition?.cible} onFermer={() => setEdition(undefined)} />
      {proposition && <Proposition proprietaireInitial={proprietaire || avecReco[0]?.id} onFermer={() => setProposition(false)} />}
    </>
  );
}
