/**
 * Avis des voyageurs (A8) : thèmes et fréquence en barres sobres, liste des
 * avis (les négatifs d'abord), et le panneau d'un avis avec « Préparer une
 * réponse » (gérant et opérations). L'ERP ne publie rien : la réponse se
 * relit, se retouche et se copie ; « Ouvrir Airbnb » est un simple lien.
 * Analyse et garde-fous : src/erp/data/avis.ts.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronRight, Copy, ExternalLink, Lock, RotateCcw, Sparkles, Star } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Drawer, EmptyState, Textarea, classesBouton, cn, type Ton } from '../../../ui';
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

/** Où répondre (simple lien, rien n'est publié par l'ERP). */
function lienPlateforme(canal: CanalReservation): { libelle: string; url: string } | undefined {
  if (canal === 'airbnb') return { libelle: 'Ouvrir Airbnb', url: LIEN_AIRBNB_HOTE };
  if (canal === 'booking') return { libelle: 'Ouvrir Booking.com', url: 'https://admin.booking.com/' };
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

/* ------------------------------------------------------ thèmes en barres */

/**
 * Thèmes et fréquence : la barre est la part des avis commentés qui en
 * parlent (vert : appréciés, rouge : à revoir, gris : simplement cités).
 */
export function BarresThemes({ synthese, max = 6 }: { synthese: SyntheseAvis; max?: number }) {
  const total = Math.max(1, synthese.nombreCommentes);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <ul className="space-y-3.5">
      {synthese.themes.slice(0, max).map((t) => (
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
  );
}

/* --------------------------------------------------------- un avis en ligne */

export function LigneAvis({ avis: a, logement, onOuvrir }: { avis: AvisLu; logement?: string; onOuvrir: () => void }) {
  const s = LIBELLE_SENTIMENT[a.sentiment];
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
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-(--lm-encre-2)">
            {a.note !== undefined && (
              <span className="inline-flex items-center gap-0.5 font-medium text-(--lm-encre)">
                <Star className="size-3" aria-hidden />
                <span className="sr-only">Note </span>
                {noteFr(a.note)}
              </span>
            )}
            {a.sentiment !== 'positif' && <span className={s.ton === 'danger' ? 'text-(--lm-danger)' : 'text-(--lm-alerte)'}>· {s.libelle}</span>}
            <span>· {[a.auteur, logement, (a.date.slice(0, 4) === AUJOURDHUI.slice(0, 4) ? jourMois : dateCourte)(a.date)].filter(Boolean).join(' · ')}</span>
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
      </button>
    </li>
  );
}

/* ------------------------------------------------ bloc de la fiche logement */

const lien = '-my-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline';

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
 * « Avis » dans l'Aperçu d'un logement : ce qui revient (thèmes et
 * fréquence), les avis à lire en premier, et tous les avis à la demande.
 * La note moyenne est déjà dans les repères en haut de la fiche.
 */
export function CarteAvisLogement({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const { hash } = useLocation();
  const s = useMemo(() => syntheseLogement(d.reservations, l.id, AUJOURDHUI), [d.reservations, l.id]);
  const [tous, setTous] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const present = s.nombre > 0;
  // Venu du tableau du parc (« …#avis ») : la carte est amenée dans la vue.
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
          titre="Avis"
          description={resumeSynthese(s)}
          actions={
            <Link to="/erp/logements/avis" className={lien}>
              Tout le parc <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        {s.themes.length > 0 && (
          <div className="pb-4 sm:pb-5">
            <BarresThemes synthese={s} />
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
          <button type="button" onClick={() => setTous((x) => !x)} className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline">
            {tous ? 'Afficher les avis à lire' : `Voir les ${pluriel(s.avis.length, 'avis', 'avis')}`}
          </button>
        </div>
      </div>
      {choisi && <PanneauAvis avis={choisi} ouvert onFermer={() => setOuvert(null)} />}
    </Card>
  );
}

/* --------------------------------------------------- panneau d'un avis */

/** Réponses préparées pendant la session (on retrouve son texte en rouvrant l'avis). */
const PREPAREES = new Map<string, ReponseAvisPreparee>();

async function demanderReponseAvis(reservationId: string): Promise<ReponseAvisPreparee> {
  const r = await appelerServeur<{ reponse: ReponseAvisPreparee }>('/api/erp-agent', 'POST', { action: 'reponse_avis', reservationId });
  return r.reponse;
}

/**
 * La réponse à un avis : « Préparer une réponse » (gérant et opérations),
 * texte modifiable, « Copier » et le lien de la plateforme. Jamais publiée
 * par l'ERP ; le message privé n'est jamais repris. `discret` (fiche d'un
 * séjour) : boutons secondaires, et rien pour un compte en lecture.
 */
export function ReponseAvis({ avis: a, discret }: { avis: AvisLu; discret?: boolean }) {
  const d = useErp();
  const r = d.reservations.find((x) => x.id === a.reservationId);
  const logement = d.logements.find((x) => x.id === a.logementId);
  const [reponse, setReponse] = useState<ReponseAvisPreparee | null>(() => PREPAREES.get(a.reservationId) ?? null);
  const [texte, setTexte] = useState(() => PREPAREES.get(a.reservationId)?.texte ?? '');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);
  const peut = peutPreparerReponse(d.utilisateur.role) && !d.lectureSeule;
  const plateforme = lienPlateforme(a.canal);
  const problemes = texte.trim() ? problemesReponse(texte, { nomVoyageur: r?.voyageur.nom, textePrive: a.textePrive, ...(logement ? { logement } : {}) }) : [];
  if (!a.textePublic || (discret && !peut)) return null;

  const preparer = async () => {
    if (enCours) return;
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
      PREPAREES.set(a.reservationId, p);
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
    if (reponse) PREPAREES.set(a.reservationId, { ...reponse, texte: t });
  };

  return (
    <section className="mt-4 border-t border-(--lm-bord) pt-4" aria-label="Votre réponse">
      <h3 className="text-[14px] font-semibold text-(--lm-encre)">Votre réponse</h3>
      {!peut ? (
        <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">Les réponses sont préparées par l’équipe (gérant et opérations).</p>
      ) : !reponse ? (
        <>
          <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">Votre agent propose une réponse au ton de la maison : vous la relisez, puis vous la copiez.</p>
          <Button variant={discret ? 'secondary' : 'primary'} icone={<Sparkles />} chargement={enCours} onClick={() => void preparer()} className="mt-3">
            Préparer une réponse
          </Button>
        </>
      ) : (
        <>
          <Textarea aria-label="Texte de la réponse" rows={10} value={texte} onChange={(e) => modifier(e.target.value)} className="mt-2" />
          <p className="mt-1.5 text-[12.5px] text-(--lm-encre-3)">{reponse.source === 'ia' ? 'Proposée par votre agent : relisez-la avant de la publier.' : reponse.note}</p>
          {problemes.length > 0 && (
            <Alert tone="alerte" titre="À retirer avant de publier" className="mt-3">
              Le texte contient {problemes.join(', ')}.
            </Alert>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant={discret ? 'secondary' : 'primary'} icone={<Copy />} onClick={() => void copier()} disabled={!texte.trim()}>
              Copier
            </Button>
            {plateforme && (
              <a href={plateforme.url} target="_blank" rel="noreferrer noopener" className={classesBouton('secondary', 'md')}>
                <ExternalLink aria-hidden /> {plateforme.libelle}
              </a>
            )}
            <Button variant="ghost" icone={<RotateCcw />} chargement={enCours} onClick={() => void preparer()}>
              Nouvelle proposition
            </Button>
          </div>
          <p role="status" className="mt-2 text-[12.5px] text-(--lm-encre-2)">
            {copie === 'ok'
              ? `Copiée. Collez-la sous l’avis sur ${LIBELLES.canal[a.canal]}.`
              : copie === 'echec'
                ? 'Copie impossible : sélectionnez le texte.'
                : 'L’ERP ne publie rien : vous collez la réponse vous-même.'}
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
      </div>

      {a.textePublic ? (
        <blockquote className="mt-3 border-l-2 border-(--lm-or) pl-3 text-[14px] leading-relaxed whitespace-pre-line text-(--lm-encre)">{a.textePublic}</blockquote>
      ) : (
        <p className="mt-3 text-[13.5px] text-(--lm-encre-2)">Pas de commentaire public : il n’y a rien à répondre.</p>
      )}

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

      <ReponseAvis avis={a} />
    </Drawer>
  );
}

/* ------------------------------------------------- vue vide (portefeuille) */

export function SansAvis() {
  return <EmptyState icone={<Star />} titre="Pas encore d’avis" description="Les avis des voyageurs arrivent ici après leur séjour." />;
}
