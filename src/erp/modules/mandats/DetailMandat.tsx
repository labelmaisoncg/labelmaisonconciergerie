import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CheckCircle2, FileText, Pencil, Send } from 'lucide-react';
import { Alert, Badge, Button, Drawer, Field, Modal, Textarea, StatusBadge } from '../../ui';
import { useErp } from '../../data/store';
import { COMMISSION_CIBLE_MIN } from '../../data/constantes';
import { AUJOURDHUI, ajouterJours, dateCourte, euros } from '../../data/format';
import { logementById, proprietaireById } from '../../data/selectors';
import type { Mandat } from '../../data/types';
import { ApercuContrat } from './_composants/Contrat';
import { NON_SOLLICITATION_MOIS, SOCIETE } from './_composants/societe';

function Clause({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="py-2.5">
      <dt className="text-[12px] font-medium tracking-wide text-(--lm-encre-3) uppercase">{titre}</dt>
      <dd className="mt-0.5 text-[13.5px] text-(--lm-encre)">{children}</dd>
    </div>
  );
}

interface Props {
  mandat?: Mandat;
  onFermer: () => void;
  onModifier: (m: Mandat) => void;
}

export function DetailMandat({ mandat: m, onFermer, onModifier }: Props) {
  const d = useErp();
  const [contrat, setContrat] = useState(false);
  const [resiliation, setResiliation] = useState(false);
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [info, setInfo] = useState<string>();

  useEffect(() => {
    setInfo(undefined);
    setErreur(undefined);
  }, [m?.id]);

  if (!m) return null;
  const p = proprietaireById(d, m.proprietaireId);
  const l = logementById(d, m.logementId);
  const sousCible = m.commissionPct < COMMISSION_CIBLE_MIN;

  const envoyer = () => {
    d.upsert('mandats', { ...m, statut: 'envoye' });
    setInfo('Mandat marqué comme envoyé au propriétaire.');
  };
  const signer = () => {
    d.upsert('mandats', { ...m, statut: 'signe', signeLe: AUJOURDHUI });
    if (l) d.cocherChecklistLancement(l.id, 'mandat_signe', true, `Mandat ${m.reference} signé le ${dateCourte(AUJOURDHUI)}`);
    setInfo('Mandat signé : le point « Mandat de gestion signé » de la checklist de lancement est coché.');
  };
  const resilier = () => {
    if (motif.trim().length < 5) {
      setErreur('Indiquez le motif de résiliation (5 caractères minimum).');
      return;
    }
    const fin = m.periodeEssaiFin && m.periodeEssaiFin >= AUJOURDHUI ? AUJOURDHUI : ajouterJours(AUJOURDHUI, m.preavisJours);
    d.upsert('mandats', { ...m, statut: 'resilie', resilieLe: AUJOURDHUI, dateFin: fin, motifResiliation: motif.trim() });
    setResiliation(false);
    setMotif('');
    setErreur(undefined);
    setInfo(`Mandat résilié, fin effective le ${dateCourte(fin)}.`);
  };

  return (
    <>
      <Drawer
        ouvert
        onFermer={onFermer}
        titre={m.reference}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge type="statutMandat" valeur={m.statut} />
            {sousCible && <Badge tone="alerte">Sous la cible</Badge>}
            {m.signeLe && <span>Signé le {dateCourte(m.signeLe)}</span>}
          </span>
        }
        pied={
          <>
            {m.statut !== 'resilie' && (
              <Button variant="ghost" icone={<Ban />} onClick={() => setResiliation(true)} className="text-(--lm-danger) sm:mr-auto">
                Résilier
              </Button>
            )}
            {m.statut === 'brouillon' && (
              <Button icone={<Send />} onClick={envoyer}>
                Marquer envoyé
              </Button>
            )}
            {(m.statut === 'brouillon' || m.statut === 'envoye') && (
              <Button variant="primary" icone={<CheckCircle2 />} onClick={signer}>
                Marquer signé
              </Button>
            )}
          </>
        }
      >
        {info && (
          <Alert tone="succes" className="mb-4">
            {info}
          </Alert>
        )}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="primary" icone={<FileText />} onClick={() => setContrat(true)}>
            Générer le contrat
          </Button>
          {m.statut !== 'resilie' && (
            <Button icone={<Pencil />} onClick={() => onModifier(m)}>
              Modifier
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 divide-y divide-(--lm-bord) sm:grid-cols-2 sm:divide-y-0">
          <Clause titre="Propriétaire">
            {p ? <Link className="text-(--lm-or) hover:underline" to={`/erp/proprietaires/${p.id}`}>{p.nom}</Link> : 'Inconnu'}
          </Clause>
          <Clause titre="Logement">
            {l ? <Link className="text-(--lm-or) hover:underline" to={`/erp/logements/${l.id}`}>{l.nom}</Link> : 'Inconnu'}
          </Clause>
        </dl>

        <h3 className="mt-4 mb-1 text-[14px] font-semibold">Clauses clés</h3>
        <dl className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord) px-4">
          <Clause titre="Commission">
            <span className="lm-chiffres font-semibold">{m.commissionPct} %</span> des revenus d’hébergement, après commission plateforme et frais de ménage.
            {sousCible && (
              <span className="mt-1 block text-[12.5px] text-(--lm-alerte)">
                Sous la cible de {COMMISSION_CIBLE_MIN} à 20 % : à renégocier au renouvellement.
              </span>
            )}
          </Clause>
          <Clause titre="Frais de ménage">
            <span className="lm-chiffres font-semibold">{euros(m.fraisMenageCentimes)}</span> par séjour, facturés au voyageur et acquis au gestionnaire.
          </Clause>
          <Clause titre="Durée">
            Du {dateCourte(m.dateDebut)} {m.dateFin ? `au ${dateCourte(m.dateFin)}` : ', reconduction tacite annuelle'}.
          </Clause>
          <Clause titre="Période d’essai">
            {m.periodeEssaiFin ? `Jusqu’au ${dateCourte(m.periodeEssaiFin)}${m.periodeEssaiFin < AUJOURDHUI ? ' (terminée)' : ''}, résiliable sans préavis.` : 'Aucune.'}
          </Clause>
          <Clause titre="Préavis de résiliation">{m.preavisJours} jours, par lettre recommandée.</Clause>
          <Clause titre="Non-sollicitation">
            Le propriétaire ne contracte pas directement avec les voyageurs et prestataires présentés, pendant le mandat et {NON_SOLLICITATION_MOIS} mois après.
          </Clause>
          <Clause titre="Annonces">Le propriétaire ne modifie pas l’annonce sans concertation.</Clause>
          <Clause titre="Gestionnaire">
            {SOCIETE.nom}, {SOCIETE.forme}, SIRET {SOCIETE.siret}, {SOCIETE.adresse}.
          </Clause>
          {m.statut === 'resilie' && (
            <Clause titre="Résiliation">
              Le {m.resilieLe ? dateCourte(m.resilieLe) : 'date inconnue'}
              {m.motifResiliation ? ` : ${m.motifResiliation}` : ''}
            </Clause>
          )}
        </dl>
      </Drawer>

      <ApercuContrat ouvert={contrat} onFermer={() => setContrat(false)} mandat={m} proprietaire={p} logement={l} />

      <Modal
        ouvert={resiliation}
        onFermer={() => setResiliation(false)}
        taille="sm"
        titre="Résilier le mandat"
        description={
          m.periodeEssaiFin && m.periodeEssaiFin >= AUJOURDHUI
            ? 'En période d’essai : fin effective immédiate.'
            : `Préavis de ${m.preavisJours} jours : fin effective le ${dateCourte(ajouterJours(AUJOURDHUI, m.preavisJours))}.`
        }
        pied={
          <>
            <Button onClick={() => setResiliation(false)}>Annuler</Button>
            <Button variant="danger" onClick={resilier}>
              Confirmer la résiliation
            </Button>
          </>
        }
      >
        <Field label="Motif de résiliation" requis erreur={erreur}>
          <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Ex. vente du bien, reprise pour usage personnel" />
        </Field>
        {l?.statut === 'actif' && (
          <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">
            Pensez à passer « {l.nom} » en pause ou sorti à la date de fin et à fermer les calendriers.
          </p>
        )}
      </Modal>
    </>
  );
}
