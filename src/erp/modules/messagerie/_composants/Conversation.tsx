/** Colonne centrale : en-tête, bandeau d'escalade, bulles et zone de réponse. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCheck, Loader2, Lock, RotateCcw, Send } from 'lucide-react';
import { Alert, Button, MenuActions, StatusBadge, Textarea, cn } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { dateJour, heure, horodatageMaintenant } from '../../../data/format';
import type { FilMessages, Logement, Message, Reservation } from '../../../data/types';
import { GABARITS, LIBELLE_MOTIF, completudeFiche, eligibiliteCodes, motifEscalade } from './logique';
import { ErreurServeur, appelerServeur, nomPlateformeEnvoi } from './serveur';

/** Réponse de /api/erp-repull-messages. */
interface ReponseEnvoi {
  ok: true;
  message: Message;
  canal: string;
  reecrit: boolean;
  info: string;
}

/** Envoi en cours ou fait, affiché tout de suite (la conversation arrive ensuite par le temps réel). */
interface EnvoiLocal {
  cle: string;
  texte: string;
  etat: 'envoi' | 'envoye';
  message?: Message;
}

interface Props {
  fil: FilMessages;
  logement?: Logement;
  reservation?: Reservation;
}

export function Conversation({ fil, logement, reservation }: Props) {
  const { upsert, mode, lectureSeule } = useErp();
  const [brouillon, setBrouillon] = useState('');
  const [avis, setAvis] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envois, setEnvois] = useState<EnvoiLocal[]>([]);
  // Conversation reliée à Airbnb, Booking.com... : la réponse part vraiment chez le voyageur.
  const relie = mode === 'reel' && !!fil.repull?.id;
  const plateforme = nomPlateformeEnvoi(fil.canal);
  const enCours = envois.some((e) => e.etat === 'envoi');
  const fin = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const codes = eligibiliteCodes(fil, reservation);
  const fiche = completudeFiche(logement);
  const motif = motifEscalade(fil);
  const prenom = fil.voyageur.split(' ')[0];

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
    setBrouillon('');
    setAvis(null);
    setErreur(null);
    setEnvois([]);
  }, [fil.id]);
  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' });
  }, [fil.messages.length, envois, avis]);
  // Le message envoyé est arrivé dans la conversation (temps réel) : la bulle provisoire s'efface.
  const connus = new Set(fil.messages.map((m) => m.id));
  const provisoires = envois.filter((e) => !e.message || !connus.has(e.message.id));

  const envoyerPlateforme = async (texte: string) => {
    const cle = `${Date.now()}`;
    setEnvois((l) => [...l, { cle, texte, etat: 'envoi' }]);
    setBrouillon('');
    setErreur(null);
    setAvis(null);
    try {
      const r = await appelerServeur<ReponseEnvoi>('/api/erp-repull-messages', 'POST', { action: 'envoyer', filId: fil.id, texte });
      setEnvois((l) => l.map((e) => (e.cle === cle ? { ...e, etat: 'envoye', message: r.message } : e)));
      setAvis(`${r.info} C’est maintenant l’équipe qui suit cette conversation.`);
    } catch (e) {
      setEnvois((l) => l.filter((x) => x.cle !== cle));
      // Rien n'est parti : le texte revient dans la zone de saisie.
      setBrouillon((b) => (b.trim() ? b : texte));
      setErreur(e instanceof ErreurServeur || e instanceof Error ? e.message : 'Le message n’est pas parti. Réessayez.');
    }
  };

  const envoyer = () => {
    const texte = brouillon.trim();
    if (!texte || enCours) return;
    if (relie) {
      void envoyerPlateforme(texte);
      return;
    }
    const envoyeLe = horodatageMaintenant();
    upsert('filsMessages', {
      ...fil,
      statut: fil.statut === 'clos' ? 'ouvert' : fil.statut,
      traitePar: 'humain',
      dernierMessageLe: envoyeLe,
      messages: [...fil.messages, { id: nouvelId('msg'), auteur: 'hote', texte, envoyeLe }],
    });
    setBrouillon('');
    setAvis(`Message gardé dans l’ERP : ${prenom} n’est pas relié à une plateforme, pensez à lui transmettre (téléphone, e-mail…).`);
  };

  const clore = () => {
    upsert('filsMessages', { ...fil, statut: 'clos', traitePar: fil.traitePar === 'en_attente' ? 'humain' : fil.traitePar });
    setAvis('Conversation terminée. Vous la retrouverez dans « Terminées ».');
  };
  const rouvrir = () => upsert('filsMessages', { ...fil, statut: 'ouvert' });
  const rendreMain = () => {
    upsert('filsMessages', { ...fil, statut: 'ouvert', traitePar: 'agent' });
    setAvis('Votre agent reprend la conversation. Vous recevrez une copie de chacune de ses réponses sur Telegram.');
  };

  const inserer = (texte: string) => {
    setBrouillon((b) => (b.trim() ? `${b.trimEnd()}\n${texte}` : texte));
    zone.current?.focus();
  };

  const motifReprise = !fiche.complete
    ? `Il manque des informations dans la fiche du logement (${fiche.manquants.join(', ')}) : votre agent ne peut pas répondre à sa place.`
    : fil.traitePar === 'agent' && fil.statut === 'ouvert'
      ? 'Votre agent suit déjà cette conversation.'
      : undefined;

  let jourPrecedent = '';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--lm-bord) px-3 py-2.5 sm:px-4">
        <Link to="/erp/messagerie" className="grid size-8 place-items-center rounded-md text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis) lg:hidden" aria-label="Retour aux conversations">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-(--lm-encre)">{fil.voyageur}</h2>
          <p className="truncate text-[12px] text-(--lm-encre-3)">
            {logement?.nom} · {LIBELLES.canal[fil.canal]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge type="statutFil" valeur={fil.statut} />
          <StatusBadge type="traitePar" valeur={fil.traitePar} />
        </div>
        <div className="flex w-full flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" icone={<Bot />} onClick={rendreMain} disabled={!!motifReprise} title={motifReprise}>
            Confier à l’agent
          </Button>
          <MenuActions
            label="Autres actions sur la conversation"
            actions={[
              fil.statut === 'clos'
                ? { libelle: 'Rouvrir la conversation', icone: <RotateCcw />, onClick: rouvrir }
                : { libelle: 'Marquer comme terminée', icone: <CheckCheck />, onClick: clore },
            ]}
          />
        </div>
      </div>

      {fil.statut === 'escalade' && (
        <Alert tone="danger" titre={`Votre agent vous a passé la main : ${LIBELLE_MOTIF[motif].titre.toLowerCase()}`} className="mx-3 mt-3 sm:mx-4">
          {fil.agent?.decision === 'transmettre' && fil.agent.resume ? fil.agent.resume : LIBELLE_MOTIF[motif].explication}
        </Alert>
      )}
      {erreur && (
        <Alert tone="danger" titre="Le message n’est pas parti" className="mx-3 mt-3 sm:mx-4" actions={<Button size="sm" variant="ghost" onClick={() => setErreur(null)}>OK</Button>}>
          {erreur}
        </Alert>
      )}
      {avis && (
        <Alert tone="succes" className="mx-3 mt-3 sm:mx-4" actions={<Button size="sm" variant="ghost" onClick={() => setAvis(null)}>OK</Button>}>
          {avis}
        </Alert>
      )}

      <div className="lm-defilement min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-(--lm-surface-2) px-3 py-4 sm:px-5" aria-live="polite">
        {fil.messages.map((m) => {
          const jour = m.envoyeLe.slice(0, 10);
          const separateur = jour !== jourPrecedent;
          jourPrecedent = jour;
          const voyageur = m.auteur === 'voyageur';
          return (
            <div key={m.id}>
              {separateur && <p className="my-2 text-center text-[11.5px] font-medium text-(--lm-encre-3) capitalize">{dateJour(jour)}</p>}
              <div className={cn('flex', voyageur ? 'justify-start' : 'justify-end')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm sm:max-w-[75%]',
                    voyageur && 'rounded-bl-md border border-(--lm-bord) bg-(--lm-surface) text-(--lm-encre)',
                    m.auteur === 'agent' && 'rounded-br-md border border-(--lm-or-anneau) bg-(--lm-or-lavis) text-(--lm-encre)',
                    m.auteur === 'hote' && 'rounded-br-md bg-(--lm-brun) text-white',
                  )}
                >
                  <p className="whitespace-pre-line">{m.texte}</p>
                  <p className={cn('mt-1 flex items-center justify-end gap-1.5 text-[11px]', m.auteur === 'hote' ? 'text-white/70' : 'text-(--lm-encre-3)')}>
                    {m.auteur === 'agent' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-(--lm-or) px-1.5 py-px text-[10.5px] font-semibold text-white">
                        <Bot className="size-3" aria-hidden /> Votre agent
                      </span>
                    )}
                    {m.auteur === 'hote' && <span>Équipe</span>}
                    {m.auteur !== 'voyageur' && (m.envoi || m.id.startsWith('repull-')) && (
                      <span className="inline-flex items-center gap-0.5" title={m.envoi?.reecrit ? 'La plateforme a retiré un lien ou un numéro : le voyageur a reçu ce texte.' : undefined}>
                        <CheckCheck className="size-3" aria-hidden /> Envoyé sur {nomPlateformeEnvoi(m.envoi?.canal ?? fil.canal)}
                      </span>
                    )}
                    <time dateTime={m.envoyeLe} className="lm-chiffres">{heure(m.envoyeLe)}</time>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {provisoires.map((e) => (
          <div key={e.cle} className="flex justify-end">
            <div className={cn('max-w-[85%] rounded-2xl rounded-br-md bg-(--lm-brun) px-3.5 py-2 text-[13.5px] leading-relaxed text-white shadow-sm sm:max-w-[75%]', e.etat === 'envoi' && 'opacity-70')}>
              <p className="whitespace-pre-line">{e.message?.texte ?? e.texte}</p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-white/70" aria-live="polite">
                {e.etat === 'envoi' ? (
                  <>
                    <Loader2 className="size-3 animate-spin" aria-hidden /> Envoi sur {plateforme}…
                  </>
                ) : (
                  <>
                    <CheckCheck className="size-3" aria-hidden /> Envoyé sur {nomPlateformeEnvoi(e.message?.envoi?.canal ?? fil.canal)}
                  </>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>

      <div className="border-t border-(--lm-bord) bg-(--lm-surface) p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Réponses rapides">
          <span className="text-[12px] text-(--lm-encre-3)">Modèles :</span>
          {GABARITS.map((g) => {
            const bloque = (g.sensible && !codes.autorise) || !logement;
            return (
              <button
                key={g.cle}
                type="button"
                disabled={bloque}
                onClick={() => logement && inserer(g.texte(logement, prenom))}
                title={bloque ? `Pas de codes d’accès pour ce voyageur (${codes.raison})` : `Insérer le modèle ${g.libelle}`}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-(--lm-bord-fort) px-2.5 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bloque && <Lock className="size-3" aria-hidden />}
                {g.libelle}
              </button>
            );
          })}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            envoyer();
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="composer" className="sr-only">
            Répondre à {fil.voyageur}
          </label>
          <Textarea
            id="composer"
            ref={zone}
            rows={2}
            value={brouillon}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) envoyer();
            }}
            placeholder={`Écrire à ${prenom}…`}
            className="min-h-[64px] resize-y"
          />
          <Button type="submit" variant="primary" icone={enCours ? <Loader2 className="animate-spin" /> : <Send />} disabled={!brouillon.trim() || enCours || (relie && lectureSeule)}>
            <span className="hidden sm:inline">{enCours ? 'Envoi…' : 'Envoyer'}</span>
            <span className="sr-only sm:hidden">{enCours ? 'Envoi en cours' : 'Envoyer'}</span>
          </Button>
        </form>
        <p className="mt-1.5 text-[11.5px] text-(--lm-encre-3)">
          {relie ? (
            <>
              Votre message part directement chez {prenom} sur <strong className="font-medium text-(--lm-encre-2)">{plateforme}</strong>.{' '}
            </>
          ) : (
            <>
              <strong className="font-medium text-(--lm-encre-2)">Gardé dans l’ERP</strong> : ce voyageur n’est pas relié à une plateforme, rien ne lui est envoyé.{' '}
            </>
          )}
          En répondant, vous reprenez la conversation. Ne promettez pas d’argent sans en parler à l’équipe. Ctrl + Entrée pour envoyer.
        </p>
      </div>
    </div>
  );
}
