import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check, ExternalLink } from 'lucide-react';
import { Button, Card, Field, Input, MenuActions, Modal } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, horodatageMaintenant, pluriel } from '../../../data/format';
import { plage } from '../../../data/notifications';
import { conseilCourt, decider, eurosRonds, lireElementsPrix, plusJours, type DecisionPrix, type PlagePrix } from '../../../data/prix-conseils';
import type { Logement } from '../../../data/types';
import { conseilsDuJour, liensCalendrier } from './prix';

/** Lignes montrées avant « Voir les autres ». */
const MAX_LIGNES = 3;
/** Décisions gardées dans « Déjà traités ». */
const JOURS_HISTORIQUE = 30;

// Zone de toucher de 32 px, comme les autres liens de la page.
const lien = 'inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline';

/**
 * Prix conseillés d'un logement (page du logement, sous les chiffres) : les
 * nuits dont le prix mérite d'être changé, le prix actuel et le prix
 * conseillé, pourquoi, et où le changer. L'ERP ne touche jamais au prix :
 * « Ouvrir le calendrier » mène à la plateforme, puis « C'est fait ».
 * Rien à conseiller et rien de traité récemment : pas de carte.
 */
export function PrixConseilles({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const { hash } = useLocation();
  const [tout, setTout] = useState(false);
  const [bornes, setBornes] = useState(false);
  const conseils = useMemo(() => conseilsDuJour(d.donnees, l.id), [d.donnees, l.id]);
  const { reglages, decisions } = useMemo(() => lireElementsPrix(d.conseilsPrix), [d.conseilsPrix]);
  const depuis = plusJours(AUJOURDHUI, -JOURS_HISTORIQUE);
  const traites = decisions.filter((x) => x.logementId === l.id && String(x.le).slice(0, 10) >= depuis).sort((a, b) => b.le.localeCompare(a.le));
  const liens = liensCalendrier(l);
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;

  // Ouvert depuis la notification « prix à revoir » : la carte vient à l'écran.
  useEffect(() => {
    if (hash === '#prix') document.getElementById('prix')?.scrollIntoView({ block: 'start' });
  }, [hash]);

  if (!reglages.actif || (!conseils.length && !traites.length)) return null;

  const decision = (p: PlagePrix, quoi: DecisionPrix['decision']) => d.upsert('conseilsPrix', decider(p, quoi, { le: horodatageMaintenant(), par: d.utilisateur.nom }));
  const visibles = tout ? conseils : conseils.slice(0, MAX_LIGNES);
  const b = reglages.parLogement[l.id];

  return (
    <Card flush id="prix" className="scroll-mt-20">
      {/* En-tête sur une ligne, menu compris, même sur téléphone. */}
      <div className="flex items-start gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-(--lm-encre)">Prix conseillés</h3>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">À changer vous-même sur la plateforme, puis « C’est fait ».</p>
        </div>
        {(gerant || liens.length > 1) && (
          <MenuActions
            className="shrink-0"
            label="Plus d’actions sur les prix"
            actions={[
              ...liens.slice(1).map((x) => ({ libelle: `Calendrier ${x.plateforme}`, icone: <ExternalLink />, href: x.url })),
              gerant && {
                libelle: b?.plancher || b?.plafond ? `Plancher et plafond (${[b.plancher && eurosRonds(b.plancher), b.plafond && eurosRonds(b.plafond)].filter(Boolean).join(' – ')})` : 'Plancher et plafond',
                onClick: () => setBornes(true),
              },
            ]}
          />
        )}
      </div>
      {conseils.length ? (
        <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
          {visibles.map((p) => (
            <li key={p.cle} className="px-4 py-3 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[13.5px] font-semibold text-(--lm-encre)">
                  {plage(p.debut, p.fin)}
                  <span className="font-normal text-(--lm-encre-2)"> · {pluriel(p.nuits, 'nuit')}</span>
                </p>
                <p className="lm-chiffres shrink-0 text-[13.5px] text-(--lm-encre-2)" aria-label={`Prix actuel ${eurosRonds(p.prixActuel)}, conseillé ${eurosRonds(p.prixConseille)}`}>
                  {eurosRonds(p.prixActuel)} <span aria-hidden>→</span> <span className="font-semibold text-(--lm-encre)">{eurosRonds(p.prixConseille)}</span>
                </p>
              </div>
              <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)" title={p.raison}>
                {conseilCourt(p)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {liens[0] && (
                  <a href={liens[0].url} target="_blank" rel="noopener noreferrer" className={lien} aria-label={`Ouvrir le calendrier ${liens[0].plateforme} (nouvel onglet)`}>
                    Ouvrir le calendrier <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                )}
                {!d.lectureSeule && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => decision(p, 'ignore')}>
                      Ignorer
                    </Button>
                    <Button size="sm" icone={<Check />} onClick={() => decision(p, 'fait')}>
                      C’est fait
                    </Button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-(--lm-bord) px-4 py-3 text-[13.5px] text-(--lm-encre-2) sm:px-5">Rien à changer pour l’instant.</p>
      )}
      {(conseils.length > MAX_LIGNES || traites.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 border-t border-(--lm-bord) px-4 py-1.5 sm:px-5">
          {conseils.length > MAX_LIGNES ? (
            <button type="button" onClick={() => setTout((t) => !t)} aria-expanded={tout} className={lien}>
              {tout ? 'Voir moins' : `Voir les ${conseils.length - MAX_LIGNES} autres`}
            </button>
          ) : (
            <span />
          )}
          {traites.length > 0 && <DejaTraites decisions={traites} />}
        </div>
      )}
      {bornes && <BornesLogement logement={l} onFermer={() => setBornes(false)} />}
    </Card>
  );
}

/** « Déjà traités » : ce qui a été fait ou ignoré ces 30 derniers jours, avec « Annuler ». */
function DejaTraites({ decisions }: { decisions: DecisionPrix[] }) {
  const d = useErp();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-encre-2) hover:text-(--lm-or-texte)">
        Déjà traités ({decisions.length})
      </button>
      <Modal ouvert={ouvert} onFermer={() => setOuvert(false)} titre="Prix déjà traités" description="Ces 30 derniers jours." taille="sm">
        <ul className="-my-1 divide-y divide-(--lm-bord)">
          {decisions.map((x) => (
            <li key={x.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium text-(--lm-encre)">
                  {plage(x.debut, x.fin)} · {eurosRonds(x.prixActuel)} → {eurosRonds(x.prixConseille)}
                </span>
                <span className="block text-[12px] text-(--lm-encre-2)">
                  {x.decision === 'fait' ? 'Fait' : 'Ignoré'} le {dateCourte(x.le.slice(0, 10))} par {x.par}
                </span>
              </span>
              {!d.lectureSeule && (
                <Button size="sm" variant="ghost" onClick={() => d.remove('conseilsPrix', x.id)}>
                  Annuler
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

/** Plancher et plafond d'un logement : jamais de conseil en dessous ni au-dessus. */
export function BornesLogement({ logement: l, onFermer }: { logement: Logement; onFermer: () => void }) {
  const d = useErp();
  const { reglages } = lireElementsPrix(d.conseilsPrix);
  const actuel = reglages.parLogement[l.id] ?? {};
  const [plancher, setPlancher] = useState(actuel.plancher ? String(Math.round(actuel.plancher / 100)) : '');
  const [plafond, setPlafond] = useState(actuel.plafond ? String(Math.round(actuel.plafond / 100)) : '');
  const euros = (v: string) => {
    const n = Math.round(Number(v.replace(',', '.')));
    return Number.isFinite(n) && n > 0 ? n * 100 : undefined;
  };
  const bas = euros(plancher);
  const haut = euros(plafond);
  const erreur = bas && haut && haut <= bas ? 'Le plafond doit être au-dessus du plancher.' : undefined;
  const enregistrer = () => {
    const parLogement = { ...reglages.parLogement };
    if (bas || haut) parLogement[l.id] = { ...(bas ? { plancher: bas } : {}), ...(haut ? { plafond: haut } : {}) };
    else delete parLogement[l.id];
    d.upsert('conseilsPrix', { ...reglages, parLogement, majLe: horodatageMaintenant(), majPar: d.utilisateur.nom });
    onFermer();
  };
  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Plancher et plafond"
      description={`${l.nom} : aucun prix conseillé en dessous du plancher ni au-dessus du plafond.`}
      taille="sm"
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!!erreur} onClick={enregistrer}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plancher (€ la nuit)" aide="Facultatif">
          <Input inputMode="numeric" value={plancher} onChange={(e) => setPlancher(e.target.value)} placeholder="ex. 70" />
        </Field>
        <Field label="Plafond (€ la nuit)" aide="Facultatif" erreur={erreur}>
          <Input inputMode="numeric" value={plafond} onChange={(e) => setPlafond(e.target.value)} placeholder="ex. 180" />
        </Field>
      </div>
    </Modal>
  );
}
