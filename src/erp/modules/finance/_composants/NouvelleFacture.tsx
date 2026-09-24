import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, ajouterJours, euros, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import type { DestinataireFacture, Facture, TypeFacture } from '../../../data/types';
import { Alert, Button, Field, IconButton, Input, Modal, Select } from '../../../ui';
import { prochainNumero } from '../_calculs';

interface LigneSaisie {
  libelle: string;
  quantite: string;
  pu: string;
}

const LIGNE_VIDE: LigneSaisie = { libelle: '', quantite: '1', pu: '' };

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (id: string) => void;
}

const options = <K extends string>(r: Record<K, string>) => (Object.keys(r) as K[]).map((k) => ({ valeur: k, libelle: r[k] }));

export function NouvelleFacture({ ouvert, onFermer, onCree }: Props) {
  const d = useErp();
  const [type, setType] = useState<TypeFacture>('commission');
  const [destinataire, setDestinataire] = useState<DestinataireFacture>('proprietaire');
  const [proprietaireId, setProprietaireId] = useState('');
  const [emission, setEmission] = useState(AUJOURDHUI);
  const [echeance, setEcheance] = useState(ajouterJours(AUJOURDHUI, 15));
  const [tva, setTva] = useState('20');
  const [lignes, setLignes] = useState<LigneSaisie[]>([{ ...LIGNE_VIDE }]);
  const [erreurs, setErreurs] = useState<string[]>([]);

  const numero = prochainNumero(d.factures);
  const lues = lignes.map((l) => ({ libelle: l.libelle.trim(), quantite: Number(l.quantite.replace(',', '.')), puCentimes: versCentimes(l.pu) }));
  const totalHt = lues.reduce((s, l) => s + (Number.isFinite(l.quantite) && Number.isFinite(l.puCentimes) ? Math.round(l.quantite * l.puCentimes) : 0), 0);
  const tvaPct = Number(tva.replace(',', '.'));

  const majLigne = (i: number, patch: Partial<LigneSaisie>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const reinitialiser = () => {
    setLignes([{ ...LIGNE_VIDE }]);
    setErreurs([]);
    setProprietaireId('');
  };

  const enregistrer = (statut: Facture['statut']) => {
    const e: string[] = [];
    if (destinataire === 'proprietaire' && !proprietaireId) e.push('Choisissez le propriétaire destinataire.');
    if (echeance < emission) e.push('L’échéance doit suivre la date d’émission.');
    if (!Number.isFinite(tvaPct) || tvaPct < 0 || tvaPct > 30) e.push('Taux de TVA invalide.');
    if (!lues.length) e.push('Ajoutez au moins une ligne.');
    lues.forEach((l, i) => {
      if (!l.libelle) e.push(`Ligne ${i + 1} : désignation manquante.`);
      if (!Number.isFinite(l.quantite) || l.quantite <= 0) e.push(`Ligne ${i + 1} : quantité invalide.`);
      if (!Number.isFinite(l.puCentimes) || (type !== 'avoir' && l.puCentimes <= 0)) e.push(`Ligne ${i + 1} : prix unitaire invalide.`);
    });
    setErreurs(e);
    if (e.length) return;
    const facture: Facture = {
      id: nouvelId('fac'),
      numero,
      type,
      destinataire,
      proprietaireId: destinataire === 'proprietaire' ? proprietaireId : undefined,
      dateEmission: emission,
      echeance,
      montantHtCentimes: totalHt,
      tvaPct,
      statut,
      lignes: lues,
    };
    d.upsert('factures', facture);
    reinitialiser();
    onFermer();
    onCree(facture.id);
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      taille="lg"
      titre="Nouvelle facture"
      description={`Numéro attribué automatiquement : ${numero}. Émise par Label Maison Conciergerie SASU.`}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button onClick={() => enregistrer('brouillon')}>Enregistrer en brouillon</Button>
          <Button variant="primary" onClick={() => enregistrer('emise')}>
            Émettre
          </Button>
        </>
      }
    >
      {erreurs.length > 0 && (
        <Alert tone="danger" className="mb-4" titre="La facture ne peut pas être enregistrée">
          <ul className="list-disc pl-4">
            {erreurs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as TypeFacture)} options={options(LIBELLES.typeFacture)} />
        </Field>
        <Field label="Destinataire">
          <Select value={destinataire} onChange={(e) => setDestinataire(e.target.value as DestinataireFacture)} options={options(LIBELLES.destinataire)} />
        </Field>
        {destinataire === 'proprietaire' && (
          <Field label="Propriétaire" requis className="sm:col-span-2">
            <Select
              value={proprietaireId}
              onChange={(e) => setProprietaireId(e.target.value)}
              placeholder="Choisir un propriétaire"
              options={d.proprietaires.map((p) => ({ valeur: p.id, libelle: p.nom }))}
            />
          </Field>
        )}
        <Field label="Date d’émission">
          <Input type="date" value={emission} onChange={(e) => setEmission(e.target.value)} />
        </Field>
        <Field label="Échéance">
          <Input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
        </Field>
        <Field label="TVA (%)" aide="Taux à valider avec l’expert-comptable.">
          <Input inputMode="decimal" value={tva} onChange={(e) => setTva(e.target.value)} />
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[13px] font-medium">Lignes</legend>
        <div className="space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-(--lm-bord) p-2 sm:grid-cols-[minmax(0,1fr)_72px_110px_auto] sm:border-0 sm:p-0">
              <Input aria-label={`Désignation ligne ${i + 1}`} placeholder="Désignation" value={l.libelle} onChange={(e) => majLigne(i, { libelle: e.target.value })} className="col-span-2 sm:col-span-1" />
              <Input aria-label={`Quantité ligne ${i + 1}`} inputMode="decimal" value={l.quantite} onChange={(e) => majLigne(i, { quantite: e.target.value })} />
              <Input aria-label={`Prix unitaire HT ligne ${i + 1}, en euros`} inputMode="decimal" placeholder="PU HT €" value={l.pu} onChange={(e) => majLigne(i, { pu: e.target.value })} />
              <IconButton label={`Supprimer la ligne ${i + 1}`} disabled={lignes.length === 1} onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 />
              </IconButton>
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="mt-2" icone={<Plus />} onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}>
          Ajouter une ligne
        </Button>
      </fieldset>

      <dl className="lm-chiffres mt-4 ml-auto max-w-xs space-y-1 text-[13.5px]">
        <div className="flex justify-between"><dt className="text-(--lm-encre-2)">Total HT</dt><dd>{euros(totalHt)}</dd></div>
        <div className="flex justify-between"><dt className="text-(--lm-encre-2)">TVA</dt><dd>{euros(Math.round((totalHt * (Number.isFinite(tvaPct) ? tvaPct : 0)) / 100))}</dd></div>
        <div className="flex justify-between border-t border-(--lm-bord-fort) pt-1 font-semibold"><dt>Total TTC</dt><dd>{euros(Math.round(totalHt * (1 + (Number.isFinite(tvaPct) ? tvaPct : 0) / 100)))}</dd></div>
      </dl>
    </Modal>
  );
}
