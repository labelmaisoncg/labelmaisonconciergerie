/**
 * Relances de paiement, côté gérant : réglages de l'espace (actif, mode,
 * étapes), relances à valider (envoyer ou annuler, aperçu du message) et
 * relances envoyées.
 *
 * Monté dans Paramètres → Accès, section Propriétaires (réglages et file à
 * valider de tout l'espace), et dans le panneau « Espace propriétaire » avec
 * `proprietaireId` (ses relances seulement).
 *
 * Les relances sont écrites par le serveur seul (api/espace-proprietaire.ts,
 * passage quotidien) : ce composant les lit et décide par l'API. En démo, le
 * même calcul tourne dans le navigateur et rien n'est envoyé.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Send, X } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import { espaceOuvert } from '../../../data/espaces';
import { AUJOURDHUI, dateCourte, euros } from '../../../data/format';
import { useErp } from '../../../data/store';
import { REGLAGES_RELANCES_DEFAUT, messageRelance, montantTtcFacture, planifierRelances, reglagesRelances } from '../../../data/relances';
import type { RelancePaiement, ReglagesRelances } from '../../../data/types-proprietaire';
import { Alert, Badge, Button, Field, Input, Interrupteur, Repli } from '../../../ui';
import { appelerServeur } from '../../messagerie/_composants/serveur';

const API = '/api/espace-proprietaire';

interface EtatRelances {
  relances: RelancePaiement[];
  reglages: ReglagesRelances;
  /** L'espace peut envoyer des e-mails (expéditeur et clé). */
  expediteur: boolean;
}

const etape = (n: number) => (n === 1 ? '1er rappel' : `${n}e rappel`);

const MOTIF: Record<NonNullable<RelancePaiement['motif']>, string> = {
  sans_expediteur: 'Pas d’expéditeur d’e-mails pour cet espace : relancez par téléphone ou par votre messagerie, puis annulez.',
  sans_adresse: 'Pas d’adresse e-mail pour ce propriétaire.',
  echec_envoi: 'Le dernier envoi a échoué.',
  remplacee: 'Remplacée par le rappel suivant.',
};

/** Données et décisions : l'API en production, un calcul local en démo. */
export function useRelances() {
  const d = useErp();
  const [etat, setEtat] = useState<EtatRelances | null>(null);
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState<string>();

  const charger = useCallback(async () => {
    if (MODE_DEMO) {
      const reglages = REGLAGES_RELANCES_DEFAUT;
      const plan = planifierRelances({ factures: d.donnees.factures, relances: [], reglages, aujourdhui: AUJOURDHUI, maintenant: new Date().toISOString() });
      setEtat((e) => e ?? { relances: plan.nouvelles, reglages, expediteur: false });
      return;
    }
    try {
      setEtat(await appelerServeur<EtatRelances>(`${API}?action=relances`, 'GET'));
      setErreur(undefined);
    } catch (e) {
      setErreur((e as Error).message);
    }
  }, [d.donnees.factures]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const decider = async (action: 'relance-envoyer' | 'relance-annuler', id: string) => {
    setErreur(undefined);
    if (MODE_DEMO) {
      const maintenant = new Date().toISOString();
      setEtat((e) =>
        e && {
          ...e,
          relances: e.relances.map((r) =>
            r.id !== id ? r : action === 'relance-annuler' ? { ...r, statut: 'annulee', annuleeLe: maintenant } : { ...r, motif: 'sans_expediteur' },
          ),
        },
      );
      if (action === 'relance-envoyer') setErreur('Démonstration : aucun e-mail n’est envoyé.');
      return;
    }
    setEnCours(id);
    try {
      await appelerServeur(API, 'POST', { action, id });
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
      await charger();
    }
  };

  const regler = async (r: ReglagesRelances) => {
    const propre = reglagesRelances(r);
    if (MODE_DEMO) return setEtat((e) => e && { ...e, reglages: propre });
    try {
      const { reglages } = await appelerServeur<{ reglages: ReglagesRelances }>(API, 'POST', { action: 'relances-reglages', reglages: propre });
      setEtat((e) => e && { ...e, reglages });
    } catch (e) {
      setErreur((e as Error).message);
    }
  };

  return { etat, erreur, enCours, decider, regler };
}

function Reglages({ reglages, onChange }: { reglages: ReglagesRelances; onChange: (r: ReglagesRelances) => void }) {
  const [jours, setJours] = useState(reglages.jours.join(', '));
  useEffect(() => setJours(reglages.jours.join(', ')), [reglages.jours]);
  const radio = 'flex min-h-9 items-start gap-2.5 text-[13.5px] text-(--lm-encre)';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-medium text-(--lm-encre)">Relances des factures en retard</span>
        <Interrupteur actif={reglages.actif} label="Relances des factures en retard" onChange={(actif) => onChange({ ...reglages, actif })} />
      </div>
      <Repli
        titre="Avancé"
        description={`${reglages.mode === 'proposer' ? 'Je valide chaque relance' : 'Envoi automatique par e-mail'} · ${reglages.jours.join(', ')} jours après l’échéance`}
      >
        <div className="space-y-3">
          <fieldset className="space-y-1" disabled={!reglages.actif}>
            <legend className="mb-1 text-[13px] font-medium text-(--lm-encre)">Envoi</legend>
            <label className={radio}>
              <input type="radio" name="mode-relances" className="mt-1 accent-(--lm-or-texte)" checked={reglages.mode === 'proposer'} onChange={() => onChange({ ...reglages, mode: 'proposer' })} />
              <span>Je valide chaque relance</span>
            </label>
            <label className={radio}>
              <input type="radio" name="mode-relances" className="mt-1 accent-(--lm-or-texte)" checked={reglages.mode === 'automatique'} onChange={() => onChange({ ...reglages, mode: 'automatique' })} />
              <span>Envoi automatique par e-mail</span>
            </label>
          </fieldset>
          <Field label="Jours après l’échéance" aide="Une relance par étape, par exemple 5, 15, 30.">
            <Input
              inputMode="numeric"
              value={jours}
              disabled={!reglages.actif}
              onChange={(e) => setJours(e.target.value)}
              onBlur={() => onChange({ ...reglages, jours: jours.split(/[^\d]+/).filter(Boolean).map(Number) })}
            />
          </Field>
        </div>
      </Repli>
    </div>
  );
}

export function RelancesPaiement({ proprietaireId }: { proprietaireId?: string }) {
  const d = useErp();
  const { etat, erreur, enCours, decider, regler } = useRelances();
  const conciergerie = espaceOuvert().nom;
  const siennes = useMemo(() => (etat?.relances ?? []).filter((r) => !proprietaireId || r.proprietaireId === proprietaireId), [etat, proprietaireId]);
  const aValider = siennes.filter((r) => r.statut === 'proposee').sort((a, b) => a.dueLe.localeCompare(b.dueLe));
  const envoyees = siennes
    .filter((r) => r.statut === 'envoyee')
    .sort((a, b) => String(b.envoyeeLe).localeCompare(String(a.envoyeeLe)))
    .slice(0, 10);
  const nom = (id: string) => d.donnees.proprietaires.find((p) => p.id === id)?.nom ?? 'Propriétaire';
  const facture = (id: string) => d.donnees.factures.find((f) => f.id === id);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-(--lm-encre)">Relances de paiement</h3>
        <p className="text-[13px] text-(--lm-encre-2)">Pour les factures partagées et à payer, après l’échéance. Tout s’arrête dès qu’une facture est payée.</p>
      </div>
      {erreur && <Alert tone="danger">{erreur}</Alert>}
      {!etat ? (
        <p className="text-[13.5px] text-(--lm-encre-2)">Chargement…</p>
      ) : (
        <>
          {!proprietaireId && <Reglages reglages={etat.reglages} onChange={(r) => void regler(r)} />}
          {etat.reglages.mode === 'automatique' && !etat.expediteur && (
            <Alert tone="alerte">Pas d’expéditeur d’e-mails pour cet espace : les relances attendent votre validation.</Alert>
          )}

          <div>
            <p className="mb-2 text-[13.5px] font-medium text-(--lm-encre)">À valider</p>
            {!aValider.length ? (
              <p className="text-[13.5px] text-(--lm-encre-2)">Aucune relance à valider.</p>
            ) : (
              <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
                {aValider.map((r) => {
                  const f = facture(r.factureId);
                  const m = f ? messageRelance({ relance: r, dernier: r.niveau >= etat.reglages.jours.length, facture: f, proprietaire: { nom: nom(r.proprietaireId) }, conciergerie, lienEspace: `${window.location.origin}/espace-proprietaire` }) : null;
                  return (
                    <li key={r.id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="min-w-48 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-(--lm-encre)">
                            {r.numero}
                            <Badge tone="neutre">{etape(r.niveau)}</Badge>
                          </p>
                          <p className="text-[12.5px] text-(--lm-encre-2)">
                            {nom(r.proprietaireId)}
                            {f ? ` · ${euros(montantTtcFacture(f))}` : ''} · dû le {dateCourte(r.dueLe)}
                          </p>
                          {r.motif && <p className="text-[12.5px] text-(--lm-encre-2)">{MOTIF[r.motif]}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button size="sm" variant="secondary" icone={<Send />} chargement={enCours === r.id} disabled={!!enCours} onClick={() => void decider('relance-envoyer', r.id)}>
                            Envoyer
                          </Button>
                          <Button size="sm" variant="ghost" icone={<X />} disabled={!!enCours} onClick={() => void decider('relance-annuler', r.id)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                      {m && (
                        <details className="group mt-1">
                          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
                            Voir le message
                            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
                          </summary>
                          <div className="mt-1 rounded-lg bg-(--lm-surface-2) p-3">
                            <p className="text-[13px] font-medium text-(--lm-encre)">{m.sujet}</p>
                            <p className="mt-1 text-[13px] whitespace-pre-line text-(--lm-encre-2)">{m.texte}</p>
                          </div>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {envoyees.length > 0 && (
            <div>
              <p className="mb-2 text-[13.5px] font-medium text-(--lm-encre)">Envoyées</p>
              <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
                {envoyees.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate text-(--lm-encre)">
                      {r.numero} · {etape(r.niveau)} · {nom(r.proprietaireId)}
                    </span>
                    <span className="shrink-0 text-(--lm-encre-2)">
                      {r.envoyeeLe ? dateCourte(r.envoyeeLe.slice(0, 10)) : ''}
                      {r.envoyeePar === 'automatique' ? ' · automatique' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
