import { useMemo } from 'react';
import { euros, pourcentage } from '../../../data/format';
import { useErp } from '../../../data/store';
import { Card, CardHeader } from '../../../ui';
import { GraphiqueBarres, GraphiqueCourbe } from '../../../ui/Graphiques';
import { serieHebdo, serieMensuelle } from './calculs';

/** Montant compact pour les axes : 12 400 € → « 12 k€ ». */
function eurosAxe(centimes: number): string {
  const e = centimes / 100;
  if (Math.abs(e) < 1000) return `${Math.round(e)} €`;
  return `${(e / 1000).toLocaleString('fr-FR', { maximumFractionDigits: Math.abs(e) < 20000 ? 1 : 0 })} k€`;
}

/** Deux courbes, pas plus : le revenu des 12 derniers mois et l'occupation semaine par semaine. */
export function Courbes() {
  const d = useErp();
  // 12 mois au plus, à partir du premier mois qui a un revenu (3 au moins) : pas de longue rangée de barres vides.
  const mois = useMemo(() => {
    const serie = serieMensuelle(d.donnees, 12);
    const premier = serie.findIndex((m) => m.revenu > 0);
    return premier < 0 ? serie.slice(-3) : serie.slice(Math.min(premier, serie.length - 3));
  }, [d.donnees]);
  const semaines = useMemo(() => serieHebdo(d.donnees, 8, 8), [d.donnees]);
  const courante = semaines.find((s) => s.aVenir);

  return (
    <section aria-label="Évolution" className="mb-6 grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader titre="Revenu par mois" description={mois.length >= 12 ? '12 derniers mois' : `Depuis ${mois[0]?.libelle}`} />
        <GraphiqueBarres
          label={`Revenu par mois, de ${mois[0]?.libelle} à ${mois[mois.length - 1]?.libelle}`}
          points={mois.map((m, i) => ({ libelle: m.libelle, valeur: m.revenu, courant: i === mois.length - 1 }))}
          formater={(v) => euros(v, true)}
          formaterAxe={eurosAxe}
        />
      </Card>
      <Card>
        <CardHeader titre="Occupation par semaine" description="8 semaines passées, 8 à venir" />
        <GraphiqueCourbe
          label="Occupation par semaine, des 8 semaines passées aux 8 à venir"
          points={semaines.map((s) => ({ libelle: s.libelle, valeur: s.occupation }))}
          formater={(v) => pourcentage(v)}
          formaterAxe={(v) => pourcentage(v)}
          domaine={[0, 1]}
          repere={courante?.libelle}
          repereLibelle="Aujourd’hui"
        />
      </Card>
    </section>
  );
}
