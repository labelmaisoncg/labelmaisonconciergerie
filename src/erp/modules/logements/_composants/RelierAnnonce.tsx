/**
 * « Relier à une annonce » (fiche d'un logement créé à la main) : la liste
 * des annonces trouvées sur les plateformes connectées à l'espace, photo,
 * nom, ville et plateforme ; celles déjà dans l'ERP sont repliées et
 * grisées. Une annonce dans une autre commune que le logement est signalée
 * avant « Relier ». Relier ne change rien sur les plateformes : le
 * serveur pose le lien dans l'ERP puis ajoute l'annonce aux logements
 * suivis, et l'import met à jour CE logement (data/liaison-annonce.ts).
 *
 * « Délier » (repli Administratif) : seulement tant que rien de l'annonce
 * n'est arrivé sur le logement. Démo : tout se passe dans l'ERP local.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ImageOff, Link2, Plug, Unlink } from 'lucide-react';
import { MODE_DEMO } from '../../../data/config';
import { dateCourte, horodatageMaintenant, pluriel } from '../../../data/format';
import { delierLogement, delierPossible, depasseLimite, lierLogement, logementDeLAnnonce, peutRelier, relie, villesDifferentes } from '../../../data/liaison-annonce';
import type { AnnonceDecouverte, EtatConnexions, ResultatLiaison } from '../../../data/repull-connexion';
import { useErp } from '../../../data/store';
import type { Logement } from '../../../data/types';
import { Alert, Button, ButtonLink, EmptyState, Modal, Skeleton, cn } from '../../../ui';
import { ErreurConnexions, NOMS_PLATEFORMES, appelerConnexions, normaliserEtat } from './serveurConnexions';

const CONNEXIONS = '/erp/logements/connexions';
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ce qui arrive avec le lien, en une phrase. */
const CE_QUI_CHANGE = 'Le nom, les photos, la description et les réservations viendront de l’annonce ; le propriétaire, le mandat et vos réglages restent.';

function texteRelie(r: Pick<ResultatLiaison, 'reservations' | 'conversations' | 'partiel' | 'message'>): string {
  const arrivees = [r.reservations ? pluriel(r.reservations, 'réservation') : '', r.conversations ? pluriel(r.conversations, 'conversation') : ''].filter(Boolean);
  const n = r.reservations + r.conversations;
  const debut = arrivees.length ? `${arrivees.join(' et ')} ${n > 1 ? 'sont arrivées' : 'est arrivée'}.` : 'Les photos et la description de l’annonce arrivent sur ce logement.';
  if (r.partiel) return `${debut} ${r.message ?? 'La suite arrive au prochain passage, dans quelques minutes.'}`;
  return debut;
}

function Photo({ url }: { url?: string }) {
  const [casse, setCasse] = useState(false);
  if (url && !casse) return <img src={url} alt="" loading="lazy" onError={() => setCasse(true)} className="size-12 shrink-0 rounded-lg object-cover" />;
  return (
    <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre-3)">
      <ImageOff className="size-5" />
    </span>
  );
}

const plateformes = (a: AnnonceDecouverte) => a.plateformes.map((p) => NOMS_PLATEFORMES[p] ?? p.charAt(0).toUpperCase() + p.slice(1)).join(', ');

export function RelierAnnonce({ logement: l, ouvert, onFermer }: { logement: Logement; ouvert: boolean; onFermer: () => void }) {
  const d = useErp();
  const [etat, setEtat] = useState<EtatConnexions | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<{ texte: string; sansConnexion: boolean } | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  // Démo : annonces fictives d'après les logements du moment (lus à chaque ouverture).
  const logementsRef = useRef(d.logements);
  logementsRef.current = d.logements;

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      if (MODE_DEMO) {
        const { etatConnexionsDemo } = await import('../../../data/seed-connexions');
        setEtat(etatConnexionsDemo(logementsRef.current));
      } else {
        setEtat(normaliserEtat(await appelerConnexions<EtatConnexions>('GET', { action: 'etat' })));
      }
    } catch (e) {
      setEtat(null);
      setErreur({ texte: (e as Error).message, sansConnexion: e instanceof ErreurConnexions && e.code === 'sans_connexion' });
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    setChoisie(null);
    setEchec(null);
    setFait(null);
    void charger();
  }, [ouvert, charger]);

  const permis = peutRelier(d.utilisateur.role, d.lectureSeule);
  // Déjà dans l'ERP : relié à un logement de l'espace (importé ou relié à la main, même en pause).
  const logementLie = (a: AnnonceDecouverte) => logementDeLAnnonce(a.id, d.logements) ?? (a.logementId ? d.logements.find((x) => x.id === a.logementId) : undefined);
  const annonces = etat?.annonces ?? [];
  const libres = annonces.filter((a) => !logementLie(a) && !a.logementId);
  const prises = annonces.filter((a) => !!logementLie(a) || !!a.logementId);
  const sansPlateforme = !!erreur?.sansConnexion || (!!etat && !etat.connexions.length && !annonces.length);
  const horsOffre = !!choisie && !!etat && depasseLimite(etat.selection, choisie, etat.limite);
  const annonceChoisie = libres.find((x) => x.id === choisie);
  // Autre commune que le logement : un mot avant « Relier » (le bouton reste actif).
  const autreVille = annonceChoisie && villesDifferentes(annonceChoisie.ville, l.ville) ? annonceChoisie.ville : undefined;
  const annonceDuPied = envoi ? 'Import en cours : photos, réservations, messages… Cela peut prendre jusqu’à une minute.' : annonceChoisie && !horsOffre ? CE_QUI_CHANGE : '';

  const relier = async () => {
    const a = annonceChoisie;
    if (!a || !permis || horsOffre) return;
    setEnvoi(true);
    setEchec(null);
    try {
      if (MODE_DEMO) {
        await pause(600);
        // Démo : le lien et ce que l'import apporterait (nom et photo de l'annonce), dans l'ERP local seulement.
        const lie = lierLogement(l, a.id, { le: horodatageMaintenant(), par: d.utilisateur.email });
        const annonces = a.plateformes.filter((p): p is 'airbnb' | 'booking' => p === 'airbnb' || p === 'booking').map((canal) => ({ canal, connecte: true }));
        d.upsert('logements', { ...lie, nom: a.nom, annonces, ...(a.photo ? { photoUrl: a.photo, photos: [a.photo] } : {}) });
        setFait(texteRelie({ reservations: 0, conversations: 0, partiel: false }));
        return;
      }
      const r = await appelerConnexions<ResultatLiaison>('POST', {}, { action: 'relier', logement: l.id, annonce: a.id });
      setFait(texteRelie(r));
      // Les lignes arrivent par le temps réel : on laisse le temps, puis on crée les ménages.
      window.setTimeout(() => d.lancerAutomatisations(), 3000);
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  const pied = fait ? (
    <Button variant="primary" onClick={onFermer}>
      Fermer
    </Button>
  ) : etat && libres.length > 0 ? (
    <>
      {autreVille && !envoi && (
        <p role="note" className="flex w-full items-start gap-2 text-[13px] text-(--lm-encre)">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-(--lm-alerte)" aria-hidden />
          <span>
            L’annonce est à {autreVille}, le logement à {l.ville}&nbsp;: vérifiez que c’est le bon.
          </span>
        </p>
      )}
      {/* Toujours là (vide au départ) : un lecteur d'écran annonce ce qui change. */}
      <p aria-live="polite" className={annonceDuPied ? 'mb-1 w-full text-[13px] text-(--lm-encre-2)' : 'sr-only'}>
        {annonceDuPied}
      </p>
      <Button variant="ghost" onClick={onFermer} disabled={envoi}>
        Annuler
      </Button>
      <Button variant="primary" icone={<Link2 />} chargement={envoi} disabled={!permis || !choisie || horsOffre} onClick={() => void relier()}>
        Relier
      </Button>
    </>
  ) : (
    <Button onClick={onFermer}>Fermer</Button>
  );

  return (
    <Modal
      ouvert={ouvert}
      onFermer={() => !envoi && onFermer()}
      titre="Relier à une annonce"
      description={fait || sansPlateforme || erreur ? undefined : `Choisissez l’annonce de « ${l.nom} ».`}
      pied={pied}
    >
      {fait ? (
        <Alert tone="succes" titre="C’est relié.">
          {fait}
        </Alert>
      ) : chargement && !etat ? (
        <ul aria-label="Chargement des annonces" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton className="h-[70px] rounded-xl" />
            </li>
          ))}
        </ul>
      ) : sansPlateforme ? (
        <EmptyState
          icone={<Plug />}
          titre="Aucune plateforme connectée dans cet espace"
          description="Connectez Airbnb ou Booking.com : vos annonces apparaîtront ici."
          action={
            <ButtonLink to={CONNEXIONS} variant="primary" icone={<Plug />}>
              Connecter Airbnb, Booking…
            </ButtonLink>
          }
        />
      ) : erreur ? (
        <Alert tone="danger" titre="Impossible de lire vos annonces" actions={<Button size="sm" onClick={() => void charger()}>Réessayer</Button>} actionsDessous>
          {erreur.texte}
        </Alert>
      ) : !annonces.length ? (
        <EmptyState
          icone={<Plug />}
          titre="Aucune annonce trouvée sur vos plateformes"
          action={
            <ButtonLink to={CONNEXIONS} icone={<Plug />}>
              Voir les connexions
            </ButtonLink>
          }
        />
      ) : (
        <>
          <fieldset disabled={envoi || !permis}>
            <legend className="sr-only">Annonces trouvées sur vos plateformes</legend>
            <ul className="flex flex-col gap-2">
              {libres.map((a) => {
                const coche = choisie === a.id;
                return (
                  <li key={a.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border bg-(--lm-surface) p-2.5 transition-colors',
                        coche ? 'border-(--lm-or) ring-1 ring-(--lm-or-anneau)' : 'border-(--lm-bord) hover:shadow-(--lm-ombre-haute) transition',
                      )}
                    >
                      <input type="radio" name="annonce" value={a.id} checked={coche} onChange={() => setChoisie(a.id)} className="size-4 shrink-0 accent-(--lm-or)" />
                      <Photo url={a.photo} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{a.nom}</span>
                        <span className="block truncate text-[12.5px] text-(--lm-encre-2)">{[a.ville, plateformes(a)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {!libres.length && <p className="text-[13px] text-(--lm-encre-2)">Toutes vos annonces sont déjà dans l’ERP.</p>}
          {horsOffre && (
            <Alert tone="alerte" className="mt-4">
              Votre offre permet {pluriel(etat!.limite ?? 0, 'logement suivi', 'logements suivis')}, déjà tous pris : retirez-en un dans Connexions pour relier celui-ci.
            </Alert>
          )}
          {echec && (
            <Alert tone="danger" className="mt-4">
              {echec}
            </Alert>
          )}
          {prises.length > 0 && (
            // Annonces déjà dans l'ERP : repliées (souvent nombreuses), avec la marche à suivre en cas de doublon.
            <details open={!libres.length} className="mt-3 text-[13px] text-(--lm-encre-2)">
              <summary className="inline-flex min-h-8 cursor-pointer items-center font-medium lm-lien">
                Déjà dans l’ERP ({prises.length})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {prises.map((a) => {
                  const nom = logementLie(a)?.nom;
                  const autreNom = nom && nom.trim().toLowerCase() !== a.nom.trim().toLowerCase() ? nom : undefined;
                  return (
                    <li key={a.id} aria-disabled="true" className="flex items-center gap-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface-2) p-2.5">
                      <span className="opacity-60">
                        <Photo url={a.photo} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-(--lm-encre-2)">{a.nom}</span>
                        <span className="block truncate text-[12.5px] text-(--lm-encre-2)">
                          {[autreNom ? `Dans l’ERP : « ${autreNom} »` : '', a.ville, plateformes(a)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3">
                Votre annonce y est déjà ? Gardez le logement importé, qui a ses réservations et ses messages : ouvrez-le, choisissez le propriétaire avec « Modifier », ajoutez
                son mandat, puis passez « {l.nom} » en « Sorti ». Rien n’est supprimé.
              </p>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}

/**
 * Repli « Administratif » : depuis quand le logement est relié, et
 * « Délier » tant que rien de l'annonce n'y est arrivé (lien fait par
 * erreur). Gérant seulement.
 */
export function LienAnnonce({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [confirmer, setConfirmer] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState<string | null>(null);
  if (!l.liaison || !relie(l) || l.liaison.annonce !== l.repull?.id) return null;
  const possible = peutRelier(d.utilisateur.role, d.lectureSeule) && delierPossible(l, d.reservations, d.filsMessages).ok;

  const delier = async () => {
    setEnvoi(true);
    setEchec(null);
    try {
      if (MODE_DEMO) {
        await pause(400);
        d.upsert('logements', delierLogement(l));
      } else {
        await appelerConnexions('POST', {}, { action: 'delier', logement: l.id });
      }
      setConfirmer(false);
    } catch (e) {
      setEchec((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-(--lm-bord) pt-3">
      <p className="text-[13px] text-(--lm-encre-2)">Relié à son annonce le {dateCourte(l.liaison.le.slice(0, 10))}.</p>
      {possible && (
        <Button size="sm" variant="ghost" icone={<Unlink />} onClick={() => setConfirmer(true)}>
          Délier
        </Button>
      )}
      <Modal
        ouvert={confirmer}
        onFermer={() => !envoi && setConfirmer(false)}
        taille="sm"
        titre="Délier ce logement ?"
        description="Il reprend son nom, ses photos et ses infos d’avant le lien ; vos changements depuis restent. L’annonce n’est plus suivie : cochez-la dans Connexions pour l’ajouter comme un logement à part."
        pied={
          <>
            <Button variant="ghost" onClick={() => setConfirmer(false)} disabled={envoi}>
              Annuler
            </Button>
            <Button variant="danger" icone={<Unlink />} chargement={envoi} onClick={() => void delier()}>
              Délier
            </Button>
          </>
        }
      >
        {echec ? (
          <Alert tone="danger">{echec}</Alert>
        ) : undefined}
      </Modal>
    </div>
  );
}
