import { Link } from 'react-router-dom';
import { Wand2 } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, ecartJours, moisAnnee } from '../../../data/format';
import type { Logement, VersionAnnonce } from '../../../data/types';
import { Badge, Button, Card, Timeline, type EvenementFrise } from '../../../ui';
import { useActionsAnnonce, type Issue } from './actions';
import { AIDE_EFFET, effetPublication, LIBELLES_STATUT, SEUIL_ANCIENNETE_JOURS, TONS_STATUT, versionEnLigne, versionsDu } from './logique';

function Effet({ v }: { v: VersionAnnonce }) {
  const { reservations } = useErp();
  const e = effetPublication({ reservations }, v);
  if (!e) return null;
  if (e.sansHistorique) {
    return <span className="text-(--lm-encre-3)">Effet non mesurable : historique de réservations insuffisant avant la publication.</span>;
  }
  const delta = e.apres - e.avant;
  return (
    <span title={AIDE_EFFET} className="lm-chiffres cursor-help">
      Réservations : {e.avant} avant, {e.apres} après{' '}
      <span className={delta > 0 ? 'text-(--lm-succes)' : delta < 0 ? 'text-(--lm-danger)' : ''}>
        ({delta > 0 ? '+' : ''}{delta})
      </span>
      {e.provisoire && ' · mesure provisoire'}
    </span>
  );
}

function frise(versions: VersionAnnonce[]): EvenementFrise[] {
  return versions.map((v) => ({
    id: v.id,
    tone: TONS_STATUT[v.statut],
    titre: (
      <span className="flex flex-wrap items-center gap-2">
        <span>{v.titre}</span>
        <Badge tone={TONS_STATUT[v.statut]}>{LIBELLES_STATUT[v.statut]}</Badge>
      </span>
    ),
    meta: `${moisAnnee(v.mois)} · ${v.source === 'agent' ? 'agent' : 'équipe'}`,
    description: (
      <span className="flex flex-col gap-0.5">
        <span>
          Proposée le {dateCourte(v.creeLe)}
          {v.valideePar && v.valideeLe && ` · ${v.statut === 'rejetee' ? 'rejetée' : 'validée'} par ${v.valideePar} le ${dateCourte(v.valideeLe)}`}
          {v.publieeLe && ` · publiée le ${dateCourte(v.publieeLe)}`}
        </span>
        {v.motifRejet && <span className="text-(--lm-encre-3)">Motif : {v.motifRejet}</span>}
        <Effet v={v} />
      </span>
    ),
  }));
}

export function HistoriqueLogement({ logement: l, onRetour }: { logement: Logement; onRetour: (r: Issue) => void }) {
  const { versionsAnnonce } = useErp();
  const a = useActionsAnnonce();
  const versions = versionsDu(versionsAnnonce, l.id);
  const enLigne = versionEnLigne(versionsAnnonce, l.id);
  const age = enLigne?.publieeLe ? ecartJours(enLigne.publieeLe, AUJOURDHUI) : undefined;

  return (
    <Card id={`annonce-${l.id}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-(--lm-encre)">
            <Link to={`/erp/logements/${l.id}`} className="hover:underline">{l.nom}</Link>
          </h3>
          <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">
            {enLigne ? `En ligne : « ${enLigne.titre} », depuis ${age} j` : 'Aucune version publiée'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(age === undefined || age > SEUIL_ANCIENNETE_JOURS) && <Badge tone="alerte" point>Plus de {SEUIL_ANCIENNETE_JOURS} j</Badge>}
          <Button size="sm" icone={<Wand2 />} onClick={() => onRetour(a.generer(l.id))}>
            Générer une proposition maintenant
          </Button>
        </div>
      </div>
      <Timeline elements={frise(versions)} vide="Aucune version enregistrée pour ce logement." />
    </Card>
  );
}
