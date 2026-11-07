/**
 * Les connexions d'un logement : une ligne par plateforme (Airbnb,
 * Booking.com) dans la fiche, et « Relier l'annonce Booking.com » (ou
 * Airbnb) quand elle manque, pas à pas (kit ui/Assistant.tsx) : le choix de
 * l'annonce, le récapitulatif de ce qui vient avec, « Relier ».
 *
 * Pour le gérant, c'est UN logement avec deux connexions : si l'annonce
 * choisie avait déjà été importée comme logement à part, ses réservations,
 * conversations, ménages… rejoignent ce logement, et l'autre disparaît de
 * la liste. Le logement gardé est celui depuis lequel on relie. Rien n'est
 * écrit sur les plateformes ; le serveur revérifie tout sous le verrou de
 * la synchronisation (data/annonces-liees.ts, api/erp-repull-connexion.ts,
 * « relier-connexion »). Ce lien ne se retire pas ensuite : l'écran le dit
 * avant « Relier ». Démo : tout se passe dans l'ERP local
 * (relierConnexionLocale).
 *
 * La suggestion discrète (« Cette annonce Booking.com semble être celle de
 * ce logement ») n'apparaît que si c'est fiable : même adresse ou noms qui
 * se recouvrent nettement, un seul candidat (suggestionPour).
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, ExternalLink, ImageOff, Link2, Plug, X } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import {
  NOM_CANAL,
  accueilleCanal,
  annoncesProposees,
  autreCanal,
  canalApporte,
  canauxPrincipaux,
  ceQuiRejoint,
  liees,
  peutRelierConnexion,
  phraseCeQuiRejoint,
  suggestionPour,
  type AnnonceProposee,
  type CanalPlateforme,
} from '../../../data/annonces-liees';
import { relie, villesDifferentes } from '../../../data/liaison-annonce';
import type { EtatConnexions, ResultatConnexion } from '../../../data/repull-connexion';
import { useErp } from '../../../data/store';
import type { Canal, Logement } from '../../../data/types';
import { Alert, Assistant, Badge, Button, ButtonLink, Card, CardHeader, EmptyState, IconButton, Modal, NBSP, RecapAssistant, Skeleton, clavierChoix, cn, entreeChoix, insecables, useParcours } from '../../../ui';
import { ErreurConnexions, appelerConnexions, normaliserEtat } from './serveurConnexions';

const CONNEXIONS = '/erp/logements/connexions';
const NOMS: Record<Canal, string> = { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'Site direct' };
// Zone de toucher de 32 px (44 au toucher) ; les marges négatives gardent la hauteur de la ligne.
const LIEN = '-my-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-medium lm-lien max-sm:min-h-11';

/* ------------------------------------------------------------ chargement */

/** Annonces des plateformes de l'espace (démo : d'après les logements du moment). */
export async function lireEtatConnexions(logements: readonly Logement[]): Promise<EtatConnexions> {
  if (MODE_DEMO) {
    const { etatConnexionsDemo } = await import('../../../data/seed-connexions');
    return etatConnexionsDemo(logements);
  }
  return normaliserEtat(await appelerConnexions<EtatConnexions>('GET', { action: 'etat' }));
}

/* ------------------------------------------------------------ assistant */

type EcranConnexion = 'annonce' | 'recapitulatif';
const ECRANS: readonly EcranConnexion[] = ['annonce', 'recapitulatif'];
const SANS_CHAMP = new Set(['annonce']);
const idChamp = (cle: string) => `assistant-connexion-${cle}`;

function Vignette({ url }: { url?: string }) {
  const [casse, setCasse] = useState(false);
  if (url && !casse) return <img src={url} alt="" loading="lazy" onError={() => setCasse(true)} className="size-12 shrink-0 rounded-lg object-cover" />;
  return (
    <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre-3)">
      <ImageOff className="size-5" />
    </span>
  );
}

/** Ligne secondaire d'une annonce proposée : sa commune, et le logement à part qui la porte s'il a un autre nom. */
function detailAnnonce(p: AnnonceProposee): string {
  const autreNom = p.logement && p.logement.nom.trim().toLowerCase() !== p.annonce.nom.trim().toLowerCase() ? `Dans l’ERP${NBSP}: « ${p.logement.nom} »` : '';
  const pourquoi = p.niveau === 'forte' ? (p.raison === 'adresse' ? 'Même adresse' : 'Nom très proche') : '';
  return [pourquoi, autreNom, p.annonce.ville ?? ''].filter(Boolean).join(' · ');
}

/** Annonces à choisir, en lignes avec leur photo (choix exclusif, flèches du clavier comme ChoixListe). */
function ChoixAnnonce({ options, valeur, onChange, onContinuer, labelledBy }: { options: AnnonceProposee[]; valeur?: string; onChange: (id: string) => void; onContinuer: () => void; labelledBy: string }) {
  const valeurs = options.map((o) => o.annonce.id);
  const choisi = valeurs.includes(valeur ?? '') ? valeur : undefined;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={clavierChoix(valeurs, choisi, onChange)}
      className="divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord-fort)"
    >
      {options.map((o, i) => {
        const actif = o.annonce.id === choisi;
        return (
          <button
            key={o.annonce.id}
            id={i === 0 ? idChamp('annonce') : undefined}
            type="button"
            role="radio"
            aria-checked={actif}
            tabIndex={actif || (!choisi && i === 0) ? 0 : -1}
            onClick={() => onChange(o.annonce.id)}
            onKeyDown={entreeChoix(actif, () => onChange(o.annonce.id), onContinuer)}
            className={cn('flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:-outline-offset-2', actif ? 'bg-(--lm-or-lavis)' : 'hover:bg-(--lm-surface-2)')}
          >
            <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', actif ? 'border-(--lm-or-texte) bg-(--lm-or-texte)' : 'border-(--lm-encre-3)')}>
              {actif && <span className="size-2 rounded-full bg-(--lm-surface)" />}
            </span>
            <Vignette url={o.annonce.photo} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[15px] break-words text-(--lm-encre)">{o.annonce.nom}</span>
              {detailAnnonce(o) && <span className="line-clamp-2 block text-[12.5px] break-words text-(--lm-encre-3)">{insecables(detailAnnonce(o))}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface PropsAssistantConnexion {
  /** Le logement gardé : celui depuis lequel on relie. */
  logement: Logement;
  canal: CanalPlateforme;
  /** Annonce déjà choisie (suggestion) : cochée d'office, l'écran reste à confirmer. */
  preselection?: string;
  /** État déjà lu (page Connexions) : rien à relire. */
  etat?: EtatConnexions | null;
  onFermer: () => void;
  /** Après « Relier » réussi (page Connexions : relire l'état). */
  onRelie?: () => void;
}

/**
 * « Relier l'annonce Booking.com » : quelle annonce, ce qui vient avec, «
 * Relier ». À monter à chaque ouverture (`{ouvert && <…/>}`).
 */
export function AssistantConnexion({ logement: l, canal, preselection, etat: etatInitial, onFermer, onRelie }: PropsAssistantConnexion) {
  const d = useErp();
  const [etat, setEtat] = useState<EtatConnexions | null>(etatInitial ?? null);
  const [chargement, setChargement] = useState(!etatInitial);
  const [erreurLecture, setErreurLecture] = useState<{ texte: string; sansConnexion: boolean } | null>(null);
  const [choisie, setChoisie] = useState<string | undefined>(preselection);
  const depart = useRef(preselection);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const [fait, setFait] = useState<{ phrase: string; retire?: string } | null>(null);
  const titreId = useId();
  const p = useParcours<EcranConnexion>({ ecrans: ECRANS, idChamp, sansChamp: SANS_CHAMP });
  const logementsRef = useRef(d.logements);
  logementsRef.current = d.logements;

  const charger = useCallback(async () => {
    setChargement(true);
    setErreurLecture(null);
    try {
      setEtat(await lireEtatConnexions(logementsRef.current));
    } catch (e) {
      setErreurLecture({ texte: (e as Error).message, sansConnexion: e instanceof ErreurConnexions && e.code === 'sans_connexion' });
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => {
    if (!etatInitial) void charger();
  }, [etatInitial, charger]);

  const nom = NOM_CANAL[canal];
  // Plateforme de l'annonce principale ; inconnue (aucun canal) : celle qu'on ne relie pas.
  const principal = canauxPrincipaux(l)[0] ?? autreCanal(canal);
  const proposees = annoncesProposees(l, canal, etat?.annonces ?? [], d.logements);
  const choisissables = proposees.filter((x) => !x.bloquee);
  const bloquees = proposees.filter((x) => x.bloquee);
  const choix = choisissables.find((x) => x.annonce.id === choisie);
  const erreurs: Record<string, string> = p.ecran === 'annonce' && !choix ? { annonce: `Choisissez l’annonce ${nom}.` } : {};
  const blocage = p.etat(erreurs);
  const phrase = choix?.logement ? phraseCeQuiRejoint(ceQuiRejoint(choix.logement, d.donnees)) : '';
  const autreVille = choix && villesDifferentes(choix.logement?.ville ?? choix.annonce.ville, l.ville) ? choix.logement?.ville ?? choix.annonce.ville : undefined;

  const relier = async () => {
    if (!choix || envoi) return;
    setEnvoi(true);
    setErreurEnvoi(undefined);
    try {
      if (MODE_DEMO) {
        await new Promise((r) => setTimeout(r, 500));
        const r = d.relierConnexionLocale(l.id, { ...choix.annonce, ...(choix.logement ? { logementId: choix.logement.id } : {}) });
        if (!r.ok) throw new Error(r.erreur);
        setFait({ phrase: r.phrase, retire: r.retire?.nom });
      } else {
        const r = await appelerConnexions<ResultatConnexion>('POST', {}, { action: 'relier-connexion', logement: l.id, annonce: choix.annonce.id });
        setFait({ phrase: r.phrase, retire: r.retire?.nom });
      }
      onRelie?.();
    } catch (e) {
      setErreurEnvoi((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };
  const continuer = () => p.continuer(erreurs, () => void relier());

  if (fait) {
    return (
      <Modal
        ouvert
        onFermer={onFermer}
        taille="sm"
        titre="C’est relié"
        pied={
          <Button variant="primary" onClick={onFermer}>
            Terminé
          </Button>
        }
      >
        <p className="text-[14px] text-(--lm-encre)">{insecables(`« ${l.nom} » a maintenant ses deux connexions${NBSP}: ${NOMS[principal]} et ${nom}.`)}</p>
        {(fait.phrase || fait.retire) && (
          <p className="mt-2 text-[13.5px] text-(--lm-encre-2)">
            {insecables([fait.phrase, fait.retire ? `« ${fait.retire} » ne figure plus dans la liste des logements.` : ''].filter(Boolean).join(' '))}
          </p>
        )}
      </Modal>
    );
  }

  const sansAnnonce = !chargement && !erreurLecture && !proposees.length;
  const question = p.ecran === 'annonce' ? `Quelle est l’annonce ${nom} de ce logement${NBSP}?` : `Relier cette annonce à « ${l.nom} »${NBSP}?`;
  const aide = p.ecran === 'annonce' ? `Ses réservations et ses messages arriveront sur « ${l.nom} ».` : undefined;

  return (
    <Assistant
      titre={`Relier l’annonce ${nom}`}
      ecrans={ECRANS}
      ecran={p.ecran}
      question={question}
      aide={aide}
      idQuestion={titreId}
      blocage={blocage}
      libelleSuite={p.libelleSuite('Relier')}
      onContinuer={continuer}
      onRetour={p.retour}
      sansSuite={chargement || !!erreurLecture || sansAnnonce}
      saisi={choisie !== depart.current}
      abandon={`Abandonner${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {p.ecran === 'annonce' &&
        (chargement ? (
          <ul aria-label="Chargement des annonces" className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-16 rounded-xl" />
              </li>
            ))}
          </ul>
        ) : erreurLecture ? (
          erreurLecture.sansConnexion ? (
            <EmptyState
              icone={<Plug />}
              titre={`${nom} n’est pas connecté à cet espace`}
              action={
                <ButtonLink to={CONNEXIONS} icone={<Plug />}>
                  Voir les connexions
                </ButtonLink>
              }
            />
          ) : (
            <Alert tone="danger" titre="Impossible de lire vos annonces" actions={<Button size="sm" onClick={() => void charger()}>Réessayer</Button>} actionsDessous>
              {erreurLecture.texte}
            </Alert>
          )
        ) : sansAnnonce ? (
          <EmptyState
            icone={<Plug />}
            titre={`Aucune annonce ${nom} à relier`}
            description={`Connectez ${nom} ou cochez l’annonce dans Connexions${NBSP}: elle apparaîtra ici.`}
            action={
              <ButtonLink to={CONNEXIONS} icone={<Plug />}>
                Voir les connexions
              </ButtonLink>
            }
          />
        ) : (
          <>
            {choisissables.length > 0 ? (
              <ChoixAnnonce options={choisissables} valeur={choisie} onChange={setChoisie} onContinuer={continuer} labelledBy={titreId} />
            ) : (
              <p className="text-[14px] text-(--lm-encre-2)">{insecables(`Aucune annonce ${nom} ne peut être reliée tout de suite.`)}</p>
            )}
            {bloquees.length > 0 && (
              <details open={!choisissables.length} className="mt-4 text-[13px] text-(--lm-encre-2)">
                <summary className="inline-flex min-h-8 cursor-pointer items-center font-medium lm-lien max-sm:min-h-11">
                  {bloquees.length > 1 ? `${bloquees.length} autres annonces` : 'Une autre annonce'}
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {bloquees.map((x) => (
                    <li key={x.annonce.id} aria-disabled="true" className="flex items-center gap-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-2.5">
                      <span className="opacity-60">
                        <Vignette url={x.annonce.photo} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-(--lm-encre-2)">{x.annonce.nom}</span>
                        <span className="block text-[12.5px] text-(--lm-encre-2)">{insecables(x.bloquee ?? '')}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ))}
      {p.ecran === 'recapitulatif' && choix && (
        <>
          {/* Avant le récapitulatif : visible sans défiler, même sur un petit téléphone. */}
          <Alert tone="alerte" className="mb-4" titre="Ce lien ne se défait pas">
            {insecables(`Il ne restera qu’un logement, « ${l.nom} », avec ses deux connexions. Vérifiez que c’est bien le même appartement.`)}
          </Alert>
        <RecapAssistant
          lignes={[
            { cle: 'garde', libelle: 'Logement gardé', valeur: `« ${l.nom} »\nNom, photos et prix de son annonce ${NOMS[principal]}` },
            { cle: 'annonce', libelle: `Annonce ${nom}`, valeur: choix.annonce.nom, onModifier: () => p.modifier('annonce') },
            {
              cle: 'avec',
              libelle: 'Ce qui vient avec',
              valeur: choix.logement
                ? [phrase || 'Rien d’autre pour l’instant.', `Le logement importé de ${nom}, « ${choix.logement.nom} », ne figurera plus dans la liste${NBSP}: tout sera sur « ${l.nom} ».`].join('\n')
                : `Ses réservations et ses messages arriveront sur « ${l.nom} ».`,
            },
          ]}
        >
          {autreVille && (
            <p role="note" className="mt-4 flex items-start gap-2 text-[13.5px] text-(--lm-encre)">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
              <span>{insecables(`L’annonce est à ${autreVille}, ce logement à ${l.ville}${NBSP}: vérifiez que c’est le même appartement.`)}</span>
            </p>
          )}
          {erreurEnvoi && (
            <Alert tone="danger" className="mt-4">
              {erreurEnvoi}
            </Alert>
          )}
        </RecapAssistant>
        </>
      )}
    </Assistant>
  );
}

/* ------------------------------------------------------------ fiche : carte Connexions */

/**
 * Bloc « Connexions » de la fiche : une ligne par plateforme. L'annonce
 * reliée (son nom quand c'est une annonce d'une autre plateforme, « En
 * ligne », « Voir ») ou « Relier l'annonce Booking.com ». Un logement fait à
 * la main, pas encore relié : « Relier à son annonce » (data/liaison-annonce.ts).
 * Un lien Airbnb saisi par l'équipe (pas une annonce reliée) se retire.
 */
export function CarteConnexions({ logement: l, enPlus }: { logement: Logement; enPlus?: ReactNode }) {
  const d = useErp();
  const [relier, setRelier] = useState<CanalPlateforme | null>(null);
  const gerant = peutRelierConnexion(d.utilisateur.role, d.lectureSeule);
  const avecAnnonce = relie(l);
  const reliees = liees(l);
  const principaux = canauxPrincipaux(l);
  const plateformes: Canal[] = ['airbnb', 'booking', ...(l.annonces.some((a) => a.canal === 'direct' && (a.connecte || a.url)) ? (['direct'] as const) : [])];

  // Fait à la main, pas encore relié, rien de saisi : une seule ligne (l'action est en haut de la fiche, « Relier à une annonce »).
  const pasEncoreRelie = !avecAnnonce && !l.annonces.some((a) => a.connecte || a.url);

  return (
    <Card>
      <CardHeader titre="Connexions" />
      {gerant && <LiensATerminer logement={l} />}
      {pasEncoreRelie ? (
        <p className="text-[13.5px] text-(--lm-encre-2)">Pas encore relié à une annonce.</p>
      ) : (
      <ul className="divide-y divide-(--lm-bord)">
        {plateformes.map((canal) => {
          const a = l.annonces.find((x) => x.canal === canal);
          const liee = canal !== 'direct' ? reliees.find((x) => x.canal === canal) : undefined;
          const principale = canal !== 'direct' && principaux.includes(canal);
          // Lien Airbnb saisi par l'équipe (pas une annonce reliée) : « Lien ajouté », on peut le retirer.
          const saisi = canal === 'airbnb' && !!a && !a.connecte && !!a.url && !principale && !liee && !(l.repull?.canaux ?? []).some((c) => /airbnb/i.test(c.plateforme));
          const reliee = !!a && (principale || !!liee || (avecAnnonce && a.connecte) || canal === 'direct');
          const peutRelier = canal !== 'direct' && !reliee && !saisi && gerant && l.statut !== 'sorti';
          const secondaire = liee?.nom ? `« ${liee.nom} »` : principale && reliees.length ? `Annonce principale${NBSP}: nom, photos et prix` : '';
          return (
            <li key={canal} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-(--lm-encre)">{NOMS[canal]}</p>
                {reliee || saisi ? (
                  secondaire && <p className="line-clamp-2 text-[12.5px] break-words text-(--lm-encre-2)">{insecables(secondaire)}</p>
                ) : peutRelier && avecAnnonce && accueilleCanal(l, canal) ? (
                  <button type="button" onClick={() => setRelier(canal)} className={cn(LIEN, 'mt-0.5')}>
                    Relier l’annonce {NOMS[canal]} <ArrowRight className="size-3.5" aria-hidden />
                  </button>
                ) : (
                  <p className="text-[12.5px] text-(--lm-encre-2)">Pas encore reliée</p>
                )}
              </div>
              {(reliee || saisi) && a && (
                <span className="flex shrink-0 items-center gap-1">
                  {saisi ? <span className="text-[12.5px] text-(--lm-encre-2)">Lien ajouté</span> : <Badge tone={a.connecte ? 'succes' : 'neutre'}>{a.connecte ? 'En ligne' : 'Hors ligne'}</Badge>}
                  {a.url && /^https:\/\//.test(a.url) && (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className={cn(LIEN, 'ml-1')} aria-label={`Voir l’annonce ${NOMS[canal]}`}>
                      Voir <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                  {saisi && !d.lectureSeule && (
                    <IconButton label="Retirer le lien Airbnb" size="sm" onClick={() => d.upsert('logements', { ...l, annonces: l.annonces.filter((x) => x !== a) })}>
                      <X />
                    </IconButton>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      )}
      {enPlus}
      {relier && <AssistantConnexion logement={l} canal={relier} onFermer={() => setRelier(null)} />}
    </Card>
  );
}

/* ------------------------------------------------------------ lien interrompu */

/**
 * Lien interrompu (coupure, conflit d'écriture) : l'annonce est reliée à ce
 * logement, mais l'autre logement est encore dans la liste avec une partie
 * de ce qu'il porte. « Terminer le lien » reprend l'opération là où elle en
 * était (le serveur revérifie tout, data/annonces-liees.ts).
 */
function LiensATerminer({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string>();
  const enCours = liees(l)
    .map((x) => ({ liee: x, autre: d.logements.find((o) => o.id !== l.id && String(o.repull?.id ?? '') === String(x.id)) }))
    .filter((x): x is { liee: (typeof x)['liee']; autre: Logement } => !!x.autre);
  if (!enCours.length) return null;
  const { liee, autre } = enCours[0];
  const terminer = async () => {
    if (envoi) return;
    setEnvoi(true);
    setErreur(undefined);
    try {
      if (MODE_DEMO) {
        const r = d.relierConnexionLocale(l.id, { id: String(liee.id), nom: liee.nom ?? autre.nom, plateformes: [liee.canal], logementId: autre.id });
        if (!r.ok) throw new Error(r.erreur);
      } else {
        await appelerConnexions<ResultatConnexion>('POST', {}, { action: 'relier-connexion', logement: l.id, annonce: String(liee.id) });
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Alert
      tone="alerte"
      className="mb-3"
      titre={insecables(`Le lien avec « ${autre.nom} » n’est pas terminé`)}
      actions={
        <Button size="sm" chargement={envoi} onClick={() => void terminer()}>
          Terminer le lien
        </Button>
      }
      actionsDessous
    >
      {insecables(erreur ?? `Une partie de ce qu’il porte (ménages, linge…) est encore sur « ${autre.nom} ». Terminer le lien l’amène ici.`)}
    </Alert>
  );
}

/* ------------------------------------------------------------ suggestion discrète */

const cleMasquee = (a: string, b: string) => `lm-connexion-masquee:${[a, b].sort().join('|')}`;
/** Suggestion masquée sur cet appareil (fiche ou page Connexions : le même « non »). */
export function masquee(a: string, b: string): boolean {
  try {
    return localStorage.getItem(cleMasquee(a, b)) === '1';
  } catch {
    return false;
  }
}
/** Masque la suggestion de cette paire sur cet appareil. */
export function masquerSuggestion(a: string, b: string): void {
  try {
    localStorage.setItem(cleMasquee(a, b), '1');
  } catch {
    /* préférence de cet appareil seulement */
  }
}

/**
 * En haut de la fiche, pour le gérant : « Cette annonce Booking.com semble
 * être celle de ce logement », seulement si c'est fiable (un seul candidat,
 * même adresse ou noms très proches). « Relier » ouvre l'assistant, l'annonce
 * déjà choisie ; la croix la masque sur cet appareil.
 */
export function SuggestionConnexion({ logement: l }: { logement: Logement }) {
  const d = useErp();
  // L'assistant reste ouvert après « Relier » (la suggestion, elle, n'a plus lieu d'être).
  const [ouvert, setOuvert] = useState<{ canal: CanalPlateforme; annonce: string } | null>(null);
  const [cachee, setCachee] = useState(false);
  const autre = peutRelierConnexion(d.utilisateur.role, d.lectureSeule) ? suggestionPour(l, d.logements) : undefined;
  const canal = autre ? canalApporte(l, autre) : null;
  const visible = !!autre && !!canal && !!autre.repull?.id && !cachee && !masquee(l.id, autre.id);
  const masquer = () => {
    if (!autre) return;
    masquerSuggestion(l.id, autre.id);
    setCachee(true);
  };
  return (
    <>
      {visible && autre && canal && (
        <div className="mb-4 flex items-center gap-x-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface) py-1.5 pr-1.5 pl-4">
          <Link2 className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          <p className="min-w-0 flex-1 py-1 text-[13.5px] text-(--lm-encre-2)">
            {insecables(`Cette annonce ${NOM_CANAL[canal]} semble être celle de ce logement${NBSP}: « ${autre.nom} ».`)}{' '}
            <button
              type="button"
              onClick={() => setOuvert({ canal, annonce: String(autre.repull!.id) })}
              aria-label={`Relier l’annonce « ${autre.nom} » à ce logement`}
              className="inline-flex min-h-8 items-center gap-1 align-middle text-[13px] font-medium lm-lien max-sm:min-h-11"
            >
              Relier <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </p>
          <IconButton label="Masquer cette suggestion" size="sm" onClick={masquer} className="max-sm:size-11">
            <X />
          </IconButton>
        </div>
      )}
      {ouvert && <AssistantConnexion logement={l} canal={ouvert.canal} preselection={ouvert.annonce} onFermer={() => setOuvert(null)} />}
    </>
  );
}
