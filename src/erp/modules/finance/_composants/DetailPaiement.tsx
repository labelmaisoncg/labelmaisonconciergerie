import { useState } from 'react';
import { Ban, CheckCircle2, Unlock } from 'lucide-react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, euros, jourMois, moisAnnee, pluriel, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { logementById, missionValidable, prestataireConforme } from '../../../data/selectors';
import type { Mission, PaiementPrestataire } from '../../../data/types';
import { Alert, Badge, Button, Drawer, Field, Input, StatusBadge, Textarea } from '../../../ui';
import type { LignePaiement } from './paiements';

export function BadgePaiement({ ligne }: { ligne: LignePaiement }) {
  return ligne.statut === 'a_preparer' ? <Badge tone="neutre">Rien à payer</Badge> : <StatusBadge type="statutPaiement" valeur={ligne.statut} />;
}

export function DetailPaiement({ ligne, onFermer }: { ligne: LignePaiement; onFermer: () => void }) {
  const d = useErp();
  const [retenue, setRetenue] = useState(ligne.retenue ? String(ligne.retenue / 100).replace('.', ',') : '');
  const [motif, setMotif] = useState(ligne.paiement?.motifRetenue ?? '');
  const [erreur, setErreur] = useState<string>();
  const paye = ligne.statut === 'paye';
  const retenueCentimes = retenue.trim() ? versCentimes(retenue) : 0;
  const net = ligne.montant - (Number.isFinite(retenueCentimes) ? retenueCentimes : 0);
  const conformite = prestataireConforme(ligne.prestataire);

  const enregistrer = (statut: PaiementPrestataire['statut']) => {
    if (!Number.isFinite(retenueCentimes) || retenueCentimes < 0) return setErreur('Montant de retenue invalide.');
    if (retenueCentimes > ligne.montant) return setErreur('La retenue ne peut pas dépasser le montant validé.');
    if ((retenueCentimes > 0 || statut === 'bloque') && !motif.trim())
      return setErreur(statut === 'bloque' ? 'Indiquez le motif du blocage.' : 'Indiquez le motif de la retenue.');
    if (statut === 'paye' && !ligne.validees.length)
      return setErreur('Aucun ménage vérifié sur cette période : rien à payer pour l’instant. Vérifiez d’abord les ménages terminés.');
    d.upsert('paiementsPrestataires', {
      id: ligne.paiement?.id ?? nouvelId('pay'),
      prestataireId: ligne.prestataire.id,
      periode: ligne.periode,
      missions: ligne.validees.map((m) => m.id),
      montantCentimes: ligne.montant,
      retenueCentimes,
      motifRetenue: motif.trim() || undefined,
      statut,
      payeLe: statut === 'paye' ? AUJOURDHUI : undefined,
    });
    setErreur(undefined);
  };

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={ligne.prestataire.nom}
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          <BadgePaiement ligne={ligne} /> Paiement de {moisAnnee(ligne.periode)}
        </span>
      }
      pied={
        paye ? undefined : ligne.statut === 'bloque' ? (
          <Button icone={<Unlock />} onClick={() => enregistrer('a_payer')}>
            Débloquer
          </Button>
        ) : (
          <>
            <Button variant="danger" icone={<Ban />} onClick={() => enregistrer('bloque')}>
              Bloquer
            </Button>
            <Button variant="primary" icone={<CheckCircle2 />} onClick={() => enregistrer('paye')} disabled={!ligne.validees.length}>
              Marquer payé {euros(net)}
            </Button>
          </>
        )
      }
    >
      {erreur && (
        <Alert tone="danger" className="mb-4" titre="Action impossible">
          {erreur}
        </Alert>
      )}
      {paye && ligne.paiement?.payeLe && (
        <Alert tone="succes" className="mb-4" titre={`Payé le ${dateCourte(ligne.paiement.payeLe)}`}>
          Montant figé au moment du paiement.
        </Alert>
      )}
      {ligne.statut === 'bloque' && (
        <Alert tone="danger" className="mb-4" titre="Paiement bloqué">
          {ligne.paiement?.motifRetenue ?? 'Motif non renseigné.'}
        </Alert>
      )}
      {!conformite.ok && (
        <Alert tone="alerte" className="mb-4" titre="Documents du prestataire à régulariser">
          {conformite.raisons.join(' ')}
        </Alert>
      )}

      <dl className="lm-chiffres mb-5 space-y-1 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 text-[13.5px]">
        <div className="flex justify-between">
          <dt className="text-(--lm-encre-2)">{pluriel(ligne.validees.length, 'mission validée', 'missions validées')}</dt>
          <dd>{euros(ligne.montant)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-(--lm-encre-2)">Retenue</dt>
          <dd>{retenueCentimes > 0 ? `- ${euros(retenueCentimes)}` : '-'}</dd>
        </div>
        <div className="flex justify-between border-t border-(--lm-bord-fort) pt-1 text-[15px] font-semibold">
          <dt>Total à verser</dt>
          <dd>{euros(net)}</dd>
        </div>
      </dl>

      {!paye && (
        <div className="mb-5 grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="Retenue (€)">
            <Input inputMode="decimal" placeholder="0" value={retenue} onChange={(e) => setRetenue(e.target.value)} />
          </Field>
          <Field label="Motif (retenue ou blocage)" aide="Obligatoire dès qu’une retenue est appliquée.">
            <Textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} />
          </Field>
        </div>
      )}

      <ListeMissions titre="Missions validées, payées" missions={ligne.validees} />
      <ListeMissions titre="Missions non validées, exclues du paiement" missions={ligne.exclues} exclues />
    </Drawer>
  );
}

function ListeMissions({ titre, missions, exclues }: { titre: string; missions: Mission[]; exclues?: boolean }) {
  const d = useErp();
  return (
    <section className="mb-5">
      <h3 className="mb-2 flex items-center justify-between text-[13.5px] font-semibold">
        {titre}
        <span className="lm-chiffres text-(--lm-encre-2)">{missions.length}</span>
      </h3>
      {missions.length === 0 ? (
        <p className="text-[13px] text-(--lm-encre-3)">Aucune.</p>
      ) : (
        <ul className="divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)">
          {missions.map((m) => {
            const verdict = missionValidable(m);
            return (
              <li key={m.id} className="px-3 py-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="lm-chiffres w-16 shrink-0 text-(--lm-encre-2)">{jourMois(m.date)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {LIBELLES.typeMission[m.type]} · {logementById(d, m.logementId)?.nom ?? 'Logement inconnu'}
                  </span>
                  {exclues && <StatusBadge type="statutMission" valeur={m.statut} />}
                  <span className={`lm-chiffres ${exclues ? 'text-(--lm-encre-3) line-through' : ''}`}>{euros(m.tarifCentimes)}</span>
                </div>
                {exclues && !verdict.ok && <p className="mt-0.5 pl-18 text-[12px] text-(--lm-alerte)">{verdict.raisons.join(' ')}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
