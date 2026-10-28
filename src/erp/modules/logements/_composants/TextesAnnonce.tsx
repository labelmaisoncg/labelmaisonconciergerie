/**
 * « Textes de l'annonce » (cahier A6) : trois titres et une description pour
 * le logement, tirés de sa fiche ou rédigés par l'agent, chacun avec son
 * compteur de caractères (limites d'Airbnb et de Booking.com) et « Copier ».
 *
 * L'ERP ne publie jamais l'annonce : l'équipe copie un texte et le colle
 * elle-même sur la plateforme. La dernière proposition de l'agent est gardée
 * dans `versionsAnnonce` (id `textes-<logement>`) : on la retrouve sans
 * nouvel appel à l'IA.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Sparkles } from 'lucide-react';
import { Aide, Alert, Button, Drawer, cn } from '../../../ui';
import { useErp } from '../../../data/store';
import { AUJOURDHUI, jourMois } from '../../../data/format';
import type { Logement, VersionAnnonce } from '../../../data/types';
import { LIMITES_PLATEFORMES, NOMBRE_TITRES } from '../../../annonces/limites';
import { libelleCompteur, proposerTextesAnnonce, type TextesFinaux } from '../../../annonces/textes';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';

/** Id de la dernière proposition de l'agent pour un logement. */
export const idTextesAnnonce = (logementId: string) => `textes-${logementId}`;

/** Dernière proposition de l'agent gardée pour ce logement (trois titres et une description). */
export function textesGardes(versions: readonly VersionAnnonce[], logementId: string): VersionAnnonce | undefined {
  const v = versions.find((x) => x.id === idTextesAnnonce(logementId));
  return v && v.titres?.length === NOMBRE_TITRES && v.description ? v : undefined;
}

/** Bouton « Copier » : le texte va dans le presse-papiers, « Copié » pendant deux secondes. */
function Copier({ texte, libelle }: { texte: string; libelle: string }) {
  const [etat, setEtat] = useState<'ok' | 'echec'>();
  const minuteur = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(minuteur.current), []);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat('ok');
    } catch {
      setEtat('echec');
    }
    window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => setEtat(undefined), 2000);
  };
  return (
    <>
      <Button size="sm" icone={etat === 'ok' ? <Check /> : <Copy />} onClick={() => void copier()} aria-label={`Copier ${libelle}`} className="shrink-0">
        {etat === 'ok' ? 'Copié' : etat === 'echec' ? 'Sélectionnez le texte' : 'Copier'}
      </Button>
      {/* Le libellé du bouton est remplacé par son aria-label : « Copié » est annoncé à part. */}
      <span className="sr-only" aria-live="polite">
        {etat === 'ok' ? 'Copié' : etat === 'echec' ? 'Copie impossible : sélectionnez le texte.' : ''}
      </span>
    </>
  );
}

/** Un texte à copier : le texte, son compteur (lisible sans survol) et « Copier ». */
function BlocTexte({ texte, genre, libelle }: { texte: string; genre: 'titre' | 'description'; libelle: string }) {
  const c = libelleCompteur(texte, genre);
  return (
    <li className="rounded-lg border border-(--lm-bord) px-3.5 py-3">
      <p className={cn('break-words text-(--lm-encre) select-text', genre === 'titre' ? 'text-[15px] font-semibold' : 'text-[13.5px] leading-relaxed whitespace-pre-line')}>{texte}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className={cn('lm-chiffres min-w-0 text-[12px]', c.ok ? 'text-(--lm-encre-3)' : 'font-medium text-(--lm-danger)')}>{c.texte}</p>
        <Copier texte={texte} libelle={libelle} />
      </div>
    </li>
  );
}

export function TextesAnnonce({ logement: l, ouvert, onFermer }: { logement: Logement; ouvert: boolean; onFermer: () => void }) {
  const d = useErp();
  const proprietaire = d.proprietaires.find((p) => p.id === l.proprietaireId)?.nom;
  const garde = textesGardes(d.versionsAnnonce, l.id);
  const [variante, setVariante] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [avis, setAvis] = useState<{ ton: 'info' | 'alerte'; texte: string }>();
  // Textes de la fiche (sans IA) : la variante fait tourner les formulations.
  const fiche = useMemo(() => proposerTextesAnnonce(l, { variante, noms: proprietaire ? [proprietaire] : [] }), [l, variante, proprietaire]);
  const textes = garde && variante === 0 ? { titres: garde.titres ?? [], description: garde.description, remarques: fiche.remarques } : fiche;
  const peutRediger = !d.lectureSeule && (d.utilisateur.role === 'gerant' || d.utilisateur.role === 'operations');

  const garder = (t: TextesFinaux) => {
    d.upsert('versionsAnnonce', {
      id: idTextesAnnonce(l.id),
      logementId: l.id,
      mois: AUJOURDHUI.slice(0, 7),
      statut: 'proposee',
      titre: t.titres[0],
      titres: t.titres,
      description: t.description,
      accroche: '',
      raisons: [...t.ecartes, ...(t.sources.titres.includes('fiche') || t.sources.description === 'fiche' ? ['Une partie des textes vient de la fiche du logement.'] : [])],
      source: 'agent',
      creeLe: AUJOURDHUI,
    });
  };

  const rediger = async () => {
    setAvis(undefined);
    if (d.mode === 'demo') {
      // Démonstration : pas d'IA ; d'autres formulations tirées de la fiche.
      setVariante((v) => v + 1);
      setAvis({ ton: 'info', texte: 'En démonstration, votre agent ne rédige pas : voici d’autres formulations tirées de la fiche.' });
      return;
    }
    setEnCours(true);
    try {
      const r = await appelerServeur<{ textes: TextesFinaux }>('/api/erp-agent', 'POST', { action: 'textes_annonce', logementId: l.id });
      garder(r.textes);
      setVariante(0);
      if (r.textes.ecartes.length) setAvis({ ton: 'info', texte: `${r.textes.ecartes.length > 1 ? 'Des textes de votre agent ont été écartés' : 'Un texte de votre agent a été écarté'} (rien d’inventé, ni coordonnée, ni code) : remplacé par celui de la fiche.` });
    } catch (e) {
      setAvis({ ton: 'alerte', texte: e instanceof ErreurServeur || e instanceof Error ? e.message : 'Votre agent ne répond pas pour l’instant : réessayez dans un instant.' });
    } finally {
      setEnCours(false);
    }
  };

  // Une seule phrase : d'où viennent les textes, et ce qu'on en fait.
  const origine =
    garde && variante === 0
      ? `Rédigés par votre agent le ${jourMois(garde.creeLe)} à partir de la fiche du logement, à copier puis coller vous-même sur Airbnb ou Booking.com.`
      : 'Tirés de la fiche du logement, à copier puis coller vous-même sur Airbnb ou Booking.com.';

  return (
    <Drawer
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Textes de l’annonce"
      sousTitre={l.nom}
      pied={
        <>
          <Button variant="ghost" onClick={onFermer}>
            Fermer
          </Button>
          {peutRediger && (
            <Button variant="primary" icone={<Sparkles />} chargement={enCours} onClick={() => void rediger()}>
              {enCours ? 'Rédaction…' : garde ? 'Proposer d’autres textes' : 'Rédiger avec votre agent'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-[13px] text-(--lm-encre-2)">{origine}</p>
        {avis && <Alert tone={avis.ton}>{avis.texte}</Alert>}

        <section aria-labelledby="textes-titres">
          <h3 id="textes-titres" className="text-[13px] font-semibold text-(--lm-encre)">
            {textes.titres.length > 1 ? `${textes.titres.length} titres au choix` : 'Titre'}
          </h3>
          <ol className="mt-2 space-y-2">
            {textes.titres.map((t, i) => (
              <BlocTexte key={`${i}-${t}`} texte={t} genre="titre" libelle={`le titre ${i + 1}`} />
            ))}
          </ol>
        </section>

        <section aria-labelledby="textes-description">
          <h3 id="textes-description" className="text-[13px] font-semibold text-(--lm-encre)">
            Description
          </h3>
          <ul className="mt-2">
            <BlocTexte texte={textes.description} genre="description" libelle="la description" />
          </ul>
        </section>

        {textes.remarques.length > 0 && (
          <Alert tone="neutre" titre="Pour de meilleurs textes">
            {textes.remarques.join(' ')}
          </Alert>
        )}

        <Aide className="mb-0">
          <ul className="list-disc space-y-1 pl-5">
            <li>L’ERP ne publie jamais l’annonce : copiez un texte, puis collez-le vous-même dans votre annonce Airbnb ou Booking.com.</li>
            <li>Tout vient de la fiche du logement. Un équipement absent de la fiche n’est jamais cité : complétez-la plutôt.</li>
            <li>Ni code d’accès, ni wifi, ni adresse exacte, ni coordonnées, ni lien : les plateformes les refusent.</li>
            <li>
              Limites : {LIMITES_PLATEFORMES.airbnb.titre.max} caractères pour le titre et {LIMITES_PLATEFORMES.airbnb.description.max} pour la description sur Airbnb ;{' '}
              {LIMITES_PLATEFORMES.booking.titre.max} pour le titre sur Booking.com. Les textes proposés tiennent dans les deux.
            </li>
            <li>Votre agent rédige à partir des mêmes faits ; ce qu’il écrit est relu par les mêmes règles, et un texte refusé est remplacé par celui de la fiche.</li>
          </ul>
        </Aide>
      </div>
    </Drawer>
  );
}
