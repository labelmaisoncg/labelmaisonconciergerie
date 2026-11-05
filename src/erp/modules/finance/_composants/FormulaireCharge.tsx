import { useId, useMemo, useRef, useState } from 'react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { brouillonModifie } from '../../../data/parcours-assistant';
import { ECRANS_CHARGE, brouillonCharge, chargeDepuisBrouillon, erreursCharge, recapCharge, type BrouillonCharge, type EcranCharge } from '../../../data/creation-charge';
import type { CategorieCharge, Charge } from '../../../data/types';
import { Assistant, Button, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, Field, Input, InputEuros, Modal, NBSP, RecapAssistant, SearchInput, Select, useParcours } from '../../../ui';

interface Props {
  /** Charge à modifier ; absente pour une création. */
  charge?: Charge;
  onFermer: () => void;
}

/**
 * Création pas à pas (AssistantCharge) ou modification par le formulaire
 * (ModificationCharge) d'une charge. Monté uniquement quand il est ouvert.
 * Règles de la création : data/creation-charge.ts.
 */
export function FormulaireCharge({ charge, onFermer }: Props) {
  return charge ? <ModificationCharge charge={charge} onFermer={onFermer} /> : <AssistantCharge onFermer={onFermer} />;
}

const CATEGORIES = (Object.keys(LIBELLES.categorieCharge) as CategorieCharge[]).map((c) => ({ valeur: c, libelle: LIBELLES.categorieCharge[c] }));

/* ---------------------------------------------------------------- création */

const QUESTIONS: Record<EcranCharge, { question: string; aide?: string }> = {
  libelle: { question: `Quelle dépense${NBSP}?`, aide: `Dépense de la conciergerie${NBSP}: produits, transport, logiciels…` },
  montant: { question: `Combien, et quand${NBSP}?` },
  categorie: { question: `Dans quelle catégorie${NBSP}?` },
  logement: { question: `Pour quel logement${NBSP}?`, aide: `Affectez-la à un logement si elle ne concerne que lui${NBSP}: elle entre alors dans sa rentabilité.` },
  recapitulatif: { question: `Tout est correct${NBSP}?` },
};

const GENERALE = '__generale__';
const SEUIL_RECHERCHE = 6;
const idChamp = (cle: string) => `assistant-charge-${cle}`;

function AssistantCharge({ onFermer }: { onFermer: () => void }) {
  const d = useErp();
  const [b, setB] = useState<BrouillonCharge>(() => brouillonCharge(AUJOURDHUI));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const [recherche, setRecherche] = useState('');
  const titreId = useId();
  const p = useParcours<EcranCharge>({ ecrans: ECRANS_CHARGE, idChamp });
  const ecran = p.ecran;
  const erreurs = erreursCharge(ecran, b);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonCharge>) => setB((x) => ({ ...x, ...patch }));
  const logements = useMemo(() => [...d.logements].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')), [d.logements]);
  const q = recherche.trim().toLocaleLowerCase('fr');
  const visibles = q ? logements.filter((l) => `${l.nom} ${l.ville}`.toLocaleLowerCase('fr').includes(q)) : logements;

  const creer = () => {
    if (envoi) return;
    const r = chargeDepuisBrouillon(b, nouvelId('chg'));
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursCharge('recapitulatif', b)));
    setEnvoi(true);
    d.upsert('charges', r.charge);
    onFermer();
  };
  const continuer = () => p.continuer(erreurs, creer);
  const question = QUESTIONS[ecran];

  return (
    <Assistant
      titre="Nouvelle charge"
      ecrans={ECRANS_CHARGE}
      ecran={ecran}
      question={question.question}
      aide={question.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Ajouter la charge')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette charge${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'libelle' && (
        <Field label="Libellé" erreur={etat.erreurChamp('libelle')}>
          <Input
            id={idChamp('libelle')}
            value={b.libelle}
            onChange={(e) => maj({ libelle: e.target.value })}
            onBlur={() => p.quitter('libelle')}
            placeholder="Ex. produits d’entretien"
            autoComplete="off"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      )}
      {ecran === 'montant' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant TTC" erreur={etat.erreurChamp('montant')}>
            <InputEuros id={idChamp('montant')} value={b.montant} onChange={(e) => maj({ montant: e.target.value })} onBlur={() => p.quitter('montant')} placeholder="0,00" />
          </Field>
          <Field label="Date" erreur={etat.erreurChamp('date')}>
            <Input id={idChamp('date')} type="date" value={b.date} onChange={(e) => maj({ date: e.target.value })} onBlur={() => p.quitter('date')} className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'categorie' && (
        <ChoixCourts options={CATEGORIES} valeur={b.categorie} onChange={(categorie) => maj({ categorie })} onContinuer={continuer} labelledBy={titreId} className="grid-cols-2 sm:grid-cols-3" />
      )}
      {ecran === 'logement' && (
        <>
          {logements.length > SEUIL_RECHERCHE && (
            <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom ou ville" label="Rechercher un logement" className="mb-3 sm:w-full" />
          )}
          <ChoixListe
            options={[
              ...(q ? [] : [{ valeur: GENERALE, libelle: 'Charge générale', detail: 'Elle ne concerne aucun logement en particulier' }]),
              ...visibles.map((l) => ({ valeur: l.id, libelle: l.nom, detail: l.ville })),
            ]}
            valeur={b.logementId || GENERALE}
            onChange={(v) => maj({ logementId: v === GENERALE ? '' : v })}
            onContinuer={continuer}
            labelledBy={titreId}
          />
        </>
      )}
      {ecran === 'recapitulatif' && <RecapAssistant lignes={recapCharge(b, d.logements).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))} />}
    </Assistant>
  );
}

/* ------------------------------------------------------------ modification */

function ModificationCharge({ charge, onFermer }: { charge: Charge; onFermer: () => void }) {
  const d = useErp();
  const [date, setDate] = useState(charge.date);
  const [libelle, setLibelle] = useState(charge.libelle);
  const [categorie, setCategorie] = useState<CategorieCharge>(charge.categorie);
  const [montant, setMontant] = useState(String(charge.montantCentimes / 100).replace('.', ','));
  const [logementId, setLogementId] = useState(charge.logementId ?? '');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const enregistrer = () => {
    const centimes = versCentimes(montant);
    const e: Record<string, string> = {};
    if (!libelle.trim()) e.libelle = 'Indiquez un libellé.';
    if (!Number.isFinite(centimes) || centimes <= 0) e.montant = 'Montant invalide.';
    if (!date) e.date = 'Date requise.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    d.upsert('charges', {
      id: charge.id,
      date,
      libelle: libelle.trim(),
      categorie,
      montantCentimes: centimes,
      logementId: logementId || undefined,
    });
    onFermer();
  };

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Modifier la charge"
      description="Dépense de Label Maison. Affectez-la à un logement si elle ne concerne que lui : elle entre alors dans sa rentabilité."
      pied={
        <>
          <Button
            variant="ghost"
            className="mr-auto text-(--lm-danger)"
            onClick={() => {
              d.remove('charges', charge.id);
              onFermer();
            }}
          >
            Supprimer
          </Button>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" onClick={enregistrer}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Libellé" requis erreur={erreurs.libelle} className="sm:col-span-2">
          <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. produits d’entretien" />
        </Field>
        <Field label="Date" requis erreur={erreurs.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Montant TTC (€)" requis erreur={erreurs.montant}>
          <Input inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0,00" />
        </Field>
        <Field label="Catégorie">
          <Select value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieCharge)} options={CATEGORIES} />
        </Field>
        <Field label="Logement concerné" aide="Laisser vide pour une charge générale.">
          <Select value={logementId} onChange={(e) => setLogementId(e.target.value)} placeholder="Charge générale" options={d.logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        </Field>
      </div>
    </Modal>
  );
}
