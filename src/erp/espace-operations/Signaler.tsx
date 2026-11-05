import { useEffect, useId, useRef, useState } from 'react';
import {
  SANS_CHAMP_SIGNALEMENT,
  brouillonSignalement,
  ecransSignalement,
  erreursSignalement,
  recapSignalement,
  sejoursDuLogement,
  signalementDepuisBrouillon,
  type BrouillonSignalement,
  type EcranSignalement,
} from '../data/creation-signalement';
import { jourMois } from '../data/format';
import { phrasePrevenus, type Prevenus } from '../data/notifications-operations';
import { brouillonModifie } from '../data/parcours-assistant';
import { Alert, Assistant, Button, ChoixCourts, ChoixListe, Field, Modal, NBSP, RecapAssistant, Textarea, useParcours } from '../ui';
import { ChoixPhotos, type PhotoChoisie } from './Photos';
import { useOps } from './commun';

const QUESTIONS: Record<EcranSignalement, { question: string; aide?: string }> = {
  logement: { question: `Quel logement${NBSP}?` },
  priorite: { question: `Est-ce urgent${NBSP}?` },
  description: { question: `Que se passe-t-il${NBSP}?`, aide: 'Ce que vous constatez, et ce qu’il faut faire.' },
  photos: { question: `Avez-vous des photos${NBSP}?`, aide: 'Facultatif, 6 au plus.' },
  sejour: { question: `Quel séjour est concerné${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const PRIORITES = [
  { valeur: 'normal', libelle: 'Normal' },
  { valeur: 'urgent', libelle: 'Urgent' },
] as const;

const AUCUN = '__aucun__';
const idChamp = (cle: string) => `assistant-signaler-${cle}`;

/**
 * Signaler un incident, pas à pas (kit ui/Assistant.tsx, comme dans l'ERP) :
 * le logement, urgent ou non, ce qui se passe, des photos, le séjour
 * concerné, puis le récapitulatif. Rien ne part avant « Créer l'incident » ; règles
 * et action : data/creation-signalement.ts. Dans l'aperçu du gérant, tout se
 * voit et rien ne part.
 */
export function Signaler({ logementId, onFermer }: { logementId?: string; onFermer: () => void }) {
  const { vue, naviguer, apercu, actions, annoncer } = useOps();
  const [b, setB] = useState<BrouillonSignalement<PhotoChoisie>>(() => brouillonSignalement<PhotoChoisie>(logementId));
  const depart = useRef(b);
  // Qui reçoit vraiment l'urgence : téléphones abonnés, et le gérant s'il a un appareil qui la recevra (null : pas encore su).
  const [prevenus, setPrevenus] = useState<Prevenus | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const titreId = useId();
  // Séjours du logement dans la fenêtre de l'espace (en cours, tout juste partis, à venir).
  const sejours = sejoursDuLogement(vue.sejours, b.logementId);
  const ecrans = ecransSignalement(sejours.length > 0);
  const p = useParcours<EcranSignalement>({ ecrans, idChamp, sansChamp: SANS_CHAMP_SIGNALEMENT });
  const ecran = p.ecran;
  const erreurs = erreursSignalement(ecran, b);
  const pret = p.etat(erreurs);
  // Aperçu du gérant : le récapitulatif se voit, « Signaler » reste grisé (comme le bouton d'avant).
  const etat = apercu && ecran === 'recapitulatif' && pret.valide ? { ...pret, valide: false, raison: `Aperçu${NBSP}: rien n’est envoyé.` } : pret;
  const maj = (patch: Partial<BrouillonSignalement<PhotoChoisie>>) => setB((x) => ({ ...x, ...patch }));

  useEffect(() => {
    setPrevenus(null);
    if (!b.urgent || !b.logementId) return;
    // Aperçu du gérant : rien ne part, la phrase d'avant.
    if (!actions.prevenus) return setPrevenus({ noms: [], gerant: true });
    let actif = true;
    actions.prevenus(b.logementId).then(
      (x) => actif && setPrevenus(x),
      // Réponse illisible : seulement ce qui est sûr.
      () => actif && setPrevenus({ noms: [], gerant: false }),
    );
    return () => {
      actif = false;
    };
  }, [b.urgent, b.logementId, actions]);

  const signaler = async () => {
    if (envoi || apercu) return;
    const r = signalementDepuisBrouillon(b);
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursSignalement('recapitulatif', b)));
    setEnvoi(true);
    setErreurEnvoi(undefined);
    const fait = await actions.agir(r.action);
    setEnvoi(false);
    // Refusé : on le dit ici, la saisie reste.
    if (!fait.ok) return setErreurEnvoi(fait.erreur);
    annoncer(fait.message, 'succes');
    // Une seule navigation : l'assistant se ferme et la liste des incidents s'ouvre.
    naviguer({ onglet: 'incidents', signaler: undefined, logement: undefined });
  };
  const continuer = () => p.continuer(erreurs, () => void signaler());
  const q = QUESTIONS[ecran];
  // L'année seulement quand ce n'est pas celle d'aujourd'hui (séjour à cheval sur le Nouvel An).
  const jour = (iso: string) => (iso.slice(0, 4) === vue.aujourdhui.slice(0, 4) ? jourMois(iso) : `${jourMois(iso)} ${iso.slice(0, 4)}`);
  const libelleSejour = (id: string) => {
    const s = sejours.find((x) => x.id === id);
    return s ? `${s.voyageur}, du ${jour(s.arrivee)} au ${jour(s.depart)}` : undefined;
  };

  return (
    <Assistant
      titre="Nouvel incident"
      ecrans={ecrans}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer l’incident')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce signalement${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'logement' && (
        <ChoixListe
          options={vue.logements.map((l) => ({ valeur: l.id, libelle: l.nom, detail: l.ville }))}
          valeur={b.logementId || undefined}
          // Autre logement : le séjour choisi ne vaut plus.
          onChange={(id) => maj({ logementId: id, sejour: id === b.logementId ? b.sejour : '' })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('logementId')}
        />
      )}
      {ecran === 'priorite' && (
        <>
          <ChoixCourts
            options={PRIORITES}
            valeur={b.urgent ? 'urgent' : 'normal'}
            onChange={(v) => maj({ urgent: v === 'urgent' })}
            onContinuer={continuer}
            labelledBy={titreId}
            idPremier={idChamp('urgent')}
            className="grid-cols-2"
          />
          <p aria-live="polite" className="mt-3 min-h-[1.25rem] text-[14px] text-(--lm-encre-2)">
            {b.urgent && prevenus ? phrasePrevenus(prevenus.noms, prevenus.gerant) : ''}
          </p>
        </>
      )}
      {ecran === 'description' && (
        <Field label="Ce qui se passe" erreur={etat.erreurChamp('description')}>
          <Textarea
            id={idChamp('description')}
            rows={5}
            value={b.description}
            onChange={(e) => maj({ description: e.target.value })}
            onBlur={() => p.quitter('description')}
            className="text-[16px]"
          />
        </Field>
      )}
      {ecran === 'photos' && <ChoixPhotos photos={b.photos} onChange={(photos) => maj({ photos })} tactile />}
      {ecran === 'sejour' && (
        <ChoixListe
          options={[{ valeur: AUCUN, libelle: 'Aucun séjour en particulier' }, ...sejours.map((s) => ({ valeur: s.id, libelle: s.voyageur, detail: `Du ${jour(s.arrivee)} au ${jour(s.depart)}` }))]}
          valeur={b.sejour || AUCUN}
          onChange={(v) => maj({ sejour: v === AUCUN ? '' : v })}
          onContinuer={continuer}
          labelledBy={titreId}
          idPremier={idChamp('sejour')}
        />
      )}
      {ecran === 'recapitulatif' && (
        <RecapAssistant lignes={recapSignalement(b, { logements: vue.logements, libelleSejour, avecSejours: sejours.length > 0 }).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))}>
          {b.urgent && prevenus && <p className="mt-4 text-[13.5px] text-(--lm-encre-2)">{phrasePrevenus(prevenus.noms, prevenus.gerant)}</p>}
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

/** « Ce logement n'est pas à moi » : le gérant est prévenu, le logement reste là jusqu'à sa réponse. */
export function PasAMoi({ logementId, onFermer }: { logementId: string; onFermer: () => void }) {
  const { agir, nomLogement, apercu } = useOps();
  const [motif, setMotif] = useState('');
  const [enCours, setEnCours] = useState(false);
  const envoyer = async () => {
    setEnCours(true);
    const ok = await agir({ type: 'pas-a-moi', logementId, motif: motif.trim() || undefined });
    setEnCours(false);
    if (ok) onFermer();
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Ce logement n’est pas à moi"
      description={`Le gérant reçoit votre message et vérifie. ${nomLogement(logementId)} reste dans votre espace jusqu’à sa réponse.`}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" chargement={enCours} disabled={apercu} onClick={() => void envoyer()}>
            Prévenir le gérant
          </Button>
        </>
      }
    >
      <Field label="Un mot pour le gérant" aide="Facultatif.">
        <Textarea rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. Je ne m’occupe plus de ce logement depuis septembre." maxLength={500} />
      </Field>
    </Modal>
  );
}
