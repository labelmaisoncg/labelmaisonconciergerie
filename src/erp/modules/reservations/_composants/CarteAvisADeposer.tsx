/**
 * « Votre avis sur le voyageur » d'un séjour Airbnb terminé : le texte préparé
 * (par l'IA du serveur, ou un texte simple), à copier puis coller sur
 * Airbnb. « Ouvrir Airbnb » est un simple lien. Ensuite « C’est fait » ou
 * « Passer ». Un séjour avec incident, note basse ou message négatif est
 * « à relire », jamais présenté comme prêt, et jamais prérempli d'un éloge :
 * sans texte sûr, le champ est vide et une ligne dit pourquoi l'écrire
 * soi-même (etatAvis, aide).
 *
 * Publication automatique allumée par le gérant (Logements → Avis,
 * avis-auto.ts) : la carte dit quand l'avis part seul, « Publié le … » une
 * fois en ligne, ou propose « Publier » / « Ne pas publier » pour un séjour
 * gardé « à valider ». Si la plateforme refuse, la carte habituelle revient.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, ExternalLink, Send } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Textarea, classesBouton, type Ton } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, dateCourte, horodatageMaintenant, jourMois, pluriel } from '../../../data/format';
import { LIEN_AIRBNB_HOTE, etatAvis, prenomDe } from '../../../data/messages-programmes';
import { PAR_PUBLICATION_AUTO, avisADeposerEquipe, etatPublicationVoyageur, problemesTexteAvis, reglagesAvisAuto, type EtatPublicationVoyageur } from '../../../data/avis-auto';
import { ErreurServeur } from '../../messagerie/_composants/serveur';
import { publierAvisValide, refuserAvis, rouvrirAvis } from '../../logements/_composants/AvisAuto';
import type { Reservation } from '../../../data/types';
import type { AvisADeposer, StatutAvisADeposer } from '../../../data/types-programmes';

const BADGES: Record<StatutAvisADeposer, { libelle: string; ton: Ton }> = {
  a_rediger: { libelle: 'À déposer', ton: 'or' },
  pret: { libelle: 'Prêt', ton: 'or' },
  a_relire: { libelle: 'À relire', ton: 'alerte' },
  fait: { libelle: 'Déposé', ton: 'succes' },
  passe: { libelle: 'Passé', ton: 'neutre' },
};

const BADGES_AUTO: Record<Exclude<EtatPublicationVoyageur['genre'], 'echec'>, { libelle: string; ton: Ton }> = {
  prevue: { libelle: 'Automatique', ton: 'or' },
  a_valider: { libelle: 'À valider', ton: 'alerte' },
  en_cours: { libelle: 'En cours', ton: 'or' },
  publiee: { libelle: 'Publié', ton: 'succes' },
  refusee: { libelle: 'Pas publié', ton: 'neutre' },
  expiree: { libelle: 'Délai passé', ton: 'neutre' },
};

/** « 24 sept. » cette année, « 24 sept. 2025 » sinon. */
const jour = (iso: string) => (iso.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois : dateCourte)(iso.slice(0, 10));
/** Un seul point en fin de phrase (« le 24 sept. » ne prend pas un second point). */
const point = (s: string) => (s.endsWith('.') ? s : `${s}.`);

export function CarteAvisADeposer({ r }: { r: Reservation }) {
  const d = useErp();
  const etat = etatAvis(d, r, AUJOURDHUI);
  const avisLigne = d.avisADeposer.find((a) => a.id === r.id);
  const auto = etatPublicationVoyageur(r, avisLigne, AUJOURDHUI, reglagesAvisAuto(d), d);
  if (auto && auto.genre !== 'echec') return <CarteAvisAuto r={r} etat={auto} />;
  return <CarteAvisManuel r={r} etat={etat} erreurAuto={auto?.genre === 'echec' ? auto.erreur : undefined} />;
}

/* ------------------------------------------- publication automatique */

function CarteAvisAuto({ r, etat }: { r: Reservation; etat: Exclude<EtatPublicationVoyageur, { genre: 'echec' }> }) {
  const d = useErp();
  const gerant = d.utilisateur.role === 'gerant' && !d.lectureSeule;
  const badge = BADGES_AUTO[etat.genre];
  const logement = d.logements.find((l) => l.id === r.logementId);
  const propose = etat.genre === 'a_valider' ? (etat.publication.texte ?? '') : '';
  const [texte, setTexte] = useState(propose);
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ ton: 'succes' | 'danger'; texte: string } | null>(null);
  const problemes = etat.genre === 'a_valider' && texte.trim() ? problemesTexteAvis(texte, { nomVoyageur: r.voyageur.nom, ...(logement ? { logement } : {}) }) : [];

  const publier = async () => {
    if (enCours) return;
    setEnCours(true);
    setRetour(null);
    try {
      setRetour({ ton: 'succes', texte: await publierAvisValide(d, 'voyageur', r.id, texte) });
    } catch (e) {
      setRetour({ ton: 'danger', texte: e instanceof ErreurServeur || e instanceof Error ? e.message : 'La publication n’a pas abouti : réessayez dans un instant.' });
    } finally {
      setEnCours(false);
    }
  };

  const qui = (par?: string) => (par && par !== PAR_PUBLICATION_AUTO ? ` par ${par}` : '');

  return (
    <Card id="avis">
      <CardHeader titre="Votre avis sur le voyageur" actions={<Badge tone={badge.ton}>{badge.libelle}</Badge>} />
      {etat.genre === 'prevue' && (
        <p className="text-[13.5px] text-(--lm-encre)">
          {etat.raisons.length
            ? `Ce séjour attendra votre accord avant publication : ${etat.raisons[0].charAt(0).toLowerCase()}${etat.raisons[0].slice(1)}.`
            : `Publié seul sur Airbnb le ${jour(etat.le)}, avec 5 étoiles.`}
        </p>
      )}
      {etat.genre === 'en_cours' && <p className="text-[13.5px] text-(--lm-encre)">Publication en cours sur Airbnb.</p>}
      {etat.genre === 'expiree' && <p className="text-[13.5px] text-(--lm-encre)">Le délai d’Airbnb est passé : l’avis n’a pas été publié.</p>}
      {etat.genre === 'publiee' && (
        <>
          <p className="text-[13.5px] text-(--lm-encre)">
            {etat.publication.deja
              ? 'Déjà déposé sur Airbnb.'
              : `Publié sur Airbnb le ${jour(etat.publication.publieLe ?? etat.publication.le)}, 5 étoiles${qui(etat.publication.par)}.`}
          </p>
          {etat.publication.texte && (
            <blockquote className="mt-2 border-l-2 border-(--lm-or) pl-3 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre-2)">{etat.publication.texte}</blockquote>
          )}
        </>
      )}
      {etat.genre === 'refusee' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-[13.5px] text-(--lm-encre)">
            {point(`Pas publié${qui(etat.publication.par)} le ${jour(etat.publication.le)}`)}
          </p>
          {gerant && (etatAvis(d, r, AUJOURDHUI)?.joursRestants ?? 0) > 0 && (
            <button type="button" onClick={() => rouvrirAvis(d, 'voyageur', r.id)} className="inline-flex min-h-8 items-center text-[13px] text-(--lm-encre-2) hover:text-(--lm-encre) hover:underline">
              Annuler
            </button>
          )}
        </div>
      )}
      {etat.genre === 'a_valider' &&
        (retour?.ton === 'succes' ? (
          <Alert tone="succes">{retour.texte}</Alert>
        ) : (
          <>
            {etat.publication.raisons && etat.publication.raisons.length > 0 && (
              <Alert tone="alerte" titre="Votre accord avant publication" className="mb-3">
                <ul>
                  {etat.publication.raisons.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <Textarea aria-label="Texte de l’avis" rows={4} value={texte} disabled={!gerant} placeholder="Un avis neutre et factuel." onChange={(e) => setTexte(e.target.value)} />
            {problemes.length > 0 && (
              <Alert tone="alerte" titre="À retirer avant de publier" className="mt-3">
                Le texte contient {problemes.join(', ')}.
              </Alert>
            )}
            {gerant ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button icone={<Send />} chargement={enCours} disabled={!texte.trim() || problemes.length > 0} onClick={() => void publier()}>
                  Publier
                </Button>
                <Button variant="ghost" onClick={() => refuserAvis(d, 'voyageur', r.id)}>
                  Ne pas publier
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-(--lm-encre-2)">Le gérant valide cet avis avant sa publication.</p>
            )}
            {retour?.ton === 'danger' && (
              <Alert tone="danger" className="mt-3">
                {retour.texte}
              </Alert>
            )}
          </>
        ))}
    </Card>
  );
}

/* ------------------------------------------------------- à la main */

function CarteAvisManuel({ r, etat, erreurAuto }: { r: Reservation; etat: ReturnType<typeof etatAvis>; erreurAuto?: string }) {
  const d = useErp();
  // Texte préparé (il suit le serveur) tant que l'équipe ne l'a pas retouché.
  const [retouche, setTexte] = useState<string | null>(null);
  const texte = retouche ?? etat?.texte ?? '';
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);

  if (!etat) return null;
  const traite = etat.statut === 'fait' || etat.statut === 'passe';
  const badge = BADGES[etat.statut];
  const suivant = traite ? avisADeposerEquipe(d, AUJOURDHUI).find((x) => x.reservation.id !== r.id) : undefined;
  const modifiable = !d.lectureSeule;

  const ligne = (statut: StatutAvisADeposer, extra: Partial<AvisADeposer> = {}): AvisADeposer => ({
    id: r.id,
    reservationId: r.id,
    logementId: r.logementId,
    voyageur: prenomDe(r.voyageur.nom) || 'Voyageur',
    depart: r.depart,
    canal: r.canal,
    creeLe: etat.avis?.creeLe ?? horodatageMaintenant(),
    ...(etat.avis ?? {}),
    statut,
    ...extra,
  });

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte.trim());
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };

  const terminer = (statut: 'fait' | 'passe') => {
    const retouche = texte.trim() !== (etat.avis?.texte ?? '').trim();
    d.upsert('avisADeposer', ligne(statut, { texte: texte.trim(), ...(retouche ? { source: 'equipe' } : {}), traiteLe: horodatageMaintenant(), traitePar: d.utilisateur.nom }));
  };

  // Annuler « C’est fait » / « Passer » : l'avis revient à déposer (relu si besoin).
  const rouvrir = () => {
    const x = ligne(etat.raisons.length ? 'a_relire' : etat.avis?.texte ? 'pret' : 'a_rediger');
    delete x.traiteLe;
    delete x.traitePar;
    d.upsert('avisADeposer', x);
  };

  return (
    <Card id="avis">
      <CardHeader titre="Votre avis sur le voyageur" actions={<Badge tone={badge.ton}>{badge.libelle}</Badge>} />

      {traite ? (
        <>
          <p className="text-[13.5px] text-(--lm-encre)">
            {point(
              `${etat.statut === 'fait' ? 'Avis déposé sur Airbnb' : 'Avis passé, pas déposé'}${etat.avis?.traiteLe ? ` le ${jour(etat.avis.traiteLe)}` : ''}${etat.avis?.traitePar ? ` par ${etat.avis.traitePar}` : ''}`,
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {suivant && (
              <Link to={`/erp/reservations/${encodeURIComponent(suivant.reservation.id)}`} className="inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                Avis suivant : {prenomDe(suivant.reservation.voyageur.nom)} <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
            {modifiable && etat.joursRestants > 0 && (
              <button type="button" onClick={rouvrir} className="inline-flex min-h-8 items-center text-[13px] text-(--lm-encre-2) hover:text-(--lm-encre) hover:underline">
                Annuler
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          {/* La plateforme a refusé la publication automatique : l'équipe le dépose elle-même. */}
          {erreurAuto && (
            <Alert tone="alerte" titre="À déposer vous-même" className="mb-3">
              {erreurAuto}
            </Alert>
          )}
          {/* À relire sans texte sûr : rien de prérempli (jamais d'éloge) ; le titre le dit, les raisons suivent. */}
          {etat.statut === 'a_relire' && (
            <Alert tone="alerte" titre={etat.aide ? 'Écrivez l’avis vous-même' : 'À relire avant de déposer'} className="mb-3">
              <ul>
                {etat.raisons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Textarea
            aria-label="Texte de l’avis"
            rows={4}
            value={texte}
            disabled={!modifiable}
            placeholder={etat.aide ? 'Un avis neutre et factuel.' : undefined}
            onChange={(e) => setTexte(e.target.value)}
          />
          <p className="mt-1.5 text-[12.5px] text-(--lm-encre-3)">
            {etat.joursRestants > 0 ? `Encore ${pluriel(etat.joursRestants, 'jour')} pour le déposer sur Airbnb.` : 'Dernier jour pour le déposer sur Airbnb.'}
            {etat.avis?.source === 'ia' && etat.texte ? ' Texte préparé par votre agent.' : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button icone={<Copy />} onClick={() => void copier()} disabled={!texte.trim()}>
              Copier le texte
            </Button>
            <a href={LIEN_AIRBNB_HOTE} target="_blank" rel="noreferrer noopener" className={classesBouton('secondary', 'md')}>
              <ExternalLink aria-hidden /> Ouvrir Airbnb
            </a>
            <span role="status" className="text-[12.5px] text-(--lm-encre-2)">
              {copie === 'ok' ? 'Texte copié.' : copie === 'echec' ? 'Copie impossible : sélectionnez le texte.' : ''}
            </span>
          </div>
          {modifiable && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) pt-3">
              <Button icone={<Check />} onClick={() => terminer('fait')} disabled={!texte.trim()}>
                C’est fait
              </Button>
              <Button variant="ghost" onClick={() => terminer('passe')}>
                Passer
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
