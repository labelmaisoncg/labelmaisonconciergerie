import { Link, useNavigate } from 'react-router-dom';
import { AUJOURDHUI, SANS_DONNEE, ajouterJours, dateCourte, euros, moisAnnee, nombre, note, pourcentage } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { Incident, Mission, PaiementPrestataire, Prestataire } from '../../../data/types';
import { Card, CardHeader, Stat, StatusBadge, Table, type Colonne } from '../../../ui';

const missionsDe = (missions: Mission[], id: string) => missions.filter((m) => m.prestataireId === id);

/** Historique des missions du prestataire. */
export function Missions({ prestataire: p }: { prestataire: Prestataire }) {
  const { missions, logements } = useErp();
  const naviguer = useNavigate();
  const colonnes: Colonne<Mission>[] = [
    { cle: 'date', titre: 'Date', rendu: (m) => <span className="lm-chiffres whitespace-nowrap">{dateCourte(m.date)}</span>, tri: (a, b) => a.date.localeCompare(b.date) },
    { cle: 'logement', titre: 'Logement', rendu: (m) => <span className="font-medium">{logements.find((l) => l.id === m.logementId)?.nom}</span> },
    { cle: 'type', titre: 'Type', rendu: (m) => LIBELLES.typeMission[m.type], masquerMobile: true },
    { cle: 'statut', titre: 'Statut', rendu: (m) => <StatusBadge type="statutMission" valeur={m.statut} /> },
    { cle: 'photos', titre: 'Photos', masquerMobile: true, rendu: (m) => <span className="lm-chiffres">{m.photos.filter((x) => x.moment === 'avant').length}/{m.photos.filter((x) => x.moment === 'apres').length}</span> },
    { cle: 'controle', titre: 'Contrôle', masquerMobile: true, rendu: (m) => (m.noteControle !== undefined ? <span className="lm-chiffres">{m.noteControle}/5</span> : '-') },
    { cle: 'tarif', titre: 'Tarif', align: 'droite', rendu: (m) => <span className="lm-chiffres">{euros(m.tarifCentimes)}</span> },
  ];
  return (
    <Table
      colonnes={colonnes}
      lignes={missionsDe(missions, p.id)}
      cleLigne={(m) => m.id}
      onLigneClick={(m) => naviguer(`/erp/menages/${m.id}`)}
      triInitial={{ cle: 'date', sens: 'desc' }}
      legende="Missions du prestataire"
      dense
      vide="Aucune mission pour ce prestataire."
    />
  );
}

/** Indicateurs qualité : notes, refus, retards de preuves, incidents liés. */
export function Qualite({ prestataire: p }: { prestataire: Prestataire }) {
  const { missions, incidents, reservations, logements } = useErp();
  const siennes = missionsDe(missions, p.id);
  const passees = siennes.filter((m) => m.date < AUJOURDHUI && m.statut !== 'annulee');
  const validees = passees.filter((m) => m.statut === 'validee').length;
  const refusees = siennes.filter((m) => m.statut === 'refusee');
  const retards = siennes.filter((m) => (m.statut === 'a_valider' || m.statut === 'en_cours') && m.date < ajouterJours(AUJOURDHUI, -1));
  const controles = siennes.filter((m) => m.noteControle !== undefined);
  const moyControle = controles.length ? controles.reduce((s, m) => s + m.noteControle!, 0) / controles.length : undefined;
  const sejours = new Set(siennes.map((m) => m.reservationId).filter(Boolean));
  const notesVoyageurs = reservations.filter((r) => sejours.has(r.id) && r.noteVoyageur !== undefined);
  const lies: Incident[] = incidents.filter((i) => i.refacturable === 'prestataire' && (i.reservationId ? sejours.has(i.reservationId) : false));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Note moyenne" valeur={p.noteMoyenne === undefined ? SANS_DONNEE : note(p.noteMoyenne)} aide={`${notesVoyageurs.length} séjours notés`} />
        <Stat label="Contrôles physiques" valeur={moyControle === undefined ? SANS_DONNEE : `${note(moyControle)}/5`} aide={`${controles.length} contrôles`} />
        <Stat label="Taux de validation" valeur={passees.length ? pourcentage(validees / passees.length) : SANS_DONNEE} aide={`${nombre(validees)} validées sur ${nombre(passees.length)}`} />
        <Stat label="Refus et retards" valeur={nombre(refusees.length + retards.length)} tone={refusees.length + retards.length ? 'danger' : 'succes'} aide={`${refusees.length} refus, ${retards.length} preuves en retard`} />
      </div>
      <Card flush>
        <CardHeader className="px-4 pt-4 sm:px-5" titre="Refus, retards et incidents imputés" />
        <ul className="divide-y divide-(--lm-bord) text-[13px]">
          {[...refusees, ...retards].map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
              <StatusBadge type="statutMission" valeur={m.statut} />
              <Link className="font-medium hover:text-(--lm-or) hover:underline" to={`/erp/menages/${m.id}`}>
                {logements.find((l) => l.id === m.logementId)?.nom}, {dateCourte(m.date)}
              </Link>
              <span className="text-(--lm-encre-2)">{m.commentaire ?? (m.statut === 'refusee' ? 'Refusée' : 'Preuves non transmises après 24 h')}</span>
            </li>
          ))}
          {lies.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
              <StatusBadge type="gravite" valeur={i.gravite} />
              <Link className="font-medium hover:text-(--lm-or) hover:underline" to={`/erp/incidents?id=${i.id}`}>Incident du {dateCourte(i.date)}</Link>
              <span className="line-clamp-1 text-(--lm-encre-2)">{i.description}</span>
            </li>
          ))}
          {!refusees.length && !retards.length && !lies.length && <li className="px-4 py-3 text-(--lm-encre-3) sm:px-5">Aucun refus, retard ni incident imputé.</li>}
        </ul>
      </Card>
    </div>
  );
}

/** Paiements du prestataire (le détail et le règlement sont dans Finance). */
export function Paiements({ prestataire: p }: { prestataire: Prestataire }) {
  const { paiementsPrestataires, missions } = useErp();
  const siens = paiementsPrestataires.filter((x) => x.prestataireId === p.id);
  const nonPayables = missionsDe(missions, p.id).filter((m) => m.date < AUJOURDHUI && ['a_valider', 'en_cours', 'refusee'].includes(m.statut)).length;
  const colonnes: Colonne<PaiementPrestataire>[] = [
    { cle: 'periode', titre: 'Période', rendu: (x) => <span className="inline-block first-letter:uppercase">{moisAnnee(x.periode)}</span>, tri: (a, b) => a.periode.localeCompare(b.periode) },
    { cle: 'missions', titre: 'Missions', align: 'droite', rendu: (x) => <span className="lm-chiffres">{x.missions.length}</span> },
    { cle: 'montant', titre: 'Montant', align: 'droite', rendu: (x) => <span className="lm-chiffres">{euros(x.montantCentimes)}</span> },
    { cle: 'retenue', titre: 'Retenue', align: 'droite', masquerMobile: true, rendu: (x) => (x.retenueCentimes ? <span className="lm-chiffres text-(--lm-danger)" title={x.motifRetenue}>-{euros(x.retenueCentimes)}</span> : '-') },
    { cle: 'statut', titre: 'Statut', rendu: (x) => <StatusBadge type="statutPaiement" valeur={x.statut} /> },
    { cle: 'paye', titre: 'Payé le', masquerMobile: true, rendu: (x) => (x.payeLe ? dateCourte(x.payeLe) : '-') },
  ];
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-(--lm-encre-2)">
        Seules les missions validées sont payées (règle 2.4).{' '}
        {nonPayables > 0 && <strong className="text-(--lm-alerte)">{nonPayables} mission{nonPayables > 1 ? 's' : ''} passée{nonPayables > 1 ? 's' : ''} non payable{nonPayables > 1 ? 's' : ''} en l’état.</strong>}{' '}
        <Link to="/erp/finance" className="text-(--lm-or) hover:underline">Voir dans Finance</Link>
      </p>
      <Table colonnes={colonnes} lignes={siens} cleLigne={(x) => x.id} triInitial={{ cle: 'periode', sens: 'desc' }} legende="Paiements" dense vide="Aucun paiement enregistré." />
    </div>
  );
}
