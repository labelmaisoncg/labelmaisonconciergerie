import { ArrowRight } from 'lucide-react';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, ecartJours } from '../../../data/format';
import type { Logement } from '../../../data/types';
import { Badge, ButtonLink, Card, CardHeader } from '../../../ui';
import { SEUIL_ANCIENNETE_JOURS, versionEnLigne } from './logique';

/** Encart « Annonce » de la fiche logement : version en ligne et proposition en attente. */
export function CarteAnnonceLogement({ logement: l }: { logement: Logement }) {
  const { versionsAnnonce } = useErp();
  const enLigne = versionEnLigne(versionsAnnonce, l.id);
  const enAttente = versionsAnnonce.filter((v) => v.logementId === l.id && (v.statut === 'proposee' || v.statut === 'validee')).length;
  const age = enLigne?.publieeLe ? ecartJours(enLigne.publieeLe, AUJOURDHUI) : undefined;

  return (
    <Card>
      <CardHeader titre="Annonce" description="Rafraîchie chaque mois, validée par un humain." />
      {enLigne ? (
        <>
          <p className="text-[14px] font-medium text-(--lm-encre)">{enLigne.titre}</p>
          <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">Publiée le {dateCourte(enLigne.publieeLe as string)}</p>
        </>
      ) : (
        <p className="text-[13px] text-(--lm-encre-2)">Aucune version publiée suivie dans l’ERP.</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {enAttente > 0 && <Badge tone="or" point>{enAttente} proposition{enAttente > 1 ? 's' : ''} à traiter</Badge>}
        {(age === undefined || age > SEUIL_ANCIENNETE_JOURS) && <Badge tone="alerte" point>Plus de {SEUIL_ANCIENNETE_JOURS} j</Badge>}
      </div>
      <ButtonLink to={`/erp/annonces?logement=${l.id}`} className="mt-3 w-full">
        Voir les versions
        <ArrowRight aria-hidden />
      </ButtonLink>
    </Card>
  );
}
