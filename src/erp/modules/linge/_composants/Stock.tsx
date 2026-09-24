import { useState } from 'react';
import { useErp } from '../../../data/store';
import { Card, CardHeader, ProgressBar, Table, cn, type Colonne } from '../../../ui';
import { positionLinge, type PositionArticle, type PositionLogement } from './calculs';

const chiffre = (n: number, ton?: string) => <span className={cn('lm-chiffres', n > 0 && ton)}>{n}</span>;

/** Stock par logement : dotation contre position réelle du linge. */
export function Stock() {
  const { logements, mouvementsLinge } = useErp();
  const positions = logements.filter((l) => l.statut !== 'sorti').map((l) => positionLinge(l, mouvementsLinge));
  const [choisi, setChoisi] = useState(positions[0]?.logement.id ?? '');
  const detail = positions.find((p) => p.logement.id === choisi);

  const colonnes: Colonne<PositionLogement>[] = [
    { cle: 'logement', titre: 'Logement', rendu: (p) => <span className="font-medium">{p.logement.nom}</span>, tri: (a, b) => a.logement.nom.localeCompare(b.logement.nom) },
    { cle: 'dotation', titre: 'Dotation', align: 'droite', rendu: (p) => chiffre(p.total.dotation) },
    { cle: 'enPlace', titre: 'En place', align: 'droite', rendu: (p) => chiffre(p.total.enPlace) },
    { cle: 'sale', titre: 'Sale', align: 'droite', rendu: (p) => chiffre(p.total.sale, 'text-(--lm-alerte)'), masquerMobile: true },
    { cle: 'blanchisserie', titre: 'Blanchisserie', align: 'droite', rendu: (p) => chiffre(p.total.blanchisserie, 'text-(--lm-info)'), masquerMobile: true },
    { cle: 'perdu', titre: 'Perdu', align: 'droite', rendu: (p) => chiffre(p.total.perdu, 'font-semibold text-(--lm-danger)'), tri: (a, b) => a.total.perdu - b.total.perdu },
    {
      cle: 'taux',
      titre: 'Disponibilité',
      largeur: 'w-40',
      masquerMobile: true,
      rendu: (p) => {
        const r = p.total.dotation ? p.total.enPlace / p.total.dotation : 0;
        return <ProgressBar valeur={r} afficherValeur tone={r < 0.5 ? 'danger' : r < 0.7 ? 'alerte' : 'succes'} />;
      },
      tri: (a, b) => a.total.enPlace / (a.total.dotation || 1) - b.total.enPlace / (b.total.dotation || 1),
    },
  ];

  const colonnesArticles: Colonne<PositionArticle>[] = [
    { cle: 'article', titre: 'Article', rendu: (a) => a.article },
    { cle: 'dotation', titre: 'Dotation', align: 'droite', rendu: (a) => chiffre(a.dotation) },
    { cle: 'enPlace', titre: 'En place', align: 'droite', rendu: (a) => chiffre(a.enPlace) },
    { cle: 'sale', titre: 'Sale', align: 'droite', rendu: (a) => chiffre(a.sale, 'text-(--lm-alerte)') },
    { cle: 'blanchisserie', titre: 'Blanchisserie', align: 'droite', rendu: (a) => chiffre(a.blanchisserie, 'text-(--lm-info)') },
    { cle: 'perdu', titre: 'Perdu', align: 'droite', rendu: (a) => chiffre(a.perdu, 'font-semibold text-(--lm-danger)') },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <Table
          colonnes={colonnes}
          lignes={positions}
          cleLigne={(p) => p.logement.id}
          onLigneClick={(p) => setChoisi(p.logement.id)}
          ligneActive={choisi}
          legende="Stock de linge par logement"
          dense
          vide="Aucun logement."
        />
        <p className="mt-2 text-[12px] text-(--lm-encre-3)">Cliquez sur un logement pour voir le détail par article.</p>
      </div>
      <Card flush className="xl:col-span-2">
        <CardHeader
          className="px-4 pt-4"
          titre={detail ? `Détail : ${detail.logement.nom}` : 'Détail'}
          description="Dotation étiquetée au lancement, position calculée depuis les mouvements."
        />
        {detail && detail.articles.length ? (
          <Table colonnes={colonnesArticles} lignes={detail.articles} cleLigne={(a) => a.article} dense legende={`Linge de ${detail.logement.nom}`} className="rounded-none border-0 shadow-none" />
        ) : (
          <p className="px-4 pb-4 text-[13px] text-(--lm-encre-3)">Aucune dotation définie pour ce logement : le lancement est bloqué tant que le linge n’est pas étiqueté.</p>
        )}
      </Card>
    </div>
  );
}
