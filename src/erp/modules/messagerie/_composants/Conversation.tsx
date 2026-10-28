/**
 * Une conversation : en-tête compact, ce que l'agent a transmis, les bulles,
 * puis la zone de réponse (où en est la conversation, modèles, message).
 *
 * « Pas besoin de répondre » termine la conversation sans écrire au voyageur :
 * elle quitte « À répondre » et « À faire », et revient d'elle-même quand il
 * réécrit (synchronisation des messages).
 *
 * Assistant (rien ne part sans l'équipe) : « Proposer une réponse » remplit
 * la zone de réponse avec la proposition de l'agent ; une réponse préparée
 * par l'agent (« à valider ») y est déjà ; « Traduire en … » passe le texte
 * de l'équipe dans la langue du voyageur ; « Voir en français » sous un
 * message étranger. L'envoi reste le bouton habituel.
 *
 * Suppléments (cahier B7) : quand le voyageur demande une arrivée plus tôt
 * ou un départ plus tard, la proposition prête (prix réglé, planning
 * vérifié) s'insère dans la zone de réponse ; les suppléments du logement
 * sont aussi dans la rangée des modèles. Rien n'est encaissé par l'ERP.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, CheckCheck, CheckCircle2, FileText, Hand, Image, Info, Languages, Link2, Loader2, Lock, RotateCcw, Send, Sparkles, Video, X } from 'lucide-react';
import { Alert, Avatar, Button, Drawer, IconButton, MenuActions, Textarea, cn, type ActionMenu } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { heure, horodatageMaintenant, jourMois } from '../../../data/format';
import type { FilMessages, Logement, Message, Reservation } from '../../../data/types';
import { DUREE_LIEN_GUIDE_S, guideEnvoyable } from '../../../data/guides';
import { lienPartage } from '../../../data/supabase';
import { espaceOuvert } from '../../../data/espaces';
import { signatureEspace } from '../../../data/marque-espace';
import type { GuideLogement } from '../../../data/types';
import { LIBELLE_INTENTION, dernierVoyageur, intentionFil, langueFil, langueMessage, marquerBrouillonValide, messagesSansReponse, nomLangue, type ValidationBrouillon } from '../../../data/messagerie-ia';
import { GABARITS, LIBELLE_MOTIF, attendEquipe, auteurAffiche, completudeFiche, eligibiliteCodes, memeSerie, motifEscalade, titreJour } from './logique';
import { PanneauContexte } from './PanneauContexte';
import { ErreurServeur, appelerServeur, nomPlateformeEnvoi } from './serveur';
import { AVIS_DEMO_TRADUCTION, demanderProposition, demanderTraductionMessage, demanderTraductionTexte, propositionDemo } from './assistant';
import { ICONES_SUPPLEMENTS, PropositionSupplement, usePropositionsSupplements, type PropositionPrete } from './PropositionSupplement';
import { LIBELLES_SUPPLEMENTS, type CleSupplement } from '../../../data/supplements';

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

/**
 * Bandeau au-dessus de la zone de réponse : réponse de l'agent (préparée ou
 * proposée à la demande), ou texte traduit dans la langue du voyageur.
 */
type Aide =
  | { genre: 'proposition'; source: ValidationBrouillon['source']; texte: string; texteFr?: string; attention?: string }
  | { genre: 'traduction'; nom: string }
  | { genre: 'supplement'; cle: CleSupplement; statut: PropositionPrete['disponibilite']['statut'] };

/** « Voir en français » d'un message : affiché ou non, texte, chargement. */
interface Traduction {
  voir: boolean;
  texte?: string;
  chargement?: boolean;
}

/** « de l’anglais », « du portugais ». */
const deLangue = (nom: string) => (/^[aeiouéèh]/i.test(nom) ? `de l’${nom}` : `du ${nom}`);

const messageErreur = (e: unknown) => (e instanceof ErreurServeur || e instanceof Error ? e.message : 'Votre agent ne répond pas pour l’instant : réessayez dans un instant.');

/** Sur ordinateur (souris, pavé tactile), Entrée envoie ; sur téléphone, elle va à la ligne. */
const ENTREE_ENVOIE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;
const HAUTEUR_MAX_SAISIE = 160;

export function Conversation({ fil, logement, reservation }: Props) {
  const { upsert, mode, lectureSeule, reglages, utilisateur } = useErp();
  // Réponses rapides signées comme l'agent de l'espace (Label Maison : « L’équipe Label Maison »).
  const signature = signatureEspace({ reglages }, espaceOuvert());
  // Réponse préparée par l'agent pour le dernier message du voyageur, pas encore envoyée : déjà dans la zone de réponse.
  const prepare = (() => {
    const b = fil.agent?.brouillon;
    return b && !b.valideePar && b.texte.trim() && messagesSansReponse(fil).some((m) => m.id === b.messageId) ? b : undefined;
  })();
  const aideDe = (b: NonNullable<typeof prepare>): Aide => ({
    genre: 'proposition',
    source: 'agent',
    texte: b.texte,
    texteFr: b.texteFr,
    ...(fil.statut === 'escalade' ? { attention: 'Sujet sensible : relisez bien avant d’envoyer.' } : {}),
  });
  const [brouillon, setBrouillon] = useState(() => prepare?.texte ?? '');
  const [aide, setAide] = useState<Aide | null>(() => (prepare ? aideDe(prepare) : null));
  // Texte de l'équipe remplacé par une proposition ou une traduction : « Rétablir mon texte ».
  const [precedent, setPrecedent] = useState<string | null>(null);
  const [voirFr, setVoirFr] = useState(false);
  const [iaEnCours, setIaEnCours] = useState<'proposition' | 'traduction' | null>(null);
  const [traductions, setTraductions] = useState<Record<string, Traduction>>({});
  const prerempli = useRef(prepare?.messageId);
  const [avis, setAvis] = useState<ReactNode>(null);
  // Vert pour une confirmation, ambre pour un point à surveiller (texte retouché, message à transmettre soi-même).
  const [avisAlerte, setAvisAlerte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envois, setEnvois] = useState<EnvoiLocal[]>([]);
  const [details, setDetails] = useState(false);
  // Conversation reliée à Airbnb, Booking.com... : la réponse part vraiment chez le voyageur.
  const relie = mode === 'reel' && !!fil.repull?.id;
  const plateforme = nomPlateformeEnvoi(fil.canal);
  const enCours = envois.some((e) => e.etat === 'envoi');
  const defile = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const codes = eligibiliteCodes(fil, reservation);
  const prenom = fil.voyageur.split(' ')[0];
  const attend = attendEquipe(fil);
  const suivieParAgent = fil.traitePar === 'agent' && fil.statut !== 'clos';
  // Langue du voyageur, si ce n'est pas le français : « Traduire en anglais », « Voir en français ».
  const langue = langueFil(fil);
  const nomLangueVoyageur = langue && langue !== 'fr' ? nomLangue(langue) : undefined;
  const intention = intentionFil(fil);
  const libelleIntention = intention ? LIBELLE_INTENTION[intention] : '';
  const assistant = !lectureSeule && !!dernierVoyageur(fil);
  // Suppléments : la demande du voyageur (s'il attend une réponse) et les propositions prêtes du logement.
  const { demande, propositions } = usePropositionsSupplements(fil, logement, reservation, prenom, signature);
  const propositionDemandee = demande ? propositions.find((x) => x.cle === demande) : undefined;
  // Le supplément demandé a déjà son bandeau : il n'est pas répété dans la rangée des modèles.
  const supplementsProposes = propositions.filter((x) => x.reglage.actif && x.texte && x.disponibilite.statut !== 'impossible' && x.cle !== propositionDemandee?.cle);

  // Une réponse préparée par l'agent arrive pendant qu'on regarde : elle remplit la zone si elle est vide.
  useEffect(() => {
    if (!prepare || prerempli.current === prepare.messageId) return;
    prerempli.current = prepare.messageId;
    if (brouillon.trim()) return;
    setBrouillon(prepare.texte);
    setAide(aideDe(prepare));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepare?.messageId]);

  // Le message envoyé est arrivé dans la conversation (temps réel) : la bulle provisoire s'efface.
  const connus = new Set(fil.messages.map((m) => m.id));
  const provisoires = envois.filter((e) => !e.message || !connus.has(e.message.id));

  // Sur le dernier message : à l'ouverture, à chaque nouveau message, et quand la
  // zone change de taille (fenêtre, panneau qui prend sa hauteur), sauf si l'on
  // est remonté lire plus haut.
  const enBas = useRef(true);
  useLayoutEffect(() => {
    const el = defile.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    enBas.current = true;
  }, [fil.messages.length, provisoires.length]);
  useEffect(() => {
    const el = defile.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const suivre = new ResizeObserver(() => {
      if (enBas.current) el.scrollTop = el.scrollHeight;
    });
    suivre.observe(el);
    return () => suivre.disconnect();
  }, []);

  // La zone de saisie grandit avec le texte, jusqu'à HAUTEUR_MAX_SAISIE.
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    z.style.height = 'auto';
    z.style.height = `${Math.min(z.scrollHeight + 2, HAUTEUR_MAX_SAISIE)}px`;
  }, [brouillon]);
  // Après chaque rendu (texte inséré, bandeau qui apparaît ou disparaît, avis) : si l'on était en bas, on y reste.
  // Fait avant l'affichage : l'événement de défilement qui suit voit la liste en bas (sinon elle restait décalée
  // de la hauteur gagnée par la zone de réponse).
  useLayoutEffect(() => {
    const el = defile.current;
    if (el && enBas.current) el.scrollTop = el.scrollHeight;
  });

  /** La réponse vient-elle de l'agent, et a-t-elle été retouchée ? (journal : qui l'a validée) */
  const validation = (texte: string): ValidationBrouillon | undefined =>
    aide?.genre === 'proposition' ? { source: aide.source, modifiee: texte.trim() !== aide.texte.trim() } : undefined;

  const envoyerPlateforme = async (texte: string) => {
    const cle = `${Date.now()}`;
    const valide = validation(texte);
    const aideAvant = aide;
    setEnvois((l) => [...l, { cle, texte, etat: 'envoi' }]);
    setBrouillon('');
    setAide(null);
    setPrecedent(null);
    setVoirFr(false);
    setErreur(null);
    setAvis(null);
    try {
      const r = await appelerServeur<ReponseEnvoi>('/api/erp-repull-messages', 'POST', { action: 'envoyer', filId: fil.id, texte, ...(valide ? { brouillon: valide } : {}) });
      setEnvois((l) => l.map((e) => (e.cle === cle ? { ...e, etat: 'envoye', message: r.message } : e)));
      // « Envoyé sur … » est déjà sous la bulle : on ne prévient que si la plateforme a modifié le texte.
      if (r.reecrit) {
        setAvis(r.info);
        setAvisAlerte(true);
      }
    } catch (e) {
      setEnvois((l) => l.filter((x) => x.cle !== cle));
      // Rien n'est parti : le texte revient dans la zone de saisie.
      setBrouillon((b) => (b.trim() ? b : texte));
      setAide((a) => a ?? aideAvant);
      setErreur(e instanceof ErreurServeur || e instanceof Error ? e.message : 'Le message n’est pas parti. Réessayez.');
    }
  };

  const envoyer = () => {
    const texte = brouillon.trim();
    if (!texte || enCours || (relie && lectureSeule)) return;
    if (relie) {
      void envoyerPlateforme(texte);
      return;
    }
    const envoyeLe = horodatageMaintenant();
    const valide = validation(texte);
    // Comme un envoi sur une plateforme : répondu, la conversation sort de « À répondre » et reste ouverte.
    const repondu: FilMessages = {
      ...fil,
      statut: 'ouvert',
      traitePar: 'humain',
      dernierMessageLe: envoyeLe,
      messages: [...fil.messages, { id: nouvelId('msg'), auteur: 'hote', texte, envoyeLe }],
    };
    upsert('filsMessages', valide?.source === 'agent' ? marquerBrouillonValide(repondu, utilisateur.nom, valide.modifiee, envoyeLe) : repondu);
    setBrouillon('');
    setAide(null);
    setPrecedent(null);
    setAvis(`${prenom} n’est pas relié à une plateforme : pensez à lui transmettre ce message (téléphone, e-mail…).`);
    setAvisAlerte(true);
  };

  /** Terminer sans répondre : la conversation sort de « À répondre » jusqu'au prochain message du voyageur. */
  const terminer = () => {
    upsert('filsMessages', { ...fil, statut: 'clos', traitePar: fil.traitePar === 'en_attente' ? 'humain' : fil.traitePar });
    setAvis(null);
  };
  // Rouvrir : sauf si l'équipe a écrit en dernier, la conversation revient dans « À répondre »
  // (le voyageur, ou l'agent qui disait transmettre, attend l'équipe).
  const rouvrir = () => {
    const equipeEnDernier = fil.messages[fil.messages.length - 1]?.auteur === 'hote';
    upsert('filsMessages', { ...fil, statut: 'ouvert', traitePar: !equipeEnDernier && fil.traitePar !== 'agent' ? 'en_attente' : fil.traitePar });
  };
  const confier = () => {
    upsert('filsMessages', { ...fil, statut: 'ouvert', traitePar: 'agent' });
    const fiche = completudeFiche(logement);
    setAvisAlerte(false);
    setAvis(
      <>
        Votre agent reprend la conversation.
        {logement && !fiche.complete && (
          <>
            {' '}Il répondra mieux avec les infos du logement :{' '}
            <Link to={`/erp/logements/${logement.id}?onglet=fiche`} className="font-medium text-(--lm-or-texte) underline-offset-2 hover:underline">
              les compléter
            </Link>
            .
          </>
        )}
      </>,
    );
  };

  /** « Proposer une réponse » : la proposition de l'agent remplit la zone de réponse (rien n'est envoyé). */
  const proposer = async () => {
    if (iaEnCours) return;
    setIaEnCours('proposition');
    setAvis(null);
    try {
      const p = mode === 'demo' ? propositionDemo(fil, logement, signature) : await demanderProposition(fil.id);
      const actuel = brouillon.trim();
      setPrecedent(actuel && !(aide?.genre === 'proposition' && actuel === aide.texte.trim()) ? brouillon : null);
      setBrouillon(p.texte);
      setAide({ genre: 'proposition', source: 'proposition', texte: p.texte, texteFr: p.texteFr, attention: p.attention });
      setVoirFr(false);
      zone.current?.focus();
    } catch (e) {
      setAvisAlerte(true);
      setAvis(messageErreur(e));
    } finally {
      setIaEnCours(null);
    }
  };

  /** « Traduire en … » : le texte de l'équipe, en français, passe dans la langue du voyageur (modifiable). */
  const traduire = async () => {
    const texte = brouillon.trim();
    if (!texte || !langue || !nomLangueVoyageur || iaEnCours) return;
    if (mode === 'demo') {
      setAvisAlerte(true);
      setAvis(AVIS_DEMO_TRADUCTION);
      return;
    }
    setIaEnCours('traduction');
    setAvis(null);
    try {
      const traduit = await demanderTraductionTexte(texte, langue);
      setPrecedent(brouillon);
      setBrouillon(traduit);
      setAide({ genre: 'traduction', nom: nomLangueVoyageur });
      zone.current?.focus();
    } catch (e) {
      setAvisAlerte(true);
      setAvis(messageErreur(e));
    } finally {
      setIaEnCours(null);
    }
  };

  const retablir = () => {
    if (precedent === null) return;
    setBrouillon(precedent);
    setPrecedent(null);
    setAide(null);
    setVoirFr(false);
    zone.current?.focus();
  };

  /** « Voir en français » sous un message du voyageur : traduction gardée sur le message après la première demande. */
  const basculerTraduction = async (m: Message) => {
    const t = traductions[m.id];
    if (t?.chargement) return;
    if (t?.voir) return setTraductions((x) => ({ ...x, [m.id]: { ...t, voir: false } }));
    const connue = t?.texte ?? m.traductionFr;
    if (connue) return setTraductions((x) => ({ ...x, [m.id]: { voir: true, texte: connue } }));
    if (mode === 'demo') {
      setAvisAlerte(true);
      setAvis(AVIS_DEMO_TRADUCTION);
      return;
    }
    setTraductions((x) => ({ ...x, [m.id]: { voir: false, chargement: true } }));
    try {
      const texte = await demanderTraductionMessage(fil.id, m.id);
      setTraductions((x) => ({ ...x, [m.id]: { voir: true, texte } }));
    } catch (e) {
      setTraductions((x) => ({ ...x, [m.id]: { voir: false } }));
      setAvisAlerte(true);
      setAvis(messageErreur(e));
    }
  };

  const inserer = (texte: string) => {
    setBrouillon((b) => (b.trim() ? `${b.trimEnd()}\n${texte}` : texte));
    zone.current?.focus();
  };

  /** Proposition de supplément : elle remplace le texte en cours (« Rétablir mon texte »), l'équipe relit et envoie. */
  const insererSupplement = (p: PropositionPrete) => {
    if (!p.texte) return;
    const texte = p.texte;
    const actuel = brouillon.trim();
    setPrecedent(actuel && actuel !== texte.trim() ? brouillon : null);
    setBrouillon(texte);
    setAide({ genre: 'supplement', cle: p.cle, statut: p.disponibilite.statut });
    setVoirFr(false);
    zone.current?.focus();
  };

  // Guides du logement : « Titre : lien » ; un fichier déposé part en lien signé de 7 jours.
  const guides = (logement?.fiche.guides ?? []).filter((g) => guideEnvoyable(g) || g.media.fichier?.startsWith('demo://'));
  const [guideEnCours, setGuideEnCours] = useState<string | null>(null);
  const insererGuide = async (g: GuideLogement) => {
    if (g.media.url) return inserer(`${g.titre} : ${g.media.url}`);
    if (!g.media.fichier || g.media.fichier.startsWith('demo://')) return inserer(`${g.titre} : (lien créé à l’envoi, démonstration)`);
    setGuideEnCours(g.id);
    const lien = await lienPartage(g.media.fichier, DUREE_LIEN_GUIDE_S);
    setGuideEnCours(null);
    if (lien) inserer(`${g.titre} : ${lien}`);
    else setErreur(`Le lien du guide « ${g.titre} » n’a pas pu être créé. Réessayez.`);
  };

  const infos = [
    logement?.nom,
    reservation ? `${jourMois(reservation.arrivee)} – ${jourMois(reservation.depart)}` : undefined,
    LIBELLES.canal[fil.canal],
  ].filter(Boolean);

  const confierAction: ActionMenu | false = !suivieParAgent && { libelle: 'Confier à votre agent', icone: <Bot />, onClick: confier };
  // « Pas besoin de répondre » et « Rouvrir » sont dans la zone de réponse ; ici, seulement le cas restant.
  const terminerAction: ActionMenu | false = !attend && fil.statut !== 'clos' && { libelle: 'Marquer comme terminée', icone: <CheckCheck />, onClick: terminer };

  const motif = fil.statut === 'escalade' ? motifEscalade(fil) : undefined;

  /** Message du voyageur dans une autre langue que le français : de quoi afficher « Voir en français ». */
  const traductionDe = (m: Message): (Traduction & { nom: string }) | undefined => {
    if (m.auteur !== 'voyageur') return undefined;
    const l = langueMessage(m, fil);
    const nom = l && l !== 'fr' ? nomLangue(l) : undefined;
    if (!nom) return undefined;
    const t = traductions[m.id];
    return { nom, voir: !!t?.voir, texte: t?.texte ?? m.traductionFr, chargement: t?.chargement };
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-(--lm-bord) px-2 sm:gap-3 sm:px-4">
        <Link
          to="/erp/messagerie"
          aria-label="Retour aux conversations"
          className="grid size-10 shrink-0 place-items-center rounded-lg text-(--lm-encre-2) hover:bg-(--lm-neutre-lavis) lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Avatar nom={fil.voyageur} taille="lg" className="max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-(--lm-encre)">{fil.voyageur}</h2>
          <p className="truncate text-[12.5px] text-(--lm-encre-3)">
            {/* Ce que demande le voyageur, lu par l'agent (ou deviné de son dernier message). */}
            {libelleIntention && <span className="font-medium text-(--lm-encre-2)">{libelleIntention} · </span>}
            {infos.join(' · ')}
          </p>
        </div>
        {!suivieParAgent && (
          <Button variant="secondary" icone={<Bot />} onClick={confier} className="max-sm:hidden">
            Confier à votre agent
          </Button>
        )}
        {/* Même allure que le menu « … » voisin : deux carrés de 36 px. */}
        <IconButton label="Séjour et logement" variant="secondary" onClick={() => setDetails(true)} className="min-[90rem]:hidden">
          <Info />
        </IconButton>
        {/* Mobile : « Confier à l'agent » rejoint le menu. */}
        <MenuActions label="Autres actions sur la conversation" actions={[confierAction, terminerAction]} className="sm:hidden" />
        <MenuActions label="Autres actions sur la conversation" actions={[terminerAction]} className="max-sm:hidden" />
      </header>

      {motif && (
        <div className="shrink-0 border-b border-(--lm-bord) bg-(--lm-alerte-lavis) px-4 py-2.5 text-[13px]">
          <p className="flex items-start gap-2 font-medium text-(--lm-encre)">
            <Hand className="mt-0.5 size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
            <span>
              Votre agent vous a passé la main : {LIBELLE_MOTIF[motif].titre.toLowerCase()}
              {/* Le résumé de l'agent dit ce que veut le voyageur. */}
              {fil.agent?.decision === 'transmettre' && fil.agent.resume && <span className="mt-0.5 block font-normal text-(--lm-encre-2)">{fil.agent.resume}</span>}
            </span>
          </p>
        </div>
      )}

      <div
        ref={defile}
        onScroll={(e) => {
          const el = e.currentTarget;
          enBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="lm-defilement min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        aria-live="polite"
      >
        <ol className="mx-auto flex max-w-3xl flex-col" aria-label={`Messages avec ${fil.voyageur}`}>
          {fil.messages.map((m, i) => {
            const prec = fil.messages[i - 1];
            const suiv = fil.messages[i + 1];
            const jour = m.envoyeLe.slice(0, 10);
            const nouveauJour = !prec || prec.envoyeLe.slice(0, 10) !== jour;
            // Une série = même signature (« Équipe », « Message automatique », « Réponse de votre agent ») le même jour.
            const suite = !nouveauJour && memeSerie(prec, m);
            // Auteur et heure sous la dernière bulle d'une série.
            const finSerie = !suiv || !memeSerie(suiv, m) || suiv.envoyeLe.slice(0, 10) !== jour;
            return (
              <li key={m.id}>
                {nouveauJour && <p className={cn('mb-1 text-center text-[12px] font-medium text-(--lm-encre-3) first-letter:uppercase', i > 0 && 'mt-6')}>{titreJour(jour)}</p>}
                <Bulle
                  message={m}
                  canal={fil.canal}
                  suite={suite}
                  finSerie={finSerie}
                  traduction={traductionDe(m)}
                  onTraduction={() => void basculerTraduction(m)}
                />
              </li>
            );
          })}
          {provisoires.map((e) => (
            <li key={e.cle} className="mt-3 flex flex-col items-end">
              <div className={cn('max-w-[85%] rounded-[18px] rounded-br-md bg-(--lm-brun) px-3.5 py-2 text-[14.5px] leading-snug text-white sm:max-w-[75%]', e.etat === 'envoi' && 'opacity-70')}>
                <p className="whitespace-pre-line">{e.message?.texte ?? e.texte}</p>
              </div>
              <p className="mt-1 flex items-center gap-1 px-1 text-[11.5px] text-(--lm-encre-3)">
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
            </li>
          ))}
        </ol>
      </div>

      <div className="shrink-0 border-t border-(--lm-bord) bg-(--lm-surface) px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto max-w-3xl space-y-2">
          {erreur && (
            <Alert tone="danger" titre="Le message n’est pas parti" className="py-2.5" actions={<Fermer onClick={() => setErreur(null)} />}>
              {erreur}
            </Alert>
          )}
          {avis && (
            <div role="status" className={cn('flex items-start gap-2 rounded-lg py-1 pr-1 pl-3 text-[13px] text-(--lm-encre)', avisAlerte ? 'bg-(--lm-alerte-lavis)' : 'bg-(--lm-succes-lavis)')}>
              {avisAlerte ? (
                <Info className="mt-1.5 size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-1.5 size-4 shrink-0 text-(--lm-succes)" aria-hidden />
              )}
              <p className="min-w-0 flex-1 py-1">{avis}</p>
              <Fermer onClick={() => setAvis(null)} />
            </div>
          )}

          {(attend || fil.statut === 'clos' || suivieParAgent) && (
            <div className="flex min-h-10 items-center gap-2 rounded-lg bg-(--lm-surface-2) py-1 pr-1 pl-3 text-[13px]">
              <p className="min-w-0 flex-1 text-(--lm-encre-2)">
                {attend ? (
                  <>
                    <strong className="font-medium text-(--lm-encre)">{prenom}</strong> attend votre réponse.
                  </>
                ) : fil.statut === 'clos' ? (
                  'Conversation terminée. Elle revient ici si le voyageur réécrit.'
                ) : (
                  'Votre agent suit cette conversation. Si vous répondez, vous reprenez la main.'
                )}
              </p>
              {attend && (
                <Button size="sm" variant="ghost" icone={<CheckCheck />} onClick={terminer} className="shrink-0">
                  Pas besoin de répondre
                </Button>
              )}
              {fil.statut === 'clos' && (
                <Button size="sm" variant="ghost" icone={<RotateCcw />} onClick={rouvrir} className="shrink-0">
                  Rouvrir
                </Button>
              )}
            </div>
          )}

          {/* Une fois la proposition insérée, le bandeau de la zone de réponse prend le relais : jamais deux bandeaux. */}
          {propositionDemandee && !lectureSeule && logement && aide?.genre !== 'supplement' && (
            <PropositionSupplement proposition={propositionDemandee} logementId={logement.id} onInserer={() => insererSupplement(propositionDemandee)} />
          )}

          <div className="lm-defilement -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0" role="group" aria-label="Aide à la réponse, modèles et guides">
            {assistant && (
              <>
                <button
                  type="button"
                  disabled={!!iaEnCours}
                  onClick={() => void proposer()}
                  title="Votre agent prépare une réponse : vous la relisez, puis vous l’envoyez"
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--lm-or-anneau) bg-(--lm-or-lavis) px-3 text-[12.5px] font-medium text-(--lm-brun) hover:border-(--lm-or) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {iaEnCours === 'proposition' ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Sparkles className="size-3 text-(--lm-or-texte)" aria-hidden />}
                  {iaEnCours === 'proposition' ? 'Préparation…' : 'Proposer une réponse'}
                </button>
                {/* Seulement quand l'équipe a écrit sa réponse (pas sur une proposition de l'agent, déjà dans la langue du voyageur). */}
                {nomLangueVoyageur &&
                  (iaEnCours === 'traduction' ||
                    (!!brouillon.trim() && !(aide?.genre === 'proposition' && brouillon.trim() === aide.texte.trim()) && !(aide?.genre === 'supplement' && langue === 'en'))) && (
                  <button
                    type="button"
                    disabled={!!iaEnCours}
                    onClick={() => void traduire()}
                    title={`Traduire votre réponse en ${nomLangueVoyageur} avant de l’envoyer`}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--lm-bord-fort) px-3 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {iaEnCours === 'traduction' ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Languages className="size-3" aria-hidden />}
                    Traduire en {nomLangueVoyageur}
                  </button>
                )}
                <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-(--lm-bord-fort)" />
              </>
            )}
            <span className="shrink-0 text-[12px] text-(--lm-encre-3)">Modèles</span>
            {GABARITS.map((g) => {
              const bloque = (g.sensible && !codes.autorise) || !logement;
              return (
                <button
                  key={g.cle}
                  type="button"
                  disabled={bloque}
                  onClick={() => logement && inserer(g.texte(logement, prenom, signature))}
                  title={bloque ? `Pas de codes d’accès pour ce voyageur (${codes.raison})` : `Insérer le modèle ${g.libelle}`}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--lm-bord-fort) px-3 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bloque && <Lock className="size-3" aria-hidden />}
                  {g.libelle}
                </button>
              );
            })}
            {guides.length > 0 && (
              <>
                <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-(--lm-bord-fort)" />
                <span className="shrink-0 text-[12px] text-(--lm-encre-3)">Guides</span>
                {guides.map((g) => {
                  const bloque = !!g.acces && !codes.autorise;
                  const Icone = { video: Video, photo: Image, document: FileText, lien: Link2 }[g.media.type];
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={bloque || guideEnCours === g.id}
                      onClick={() => void insererGuide(g)}
                      title={bloque ? `Guide d’accès : pas encore pour ce voyageur (${codes.raison})` : `Insérer le guide ${g.titre}`}
                      className="inline-flex h-8 max-w-[14rem] shrink-0 items-center gap-1 rounded-full border border-(--lm-bord-fort) px-3 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {guideEnCours === g.id ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      ) : bloque ? (
                        <Lock className="size-3" aria-hidden />
                      ) : (
                        <Icone className="size-3" aria-hidden />
                      )}
                      <span className="truncate">{g.titre}</span>
                    </button>
                  );
                })}
              </>
            )}
            {!lectureSeule && supplementsProposes.length > 0 && (
              <>
                <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-(--lm-bord-fort)" />
                <span className="shrink-0 text-[12px] text-(--lm-encre-3)">Suppléments</span>
                {supplementsProposes.map((x) => (
                  <button
                    key={x.cle}
                    type="button"
                    onClick={() => insererSupplement(x)}
                    title={`Proposer « ${LIBELLES_SUPPLEMENTS[x.cle].titre} » : ${x.disponibilite.constats.join(' ') || 'prix réglé pour ce logement'}`}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-(--lm-bord-fort) px-3 text-[12.5px] font-medium text-(--lm-encre-2) hover:border-(--lm-or) hover:text-(--lm-encre)"
                  >
                    {LIBELLES_SUPPLEMENTS[x.cle].titre}
                  </button>
                ))}
              </>
            )}
          </div>

          {aide && brouillon.trim() && (
            <div role="status" className="rounded-lg bg-(--lm-or-lavis) px-3 py-1 text-[12.5px]">
              <p className="flex flex-wrap items-center gap-x-2">
                {/* Icône et texte ensemble : à 390 px, l'icône ne reste jamais seule sur sa ligne. */}
                <span className="flex min-w-0 flex-1 items-start gap-2">
                  {(() => {
                    // Sparkles pour ce qui vient de l'IA ; l'icône du supplément pour une proposition de l'équipe.
                    const Icone = aide.genre === 'supplement' ? ICONES_SUPPLEMENTS[aide.cle] : Sparkles;
                    return <Icone className="mt-1.5 size-3.5 shrink-0 text-(--lm-or-texte)" aria-hidden />;
                  })()}
                  <span className="py-1 text-(--lm-encre)">
                    {aide.genre === 'traduction'
                      ? `Traduit en ${aide.nom} : relisez, puis envoyez.`
                      : aide.genre === 'supplement'
                        ? aide.statut === 'impossible'
                          ? `« ${LIBELLES_SUPPLEMENTS[aide.cle].titre} », pas possible ce jour-là : relisez la réponse, puis envoyez.`
                          : `« ${LIBELLES_SUPPLEMENTS[aide.cle].titre} »${aide.statut === 'a_verifier' ? ', à vérifier avec l’équipe ménage' : ''} : relisez, puis envoyez. L’ERP n’encaisse rien.`
                        : aide.source === 'agent'
                          ? 'Préparée par votre agent : relisez, puis envoyez.'
                          : 'Proposée par votre agent : relisez, puis envoyez.'}
                  </span>
                </span>
                {aide.genre === 'proposition' && aide.texteFr && (
                  <button type="button" onClick={() => setVoirFr((v) => !v)} aria-expanded={voirFr} className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
                    {voirFr ? 'Masquer le français' : 'Voir en français'}
                  </button>
                )}
                {precedent !== null && (
                  <button type="button" onClick={retablir} className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
                    Rétablir mon texte
                  </button>
                )}
              </p>
              {aide.genre === 'proposition' && aide.attention && <p className="pb-1.5 font-medium text-(--lm-alerte)">{aide.attention}</p>}
              {aide.genre === 'proposition' && voirFr && aide.texteFr && (
                <p className="lm-defilement mb-1.5 max-h-28 overflow-y-auto border-t border-(--lm-or-anneau) pt-1.5 whitespace-pre-line text-(--lm-encre-2)">{aide.texteFr}</p>
              )}
            </div>
          )}

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
              aria-keyshortcuts={ENTREE_ENVOIE ? 'Enter' : 'Control+Enter'}
              ref={zone}
              rows={1}
              value={brouillon}
              onChange={(e) => setBrouillon(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                if (e.metaKey || e.ctrlKey || (ENTREE_ENVOIE && !e.shiftKey)) {
                  e.preventDefault();
                  envoyer();
                }
              }}
              placeholder={relie ? `Répondre à ${prenom} sur ${plateforme}…` : `Écrire à ${prenom}…`}
              className="min-h-11 resize-none py-2.5"
              style={{ maxHeight: HAUTEUR_MAX_SAISIE }}
            />
            <Button
              type="submit"
              variant="primary"
              aria-label={enCours ? 'Envoi en cours' : 'Envoyer'}
              icone={enCours ? <Loader2 className="animate-spin" /> : <Send />}
              disabled={!brouillon.trim() || enCours || (relie && lectureSeule)}
              className="h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-4"
            >
              <span className="max-sm:hidden">{enCours ? 'Envoi…' : 'Envoyer'}</span>
            </Button>
          </form>
          <p className="text-[12px] text-(--lm-encre-3)">
            {relie ? (
              <>
                Part chez {prenom} sur <strong className="font-medium text-(--lm-encre-2)">{plateforme}</strong>.
              </>
            ) : (
              <>
                <strong className="font-medium text-(--lm-encre-2)">Gardé dans l’ERP</strong> : rien n’est envoyé au voyageur.
              </>
            )}
            {ENTREE_ENVOIE && <span className="max-lg:hidden"> Entrée pour envoyer, Maj + Entrée pour aller à la ligne.</span>}
          </p>
        </div>
      </div>

      <Drawer ouvert={details} onFermer={() => setDetails(false)} titre={fil.voyageur} sousTitre="Séjour et logement" largeur="md">
        <PanneauContexte fil={fil} logement={logement} reservation={reservation} enTiroir />
      </Drawer>
    </div>
  );
}

function Fermer({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Fermer" size="sm" onClick={onClick}>
      <X />
    </IconButton>
  );
}

/**
 * Bulle sans contour : voyageur à gauche, agent (or) et équipe (brun) à
 * droite ; auteur et heure dessous. Message du voyageur dans une autre
 * langue : « Voir en français » (la bulle montre alors la traduction).
 */
function Bulle({
  message: m,
  canal,
  suite,
  finSerie,
  traduction,
  onTraduction,
}: {
  message: Message;
  canal: string;
  suite: boolean;
  finSerie: boolean;
  traduction?: Traduction & { nom: string };
  onTraduction: () => void;
}) {
  const voyageur = m.auteur === 'voyageur';
  const envoye = !voyageur && (m.envoi || m.id.startsWith('repull-'));
  const traduit = !!traduction?.voir && !!traduction.texte;
  return (
    <div className={cn('flex flex-col', voyageur ? 'items-start' : 'items-end', suite ? 'mt-1' : 'mt-3')}>
      <div
        className={cn(
          'max-w-[85%] rounded-[18px] px-3.5 py-2 text-[14.5px] leading-snug sm:max-w-[75%]',
          voyageur ? 'bg-(--lm-bulle) text-(--lm-encre)' : m.auteur === 'agent' ? 'bg-(--lm-or-texte) text-white' : 'bg-(--lm-brun) text-white',
          finSerie && (voyageur ? 'rounded-bl-md' : 'rounded-br-md'),
        )}
      >
        <p className="break-words whitespace-pre-line" lang={traduit ? 'fr' : undefined}>
          {traduit ? traduction!.texte : m.texte}
        </p>
      </div>
      {traduction && (
        <button
          type="button"
          onClick={onTraduction}
          disabled={traduction.chargement}
          aria-pressed={traduit}
          className="-my-1 inline-flex min-h-8 items-center gap-1 px-1 text-[12px] font-medium text-(--lm-or-texte) hover:underline disabled:opacity-70"
        >
          {traduction.chargement ? (
            <>
              <Loader2 className="size-3 animate-spin" aria-hidden /> Traduction…
            </>
          ) : traduit ? (
            <>
              <span className="font-normal text-(--lm-encre-3)">Traduit {deLangue(traduction.nom)} ·</span> Voir l’original
            </>
          ) : (
            <>
              <Languages className="size-3" aria-hidden /> Voir en français
            </>
          )}
        </button>
      )}
      {finSerie && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 px-1 text-[11.5px] text-(--lm-encre-3)">
          {m.auteur === 'agent' && (
            <span className="inline-flex items-center gap-1 font-medium text-(--lm-or-texte)">
              <Bot className="size-3" aria-hidden /> {auteurAffiche(m)}
            </span>
          )}
          {m.auteur === 'hote' && <span className="font-medium">{auteurAffiche(m)}</span>}
          {envoye && (
            <span className="inline-flex items-center gap-0.5" title={m.envoi?.reecrit ? 'La plateforme a retiré un lien ou un numéro : le voyageur a reçu ce texte.' : undefined}>
              <CheckCheck className="size-3" aria-hidden /> Envoyé sur {nomPlateformeEnvoi(m.envoi?.canal ?? canal)}
            </span>
          )}
          <time dateTime={m.envoyeLe} className="lm-chiffres">
            {heure(m.envoyeLe)}
          </time>
        </p>
      )}
    </div>
  );
}
