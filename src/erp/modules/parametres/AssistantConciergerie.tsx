/**
 * « Inviter une conciergerie » de Paramètres → Espaces, pas à pas (kit
 * ui/Assistant.tsx) : le nom de la conciergerie, l'adresse de la personne qui
 * ouvrira son espace, puis le récapitulatif. Rien ne part avant « Envoyer
 * l'invitation » ;
 * règles et corps de l'envoi : data/creation-conciergerie.ts. L'envoi passe
 * par la même fonction que « Renvoyer » (Espaces.tsx) ; une erreur reste dans
 * l'assistant, le lien ou la confirmation s'affiche sur la page.
 */
import { useId, useRef, useState } from 'react';
import {
  ECRANS_CONCIERGERIE,
  NOM_CONCIERGERIE_MAX,
  brouillonConciergerie,
  erreursConciergerie,
  invitationConciergerie,
  recapConciergerie,
  type BrouillonConciergerie,
  type EcranConciergerie,
} from '../../data/creation-conciergerie';
import { brouillonModifie } from '../../data/parcours-assistant';
import { Alert, Assistant, CHAMP_ASSISTANT, Field, Input, NBSP, RecapAssistant, useParcours } from '../../ui';

const idChamp = (cle: string) => `assistant-conciergerie-${cle}`;

const QUESTIONS: Record<EcranConciergerie, { question: string; aide?: string }> = {
  nom: { question: `Quelle conciergerie invitez-vous${NBSP}?`, aide: 'Son espace portera ce nom, qui ne se change plus ensuite.' },
  email: { question: `Qui ouvrira son espace${NBSP}?`, aide: 'Cette personne crée son compte avec cette adresse, puis l’espace de sa conciergerie, qu’elle gère seule.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

/** `onInviter` : l'envoi (api/erp-espaces) ; rend l'erreur à montrer, ou rien quand l'invitation est partie. */
export function AssistantConciergerie({ onInviter, onFermer }: { onInviter: (cible: { nom: string; email: string }) => Promise<string | undefined>; onFermer: () => void }) {
  const [b, setB] = useState<BrouillonConciergerie>(brouillonConciergerie);
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const titreId = useId();
  const p = useParcours<EcranConciergerie>({ ecrans: ECRANS_CONCIERGERIE, idChamp });
  const ecran = p.ecran;
  const erreurs = erreursConciergerie(ecran, b);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonConciergerie>) => setB((x) => ({ ...x, ...patch }));

  const inviter = async () => {
    if (envoi) return;
    const r = invitationConciergerie(b);
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursConciergerie('recapitulatif', b)));
    setEnvoi(true);
    setErreurEnvoi(undefined);
    const erreur = await onInviter({ nom: r.corps.nom, email: r.corps.email });
    setEnvoi(false);
    if (erreur) setErreurEnvoi(erreur);
    else onFermer();
  };
  const continuer = () => p.continuer(erreurs, () => void inviter());
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Inviter une conciergerie"
      ecrans={ECRANS_CONCIERGERIE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Envoyer l’invitation')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner l’invitation${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'nom' && (
        <Field label="Nom de la conciergerie" erreur={etat.erreurChamp('nom')}>
          <Input
            id={idChamp('nom')}
            value={b.nom}
            maxLength={NOM_CONCIERGERIE_MAX}
            onChange={(e) => maj({ nom: e.target.value })}
            onBlur={() => p.quitter('nom')}
            autoComplete="organization"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'email' && (
        <Field label="Son adresse e-mail" erreur={etat.erreurChamp('email')}>
          <Input
            id={idChamp('email')}
            type="email"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            value={b.email}
            onChange={(e) => maj({ email: e.target.value })}
            onBlur={() => p.quitter('email')}
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapConciergerie(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">L’invitation est valable 14{NBSP}jours, une seule fois.</p>
          {erreurEnvoi && (
            <Alert tone="danger" className="mt-4">
              {erreurEnvoi}
            </Alert>
          )}
        </RecapAssistant>
      )}
    </Assistant>
  );
}
