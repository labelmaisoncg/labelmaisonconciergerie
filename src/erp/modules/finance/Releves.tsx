import { useMemo, useState } from 'react';
import { CheckCircle2, Printer, Send } from 'lucide-react';
import { useErp, nouvelId } from '../../data/store';
import { dateHeure, horodatageMaintenant, moisAnnee, pluriel } from '../../data/format';
import { releveProprietaire } from '../../data/selectors';
import { Alert, Badge, Button, Card, EmptyState, Field, PageHeader, Select } from '../../ui';
import { derniersMois } from './_calculs';
import { DocumentReleve } from './_composants/DocumentReleve';
import { FIL_FINANCE, type PageFinanceProps } from './_composants/types';

const ACTION_ENVOI = 'Relevé envoyé';

export default function Releves({ onglets }: PageFinanceProps) {
  const d = useErp();
  const periodes = useMemo(() => derniersMois(12).reverse(), []);
  const [periode, setPeriode] = useState(periodes[1]);

  const releves = useMemo(
    () =>
      d.proprietaires
        .map((p) => ({ proprietaire: p, releve: releveProprietaire(d, p.id, periode) }))
        .filter((x) => x.releve.lignes.length > 0),
    [d, periode],
  );
  const [choix, setChoix] = useState<string>('');
  const proprietaireId = choix && d.proprietaires.some((p) => p.id === choix) ? choix : releves[0]?.proprietaire.id ?? d.proprietaires[0]?.id;
  const proprietaire = d.proprietaires.find((p) => p.id === proprietaireId);
  const releve = useMemo(() => (proprietaireId ? releveProprietaire(d, proprietaireId, periode) : undefined), [d, proprietaireId, periode]);

  const envoi = (id: string) => d.journal.find((j) => j.action === ACTION_ENVOI && j.entiteId === `${id}:${periode}`);
  const envoiCourant = proprietaireId ? envoi(proprietaireId) : undefined;
  const restants = releves.filter((r) => !envoi(r.proprietaire.id)).length;

  const marquerEnvoye = () => {
    if (!proprietaire || !releve) return;
    d.upsert('journal', {
      id: nouvelId('jrn'),
      horodatage: horodatageMaintenant(),
      auteur: d.utilisateur.nom,
      action: ACTION_ENVOI,
      entite: 'releve',
      entiteId: `${proprietaire.id}:${periode}`,
      details: `Relevé ${moisAnnee(periode)} envoyé à ${proprietaire.nom} (${proprietaire.contact.email}).`,
    });
  };

  return (
    <>
      <style>{`@media print {
  body * { visibility: hidden !important; }
  .lm-releve-print, .lm-releve-print * { visibility: visible !important; }
  .lm-releve-print { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; box-shadow: none !important; }
}`}</style>
      <PageHeader
        fil={[...FIL_FINANCE, { libelle: 'Relevés propriétaires' }]}
        titre="Relevés propriétaires"
        sousTitre="Relevé mensuel envoyé à chaque propriétaire : réservations, montants, commissions, frais de ménage et net versé. Un relevé clair évite les litiges."
        className="lm-sans-impression"
      />
      {onglets}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lm-sans-impression flex flex-col gap-4">
          <Card>
            <div className="grid gap-3">
              <Field label="Mois du relevé">
                <Select value={periode} onChange={(e) => setPeriode(e.target.value)} options={periodes.map((p) => ({ valeur: p, libelle: moisAnnee(p) }))} />
              </Field>
              <Field label="Propriétaire">
                <Select
                  value={proprietaireId ?? ''}
                  onChange={(e) => setChoix(e.target.value)}
                  options={d.proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
                />
              </Field>
            </div>
          </Card>
          <Card flush>
            <div className="border-b border-(--lm-bord) px-4 py-3">
              <p className="text-[14px] font-semibold">À envoyer pour {moisAnnee(periode)}</p>
              <p className="text-[12.5px] text-(--lm-encre-2)">
                {restants ? `${pluriel(restants, 'relevé')} restant${restants > 1 ? 's' : ''} sur ${releves.length}` : releves.length ? 'Tous les relevés sont envoyés.' : 'Aucun séjour ce mois.'}
              </p>
            </div>
            <ul className="divide-y divide-(--lm-bord)">
              {releves.map(({ proprietaire: p, releve: r }) => {
                const e = envoi(p.id);
                const actif = p.id === proprietaireId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setChoix(p.id)}
                      aria-current={actif || undefined}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-(--lm-surface-2) ${actif ? 'bg-(--lm-or-lavis)' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium">{p.nom}</span>
                        <span className="text-[12px] text-(--lm-encre-3)">{pluriel(r.lignes.length, 'séjour')}</span>
                      </span>
                      {e ? <Badge tone="succes" icone={<CheckCircle2 />}>Envoyé</Badge> : <Badge tone="alerte" point>À envoyer</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="min-w-0">
          {proprietaire && releve ? (
            <>
              <div className="lm-sans-impression mb-3 flex flex-wrap items-center gap-2">
                <Button icone={<Printer />} onClick={() => window.print()}>
                  Imprimer ou PDF
                </Button>
                <Button variant="primary" icone={<Send />} onClick={marquerEnvoye} disabled={!!envoiCourant || releve.lignes.length === 0}>
                  {envoiCourant ? 'Déjà envoyé' : 'Marquer comme envoyé'}
                </Button>
                {envoiCourant && (
                  <span className="text-[12.5px] text-(--lm-encre-2)">
                    Envoyé le {dateHeure(envoiCourant.horodatage)} par {envoiCourant.auteur}
                  </span>
                )}
              </div>
              {releve.lignes.length === 0 && (
                <Alert tone="info" className="lm-sans-impression mb-3" titre="Aucun séjour terminé ce mois">
                  Le relevé reste utile : il confirme au propriétaire qu’aucun versement n’est dû pour {moisAnnee(periode)}.
                </Alert>
              )}
              <DocumentReleve proprietaire={proprietaire} periode={periode} releve={releve} logements={d.logements} mandats={d.mandats} />
            </>
          ) : (
            <EmptyState titre="Aucun propriétaire" description="Ajoutez un propriétaire pour produire des relevés." />
          )}
        </div>
      </div>
    </>
  );
}
