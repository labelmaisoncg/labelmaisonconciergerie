/**
 * « Nouvelle annonce à l'équipe », pas à pas (kit ui/Assistant.tsx) : le
 * titre, le texte, prévenir aussi par notification, puis le récapitulatif.
 * Rien n'est publié avant « Publier l'annonce » (aussitôt, pour toute
 * l'équipe) ; règles : data/creation-annonce-equipe.ts
 * (preparerAnnonce, comme avant). L'enregistrement et la notification restent
 * ceux de la page (AnnoncesEquipe.tsx), qui affiche ensuite ce qui est parti.
 */
import { useId, useRef, useState } from 'react';
import { TEXTE_MAX, TITRE_MAX, type AnnonceEquipe } from '../../data/annonces-equipe';
import {
  SANS_CHAMP_ANNONCE,
  annonceDepuisBrouillon,
  brouillonAnnonce,
  ecransAnnonce,
  erreursAnnonce,
  recapAnnonce,
  type BrouillonAnnonce,
  type EcranAnnonce,
} from '../../data/creation-annonce-equipe';
import { espaceOuvert } from '../../data/espaces';
import { horodatageMaintenant } from '../../data/format';
import { nomConciergerie } from '../../data/marque-espace';
import { brouillonModifie } from '../../data/parcours-assistant';
import { nouvelId, useErp } from '../../data/store';
import { Assistant, CHAMP_ASSISTANT, ChoixCourts, Field, Input, NBSP, RecapAssistant, Textarea, useParcours } from '../../ui';

const idChamp = (cle: string) => `assistant-annonce-${cle}`;

const QUESTIONS: Record<EcranAnnonce, { question: string; aide?: string }> = {
  titre: { question: `Quel est le titre de l’annonce${NBSP}?` },
  texte: { question: `Que voulez-vous dire à l’équipe${NBSP}?` },
  notification: { question: `Prévenir aussi par notification${NBSP}?`, aide: 'Une seule fois, sur les appareils qui ont activé les notifications.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui' },
  { valeur: 'non', libelle: 'Non' },
] as const;

/** `onPublier` : enregistre l'annonce, puis envoie la notification si demandé ; l'assistant se ferme ensuite. */
export function AssistantAnnonce({
  notificationsPossibles,
  onPublier,
  onFermer,
}: {
  notificationsPossibles: boolean;
  onPublier: (annonce: AnnonceEquipe, notifier: boolean) => Promise<void>;
  onFermer: () => void;
}) {
  const d = useErp();
  const [b, setB] = useState<BrouillonAnnonce>(() => brouillonAnnonce(d.annoncesEquipe, nomConciergerie(espaceOuvert())));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const ecrans = ecransAnnonce(notificationsPossibles);
  const p = useParcours<EcranAnnonce>({ ecrans, idChamp, sansChamp: SANS_CHAMP_ANNONCE });
  const ecran = p.ecran;
  const erreurs = erreursAnnonce(ecran, b);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonAnnonce>) => setB((x) => ({ ...x, ...patch }));

  const publier = async () => {
    if (envoi) return;
    const r = annonceDepuisBrouillon(b, { id: nouvelId('aeq'), maintenant: horodatageMaintenant(), par: d.utilisateur.nom, notificationsPossibles });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursAnnonce('recapitulatif', b)));
    setEnvoi(true);
    await onPublier(r.annonce, r.notifier);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, () => void publier());
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Nouvelle annonce à l’équipe"
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Publier l’annonce')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette annonce${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'titre' && (
        <Field label="Titre" aide={`${TITRE_MAX}${NBSP}caractères au plus.`} erreur={etat.erreurChamp('titre')}>
          <Input
            id={idChamp('titre')}
            value={b.titre}
            maxLength={TITRE_MAX}
            onChange={(e) => maj({ titre: e.target.value })}
            onBlur={() => p.quitter('titre')}
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'texte' && (
        <Field label="Texte" aide={`${TEXTE_MAX}${NBSP}caractères au plus.`} erreur={etat.erreurChamp('texte')}>
          <Textarea id={idChamp('texte')} rows={5} value={b.texte} maxLength={TEXTE_MAX} onChange={(e) => maj({ texte: e.target.value })} onBlur={() => p.quitter('texte')} className="text-[16px]" />
        </Field>
      )}
      {ecran === 'notification' && (
        <ChoixCourts
          options={OUI_NON}
          valeur={b.notifier ? 'oui' : 'non'}
          onChange={(v) => maj({ notifier: v === 'oui' })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('notifier')}
          className="grid-cols-2"
        />
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapAnnonce(b, notificationsPossibles).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">Elle s’affiche aussitôt en haut de l’Accueil de chacun, jusqu’à ce qu’il touche «{NBSP}J’ai lu{NBSP}».</p>
        </RecapAssistant>
      )}
    </Assistant>
  );
}
