import { useState } from 'react';
import { ARTICLES_LINGE } from '../../../data/constantes';
import { AUJOURDHUI, dateCourte } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { TypeMouvementLinge } from '../../../data/types';
import { Alert, Button, Field, Input, Modal, Select, Textarea, Prerequis } from '../../../ui';

const TYPES = Object.keys(LIBELLES.typeMouvementLinge) as TypeMouvementLinge[];
const BLANCHISSERIE: TypeMouvementLinge[] = ['envoi_blanchisserie', 'retour_propre'];

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onSucces: (texte: string) => void;
}

/** Saisie d'un mouvement de linge : chaque article qui bouge est tracé. */
export function NouveauMouvement({ ouvert, onFermer, onSucces }: Props) {
  const { logements, prestataires, missions, ajouterMouvementLinge } = useErp();
  const [type, setType] = useState<TypeMouvementLinge>('sortie_sale');
  const [logementId, setLogementId] = useState('');
  const [date, setDate] = useState(AUJOURDHUI);
  const [prestataireId, setPrestataireId] = useState('');
  const [missionId, setMissionId] = useState('');
  const [note, setNote] = useState('');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const logement = logements.find((l) => l.id === logementId);
  const missionsLogement = missions
    .filter((m) => m.logementId === logementId && m.statut !== 'annulee')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  const reinitialiser = () => {
    setType('sortie_sale');
    setLogementId('');
    setDate(AUJOURDHUI);
    setPrestataireId('');
    setMissionId('');
    setNote('');
    setQuantites({});
    setErreurs({});
  };
  const fermer = () => {
    reinitialiser();
    onFermer();
  };

  const enregistrer = () => {
    const e: Record<string, string> = {};
    const articles = Object.entries(quantites)
      .filter(([, q]) => q > 0)
      .map(([article, quantite]) => ({ article, quantite }));
    if (!logementId) e.logement = 'Choisissez le logement.';
    if (!articles.length) e.articles = 'Saisissez au moins un article.';
    if (!date) e.date = 'Date obligatoire.';
    const presta = prestataires.find((p) => p.id === prestataireId);
    if (BLANCHISSERIE.includes(type) && presta?.type !== 'linge')
      e.prestataire = 'Le linge part uniquement en blanchisserie professionnelle : choisissez un prestataire de type Blanchisserie.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    ajouterMouvementLinge({
      logementId,
      date,
      type,
      articles,
      prestataireId: prestataireId || undefined,
      missionId: missionId || undefined,
      note: note.trim() || undefined,
    });
    onSucces(`Mouvement enregistré : ${LIBELLES.typeMouvementLinge[type].toLowerCase()}, ${articles.reduce((s, a) => s + a.quantite, 0)} articles, ${logement?.nom}.`);
    fermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      taille="lg"
      titre="Noter un mouvement de linge"
      description="Linge sorti sale, parti ou revenu de la blanchisserie, remis en place, perdu ou jeté."
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>Annuler</Button>
          <Button variant="primary" onClick={enregistrer}>Enregistrer le mouvement</Button>
        </>
      }
    >
      <div className="space-y-4">
        {!logements.length && (
          <Prerequis className="mb-3" manque="Vous n’avez pas encore de logement." detail="Le linge se suit logement par logement." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type de mouvement" requis>
            <Select value={type} onChange={(ev) => setType(ev.target.value as TypeMouvementLinge)} options={TYPES.map((t) => ({ valeur: t, libelle: LIBELLES.typeMouvementLinge[t] }))} />
          </Field>
          <Field label="Logement" requis erreur={erreurs.logement}>
            <Select
              value={logementId}
              placeholder="Choisir"
              onChange={(ev) => {
                setLogementId(ev.target.value);
                setMissionId('');
              }}
              options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))}
            />
          </Field>
          <Field label="Date" requis erreur={erreurs.date}>
            <Input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
          </Field>
          <Field label="Prestataire" erreur={erreurs.prestataire} className="sm:col-span-2">
            <Select
              value={prestataireId}
              placeholder="Aucun (équipe Label Maison)"
              onChange={(ev) => setPrestataireId(ev.target.value)}
              options={prestataires.filter((p) => p.statut !== 'sorti').map((p) => ({ valeur: p.id, libelle: `${p.nom} (${LIBELLES.typePrestataire[p.type]})` }))}
            />
          </Field>
          <Field label="Mission liée">
            <Select
              value={missionId}
              placeholder={logementId ? 'Aucune' : 'Choisir un logement'}
              disabled={!logementId}
              onChange={(ev) => setMissionId(ev.target.value)}
              options={missionsLogement.map((m) => ({ valeur: m.id, libelle: `${LIBELLES.typeMission[m.type]} du ${dateCourte(m.date)}` }))}
            />
          </Field>
        </div>

        <fieldset>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <legend className="text-[13px] font-medium text-(--lm-encre)">
              Articles<span aria-hidden className="ml-0.5 text-(--lm-danger)">*</span>
            </legend>
            {logement && logement.dotationLinge.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setQuantites(Object.fromEntries(logement.dotationLinge.map((a) => [a.article, a.quantite])))}>
                Reprendre la dotation du logement
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ARTICLES_LINGE.map((article) => (
              <label key={article} className="flex items-center justify-between gap-3 rounded-lg border border-(--lm-bord) px-3 py-1.5 text-[13px]">
                <span className="min-w-0 truncate">{article}</span>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  aria-label={`Quantité : ${article}`}
                  className="lm-chiffres h-8 w-20 text-right"
                  value={quantites[article] ?? ''}
                  onChange={(ev) => setQuantites((q) => ({ ...q, [article]: Math.max(0, Math.floor(Number(ev.target.value) || 0)) }))}
                />
              </label>
            ))}
          </div>
          {erreurs.articles && <p role="alert" className="mt-1.5 text-[12px] font-medium text-(--lm-danger)">{erreurs.articles}</p>}
        </fieldset>

        <Field label="Note" aide="Taches, humidité, articles d’un autre logement...">
          <Textarea rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} />
        </Field>
        {(type === 'perte' || type === 'rebut') && (
          <Alert tone="alerte">Une perte ou un rebut non expliqué doit aussi faire l’objet d’un incident, pour être chiffré et refacturé si besoin.</Alert>
        )}
      </div>
    </Modal>
  );
}
