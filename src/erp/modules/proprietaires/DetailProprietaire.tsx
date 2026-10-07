import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FilePlus2, Landmark, Mail, MapPin, Pencil, Phone, Printer, ScrollText } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, FilterChips, MenuActions, PageHeader, Repli, StatusBadge, Table } from '../../ui';
import { useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { AUJOURDHUI, ajouterJours, dateCourte, debutMois, euros, moisAnnee, periode as periodeDe } from '../../data/format';
import { montantTtc, proprietaireById } from '../../data/selectors';
import { VisuelLogement } from '../logements/_composants/Visuel';
import { BadgeCommission, BadgeRentabilite, economieBien } from '../logements/_composants/EconomieBien';
import { Imprimable } from '../mandats/_composants/Imprimable';
import { FormMandat } from '../mandats/FormMandat';
import { FormProprietaire } from './FormProprietaire';
import { DocumentReleve } from './_composants/Releve';
import { revenuNet12Mois } from './_composants/calculs';

const PERIODE_COURANTE = periodeDe(AUJOURDHUI);
const PERIODE_PRECEDENTE = periodeDe(ajouterJours(debutMois(AUJOURDHUI), -1));

export default function DetailProprietaire() {
  const { id } = useParams();
  const d = useErp();
  const [edition, setEdition] = useState(false);
  const [nouveauMandat, setNouveauMandat] = useState(false);
  const [periode, setPeriode] = useState(PERIODE_PRECEDENTE);
  const [impression, setImpression] = useState(false);
  const p = proprietaireById(d, id);

  if (!p) {
    return (
      <>
        <PageHeader titre="Propriétaire introuvable" fil={[{ libelle: 'Propriétaires', to: '/erp/proprietaires' }]} />
        <EmptyState titre="Ce propriétaire n’existe plus" action={<Link to="/erp/proprietaires" className="text-sm font-medium text-(--lm-or-texte) hover:underline">Retour à la liste</Link>} />
      </>
    );
  }

  const logements = d.logements.filter((l) => l.proprietaireId === p.id);
  const mandats = d.mandats.filter((m) => m.proprietaireId === p.id).sort((a, b) => b.dateDebut.localeCompare(a.dateDebut));
  const factures = d.factures.filter((f) => f.proprietaireId === p.id).sort((a, b) => b.dateEmission.localeCompare(a.dateEmission));

  const imprimer = () => {
    setImpression(true);
    window.setTimeout(() => {
      window.print();
      setImpression(false);
    }, 50);
  };

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Propriétaires', to: '/erp/proprietaires' }, { libelle: p.nom }]}
        titre={
          <span className="flex items-center gap-3">
            <Avatar nom={p.nom} taille="lg" />
            <span className="min-w-0">{p.nom}</span>
          </span>
        }
        sousTitre={`${LIBELLES.typeProprietaire[p.type]} · client depuis le ${dateCourte(p.creeLe)}`}
        actions={
          <>
            <Button icone={<Pencil />} onClick={() => setEdition(true)}>
              Modifier
            </Button>
            <MenuActions
              label="Plus"
              texte
              actions={[
                { libelle: 'Nouveau contrat', icone: <FilePlus2 />, onClick: () => setNouveauMandat(true) },
                { libelle: 'Imprimer le relevé', icone: <Printer />, onClick: imprimer },
              ]}
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader titre="Coordonnées" />
            <ul className="space-y-2.5 text-[13.5px]">
              <li className="flex items-start gap-2.5"><Mail className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden /><a href={`mailto:${p.contact.email}`} className="break-all text-(--lm-or-texte) hover:underline">{p.contact.email}</a></li>
              <li className="flex items-start gap-2.5"><Phone className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden /><a href={`tel:${p.contact.telephone.replace(/\s/g, '')}`} className="hover:underline">{p.contact.telephone}</a></li>
              <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />{p.adresse}</li>
              <li className="flex items-start gap-2.5"><Landmark className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden /><span className="lm-chiffres">{p.ibanMasque || 'IBAN non renseigné'}</span></li>
            </ul>
          </Card>
          {p.notes && (
            <Card>
              <CardHeader titre="Notes" />
              <p className="text-[13.5px] whitespace-pre-line text-(--lm-encre-2)">{p.notes}</p>
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Card>
            <CardHeader titre={`Logements (${logements.length})`} />
            {logements.length === 0 ? (
              <p className="text-sm text-(--lm-encre-3)">Pas encore de logement confié.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {logements.map((l) => {
                  const eco = economieBien(d.donnees, l.id);
                  return (
                    <li key={l.id}>
                      <Link to={`/erp/logements/${l.id}`} className="flex items-start gap-3 rounded-lg border border-(--lm-bord) p-2.5 hover:border-(--lm-or-anneau)">
                        <VisuelLogement logement={l} taille="sm" className="size-10 shrink-0 rounded-lg" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block truncate text-[13.5px] font-medium">{l.nom}</span>
                              <span className="block truncate text-[12px] text-(--lm-encre-2)">{l.ville} · {LIBELLES.typeLogement[l.type]}</span>
                            </span>
                            <StatusBadge type="statutLogement" valeur={l.statut} />
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            <BadgeCommission eco={eco} />
                            <BadgeRentabilite eco={eco} />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <section aria-label="Contrats de gestion">
            <h2 className="mb-2 text-[15px] font-semibold">Contrats de gestion</h2>
            <Table
              legende="Contrats de gestion du propriétaire"
              dense
              lignes={mandats}
              cleLigne={(m) => m.id}
              vide="Pas encore de contrat."
              colonnes={[
                { cle: 'ref', titre: 'Référence', rendu: (m) => <Link to={`/erp/mandats?mandat=${m.id}`} className="font-medium text-(--lm-or-texte) hover:underline">{m.reference}</Link> },
                { cle: 'log', titre: 'Logement', masquerMobile: true, rendu: (m) => d.logements.find((l) => l.id === m.logementId)?.nom ?? 'Inconnu' },
                {
                  cle: 'com',
                  titre: 'Commission',
                  align: 'droite',
                  rendu: (m) => (
                    <span className="inline-flex items-center gap-1.5">
                      {m.statut !== 'resilie' && m.commissionPct < COMMISSION_CIBLE_MIN && <Badge tone="alerte">Sous la cible</Badge>}
                      {m.commissionPct} %
                    </span>
                  ),
                },
                { cle: 'statut', titre: 'Statut', rendu: (m) => <StatusBadge type="statutMandat" valeur={m.statut} /> },
              ]}
            />
          </section>

          <Repli titre="Relevé mensuel" description={`Reversé sur 12 mois : ${euros(revenuNet12Mois(d, p.id), true)}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <FilterChips
              unique
              label="Période du relevé"
              actifs={[periode]}
              onChange={(a) => a[0] && setPeriode(a[0])}
              filtres={[PERIODE_PRECEDENTE, PERIODE_COURANTE].map((x) => ({
                cle: x,
                libelle: `${moisAnnee(x)}${x === PERIODE_COURANTE ? ' (en cours)' : ''}`,
              }))}
            />
              <Button size="sm" icone={<Printer />} onClick={imprimer}>Imprimer</Button>
            </div>
            <div className="rounded-lg border border-(--lm-bord) p-3 sm:p-5">
              <DocumentReleve proprietaire={p} periode={periode} />
            </div>
          </Repli>

          {factures.length > 0 && (
          <section aria-label="Factures">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Factures</h2>
              <Link to="/erp/finance" className="inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                <ScrollText className="size-3.5" aria-hidden />
                Finance
              </Link>
            </div>
            <Table
              legende="Factures du propriétaire"
              dense
              lignes={factures.slice(0, 8)}
              cleLigne={(f) => f.id}
              vide="Pas de facture."
              colonnes={[
                { cle: 'num', titre: 'Numéro', rendu: (f) => <span className="font-medium whitespace-nowrap">{f.numero}</span> },
                { cle: 'type', titre: 'Type', masquerMobile: true, rendu: (f) => LIBELLES.typeFacture[f.type] },
                { cle: 'date', titre: 'Émise le', masquerMobile: true, rendu: (f) => <span className="whitespace-nowrap">{dateCourte(f.dateEmission)}</span> },
                { cle: 'ttc', titre: 'TTC', align: 'droite', rendu: (f) => euros(montantTtc(f)) },
                { cle: 'statut', titre: 'Statut', rendu: (f) => <StatusBadge type="statutFacture" valeur={f.statut} /> },
              ]}
            />
          </section>
          )}
        </div>
      </div>

      {impression && (
        <Imprimable>
          <DocumentReleve proprietaire={p} periode={periode} />
        </Imprimable>
      )}
      <FormProprietaire ouvert={edition} onFermer={() => setEdition(false)} proprietaire={p} />
      <FormMandat ouvert={nouveauMandat} onFermer={() => setNouveauMandat(false)} preselection={{ proprietaireId: p.id }} />
    </>
  );
}
