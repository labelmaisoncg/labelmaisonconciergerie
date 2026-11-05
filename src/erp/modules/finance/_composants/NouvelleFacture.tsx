/**
 * Nouvelle facture, pas à pas (kit ui/Assistant.tsx) : le type, le
 * destinataire, les dates, les lignes, la TVA, l'émettre ou la garder en
 * brouillon, puis le récapitulatif. Rien n'est enregistré avant le dernier
 * bouton ; règles et facture : data/creation-facture.ts. Numéro attribué
 * automatiquement.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, euros } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { brouillonModifie } from '../../../data/parcours-assistant';
import {
  ECRANS_FACTURE,
  LIGNE_VIDE,
  SANS_CHAMP_FACTURE,
  brouillonFacture,
  cleLigne,
  erreursFacture,
  factureDepuisBrouillon,
  recapFacture,
  totauxFacture,
  type BrouillonFacture,
  type EcranFacture,
  type LigneSaisie,
} from '../../../data/creation-facture';
import type { DestinataireFacture, TypeFacture } from '../../../data/types';
import { Assistant, Button, CHAMP_ASSISTANT, ChoixCourts, ChoixListe, Field, IconButton, Input, InputEuros, NBSP, Prerequis, RecapAssistant, SearchInput, useParcours } from '../../../ui';
import { prochainNumero } from '../_calculs';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (id: string) => void;
}

export function NouvelleFacture({ ouvert, onFermer, onCree }: Props) {
  if (!ouvert) return null;
  // Monté à chaque ouverture : un brouillon neuf.
  return <AssistantFacture onFermer={onFermer} onCree={onCree} />;
}

const options = <K extends string>(r: Record<K, string>) => (Object.keys(r) as K[]).map((k) => ({ valeur: k, libelle: r[k] }));
const TYPES_DETAIL: Record<TypeFacture, string> = {
  commission: 'Ce que la conciergerie facture au propriétaire',
  menage: 'Ménages refacturés',
  prestation: 'Autre service rendu',
  avoir: `Remboursement${NBSP}: prix négatifs permis`,
};

const SEUIL_RECHERCHE = 6;
const idChamp = (cle: string) => `assistant-facture-${cle}`;

function AssistantFacture({ onFermer, onCree }: Omit<Props, 'ouvert'>) {
  const d = useErp();
  const [b, setB] = useState<BrouillonFacture>(() => brouillonFacture(AUJOURDHUI));
  const depart = useRef(b);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const numero = prochainNumero(d.factures);
  const proprietaires = useMemo(() => [...d.proprietaires].sort((x, y) => x.nom.localeCompare(y.nom, 'fr')), [d.proprietaires]);
  const ctx = { proprietaires };
  const p = useParcours<EcranFacture>({ ecrans: ECRANS_FACTURE, idChamp, sansChamp: SANS_CHAMP_FACTURE });
  const ecran = p.ecran;
  const erreurs = erreursFacture(ecran, b, ctx);
  const etat = p.etat(erreurs);
  const maj = (patch: Partial<BrouillonFacture>) => setB((x) => ({ ...x, ...patch }));
  const t = totauxFacture(b);

  const creer = () => {
    if (envoi) return;
    const r = factureDepuisBrouillon(b, { ...ctx, id: nouvelId('fac'), numero });
    if (!r.ok) return p.corriger(r.ecran, Object.keys(erreursFacture('recapitulatif', b, ctx)));
    setEnvoi(true);
    d.upsert('factures', r.facture);
    onFermer();
    onCree(r.facture.id);
  };
  const continuer = () => p.continuer(erreurs, creer);
  // Le propriétaire destinataire n'existe pas encore : on dit quoi faire (ou on change de destinataire).
  const sansProprietaire = ecran === 'destinataire' && b.destinataire === 'proprietaire' && !proprietaires.length;

  const questions: Record<EcranFacture, { question: string; aide?: string }> = {
    type: { question: `Quel type de facture${NBSP}?`, aide: `Numéro attribué automatiquement${NBSP}: ${numero}.` },
    destinataire: { question: `À qui est-elle adressée${NBSP}?` },
    dates: { question: `Quelles dates${NBSP}?` },
    lignes: { question: `Que facturez-vous${NBSP}?`, aide: 'Une ligne par prestation, prix unitaires hors taxes.' },
    tva: { question: `Quel taux de TVA${NBSP}?`, aide: 'Taux à valider avec l’expert-comptable.' },
    statut: { question: `L’émettre maintenant${NBSP}?` },
    recapitulatif: { question: `Tout est correct${NBSP}?`, aide: `Facture ${numero}, émise par Label Maison Conciergerie SASU.` },
  };
  const q = questions[ecran];

  return (
    <Assistant
      titre="Nouvelle facture"
      ecrans={ECRANS_FACTURE}
      ecran={ecran}
      question={q.question}
      aide={q.aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite(b.statut === 'emise' ? 'Émettre la facture' : 'Enregistrer le brouillon')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={sansProprietaire}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner cette facture${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {ecran === 'type' && (
        <ChoixListe
          options={options<TypeFacture>(LIBELLES.typeFacture).map((o) => ({ ...o, detail: TYPES_DETAIL[o.valeur] }))}
          valeur={b.type}
          onChange={(type) => maj({ type })}
          onContinuer={continuer}
          labelledBy={titreId}
        />
      )}
      {ecran === 'destinataire' && <Destinataire b={b} maj={maj} proprietaires={proprietaires} continuer={continuer} titreId={titreId} />}
      {ecran === 'dates' && (
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <Field label="Date d’émission" erreur={etat.erreurChamp('emission')}>
            <Input id={idChamp('emission')} type="date" value={b.emission} onChange={(e) => maj({ emission: e.target.value })} onBlur={() => p.quitter('emission')} className={CHAMP_ASSISTANT} />
          </Field>
          <Field label="Échéance" erreur={etat.erreurChamp('echeance')}>
            <Input id={idChamp('echeance')} type="date" value={b.echeance} onChange={(e) => maj({ echeance: e.target.value })} onBlur={() => p.quitter('echeance')} className={CHAMP_ASSISTANT} />
          </Field>
        </div>
      )}
      {ecran === 'lignes' && (
        <Lignes
          lignes={b.lignes}
          onChange={(lignes) => maj({ lignes })}
          erreur={etat.erreurChamp}
          quitter={p.quitter}
          totalHt={t.ht}
        />
      )}
      {ecran === 'tva' && (
        <>
          <Field label="TVA (%)" erreur={etat.erreurChamp('tva')} className="max-w-40">
            <Input id={idChamp('tva')} inputMode="decimal" value={b.tva} onChange={(e) => maj({ tva: e.target.value })} onBlur={() => p.quitter('tva')} autoComplete="off" className={CHAMP_ASSISTANT} />
          </Field>
          <dl className="lm-chiffres mt-6 space-y-1.5 border-t border-(--lm-bord) pt-4 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt className="text-(--lm-encre-2)">Total HT</dt>
              <dd>{euros(t.ht)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-(--lm-encre-2)">TVA</dt>
              <dd>{euros(t.tva)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-(--lm-bord-fort) pt-1.5 font-semibold">
              <dt>Total TTC</dt>
              <dd>{euros(t.ttc)}</dd>
            </div>
          </dl>
        </>
      )}
      {ecran === 'statut' && (
        <ChoixListe
          options={[
            { valeur: 'emise', libelle: 'Émettre maintenant', detail: `Elle part avec le numéro ${numero}` },
            { valeur: 'brouillon', libelle: 'Garder en brouillon', detail: 'Vous l’émettrez plus tard' },
          ]}
          valeur={b.statut}
          onChange={(statut) => maj({ statut })}
          onContinuer={continuer}
          labelledBy={titreId}
        />
      )}
      {ecran === 'recapitulatif' && <RecapAssistant lignes={recapFacture(b, proprietaires).map((l) => ({ ...l, onModifier: () => p.modifier(l.ecran) }))} />}
    </Assistant>
  );
}

function Destinataire({
  b,
  maj,
  proprietaires,
  continuer,
  titreId,
}: {
  b: BrouillonFacture;
  maj: (p: Partial<BrouillonFacture>) => void;
  proprietaires: { id: string; nom: string }[];
  continuer: () => void;
  titreId: string;
}) {
  const [recherche, setRecherche] = useState('');
  const quelId = useId();
  const q = recherche.trim().toLocaleLowerCase('fr');
  const visibles = q ? proprietaires.filter((p) => p.nom.toLocaleLowerCase('fr').includes(q)) : proprietaires;
  return (
    <>
      <ChoixCourts
        options={options<DestinataireFacture>(LIBELLES.destinataire)}
        valeur={b.destinataire}
        onChange={(destinataire) => maj({ destinataire })}
        onContinuer={continuer}
        labelledBy={titreId}
        className="grid-cols-3"
      />
      {b.destinataire === 'proprietaire' && (
        <div className="mt-6 border-t border-(--lm-bord) pt-5">
          {proprietaires.length ? (
            <>
              <p id={quelId} className="mb-2 text-[15px] font-medium text-(--lm-encre)">
                Quel propriétaire{NBSP}?
              </p>
              {proprietaires.length > SEUIL_RECHERCHE && (
                <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom du propriétaire" label="Rechercher un propriétaire" className="mb-3 sm:w-full" />
              )}
              {visibles.length ? (
                <ChoixListe
                  options={visibles.map((p) => ({ valeur: p.id, libelle: p.nom }))}
                  valeur={b.proprietaireId || undefined}
                  onChange={(proprietaireId) => maj({ proprietaireId })}
                  onContinuer={continuer}
                  labelledBy={quelId}
                />
              ) : (
                <p className="text-[14px] text-(--lm-encre-2)">Aucun propriétaire ne correspond.</p>
              )}
            </>
          ) : (
            <Prerequis manque="Vous n’avez pas encore de propriétaire." lien="/erp/proprietaires?nouveau=1" action="Nouveau propriétaire" />
          )}
        </div>
      )}
    </>
  );
}

function Lignes({
  lignes,
  onChange,
  erreur,
  quitter,
  totalHt,
}: {
  lignes: LigneSaisie[];
  onChange: (l: LigneSaisie[]) => void;
  erreur: (cle: string) => string | undefined;
  quitter: (cle: string) => void;
  totalHt: number;
}) {
  const maj = (i: number, patch: Partial<LigneSaisie>) => onChange(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <>
      <ol className="space-y-3">
        {lignes.map((l, i) => (
          <li key={i} className="rounded-xl border border-(--lm-bord) p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-(--lm-encre)">Ligne {i + 1}</p>
              {lignes.length > 1 && (
                <IconButton label={`Supprimer la ligne ${i + 1}`} size="sm" onClick={() => onChange(lignes.filter((_, j) => j !== i))} className="max-sm:size-11">
                  <Trash2 />
                </IconButton>
              )}
            </div>
            <div className="mt-2 grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
              <Field label="Désignation" erreur={erreur(cleLigne(i, 'libelle'))} className="col-span-2">
                <Input id={idChamp(cleLigne(i, 'libelle'))} value={l.libelle} onChange={(e) => maj(i, { libelle: e.target.value })} onBlur={() => quitter(cleLigne(i, 'libelle'))} autoComplete="off" className={CHAMP_ASSISTANT} />
              </Field>
              <Field label="Quantité" erreur={erreur(cleLigne(i, 'quantite'))}>
                <Input id={idChamp(cleLigne(i, 'quantite'))} inputMode="decimal" value={l.quantite} onChange={(e) => maj(i, { quantite: e.target.value })} onBlur={() => quitter(cleLigne(i, 'quantite'))} autoComplete="off" className={CHAMP_ASSISTANT} />
              </Field>
              <Field label="Prix unitaire HT" erreur={erreur(cleLigne(i, 'pu'))}>
                <InputEuros id={idChamp(cleLigne(i, 'pu'))} value={l.pu} onChange={(e) => maj(i, { pu: e.target.value })} onBlur={() => quitter(cleLigne(i, 'pu'))} />
              </Field>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" icone={<Plus />} onClick={() => onChange([...lignes, { ...LIGNE_VIDE }])} className="max-sm:min-h-11">
          Ajouter une ligne
        </Button>
        <p className="lm-chiffres text-[15px] text-(--lm-encre)">
          Total HT <span className="font-semibold">{euros(totalHt)}</span>
        </p>
      </div>
    </>
  );
}
