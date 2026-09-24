import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Hand, HandCoins, RotateCcw } from 'lucide-react';
import { AUJOURDHUI, dateCourte, euros, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { Incident, Refacturable } from '../../../data/types';
import { Alert, Badge, Button, Card, Drawer, Field, Input, Select, StatusBadge, Vignette } from '../../../ui';

interface Props {
  incident: Incident | undefined;
  onFermer: () => void;
}

function Ligne({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-(--lm-encre-2)">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

const lien = 'text-(--lm-or) hover:underline';

/** Détail d'un incident : preuves, prise en charge, résolution et refacturation. */
export function IncidentDrawer({ incident: i, onFermer }: Props) {
  const d = useErp();
  const [cout, setCout] = useState('');
  const [refacturable, setRefacturable] = useState<Refacturable>('aucun');
  const [date, setDate] = useState(AUJOURDHUI);
  const [erreur, setErreur] = useState<string | null>(null);
  const [retour, setRetour] = useState<string | null>(null);

  useEffect(() => {
    setCout(i?.coutCentimes !== undefined ? String(i.coutCentimes / 100).replace('.', ',') : '');
    setRefacturable(i?.refacturable ?? 'aucun');
    setDate(AUJOURDHUI);
    setErreur(null);
    setRetour(null);
  }, [i?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!i) return null;

  const logement = d.logements.find((l) => l.id === i.logementId);
  const sejour = d.reservations.find((r) => r.id === i.reservationId);
  const mission = sejour ? d.missions.find((m) => m.reservationId === sejour.id && m.type === 'menage') : undefined;

  const prendre = () => {
    d.upsert('incidents', { ...i, statut: 'en_cours', responsable: i.responsable ?? d.utilisateur.nom });
    setRetour('Incident pris en charge.');
  };
  const resoudre = () => {
    const c = cout.trim() ? versCentimes(cout) : undefined;
    if (c !== undefined && (Number.isNaN(c) || c < 0)) return setErreur('Coût invalide.');
    if (refacturable !== 'aucun' && !c) return setErreur('Indiquez le coût à refacturer.');
    if (refacturable !== 'aucun' && !i.preuves.length) return setErreur('Refacturation impossible sans preuve : ajoutez une photo ou un document.');
    d.upsert('incidents', { ...i, refacturable });
    const r = d.resoudreIncident(i.id, { coutCentimes: c, date });
    if (!r.ok) return setErreur(r.erreur);
    setErreur(null);
    setRetour('Incident résolu.');
  };
  const rouvrir = () => {
    d.upsert('incidents', { ...i, statut: 'en_cours', resoluLe: undefined, recupereLe: undefined });
    setRetour('Incident rouvert.');
  };
  const recuperer = () => {
    const r = d.marquerIncidentRecupere(i.id);
    if (!r.ok) return setErreur(r.erreur);
    setErreur(null);
    setRetour('Somme refacturée marquée récupérée.');
  };
  const aRecuperer = i.statut === 'resolu' && i.refacturable !== 'aucun' && !i.recupereLe;

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={`${LIBELLES.categorieIncident[i.categorie]} · ${logement?.nom ?? ''}`}
      sousTitre={
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge type="statutIncident" valeur={i.statut} />
          <StatusBadge type="gravite" valeur={i.gravite} />
          <span>Constaté le {dateCourte(i.date)}</span>
        </span>
      }
      pied={
        i.statut === 'resolu' ? (
          <>
            <Button icone={<RotateCcw />} onClick={rouvrir}>Rouvrir</Button>
            {aRecuperer && <Button variant="primary" icone={<HandCoins />} onClick={recuperer}>Marquer récupéré</Button>}
          </>
        ) : i.statut === 'ouvert' ? (
          <Button variant="primary" icone={<Hand />} onClick={prendre}>Prendre en charge</Button>
        ) : undefined
      }
    >
      <div className="space-y-4 text-[13px]">
        {retour && <Alert tone="succes">{retour}</Alert>}
        {erreur && i.statut === 'resolu' && <Alert tone="danger">{erreur}</Alert>}
        <p className="text-[14px] leading-relaxed text-(--lm-encre)">{i.description}</p>

        <dl className="divide-y divide-(--lm-bord)">
          <Ligne label="Logement">{logement ? <Link className={lien} to={`/erp/logements/${logement.id}`}>{logement.nom}</Link> : '-'}</Ligne>
          <Ligne label="Séjour">{sejour ? <Link className={lien} to={`/erp/reservations/${sejour.id}`}>{sejour.voyageur.nom}, {dateCourte(sejour.arrivee)}</Link> : '-'}</Ligne>
          {mission && <Ligne label="Ménage lié"><Link className={lien} to={`/erp/menages/${mission.id}`}>Mission du {dateCourte(mission.date)}</Link></Ligne>}
          <Ligne label="Responsable">{i.responsable ?? 'Non attribué'}</Ligne>
          <Ligne label="Coût">{i.coutCentimes !== undefined ? <span className="lm-chiffres">{euros(i.coutCentimes)}</span> : '-'}</Ligne>
          <Ligne label="Refacturable à"><Badge tone={i.refacturable === 'aucun' ? 'neutre' : 'or'}>{LIBELLES.refacturable[i.refacturable]}</Badge></Ligne>
          {i.resoluLe && <Ligne label="Résolu le">{dateCourte(i.resoluLe)}</Ligne>}
          {i.refacturable !== 'aucun' && i.statut === 'resolu' && (
            <Ligne label="Refacturation">
              {i.recupereLe ? <Badge tone="succes">Récupérée le {dateCourte(i.recupereLe)}</Badge> : <Badge tone="alerte">À récupérer</Badge>}
            </Ligne>
          )}
        </dl>

        <section aria-label="Preuves">
          <p className="mb-2 font-semibold">Preuves ({i.preuves.length})</p>
          {i.preuves.length ? (
            <div className="grid grid-cols-3 gap-2">
              {i.preuves.map((u, k) => (
                <a key={u} href={u.startsWith('demo://') ? undefined : u} target="_blank" rel="noreferrer">
                  <Vignette url={u} alt={`Preuve ${k + 1}`} legende={`Preuve ${k + 1}`} />
                </a>
              ))}
            </div>
          ) : (
            <p className="text-(--lm-alerte)">Aucune preuve jointe : impossible de refacturer sans photo ni document.</p>
          )}
        </section>

        {i.statut !== 'resolu' && (
          <Card className="bg-(--lm-surface-2)">
            <p className="mb-3 font-semibold">Résolution</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Coût réel (€)">
                <Input inputMode="decimal" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Refacturer à">
                <Select
                  value={refacturable}
                  onChange={(e) => setRefacturable(e.target.value as Refacturable)}
                  options={(Object.keys(LIBELLES.refacturable) as Refacturable[]).map((k) => ({ valeur: k, libelle: LIBELLES.refacturable[k] }))}
                />
              </Field>
              <Field label="Résolu le">
                <Input type="date" value={date} max={AUJOURDHUI} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
            {erreur && <Alert tone="danger" className="mt-3">{erreur}</Alert>}
            {refacturable === 'prestataire' && <p className="mt-2 text-(--lm-encre-2)">Le montant sera retenu sur le prochain paiement du prestataire (Finance).</p>}
            <Button variant="primary" className="mt-3" icone={<CheckCircle2 />} onClick={resoudre}>Marquer résolu</Button>
          </Card>
        )}
      </div>
    </Drawer>
  );
}
