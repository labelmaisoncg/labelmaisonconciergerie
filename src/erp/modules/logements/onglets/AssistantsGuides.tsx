/**
 * Fiche voyageur du logement : « Nouveau guide » et « Nouvelle question »,
 * pas à pas (kit ui/Assistant.tsx). Rien n'est ajouté avant le bouton du
 * récapitulatif ; il enregistre aussitôt le guide ou la question dans la
 * fiche du logement (FicheVoyageur.tsx, sans attendre « Enregistrer »).
 * Règles et lignes : data/creation-guide.ts. Les modifications gardent leur
 * fenêtre (GuidesFiche.tsx).
 *
 * La fiche voyageur est un formulaire : les assistants s'affichent hors de
 * lui (createPortal), et leur « Continuer » ne l'envoie jamais (l'envoi
 * s'arrête au cadre de l'assistant).
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Link2 } from 'lucide-react';
import {
  ECRANS_GUIDE,
  ECRANS_QUESTION,
  SANS_CHAMP_GUIDE,
  erreursGuide,
  erreursQuestion,
  guideDepuisBrouillon,
  guideVide,
  questionDepuisBrouillon,
  questionVide,
  recapGuide,
  recapQuestion,
  type BrouillonGuide,
  type BrouillonQuestion,
  type EcranGuide,
  type EcranQuestion,
} from '../../../data/creation-guide';
import { horodatageMaintenant } from '../../../data/format';
import { LIBELLE_TYPE_GUIDE, TAILLE_MAX_GUIDE_MO, estLienGuide, typeFichier } from '../../../data/guides';
import { brouillonModifie } from '../../../data/parcours-assistant';
import { nouvelId, useErp } from '../../../data/store';
import type { GuideLogement, Logement, QuestionFrequente } from '../../../data/types';
import { Assistant, CHAMP_ASSISTANT, ChoixCartes, ChoixCourts, EnvoiFichier, Field, Input, NBSP, RecapAssistant, Textarea, useParcours } from '../../../ui';
import { aideOuCode } from '../_composants/avertissementCode';

/**
 * Hors du formulaire de la fiche (dans le cadre de l'ERP, pour ses couleurs) ; et
 * l'envoi de l'assistant s'arrête ici : il ne remonte jamais jusqu'à la fiche.
 */
const horsDuFormulaire = (contenu: ReactNode) =>
  createPortal(<div onSubmit={(e) => e.stopPropagation()}>{contenu}</div>, document.querySelector('.erp-root') ?? document.body);

/** Ce que fait le bouton du récapitulatif : l'ajout s'enregistre tout de suite, pas avec « Enregistrer ». */
const enregistreAussitot = (sujet: string) => `${sujet} s’enregistre aussitôt dans la fiche du logement.`;

const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
] as const;

/* ------------------------------------------------------------------ guide */

const QUESTIONS_GUIDE: Record<EcranGuide, { question: string; aide?: string }> = {
  titre: { question: `Quel est le titre du guide${NBSP}?`, aide: 'Votre agent l’envoie au voyageur quand sa question y correspond.' },
  quand: { question: `Quand l’envoyer${NBSP}?`, aide: `Facultatif${NBSP}: votre agent s’en sert pour choisir le bon guide.` },
  source: { question: `Un lien ou un fichier${NBSP}?` },
  // Avec un fichier, la question devient « Quel fichier envoyer ? » (questionGuide).
  media: { question: `Où est le guide${NBSP}?` },
  acces: { question: `Contient-il l’accès au logement${NBSP}?`, aide: `Clé, code${NBSP}: il ne part alors qu’aux voyageurs confirmés, dans les 48${NBSP}h avant l’arrivée ou pendant le séjour.` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const SOURCES = [
  { valeur: 'lien' as const, libelle: 'Un lien', icone: Link2 },
  { valeur: 'fichier' as const, libelle: 'Un fichier', icone: FileText },
];

const idGuide = (cle: string) => `assistant-guide-${cle}`;

const questionGuide = (ecran: EcranGuide, b: BrouillonGuide) =>
  ecran === 'media' && b.source === 'fichier' ? { question: `Quel fichier envoyer${NBSP}?` } : QUESTIONS_GUIDE[ecran];

export function AssistantGuide({ logementId, onAjoute, onFermer }: { logementId: string; onAjoute: (g: GuideLogement) => void; onFermer: () => void }) {
  const { utilisateur } = useErp();
  const [b, setB] = useState<BrouillonGuide>(guideVide);
  const depart = useRef(b);
  const titreId = useId();
  const p = useParcours<EcranGuide>({ ecrans: ECRANS_GUIDE, idChamp: idGuide, sansChamp: SANS_CHAMP_GUIDE });
  const ecran = p.ecran;
  const erreurs = erreursGuide(ecran, b);
  // Une adresse qui ne commence pas par https:// : dit tout de suite sous le champ, comme avant.
  const etat = p.etat(erreurs, (k) => k === 'url' && !!b.url.trim() && !estLienGuide(b.url));
  const maj = (patch: Partial<BrouillonGuide>) => setB((x) => ({ ...x, ...patch }));

  const ajouter = () => {
    const r = guideDepuisBrouillon(b, { id: nouvelId('guide'), maintenant: horodatageMaintenant(), par: utilisateur.nom });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursGuide('recapitulatif', b)));
    onAjoute(r.guide);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, ajouter);
  const q = questionGuide(ecran, b);

  return horsDuFormulaire(
    <Assistant
      titre="Nouveau guide"
      ecrans={ECRANS_GUIDE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Ajouter le guide')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce guide${NBSP}?`}
      onFermer={onFermer}
    >
      {ecran === 'titre' && (
        <Field label="Titre" erreur={etat.erreurChamp('titre')}>
          <Input
            id={idGuide('titre')}
            value={b.titre}
            onChange={(e) => maj({ titre: e.target.value })}
            onBlur={() => p.quitter('titre')}
            placeholder="Comment récupérer la clé"
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'quand' && (
        <Field label="Situation">
          <Textarea
            id={idGuide('quand')}
            rows={3}
            value={b.quand}
            onChange={(e) => maj({ quand: e.target.value })}
            placeholder="Quand le voyageur demande comment entrer dans le logement"
            className="text-[16px]"
          />
        </Field>
      )}
      {ecran === 'source' && (
        <ChoixCartes options={SOURCES} valeur={b.source} onChange={(source) => maj({ source })} onContinuer={continuer} labelledBy={titreId} idPremier={idGuide('source')} />
      )}
      {ecran === 'media' &&
        (b.source === 'lien' ? (
          <Field label="Adresse" aide="Le lien de partage YouTube (vidéo non répertoriée), Google Drive ou iCloud." erreur={etat.erreurChamp('url')}>
            <Input
              id={idGuide('url')}
              type="url"
              inputMode="url"
              autoCapitalize="off"
              spellCheck={false}
              value={b.url}
              onChange={(e) => maj({ url: e.target.value })}
              onBlur={() => p.quitter('url')}
              placeholder="https://youtu.be/…"
              className={CHAMP_ASSISTANT}
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-3">
            {b.fichier && (
              <p className="rounded-xl border border-(--lm-bord) px-4 py-3 text-[15px] text-(--lm-encre)">
                {LIBELLE_TYPE_GUIDE[b.type === 'lien' ? 'document' : b.type]} · <span className="break-all text-(--lm-encre-2)">{b.nomFichier}</span>
              </p>
            )}
            <EnvoiFichier
              id={idGuide('fichier')}
              dossier={`logements/${logementId}/guides`}
              accept="video/*,image/*,application/pdf"
              libelle={b.fichier ? 'Remplacer le fichier' : 'Choisir un fichier'}
              size="lg"
              tailleMaxMo={TAILLE_MAX_GUIDE_MO}
              conseilTropLourd="Pour une vidéo plus longue, mettez-la sur YouTube (non répertoriée) ou Google Drive et collez le lien."
              onEnvoye={(urls, fichiers) => maj({ fichier: urls[0], nomFichier: fichiers[0]?.name ?? '', type: typeFichier(fichiers[0]?.name ?? '', fichiers[0]?.type ?? '') })}
            />
            <p className="text-[13px] text-(--lm-encre-2)">
              Une vidéo, une photo ou un PDF, {TAILLE_MAX_GUIDE_MO}
              {NBSP}Mo au plus. Le voyageur reçoit un lien valable 7{NBSP}jours.
            </p>
          </div>
        ))}
      {ecran === 'acces' && (
        <ChoixCourts
          options={OUI_NON}
          valeur={b.acces ? 'oui' : 'non'}
          onChange={(v) => maj({ acces: v === 'oui' })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idGuide('acces')}
          className="grid-cols-2"
        />
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapGuide(b, (t) => LIBELLE_TYPE_GUIDE[t]).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">{enregistreAussitot('Il')}</p>
        </RecapAssistant>
      )}
    </Assistant>,
  );
}

/* --------------------------------------------------------------- question */

const QUESTIONS_QUESTION: Record<EcranQuestion, { question: string; aide?: string }> = {
  question: { question: `Quelle question posent les voyageurs${NBSP}?` },
  reponse: { question: `Que leur répond votre agent${NBSP}?`, aide: 'Il reprend cette réponse telle quelle.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const idQuestion = (cle: string) => `assistant-question-${cle}`;

export function AssistantQuestion({ logement, onAjoute, onFermer }: { logement?: Logement; onAjoute: (q: QuestionFrequente) => void; onFermer: () => void }) {
  const [b, setB] = useState<BrouillonQuestion>(questionVide);
  const depart = useRef(b);
  const titreId = useId();
  const p = useParcours<EcranQuestion>({ ecrans: ECRANS_QUESTION, idChamp: idQuestion });
  const ecran = p.ecran;
  const erreurs = erreursQuestion(ecran, b);
  const etat = p.etat(erreurs);

  const ajouter = () => {
    const r = questionDepuisBrouillon(b, nouvelId('question'));
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursQuestion('recapitulatif', b)));
    onAjoute(r.question);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, ajouter);
  const q = QUESTIONS_QUESTION[ecran];

  return horsDuFormulaire(
    <Assistant
      titre="Nouvelle question"
      ecrans={ECRANS_QUESTION}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Ajouter la question')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette question${NBSP}?`}
      onFermer={onFermer}
    >
      {ecran === 'question' && (
        <Field label="Question" erreur={etat.erreurChamp('question')}>
          <Input
            id={idQuestion('question')}
            value={b.question}
            onChange={(e) => setB({ ...b, question: e.target.value })}
            onBlur={() => p.quitter('question')}
            placeholder={`Où jeter les poubelles${NBSP}?`}
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'reponse' && (
        <Field label="Réponse" aide={aideOuCode(b.reponse, logement)} erreur={etat.erreurChamp('reponse')}>
          <Textarea
            id={idQuestion('reponse')}
            rows={5}
            value={b.reponse}
            onChange={(e) => setB({ ...b, reponse: e.target.value })}
            onBlur={() => p.quitter('reponse')}
            placeholder="Local au rez-de-chaussée, à droite de l’entrée. Sortie le mardi soir."
            className="text-[16px]"
          />
        </Field>
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapQuestion(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">{enregistreAussitot('Elle')}</p>
        </RecapAssistant>
      )}
    </Assistant>,
  );
}
