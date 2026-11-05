/**
 * « Ajouter quelqu'un » de Paramètres → Équipe, pas à pas (kit
 * ui/Assistant.tsx) : son adresse e-mail, le nom affiché, son rôle, puis le
 * récapitulatif. Rien n'est enregistré avant « Créer le membre » ; règles
 * et ligne : data/creation-membre.ts. L'invitation se propose ensuite sur la
 * page, comme avant.
 */
import { useId, useRef, useState } from 'react';
import { ECRANS_MEMBRE, SANS_CHAMP_MEMBRE, brouillonMembre, erreursMembre, membreDepuisBrouillon, recapMembre, type BrouillonMembre, type EcranMembre } from '../../data/creation-membre';
import { brouillonModifie } from '../../data/parcours-assistant';
import { useErp } from '../../data/store';
import type { RoleUtilisateur, Utilisateur } from '../../data/types';
import { Assistant, CHAMP_ASSISTANT, ChoixListe, Field, Input, NBSP, RecapAssistant, useParcours, type OptionChoix } from '../../ui';

const idChamp = (cle: string) => `assistant-membre-${cle}`;

const QUESTIONS: Record<EcranMembre, { question: string; aide?: string }> = {
  email: { question: `Quelle est son adresse e-mail${NBSP}?`, aide: 'Il créera son compte avec cette adresse.' },
  nom: { question: `Quel nom afficher${NBSP}?`, aide: 'Celui que verra l’équipe.' },
  role: { question: `Que pourra-t-il faire${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

/** `roles` : les rôles proposés (sans « prestataire »), avec ce que chacun permet. `onAjoute` : la ligne ajoutée, pour proposer l'invitation. */
export function AssistantMembre({ roles, onFermer, onAjoute }: { roles: OptionChoix<RoleUtilisateur>[]; onFermer: () => void; onAjoute: (u: Utilisateur) => void }) {
  const d = useErp();
  const [b, setB] = useState<BrouillonMembre>(brouillonMembre);
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const p = useParcours<EcranMembre>({ ecrans: ECRANS_MEMBRE, idChamp, sansChamp: SANS_CHAMP_MEMBRE });
  const ecran = p.ecran;
  const erreurs = erreursMembre(ecran, b, d.utilisateurs);
  // Adresse déjà dans l'équipe : dit tout de suite sous le champ.
  const etat = p.etat(erreurs, (k) => k === 'email' && erreurs.email === 'Ce membre existe déjà.');
  const maj = (patch: Partial<BrouillonMembre>) => setB((x) => ({ ...x, ...patch }));

  const ajouter = () => {
    if (envoi) return;
    const r = membreDepuisBrouillon(b, { utilisateurs: d.utilisateurs, reel: d.mode === 'reel', maintenantMs: Date.now() });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursMembre('recapitulatif', b, d.utilisateurs)));
    setEnvoi(true);
    d.upsert('utilisateurs', r.membre);
    onFermer();
    onAjoute(r.membre);
  };
  const continuer = () => p.continuer(erreurs, ajouter);
  const q = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Nouveau membre"
      ecrans={ECRANS_MEMBRE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le membre')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner l’ajout${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'email' && (
        <Field label="Adresse e-mail" erreur={etat.erreurChamp('email')}>
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
      {ecran === 'nom' && (
        <Field label="Nom affiché" erreur={etat.erreurChamp('nom')}>
          <Input id={idChamp('nom')} value={b.nom} onChange={(e) => maj({ nom: e.target.value })} onBlur={() => p.quitter('nom')} autoComplete="off" className={CHAMP_ASSISTANT} />
        </Field>
      )}
      {ecran === 'role' && <ChoixListe options={roles} valeur={b.role} onChange={(role) => maj({ role })} onContinuer={continuer} labelledBy={titreId} idPremier={idChamp('role')} />}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapMembre(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">Vous pourrez ensuite lui envoyer l’invitation, pour qu’il crée son compte.</p>
        </RecapAssistant>
      )}
    </Assistant>
  );
}
