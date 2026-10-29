/**
 * Carte « Suppléments » de la fiche logement (cahier B7), dans l'onglet
 * « Infos pour votre agent », après « Arrivée et départ » : arrivée plus tôt,
 * départ plus tard, ménage supplémentaire, navette. Le gérant règle pour ce
 * logement ce qui est proposé, le prix indicatif et les conditions ; la
 * Messagerie s'en sert pour préparer la proposition, l'équipe l'envoie.
 * `?supplements=regler` (lien « Régler les suppléments » de la Messagerie)
 * ouvre directement le panneau. Rien de réglé et pas gérant : pas de carte.
 *
 * L'ERP n'encaisse rien et ne change aucune réservation (ni offre spéciale,
 * ni lien de paiement) : l'encaissement se fait hors ERP. Réglages : `reglages`,
 * élément 'supplements', écrit par un gérant seulement (data/supplements.ts).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { Aide, Alert, Button, Card, CardHeader, Drawer, Field, Input, Interrupteur, Select } from '../../../ui';
import { useErp } from '../../../data/store';
import { horodatageMaintenant, versCentimes } from '../../../data/format';
import type { Logement } from '../../../data/types';
import {
  CLES_SUPPLEMENTS,
  CONDITIONS_MAX,
  HEURES_SUPPLEMENTS,
  LIBELLES_SUPPLEMENTS,
  avecHeure,
  avecReglagesLogement,
  erreursReglage,
  reglagesSupplements,
  resumeSupplement,
  supplementsDuLogement,
  type CleSupplement,
  type ReglageSupplement,
} from '../../../data/supplements';

/** Saisie d'un prix en euros (« 20 », « 22,50 ») ; texte gardé tel quel pendant la frappe. */
const enEuros = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));

/** Paramètre d'adresse qui ouvre directement le panneau (lien « Régler les suppléments »). */
export const PARAM_REGLER_SUPPLEMENTS = 'supplements';

/** « Seulement si personne ne part ce jour-là » : ce que dit la case, selon le supplément. */
const SELON_PLANNING: Partial<Record<CleSupplement, string>> = {
  arrivee_anticipee: 'Seulement si personne ne part ce jour-là',
  depart_tardif: 'Seulement si personne n’arrive ce jour-là',
};

export function SupplementsLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [params, setParams] = useSearchParams();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const tous = supplementsDuLogement(reglagesSupplements(d), l.id);
  const actifs = CLES_SUPPLEMENTS.filter((k) => tous[k].actif);
  const [edition, setEdition] = useState(false);
  // « Régler les suppléments » (Messagerie) : le panneau s'ouvre dès que le gérant est connu.
  const demande = gerant && params.get(PARAM_REGLER_SUPPLEMENTS) === 'regler';
  useEffect(() => {
    if (demande) setEdition(true);
  }, [demande]);
  const fermer = () => {
    setEdition(false);
    // Un rechargement ne rouvre pas le panneau.
    if (params.has(PARAM_REGLER_SUPPLEMENTS)) {
      const suivants = new URLSearchParams(params);
      suivants.delete(PARAM_REGLER_SUPPLEMENTS);
      setParams(suivants, { replace: true });
    }
  };

  // Rien de proposé, et personne pour le régler : pas de carte vide.
  if (!actifs.length && !gerant) return null;

  return (
    <>
      <Card id="supplements">
        <CardHeader
          titre="Suppléments"
          actions={
            gerant && (
              <button type="button" onClick={() => setEdition(true)} className="inline-flex h-8 items-center text-[13px] font-medium lm-lien">
                {actifs.length ? 'Modifier' : 'Régler'}
              </button>
            )
          }
        />
        {actifs.length ? (
          <dl className="divide-y divide-(--lm-bord)">
            {actifs.map((k) => (
              <div key={k} className="flex items-start justify-between gap-3 py-1.5 text-[13.5px]">
                <dt className="shrink-0 text-(--lm-encre-2)">{LIBELLES_SUPPLEMENTS[k].titre}</dt>
                <dd className="lm-chiffres min-w-0 text-right font-medium break-words text-(--lm-encre)">{resumeSupplement(k, tous[k])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[13.5px] text-(--lm-encre-2)">Aucun supplément proposé aux voyageurs.</p>
        )}
      </Card>
      {/* Hors du formulaire de la fiche (Entrée dans un champ du panneau n'enregistre pas la fiche), dans l'ERP (ses couleurs). */}
      {edition && createPortal(<EditionSupplements logement={l} onFermer={fermer} />, document.querySelector('.erp-root') ?? document.body)}
    </>
  );
}

function EditionSupplements({ logement: l, onFermer }: { logement: Logement; onFermer: () => void }) {
  const d = useErp();
  const reglages = reglagesSupplements(d);
  const [form, setForm] = useState<Record<CleSupplement, ReglageSupplement>>(() => supplementsDuLogement(reglages, l.id));
  // Prix tels que saisis (« 22,50 ») : convertis en centimes à l'enregistrement.
  const [prix, setPrix] = useState<Record<CleSupplement, string>>(() => Object.fromEntries(CLES_SUPPLEMENTS.map((k) => [k, enEuros(form[k].prixCentimes)])) as Record<CleSupplement, string>);
  const [tente, setTente] = useState(false);

  const avecPrix = (k: CleSupplement): ReglageSupplement => {
    const c = versCentimes(prix[k] || '');
    return { ...form[k], prixCentimes: Number.isFinite(c) ? c : -1 };
  };
  const erreurs = Object.fromEntries(CLES_SUPPLEMENTS.map((k) => [k, erreursReglage(k, avecPrix(k), l.fiche)])) as Record<CleSupplement, string[]>;
  const bloque = CLES_SUPPLEMENTS.some((k) => erreurs[k].length);
  const maj = (k: CleSupplement, patch: Partial<ReglageSupplement>) => setForm((f) => ({ ...f, [k]: { ...f[k], ...patch } }));

  const enregistrer = () => {
    setTente(true);
    if (bloque) return;
    const final = Object.fromEntries(CLES_SUPPLEMENTS.map((k) => [k, avecPrix(k)])) as Record<CleSupplement, ReglageSupplement>;
    d.upsert('reglages', avecReglagesLogement(reglages, l.id, final, { le: horodatageMaintenant(), nom: d.utilisateur.nom }));
    onFermer();
  };

  const heures = (k: CleSupplement) =>
    HEURES_SUPPLEMENTS.filter((h) => (k === 'arrivee_anticipee' ? !l.fiche.heureArrivee || h < l.fiche.heureArrivee : !l.fiche.heureDepart || h > l.fiche.heureDepart)).map((h) => ({ valeur: h, libelle: h }));

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre="Suppléments"
      sousTitre={l.nom}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" onClick={enregistrer}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-[13.5px] text-(--lm-encre-2)">Ce que vous proposez aux voyageurs de ce logement. La Messagerie prépare la réponse avec ce prix ; vous l’envoyez.</p>
          <Aide className="mt-2 mb-0">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="font-medium text-(--lm-encre)">L’ERP n’encaisse rien.</strong> Il ne crée ni offre spéciale ni lien de paiement et ne modifie pas la
                réservation sur Airbnb ou Booking.com. L’encaissement se fait en dehors de l’ERP, par l’équipe.
              </li>
              <li>Votre agent ne vend jamais seul un supplément : il prépare la réponse, vous la validez.</li>
              <li>Case cochée : pas d’arrivée plus tôt si un voyageur part ce jour-là, pas de départ plus tard si un voyageur arrive. Décochée : la Messagerie le dit « à vérifier ».</li>
              <li>Le message automatique « Proposer les suppléments » (Messagerie) les propose 3 jours avant l’arrivée, s’il est allumé.</li>
            </ul>
          </Aide>
        </div>

        <ul className="divide-y divide-(--lm-bord) border-y border-(--lm-bord)">
          {CLES_SUPPLEMENTS.map((k) => {
            const r = form[k];
            const libelle = LIBELLES_SUPPLEMENTS[k];
            return (
              <li key={k} className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-(--lm-encre)">{libelle.titre}</p>
                    <p className="text-[12.5px] text-(--lm-encre-2)">{libelle.aide}</p>
                  </div>
                  <Interrupteur actif={r.actif} label={`Proposer « ${libelle.titre} »`} onChange={(v) => maj(k, { actif: v })} />
                </div>
                {r.actif && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="Prix indicatif (€)" erreur={tente ? erreurs[k].find((e) => /prix/i.test(e)) : undefined}>
                      <Input inputMode="decimal" value={prix[k]} onChange={(e) => setPrix((p) => ({ ...p, [k]: e.target.value }))} placeholder="20" />
                    </Field>
                    {avecHeure(k) && (
                      <Field label={k === 'arrivee_anticipee' ? 'Arrivée dès' : 'Départ jusqu’à'} erreur={tente ? erreurs[k].find((e) => /heure/i.test(e)) : undefined}>
                        <Select value={r.heure} onChange={(e) => maj(k, { heure: e.target.value })} options={heures(k)} />
                      </Field>
                    )}
                    {avecHeure(k) && (
                      <label className="col-span-2 flex min-h-8 cursor-pointer items-center gap-2 text-[13px] text-(--lm-encre)">
                        <input type="checkbox" className="size-4 accent-(--lm-or)" checked={r.selonPlanning !== false} onChange={(e) => maj(k, { selonPlanning: e.target.checked })} />
                        {SELON_PLANNING[k]}
                      </label>
                    )}
                    <Field label="Précision (facultatif)" className="col-span-2" aide="Montrée au voyageur avec la proposition.">
                      <Input
                        value={r.conditions ?? ''}
                        maxLength={CONDITIONS_MAX}
                        onChange={(e) => maj(k, { conditions: e.target.value })}
                        placeholder={k === 'navette' ? 'Depuis la gare d’Évry ou l’aéroport d’Orly' : k === 'menage_supplementaire' ? 'Linge changé, à prévoir la veille' : 'À confirmer la veille'}
                      />
                    </Field>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {tente && bloque && <Alert tone="alerte">Corrigez les champs signalés avant d’enregistrer.</Alert>}
      </div>
    </Drawer>
  );
}
