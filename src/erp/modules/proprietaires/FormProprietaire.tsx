import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { AUJOURDHUI } from '../../data/format';
import type { Proprietaire, TypeProprietaire } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  proprietaire?: Proprietaire;
  onCree?: (id: string) => void;
}

type Saisie = { type: TypeProprietaire; nom: string; email: string; telephone: string; adresse: string; iban: string; notes: string };

const TYPES = Object.entries(LIBELLES.typeProprietaire).map(([valeur, libelle]) => ({ valeur, libelle }));

/** Masque un IBAN saisi : « FR76 •••• •••• •••• 4821 ». Laisse intact un IBAN déjà masqué. */
function masquerIban(saisie: string): string {
  const brut = saisie.replace(/\s/g, '').toUpperCase();
  if (!brut || saisie.includes('•')) return saisie.trim();
  return `${brut.slice(0, 4)} •••• •••• •••• ${brut.slice(-4)}`;
}

export function FormProprietaire({ ouvert, onFermer, proprietaire: p, onCree }: Props) {
  const { upsert } = useErp();
  const vierge = (): Saisie => ({
    type: p?.type ?? 'particulier',
    nom: p?.nom ?? '',
    email: p?.contact.email ?? '',
    telephone: p?.contact.telephone ?? '',
    adresse: p?.adresse ?? '',
    iban: p?.ibanMasque ?? '',
    notes: p?.notes ?? '',
  });
  const [s, setS] = useState<Saisie>(vierge);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Saisie, string>>>({});

  useEffect(() => {
    if (ouvert) {
      setS(vierge());
      setErreurs({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, p?.id]);

  const maj = (k: keyof Saisie, v: string) => setS((x) => ({ ...x, [k]: v }));

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    const err: Partial<Record<keyof Saisie, string>> = {};
    if (s.nom.trim().length < 2) err.nom = 'Le nom est obligatoire.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) err.email = 'Adresse e-mail invalide.';
    if (s.telephone.replace(/\D/g, '').length < 10) err.telephone = 'Numéro à 10 chiffres minimum.';
    if (!s.adresse.trim()) err.adresse = 'L’adresse est obligatoire.';
    const iban = s.iban.replace(/\s/g, '');
    if (iban && !s.iban.includes('•') && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(iban)) err.iban = 'IBAN invalide.';
    setErreurs(err);
    if (Object.keys(err).length) return;
    const suivant: Proprietaire = {
      id: p?.id ?? nouvelId('pro'),
      creeLe: p?.creeLe ?? AUJOURDHUI,
      type: s.type,
      nom: s.nom.trim(),
      contact: { email: s.email.trim(), telephone: s.telephone.trim() },
      adresse: s.adresse.trim(),
      ibanMasque: masquerIban(s.iban),
      notes: s.notes.trim(),
    };
    upsert('proprietaires', suivant);
    onFermer();
    if (!p) onCree?.(suivant.id);
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={p ? `Modifier ${p.nom}` : 'Nouveau propriétaire'}
      pied={
        <>
          <Button onClick={onFermer}>Annuler</Button>
          <Button variant="primary" type="submit" form="form-proprietaire">
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="form-proprietaire" onSubmit={enregistrer} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          <Select value={s.type} onChange={(e) => maj('type', e.target.value)} options={TYPES} />
        </Field>
        <Field label={s.type === 'particulier' ? 'Nom complet' : 'Raison sociale'} requis erreur={erreurs.nom}>
          <Input value={s.nom} onChange={(e) => maj('nom', e.target.value)} />
        </Field>
        <Field label="E-mail" requis erreur={erreurs.email}>
          <Input type="email" value={s.email} onChange={(e) => maj('email', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Téléphone" requis erreur={erreurs.telephone}>
          <Input type="tel" value={s.telephone} onChange={(e) => maj('telephone', e.target.value)} />
        </Field>
        <Field label="Adresse postale" requis erreur={erreurs.adresse} className="sm:col-span-2">
          <Input value={s.adresse} onChange={(e) => maj('adresse', e.target.value)} />
        </Field>
        <Field label="IBAN" erreur={erreurs.iban} aide="Seuls les 4 premiers et 4 derniers caractères sont conservés." className="sm:col-span-2">
          <Input value={s.iban} onChange={(e) => maj('iban', e.target.value)} placeholder="FR76 ..." autoComplete="off" />
        </Field>
        <Field label="Notes internes" className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => maj('notes', e.target.value)} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}
