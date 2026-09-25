import { useState } from 'react';
import { AUJOURDHUI, dateCourte, versCentimes } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { useErp } from '../../../data/store';
import type { CategorieIncident, GraviteIncident, Incident, Refacturable } from '../../../data/types';
import { Button, EnvoiFichier, Field, Input, Modal, Select, Textarea, Prerequis } from '../../../ui';

const options = <K extends string>(libelles: Record<K, string>) =>
  (Object.keys(libelles) as K[]).map((k) => ({ valeur: k, libelle: libelles[k] }));

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (i: Incident) => void;
}

const VIDE = { logementId: '', reservationId: '', date: AUJOURDHUI, categorie: 'menage' as CategorieIncident, gravite: 'moyenne' as GraviteIncident, description: '', responsable: '', preuves: '', refacturable: 'aucun' as Refacturable, cout: '' };

/** Déclaration d'un incident, avec preuves et imputation du coût. */
export function NouvelIncident({ ouvert, onFermer, onCree }: Props) {
  const { logements, reservations, utilisateurs, creerIncident } = useErp();
  const [f, setF] = useState(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof typeof VIDE, string>>>({});
  const maj = <K extends keyof typeof VIDE>(k: K, v: (typeof VIDE)[K]) => setF((x) => ({ ...x, [k]: v }));

  const sejours = reservations
    .filter((r) => r.logementId === f.logementId && r.statut !== 'annulee' && r.arrivee <= f.date)
    .sort((a, b) => b.arrivee.localeCompare(a.arrivee))
    .slice(0, 6);

  const fermer = () => {
    setF(VIDE);
    setErreurs({});
    onFermer();
  };

  const enregistrer = () => {
    const e: typeof erreurs = {};
    const preuves = f.preuves.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (!f.logementId) e.logementId = 'Choisissez le logement.';
    if (f.description.trim().length < 10) e.description = 'Décrivez l’incident (10 caractères minimum).';
    if (preuves.some((u) => !/^(https?:\/\/|demo:\/\/|stockage:\/\/)/.test(u))) e.preuves = 'Chaque preuve doit être une adresse commençant par https://';
    const cout = f.cout.trim() ? versCentimes(f.cout) : undefined;
    if (cout !== undefined && (Number.isNaN(cout) || cout < 0)) e.cout = 'Montant invalide.';
    setErreurs(e);
    if (Object.keys(e).length) return;
    const i = creerIncident({
      logementId: f.logementId,
      reservationId: f.reservationId || undefined,
      date: f.date,
      categorie: f.categorie,
      gravite: f.gravite,
      description: f.description.trim(),
      responsable: f.responsable || undefined,
      preuves,
      refacturable: f.refacturable,
      coutCentimes: cout,
    });
    onCree(i);
    fermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      taille="lg"
      titre="Déclarer un incident"
      description="Tout problème constaté est tracé ici, avec ses preuves. Sans preuve, pas de refacturation possible."
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>Annuler</Button>
          <Button variant="primary" onClick={enregistrer}>Créer l’incident</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!logements.length && (
          <Prerequis className="sm:col-span-2" manque="Aucun logement enregistré." detail="Un incident se rattache toujours à un logement." lien="/erp/logements?nouveau=1" action="Nouveau logement" />
        )}
        <Field label="Logement" requis erreur={erreurs.logementId}>
          <Select value={f.logementId} placeholder="Choisir" onChange={(e) => setF((x) => ({ ...x, logementId: e.target.value, reservationId: '' }))} options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
        </Field>
        <Field label="Date du constat" requis>
          <Input type="date" value={f.date} max={AUJOURDHUI} onChange={(e) => maj('date', e.target.value)} />
        </Field>
        <Field label="Séjour concerné" aide="Facultatif, utile pour refacturer un voyageur.">
          <Select
            value={f.reservationId}
            disabled={!f.logementId}
            placeholder="Aucun"
            onChange={(e) => maj('reservationId', e.target.value)}
            options={sejours.map((r) => ({ valeur: r.id, libelle: `${r.voyageur.nom}, ${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}` }))}
          />
        </Field>
        <Field label="Responsable du suivi">
          <Select value={f.responsable} placeholder="Non attribué" onChange={(e) => maj('responsable', e.target.value)} options={utilisateurs.filter((u) => u.role !== 'prestataire').map((u) => ({ valeur: u.nom, libelle: u.nom }))} />
        </Field>
        <Field label="Catégorie" requis>
          <Select value={f.categorie} onChange={(e) => maj('categorie', e.target.value as CategorieIncident)} options={options(LIBELLES.categorieIncident)} />
        </Field>
        <Field label="Gravité" requis>
          <Select value={f.gravite} onChange={(e) => maj('gravite', e.target.value as GraviteIncident)} options={options(LIBELLES.gravite)} />
        </Field>
        <Field label="Description" requis erreur={erreurs.description} className="sm:col-span-2">
          <Textarea rows={3} value={f.description} onChange={(e) => maj('description', e.target.value)} placeholder="Ce qui a été constaté, par qui, et l’impact pour le voyageur." />
        </Field>
        <div className="grid gap-2 sm:col-span-2">
          <Field label="Preuves (photos, documents)" aide="Joignez des fichiers, ou collez une adresse par ligne." erreur={erreurs.preuves}>
            <Textarea rows={2} value={f.preuves} onChange={(e) => maj('preuves', e.target.value)} placeholder="https://..." />
          </Field>
          <EnvoiFichier
            dossier={`incidents/${f.logementId || 'sans-logement'}`}
            accept="image/*,application/pdf"
            multiple
            libelle="Joindre des photos ou documents"
            onEnvoye={(urls) => setF((x) => ({ ...x, preuves: [x.preuves.trim(), ...urls].filter(Boolean).join('\n') }))}
          />
        </div>
        <Field label="Refacturable à">
          <Select value={f.refacturable} onChange={(e) => maj('refacturable', e.target.value as Refacturable)} options={options(LIBELLES.refacturable)} />
        </Field>
        <Field label="Coût estimé (€)" erreur={erreurs.cout}>
          <Input inputMode="decimal" value={f.cout} onChange={(e) => maj('cout', e.target.value)} placeholder="0,00" />
        </Field>
      </div>
    </Modal>
  );
}
