/**
 * Relances de paiement, côté gérant : réglages de l'espace (actif, mode,
 * étapes), relances à valider (envoyer, ou « Ne pas envoyer » après une
 * relance par téléphone ; aperçu du message) et historique (envoyées,
 * non envoyées, sans objet). Une facture marquée payée sort aussitôt de la file
 * (« Sans objet ») ; le passage quotidien l'enregistre.
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
import { REGLAGES_RELANCES_DEFAUT, factureAPayer, messageRelance, montantTtcFacture, nomRappel, planifierRelances, reglagesRelances } from '../../../data/relances';
import type { Facture } from '../../../data/types';
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

const MOTIF: Record<NonNullable<RelancePaiement['motif']>, string> = {
  sans_expediteur: 'Pas d’expéditeur d’e-mails pour cet espace : relancez par téléphone ou par votre messagerie, puis « Ne pas envoyer ».',
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
  const facture = (id: string): Facture | undefined => d.donnees.factures.find((f) => f.id === id);
  // Facture payée (ou plus à payer) dans l'ERP : sans objet tout de suite, sans attendre le passage quotidien.
  const siennes = useMemo(
    () =>
      (etat?.relances ?? [])
        .filter((r) => !proprietaireId || r.proprietaireId === proprietaireId)
        .map((r): RelancePaiement => {
          const f = d.donnees.factures.find((x) => x.id === r.factureId);
          return r.statut === 'proposee' && f && !factureAPayer(f) ? { ...r, statut: 'sans_objet' } : r;
        }),
    [etat, proprietaireId, d.donnees.factures],
  );
  const aValider = siennes.filter((r) => r.statut === 'proposee').sort((a, b) => a.dueLe.localeCompare(b.dueLe));
  // Historique : envoyées, « Ne pas envoyer », sans objet (pas les remplacements automatiques par l'étape suivante).
  const quand = (r: RelancePaiement) => String(r.envoyeeLe ?? r.annuleeLe ?? r.creeLe ?? '');
  const historique = siennes
    .filter((r) => r.statut === 'envoyee' || r.statut === 'sans_objet' || (r.statut === 'annulee' && r.motif !== 'remplacee'))
    .sort((a, b) => quand(b).localeCompare(quand(a)))
    .slice(0, 12);
  const nom = (id: string) => d.donnees.proprietaires.find((p) => p.id === id)?.nom ?? 'Propriétaire';
  const dernier = (r: RelancePaiement) => r.niveau >= (etat?.reglages.jours.length ?? 3);

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
            <p className="text-[13.5px] font-medium text-(--lm-encre)">À valider</p>
            <p className="mb-2 text-[12.5px] text-(--lm-encre-2)">Relancé par téléphone ? « Ne pas envoyer » la retire de la liste ; elle reste dans l’historique.</p>
            {!aValider.length ? (
              <p className="text-[13.5px] text-(--lm-encre-2)">Aucune relance à valider.</p>
            ) : (
              <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
                {aValider.map((r) => {
                  const f = facture(r.factureId);
                  const m = f ? messageRelance({ relance: r, dernier: dernier(r), facture: f, proprietaire: { nom: nom(r.proprietaireId) }, conciergerie, lienEspace: `${window.location.origin}/espace-proprietaire` }) : null;
                  return (
                    <li key={r.id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <div className="min-w-48 flex-1">
                          <p className="text-[14px] font-medium text-(--lm-encre)">
                            {r.numero} · {nom(r.proprietaireId)}
                            {f ? ` · ${euros(montantTtcFacture(f))}` : ''}
                          </p>
                          <p className="text-[12.5px] text-(--lm-encre-2)">
                            {f ? `Échéance ${dateCourte(f.echeance)} · ` : ''}
                            {nomRappel(r.niveau, dernier(r))} le {dateCourte(r.dueLe)}
                          </p>
                          {r.motif && <p className="text-[12.5px] text-(--lm-encre-2)">{MOTIF[r.motif]}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button size="sm" variant="secondary" icone={<Send />} chargement={enCours === r.id} disabled={!!enCours} onClick={() => void decider('relance-envoyer', r.id)}>
                            Envoyer
                          </Button>
                          <Button size="sm" variant="ghost" icone={<X />} disabled={!!enCours} onClick={() => void decider('relance-annuler', r.id)}>
                            Ne pas envoyer
                          </Button>
                        </div>
                      </div>
                      {m && (
                        <details className="group mt-1">
                          <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-medium lm-lien [&::-webkit-details-marker]:hidden">
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

          {historique.length > 0 && (
            <div>
              <p className="mb-2 text-[13.5px] font-medium text-(--lm-encre)">Historique</p>
              <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
                {historique.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                    <span className="min-w-0 text-(--lm-encre)">
                      {r.numero} · {nomRappel(r.niveau, dernier(r))} · {nom(r.proprietaireId)}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-(--lm-encre-2)">
                      {r.statut === 'envoyee' ? (
                        <>
                          Envoyée{r.envoyeeLe ? ` le ${dateCourte(r.envoyeeLe.slice(0, 10))}` : ''}
                          {r.envoyeePar === 'automatique' ? ' · automatique' : ''}
                        </>
                      ) : r.statut === 'annulee' ? (
                        <Badge tone="neutre">Non envoyée{r.annuleeLe ? ` le ${dateCourte(r.annuleeLe.slice(0, 10))}` : ''}</Badge>
                      ) : (
                        <Badge tone="neutre">{facture(r.factureId)?.statut === 'payee' ? 'Sans objet · payée' : 'Sans objet'}</Badge>
                      )}
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
