import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Home, KeyRound, LogIn, LogOut } from 'lucide-react';
import { jourMois } from '../data/format';
import { pointsDuLogement } from '../data/operations';
import { Alert, Badge, Button, Drawer, Field, Input, Select, useLienFichier } from '../ui';
import { LigneControle } from './Controles';
import { LigneIncident } from './Incidents';
import { PasAMoi } from './Signaler';
import { Liste, TitreEspace, court, useOps } from './commun';

function Photo({ url, nom }: { url?: string; nom: string }) {
  const lien = useLienFichier(url);
  if (!lien) {
    return (
      <div aria-hidden className="grid aspect-[4/3] w-full place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre-3)">
        <Home className="size-7" />
      </div>
    );
  }
  return <img src={lien} alt={`Photo de ${nom}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-lg object-cover" />;
}

/** Les logements confiés à la personne : photo, qui le suit, et ce qui s'y passe aujourd'hui. */
export function Logements() {
  const { vue, naviguer } = useOps();
  const ouverts = (id: string) => vue.incidents.filter((i) => i.logementId === id && i.statut !== 'resolu');
  return (
    <>
      <TitreEspace titre={vue.logements.length > 1 ? `Vos ${vue.logements.length} logements` : 'Votre logement'} description="Les logements que votre gérant vous a confiés." />
      {!vue.logements.length ? (
        <p className="text-[14px] text-(--lm-encre-2)">Aucun logement ne vous est confié pour l’instant. Votre gérant les choisit pour vous.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vue.logements.map((l) => {
            const n = ouverts(l.id);
            const urgent = n.some((i) => i.urgent);
            const arrivee = vue.sejours.find((s) => s.logementId === l.id && s.arrivee >= vue.aujourdhui);
            return (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => naviguer({ logement: l.id })}
                  className="flex w-full flex-col rounded-xl border border-(--lm-bord) bg-(--lm-surface) p-2 text-left shadow-(--lm-ombre) transition-colors hover:border-(--lm-bord-fort) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                >
                  <Photo url={l.photo} nom={l.nom} />
                  <span className="px-1.5 pt-2.5 pb-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-[15px] font-semibold text-(--lm-encre)">{l.nom}</span>
                      {urgent ? <Badge tone="danger">Urgence</Badge> : n.length ? <Badge tone="alerte">{n.length} incident{n.length > 1 ? 's' : ''}</Badge> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-(--lm-encre-2)">
                      {[l.ville, l.suiviPar ? `suivi par ${court(l.suiviPar)}` : undefined].filter(Boolean).join(' · ')}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-(--lm-encre-2)">
                      {l.signale ? 'Signalé au gérant : pas à vous' : arrivee ? `Prochaine arrivée le ${jourMois(arrivee.arrivee)}` : 'Pas d’arrivée prévue'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * Un logement : ses séjours (prénom et initiale, nombre de voyageurs), les
 * consignes d'accès le jour où l'on y va, ses incidents et contrôles ; et
 * deux gestes : « Signaler un incident », « Ce logement n'est pas à moi ».
 * Le responsable de pôle choisit aussi qui le suit et son remplaçant.
 */
export function PanneauLogement({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { vue, pole, naviguer, apercu } = useOps();
  const [pasAMoi, setPasAMoi] = useState(false);
  const l = vue.logements.find((x) => x.id === id);
  if (!l) return null;
  const sejours = vue.sejours.filter((s) => s.logementId === id);
  const incidents = vue.incidents.filter((i) => i.logementId === id && i.statut !== 'resolu');
  const controles = vue.controles.filter((c) => c.logementId === id);

  return (
    <>
      <Drawer
        ouvert={!pasAMoi}
        onFermer={onFermer}
        titre={l.nom}
        sousTitre={[l.ville, l.suiviPar ? `suivi par ${court(l.suiviPar)}` : undefined].filter(Boolean).join(' · ')}
        pied={
          apercu ? undefined : (
            <>
              {!l.signale && (
                <Button variant="ghost" onClick={() => setPasAMoi(true)}>
                  Ce logement n’est pas à moi
                </Button>
              )}
              <Button variant="primary" icone={<AlertTriangle />} onClick={() => naviguer({ logement: undefined, signaler: id })}>
                Signaler un incident
              </Button>
            </>
          )
        }
      >
        <div className="space-y-6 text-[13px]">
          {l.signale && <Alert tone="neutre">Vous avez signalé au gérant que ce logement n’est pas à vous. Il reste ici jusqu’à sa réponse.</Alert>}

          {l.acces && (
            <section aria-label="Consignes d’accès" className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-(--lm-encre)">
                <KeyRound className="size-4" aria-hidden />
                Accès, pour aujourd’hui
              </p>
              <p className="whitespace-pre-line text-(--lm-encre-2)">{l.acces}</p>
            </section>
          )}

          <section aria-label="Séjours">
            <p className="mb-2 font-semibold">Séjours</p>
            {sejours.length ? (
              <ul className="divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)">
                {sejours.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                    {s.arrivee >= vue.aujourdhui ? <LogIn className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden /> : <LogOut className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-(--lm-encre)">
                        {s.voyageur}
                        {s.nbPersonnes ? ` · ${s.nbPersonnes} pers.` : ''}
                      </span>
                      <span className="block text-(--lm-encre-2)">
                        Du {jourMois(s.arrivee)}
                        {s.heureArrivee ? ` (${s.heureArrivee})` : ''} au {jourMois(s.depart)}
                        {s.heureDepart ? ` (${s.heureDepart})` : ''}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-(--lm-encre-2)">Aucun séjour sur les deux prochaines semaines.</p>
            )}
          </section>

          {incidents.length > 0 && (
            <section aria-label="Incidents ouverts">
              <p className="mb-2 font-semibold">Incidents ouverts</p>
              <Liste>
                {incidents.map((i) => (
                  <LigneIncident key={i.id} incident={i} />
                ))}
              </Liste>
            </section>
          )}

          {controles.length > 0 && (
            <section aria-label="Contrôles à faire">
              <p className="mb-2 font-semibold">Contrôles à faire</p>
              <Liste>
                {controles.map((c) => (
                  <LigneControle key={c.cle} c={c} />
                ))}
              </Liste>
            </section>
          )}

          {pole && <QuiSuit logementId={id} />}
        </div>
      </Drawer>
      {pasAMoi && <PasAMoi logementId={id} onFermer={() => setPasAMoi(false)} />}
    </>
  );
}

/** Responsable de pôle : qui suit le logement, qui le reprend pendant une absence, les points du contrôle. */
function QuiSuit({ logementId }: { logementId: string }) {
  const { vue, agir, apercu } = useOps();
  const a = vue.affectations.find((x) => x.id === logementId);
  const [responsable, setResponsable] = useState(a?.responsableId ?? '');
  const [remplacant, setRemplacant] = useState(a?.remplacantId ?? '');
  const [points, setPoints] = useState((a?.pointsControle ?? pointsDuLogement({ affectations: [] }, logementId)).join(', '));
  const [enCours, setEnCours] = useState(false);
  const membres = vue.equipe.filter((m) => m.logementIds.includes(logementId)).map((m) => ({ valeur: m.id, libelle: m.nom }));
  const enregistrer = async () => {
    setEnCours(true);
    await agir({
      type: 'affectation',
      logementId,
      responsableId: responsable || undefined,
      remplacantId: remplacant || undefined,
      pointsControle: points.split(',').map((p) => p.trim()).filter(Boolean),
    });
    setEnCours(false);
  };
  return (
    <section aria-label="Qui suit ce logement" className="border-t border-(--lm-bord) pt-5">
      <p className="mb-3 flex items-center gap-1.5 font-semibold">
        <ClipboardCheck className="size-4" aria-hidden />
        Qui suit ce logement
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Au quotidien">
          <Select value={responsable} disabled={apercu} placeholder="Personne" onChange={(e) => setResponsable(e.target.value)} options={membres} />
        </Field>
        <Field label="Pendant une absence">
          <Select value={remplacant} disabled={apercu} placeholder="Personne" onChange={(e) => setRemplacant(e.target.value)} options={membres.filter((m) => m.valeur !== responsable)} />
        </Field>
        <Field label="Points du contrôle qualité" aide="Séparés par des virgules." className="sm:col-span-2">
          <Input value={points} disabled={apercu} onChange={(e) => setPoints(e.target.value)} />
        </Field>
      </div>
      {!apercu && (
        <Button className="mt-3" size="sm" chargement={enCours} onClick={() => void enregistrer()}>
          Enregistrer
        </Button>
      )}
      {!membres.length && <p className="mt-2 text-(--lm-encre-2)">Personne d’autre n’a ce logement : votre gérant ajoute les personnes depuis l’ERP.</p>}
    </section>
  );
}
