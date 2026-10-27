/**
 * Onglet « Votre agent » : marche / pause, ce qu'il envoie seul
 * (niveau d'autonomie), ton, langues, signature, horaires, ce qu'il vous
 * transmet, où vous prévenir. Marche, niveau, horaires et ce qu'il vous
 * confie : gérant seulement (REGLAGES_AGENT_GERANT) ; ton, signature,
 * langues et Telegram : toute l'équipe. En-tête et aide suivent le niveau
 * choisi (explicationNiveau).
 *
 * Enregistré dans la collection `reglages` (élément 'agent'), synchronisée
 * avec la base comme le reste. L'agent du site (api/erp-agent.ts) relit ces
 * réglages à chaque passage : voir docs/erp/README.md, « Messagerie et agent IA ».
 * Le bloc « Votre agent en ce moment » montre ce qui est branché côté serveur.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Alert, Aide, Button, Card, Input, Interrupteur, Select, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { LANGUES_AGENT, TONS_AGENT, nomPourSignature, reglagesAgent, signatureParDefaut } from '../../../data/reglages';
import { espaceOuvert, estLabelMaison } from '../../../data/espaces';
import { dateCourte, heure, horodatageMaintenant, pluriel } from '../../../data/format';
import type { ReglagesAgent } from '../../../data/types';
import { NIVEAUX_AUTONOMIE, explicationNiveau, niveauAutonomie, reglagesAEnregistrer } from '../../../data/messagerie-ia';
import { completudeFiche } from './logique';
import { EtatAgentServeur } from './EtatAgent';

const DELAIS = [
  { valeur: '15', libelle: '15 minutes' },
  { valeur: '30', libelle: '30 minutes' },
  { valeur: '60', libelle: '1 heure' },
  { valeur: '120', libelle: '2 heures' },
  { valeur: '240', libelle: '4 heures' },
];

function Bloc({ titre, description, children }: { titre: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <h3 className="text-[15px] font-semibold text-(--lm-encre)">{titre}</h3>
      {description && <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

/** Mention d'un réglage réservé au gérant (même phrase partout). */
function ReserveGerant() {
  return (
    <span className="inline-flex items-start gap-1 text-(--lm-encre-3)">
      <Lock className="mt-[0.25em] size-3 shrink-0" aria-hidden /> Seul un gérant peut changer ce choix.
    </span>
  );
}

function Case({ coche, onChange, verrou, children, disabled }: { coche: boolean; onChange?: (v: boolean) => void; verrou?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px]', !verrou && !disabled && 'cursor-pointer hover:bg-(--lm-surface-2)')}>
      <input
        type="checkbox"
        checked={coche}
        disabled={verrou || disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-(--lm-or)"
      />
      <span className="min-w-0 flex-1 text-(--lm-encre)">{children}</span>
      {verrou && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-(--lm-encre-3)">
          <Lock className="size-3" aria-hidden /> toujours
        </span>
      )}
    </label>
  );
}

export function Configurer() {
  const d = useErp();
  // Signature par défaut au nom de l'espace ouvert (« L’équipe Sens ») ; Label Maison inchangé.
  const nomEspace = nomPourSignature(espaceOuvert());
  const signatureDefaut = signatureParDefaut(nomEspace);
  const enregistre = reglagesAgent(d, nomEspace);
  const [f, setF] = useState<ReglagesAgent>(enregistre);
  const [ok, setOk] = useState(false);
  const modifie = JSON.stringify({ ...f, majLe: 0, majPar: 0 }) !== JSON.stringify({ ...enregistre, majLe: 0, majPar: 0 });
  const bloque = d.lectureSeule;

  // Un collègue enregistre pendant qu'on regarde : on suit, sauf modification en cours.
  const cleEnregistre = JSON.stringify(enregistre);
  useEffect(() => {
    if (!modifie) setF(enregistre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleEnregistre]);

  const maj = (patch: Partial<ReglagesAgent>) => {
    setOk(false);
    setF((x) => ({ ...x, ...patch }));
  };
  const majTransmettre = (patch: Partial<ReglagesAgent['transmettre']>) => maj({ transmettre: { ...f.transmettre, ...patch } });

  const ton = TONS_AGENT.find((t) => t.cle === f.ton) ?? TONS_AGENT[0];
  // Ce qu'il envoie seul : choix du gérant. Sans choix : « Autonome hors sujets sensibles » pour Label Maison, « Je valide tout » pour un nouvel espace.
  const gerant = d.utilisateur.role === 'gerant';
  const autonomie = niveauAutonomie(f, estLabelMaison(espaceOuvert()));
  const niveau = NIVEAUX_AUTONOMIE.find((n) => n.cle === autonomie) ?? NIVEAUX_AUTONOMIE[0];
  const explication = explicationNiveau(autonomie, f.transmettre);
  // Marche, niveau, horaires et ce qu'il vous confie : gérant seulement. Ton, signature et langues : toute l'équipe.
  const reserve = bloque || !gerant;
  const mention = !gerant && !bloque;
  const incompletes = useMemo(
    () => d.logements.filter((l) => l.statut !== 'sorti' && !completudeFiche(l).complete),
    [d.logements],
  );
  const horairesInvalides = f.horaires.mode === 'plage' && f.horaires.debut >= f.horaires.fin;

  const enregistrer = () => {
    if (horairesInvalides || bloque) return;
    // Hors gérant : les réglages réservés tels qu'en base (sans les valeurs par défaut), sinon la base refuse.
    const ligne = (d.reglages ?? []).find((r): r is ReglagesAgent => r?.id === 'agent');
    d.upsert('reglages', { ...reglagesAEnregistrer(f, ligne, gerant), signature: f.signature.trim(), majLe: horodatageMaintenant(), majPar: d.utilisateur.nom });
    setOk(true);
  };

  return (
    <div className="space-y-4">
      {bloque && (
        <Alert tone="info" titre="Lecture seule : seul un gérant peut changer ces réglages." />
      )}

      <Card className={cn('flex flex-wrap items-center gap-4', f.actif ? 'border-(--lm-succes)/40' : 'border-(--lm-alerte)/40')}>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-(--lm-encre)">{f.actif ? explication.titre : 'Votre agent est en pause'}</p>
          {/* Actif : le titre suffit, la phrase sous le choix du niveau explique le reste. */}
          {!f.actif && <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">Tous les messages arrivent à l’équipe.</p>}
          {mention && (
            <p className="mt-1 text-[12.5px]">
              <ReserveGerant />
            </p>
          )}
        </div>
        <label className="flex items-center gap-3 text-[13.5px] font-medium text-(--lm-encre)">
          {f.actif ? 'Actif' : 'En pause'}
          <Interrupteur actif={f.actif} onChange={(v) => maj({ actif: v })} label="Activer votre agent" disabled={reserve} />
        </label>
      </Card>

      {/* La carte d'état suit le niveau enregistré, pas celui en cours de choix. */}
      <EtatAgentServeur actifReglage={enregistre.actif} passage={explicationNiveau(niveauAutonomie(enregistre, estLabelMaison(espaceOuvert())), enregistre.transmettre).passage} />

      <Bloc titre="Ce qu’il envoie seul" description={mention ? <ReserveGerant /> : undefined}>
        <div role="radiogroup" aria-label="Ce que votre agent envoie seul" className="grid gap-2 sm:grid-cols-3">
          {NIVEAUX_AUTONOMIE.map((n) => (
            <button
              key={n.cle}
              type="button"
              role="radio"
              aria-checked={autonomie === n.cle}
              disabled={reserve}
              onClick={() => maj({ autonomie: n.cle })}
              className={cn(
                'min-h-11 rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                autonomie === n.cle ? 'border-(--lm-or) bg-(--lm-or-lavis)' : 'border-(--lm-bord) hover:border-(--lm-bord-fort)',
              )}
            >
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-(--lm-encre)">
                {autonomie === n.cle && <Check className="size-4 shrink-0 text-(--lm-or-texte)" aria-hidden />}
                {n.libelle}
              </span>
              <span className="sr-only">{n.description}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-(--lm-encre-2)" aria-live="polite">
          {niveau.description}
        </p>
      </Bloc>

      <Bloc titre="Sa façon de parler">
        <div role="radiogroup" aria-label="Ton de votre agent" className="grid gap-2 sm:grid-cols-3">
          {TONS_AGENT.map((t) => (
            <button
              key={t.cle}
              type="button"
              role="radio"
              aria-checked={f.ton === t.cle}
              disabled={bloque}
              onClick={() => maj({ ton: t.cle })}
              className={cn(
                'rounded-lg border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
                f.ton === t.cle ? 'border-(--lm-or) bg-(--lm-or-lavis)' : 'border-(--lm-bord) hover:border-(--lm-bord-fort)',
              )}
            >
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-(--lm-encre)">
                {f.ton === t.cle && <Check className="size-4 text-(--lm-or-texte)" aria-hidden />}
                {t.libelle}
              </span>
              <span className="sr-only">{t.description}</span>
            </button>
          ))}
        </div>
        <figure className="mt-4 rounded-lg rounded-br-sm border border-(--lm-or-anneau) bg-(--lm-or-lavis) px-4 py-3" aria-live="polite">
          <figcaption className="mb-1 text-[11.5px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">Exemple de réponse</figcaption>
          <p className="text-[13.5px] leading-relaxed text-(--lm-encre)">{ton.exemple(f.signature.trim() || signatureDefaut)}</p>
        </figure>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="agent-signature" className="text-[13px] font-medium text-(--lm-encre)">
              Signature
            </label>
            <Input
              id="agent-signature"
              className="mt-1.5"
              value={f.signature}
              maxLength={80}
              disabled={bloque}
              onChange={(e) => maj({ signature: e.target.value })}
              placeholder={signatureDefaut}
            />
          </div>
          <fieldset>
            <legend className="text-[13px] font-medium text-(--lm-encre)">Langues</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {LANGUES_AGENT.map((l) => {
                const choisie = f.langues.includes(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    aria-pressed={choisie}
                    disabled={bloque || (choisie && f.langues.length === 1)}
                    onClick={() => maj({ langues: choisie ? f.langues.filter((x) => x !== l.code) : [...f.langues, l.code] })}
                    className={cn(
                      'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed',
                      choisie ? 'border-(--lm-or) bg-(--lm-or-lavis) text-(--lm-brun)' : 'border-(--lm-bord-fort) text-(--lm-encre-2) hover:text-(--lm-encre)',
                    )}
                  >
                    {choisie && <Check className="size-3.5" aria-hidden />}
                    {l.libelle}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </Bloc>

      <Bloc titre="Quand répond-il ?" description={mention ? <ReserveGerant /> : undefined}>
        <div role="radiogroup" aria-label="Horaires de réponse" className="flex flex-wrap gap-2">
          {(
            [
              ['toujours', 'Jour et nuit'],
              ['plage', 'Seulement à certaines heures'],
            ] as const
          ).map(([mode, libelle]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={f.horaires.mode === mode}
              disabled={reserve}
              onClick={() => maj({ horaires: { ...f.horaires, mode } })}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13.5px] font-medium disabled:cursor-not-allowed',
                f.horaires.mode === mode ? 'border-(--lm-or) bg-(--lm-or-lavis) text-(--lm-brun)' : 'border-(--lm-bord-fort) text-(--lm-encre-2)',
              )}
            >
              {f.horaires.mode === mode && <Check className="size-4" aria-hidden />}
              {libelle}
            </button>
          ))}
        </div>
        {f.horaires.mode === 'plage' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[13.5px] text-(--lm-encre)">
            <label htmlFor="agent-debut">De</label>
            <Input id="agent-debut" type="time" className="w-32" value={f.horaires.debut} disabled={reserve} onChange={(e) => maj({ horaires: { ...f.horaires, debut: e.target.value } })} />
            <label htmlFor="agent-fin">à</label>
            <Input id="agent-fin" type="time" className="w-32" value={f.horaires.fin} disabled={reserve} onChange={(e) => maj({ horaires: { ...f.horaires, fin: e.target.value } })} />
            <span className="text-(--lm-encre-3)">(heure de Paris)</span>
          </div>
        )}
        {horairesInvalides && <p className="mt-2 text-[12.5px] font-medium text-(--lm-danger)">L’heure de fin doit être après l’heure de début.</p>}
      </Bloc>

      <Bloc titre="Ce qu’il vous confie" description={mention ? <ReserveGerant /> : undefined}>
        <div className="grid gap-x-5 md:grid-cols-2">
            <Case coche verrou>
              Tout ce qui touche à l’argent : remboursement, remise, supplément, annulation
            </Case>
            <Case coche verrou>
              Les plaintes, les litiges et les problèmes sur place
            </Case>
            <Case coche={f.transmettre.horsFiche} disabled={reserve} onChange={(v) => majTransmettre({ horsFiche: v })}>
              Les questions dont la réponse n’est pas dans la fiche du logement
            </Case>
            <Case coche={f.transmettre.derogations} disabled={reserve} onChange={(v) => majTransmettre({ derogations: v })}>
              Les demandes d’exception (arriver plus tôt, partir plus tard…)
            </Case>
            <Case coche={f.transmettre.sejoursLongs} disabled={reserve} onChange={(v) => majTransmettre({ sejoursLongs: v })}>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Les demandes de séjour de
                <Input
                  type="number"
                  min={2}
                  max={365}
                  aria-label="Nombre de nuits à partir duquel un séjour est long"
                  className="h-8 w-16 px-2 text-[13px]"
                  value={f.transmettre.sejoursLongsNuits}
                  disabled={reserve || !f.transmettre.sejoursLongs}
                  onChange={(e) => majTransmettre({ sejoursLongsNuits: Math.max(2, Math.min(365, Number(e.target.value) || 2)) })}
                />
                nuits ou plus
              </span>
            </Case>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) pt-4 text-[13.5px] text-(--lm-encre)">
          <label htmlFor="agent-delai">Sans réponse de l’équipe, vous prévenir après</label>
          <Select
            id="agent-delai"
            className="w-40"
            value={String(f.delaiAlerteMinutes)}
            disabled={reserve}
            onChange={(e) => maj({ delaiAlerteMinutes: Number(e.target.value) })}
            options={DELAIS}
          />
        </div>
        <Aide titre={autonomie === 'valider' ? 'Ce qu’il prépare et les règles qu’il respecte' : 'Ce qu’il fait seul et les règles qu’il respecte'} className="mt-4 mb-0">
          <p className="font-medium text-(--lm-encre)">{explication.sujets}</p>
          <ul className="mt-1 mb-3 list-disc space-y-1 pl-5">
            {explication.listeSujets.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="font-medium text-(--lm-encre)">Ses règles :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {explication.regles.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2">Ces règles valent aussi pour l’équipe.</p>
        </Aide>
      </Bloc>

      {/* Telegram : le groupe de l'équipe de Label Maison seulement (jamais d'envoi pour un autre espace). */}
      {estLabelMaison(espaceOuvert()) && (
        <Bloc titre="Où vous prévenir">
          <label className="flex cursor-pointer items-start gap-3">
            <Interrupteur actif={f.telegram} onChange={(v) => maj({ telegram: v })} label="Prévenir sur Telegram" disabled={bloque} />
            <span className="text-[13.5px]">
              <span className="font-medium text-(--lm-encre)">Sur Telegram</span>
              <span className="block text-(--lm-encre-2)">Copie de ses réponses, alertes et rappels.</span>
            </span>
          </label>
        </Bloc>
      )}

      <Bloc titre="Fiches des logements">
        {incompletes.length ? (
          <p className="text-[13.5px] text-(--lm-encre)">
            <strong>{pluriel(incompletes.length, 'fiche est incomplète', 'fiches sont incomplètes')}</strong>
            <span className="text-(--lm-encre-2)"> : {explication.fichesIncompletes}</span>
          </p>
        ) : (
          d.logements.some((l) => l.statut !== 'sorti') ? (
            <p className="text-[13.5px] text-(--lm-succes)">Toutes les fiches sont complètes.</p>
          ) : (
            <p className="text-[13.5px] text-(--lm-encre-2)">Aucun logement pour l’instant : ils arrivent avec la connexion des plateformes.</p>
          )
        )}
        <Link to={incompletes[0] ? `/erp/logements/${incompletes[0].id}?onglet=fiche` : '/erp/logements'} className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
          {incompletes[0] ? `Compléter la fiche de ${incompletes[0].nom}` : 'Voir vos logements'} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Bloc>

      {/* Même barre d'enregistrement que les infos d'un logement : collée en bas, l'action d'abord. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) bg-(--lm-fond) px-4 py-3 sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <Button variant="primary" onClick={enregistrer} disabled={!modifie || horairesInvalides || bloque}>
          Enregistrer
        </Button>
        {modifie && (
          <Button variant="ghost" onClick={() => setF(enregistre)}>
            Annuler les modifications
          </Button>
        )}
        <p
          role="status"
          className={cn('min-w-0 flex-1 text-[12.5px]', ok ? 'text-(--lm-succes-texte)' : 'text-(--lm-encre-3)', modifie && !ok && 'max-sm:hidden')}
        >
          {ok
            ? 'Enregistré. Votre agent en tient compte dès sa prochaine réponse.'
            : modifie
              ? 'Changements non enregistrés.'
              : enregistre.majLe
                ? `Modifié le ${dateCourte(enregistre.majLe)} à ${heure(enregistre.majLe)}${enregistre.majPar ? ` par ${enregistre.majPar}` : ''}.`
                : 'Réglages par défaut.'}
        </p>
      </div>
    </div>
  );
}
