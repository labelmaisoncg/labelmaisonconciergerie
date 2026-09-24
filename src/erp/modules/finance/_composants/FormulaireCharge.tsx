import { useState } from 'react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import type { CategorieCharge, Charge } from '../../../data/types';
import { Button, Field, Input, Modal, Select } from '../../../ui';

interface Props {
  /** Charge à modifier ; absente pour une création. */
  charge?: Charge;
  onFermer: () => void;
}

/** Création ou modification d'une charge. Monté uniquement quand il est ouvert. */
export function FormulaireCharge({ charge, onFermer }: Props) {
  const d = useErp();
  const [date, setDate] = useState(charge?.date ?? AUJOURDHUI);
  const [libelle, setLibelle] = useState(charge?.libelle ?? '');
  const [categorie, setCategorie] = useState<CategorieCharge>(charge?.categorie ?? 'produits');
  const [montant, setMontant] = useState(charge ? String(charge.montantCentimes / 100).replace('.', ',') : '');
  const [logementId, setLogementId] = useState(charge?.logementId ?? '');
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
      id: charge?.id ?? nouvelId('chg'),
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
      titre={charge ? 'Modifier la charge' : 'Nouvelle charge'}
      description="Dépense de Label Maison. Affectez-la à un logement si elle ne concerne que lui : elle entre alors dans sa rentabilité."
      pied={
        <>
          {charge && (
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
          )}
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
          <Select
            value={categorie}
            onChange={(e) => setCategorie(e.target.value as CategorieCharge)}
            options={(Object.keys(LIBELLES.categorieCharge) as CategorieCharge[]).map((c) => ({ valeur: c, libelle: LIBELLES.categorieCharge[c] }))}
          />
        </Field>
        <Field label="Logement concerné" aide="Laisser vide pour une charge générale.">
          <Select
            value={logementId}
            onChange={(e) => setLogementId(e.target.value)}
            placeholder="Charge générale"
            options={d.logements.map((l) => ({ valeur: l.id, libelle: l.nom }))}
          />
        </Field>
      </div>
    </Modal>
  );
}
