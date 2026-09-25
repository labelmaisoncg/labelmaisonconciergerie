import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, CheckCircle2, Play, RotateCcw, SearchX, Send, UserPlus, XCircle } from 'lucide-react';
import { dateHeure, dateJour, euros } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import { useErp } from '../../data/store';
import { missionValidable, prestataireConforme } from '../../data/selectors';
import type { StatutMission } from '../../data/types';
import { Alert, Badge, Button, Card, CardHeader, Checklist, EmptyState, PageHeader, StatusBadge, Timeline, type EvenementFrise } from '../../ui';
import { AttribuerModal } from './_composants/AttribuerModal';
import { ControleCarte } from './_composants/ControleCarte';
import { Photos } from './_composants/Photos';
import { RefuserModal } from './_composants/RefuserModal';
import { Retour, useRetour } from './_composants/retour';
import { Infos } from './_composants/Infos';

export function Detail() {
  const { id } = useParams();
  const d = useErp();
  const { message, setMessage, traiter, fermer } = useRetour();
  const [attribuer, setAttribuer] = useState(false);
  const [refuser, setRefuser] = useState(false);
  const m = d.missions.find((x) => x.id === id);

  if (!m)
    return (
      <>
        <PageHeader fil={[{ libelle: 'Ménages', to: '/erp/menages' }, { libelle: 'Introuvable' }]} titre="Mission introuvable" />
        <EmptyState icone={<SearchX />} titre="Cette mission n’existe pas" action={<Link to="/erp/menages" className="text-(--lm-or) underline">Retour aux ménages</Link>} />
      </>
    );

  const logement = d.logements.find((l) => l.id === m.logementId);
  const prestataire = d.prestataires.find((p) => p.id === m.prestataireId);
  const verdict = missionValidable(m);
  const verrouillee = m.statut === 'validee' || m.statut === 'annulee';
  const info = (texte: string) => setMessage({ ton: 'succes', texte });
  const statut = (s: StatutMission, texte: string) => traiter(d.changerStatutMission(m.id, s), texte);

  const frise: EvenementFrise[] = [
    ...d.journal
      .filter((j) => j.entiteId === m.id)
      .map((j) => ({ cle: j.horodatage, id: j.id, titre: j.action, meta: `${dateHeure(j.horodatage)} · ${j.auteur}`, description: j.details || undefined, tone: j.action.includes('valid') ? ('succes' as const) : ('or' as const) })),
    ...m.photos.map((p, i) => ({ cle: p.prisLe, id: `photo-${i}`, titre: `Photo ${p.moment === 'avant' ? 'avant' : 'après'} transmise`, meta: dateHeure(p.prisLe), description: undefined, tone: 'info' as const })),
  ]
    .sort((a, b) => b.cle.localeCompare(a.cle))
    .map(({ cle: _cle, ...e }) => e);

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'Ménages', to: '/erp/menages' }, { libelle: logement?.nom ?? m.id }]}
        titre={
          <span className="flex flex-wrap items-center gap-3">
            {LIBELLES.typeMission[m.type]} · {logement?.nom}
            <StatusBadge type="statutMission" valeur={m.statut} className="font-sans text-[13px]" />
          </span>
        }
        sousTitre={<span className="inline-block first-letter:uppercase">{`${dateJour(m.date)}, de ${m.heureDebut} à ${m.heureFinMax} au plus tard`}</span>}
        actions={
          <>
            {m.statut === 'a_attribuer' && <Button variant="primary" icone={<UserPlus />} onClick={() => setAttribuer(true)}>Attribuer</Button>}
            {m.statut === 'attribuee' && (
              <>
                <Button icone={<UserPlus />} onClick={() => setAttribuer(true)}>Réattribuer</Button>
                <Button variant="primary" icone={<Play />} onClick={() => statut('en_cours', 'Mission démarrée.')}>Démarrer</Button>
              </>
            )}
            {m.statut === 'en_cours' && <Button variant="primary" icone={<Send />} onClick={() => statut('a_valider', 'Mission terminée, en attente de validation.')}>Terminer</Button>}
            {m.statut === 'a_valider' && (
              <>
                <Button icone={<XCircle />} onClick={() => setRefuser(true)}>Refuser</Button>
                <Button variant="primary" icone={<CheckCircle2 />} onClick={() => traiter(d.validerMission(m.id), 'Mission validée : elle entre dans le prochain paiement du prestataire.', 'Pas de validation, pas de paiement (règle 2.4)')}>
                  Valider
                </Button>
              </>
            )}
            {m.statut === 'refusee' && <Button icone={<RotateCcw />} onClick={() => statut('en_cours', 'Repassage demandé : la mission repasse en cours.')}>Demander un repassage</Button>}
            {!verrouillee && <Button variant="ghost" icone={<Ban />} onClick={() => statut('annulee', 'Mission annulée.')}>Annuler</Button>}
          </>
        }
      />

      <Retour message={message} onFermer={fermer} />

      {(m.statut === 'a_valider' || m.statut === 'en_cours') && !verdict.ok && (
        <Alert tone="alerte" titre="Validation bloquée (règle 2.4 : pas de validation, pas de paiement)" className="mb-4">
          {verdict.raisons.join(' ')}
        </Alert>
      )}
      {m.statut === 'validee' && <Alert tone="succes" className="mb-4">Mission validée avec checklist complète et photos horodatées : payable au prestataire.</Alert>}
      {m.commentaire && <Alert tone={m.statut === 'refusee' ? 'danger' : 'info'} titre="Commentaire" className="mb-4">{m.commentaire}</Alert>}
      {prestataire && !prestataireConforme(prestataire).ok && !verrouillee && (
        <Alert tone="danger" titre="Prestataire non conforme" className="mb-4">
          {prestataire.nom} : contrat, RC Pro ou URSSAF manquant ou expiré. Réattribuez la mission.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              titre="Checklist"
              actions={m.checklist.length > 0 && <Badge tone={m.checklist.every((c) => c.fait) ? 'succes' : 'alerte'}>{m.checklist.filter((c) => c.fait).length}/{m.checklist.length}</Badge>}
            />
            {m.checklist.length ? (
              <Checklist
                elements={m.checklist}
                onToggle={verrouillee ? undefined : (i, fait) => d.upsert('missions', { ...m, checklist: m.checklist.map((c, j) => (j === i ? { ...c, fait } : c)) })}
              />
            ) : (
              <p className="text-[13px] text-(--lm-encre-3)">Pas de checklist pour cette intervention.</p>
            )}
          </Card>
          <Photos
            mission={m}
            demo={d.demo}
            onAjouter={
              verrouillee
                ? undefined
                : (ps) => {
                    const r = d.mettreAJour('missions', m.id, (x) => ({ ...x, photos: [...x.photos, ...ps] }));
                    if (r.ok) info(ps.length > 1 ? `${ps.length} photos ajoutées, horodatées maintenant.` : 'Photo ajoutée, horodatée maintenant.');
                  }
            }
          />
          <Card>
            <CardHeader titre="Historique" />
            <Timeline elements={frise} vide="Aucun événement enregistré pour cette mission." />
          </Card>
        </div>
        <div className="space-y-4">
          <Infos mission={m} tarif={euros(m.tarifCentimes)} />
          <ControleCarte key={m.id} mission={m} onMessage={info} />
        </div>
      </div>

      {attribuer && <AttribuerModal mission={m} onFermer={() => setAttribuer(false)} onSucces={info} />}
      {refuser && <RefuserModal mission={m} onFermer={() => setRefuser(false)} onSucces={(t) => setMessage({ ton: 'info', texte: t })} />}
    </>
  );
}
