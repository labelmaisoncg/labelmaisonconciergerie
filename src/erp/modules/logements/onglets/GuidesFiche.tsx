import { useState, type ReactNode } from 'react';
import { ExternalLink, FileText, Image, Link2, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EnvoiFichier, Field, IconButton, Input, LienFichier, Modal, Segmente, Textarea } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { horodatageMaintenant } from '../../../data/format';
import { LIBELLE_TYPE_GUIDE, TAILLE_MAX_GUIDE_MO, estLienGuide, typeFichier } from '../../../data/guides';
import type { GuideLogement, QuestionFrequente } from '../../../data/types';

const ICONE: Record<GuideLogement['media']['type'], ReactNode> = {
  video: <Video />,
  photo: <Image />,
  document: <FileText />,
  lien: <Link2 />,
};

/** Une ligne de liste (guide ou question) : contenu, puis Modifier et Supprimer à portée de pouce. */
function Ligne({ children, onModifier, onSupprimer, libelle }: { children: ReactNode; onModifier: () => void; onSupprimer: () => void; libelle: string }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">{children}</div>
      <div className="flex shrink-0 items-center">
        <IconButton label={`Modifier ${libelle}`} size="sm" onClick={onModifier}>
          <Pencil />
        </IconButton>
        <IconButton label={`Supprimer ${libelle}`} size="sm" onClick={onSupprimer}>
          <Trash2 />
        </IconButton>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- guides */

type Brouillon = { titre: string; quand: string; source: 'lien' | 'fichier'; url: string; fichier: string; nomFichier: string; type: GuideLogement['media']['type']; acces: boolean };

const vide: Brouillon = { titre: '', quand: '', source: 'lien', url: '', fichier: '', nomFichier: '', type: 'lien', acces: false };

function versBrouillon(g: GuideLogement): Brouillon {
  const fichier = g.media.fichier ?? '';
  return {
    titre: g.titre,
    quand: g.quand ?? '',
    source: fichier ? 'fichier' : 'lien',
    url: g.media.url ?? '',
    fichier,
    nomFichier: fichier ? fichier.split('/').pop() ?? '' : '',
    type: g.media.type,
    acces: !!g.acces,
  };
}

/**
 * Guides du logement : une vidéo « Comment récupérer la clé », la photo du
 * compteur, le mode d'emploi du four… L'agent les envoie au voyageur quand sa
 * question y correspond. Les changements partent avec « Enregistrer ».
 */
export function SectionGuides({ logementId, guides, onChange }: { logementId: string; guides: GuideLogement[]; onChange: (g: GuideLogement[]) => void }) {
  const { utilisateur } = useErp();
  const [edition, setEdition] = useState<{ id: string | null; b: Brouillon } | null>(null);
  const b = edition?.b;
  const maj = (patch: Partial<Brouillon>) => setEdition((e) => (e ? { ...e, b: { ...e.b, ...patch } } : e));

  const lienValide = !!b && b.source === 'lien' && estLienGuide(b.url);
  const valide = !!b && !!b.titre.trim() && (b.source === 'lien' ? lienValide : !!b.fichier);

  const valider = () => {
    if (!edition || !b || !valide) return;
    const avant = edition.id ? guides.find((g) => g.id === edition.id) : undefined;
    const guide: GuideLogement = {
      id: edition.id ?? nouvelId('guide'),
      titre: b.titre.trim(),
      ...(b.quand.trim() ? { quand: b.quand.trim() } : {}),
      media: b.source === 'lien' ? { type: 'lien', url: b.url.trim() } : { type: b.type === 'lien' ? 'document' : b.type, fichier: b.fichier },
      ...(b.acces ? { acces: true } : {}),
      ajouteLe: avant?.ajouteLe ?? horodatageMaintenant(),
      ajoutePar: avant?.ajoutePar ?? utilisateur.nom,
    };
    onChange(edition.id ? guides.map((g) => (g.id === edition.id ? guide : g)) : [...guides, guide]);
    setEdition(null);
  };

  return (
    <Card>
      <CardHeader
        titre="Guides"
        description="Vidéos, photos ou documents que votre agent envoie au voyageur quand sa question y correspond."
        actions={
          <Button size="sm" icone={<Plus />} onClick={() => setEdition({ id: null, b: vide })}>
            Ajouter
          </Button>
        }
      />
      {guides.length === 0 ? (
        <p className="text-[13px] text-(--lm-encre-2)">Aucun guide. Par exemple, une courte vidéo « Comment récupérer la clé », filmée au téléphone.</p>
      ) : (
        <ul className="divide-y divide-(--lm-bord)" aria-label="Guides du logement">
          {guides.map((g) => {
            const adresse = g.media.url ?? g.media.fichier;
            return (
              <Ligne
                key={g.id}
                libelle={`le guide ${g.titre}`}
                onModifier={() => setEdition({ id: g.id, b: versBrouillon(g) })}
                onSupprimer={() => onChange(guides.filter((x) => x.id !== g.id))}
              >
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre-2) [&_svg]:size-[18px]">
                  {ICONE[g.media.type]}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[14px] font-medium text-(--lm-encre)">{g.titre}</span>
                    {g.acces && <Badge tone="or">Accès</Badge>}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-(--lm-encre-2)">
                    {LIBELLE_TYPE_GUIDE[g.media.type]}
                    {g.quand ? ` · ${g.quand}` : ''}
                  </span>
                  {adresse && (
                    <LienFichier url={adresse} className="mt-1 inline-flex h-8 items-center gap-1 text-[12.5px] font-medium text-(--lm-or-texte) hover:underline">
                      Voir <ExternalLink className="size-3.5" aria-hidden />
                    </LienFichier>
                  )}
                </span>
              </Ligne>
            );
          })}
        </ul>
      )}

      <Modal
        ouvert={!!edition}
        onFermer={() => setEdition(null)}
        titre={edition?.id ? 'Modifier le guide' : 'Nouveau guide'}
        pied={
          <>
            <Button variant="ghost" onClick={() => setEdition(null)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!valide} onClick={valider}>
              {edition?.id ? 'Valider' : 'Ajouter'}
            </Button>
          </>
        }
      >
        {b && (
          <div className="flex flex-col gap-4">
            <Field label="Titre" requis>
              <Input value={b.titre} onChange={(e) => maj({ titre: e.target.value })} placeholder="Comment récupérer la clé" autoFocus />
            </Field>
            <Field label="Quand l’envoyer" aide="Votre agent s’en sert pour choisir le bon guide.">
              <Textarea rows={2} value={b.quand} onChange={(e) => maj({ quand: e.target.value })} placeholder="Quand le voyageur demande comment entrer dans le logement" />
            </Field>
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Le guide</p>
              <Segmente
                label="Source du guide"
                options={[
                  { valeur: 'lien', libelle: 'Un lien' },
                  { valeur: 'fichier', libelle: 'Un fichier' },
                ]}
                valeur={b.source}
                onChange={(source) => maj({ source })}
              />
              {b.source === 'lien' ? (
                <Field
                  label="Adresse"
                  className="mt-3"
                  aide="YouTube (vidéo non répertoriée), Google Drive, iCloud… L’adresse doit commencer par https://."
                  erreur={b.url.trim() && !lienValide ? 'Adresse non valable : elle doit commencer par https://.' : undefined}
                >
                  <Input type="url" inputMode="url" value={b.url} onChange={(e) => maj({ url: e.target.value })} placeholder="https://youtu.be/…" />
                </Field>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {b.fichier && (
                    <p className="text-[13px] text-(--lm-encre)">
                      {LIBELLE_TYPE_GUIDE[b.type]} · <span className="break-all text-(--lm-encre-2)">{b.nomFichier}</span>
                    </p>
                  )}
                  <EnvoiFichier
                    dossier={`logements/${logementId}/guides`}
                    accept="video/*,image/*,application/pdf"
                    libelle={b.fichier ? 'Remplacer le fichier' : 'Choisir une vidéo, une photo ou un PDF'}
                    size="md"
                    tailleMaxMo={TAILLE_MAX_GUIDE_MO}
                    conseilTropLourd="Pour une vidéo plus longue, mettez-la sur YouTube (non répertoriée) ou Google Drive et collez le lien."
                    onEnvoye={(urls, fichiers) => maj({ fichier: urls[0], nomFichier: fichiers[0]?.name ?? '', type: typeFichier(fichiers[0]?.name ?? '', fichiers[0]?.type ?? '') })}
                  />
                  <p className="text-[12.5px] text-(--lm-encre-2)">{TAILLE_MAX_GUIDE_MO} Mo au plus. Le voyageur reçoit un lien valable 7 jours.</p>
                </div>
              )}
            </div>
            <label className="flex items-start gap-2.5 text-[13.5px]">
              <input type="checkbox" checked={b.acces} onChange={(e) => maj({ acces: e.target.checked })} className="mt-0.5 size-4 accent-(--lm-or)" />
              <span>
                <span className="font-medium text-(--lm-encre)">Contient l’accès au logement (clé, code)</span>
                <span className="block text-[12.5px] text-(--lm-encre-2)">Envoyé seulement aux voyageurs confirmés, dans les 48 h avant l’arrivée ou pendant le séjour.</span>
              </span>
            </label>
          </div>
        )}
      </Modal>
    </Card>
  );
}

/* ------------------------------------------------- questions fréquentes */

/** Questions fréquentes du logement : l'agent reprend ces réponses telles quelles. */
export function SectionQuestions({ questions, onChange }: { questions: QuestionFrequente[]; onChange: (q: QuestionFrequente[]) => void }) {
  const [edition, setEdition] = useState<{ id: string | null; question: string; reponse: string } | null>(null);
  const valide = !!edition?.question.trim() && !!edition.reponse.trim();

  const valider = () => {
    if (!edition || !valide) return;
    const q: QuestionFrequente = { id: edition.id ?? nouvelId('question'), question: edition.question.trim(), reponse: edition.reponse.trim() };
    onChange(edition.id ? questions.map((x) => (x.id === edition.id ? q : x)) : [...questions, q]);
    setEdition(null);
  };

  return (
    <Card>
      <CardHeader
        titre="Questions fréquentes"
        description="Les réponses que votre agent peut donner telles quelles."
        actions={
          <Button size="sm" icone={<Plus />} onClick={() => setEdition({ id: null, question: '', reponse: '' })}>
            Ajouter
          </Button>
        }
      />
      {questions.length === 0 ? (
        <p className="text-[13px] text-(--lm-encre-2)">Aucune question. Par exemple : « Où jeter les poubelles ? », « Comment marche le chauffage ? ».</p>
      ) : (
        <ul className="divide-y divide-(--lm-bord)" aria-label="Questions fréquentes">
          {questions.map((q) => (
            <Ligne
              key={q.id}
              libelle={`la question ${q.question}`}
              onModifier={() => setEdition({ id: q.id, question: q.question, reponse: q.reponse })}
              onSupprimer={() => onChange(questions.filter((x) => x.id !== q.id))}
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-(--lm-encre)">{q.question}</span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] text-(--lm-encre-2)">{q.reponse}</span>
              </span>
            </Ligne>
          ))}
        </ul>
      )}

      <Modal
        ouvert={!!edition}
        onFermer={() => setEdition(null)}
        titre={edition?.id ? 'Modifier la question' : 'Nouvelle question'}
        pied={
          <>
            <Button variant="ghost" onClick={() => setEdition(null)}>
              Annuler
            </Button>
            <Button variant="primary" disabled={!valide} onClick={valider}>
              {edition?.id ? 'Valider' : 'Ajouter'}
            </Button>
          </>
        }
      >
        {edition && (
          <div className="flex flex-col gap-4">
            <Field label="Question" requis>
              <Input value={edition.question} onChange={(e) => setEdition({ ...edition, question: e.target.value })} placeholder="Où jeter les poubelles ?" autoFocus />
            </Field>
            <Field label="Réponse" requis>
              <Textarea rows={4} value={edition.reponse} onChange={(e) => setEdition({ ...edition, reponse: e.target.value })} placeholder="Local au rez-de-chaussée, à droite de l’entrée. Sortie le mardi soir." />
            </Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}
