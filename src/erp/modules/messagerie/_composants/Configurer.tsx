/**
 * Onglet « Configurer mon agent » : marche / pause, ton, langues, signature,
 * horaires, ce qu'il vous transmet, où vous prévenir.
 *
 * Enregistré dans la collection `reglages` (élément 'agent'), synchronisée
 * avec la base comme le reste. L'agent du site (api/erp-agent.ts) relit ces
 * réglages à chaque passage : voir docs/erp/README.md, « Messagerie et agent IA ».
 * Le bloc « Votre agent, en vrai » montre ce qui est branché côté serveur.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock, Save } from 'lucide-react';
import { Alert, Aide, Button, Card, Input, Interrupteur, Select, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { LANGUES_AGENT, TONS_AGENT, reglagesAgent } from '../../../data/reglages';
import { dateCourte, heure, horodatageMaintenant, pluriel } from '../../../data/format';
import type { ReglagesAgent } from '../../../data/types';
import { completudeFiche } from './logique';
import { EtatAgentServeur } from './EtatAgent';

const DELAIS = [
  { valeur: '15', libelle: '15 minutes' },
  { valeur: '30', libelle: '30 minutes' },
  { valeur: '60', libelle: '1 heure' },
  { valeur: '120', libelle: '2 heures' },
  { valeur: '240', libelle: '4 heures' },
];

const SEUL = [
  'Les questions sur l’arrivée et le départ (horaires, accès, parking)',
  'Le wifi, les équipements, les règles de la maison',
  'Les codes d’accès, seulement aux voyageurs confirmés qui arrivent sous 48 h',
  'Les remerciements et les petites questions du quotidien',
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
  const enregistre = reglagesAgent(d);
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
  const incompletes = useMemo(
    () => d.logements.filter((l) => l.statut !== 'sorti' && !completudeFiche(l).complete),
    [d.logements],
  );
  const horairesInvalides = f.horaires.mode === 'plage' && f.horaires.debut >= f.horaires.fin;

  const enregistrer = () => {
    if (horairesInvalides || bloque) return;
    d.upsert('reglages', { ...f, signature: f.signature.trim(), majLe: horodatageMaintenant(), majPar: d.utilisateur.nom });
    setOk(true);
  };

  return (
    <div className="space-y-4 pb-24">
      {bloque && (
        <Alert tone="info" titre="Vous êtes en lecture seule">
          Vous pouvez consulter les réglages, mais seul un gérant peut les changer.
        </Alert>
      )}

      <Card className={cn('flex flex-wrap items-center gap-4', f.actif ? 'border-(--lm-succes)/40' : 'border-(--lm-alerte)/40')}>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-(--lm-encre)">{f.actif ? 'Votre agent répond aux voyageurs' : 'Votre agent est en pause'}</p>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">
            {f.actif
              ? 'Il répond seul aux questions simples et vous passe la main pour le reste.'
              : 'Il ne répond plus : tous les messages arrivent directement à l’équipe.'}
          </p>
        </div>
        <label className="flex items-center gap-3 text-[13.5px] font-medium text-(--lm-encre)">
          {f.actif ? 'Actif' : 'En pause'}
          <Interrupteur actif={f.actif} onChange={(v) => maj({ actif: v })} label="Activer l’agent" disabled={bloque} />
        </label>
      </Card>

      <EtatAgentServeur actifReglage={enregistre.actif} />

      <Bloc titre="Sa façon de parler" description="Choisissez le ton ; l’exemple se met à jour tout de suite.">
        <div role="radiogroup" aria-label="Ton de l’agent" className="grid gap-2 sm:grid-cols-3">
          {TONS_AGENT.map((t) => (
            <button
              key={t.cle}
              type="button"
              role="radio"
              aria-checked={f.ton === t.cle}
              disabled={bloque}
              onClick={() => maj({ ton: t.cle })}
              className={cn(
                'rounded-xl border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed',
                f.ton === t.cle ? 'border-(--lm-or) bg-(--lm-or-lavis)' : 'border-(--lm-bord) hover:border-(--lm-bord-fort)',
              )}
            >
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-(--lm-encre)">
                {f.ton === t.cle && <Check className="size-4 text-(--lm-or)" aria-hidden />}
                {t.libelle}
              </span>
              <span className="mt-0.5 block text-[12.5px] text-(--lm-encre-2)">{t.description}</span>
            </button>
          ))}
        </div>
        <figure className="mt-4 rounded-2xl rounded-br-md border border-(--lm-or-anneau) bg-(--lm-or-lavis) px-4 py-3" aria-live="polite">
          <figcaption className="mb-1 text-[11.5px] font-semibold tracking-wide text-(--lm-encre-3) uppercase">Exemple de réponse</figcaption>
          <p className="text-[13.5px] leading-relaxed text-(--lm-encre)">{ton.exemple(f.signature.trim() || 'L’équipe Label Maison')}</p>
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
              placeholder="L’équipe Label Maison"
            />
            <p className="mt-1 text-[12px] text-(--lm-encre-3)">Ajoutée à la fin de chaque réponse.</p>
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
            <p className="mt-1 text-[12px] text-(--lm-encre-3)">Il répond dans la langue du voyageur si elle est cochée, sinon en anglais.</p>
          </fieldset>
        </div>
      </Bloc>

      <Bloc titre="Quand répond-il ?">
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
              disabled={bloque}
              onClick={() => maj({ horaires: { ...f.horaires, mode } })}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13.5px] font-medium',
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
            <Input id="agent-debut" type="time" className="w-32" value={f.horaires.debut} disabled={bloque} onChange={(e) => maj({ horaires: { ...f.horaires, debut: e.target.value } })} />
            <label htmlFor="agent-fin">à</label>
            <Input id="agent-fin" type="time" className="w-32" value={f.horaires.fin} disabled={bloque} onChange={(e) => maj({ horaires: { ...f.horaires, fin: e.target.value } })} />
            <span className="text-(--lm-encre-3)">(heure de Paris)</span>
          </div>
        )}
        {horairesInvalides && <p className="mt-2 text-[12.5px] font-medium text-(--lm-danger)">L’heure de fin doit être après l’heure de début.</p>}
        <p className="mt-2 text-[12.5px] text-(--lm-encre-3)">
          {f.horaires.mode === 'toujours'
            ? 'Les voyageurs ont une réponse à toute heure, même la nuit.'
            : 'En dehors de ces heures, votre agent ne répond pas : les messages attendent l’équipe.'}
        </p>
      </Bloc>

      <Bloc titre="Ce qu’il fait seul, ce qu’il vous confie" description="Dans le doute, votre agent vous passe toujours la main.">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-(--lm-encre)">Il répond seul à</p>
            <ul className="space-y-1.5 text-[13.5px] text-(--lm-encre-2)">
              {SEUL.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-(--lm-succes)" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold text-(--lm-encre)">Il vous confie</p>
            <Case coche verrou>
              Tout ce qui touche à l’argent : remboursement, remise, supplément
            </Case>
            <Case coche verrou>
              Les plaintes et les litiges
            </Case>
            <Case coche={f.transmettre.horsFiche} disabled={bloque} onChange={(v) => majTransmettre({ horsFiche: v })}>
              Les questions dont la réponse n’est pas dans la fiche du logement
            </Case>
            <Case coche={f.transmettre.derogations} disabled={bloque} onChange={(v) => majTransmettre({ derogations: v })}>
              Les demandes d’exception (arriver plus tôt, partir plus tard…)
            </Case>
            <Case coche={f.transmettre.sejoursLongs} disabled={bloque} onChange={(v) => majTransmettre({ sejoursLongs: v })}>
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Les demandes de séjour de
                <Input
                  type="number"
                  min={2}
                  max={365}
                  aria-label="Nombre de nuits à partir duquel un séjour est long"
                  className="h-7 w-16 px-2 text-[13px]"
                  value={f.transmettre.sejoursLongsNuits}
                  disabled={bloque || !f.transmettre.sejoursLongs}
                  onChange={(e) => majTransmettre({ sejoursLongsNuits: Math.max(2, Math.min(365, Number(e.target.value) || 2)) })}
                />
                nuits ou plus
              </span>
            </Case>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) pt-4 text-[13.5px] text-(--lm-encre)">
          <label htmlFor="agent-delai">Si personne n’a répondu à une conversation qu’il vous a confiée, vous prévenir après</label>
          <Select
            id="agent-delai"
            className="w-40"
            value={String(f.delaiAlerteMinutes)}
            disabled={bloque}
            onChange={(e) => maj({ delaiAlerteMinutes: Number(e.target.value) })}
            options={DELAIS}
          />
        </div>
        <Aide titre="Les règles qu’il respecte toujours" className="mt-4 mb-0">
          <ul className="list-disc space-y-1 pl-5">
            <li>Il n’invente rien : si l’information n’est pas dans la fiche du logement, il dit qu’il vérifie et vous passe la main.</li>
            <li>Il ne promet jamais d’argent, même un petit geste.</li>
            <li>Il répond dans la langue du voyageur.</li>
            <li>Il ne donne les codes d’accès qu’aux voyageurs dont la réservation est confirmée, qui arrivent sous 48 h ou sont déjà sur place.</li>
          </ul>
          <p className="mt-2">Ces règles valent aussi pour l’équipe.</p>
        </Aide>
      </Bloc>

      <Bloc titre="Où vous prévenir">
        <label className="flex cursor-pointer items-start gap-3">
          <Interrupteur actif={f.telegram} onChange={(v) => maj({ telegram: v })} label="Prévenir sur Telegram" disabled={bloque} />
          <span className="text-[13.5px]">
            <span className="font-medium text-(--lm-encre)">Sur Telegram</span>
            <span className="block text-(--lm-encre-2)">
              Une copie de chaque réponse de l’agent, une alerte dès qu’il vous confie une conversation, et un rappel si personne n’a répondu à temps. Le
              groupe de l’équipe se règle dans Vercel (TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID) : voir « Votre agent, en vrai » plus haut.
            </span>
          </span>
        </label>
      </Bloc>

      <Bloc titre="Ce que votre agent sait de chaque logement" description="Il puise ses réponses dans la fiche du logement : wifi, accès, horaires, règles, équipements.">
        {incompletes.length ? (
          <p className="text-[13.5px] text-(--lm-encre)">
            <strong>{pluriel(incompletes.length, 'fiche est incomplète', 'fiches sont incomplètes')}</strong>
            <span className="text-(--lm-encre-2)"> ({incompletes.slice(0, 3).map((l) => l.nom).join(', ')}{incompletes.length > 3 ? '…' : ''}). Pour ces logements, votre agent vous passe la main.</span>
          </p>
        ) : (
          <p className="text-[13.5px] text-(--lm-succes)">Toutes les fiches sont complètes : votre agent peut répondre partout.</p>
        )}
        <Link to={incompletes[0] ? `/erp/logements/${incompletes[0].id}` : '/erp/logements'} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or) hover:underline">
          {incompletes[0] ? `Compléter la fiche de ${incompletes[0].nom}` : 'Voir vos logements'} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </Bloc>

      <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-(--lm-bord) bg-(--lm-surface)/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="min-w-0 flex-1 text-[12.5px] text-(--lm-encre-3)" aria-live="polite">
          {ok
            ? 'C’est enregistré. Votre agent en tiendra compte dans ses prochaines réponses.'
            : modifie
              ? 'Vous avez des changements non enregistrés.'
              : enregistre.majLe
                ? `Dernière modification le ${dateCourte(enregistre.majLe)} à ${heure(enregistre.majLe)}${enregistre.majPar ? ` par ${enregistre.majPar}` : ''}.`
                : 'Réglages par défaut : rien n’a encore été changé.'}
        </p>
        {modifie && (
          <Button variant="ghost" onClick={() => setF(enregistre)}>
            Annuler
          </Button>
        )}
        <Button variant="primary" icone={<Save />} onClick={enregistrer} disabled={!modifie || horairesInvalides || bloque}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
