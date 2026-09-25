import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, IconButton, Input, Select } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { ARTICLES_LINGE } from '../../../data/constantes';
import { dateCourte } from '../../../data/format';
import { ecartsLinge } from '../../../data/selectors';
import type { Logement } from '../../../data/types';

interface LigneSaisie {
  article: string;
  quantite: string;
}

const versSaisie = (l: Logement): LigneSaisie[] => l.dotationLinge.map((x) => ({ article: x.article, quantite: String(x.quantite) }));

export function OngletLinge({ logement: l }: { logement: Logement }) {
  const { upsert, mouvementsLinge } = useErp();
  const [lignes, setLignes] = useState<LigneSaisie[]>(() => versSaisie(l));
  const [erreur, setErreur] = useState<string>();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setLignes(versSaisie(l));
  }, [l]);

  const articles = [...new Set([...ARTICLES_LINGE, ...l.dotationLinge.map((x) => x.article)])];
  const maj = (i: number, patch: Partial<LigneSaisie>) => {
    setLignes((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setOk(false);
  };
  const libres = articles.filter((a) => !lignes.some((x) => x.article === a));

  const enregistrer = () => {
    if (lignes.some((x) => !x.article || !/^\d+$/.test(x.quantite.trim()) || Number(x.quantite) <= 0)) {
      setErreur('Chaque ligne doit avoir un article et une quantité entière positive.');
      return;
    }
    if (new Set(lignes.map((x) => x.article)).size !== lignes.length) {
      setErreur('Un article ne peut apparaître qu’une seule fois.');
      return;
    }
    setErreur(undefined);
    upsert('logements', { ...l, dotationLinge: lignes.map((x) => ({ article: x.article, quantite: Number(x.quantite) })) });
    setOk(true);
  };

  const modifie = JSON.stringify(lignes) !== JSON.stringify(versSaisie(l));
  const total = lignes.reduce((s, x) => s + (Number(x.quantite) || 0), 0);
  const mouvements = mouvementsLinge
    .filter((m) => m.logementId === l.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const ecarts = ecartsLinge(mouvementsLinge).filter((e) => e.logementId === l.id);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card className="min-w-0 lg:col-span-2">
        <CardHeader
          titre="Dotation de linge"
          description="Stock étiqueté affecté au logement : un jeu en place, un en blanchisserie, un de secours."
          actions={<Badge tone="or">{total} articles</Badge>}
        />
        {lignes.length === 0 && (
          <Alert tone="alerte" titre="Aucune dotation définie" className="mb-3">
            Le point « Linge étiqueté, dotation définie » de la checklist de lancement ne peut pas être validé.
          </Alert>
        )}
        <ul className="space-y-2">
          {lignes.map((x, i) => (
            <li key={i} className="flex items-center gap-2">
              <Select
                aria-label={`Article ligne ${i + 1}`}
                value={x.article}
                onChange={(e) => maj(i, { article: e.target.value })}
                placeholder="Choisir un article"
                options={articles.map((a) => ({ valeur: a, libelle: a, desactive: a !== x.article && lignes.some((y) => y.article === a) }))}
                className="min-w-0"
              />
              <Input
                aria-label={`Quantité ligne ${i + 1}`}
                value={x.quantite}
                onChange={(e) => maj(i, { quantite: e.target.value })}
                inputMode="numeric"
                className="w-20 shrink-0 text-right tabular-nums"
              />
              <IconButton label={`Retirer la ligne ${i + 1}`} onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
        {erreur && <p role="alert" className="mt-3 text-[12.5px] font-medium text-(--lm-danger)">{erreur}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button icone={<Plus />} onClick={() => setLignes((ls) => [...ls, { article: libres[0] ?? '', quantite: '3' }])} disabled={libres.length === 0}>
            Ajouter un article
          </Button>
          <Button variant="primary" onClick={enregistrer} disabled={!modifie} className="sm:ml-auto">
            Enregistrer la dotation
          </Button>
          {ok && !modifie && <span role="status" className="text-[12.5px] text-(--lm-succes)">Dotation enregistrée.</span>}
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        {ecarts.length > 0 && (
          <Alert tone="danger" titre={`${ecarts.length} écart${ecarts.length > 1 ? 's' : ''} d’inventaire`}>
            Linge envoyé en blanchisserie non revenu dans les délais. Un écart est un incident.
          </Alert>
        )}
        <Card>
          <CardHeader
            titre="Derniers mouvements"
            actions={
              <Link to={`/erp/linge?logement=${l.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or) hover:underline">
                Suivi du linge <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {mouvements.length === 0 ? (
            <p className="text-sm text-(--lm-encre-3)">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="divide-y divide-(--lm-bord)">
              {mouvements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <span>
                    <span className="font-medium">{LIBELLES.typeMouvementLinge[m.type]}</span>
                    <span className="block text-[12px] text-(--lm-encre-3)">{dateCourte(m.date)}</span>
                  </span>
                  <span className="lm-chiffres text-(--lm-encre-2)">{m.articles.reduce((s, a) => s + a.quantite, 0)} art.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <p className="text-[12.5px] text-(--lm-encre-3)">Rappel : le linge n’est jamais lavé au domicile d’un prestataire.</p>
      </div>
    </div>
  );
}
