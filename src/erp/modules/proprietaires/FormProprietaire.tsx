import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '../../ui';
import { nouvelId, useErp } from '../../data/store';
import { LIBELLES } from '../../data/libelles';
import { AUJOURDHUI } from '../../data/format';
import { erreursProprietaire, proprietaireDepuisSaisie, saisieProprietaireInitiale, type ErreursProprietaire, type SaisieProprietaire } from '../../data/creation-logement';
import type { Proprietaire } from '../../data/types';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  proprietaire?: Proprietaire;
  onCree?: (id: string) => void;
}

/** Saisie, contrôles et fiche : data/creation-logement.ts (comme l'assistant de création d'un logement). */
type Saisie = SaisieProprietaire;

const TYPES = Object.entries(LIBELLES.typeProprietaire).map(([valeur, libelle]) => ({ valeur, libelle }));

export function FormProprietaire({ ouvert, onFermer, proprietaire: p, onCree }: Props) {
  const { upsert } = useErp();
  const vierge = (): Saisie => saisieProprietaireInitiale(p);
  const [s, setS] = useState<Saisie>(vierge);
  const [erreurs, setErreurs] = useState<ErreursProprietaire>({});

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
    const err = erreursProprietaire(s);
    setErreurs(err);
    if (Object.keys(err).length) return;
    const suivant = proprietaireDepuisSaisie(s, p ?? nouvelId('pro'), AUJOURDHUI);
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
        <Field label="Notes internes" className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => maj('notes', e.target.value)} rows={3} />
        </Field>
      </form>
    </Modal>
  );
}
