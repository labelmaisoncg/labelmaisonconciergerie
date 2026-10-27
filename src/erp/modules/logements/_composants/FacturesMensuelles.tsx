/**
 * Factures mensuelles d'un propriétaire, côté gérant (panneau « Espace
 * propriétaire », rubrique Factures, juste après les bilans).
 *
 * - Chaque mois, un brouillon est préparé tout seul à partir du 1er (passage
 *   planifié) ; « Préparer » le crée aussi à la demande, pour n'importe quel
 *   mois terminé.
 * - Le gérant relit l'aperçu exact (même mise en page qu'à l'impression), ne
 *   touche pas aux lignes calculées, ajoute au besoin un ajustement avec sa
 *   raison, puis valide : le contenu final est enregistré, la BASE attribue le
 *   numéro (erp.numeroter_facture), puis la facture est relue, figée. Le
 *   navigateur ne numérote qu'en démonstration.
 * - « Ne pas facturer ce mois » écarte le brouillon : le mois n'est plus
 *   proposé en tête, il reste dans « Facturer un autre mois ».
 * - Validée : « Partager au propriétaire » (la facture entre dans son espace
 *   et dans les relances), impression ou PDF dans la charte « Ivoire & or ».
 *
 * Calculs : data/factures-mensuelles.ts ; identité : Paramètres → Société.
 */
import { useMemo, useState } from 'react';
import { Plus, Printer, Share2, Trash2 } from 'lucide-react';
import { espaceOuvert } from '../../../data/espaces';
import { AUJOURDHUI, dateCourte, euros, horodatageMaintenant, versCentimes } from '../../../data/format';
import { numeroterFactureBase } from '../../../data/factures-base';
import {
  ajouterAjustement,
  calculerFactureMois,
  compteurFactures,
  documentDeFacture,
  ecarterBrouillon,
  estFactureMensuelle,
  factureFigee,
  idFactureMensuelle,
  memesMontantsQueLeBilan,
  moisAPreparer,
  preparerBrouillon,
  prochainNumero,
  retirerAjustement,
  validerAvecLaBase,
  validerFacture,
} from '../../../data/factures-mensuelles';
import { identiteComplete, identiteConciergerie } from '../../../data/identite-conciergerie';
import { partagerFacture } from '../../../data/relances';
import { nouvelId, useErp } from '../../../data/store';
import type { Facture, Proprietaire } from '../../../data/types';
import { DocumentFacture, FactureImprimable } from '../../../espace-proprietaire/DocumentFacture';
import { titreMois } from '../../../espace-proprietaire/commun';
import { Alert, Button, ButtonLink, Field, IconButton, Input, MenuActions, Modal, Select } from '../../../ui';
import { FormMandat } from '../../mandats/FormMandat';

/** « Facture de septembre 2026 », « Facture d’août 2026 ». */
const factureDuMois = (mois: string) => {
  const t = titreMois(mois).toLocaleLowerCase('fr');
  return `Facture ${/^[aàâeéèêiîoôuû]/.test(t) ? 'd’' : 'de '}${t}`;
};

/** Brouillons et mois à facturer de ce propriétaire ; rien du tout s'il n'y a rien à préparer. */
export function FacturesMensuellesAPreparer({ proprietaire: p, onOuvrir }: { proprietaire: Proprietaire; onOuvrir: (id: string) => void }) {
  const d = useErp();
  const [autre, setAutre] = useState('');
  const identite = useMemo(() => identiteConciergerie({ reglages: d.donnees.reglages }, espaceOuvert()), [d.donnees.reglages]);
  const brouillons = d.donnees.factures
    .filter((f) => f.proprietaireId === p.id && estFactureMensuelle(f) && f.statut === 'brouillon' && !factureFigee(f))
    .sort((a, b) => b.mensuelle!.mois.localeCompare(a.mensuelle!.mois));
  // Le mois écoulé à préparer, sauf s'il a été écarté (« Ne pas facturer ce mois ») : il reste alors dans « Facturer un autre mois ».
  const { aPreparer, autres } = useMemo(() => moisAPreparer(d.donnees, p.id, AUJOURDHUI, 12), [d.donnees, p.id]);
  if (!brouillons.length && !aPreparer && !autres.length) return null;

  const preparer = (mois: string) => {
    const existante = d.donnees.factures.find((x) => x.id === idFactureMensuelle(p.id, mois));
    const b = preparerBrouillon({
      donnees: d.donnees,
      proprietaireId: p.id,
      mois,
      existante: existante && !factureFigee(existante) ? existante : undefined,
      identite,
      aujourdhui: AUJOURDHUI,
      maintenant: horodatageMaintenant(),
      par: d.utilisateur.email,
    });
    if (!b) return;
    d.upsert('factures', b);
    setAutre('');
    onOuvrir(b.id);
  };

  const montant = (f: Facture) =>
    preparerBrouillon({ donnees: d.donnees, proprietaireId: p.id, mois: f.mensuelle!.mois, existante: f, identite, aujourdhui: AUJOURDHUI, maintenant: '', par: '' })?.montantHtCentimes ?? f.montantHtCentimes;

  return (
    <div className="mb-4">
      {(brouillons.length > 0 || aPreparer) && (
        <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
          {brouillons.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-(--lm-encre)">{factureDuMois(f.mensuelle!.mois)}</p>
                <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2)">{euros(montant(f))} HT · brouillon à valider</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => onOuvrir(f.id)}>
                Ouvrir
              </Button>
            </li>
          ))}
          {aPreparer && (
            <li className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-(--lm-encre)">{factureDuMois(aPreparer.mois)}</p>
                <p className="lm-chiffres text-[12.5px] text-(--lm-encre-2)">{euros(aPreparer.montant)} HT · à préparer</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => preparer(aPreparer.mois)}>
                Préparer
              </Button>
            </li>
          )}
        </ul>
      )}
      {autres.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`autre-mois-${p.id}`} className="text-[12.5px] text-(--lm-encre-2)">
            Facturer un autre mois
          </label>
          <Select
            id={`autre-mois-${p.id}`}
            value={autre}
            onChange={(e) => setAutre(e.target.value)}
            placeholder="Choisir un mois"
            options={autres.map((x) => ({ valeur: x.mois, libelle: `${titreMois(x.mois)} · ${euros(x.montant)} HT` }))}
            className="h-9 w-auto"
          />
          <Button variant="ghost" size="sm" disabled={!autre} onClick={() => autre && preparer(autre)}>
            Préparer
          </Button>
        </div>
      )}
    </div>
  );
}

/** Une facture mensuelle : brouillon à relire et valider, ou facture validée à partager et imprimer. */
export function FenetreFactureMensuelle({ proprietaire, factureId, onFermer }: { proprietaire: Proprietaire; factureId: string; onFermer: () => void }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const p = d.donnees.proprietaires.find((x) => x.id === proprietaire.id) ?? proprietaire;
  // Facture validée par la base : affichée telle que relue (numéro compris) tant que la copie locale ne l'a pas encore.
  const [validee, setValidee] = useState<Facture>();
  const enStore = d.donnees.factures.find((x) => x.id === factureId);
  const f = enStore?.numero || !validee ? enStore : validee;
  const identite = useMemo(() => identiteConciergerie({ reglages: d.donnees.reglages }, espaceOuvert()), [d.donnees.reglages]);
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const [ajout, setAjout] = useState<{ libelle: string; montant: string; motif: string; erreur?: string }>();
  const [enCours, setEnCours] = useState(false);
  /** Logement dont on saisit le mandat de gestion (taux de commission manquant). */
  const [mandatPour, setMandatPour] = useState<string>();
  const espace = espaceOuvert();
  const figee = factureFigee(f);
  const mois = f?.mensuelle?.mois ?? '';

  const vue = useMemo(() => {
    if (!f || !estFactureMensuelle(f)) return null;
    const calcul = calculerFactureMois(d.donnees, p.id, f.mensuelle.mois);
    const apercu = figee
      ? f
      : (preparerBrouillon({ donnees: d.donnees, proprietaireId: p.id, mois: f.mensuelle.mois, existante: f, identite, aujourdhui: AUJOURDHUI, maintenant: horodatageMaintenant(), par: d.utilisateur.email }) ?? f);
    const doc = documentDeFacture(apercu, { espace, brouillon: { identite, proprietaire: p, logements: calcul.logements } });
    const bilan = d.donnees.bilansProprietaire.find((b) => b.id === `${p.id}-${f.mensuelle.mois}` && b.statut === 'publie');
    return { calcul, apercu, doc, bilanDifferent: !!bilan && !memesMontantsQueLeBilan(bilan.chiffres, apercu) };
  }, [d.donnees, f, figee, identite, p, d.utilisateur.email, espace]);

  if (!f) return null;
  if (!vue?.doc) {
    // Facture d'un autre espace portant l'identité de Label Maison (copie, sauvegarde rechargée) : jamais montrée.
    return (
      <Modal ouvert onFermer={onFermer} titre="Facture" description="Cette facture porte l’identité de Label Maison : elle ne s’affiche pas dans cet espace." />
    );
  }
  const { apercu, doc, calcul } = vue;
  // Numéro prévu seulement : c'est la base qui l'attribue à la validation (un autre appareil peut passer avant).
  const prevu = prochainNumero(d.donnees.factures, compteurFactures(d.donnees), AUJOURDHUI.slice(0, 4)).numero;
  const identiteOk = identiteComplete(identite, espace);
  const adresseOk = !!p.adresse?.trim() && !!p.nom?.trim();

  const valider = async () => {
    setErreur(undefined);
    const commun = { facture: f, donnees: d.donnees, proprietaire: p, identite, espace, aujourdhui: AUJOURDHUI, maintenant: horodatageMaintenant(), par: d.utilisateur.email };
    if (d.mode === 'demo') {
      // Démonstration seulement : numérotée dans le navigateur.
      const r = validerFacture({ ...commun, factures: d.donnees.factures, compteur: compteurFactures(d.donnees) });
      setConfirmer(false);
      if (!r.ok) return setErreur(r.erreur);
      d.upsert('reglages', r.compteur);
      d.upsert('factures', r.facture);
      return;
    }
    setEnCours(true);
    const r = await validerAvecLaBase({
      ...commun,
      enregistrer: async (x) => {
        d.upsert('factures', x);
        return d.enregistrerMaintenant();
      },
      numeroter: numeroterFactureBase,
      relire: (id) => d.relire('factures', id),
    });
    setEnCours(false);
    setConfirmer(false);
    if (!r.ok) return setErreur(r.erreur);
    setValidee(r.facture);
  };

  const ajouter = () => {
    if (!ajout) return;
    const r = ajouterAjustement(
      apercu,
      { libelle: ajout.libelle, montantCentimes: versCentimes(ajout.montant), motif: ajout.motif },
      { id: nouvelId('aj'), maintenant: horodatageMaintenant(), par: d.utilisateur.email },
    );
    if (!r.ok) return setAjout({ ...ajout, erreur: r.erreur });
    d.upsert('factures', r.facture);
    setAjout(undefined);
  };

  const retirer = (id: string) => {
    const r = retirerAjustement(apercu, id);
    if (r.ok) d.upsert('factures', r.facture);
  };

  const ecarter = () => {
    const x = ecarterBrouillon(f);
    if (x) d.upsert('factures', x);
    onFermer();
  };

  const imprimer = () => window.print();
  const ajustements = apercu.mensuelle?.ajustements ?? [];

  const pied = figee ? (
    f.partageeLe || !gerant ? (
      <Button variant="primary" icone={<Printer />} onClick={imprimer}>
        Imprimer ou enregistrer en PDF
      </Button>
    ) : (
      <>
        <Button variant="secondary" icone={<Printer />} onClick={imprimer}>
          Imprimer
        </Button>
        <Button variant="primary" icone={<Share2 />} onClick={() => d.upsert('factures', partagerFacture(f, horodatageMaintenant()))}>
          Partager au propriétaire
        </Button>
      </>
    )
  ) : !gerant ? (
    <Button variant="secondary" onClick={onFermer}>
      Fermer
    </Button>
  ) : confirmer ? (
    <>
      <Button variant="ghost" onClick={() => setConfirmer(false)} disabled={enCours}>
        Annuler
      </Button>
      <Button variant="primary" onClick={() => void valider()} chargement={enCours}>
        Confirmer la validation
      </Button>
    </>
  ) : (
    <>
      <MenuActions actions={[{ libelle: 'Ne pas facturer ce mois', icone: <Trash2 />, onClick: ecarter }]} />
      <Button variant="primary" onClick={() => setConfirmer(true)} disabled={!identiteOk || !adresseOk || doc.totalHt <= 0}>
        Valider la facture
      </Button>
    </>
  );

  /**
   * Début du mandat proposé : l'arrivée du propriétaire dans le logement,
   * sinon son premier séjour connu (aucun séjour passé n'en sort), sinon le
   * mois facturé. Le gérant le corrige dans le formulaire.
   */
  const debutMandat = (logementId: string): string => {
    const l = d.donnees.logements.find((x) => x.id === logementId);
    const premier = d.donnees.reservations
      .filter((r) => r.logementId === logementId && r.statut !== 'annulee')
      .map((r) => r.arrivee)
      .sort()[0];
    return l?.proprietaireDepuis ?? premier ?? `${mois}-01`;
  };

  return (
    <>
      <Modal
        ouvert
        onFermer={onFermer}
        taille="lg"
        titre={<span className="lining-nums">{figee ? `Facture ${f.numero}` : factureDuMois(mois)}</span>}
        description={
          figee
            ? `Validée le ${dateCourte((f.mensuelle?.valideeLe ?? f.dateEmission).slice(0, 10))} : elle ne change plus. ${f.partageeLe ? `Partagée le ${dateCourte(f.partageeLe.slice(0, 10))}.` : 'Pas encore partagée.'}`
            : 'Brouillon : relisez, ajoutez un ajustement si besoin, puis validez.'
        }
        pied={pied}
      >
        <FactureImprimable doc={doc} />
        <div className="space-y-3">
          {!figee && !identiteOk && (
            <Alert
              tone="alerte"
              actions={
                <ButtonLink to="/erp/parametres/societe" size="sm">
                  Compléter
                </ButtonLink>
              }
            >
              Complétez l’identité de votre société (raison sociale, SIRET, adresse) pour valider.
            </Alert>
          )}
          {!figee && !adresseOk && <Alert tone="alerte">Ajoutez l’adresse de {p.nom || 'ce propriétaire'} sur sa fiche : elle figure sur la facture.</Alert>}
          {!figee && calcul.logementsSansTaux.length > 0 && (
            <Alert
              tone="neutre"
              actions={
                gerant && (
                  <Button variant="secondary" size="sm" onClick={() => setMandatPour(calcul.logementsSansTaux[0].logementId)}>
                    Ajouter son mandat
                  </Button>
                )
              }
            >
              Pas de mandat de gestion avec ce propriétaire pour {calcul.sansTaux.join(', ')} : sans taux, pas de commission sur cette facture.
            </Alert>
          )}
          {!figee && vue.bilanDifferent && <Alert tone="neutre">Le bilan publié de ce mois a d’autres montants : mettez-le à jour dans « Bilans mensuels ».</Alert>}
          {confirmer && (
            <Alert tone="or">
              Numéro prévu : <span className="whitespace-nowrap">{prevu}</span>. Il est attribué à la validation ; la facture ne change plus ensuite.
            </Alert>
          )}
          {erreur && (
            <p role="alert" className="text-[12.5px] font-medium text-(--lm-danger)">
              {erreur}
            </p>
          )}

          {!figee && gerant && (
            <section aria-label="Ajustements">
              {ajustements.length > 0 && (
                <ul className="mb-2 divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
                  {ajustements.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-(--lm-encre)">
                          {a.libelle} · <span className="lm-chiffres">{euros(a.montantCentimes)}</span>
                        </p>
                        <p className="truncate text-[12px] text-(--lm-encre-2)">Raison : {a.motif}</p>
                      </div>
                      <IconButton label={`Retirer ${a.libelle}`} size="sm" onClick={() => retirer(a.id)}>
                        <Trash2 />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              {ajout ? (
                <div className="rounded-xl border border-(--lm-bord) p-3">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                    <Field label="Libellé">
                      <Input value={ajout.libelle} onChange={(e) => setAjout({ ...ajout, libelle: e.target.value })} placeholder="Ex. Remplacement d’une ampoule" maxLength={120} />
                    </Field>
                    <Field label="Montant HT (€)" aide="Négatif pour une remise.">
                      <Input inputMode="decimal" value={ajout.montant} onChange={(e) => setAjout({ ...ajout, montant: e.target.value })} placeholder="12,50" />
                    </Field>
                  </div>
                  <Field label="Raison" className="mt-3" aide="Visible sur la facture du propriétaire." erreur={ajout.erreur}>
                    <Input value={ajout.motif} onChange={(e) => setAjout({ ...ajout, motif: e.target.value })} placeholder="Ce qui justifie cette ligne" maxLength={300} />
                  </Field>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAjout(undefined)}>
                      Annuler
                    </Button>
                    <Button variant="secondary" size="sm" onClick={ajouter}>
                      Ajouter la ligne
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" icone={<Plus />} onClick={() => setAjout({ libelle: '', montant: '', motif: '' })}>
                  Ajouter un ajustement
                </Button>
              )}
            </section>
          )}

          <DocumentFacture doc={doc} />
        </div>
      </Modal>
      {/* Mandat de gestion à saisir (taux de commission) : la même fenêtre que sur la fiche du logement. */}
      {mandatPour && (
        <FormMandat
          ouvert
          onFermer={() => setMandatPour(undefined)}
          preselection={{ proprietaireId: p.id, logementId: mandatPour, dejaSigne: true, dateDebut: debutMandat(mandatPour) }}
        />
      )}
    </>
  );
}
