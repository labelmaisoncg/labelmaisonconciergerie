/**
 * Onglet « Messages automatiques » de la Messagerie : quatre messages qui
 * partent tout seuls (merci pour la réservation, infos d'arrivée la veille,
 * rappel du départ, demande d'avis), chacun avec son interrupteur, son texte,
 * un aperçu et son dernier envoi ; puis l'historique (envoyés et pas envoyés).
 *
 * Éteints par défaut. Seul un gérant les allume ou les modifie. Les envois
 * sont faits par le serveur (passage planifié : src/erp/data/passage-programmes.ts),
 * jamais par cet écran. Règles : src/erp/data/messages-programmes.ts.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Check, ChevronRight, CircleAlert, KeyRound, LogOut, Minus, Star, type LucideIcon } from 'lucide-react';
import { Aide, Alert, Button, Card, CardHeader, Interrupteur, Modal, TON_LAVIS, cn, type Ton } from '../../../ui';
import { useErp } from '../../../data/store';
import { MAINTENANT, dateCourte, dateHeure, horodatageMaintenant, jourMois } from '../../../data/format';
import { espaceOuvert } from '../../../data/espaces';
import { nomPourSignature } from '../../../data/reglages';
import {
  DECLENCHEURS,
  LIBELLES_DECLENCHEURS,
  dernierEnvoi,
  historiqueEnvois,
  prochainEnvoi,
  reglagesProgrammes,
  signatureProgrammes,
} from '../../../data/messages-programmes';
import type { DeclencheurMessage, EnvoiProgramme, ModeleProgramme, ReglagesMessagesProgrammes } from '../../../data/types-programmes';
import { EditeurMessageAuto } from './EditeurMessageAuto';

const ICONES: Record<DeclencheurMessage, LucideIcon> = {
  confirmation: CalendarCheck,
  veille_arrivee: KeyRound,
  jour_depart: LogOut,
  demande_avis: Star,
};

const STATUTS: Record<EnvoiProgramme['statut'], { libelle: string; ton: Ton; icone: LucideIcon }> = {
  envoye: { libelle: 'Envoyé', ton: 'succes', icone: Check },
  en_cours: { libelle: 'En cours d’envoi', ton: 'or', icone: Minus },
  reporte: { libelle: 'Reporté', ton: 'neutre', icone: Minus },
  ignore: { libelle: 'Pas envoyé', ton: 'neutre', icone: Minus },
  echec: { libelle: 'Refusé par la plateforme', ton: 'danger', icone: CircleAlert },
  a_verifier: { libelle: 'À vérifier', ton: 'alerte', icone: CircleAlert },
};

/** « 26 sept. à 18:00 » (l'année seulement si ce n'est pas celle-ci). */
function quand(t: number | string): string {
  const iso = typeof t === 'number' ? new Date(t).toISOString() : t;
  const texte = dateHeure(iso);
  return iso.slice(0, 4) === MAINTENANT.slice(0, 4) ? texte.replace(/ \d{4} à/, ' à') : texte;
}

export function MessagesAutomatiques() {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const reglages = useMemo(() => reglagesProgrammes(d), [d]);
  const signature = signatureProgrammes(d, nomPourSignature(espaceOuvert()));
  const maintenant = useMemo(() => new Date(MAINTENANT), []);
  const [ouvert, setOuvert] = useState<DeclencheurMessage | null>(null);
  const [allumer, setAllumer] = useState<DeclencheurMessage | null>(null);
  const [tout, setTout] = useState(false);
  const historique = useMemo(() => historiqueEnvois(d.envoisProgrammes ?? []), [d.envoisProgrammes]);
  const nomLogement = (id: string) => d.logements.find((l) => l.id === id)?.nom ?? 'Logement';

  const enregistrer = (k: DeclencheurMessage, patch: Partial<ModeleProgramme>) => {
    if (!gerant) return;
    const suivant: ReglagesMessagesProgrammes = {
      ...reglages,
      modeles: { ...reglages.modeles, [k]: { ...reglages.modeles[k], ...patch } },
      majLe: horodatageMaintenant(),
      majPar: d.utilisateur.nom,
    };
    d.upsert('reglages', suivant);
  };

  const basculer = (k: DeclencheurMessage, actif: boolean) => {
    if (actif) return setAllumer(k);
    // Éteint : l'allumage suivant repartira de zéro (rien de prévu entre-temps ne partira).
    enregistrer(k, { actif: false, activeLe: undefined });
  };

  const prochainAllume = allumer ? prochainEnvoi(d, { ...reglages, modeles: { ...reglages.modeles, [allumer]: { ...reglages.modeles[allumer], actif: true, activeLe: new Date(maintenant.getTime() - 1).toISOString() } } }, allumer, maintenant) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13.5px] text-(--lm-encre-2)">Ils partent tout seuls sur la plateforme du voyageur, entre 8 h et 21 h.</p>
        <Aide className="mt-2 mb-0">
          <ul className="list-disc space-y-1 pl-5">
            <li>Chaque message part une seule fois par séjour.</li>
            <li>Rien pour une réservation annulée, ni quand le voyageur attend une réponse de l’équipe.</li>
            <li>L’accès et le wifi n’apparaissent que dans les 48 h avant l’arrivée : sinon, la ligne est retirée.</li>
            <li>« Merci pour la réservation » part seulement pour les réservations faites après l’allumage.</li>
            <li>Tout est noté dans l’historique, envoyé ou non.</li>
          </ul>
        </Aide>
      </div>

      {!gerant && <Alert tone="info" titre="Seul un gérant peut allumer ou modifier ces messages." />}

      <Card flush>
        <ul className="divide-y divide-(--lm-bord)">
          {DECLENCHEURS.map((k) => {
            const m = reglages.modeles[k];
            const Icone = ICONES[k];
            const dernier = dernierEnvoi(d.envoisProgrammes ?? [], k);
            const prochain = m.actif ? prochainEnvoi(d, reglages, k, maintenant) : null;
            const suite = !m.actif
              ? 'Éteint'
              : prochain
                ? `Prochain : ${quand(prochain.quand)}`
                : dernier
                  ? `Dernier envoi le ${jourMois((dernier.envoyeLe ?? dernier.le).slice(0, 10))}`
                  : 'Pas encore envoyé';
            return (
              <li key={k} className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOuvert(k)} className="group flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                  <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4', m.actif ? TON_LAVIS.or : TON_LAVIS.neutre)}>
                    <Icone />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-(--lm-encre) group-hover:text-(--lm-or-texte)">{LIBELLES_DECLENCHEURS[k].titre}</span>
                    <span className="block text-[12.5px] text-(--lm-encre-2)">
                      {LIBELLES_DECLENCHEURS[k].quand(m.heure)} · {suite}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                </button>
                <Interrupteur actif={m.actif} disabled={!gerant} label={`${m.actif ? 'Éteindre' : 'Allumer'} « ${LIBELLES_DECLENCHEURS[k].titre} »`} onChange={(v) => basculer(k, v)} />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card flush>
        <CardHeader className="mb-0 border-b border-(--lm-bord) px-4 pt-4 pb-3" titre="Historique" />
        {historique.length ? (
          <ul className="divide-y divide-(--lm-bord)">
            {(tout ? historique : historique.slice(0, 6)).map((e) => {
              const s = STATUTS[e.statut];
              const Icone = s.icone;
              const moment = e.envoyeLe ?? e.le;
              const detail =
                e.statut === 'envoye'
                  ? `Envoyé le ${quand(moment)}`
                  : `${s.libelle} le ${dateCourte(moment.slice(0, 10))}${e.raison ? ` : ${e.raison.replace(/\.$/, '').toLowerCase()}` : ''}`;
              return (
                <li key={e.id}>
                  <Link
                    to={e.filId ? `/erp/messagerie/${encodeURIComponent(e.filId)}` : `/erp/reservations/${encodeURIComponent(e.reservationId)}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-(--lm-surface-2)"
                  >
                    <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full [&_svg]:size-3.5', TON_LAVIS[s.ton])}>
                      <Icone aria-hidden />
                      <span className="sr-only">{s.libelle}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">
                        {e.voyageur} · {LIBELLES_DECLENCHEURS[e.declencheur].titre}
                      </span>
                      <span className="block text-[12.5px] text-(--lm-encre-2)">
                        {detail} · {nomLogement(e.logementId)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-4 text-[13.5px] text-(--lm-encre-2)">Rien pour l’instant : les envois apparaîtront ici.</p>
        )}
        {historique.length > 6 && (
          <div className="border-t border-(--lm-bord) px-4 py-2">
            <button type="button" onClick={() => setTout((t) => !t)} className="inline-flex min-h-8 items-center text-[12.5px] font-medium text-(--lm-or-texte) hover:underline">
              {tout ? 'Voir moins' : `Voir tout (${historique.length})`}
            </button>
          </div>
        )}
      </Card>

      {ouvert && (
        <EditeurMessageAuto
          key={ouvert}
          declencheur={ouvert}
          modele={reglages.modeles[ouvert]}
          reservations={d.reservations}
          logements={d.logements}
          fils={d.filsMessages}
          signature={signature}
          modifiable={gerant}
          onFermer={() => setOuvert(null)}
          onEnregistrer={(k, m) => {
            enregistrer(k, m);
            setOuvert(null);
          }}
        />
      )}

      <Modal
        ouvert={!!allumer}
        onFermer={() => setAllumer(null)}
        taille="sm"
        titre={allumer ? `Allumer « ${LIBELLES_DECLENCHEURS[allumer].titre} » ?` : ''}
        description={
          allumer &&
          `${allumer === 'confirmation' ? 'Il partira tout seul pour chaque nouvelle réservation, à partir de maintenant.' : 'Il partira tout seul, à partir de maintenant, aux voyageurs concernés.'}${
            prochainAllume ? ` Premier envoi : ${quand(prochainAllume.quand)}, à ${prochainAllume.reservation.voyageur.nom.split(' ')[0]}.` : ''
          }`
        }
        pied={
          <>
            <Button variant="ghost" onClick={() => setAllumer(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (allumer) enregistrer(allumer, { actif: true, activeLe: horodatageMaintenant() });
                setAllumer(null);
              }}
            >
              Allumer
            </Button>
          </>
        }
      />
    </div>
  );
}
