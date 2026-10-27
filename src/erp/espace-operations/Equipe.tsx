import { useState } from 'react';
import { ArrowRight, Phone, UserX } from 'lucide-react';
import { jourMois } from '../data/format';
import { ROLES_OPERATIONS, ajouterJours, suiviPar, verifierAbsence } from '../data/operations';
import type { AbsenceMembre } from '../data/types-operations';
import { Alert, Avatar, Button, Drawer, Field, Input, Select } from '../ui';
import { Ligne, Liste, Rubrique, TitreEspace, court, useOps } from './commun';

/** Responsable de pôle : les absences et leurs remplaçants, puis les personnes de ses logements. */
export function Equipe() {
  const { vue, naviguer, apercu } = useOps();
  const nom = (id?: string) => vue.equipe.find((m) => m.id === id)?.nom ?? 'Membre';
  return (
    <>
      <TitreEspace
        titre="Équipe"
        description="Les personnes qui suivent vos logements, et qui les remplace pendant une absence."
        action={
          !apercu && (
            <Button icone={<UserX />} onClick={() => naviguer({ absence: 'nouvelle' })}>
              Noter une absence
            </Button>
          )
        }
      />
      <Rubrique titre="Absences">
        {vue.absences.length ? (
          <Liste label="Absences en cours et à venir">
            {vue.absences.map((a) => (
              <Ligne
                key={a.id}
                icone={<UserX />}
                titre={nom(a.membreId)}
                sousTitre={a.du <= vue.aujourdhui ? `Absence jusqu’au ${jourMois(a.au)}` : `Absence du ${jourMois(a.du)} au ${jourMois(a.au)}`}
                onClick={() => naviguer({ absence: a.id })}
              />
            ))}
          </Liste>
        ) : (
          <p className="text-[13.5px] text-(--lm-encre-2)">Personne n’est absent dans les semaines qui viennent.</p>
        )}
      </Rubrique>
      <Rubrique titre="Les personnes">
        <ul className="divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord) bg-(--lm-surface) shadow-(--lm-ombre)">
          {vue.equipe.map((m) => {
            const tel = m.telephone?.replace(/[^\d+]/g, '');
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <Avatar nom={m.nom} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{m.id === vue.moi.id ? `${m.nom} (vous)` : m.nom}</span>
                  <span className="block truncate text-[12.5px] text-(--lm-encre-2)">
                    {[ROLES_OPERATIONS[m.role], m.absence ? `absence jusqu’au ${jourMois(m.absence.au)}` : `${m.logementIds.length} logement${m.logementIds.length > 1 ? 's' : ''}`].join(' · ')}
                  </span>
                </span>
                {tel && m.id !== vue.moi.id && (
                  <a
                    href={`tel:${tel}`}
                    aria-label={`Appeler ${m.nom}`}
                    className="grid size-10 shrink-0 place-items-center rounded-lg border border-(--lm-bord-fort) text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </Rubrique>
    </>
  );
}

/** Noter (ou modifier) une absence, avec ce qui change avant de confirmer. */
export function PanneauAbsence({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { vue, agir, nomLogement, apercu } = useOps();
  const existante = vue.absences.find((a) => a.id === id);
  const [a, setA] = useState<AbsenceMembre>(() => existante ?? { id: '', membreId: '', du: vue.aujourdhui, au: ajouterJours(vue.aujourdhui, 6) });
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState<string>();
  const membres = vue.equipe.map((m) => ({ valeur: m.id, libelle: m.nom }));
  // Absence notée par le gérant : lui seul la change ; ici, en lecture.
  const duGerant = !!existante && !existante.parMembreId;
  const lecture = !!apercu || duGerant;
  const absentsPossibles = vue.equipe.filter((m) => !m.absenceParGerant || m.id === existante?.membreId).map((m) => ({ valeur: m.id, libelle: m.nom }));
  const nom = (m?: string) => (m ? court(vue.equipe.find((x) => x.id === m)?.nom) : 'Personne');

  // Ce qui change : ses logements et ses incidents ouverts, repris le premier jour de l'absence.
  const date = a.du > vue.aujourdhui ? a.du : vue.aujourdhui;
  const avec = { affectations: vue.affectations, absences: [...vue.absences.filter((x) => x.id !== a.id), { ...a, id: a.id || 'nouvelle' }] };
  const logements = a.membreId ? vue.affectations.filter((x) => x.responsableId === a.membreId).map((x) => ({ id: x.id, vers: suiviPar(avec, a.membreId, x.id, date).membreId })) : [];
  const incidents = a.membreId
    ? vue.incidents.filter((i) => i.statut !== 'resolu' && i.assigneA === a.membreId).map((i) => ({ id: i.id, texte: i.description, vers: suiviPar(avec, a.membreId, i.logementId, date).membreId }))
    : [];
  const sansPersonne = [...logements, ...incidents].filter((x) => !x.vers).length;

  const confirmer = async () => {
    const probleme = verifierAbsence({ ...a, id: a.id || 'nouvelle' }, vue.absences);
    if (probleme) return setErreur(probleme);
    setErreur(undefined);
    setEnCours('confirmer');
    const ok = await agir({ type: 'absence', ...(existante ? { id: existante.id } : {}), membreId: a.membreId, du: a.du, au: a.au, remplacantId: a.remplacantId || undefined });
    setEnCours(undefined);
    if (ok) onFermer();
  };
  const annuler = async () => {
    if (!existante) return;
    setEnCours('annuler');
    const ok = await agir({ type: 'absence-annuler', id: existante.id });
    setEnCours(undefined);
    if (ok) onFermer();
  };

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={existante ? `Absence de ${nom(existante.membreId)}` : 'Noter une absence'}
      pied={
        lecture ? undefined : (
          <>
            {existante && (
              <Button variant="ghost" chargement={enCours === 'annuler'} onClick={() => void annuler()}>
                Annuler l’absence
              </Button>
            )}
            <Button variant="primary" chargement={enCours === 'confirmer'} onClick={() => void confirmer()}>
              {existante ? 'Enregistrer' : 'Confirmer l’absence'}
            </Button>
          </>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 text-[13px]">
        {erreur && <Alert tone="danger">{erreur}</Alert>}
        {duGerant && <Alert tone="neutre">Absence notée par le gérant : lui seul peut la modifier.</Alert>}
        <Field label="Personne absente" requis aide={existante ? undefined : 'Pour quelqu’un qui suit aussi d’autres logements, demandez au gérant.'}>
          <Select value={a.membreId} disabled={lecture} placeholder="Choisir" onChange={(e) => setA({ ...a, membreId: e.target.value })} options={absentsPossibles} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Du" requis>
            <Input type="date" value={a.du} disabled={lecture} onChange={(e) => setA({ ...a, du: e.target.value })} />
          </Field>
          <Field label="Au (inclus)" requis>
            <Input type="date" value={a.au} min={a.du} disabled={lecture} onChange={(e) => setA({ ...a, au: e.target.value })} />
          </Field>
        </div>
        <Field label="Remplaçant si le logement n’en a pas">
          <Select value={a.remplacantId ?? ''} disabled={lecture} placeholder="Personne" onChange={(e) => setA({ ...a, remplacantId: e.target.value || undefined })} options={membres.filter((m) => m.valeur !== a.membreId)} />
        </Field>

        {a.membreId && (
          <section aria-label="Ce qui change" className="min-w-0 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3">
            <p className="text-[13.5px] font-semibold text-(--lm-encre)">
              Ce qui change du {jourMois(a.du)} au {jourMois(a.au)}
            </p>
            {!logements.length && !incidents.length ? (
              <p className="mt-1 text-(--lm-encre-2)">Rien à reprendre : aucun logement ni incident ouvert à son nom.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {logements.map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-(--lm-encre)">{nomLogement(x.id)}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
                    <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
                  </li>
                ))}
                {incidents.map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-(--lm-encre-2)">Incident · {x.texte}</span>
                    <ArrowRight className="size-3.5 shrink-0 text-(--lm-encre-3)" aria-label="passe à" />
                    <span className={x.vers ? 'font-medium text-(--lm-encre)' : 'font-medium text-(--lm-danger)'}>{nom(x.vers)}</span>
                  </li>
                ))}
              </ul>
            )}
            {sansPersonne > 0 && <p className="mt-2 text-[12.5px] text-(--lm-danger)">Personne pour reprendre {sansPersonne > 1 ? `${sansPersonne} lignes` : 'une ligne'} : choisissez un remplaçant ci-dessus.</p>}
            <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">Au retour, tout revient à la personne.</p>
          </section>
        )}
      </div>
    </Drawer>
  );
}
