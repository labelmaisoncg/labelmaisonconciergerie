import { Lock } from 'lucide-react';
import { useErp } from '../../../../data/store';
import { CHECKLIST_LANCEMENT } from '../../../../data/constantes';
import { dateCourte, versCentimes, euros } from '../../../../data/format';
import { Alert, Checklist, Field, Input } from '../../../../ui';
import { ajouterMois, prochaineReference, sousCible } from './etat';
import type { PropsEtape } from './EtapesReferentiel';

export function EtapeMandat({ b, maj, erreurs }: PropsEtape) {
  const { mandats } = useErp();
  const finOk = b.dateDebut && /^\d+$/.test(b.dureeMois);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Référence" aide="Attribuée automatiquement.">
        <Input value={prochaineReference(mandats)} readOnly disabled className="lm-chiffres" />
      </Field>
      <Field label="Commission Label Maison (%)" requis erreur={erreurs.commissionPct} aide="Cible 18 à 20 % (par défaut 18 %).">
        <Input inputMode="decimal" value={b.commissionPct} onChange={(e) => maj('commissionPct', e.target.value)} className="lm-chiffres" />
      </Field>
      {sousCible(b) && !erreurs.commissionPct && (
        <Alert tone="alerte" className="sm:col-span-2" titre="Commission sous la cible">
          Les nouveaux mandats se signent entre 18 et 20 %. Un taux inférieur doit rester exceptionnel et être validé par Abdel et Kamel.
        </Alert>
      )}
      <Field label="Frais de ménage par séjour (€)" requis erreur={erreurs.fraisMenage} aide="Facturés au voyageur, reversés à Label Maison.">
        <Input inputMode="decimal" value={b.fraisMenage} onChange={(e) => maj('fraisMenage', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Date de début" requis erreur={erreurs.dateDebut}>
        <Input type="date" value={b.dateDebut} onChange={(e) => maj('dateDebut', e.target.value)} />
      </Field>
      <Field label="Durée (mois)" requis erreur={erreurs.dureeMois} aide={finOk ? `Fin le ${dateCourte(ajouterMois(b.dateDebut, Number(b.dureeMois)))}, reconductible.` : undefined}>
        <Input inputMode="numeric" value={b.dureeMois} onChange={(e) => maj('dureeMois', e.target.value)} className="lm-chiffres" />
      </Field>
      <Field label="Préavis de résiliation (jours)" requis erreur={erreurs.preavisJours}>
        <Input inputMode="numeric" value={b.preavisJours} onChange={(e) => maj('preavisJours', e.target.value)} className="lm-chiffres" />
      </Field>
      <label className="flex items-start gap-2 text-[13.5px] text-(--lm-encre) sm:col-span-2">
        <input type="checkbox" checked={b.essai} onChange={(e) => maj('essai', e.target.checked)} className="mt-0.5 size-4 accent-(--lm-or)" />
        <span>
          Période d’essai d’un mois
          {b.essai && b.dateDebut && <span className="text-(--lm-encre-2)"> (jusqu’au {dateCourte(ajouterMois(b.dateDebut, 1))})</span>}
        </span>
      </label>
      <Alert tone="info" className="sm:col-span-2" titre="Clause de concertation">
        Le propriétaire ne modifie pas l’annonce sans concertation. Le mandat sera créé au statut « Envoyé » : il reste à le faire signer.
      </Alert>
    </div>
  );
}

export function EtapeChecklist({ b, maj, erreurs }: PropsEtape) {
  const frais = versCentimes(b.fraisMenage);
  return (
    <div className="space-y-4">
      <Alert tone="or" icone={<Lock />} titre="Checklist de lancement bloquante">
        Le logement sera créé au statut « En lancement ». Il ne pourra passer « Actif » (et être publié) que lorsque le mandat
        est signé ET que les {CHECKLIST_LANCEMENT.length} points ci-dessous sont faits, preuves à l’appui. Aucune exception : c’est la
        leçon de 2026.
      </Alert>
      <Checklist label="À compléter depuis la fiche logement" elements={CHECKLIST_LANCEMENT.map((c) => ({ libelle: c.libelle, fait: false }))} />
      <div className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 text-[13px] text-(--lm-encre-2)">
        <p className="mb-1 font-semibold text-(--lm-encre)">Récapitulatif</p>
        <p>
          {b.modeProprio === 'nouveau' ? b.propNom || 'Nouveau propriétaire' : 'Propriétaire existant'} · {b.logNom} ({b.ville}) · commission{' '}
          <span className="lm-chiffres">{b.commissionPct} %</span>, ménage <span className="lm-chiffres">{Number.isFinite(frais) ? euros(frais) : '-'}</span>, début le{' '}
          {b.dateDebut ? dateCourte(b.dateDebut) : '-'}.
        </p>
      </div>
      <div>
        <label className="flex items-start gap-2 text-[13.5px] font-medium text-(--lm-encre)">
          <input type="checkbox" checked={b.checklistComprise} onChange={(e) => maj('checklistComprise', e.target.checked)} className="mt-0.5 size-4 accent-(--lm-or)" aria-invalid={!!erreurs.checklistComprise} />
          J’ai compris : pas d’activation tant que le mandat n’est pas signé et la checklist complète.
        </label>
        {erreurs.checklistComprise && <p role="alert" className="mt-1 text-[12px] font-medium text-(--lm-danger)">{erreurs.checklistComprise}</p>}
      </div>
    </div>
  );
}
