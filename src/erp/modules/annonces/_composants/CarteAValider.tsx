import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Send, X } from 'lucide-react';
import { dateCourte, ecartJours, AUJOURDHUI, moisAnnee } from '../../../data/format';
import type { Logement, VersionAnnonce } from '../../../data/types';
import { Badge, Button, Card, cn, TON_LAVIS } from '../../../ui';
import type { Issue } from './actions';
import { useActionsAnnonce } from './actions';
import { Comparaison } from './Comparaison';
import { LIBELLES_STATUT, TONS_STATUT } from './logique';
import { EditionVersion, PublicationVersion, RejetVersion } from './Modales';

type Fenetre = 'edition' | 'rejet' | 'publication';

/** Ton d'une raison : point faible en alerte, avis corrigé en succès. */
function tonRaison(r: string) {
  if (r.startsWith('Point faible')) return 'alerte' as const;
  if (r.startsWith('Avis')) return 'succes' as const;
  if (r.startsWith('Saison')) return 'or' as const;
  return 'neutre' as const;
}

export function CarteAValider({ version: v, logement: l, actuelle, onRetour }: {
  version: VersionAnnonce;
  logement?: Logement;
  actuelle?: VersionAnnonce;
  onRetour: (r: Issue) => void;
}) {
  const a = useActionsAnnonce();
  const [fenetre, setFenetre] = useState<Fenetre>();
  const attente = ecartJours(v.creeLe, AUJOURDHUI);
  const fermer = (r: Issue) => {
    setFenetre(undefined);
    if (r.ok && r.message) onRetour(r);
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-(--lm-encre)">
            {l ? <Link to={`/erp/logements/${l.id}`} className="hover:underline">{l.nom}</Link> : v.logementId}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">
            Version de {moisAnnee(v.mois)} · proposée le {dateCourte(v.creeLe)} par {v.source === 'agent' ? 'l’agent' : 'l’équipe'}
            {v.valideePar && v.valideeLe && ` · validée par ${v.valideePar} le ${dateCourte(v.valideeLe)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {v.statut === 'proposee' && attente > 7 && <Badge tone="danger" point>En attente depuis {attente} j</Badge>}
          <Badge tone={TONS_STATUT[v.statut]} point>{LIBELLES_STATUT[v.statut]}</Badge>
        </div>
      </div>

      <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Raisons de cette version">
        {v.raisons.map((r) => (
          <li key={r}>
            <span className={cn('inline-block rounded-2xl px-2.5 py-1 text-[12px] leading-snug font-medium', TON_LAVIS[tonRaison(r)])}>{r}</span>
          </li>
        ))}
      </ul>

      <Comparaison actuelle={actuelle} proposition={v} />

      <div className="mt-3.5 flex flex-wrap items-center justify-end gap-2">
        {!a.autorise && (
          <p className="mr-auto text-[12.5px] text-(--lm-encre-3)">Validation réservée à Abdel et Kamel.</p>
        )}
        <Button variant="ghost" icone={<X />} onClick={() => setFenetre('rejet')} disabled={!a.autorise}>
          Rejeter
        </Button>
        {v.statut === 'proposee' && (
          <>
            <Button icone={<Pencil />} onClick={() => setFenetre('edition')} disabled={!a.autorise}>
              Modifier
            </Button>
            <Button variant="primary" icone={<Check />} onClick={() => onRetour(a.valider(v.id))} disabled={!a.autorise}>
              Valider
            </Button>
          </>
        )}
        {v.statut === 'validee' && (
          <Button variant="primary" icone={<Send />} onClick={() => setFenetre('publication')} disabled={!a.autorise}>
            Publier
          </Button>
        )}
      </div>

      {fenetre === 'edition' && <EditionVersion version={v} onValider={(t) => a.valider(v.id, t)} onFermer={fermer} />}
      {fenetre === 'rejet' && <RejetVersion onRejeter={(m) => a.rejeter(v.id, m)} onFermer={fermer} />}
      {fenetre === 'publication' && <PublicationVersion version={v} onPublier={() => a.publier(v.id)} onFermer={fermer} />}
    </Card>
  );
}
