import { useEffect, useState } from 'react';
import { Mail, MessageSquareText, Phone, PhoneMissed, PhoneOff, Trash2, Voicemail } from 'lucide-react';
import { EMAIL_SUR, LIBELLE_RESULTAT, LIBELLE_SOURCE_CRM, noterAppel, STATUTS_CRM } from '../../../data/crm';
import { dateHeure, horodatageMaintenant, pluriel } from '../../../data/format';
import type { ContactCrm, ResultatAppel, Responsable, StatutContactCrm } from '../../../data/types';
import { Button, classesBouton, Drawer, Field, Input, MenuActions, Modal, Repli, Select, Textarea, Timeline, type Ton } from '../../../ui';
import { relanceEnRetard } from './Grille';
import { POINT } from './statuts';

const TON_TRACE: Record<ResultatAppel, Ton> = {
  joint: 'succes',
  pas_de_reponse: 'alerte',
  messagerie: 'alerte',
  note: 'neutre',
  formulaire: 'info',
};

/** Lien vers une page de NOTRE site seulement (le champ vient d'un formulaire public : pas de « //autre-site »). */
function pageDuSite(page: string): string | undefined {
  if (!/^\/(?![\/\\])[\w\-\/.]*$/.test(page)) return undefined;
  try {
    const u = new URL(page, 'https://www.labelmaisoncg.fr');
    return u.origin === 'https://www.labelmaisoncg.fr' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export interface FicheContactProps {
  contact: ContactCrm | undefined;
  onFermer: () => void;
  onModifier: (c: ContactCrm) => void;
  onSupprimer: (id: string) => void;
  auteur: string;
  lectureSeule: boolean;
}

/** Fiche d'un contact : coordonnées, appel en un geste, notes et historique. */
export function FicheContact({ contact, onFermer, onModifier, onSupprimer, auteur, lectureSeule }: FicheContactProps) {
  const [brouillon, setBrouillon] = useState<ContactCrm | undefined>(contact);
  const [note, setNote] = useState('');
  const [confirmer, setConfirmer] = useState(false);

  // Nouvelle fiche ouverte, ou mise à jour reçue (autre membre, formulaire) : on repart de la version enregistrée.
  useEffect(() => {
    setBrouillon(contact);
  }, [contact]);

  if (!contact || !brouillon) return <Drawer ouvert={false} onFermer={onFermer} titre="">{null}</Drawer>;

  const champ = <K extends keyof ContactCrm>(k: K, v: ContactCrm[K]) => setBrouillon((b) => (b ? { ...b, [k]: v } : b));
  const enregistrerChamp = () => {
    if (brouillon && JSON.stringify(brouillon) !== JSON.stringify(contact)) onModifier({ ...brouillon, majLe: horodatageMaintenant() });
  };
  const appel = (r: ResultatAppel, texte?: string) => onModifier(noterAppel(contact, r, auteur, horodatageMaintenant(), texte));
  const tel = contact.telephone?.replace(/[^\d+]/g, '');
  const emailSur = contact.email && EMAIL_SUR.test(contact.email) ? contact.email : undefined;
  // Fermer (Échap, croix) n'abandonne pas une saisie en cours.
  const fermer = () => {
    enregistrerChamp();
    onFermer();
  };

  return (
    <Drawer
      ouvert
      onFermer={fermer}
      titre={contact.nom}
      sousTitre={`${LIBELLE_SOURCE_CRM[contact.source]} · reçu le ${dateHeure(contact.creeLe)}`}
      actions={
        !lectureSeule && (
          <MenuActions
            label="Autres actions"
            actions={[{ libelle: 'Supprimer le contact', icone: <Trash2 />, onClick: () => setConfirmer(true) }]}
          />
        )
      }
    >
      <div className="space-y-5">
        {(contact.tentatives > 0 || relanceEnRetard(contact)) && (
          <p className="flex flex-wrap gap-x-3 text-[12.5px]">
            {contact.tentatives > 0 && <span className="text-(--lm-encre-2)">{pluriel(contact.tentatives, 'appel')} sans réponse</span>}
            {relanceEnRetard(contact) && <span className="font-medium text-(--lm-danger)">Relance en retard</span>}
          </p>
        )}

        {/* Appeler, puis noter le résultat en un geste. */}
        <div className="rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-3">
          <div className="flex flex-wrap gap-2">
            {tel ? (
              <a href={`tel:${tel}`} aria-label={`Appeler ${contact.nom}`} className={classesBouton('primary')}>
                <Phone aria-hidden /> Appeler
              </a>
            ) : (
              <span className="inline-flex h-9 items-center gap-2 text-[13px] text-(--lm-encre-3)">
                <PhoneOff className="size-4" aria-hidden /> Pas de téléphone
              </span>
            )}
            {emailSur && (
              <a href={`mailto:${emailSur}`} className={classesBouton('secondary')}>
                <Mail aria-hidden /> E-mail
              </a>
            )}
          </div>
          {!lectureSeule && (
            <div className="mt-3">
              <p className="mb-1.5 text-[12.5px] text-(--lm-encre-2)">Après l’appel :</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="secondary" icone={<Phone />} onClick={() => appel('joint')}>
                  Joint
                </Button>
                <Button size="sm" variant="secondary" icone={<PhoneMissed />} onClick={() => appel('pas_de_reponse')}>
                  Pas de réponse
                </Button>
                <Button size="sm" variant="secondary" icone={<Voicemail />} onClick={() => appel('messagerie')}>
                  Message laissé
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Étape">
              <Select
                value={contact.statut}
                disabled={lectureSeule}
                onChange={(e) => onModifier({ ...contact, statut: e.target.value as StatutContactCrm })}
                options={STATUTS_CRM.map((x) => ({ valeur: x.cle, libelle: x.libelle }))}
              />
            </Field>
          </div>
          <Field label="Nom">
            <Input value={brouillon.nom} disabled={lectureSeule} onChange={(e) => champ('nom', e.target.value)} onBlur={enregistrerChamp} />
          </Field>
          <Field label="Téléphone">
            <Input
              type="tel"
              value={brouillon.telephone ?? ''}
              disabled={lectureSeule}
              onChange={(e) => champ('telephone', e.target.value || undefined)}
              onBlur={enregistrerChamp}
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={brouillon.email ?? ''}
              disabled={lectureSeule}
              onChange={(e) => champ('email', e.target.value || undefined)}
              onBlur={enregistrerChamp}
            />
          </Field>
          <Field label="Ville">
            <Input value={brouillon.ville ?? ''} disabled={lectureSeule} onChange={(e) => champ('ville', e.target.value || undefined)} onBlur={enregistrerChamp} />
          </Field>
          <Field label="Relance le">
            <Input
              type="date"
              value={brouillon.relanceLe ?? ''}
              disabled={lectureSeule}
              onChange={(e) => onModifier({ ...contact, relanceLe: e.target.value || undefined })}
            />
          </Field>
          <Field label="Suivi par">
            <Select
              value={brouillon.responsable ?? ''}
              disabled={lectureSeule}
              onChange={(e) => onModifier({ ...contact, responsable: (e.target.value || undefined) as Responsable | undefined })}
              options={[
                { valeur: '', libelle: 'Personne' },
                { valeur: 'abdel', libelle: 'Abdel' },
                { valeur: 'kamel', libelle: 'Kamel' },
              ]}
            />
          </Field>
          {contact.statut === 'en_attente' && (
            <div className="sm:col-span-2">
              <Field label="En attente de quoi ?">
                <Input
                  value={brouillon.motifAttente ?? ''}
                  placeholder="Travaux, achat en cours, décision à deux…"
                  disabled={lectureSeule}
                  onChange={(e) => champ('motifAttente', e.target.value || undefined)}
                  onBlur={enregistrerChamp}
                />
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea rows={3} value={brouillon.notes} disabled={lectureSeule} onChange={(e) => champ('notes', e.target.value)} onBlur={enregistrerChamp} />
            </Field>
          </div>
        </div>

        {(contact.message || contact.typeBien || contact.adresse || contact.page) && (
          <Repli titre="Sa demande" ouvert={!!contact.message}>
            {contact.message && <p className="mb-3 text-[13.5px] whitespace-pre-line text-(--lm-encre)">{contact.message}</p>}
            <dl className="space-y-2 text-[13.5px]">
              {contact.typeBien && (
                <div>
                  <dt className="text-[12px] text-(--lm-encre-3)">Bien</dt>
                  <dd>{contact.typeBien}</dd>
                </div>
              )}
              {contact.adresse && (
                <div>
                  <dt className="text-[12px] text-(--lm-encre-3)">Adresse</dt>
                  <dd>{contact.adresse}</dd>
                </div>
              )}
              {contact.page && (
                <div>
                  <dt className="text-[12px] text-(--lm-encre-3)">Envoyée depuis</dt>
                  <dd>
                    {pageDuSite(contact.page) ? (
                      <a
                        href={pageDuSite(contact.page)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center rounded-md text-(--lm-or-texte) hover:underline focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                      >
                        Voir la page du site
                      </a>
                    ) : (
                      <span className="break-all">{contact.page}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Repli>
        )}

        <section aria-labelledby="historique-crm">
          <h3 id="historique-crm" className="mb-2 text-[14px] font-semibold text-(--lm-encre)">
            Historique
          </h3>
          {!lectureSeule && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                appel('note', note);
                setNote('');
              }}
            >
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note…" aria-label="Nouvelle note" />
              <Button type="submit" variant="secondary" icone={<MessageSquareText />} disabled={!note.trim()}>
                Noter
              </Button>
            </form>
          )}
          <Timeline
            elements={(contact.historique ?? []).map((t, i) => ({
              id: `${t.le}-${i}`,
              titre: LIBELLE_RESULTAT[t.resultat],
              meta: `${dateHeure(t.le)} · ${t.par}`,
              // Le message du formulaire est déjà affiché dans « Sa demande ».
              description: t.resultat === 'formulaire' && t.texte === contact.message ? undefined : t.texte,
              tone: TON_TRACE[t.resultat],
              // Appel sans réponse : même orange que l'étape « À rappeler » qu'il déclenche.
              point: t.resultat === 'pas_de_reponse' || t.resultat === 'messagerie' ? POINT.a_rappeler : undefined,
            }))}
            vide="Rien pour l’instant."
          />
        </section>
      </div>

      <Modal
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        taille="sm"
        titre={`Supprimer ${contact.nom} ?`}
        description="La ligne et son historique disparaissent du CRM."
        pied={
          <>
            <Button variant="ghost" onClick={() => setConfirmer(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              icone={<Trash2 />}
              onClick={() => {
                setConfirmer(false);
                onSupprimer(contact.id);
              }}
            >
              Supprimer
            </Button>
          </>
        }
      />
    </Drawer>
  );
}
