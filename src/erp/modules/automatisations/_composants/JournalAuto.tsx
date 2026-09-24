import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Info, Zap } from 'lucide-react';
import { LIBELLES_DOMAINES, ORDRE_DOMAINES, REGLES, type EvenementAuto, type NiveauEvenement } from '../../../automatisations';
import { dateHeure } from '../../../data/format';
import { Button, Card, CardHeader, EmptyState, FilterChips, TON_LAVIS, cn, type Ton } from '../../../ui';

const NIVEAUX: { cle: NiveauEvenement; libelle: string; ton: Ton; icone: typeof Info }[] = [
  { cle: 'alerte', libelle: 'Alertes', ton: 'alerte', icone: AlertTriangle },
  { cle: 'action', libelle: 'Actions', ton: 'succes', icone: Zap },
  { cle: 'info', libelle: 'Infos', ton: 'info', icone: Info },
];

/** Où traiter l'entité concernée. */
const LIENS: Record<string, string> = {
  mission: '/erp/menages',
  missions: '/erp/menages',
  incident: '/erp/incidents',
  incidents: '/erp/incidents',
  prestataire: '/erp/prestataires',
  paiement: '/erp/finance',
  facture: '/erp/finance',
  logement: '/erp/logements',
  prospect: '/erp/commercial',
  message: '/erp/messagerie',
  proprietaire: '/erp/proprietaires',
  linge: '/erp/linge?vue=journal',
};

/** Lien direct vers la fiche quand elle existe, sinon vers le module. */
function lienDe(entite: string, id: string): string | undefined {
  if (!id) return LIENS[entite];
  if (entite === 'mission' || entite === 'missions') return `/erp/menages/${id}`;
  if (entite === 'incident' || entite === 'incidents') return `/erp/incidents?id=${id}`;
  if (entite === 'prestataire') return `/erp/prestataires/${id}`;
  if (entite === 'logement') return `/erp/logements/${id}`;
  if (entite === 'proprietaire') return `/erp/proprietaires/${id}`;
  if (entite === 'message') return `/erp/messagerie/${id}`;
  return LIENS[entite];
}

const PAS = 40;

export interface JournalAutoProps {
  evenements: EvenementAuto[];
  onVider?: () => void;
}

/** Journal des automatisations, filtrable par niveau et par domaine. */
export function JournalAuto({ evenements, onVider }: JournalAutoProps) {
  const [niveaux, setNiveaux] = useState<string[]>([]);
  const [domaines, setDomaines] = useState<string[]>([]);
  const [limite, setLimite] = useState(PAS);
  const domaineDe = (cle: string) => REGLES.find((r) => r.cle === cle)?.domaine;
  const nomDe = (cle: string) => REGLES.find((r) => r.cle === cle)?.nom ?? cle;

  const filtres = evenements.filter(
    (e) => (!niveaux.length || niveaux.includes(e.niveau)) && (!domaines.length || domaines.includes(domaineDe(e.regle) ?? '')),
  );

  return (
    <Card>
      <CardHeader
        titre="Journal des automatisations"
        description="Ce que l’ERP a fait ou constaté. Les alertes sont les exceptions à traiter."
        actions={onVider && evenements.length > 0 ? <Button size="sm" variant="ghost" onClick={onVider}>Vider</Button> : undefined}
      />
      <div className="mb-3 flex flex-col gap-2">
        <FilterChips
          label="Filtrer par niveau"
          filtres={NIVEAUX.map((n) => ({ cle: n.cle, libelle: n.libelle, compteur: evenements.filter((e) => e.niveau === n.cle).length }))}
          actifs={niveaux}
          onChange={setNiveaux}
        />
        <FilterChips
          label="Filtrer par domaine"
          filtres={ORDRE_DOMAINES.map((d) => ({ cle: d, libelle: LIBELLES_DOMAINES[d] }))}
          actifs={domaines}
          onChange={setDomaines}
        />
      </div>
      {filtres.length === 0 ? (
        <EmptyState titre="Rien à signaler" description="Aucun événement ne correspond à ces filtres." icone={<Zap />} />
      ) : (
        <ul className="divide-y divide-(--lm-bord)">
          {filtres.slice(0, limite).map((e) => {
            const n = NIVEAUX.find((x) => x.cle === e.niveau) ?? NIVEAUX[2];
            const Icone = n.icone;
            const lien = lienDe(e.entite, e.entiteId);
            const domaine = domaineDe(e.regle);
            return (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <span aria-hidden className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md [&_svg]:size-4', TON_LAVIS[n.ton])}>
                  <Icone />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-(--lm-encre)">
                    <span className="sr-only">{n.libelle} : </span>
                    {e.message}
                  </p>
                  <p className="mt-0.5 text-[12px] text-(--lm-encre-3)">
                    <span className="lm-chiffres">{dateHeure(e.horodatage)}</span> · {nomDe(e.regle)}
                    {domaine && ` · ${LIBELLES_DOMAINES[domaine]}`}
                  </p>
                </div>
                {lien && (
                  <Link to={lien} className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded text-[12.5px] font-medium text-(--lm-or) hover:text-(--lm-brun)">
                    Ouvrir <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {filtres.length > limite && (
        <div className="mt-3 text-center">
          <Button size="sm" onClick={() => setLimite((l) => l + PAS)}>Afficher plus ({filtres.length - limite})</Button>
        </div>
      )}
    </Card>
  );
}
