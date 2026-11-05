/**
 * Nouveau contact du CRM, pas à pas (kit ui/Assistant.tsx) : son nom,
 * comment le joindre, son bien, une note, puis le récapitulatif. Rien n'est
 * enregistré avant « Ajouter le contact » ; règles et ligne écrite :
 * data/creation-contact.ts. Un contact déjà en cours avec ce numéro ou cet
 * e-mail est signalé, avec « Ouvrir sa fiche ».
 */
import { useRef, useState } from 'react';
import { Alert, Assistant, Button, CHAMP_ASSISTANT, Field, Input, NBSP, RecapAssistant, Textarea, useParcours } from '../../../ui';
import { horodatageMaintenant } from '../../../data/format';
import { idContactCrm } from '../../../data/crm';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_CONTACT,
  SANS_CHAMP_CONTACT,
  brouillonContact,
  contactDepuisBrouillon,
  doublonContact,
  erreursContact,
  recapContact,
  type BrouillonContact,
  type EcranContact,
} from '../../../data/creation-contact';
import { useErp } from '../../../data/store';
import type { ContactCrm } from '../../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  contacts: ContactCrm[];
  /** « Ouvrir sa fiche » d'un contact déjà en cours. */
  onOuvrir: (id: string) => void;
}

export function AssistantContact({ ouvert, ...props }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf.
  return <Parcours {...props} />;
}

const QUESTIONS: Record<EcranContact, { question: string; aide?: string }> = {
  nom: { question: `Quel est son nom${NBSP}?` },
  joindre: { question: `Comment le joindre${NBSP}?`, aide: 'Un téléphone ou un e-mail, au moins.' },
  bien: { question: `Où est son bien${NBSP}?`, aide: 'Facultatif.' },
  notes: { question: `Une note${NBSP}?`, aide: 'Facultatif.' },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const idChamp = (cle: string) => `assistant-contact-${cle === 'joindre' ? 'telephone' : cle}`;

function Parcours({ onFermer, contacts, onOuvrir }: Omit<Props, 'ouvert'>) {
  const { upsert, utilisateur } = useErp();
  const [b, setB] = useState<BrouillonContact>(brouillonContact);
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const p = useParcours<EcranContact>({ ecrans: ECRANS_CONTACT, idChamp, sansChamp: SANS_CHAMP_CONTACT });
  const ecran = p.ecran;
  const erreurs = erreursContact(ecran, b);
  const etat = p.etat(erreurs);
  const doublon = doublonContact(contacts, b);
  const champ = (k: keyof BrouillonContact) => (e: { target: { value: string } }) => setB((x) => ({ ...x, [k]: e.target.value }));

  const creer = () => {
    if (envoi) return;
    const maintenant = horodatageMaintenant();
    const r = contactDepuisBrouillon(b, { id: idContactCrm(), par: utilisateur.nom, maintenant });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursContact('recapitulatif', b)));
    setEnvoi(true);
    upsert('crm', r.contact);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, creer);
  const q = QUESTIONS[ecran];

  const alerteDoublon = doublon && (
    <Alert
      tone="alerte"
      className="mt-4"
      titre={`${doublon.nom} est déjà dans le CRM avec ce numéro ou cet e-mail.`}
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            onFermer();
            onOuvrir(doublon.id);
          }}
        >
          Ouvrir sa fiche
        </Button>
      }
    />
  );

  return (
    <Assistant
      titre="Nouveau contact"
      ecrans={ECRANS_CONTACT}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      blocage={etat}
      libelleSuite={p.libelleSuite('Ajouter le contact')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce contact${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'nom' && (
        <Field label="Nom" erreur={etat.erreurChamp('nom')}>
          <Input id={idChamp('nom')} value={b.nom} onChange={champ('nom')} onBlur={() => p.quitter('nom')} autoComplete="off" className={CHAMP_ASSISTANT} />
        </Field>
      )}
      {ecran === 'joindre' && (
        <>
          <div className="space-y-4">
            <Field label="Téléphone">
              <Input id={idChamp('telephone')} type="tel" value={b.telephone} onChange={champ('telephone')} autoComplete="off" className={CHAMP_ASSISTANT} />
            </Field>
            <Field label="E-mail">
              <Input id={idChamp('email')} type="email" inputMode="email" value={b.email} onChange={champ('email')} autoComplete="off" className={CHAMP_ASSISTANT} />
            </Field>
          </div>
          {alerteDoublon}
        </>
      )}
      {ecran === 'bien' && (
        <div className="space-y-4">
          <Field label="Ville">
            <Input id={idChamp('ville')} value={b.ville} onChange={champ('ville')} autoComplete="off" className={CHAMP_ASSISTANT} />
          </Field>
          <Field label="Bien">
            <Input id={idChamp('typeBien')} value={b.typeBien} onChange={champ('typeBien')} placeholder="T2, maison…" autoComplete="off" className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'notes' && (
        <Field label="Notes">
          <Textarea id={idChamp('notes')} rows={4} value={b.notes} onChange={champ('notes')} className="text-[16px]" />
        </Field>
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapContact(b).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>{alerteDoublon}</RecapAssistant>
      )}
    </Assistant>
  );
}
