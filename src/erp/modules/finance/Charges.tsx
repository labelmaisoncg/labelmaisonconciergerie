import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus } from 'lucide-react';
import { useErp } from '../../data/store';
import { AUJOURDHUI, dateCourte, euros, pluriel } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { fenetreMois, logementById } from '../../data/selectors';
import type { CategorieCharge, Charge } from '../../data/types';
import { Button, Card, CardHeader, FilterChips, PageHeader, Stat, Table, Toolbar, type Colonne, useCreationParUrl } from '../../ui';
import { fenetre12Mois } from './_calculs';
import { AXE, COULEURS, eurosAxe, Infobulle } from './_composants/graphiques';
import { FormulaireCharge } from './_composants/FormulaireCharge';
import { FIL_FINANCE, type PageFinanceProps } from './_composants/types';
import { useRechercheUrl } from '../../ui/useRechercheUrl';

type Periode = 'mois' | 'annee';
const CATEGORIES = Object.keys(LIBELLES.categorieCharge) as CategorieCharge[];

export default function Charges({ onglets }: PageFinanceProps) {
  const d = useErp();
  const [periode, setPeriode] = useState<Periode>('annee');
  const [categories, setCategories] = useState<string[]>([]);
  const [recherche, setRecherche] = useRechercheUrl();
  const [edition, setEditionEtat] = useState<Charge | 'nouvelle'>();
  const [creationUrl, setCreationUrl] = useCreationParUrl();
  const setEdition = (e: Charge | 'nouvelle' | undefined) => {
    if (!e && creationUrl) setCreationUrl(false);
    setEditionEtat(e);
  };
  const enEdition = edition ?? (creationUrl ? 'nouvelle' : undefined);

  const f = periode === 'mois' ? fenetreMois(AUJOURDHUI) : fenetre12Mois();
  const dePeriode = useMemo(() => d.charges.filter((c) => c.date >= f.debut && c.date < f.fin), [d.charges, f.debut, f.fin]);
  const lignes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return dePeriode.filter((c) => (!categories.length || categories.includes(c.categorie)) && (!q || c.libelle.toLowerCase().includes(q)));
  }, [dePeriode, categories, recherche]);

  const parCategorie = CATEGORIES.map((c) => ({
    cle: c,
    libelle: LIBELLES.categorieCharge[c],
    montant: dePeriode.filter((x) => x.categorie === c).reduce((s, x) => s + x.montantCentimes, 0),
  }))
    .filter((c) => c.montant > 0)
    .sort((a, b) => b.montant - a.montant);

  const total = dePeriode.reduce((s, c) => s + c.montantCentimes, 0);
  const affectees = dePeriode.filter((c) => c.logementId).reduce((s, c) => s + c.montantCentimes, 0);

  const colonnes: Colonne<Charge>[] = [
    { cle: 'date', titre: 'Date', rendu: (c) => dateCourte(c.date), tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'libelle', titre: 'Libellé', rendu: (c) => c.libelle, tri: (a, b) => a.libelle.localeCompare(b.libelle) },
    { cle: 'categorie', titre: 'Catégorie', rendu: (c) => LIBELLES.categorieCharge[c.categorie], tri: (a, b) => a.categorie.localeCompare(b.categorie), masquerMobile: true },
    { cle: 'logement', titre: 'Logement', rendu: (c) => logementById(d, c.logementId)?.nom ?? <span className="text-(--lm-encre-3)">Générale</span>, masquerMobile: true },
    { cle: 'montant', titre: 'Montant', align: 'droite', rendu: (c) => <span className="font-medium">{euros(c.montantCentimes)}</span>, tri: (a, b) => a.montantCentimes - b.montantCentimes },
  ];

  return (
    <>
      <PageHeader
        fil={[...FIL_FINANCE, { libelle: 'Charges' }]}
        titre="Vos dépenses"
        sousTitre="Logiciels, produits, transport, assurance, linge… Les prestataires sont suivis à part, dans « Payer les prestataires »."
        actions={
          <Button variant="primary" icone={<Plus />} onClick={() => setEdition('nouvelle')}>
            Ajouter une charge
          </Button>
        }
      />
      {onglets}

      <FilterChips
        label="Période"
        unique
        className="mb-4"
        actifs={[periode]}
        onChange={(a) => a[0] && setPeriode(a[0] as Periode)}
        filtres={[
          { cle: 'mois', libelle: 'Mois en cours' },
          { cle: 'annee', libelle: '12 derniers mois' },
        ]}
      />

      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Stat label="Total des dépenses" valeur={euros(total, true)} aide={pluriel(dePeriode.length, 'dépense')} />
          <Stat label="Liées à un logement" valeur={euros(affectees, true)} aide="comptées dans la rentabilité du logement" />
        </div>
        <Card>
          <CardHeader titre="Par catégorie" />
          {parCategorie.length ? (
            <div style={{ height: Math.max(120, parCategorie.length * 36) }} role="img" aria-label="Charges par catégorie">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={parCategorie} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={COULEURS.grille} />
                  <XAxis type="number" tickFormatter={eurosAxe} tick={AXE} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="libelle" tick={AXE} tickLine={false} axisLine={false} width={84} />
                  <Tooltip content={<Infobulle />} cursor={{ fill: 'rgba(20,17,14,0.04)' }} />
                  <Bar dataKey="montant" name="Charges" fill={COULEURS.ca} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-(--lm-encre-3)">Pas de dépense sur cette période.</p>
          )}
        </Card>
      </div>

      <Toolbar
        recherche={{ valeur: recherche, onChange: setRecherche, placeholder: 'Rechercher un libellé', label: 'Rechercher une charge' }}
        filtres={{
          label: 'Filtrer par catégorie',
          actifs: categories,
          onChange: setCategories,
          filtres: CATEGORIES.map((c) => ({ cle: c, libelle: LIBELLES.categorieCharge[c] })),
        }}
      />
      <Table
        legende="Charges"
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(c) => c.id}
        onLigneClick={(c) => setEdition(c)}
        triInitial={{ cle: 'date', sens: 'desc' }}
        vide="Aucune dépense ne correspond."
      />

      {enEdition && <FormulaireCharge charge={enEdition === 'nouvelle' ? undefined : enEdition} onFermer={() => setEdition(undefined)} />}
    </>
  );
}
