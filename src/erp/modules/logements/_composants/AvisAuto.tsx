/**
 * Publication automatique des avis (octobre 2026, comme Smoobu), dans
 * Logements → Avis : les deux réglages du gérant (éteints par défaut), et
 * « À valider » — avis sur les voyageurs gardés (séjour sensible) et
 * réponses gardées (avis pas positif), avec « Publier », « Modifier »,
 * « Ne pas publier » / « Ne pas répondre ».
 *
 * « Publier » passe par le serveur (api/_erp-avis.ts : gérant seulement,
 * avis relu chez la plateforme, jamais deux fois, tracé dans « Actions de
 * l'IA »). En démonstration, rien ne part : la publication est simulée.
 * Règles : src/erp/data/avis-auto.ts.
 */
import { useMemo, useState } from 'react';
import { ChevronRight, Send, Star } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Drawer, Interrupteur, Modal, Textarea } from '../../../ui';
import { useErp, type ErpContexte } from '../../../data/store';
import { AUJOURDHUI, dateCourte, horodatageMaintenant, note as noteFr, pluriel } from '../../../data/format';
import { problemesReponse, separerAvis } from '../../../data/avis';
import {
  COLLECTION_REPONSES_AVIS,
  EXPLICATIONS_AVIS_AUTO,
  NOTE_AVIS_AUTO,
  avecAvisAuto,
  avisAValider,
  problemesTexteAvis,
  reglagesAvisAuto,
  type ElementAValider,
} from '../../../data/avis-auto';
import { actionPublicationAvis } from '../../../data/copilote';
import { espaceOuvert } from '../../../data/espaces';
import { reglagesProgrammes } from '../../../data/messages-programmes';
import type { ReglagesAvisAuto } from '../../../data/types-programmes';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';

const NOMS: Record<string, string> = { airbnb: 'Airbnb', booking: 'Booking.com' };
const nomPlateforme = (canal: string) => NOMS[canal] ?? 'la plateforme';

/* ------------------------------------------------------------ actions */

/**
 * Publie un avis gardé « à valider » avec le texte du gérant. Démo : rien ne
 * part, la ligne passe « publiée » et la trace est ajoutée, comme en vrai.
 */
export async function publierAvisValide(d: ErpContexte, genre: ElementAValider['genre'], reservationId: string, texte: string): Promise<string> {
  const t = texte.trim();
  if (d.demo) {
    const le = horodatageMaintenant();
    const r = d.reservations.find((x) => x.id === reservationId);
    if (genre === 'voyageur') {
      const ligne = d.avisADeposer.find((a) => a.id === reservationId);
      if (!ligne?.publication) throw new Error('Cet avis n’attend plus votre accord.');
      const modifie = t !== (ligne.publication.texte ?? '').trim();
      d.upsert('avisADeposer', {
        ...ligne,
        statut: 'fait',
        texte: t,
        traiteLe: le,
        traitePar: d.utilisateur.nom,
        publication: { ...ligne.publication, statut: 'publie', texte: t, le, publieLe: le, par: d.utilisateur.nom, ...(modifie ? { modifie: true } : {}) },
      });
      if (r) d.upsert('actionsAgent', actionPublicationAvis({ genre, reservation: r, plateforme: 'Airbnb', texte: t, le, espace: espaceOuvert().id, par: d.utilisateur.email, modifie, note: NOTE_AVIS_AUTO }));
      return 'Démonstration : rien n’est parti, l’avis serait publié sur Airbnb.';
    }
    const ligne = d.reponsesAvis.find((x) => x.id === reservationId);
    if (!ligne) throw new Error('Cette réponse n’attend plus votre accord.');
    const modifie = t !== (ligne.publication.texte ?? '').trim();
    d.upsert('reponsesAvis', { ...ligne, publication: { ...ligne.publication, statut: 'publie', texte: t, le, publieLe: le, par: d.utilisateur.nom, ...(modifie ? { modifie: true } : {}) } });
    if (r) d.upsert('actionsAgent', actionPublicationAvis({ genre, reservation: r, plateforme: nomPlateforme(ligne.canal), texte: t, le, espace: espaceOuvert().id, par: d.utilisateur.email, modifie }));
    return `Démonstration : rien n’est parti, la réponse serait publiée sur ${nomPlateforme(ligne.canal)}.`;
  }
  const res = await appelerServeur<{ message: string }>('/api/erp-agent', 'POST', { action: 'avis_publier', genre, reservationId, texte: t });
  // La ligne vient du serveur : relue et posée telle quelle (sans être réécrite).
  await d.relire(genre === 'voyageur' ? 'avisADeposer' : COLLECTION_REPONSES_AVIS, reservationId);
  return res.message;
}

/** « Ne pas publier » / « Ne pas répondre » : rien ne part, la décision reste notée. */
export function refuserAvis(d: ErpContexte, genre: ElementAValider['genre'], reservationId: string): void {
  const le = horodatageMaintenant();
  if (genre === 'voyageur') {
    const ligne = d.avisADeposer.find((a) => a.id === reservationId);
    if (!ligne?.publication) return;
    d.upsert('avisADeposer', { ...ligne, statut: 'passe', traiteLe: le, traitePar: d.utilisateur.nom, publication: { ...ligne.publication, statut: 'refuse', le, par: d.utilisateur.nom } });
    return;
  }
  const ligne = d.reponsesAvis.find((x) => x.id === reservationId);
  if (ligne) d.upsert('reponsesAvis', { ...ligne, publication: { ...ligne.publication, statut: 'refuse', le, par: d.utilisateur.nom } });
}

/** Annuler « Ne pas publier » : l'avis revient « à valider » (tant que le délai le permet). */
export function rouvrirAvis(d: ErpContexte, genre: ElementAValider['genre'], reservationId: string): void {
  const le = horodatageMaintenant();
  if (genre === 'voyageur') {
    const ligne = d.avisADeposer.find((a) => a.id === reservationId);
    if (!ligne?.publication) return;
    const { traiteLe: _t, traitePar: _p, ...reste } = ligne;
    d.upsert('avisADeposer', { ...reste, statut: 'a_relire', publication: { ...ligne.publication, statut: 'a_valider', le } });
    return;
  }
  const ligne = d.reponsesAvis.find((x) => x.id === reservationId);
  if (ligne) d.upsert('reponsesAvis', { ...ligne, publication: { ...ligne.publication, statut: 'a_valider', le } });
}

/* ----------------------------------------------------------- réglages */

/**
 * Les deux réglages (gérant) : un interrupteur et une phrase chacun.
 * Allumer demande une confirmation (ce qui est publié ne se retire pas).
 */
export function ReglagesAvisAutoCarte({ className }: { className?: string }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const reglages = useMemo(() => reglagesAvisAuto(d), [d]);
  const [allumer, setAllumer] = useState<keyof ReglagesAvisAuto | null>(null);
  if (!gerant) return null;

  const enregistrer = (cle: keyof ReglagesAvisAuto, actif: boolean) => {
    d.upsert('reglages', avecAvisAuto(reglagesProgrammes(d), cle, actif, { par: d.utilisateur.nom, le: horodatageMaintenant() }));
  };
  const cles: (keyof ReglagesAvisAuto)[] = ['voyageurs', 'reponses'];

  return (
    <Card flush className={className}>
      <ul className="divide-y divide-(--lm-bord)">
        {cles.map((cle) => (
          <li key={cle} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p id={`avis-auto-${cle}`} className="text-[14px] font-semibold text-(--lm-encre)">
                {EXPLICATIONS_AVIS_AUTO[cle].titre}
              </p>
              <p className="mt-0.5 text-[12.5px] text-(--lm-encre-2)">{EXPLICATIONS_AVIS_AUTO[cle].phrase}</p>
            </div>
            <span className="mt-0.5">
              <Interrupteur
                actif={reglages[cle].actif}
                label={`${reglages[cle].actif ? 'Éteindre' : 'Allumer'} « ${EXPLICATIONS_AVIS_AUTO[cle].titre} »`}
                onChange={(v) => (v ? setAllumer(cle) : enregistrer(cle, false))}
              />
            </span>
          </li>
        ))}
      </ul>
      <Modal
        ouvert={!!allumer}
        onFermer={() => setAllumer(null)}
        taille="sm"
        titre={allumer === 'voyageurs' ? 'Publier automatiquement les avis sur les voyageurs\u00a0?' : 'Publier automatiquement les réponses aux avis\u00a0?'}
        description={
          allumer === 'voyageurs'
            ? 'Deux jours après chaque départ Airbnb, votre agent publie un avis 5 étoiles sur le voyageur. Un séjour avec un incident, une plainte ou un litige attend votre accord. Un avis publié ne se modifie plus.'
            : 'Sous chaque avis positif sur Airbnb et Booking.com, votre agent publie une réponse. Un avis mitigé ou négatif attend votre accord. Une réponse publiée ne se reprend pas.'
        }
        pied={
          <>
            <Button variant="ghost" onClick={() => setAllumer(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (allumer) enregistrer(allumer, true);
                setAllumer(null);
              }}
            >
              Allumer
            </Button>
          </>
        }
      />
    </Card>
  );
}

/* --------------------------------------------------------- à valider */

/** « Daniel · Incident pendant le séjour · encore 6 j » : une ligne secondaire. */
function detail(e: ElementAValider, logement?: string): string {
  const raison = e.raisons[0]?.replace(/\s*:\s*à vérifier$/, '');
  if (e.genre === 'voyageur') return [raison, logement, e.joursRestants !== undefined ? `encore ${e.joursRestants} j` : ''].filter(Boolean).join(' · ');
  return [e.note !== undefined ? `${noteFr(e.note)} sur 5` : '', raison, nomPlateforme(e.canal)].filter(Boolean).join(' · ');
}

/** « À valider » : ce qui attend l'accord du gérant avant d'être publié (rien si la liste est vide). */
export function CarteAValider({ className }: { className?: string }) {
  const d = useErp();
  const liste = useMemo(() => avisAValider(d, AUJOURDHUI), [d]);
  // L'élément ouvert est gardé tel quel : une fois publié, il quitte la liste, le panneau dit « publié ».
  const [choisi, setChoisi] = useState<ElementAValider | null>(null);
  const noms = useMemo(() => new Map(d.logements.map((l) => [l.id, l.nom])), [d.logements]);
  if (d.utilisateur.role !== 'gerant') return null;
  const panneau = choisi ? <PanneauAValider key={`${choisi.genre}-${choisi.reservationId}`} element={choisi} onFermer={() => setChoisi(null)} /> : null;
  // Le dernier vient d'être publié : plus de carte, le panneau dit « publié ».
  if (!liste.length) return panneau;
  return (
    <Card flush className={className}>
      <div className="p-4 pb-0 sm:p-5 sm:pb-0">
        <CardHeader
          titre="À valider"
          description="Rien n’est publié sans votre accord."
          actions={
            <Badge tone="alerte">
              <span className="lm-chiffres">{liste.length}</span>
              <span className="sr-only"> à valider</span>
            </Badge>
          }
        />
      </div>
      <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
        {liste.map((e) => (
          <li key={`${e.genre}-${e.reservationId}`}>
            <button
              type="button"
              onClick={() => setChoisi(e)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">{e.genre === 'voyageur' ? `Avis sur ${e.voyageur}` : `Réponse à ${e.voyageur}`}</span>
                <span className="mt-0.5 block truncate text-[12px] text-(--lm-encre-2)">{detail(e, noms.get(e.logementId))}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {panneau}
    </Card>
  );
}

/**
 * Un avis à valider : pourquoi il attend, le texte (modifiable), puis
 * « Publier » ou « Ne pas publier » / « Ne pas répondre ».
 */
export function PanneauAValider({ element: e, onFermer }: { element: ElementAValider; onFermer: () => void }) {
  const d = useErp();
  const r = d.reservations.find((x) => x.id === e.reservationId);
  const logement = d.logements.find((l) => l.id === e.logementId);
  const voyageur = e.genre === 'voyageur';
  const [texte, setTexte] = useState(e.texte);
  const [edition, setEdition] = useState(voyageur || !e.texte.trim());
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState<string | null>(null);
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const prive = r ? separerAvis(r.commentaireVoyageur).prive : '';
  const problemes = texte.trim()
    ? voyageur
      ? problemesTexteAvis(texte, { nomVoyageur: r?.voyageur.nom, ...(logement ? { logement } : {}) })
      : problemesReponse(texte, { nomVoyageur: r?.voyageur.nom, textePrive: prive, ...(logement ? { logement } : {}) })
    : [];

  const publier = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      setFait(await publierAvisValide(d, e.genre, e.reservationId, texte));
    } catch (x) {
      setErreur(x instanceof ErreurServeur || x instanceof Error ? x.message : 'La publication n’a pas abouti : réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  };

  const sousTitre = [logement?.nom, r ? `séjour terminé le ${dateCourte(r.depart)}` : '', nomPlateforme(e.canal)].filter(Boolean).join(' · ');
  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={voyageur ? `Avis sur ${e.voyageur}` : `Réponse à ${e.voyageur}`}
      sousTitre={sousTitre}
      pied={
        fait ? (
          <Button variant="primary" onClick={onFermer}>
            OK
          </Button>
        ) : gerant ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                refuserAvis(d, e.genre, e.reservationId);
                onFermer();
              }}
            >
              {voyageur ? 'Ne pas publier' : 'Ne pas répondre'}
            </Button>
            {!voyageur && !edition && (
              <Button variant="secondary" onClick={() => setEdition(true)}>
                Modifier
              </Button>
            )}
            <Button variant="primary" icone={<Send />} chargement={enCours} disabled={!texte.trim() || problemes.length > 0} onClick={() => void publier()}>
              Publier
            </Button>
          </>
        ) : undefined
      }
    >
      {fait ? (
        <Alert tone="succes" titre={voyageur ? 'Avis publié' : 'Réponse publiée'}>
          {fait}
        </Alert>
      ) : (
        <>
          {e.raisons.length > 0 && (
            <Alert tone="alerte" titre="Pourquoi il attend votre accord">
              <ul>
                {e.raisons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Alert>
          )}

          {!voyageur && e.avis && (
            <section className="mt-4" aria-label="Avis du voyageur">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-semibold text-(--lm-encre)">L’avis de {e.voyageur}</h3>
                {e.note !== undefined && (
                  <Badge tone="neutre" icone={<Star />}>
                    {noteFr(e.note)} sur 5
                  </Badge>
                )}
              </div>
              <blockquote className="mt-2 border-l-2 border-(--lm-or) pl-3 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre)">{e.avis}</blockquote>
            </section>
          )}

          <section className="mt-4" aria-label={voyageur ? 'Avis à publier' : 'Réponse à publier'}>
            <h3 className="text-[13px] font-semibold text-(--lm-encre)">{voyageur ? 'Votre avis, 5 étoiles' : 'Votre réponse'}</h3>
            {edition ? (
              <Textarea
                aria-label={voyageur ? 'Texte de l’avis' : 'Texte de la réponse'}
                rows={voyageur ? 5 : 8}
                value={texte}
                disabled={!gerant}
                placeholder={voyageur ? 'Un avis neutre et factuel.' : undefined}
                onChange={(x) => setTexte(x.target.value)}
                className="mt-2"
              />
            ) : (
              <p className="mt-2 rounded-lg bg-(--lm-surface-2) p-3 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre)">{texte}</p>
            )}
            {problemes.length > 0 && (
              <Alert tone="alerte" titre="À retirer avant de publier" className="mt-3">
                Le texte contient {problemes.join(', ')}.
              </Alert>
            )}
            <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">
              {gerant
                ? voyageur
                  ? `Publié sur Airbnb avec 5 étoiles${e.joursRestants !== undefined ? `, encore ${pluriel(e.joursRestants, 'jour')} pour le faire` : ''}. Un avis publié ne se modifie plus.`
                  : `Publiée sous l’avis, sur ${nomPlateforme(e.canal)}. Une réponse publiée ne se reprend pas.`
                : 'Seul le gérant publie cet avis.'}
            </p>
          </section>
          {erreur && (
            <Alert tone="danger" className="mt-3">
              {erreur}
            </Alert>
          )}
        </>
      )}
    </Drawer>
  );
}
