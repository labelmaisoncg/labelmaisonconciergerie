/**
 * Avis des voyageurs (A8) : thèmes et fréquence en barres sobres, liste des
 * avis (les négatifs d'abord), et le panneau d'un avis avec « Proposer une
 * réponse » (gérant et opérations, même verbe que la Messagerie). L'ERP ne
 * publie rien : la réponse se relit, se retouche et se copie ; « Ouvrir
 * Airbnb » est un simple lien. Un séjour direct n'a pas de page d'avis
 * publique : pas de réponse. Analyse et garde-fous : src/erp/data/avis.ts.
 */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronRight, Copy, ExternalLink, Lock, Plug, RotateCcw, Sparkles, Star } from 'lucide-react';
import { Alert, Badge, Button, ButtonLink, Card, CardHeader, Drawer, EmptyState, Textarea, classesBouton, cn, type Ton } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { AUJOURDHUI, dateCourte, jourMois, note as noteFr, pluriel } from '../../../data/format';
import { LIEN_AIRBNB_HOTE } from '../../../data/messages-programmes';
import { signatureEspace } from '../../../data/marque-espace';
import { espaceOuvert } from '../../../data/espaces';
import {
  libelleTheme,
  peutPreparerReponse,
  prenomPublic,
  problemesReponse,
  reponseModele,
  sansReponse,
  syntheseLogement,
  type AvisLu,
  type StatTheme,
  type SyntheseAvis,
} from '../../../data/avis';
import type { ReponseAvisPreparee } from '../../../data/avis-serveur';
import type { CanalReservation, Logement, SentimentMessage } from '../../../data/types';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';

/* ------------------------------------------------------------ libellés */

export const LIBELLE_SENTIMENT: Record<SentimentMessage, { libelle: string; ton: Ton }> = {
  positif: { libelle: 'Positif', ton: 'succes' },
  neutre: { libelle: 'Mitigé', ton: 'alerte' },
  negatif: { libelle: 'Négatif', ton: 'danger' },
};

const SENS_THEME: Record<SentimentMessage, { libelle: string; ton: Ton }> = {
  positif: { libelle: 'apprécié', ton: 'succes' },
  neutre: { libelle: 'cité', ton: 'neutre' },
  negatif: { libelle: 'à revoir', ton: 'danger' },
};

/** Où répondre (simple lien, rien n'est publié par l'ERP) ; undefined : plateforme inconnue. */
function plateformeAvis(canal: CanalReservation): { nom: string; libelle: string; url: string } | undefined {
  if (canal === 'airbnb') return { nom: 'Airbnb', libelle: 'Ouvrir Airbnb', url: LIEN_AIRBNB_HOTE };
  if (canal === 'booking') return { nom: 'Booking.com', libelle: 'Ouvrir Booking.com', url: 'https://admin.booking.com/' };
  return undefined;
}

/** « 17 positifs · 1 négatif » : jamais la couleur seule. */
function detailTheme(t: StatTheme): string {
  return [
    t.positifs ? pluriel(t.positifs, 'positif') : '',
    t.negatifs ? pluriel(t.negatifs, 'négatif') : '',
    t.neutres ? pluriel(t.neutres, 'neutre') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

const lien = '-my-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline';
const bascule = 'inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline';

/* ------------------------------------------------------ thèmes en barres */

/**
 * Thèmes et fréquence : la barre est la part des avis commentés qui en
 * parlent (vert : appréciés, rouge : à revoir, gris : simplement cités).
 * Les `max` premiers, le reste à la demande.
 */
export function BarresThemes({ synthese, max = 6, suite }: { synthese: SyntheseAvis; max?: number; suite?: (reste: number) => string }) {
  const [tous, setTous] = useState(false);
  const total = Math.max(1, synthese.nombreCommentes);
  const pct = (n: number) => `${(n / total) * 100}%`;
  const reste = synthese.themes.length - max;
  return (
    <>
      <ul className="space-y-3.5">
        {(tous ? synthese.themes : synthese.themes.slice(0, max)).map((t) => (
          <li key={t.cle}>
            <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
              <span className="font-medium text-(--lm-encre)">{t.libelle}</span>
              <span className="lm-chiffres shrink-0 text-(--lm-encre-2)">{pluriel(t.mentions, 'avis', 'avis')}</span>
            </div>
            <div aria-hidden className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-(--lm-neutre-lavis)">
              <span className="h-full bg-(--lm-succes)" style={{ width: pct(t.positifs) }} />
              <span className="h-full bg-(--lm-danger)" style={{ width: pct(t.negatifs) }} />
              <span className="h-full bg-(--lm-bord-fort)" style={{ width: pct(t.neutres) }} />
            </div>
            <p className="mt-1 text-[12px] text-(--lm-encre-2)">{detailTheme(t)}</p>
          </li>
        ))}
      </ul>
      {reste > 0 && (
        <button type="button" aria-expanded={tous} onClick={() => setTous((x) => !x)} className={cn(bascule, 'mt-2')}>
          {tous ? 'Réduire' : (suite ?? ((n: number) => `Voir les ${pluriel(n, 'autre thème', 'autres thèmes')}`))(reste)}
        </button>
      )}
    </>
  );
}

/* --------------------------------------------------------- un avis en ligne */

/** Une ligne : le texte de l'avis, puis « ☆ 4,0 · Négatif · Laura J. · Massy · 21 sept. » sur une seule ligne. */
export function LigneAvis({ avis: a, logement, onOuvrir }: { avis: AvisLu; logement?: string; onOuvrir: () => void }) {
  const s = LIBELLE_SENTIMENT[a.sentiment];
  const parties: ReactNode[] = [
    a.note !== undefined && (
      <span className="font-medium text-(--lm-encre)">
        <Star className="mr-0.5 inline size-3 align-[-1px]" aria-hidden />
        <span className="sr-only">Note </span>
        {noteFr(a.note)}
      </span>
    ),
    a.sentiment !== 'positif' && <span className={s.ton === 'danger' ? 'text-(--lm-danger)' : 'text-(--lm-alerte)'}>{s.libelle}</span>,
    a.auteur,
    logement,
    (a.date.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois : dateCourte)(a.date),
  ].filter(Boolean);
  return (
    <li>
      <button
        type="button"
        onClick={onOuvrir}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('line-clamp-2 text-[13.5px] text-(--lm-encre)', !a.textePublic && 'text-(--lm-encre-2) italic')}>
            {a.textePublic || (a.textePrive ? 'Message privé seulement' : 'Note sans commentaire')}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-(--lm-encre-2)">
            {parties.map((p, i) => (
              <Fragment key={i}>
                {i > 0 && ' · '}
                {p}
              </Fragment>
            ))}
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
      </button>
    </li>
  );
}

/* ------------------------------------------------ bloc de la fiche logement */

/** Une ligne d'en-tête : « 22 avis en 12 mois · note en hausse (4,9 sur les 5 derniers) ». */
export function resumeSynthese(s: SyntheseAvis): string {
  const t = s.tendance;
  const tendance = !t
    ? ''
    : t.sens === 'stable'
      ? ` · note stable sur les ${t.nbRecents} derniers`
      : ` · note en ${t.sens} (${noteFr(t.recente)} sur les ${t.nbRecents} derniers)`;
  return `${pluriel(s.nombre, 'avis', 'avis')} en 12 mois${tendance}`;
}

/**
 * « Avis des voyageurs » dans l'Aperçu d'un logement : ce qui revient
 * (3 thèmes, les autres à la demande), les avis à lire en premier, et tous
 * les avis à la demande. La note moyenne est déjà dans les repères du haut.
 */
export function CarteAvisLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const { hash } = useLocation();
  const s = useMemo(() => syntheseLogement(d.reservations, l.id, AUJOURDHUI), [d.reservations, l.id]);
  const [tous, setTous] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const present = s.nombre > 0;
  // Venu du tableau des logements (« …#avis ») : la carte est amenée dans la vue.
  useEffect(() => {
    if (hash === '#avis' && present) document.getElementById('avis')?.scrollIntoView({ block: 'start' });
  }, [hash, present]);
  if (!s.nombre) return null;
  const liste = tous ? s.avis : s.aLire.slice(0, 3);
  const choisi = s.avis.find((a) => a.reservationId === ouvert);
  return (
    <Card flush id="avis" className="scroll-mt-24">
      <div className="p-4 pb-0 sm:p-5 sm:pb-0">
        <CardHeader
          titre="Avis des voyageurs"
          description={resumeSynthese(s)}
          actions={
            <Link to="/erp/logements/avis" className={lien}>
              Tous les logements <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        {s.themes.length > 0 && (
          <div className="pb-4 sm:pb-5">
            <BarresThemes synthese={s} max={3} suite={() => 'Voir tous les thèmes'} />
          </div>
        )}
      </div>
      <div className="border-t border-(--lm-bord)">
        <h3 className="px-4 pt-3 text-[13px] font-semibold text-(--lm-encre) sm:px-5">{tous ? 'Tous les avis' : s.aLire.length ? 'À lire en premier' : 'Aucun avis négatif'}</h3>
        {liste.length > 0 && (
          <ul className="mt-1 divide-y divide-(--lm-bord)">
            {liste.map((a) => (
              <LigneAvis key={a.reservationId} avis={a} onOuvrir={() => setOuvert(a.reservationId)} />
            ))}
          </ul>
        )}
        <div className="px-4 py-2.5 sm:px-5">
          <button type="button" aria-expanded={tous} onClick={() => setTous((x) => !x)} className={bascule}>
            {tous ? 'Réduire' : `Voir les ${pluriel(s.avis.length, 'avis', 'avis')}`}
          </button>
        </div>
      </div>
      {choisi && <PanneauAvis avis={choisi} ouvert onFermer={() => setOuvert(null)} />}
    </Card>
  );
}

/* --------------------------------------------------- panneau d'un avis */

/** Réponses proposées pendant la session (on retrouve son texte en rouvrant l'avis). */
const PROPOSEES = new Map<string, ReponseAvisPreparee & { retouchee?: boolean }>();

async function demanderReponseAvis(reservationId: string): Promise<ReponseAvisPreparee> {
  const r = await appelerServeur<{ reponse: ReponseAvisPreparee }>('/api/erp-agent', 'POST', { action: 'reponse_avis', reservationId });
  return r.reponse;
}

/**
 * La réponse à un avis : « Proposer une réponse » (gérant et opérations),
 * texte modifiable, « Copier le texte » et le lien de la plateforme. Jamais
 * publiée par l'ERP ; le message privé n'est jamais repris ; rien pour un
 * séjour direct. `discret` (fiche d'un séjour) : boutons secondaires, et
 * rien pour un compte en lecture.
 */
export function ReponseAvis({ avis: a, discret }: { avis: AvisLu; discret?: boolean }) {
  const d = useErp();
  const r = d.reservations.find((x) => x.id === a.reservationId);
  const logement = d.logements.find((x) => x.id === a.logementId);
  const [reponse, setReponse] = useState<(ReponseAvisPreparee & { retouchee?: boolean }) | null>(() => PROPOSEES.get(a.reservationId) ?? null);
  const [texte, setTexte] = useState(() => PROPOSEES.get(a.reservationId)?.texte ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);
  const peut = peutPreparerReponse(d.utilisateur.role) && !d.lectureSeule;
  const plateforme = plateformeAvis(a.canal);
  const problemes = texte.trim() ? problemesReponse(texte, { nomVoyageur: r?.voyageur.nom, textePrive: a.textePrive, ...(logement ? { logement } : {}) }) : [];
  if (sansReponse(a) || (discret && !peut)) return null;

  const proposer = async () => {
    if (enCours) return;
    if (reponse?.retouchee && !window.confirm('Remplacer votre texte retouché par une nouvelle proposition ?')) return;
    setEnCours(true);
    setErreur(null);
    setCopie(null);
    try {
      const p: ReponseAvisPreparee =
        d.mode === 'demo'
          ? {
              texte: reponseModele(a, { prenom: prenomPublic(r?.voyageur.nom), signature: signatureEspace(d.donnees, espaceOuvert()) }),
              source: 'modele',
              note: 'En démonstration, votre agent ne rédige pas : voici un texte simple.',
            }
          : await demanderReponseAvis(a.reservationId);
      PROPOSEES.set(a.reservationId, p);
      setReponse(p);
      setTexte(p.texte);
    } catch (e) {
      setErreur(e instanceof ErreurServeur || e instanceof Error ? e.message : 'Votre agent ne répond pas pour l’instant : réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte.trim());
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };

  const modifier = (t: string) => {
    setTexte(t);
    setCopie(null);
    if (!reponse) return;
    const suivante = { ...reponse, texte: t, retouchee: true };
    PROPOSEES.set(a.reservationId, suivante);
    setReponse(suivante);
  };

  // Une seule ligne d'aide : d'où vient le texte, puis où le coller (l'ERP ne publie rien).
  const aide =
    copie === 'ok'
      ? plateforme
        ? `Texte copié. Collez-le sous l’avis sur ${plateforme.nom}.`
        : 'Texte copié.'
      : copie === 'echec'
        ? 'Copie impossible : sélectionnez le texte.'
        : `${reponse?.source === 'ia' ? 'Proposée par votre agent.' : reponse?.note ?? ''} Relisez la réponse, puis copiez-la : l’ERP ne publie rien.`.trim();

  return (
    <section className="mt-4 border-t border-(--lm-bord) pt-4" aria-label="Votre réponse">
      <h3 className="text-[14px] font-semibold text-(--lm-encre)">Votre réponse</h3>
      {!peut ? (
        <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">Seuls le gérant et l’équipe des opérations proposent les réponses.</p>
      ) : !reponse ? (
        <>
          <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">Votre agent propose une réponse au ton de la maison : vous la relisez, puis vous la copiez.</p>
          <Button variant={discret ? 'secondary' : 'primary'} icone={<Sparkles />} chargement={enCours} onClick={() => void proposer()} className="mt-3">
            Proposer une réponse
          </Button>
        </>
      ) : (
        <>
          <Textarea aria-label="Texte de la réponse" rows={10} value={texte} onChange={(e) => modifier(e.target.value)} className="mt-2" />
          {problemes.length > 0 && (
            <Alert tone="alerte" titre="À retirer avant de publier" className="mt-3">
              Le texte contient {problemes.join(', ')}.
            </Alert>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant={discret ? 'secondary' : 'primary'} icone={<Copy />} onClick={() => void copier()} disabled={!texte.trim()}>
              Copier le texte
            </Button>
            {plateforme && (
              <a href={plateforme.url} target="_blank" rel="noreferrer noopener" className={classesBouton('secondary', 'md')}>
                <ExternalLink aria-hidden /> {plateforme.libelle}
              </a>
            )}
            <Button variant="ghost" icone={<RotateCcw />} chargement={enCours} onClick={() => void proposer()}>
              Nouvelle proposition
            </Button>
          </div>
          <p role="status" className="mt-2 text-[12.5px] text-(--lm-encre-2)">
            {aide}
          </p>
        </>
      )}
      {erreur && (
        <Alert tone="danger" className="mt-3">
          {erreur}
        </Alert>
      )}
    </section>
  );
}

/** Un avis en entier (note, sentiment, points relevés, message privé) et sa réponse. */
export function PanneauAvis({ avis: a, ouvert, onFermer }: { avis: AvisLu; ouvert: boolean; onFermer: () => void }) {
  const d = useErp();
  const logement = d.logements.find((x) => x.id === a.logementId);
  const s = LIBELLE_SENTIMENT[a.sentiment];
  const publics = a.themes.filter((t) => !t.prive);
  const pasDeReponse = sansReponse(a);
  return (
    <Drawer
      ouvert={ouvert}
      onFermer={onFermer}
      titre={`Avis de ${a.auteur}`}
      sousTitre={[logement?.nom, `séjour terminé le ${dateCourte(a.date)}`, LIBELLES.canal[a.canal]].filter(Boolean).join(' · ')}
    >
      <div className="flex flex-wrap items-center gap-2">
        {a.note !== undefined && (
          <Badge tone="neutre" icone={<Star />}>
            {noteFr(a.note)} sur 5
          </Badge>
        )}
        <Badge tone={s.ton}>{s.libelle}</Badge>
        <Link to={`/erp/reservations/${encodeURIComponent(a.reservationId)}`} className={cn(lien, 'my-0 ml-auto')}>
          Voir le séjour <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {a.textePublic && <blockquote className="mt-3 border-l-2 border-(--lm-or) pl-3 text-[14px] leading-relaxed whitespace-pre-line text-(--lm-encre)">{a.textePublic}</blockquote>}

      {publics.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Points relevés">
          {publics.map((t) => (
            <li key={t.cle}>
              <Badge tone={SENS_THEME[t.sentiment].ton}>
                {libelleTheme(t.cle)} · {SENS_THEME[t.sentiment].libelle}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {a.textePrive && (
        <div className="mt-4 rounded-lg bg-(--lm-surface-2) p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-(--lm-encre)">
            <Lock className="size-3.5" aria-hidden /> Message privé à l’équipe
          </p>
          <p className="mt-1 text-[13.5px] whitespace-pre-line text-(--lm-encre-2)">{a.textePrive}</p>
          <p className="mt-1.5 text-[12px] text-(--lm-encre-3)">Jamais repris dans la réponse publique.</p>
        </div>
      )}

      {pasDeReponse ? <p className="mt-4 border-t border-(--lm-bord) pt-4 text-[13.5px] text-(--lm-encre-2)">{pasDeReponse}</p> : <ReponseAvis avis={a} />}
    </Drawer>
  );
}

/* ------------------------------------------------- vue vide (portefeuille) */

/** Pas encore d'avis : sans plateforme connectée, l'action qui en fait venir. */
export function SansAvis({ connecte }: { connecte: boolean }) {
  return (
    <EmptyState
      icone={<Star />}
      titre="Pas encore d’avis"
      description={connecte ? 'Les avis des voyageurs arrivent ici après leur séjour.' : 'Connectez Airbnb ou Booking : les avis des voyageurs arrivent ici après leur séjour.'}
      action={
        !connecte && (
          <ButtonLink to="/erp/logements/connexions" variant="primary" icone={<Plug />}>
            Connecter une plateforme
          </ButtonLink>
        )
      }
    />
  );
}
