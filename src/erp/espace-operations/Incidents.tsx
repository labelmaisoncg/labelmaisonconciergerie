import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Hand, Plus, RotateCcw } from 'lucide-react';
import { dateCourte, dateHeure, jourMois } from '../data/format';
import { LIBELLES } from '../data/libelles';
import type { IncidentOps } from '../data/types-operations';
import { Alert, Button, Drawer, EmptyState, Field, LienFichier, Segmente, Select, StatusBadge, Textarea, Timeline, Vignette } from '../ui';
import { ChoixPhotos, type PhotoChoisie } from './Photos';
import { Ligne, Liste, PastilleUrgent, Rubrique, TitreEspace, court, useOps } from './commun';

/** Ligne d'un incident : la description, puis le logement, qui s'en occupe et le statut. */
export function LigneIncident({ incident: i }: { incident: IncidentOps }) {
  const { naviguer, nomLogement, nomMembre } = useOps();
  const resolu = i.statut === 'resolu';
  return (
    <Ligne
      ton={resolu ? 'succes' : i.urgent ? 'danger' : 'alerte'}
      icone={<AlertTriangle />}
      titre={i.description}
      deuxLignes
      sousTitre={[
        nomLogement(i.logementId),
        resolu ? `résolu le ${dateCourte(i.resoluLe ?? i.date)}` : nomMembre(i.suiviPar) || 'personne dessus',
        !resolu && LIBELLES.statutIncident[i.statut].toLowerCase(),
      ]
        .filter(Boolean)
        .join(' · ')}
      onClick={() => naviguer({ incident: i.id })}
    />
  );
}

/** Incidents de la personne : à traiter (urgents d'abord) ou résolus. */
export function Incidents() {
  const { vue, pole, naviguer } = useOps();
  const [vueListe, setVueListe] = useState<'a_traiter' | 'resolus'>('a_traiter');
  const liste = vue.incidents.filter((i) => (vueListe === 'resolus' ? i.statut === 'resolu' : i.statut !== 'resolu'));
  const urgents = vueListe === 'a_traiter' ? liste.filter((i) => i.urgent) : [];
  const autres = vueListe === 'a_traiter' ? liste.filter((i) => !i.urgent) : liste;
  return (
    <>
      <TitreEspace
        titre="Incidents"
        description={pole ? 'Tous les incidents de vos logements.' : 'Les incidents qui vous sont confiés et ceux que vous avez signalés.'}
        action={
          <Button variant="primary" icone={<Plus />} onClick={() => naviguer({ signaler: '' })}>
            Signaler un incident
          </Button>
        }
      />
      <Segmente
        label="Incidents affichés"
        valeur={vueListe}
        onChange={setVueListe}
        options={[
          { valeur: 'a_traiter', libelle: 'À traiter' },
          { valeur: 'resolus', libelle: 'Résolus' },
        ]}
        className="mb-5"
      />
      {!liste.length && <EmptyState icone={<CheckCircle2 />} titre={vueListe === 'a_traiter' ? 'Aucun incident à traiter.' : 'Aucun incident résolu.'} />}
      {urgents.length > 0 && (
        <Rubrique titre={`Urgent (${urgents.length})`}>
          <Liste label="Incidents urgents">
            {urgents.map((i) => (
              <LigneIncident key={i.id} incident={i} />
            ))}
          </Liste>
        </Rubrique>
      )}
      {autres.length > 0 && (
        <Rubrique titre={vueListe === 'resolus' ? `Résolus (${autres.length})` : `Normal (${autres.length})`}>
          <Liste label={vueListe === 'resolus' ? 'Incidents résolus' : 'Incidents normaux'}>
            {autres.map((i) => (
              <LigneIncident key={i.id} incident={i} />
            ))}
          </Liste>
        </Rubrique>
      )}
    </>
  );
}

function Ligne2({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-(--lm-encre-2)">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/**
 * Un incident : ce qui se passe, qui s'en occupe, photos, historique. Le
 * responsable de pôle confie, priorise et clôt ; chacun peut ajouter un mot
 * ou une photo et prendre en charge ce qui lui est confié.
 */
export function PanneauIncident({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { vue, pole, agir, nomLogement, nomMembre, apercu } = useOps();
  const i = vue.incidents.find((x) => x.id === id);
  const [mot, setMot] = useState('');
  const [photos, setPhotos] = useState<PhotoChoisie[]>([]);
  const [enCours, setEnCours] = useState<string>();
  if (!i) return null;
  const sejour = vue.sejours.find((s) => s.id === i.reservationId);
  const moi = vue.moi.id;
  const peutPrendre = i.statut === 'ouvert' && (pole || i.suiviPar === moi || i.assigneA === moi);
  const membres = vue.equipe.filter((m) => m.logementIds.includes(i.logementId));

  const faire = async (cle: string, op: Parameters<typeof agir>[0]) => {
    setEnCours(cle);
    const ok = await agir(op);
    setEnCours(undefined);
    return ok;
  };
  const noter = async () => {
    if (await faire('noter', { type: 'noter', incidentId: i.id, texte: mot.trim() || undefined, photos: photos.map((p) => p.url) })) {
      setMot('');
      setPhotos([]);
    }
  };

  const pied =
    apercu || (!pole && !peutPrendre) ? undefined : i.statut === 'resolu' ? (
      <Button icone={<RotateCcw />} chargement={enCours === 'rouvrir'} onClick={() => void faire('rouvrir', { type: 'rouvrir', incidentId: i.id })}>
        Rouvrir
      </Button>
    ) : (
      <>
        {pole && i.statut === 'en_cours' && (
          <Button variant="primary" icone={<CheckCircle2 />} chargement={enCours === 'resoudre'} onClick={() => void faire('resoudre', { type: 'resoudre', incidentId: i.id })}>
            Marquer résolu
          </Button>
        )}
        {pole && i.statut === 'ouvert' && (
          <Button variant="ghost" chargement={enCours === 'resoudre'} onClick={() => void faire('resoudre', { type: 'resoudre', incidentId: i.id })}>
            Marquer résolu
          </Button>
        )}
        {peutPrendre && (
          <Button variant="primary" icone={<Hand />} chargement={enCours === 'prendre'} onClick={() => void faire('prendre', { type: 'prendre', incidentId: i.id })}>
            Je m’en occupe
          </Button>
        )}
      </>
    );

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={nomLogement(i.logementId)}
      sousTitre={
        <span className="flex flex-wrap items-center gap-1.5">
          <PastilleUrgent urgent={i.urgent} />
          <StatusBadge type="statutIncident" valeur={i.statut} />
          <span>Signalé le {dateCourte(i.date)}</span>
        </span>
      }
      pied={pied}
    >
      <div className="space-y-5 text-[13px]">
        <p className="text-[14px] leading-relaxed text-(--lm-encre)">{i.description}</p>

        {i.remplace && i.statut !== 'resolu' && (
          <Alert tone="neutre">
            Absence de {nomMembre(i.remplace)} : {i.suiviPar ? `${nomMembre(i.suiviPar)} s’en occupe en attendant.` : 'personne pour reprendre, confiez-le à quelqu’un.'}
          </Alert>
        )}

        {pole && !apercu && i.statut !== 'resolu' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-(--lm-encre)">Priorité</span>
              <Segmente
                label="Priorité"
                valeur={i.urgent ? 'urgent' : 'normal'}
                onChange={(v) => void faire('priorite', { type: 'priorite', incidentId: i.id, urgent: v === 'urgent' })}
                options={[
                  { valeur: 'normal', libelle: 'Normal' },
                  { valeur: 'urgent', libelle: 'Urgent' },
                ]}
                className="self-start"
              />
            </div>
            <Field label="Qui s’en occupe">
              <Select
                value={i.assigneA ?? ''}
                placeholder="Personne pour l’instant"
                onChange={(e) => void faire('assigner', { type: 'assigner', incidentId: i.id, membreId: e.target.value || undefined })}
                options={membres.map((m) => ({ valeur: m.id, libelle: m.nom }))}
              />
            </Field>
          </div>
        ) : null}

        <dl className="divide-y divide-(--lm-bord)">
          {(!pole || apercu || i.statut === 'resolu') && <Ligne2 label="Qui s’en occupe">{nomMembre(i.suiviPar) || 'Personne'}</Ligne2>}
          {sejour && (
            <Ligne2 label="Séjour">
              {sejour.voyageur}, du {jourMois(sejour.arrivee)} au {jourMois(sejour.depart)}
            </Ligne2>
          )}
          <Ligne2 label="Catégorie">{LIBELLES.categorieIncident[i.categorie]}</Ligne2>
        </dl>

        <section aria-label="Photos">
          <p className="mb-2 font-semibold">Photos ({i.photos.length})</p>
          {i.photos.length ? (
            <div className="grid grid-cols-3 gap-2">
              {i.photos.map((u, k) => (
                <LienFichier key={u} url={u}>
                  <Vignette url={u} alt={`Photo ${k + 1}`} />
                </LienFichier>
              ))}
            </div>
          ) : (
            <p className="text-(--lm-encre-2)">Pas encore de photo.</p>
          )}
        </section>

        {!apercu && (pole || i.suiviPar === moi || i.assigneA === moi) && (
          <section aria-label="Ajouter" className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3">
            <Field label="Ajouter un mot">
              <Textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Ce qui a été fait, ce qui reste à faire." maxLength={1000} />
            </Field>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
              <ChoixPhotos photos={photos} onChange={setPhotos} variante="ghost" className="min-w-0 flex-1" />
              <Button size="sm" chargement={enCours === 'noter'} disabled={!mot.trim() && !photos.length} onClick={() => void noter()}>
                Ajouter
              </Button>
            </div>
          </section>
        )}

        <section aria-label="Historique">
          <p className="mb-3 font-semibold">Historique</p>
          <Timeline
            elements={[...i.historique].reverse().map((h, k) => ({ id: `${h.le}-${k}`, titre: h.texte, meta: `${dateHeure(h.le)} · ${court(h.par)}`, tone: 'neutre' }))}
            vide={`Signalé le ${dateCourte(i.date)}.`}
          />
        </section>
      </div>
    </Drawer>
  );
}
