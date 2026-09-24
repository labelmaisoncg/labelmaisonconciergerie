import { useEffect, useState } from 'react';
import { Badge, Card, Select } from '../../../ui';
import { LIBELLE_STATUT, TON_STATUT, type StatutConformite } from './regles';

interface PointEntreprise {
  cle: string;
  titre: string;
  description: string;
  action: string;
  statutInitial: StatutConformite;
  /** Qui doit trancher : l'avis d'un professionnel est requis. */
  avis?: string;
}

const POINTS: PointEntreprise[] = [
  {
    cle: 'sasu',
    titre: 'Mentions SASU sur tous les documents',
    description: 'Mandats, factures, relevés, CGV et site : « Label Maison Conciergerie SASU », SIRET 993 428 200 00014, siège à Villabé. Jamais « micro-entreprise ».',
    action: 'Relire les modèles de mandat et de facture, corriger toute mention héritée de l’ancien statut.',
    statutInitial: 'a_faire',
  },
  {
    cle: 'hoguet',
    titre: 'Carte professionnelle (carte G, loi Hoguet)',
    description: 'Encaisser des loyers pour le compte de propriétaires ou rechercher des locataires peut relever de la loi Hoguet (carte G, garantie financière, compte séquestre).',
    action: 'Faire valider la position par un avocat avant tout nouveau mandat avec encaissement.',
    statutInitial: 'risque',
    avis: 'À valider avec un avocat',
  },
  {
    cle: 'tva',
    titre: 'Régime de TVA',
    description: 'Franchise en base ou TVA sur commissions et frais de ménage : le régime conditionne les factures et les prix affichés.',
    action: 'Confirmer le régime et le taux applicable avec l’expert-comptable, puis ajuster les modèles de facture.',
    statutInitial: 'a_faire',
    avis: 'À valider avec l’expert-comptable',
  },
  {
    cle: 'cfe',
    titre: 'CFE (cotisation foncière des entreprises)',
    description: 'Due par la SASU au titre de son siège, avec exonération possible la première année.',
    action: 'Vérifier l’avis dans l’espace professionnel impots.gouv.fr et noter l’échéance de décembre.',
    statutInitial: 'a_faire',
  },
  {
    cle: 'rcpro',
    titre: 'RC Pro Label Maison',
    description: 'Assurance responsabilité civile professionnelle de la conciergerie (mensualité suivie dans les charges).',
    action: 'Vérifier que le contrat couvre la gestion de courte durée et la garde des clés, et suivre l’échéance.',
    statutInitial: 'ok',
  },
  {
    cle: 'rgpd',
    titre: 'RGPD : données voyageurs',
    description: 'Données des voyageurs et des propriétaires hébergées dans l’Union européenne, registre des traitements, durée de conservation, mentions d’information.',
    action: 'Créer le projet Supabase en région UE, tenir le registre et publier la politique de confidentialité à jour.',
    statutInitial: 'a_faire',
  },
];

const CLE = 'lm-erp-conformite-entreprise';

function lire(): Record<string, StatutConformite> {
  try {
    return JSON.parse(window.localStorage.getItem(CLE) ?? '{}') as Record<string, StatutConformite>;
  } catch {
    return {};
  }
}

/** Obligations de la société. Statuts tenus localement (à brancher sur la base). */
export function ConformiteEntreprise() {
  const [statuts, setStatuts] = useState<Record<string, StatutConformite>>(lire);
  useEffect(() => {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(statuts));
    } catch {
      /* stockage indisponible : l'état reste en mémoire */
    }
  }, [statuts]);

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {POINTS.map((p) => {
        const statut = statuts[p.cle] ?? p.statutInitial;
        return (
          <li key={p.cle}>
            <Card className="h-full">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-[14.5px] font-semibold">{p.titre}</h3>
                <Badge tone={TON_STATUT[statut]} point>
                  {LIBELLE_STATUT[statut]}
                </Badge>
              </div>
              {p.avis && (
                <p className="mt-1">
                  <Badge tone="info">{p.avis}</Badge>
                </p>
              )}
              <p className="mt-2 text-[13px] text-(--lm-encre-2)">{p.description}</p>
              <p className="mt-2 text-[13px]">
                <span className="font-medium">Prochaine action : </span>
                {p.action}
              </p>
              <div className="mt-3 w-40">
                <Select
                  aria-label={`Statut : ${p.titre}`}
                  value={statut}
                  onChange={(e) => setStatuts((s) => ({ ...s, [p.cle]: e.target.value as StatutConformite }))}
                  options={(['ok', 'a_faire', 'risque'] as const).map((s) => ({ valeur: s, libelle: LIBELLE_STATUT[s] }))}
                />
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
