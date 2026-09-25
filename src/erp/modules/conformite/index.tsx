import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, FileText, MinusCircle, OctagonAlert, Upload } from 'lucide-react';
import { useErp } from '../../data/store';
import { nombre } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { Alert, Badge, Button, Card, Drawer, FilterChips, PageHeader, Section, Stat, Table, Tabs, type Colonne } from '../../ui';
import { ConformiteEntreprise } from './_composants/Entreprise';
import { LIBELLE_STATUT, TON_STATUT, pointsLogement, statutGlobal, type PointConformite, type StatutConformite } from './_composants/regles';
import type { Logement } from '../../data/types';

interface Ligne {
  logement: Logement;
  points: PointConformite[];
  statut: StatutConformite;
}

const ICONES: Record<StatutConformite, typeof CheckCircle2> = { ok: CheckCircle2, a_faire: CircleAlert, risque: OctagonAlert, na: MinusCircle };
const COULEUR: Record<StatutConformite, string> = {
  ok: 'text-(--lm-succes)',
  a_faire: 'text-(--lm-alerte)',
  risque: 'text-(--lm-danger)',
  na: 'text-(--lm-encre-3)',
};

function Pastille({ point }: { point?: PointConformite }) {
  if (!point) return null;
  const Icone = ICONES[point.statut];
  return (
    <span className="relative inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap" title={point.action ?? point.constat}>
      <Icone className={`size-4 shrink-0 ${COULEUR[point.statut]}`} aria-hidden />
      <span className="sr-only">{LIBELLE_STATUT[point.statut]} :</span>
      <span className="max-w-40 truncate text-(--lm-encre-2)">{point.constat}</span>
    </span>
  );
}

const DOCUMENTS = ['Kbis de la SASU', 'Statuts de la SASU', 'Attestation RC Pro Label Maison', 'Modèle de mandat de gestion', 'Conditions générales', 'Registre des traitements RGPD'];

export default function Module() {
  const d = useErp();
  const [filtre, setFiltre] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState<string>();
  const [vue, setVue] = useState<'logements' | 'societe' | 'documents'>('logements');

  const lignes = useMemo<Ligne[]>(
    () =>
      d.logements
        .filter((l) => l.statut !== 'sorti')
        .map((l) => {
          const points = pointsLogement(l, d);
          return { logement: l, points, statut: statutGlobal(points) };
        }),
    [d],
  );
  const visibles = filtre.length ? lignes.filter((l) => filtre.includes(l.statut)) : lignes;
  const compte = (s: StatutConformite) => lignes.filter((l) => l.statut === s).length;
  const risques = lignes.flatMap((l) => l.points.filter((p) => p.statut === 'risque'));
  const choisi = lignes.find((l) => l.logement.id === ouvert);

  const point = (l: Ligne, cle: PointConformite['cle']) => l.points.find((p) => p.cle === cle);
  const colonnes: Colonne<Ligne>[] = [
    {
      cle: 'logement',
      titre: 'Logement',
      rendu: (l) => (
        <span className="block min-w-36">
          <span className="font-medium">{l.logement.nom}</span>
          <span className="block text-[12px] text-(--lm-encre-3)">{LIBELLES.statutLogement[l.logement.statut]}</span>
        </span>
      ),
      tri: (a, b) => a.logement.nom.localeCompare(b.logement.nom),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (l) => (
        <Badge tone={TON_STATUT[l.statut]} point>
          {LIBELLE_STATUT[l.statut]}
        </Badge>
      ),
      tri: (a, b) => ['risque', 'a_faire', 'ok'].indexOf(a.statut) - ['risque', 'a_faire', 'ok'].indexOf(b.statut),
    },
    { cle: 'enregistrement', titre: 'N° d’enregistrement', rendu: (l) => <Pastille point={point(l, 'enregistrement')} /> },
    { cle: 'dpe', titre: 'DPE', rendu: (l) => <Pastille point={point(l, 'dpe')} /> },
    { cle: 'nuits', titre: '120 nuits', rendu: (l) => <Pastille point={point(l, 'nuits')} />, masquerMobile: true },
    { cle: 'assurance', titre: 'Assurance', rendu: (l) => <Pastille point={point(l, 'assurance')} />, masquerMobile: true },
    { cle: 'acces', titre: 'Accès', rendu: (l) => <Pastille point={point(l, 'acces')} />, masquerMobile: true },
  ];

  return (
    <>
      <PageHeader
        titre="Conformité"
        sousTitre="Êtes-vous en règle ? Logement par logement, pour la société, et vos documents officiels."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Logements en règle" valeur={`${nombre(compte('ok'))} / ${nombre(lignes.length)}`} tone={compte('ok') === lignes.length ? 'succes' : 'neutre'} />
        <Stat
          label="À régler vite"
          valeur={nombre(compte('risque'))}
          tone={compte('risque') ? 'danger' : 'neutre'}
          aide={risques.length ? `${nombre(risques.length)} point${risques.length > 1 ? 's' : ''} qui peuvent coûter cher` : 'aucun risque'}
        />
        <Stat label="Petites choses à faire" valeur={nombre(compte('a_faire'))} tone={compte('a_faire') ? 'alerte' : 'neutre'} aide="logements concernés" />
      </div>

      <Tabs
        label="Sections de la conformité"
        actif={vue}
        onChange={(c) => setVue(c as typeof vue)}
        onglets={[
          { cle: 'logements', libelle: 'Vos logements', compteur: compte('risque') + compte('a_faire') || undefined },
          { cle: 'societe', libelle: 'Votre société' },
          { cle: 'documents', libelle: 'Documents' },
        ]}
      />

      {vue === 'logements' && (
      <Section description="Cliquez sur un logement pour voir quoi faire.">
        <FilterChips
          className="mb-3"
          label="Filtrer par statut"
          actifs={filtre}
          onChange={setFiltre}
          filtres={(['risque', 'a_faire', 'ok'] as const).map((s) => ({ cle: s, libelle: LIBELLE_STATUT[s], compteur: compte(s) }))}
        />
        <Table
          legende="Conformité par logement"
          colonnes={colonnes}
          lignes={visibles}
          cleLigne={(l) => l.logement.id}
          onLigneClick={(l) => setOuvert(l.logement.id)}
          ligneActive={ouvert}
          triInitial={{ cle: 'statut', sens: 'asc' }}
          vide="Aucun logement dans ce cas."
        />
      </Section>
      )}

      {vue === 'societe' && (
      <Section description="Les obligations de Label Maison Conciergerie SASU.">
        <ConformiteEntreprise />
      </Section>
      )}

      {vue === 'documents' && (
      <Section>
        <Card>
          <Alert tone="neutre" className="mb-3">
            Le dépôt de documents arrive bientôt. En attendant, ils restent dans le drive partagé.
          </Alert>
          <ul className="divide-y divide-(--lm-bord)">
            {DOCUMENTS.map((doc) => (
              <li key={doc} className="flex items-center gap-3 py-2.5">
                <FileText className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                <span className="flex-1 text-[13.5px]">{doc}</span>
                <Badge tone="neutre">Pas encore déposé</Badge>
                <Button size="sm" variant="ghost" icone={<Upload />} disabled aria-label={`Déposer : ${doc} (bientôt disponible)`}>
                  <span className="hidden sm:inline">Déposer</span>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
      )}

      {choisi && (
        <Drawer
          ouvert
          onFermer={() => setOuvert(undefined)}
          titre={choisi.logement.nom}
          sousTitre={
            <Badge tone={TON_STATUT[choisi.statut]} point>
              {LIBELLE_STATUT[choisi.statut]}
            </Badge>
          }
          pied={
            <Link to={`/erp/logements/${choisi.logement.id}`} className="text-[13.5px] font-medium text-(--lm-or) hover:underline">
              Ouvrir la fiche logement
            </Link>
          }
        >
          <ul className="space-y-3">
            {choisi.points.map((p) => {
              const Icone = ICONES[p.statut];
              return (
                <li key={p.cle} className="rounded-lg border border-(--lm-bord) p-3">
                  <div className="flex items-center gap-2">
                    <Icone className={`size-4 ${COULEUR[p.statut]}`} aria-hidden />
                    <span className="flex-1 text-[14px] font-medium">{p.titre}</span>
                    <Badge tone={TON_STATUT[p.statut]}>{LIBELLE_STATUT[p.statut]}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-(--lm-encre-2)">{p.constat}</p>
                  {p.action && (
                    <p className="mt-1 text-[13px]">
                      <span className="font-medium">À faire : </span>
                      {p.action}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Drawer>
      )}
    </>
  );
}
