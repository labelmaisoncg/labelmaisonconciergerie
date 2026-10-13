import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  ACTIVITE,
  Bloc,
  EDITEUR,
  GOLD,
  GOLD_DARK,
  HEBERGEUR,
  INK,
  INK_2,
  IVORY,
  LINE,
  LienEmail,
  Siret,
  SITE_LIBELLE,
  SITE_URL,
  TEL,
} from '../legal';

// =============================================================================
// Mentions légales du site (LCEN). Mêmes faits que les conditions du Studio,
// partagés dans src/app/legal.tsx : rien n'est inventé. Une information
// officielle manquante (SIRET) s'affiche « à compléter » jusqu'à sa saisie.
// =============================================================================

const MAJ = 'octobre 2026';

export function MentionsLegales() {
  return (
    <main style={{ background: IVORY }}>
      <Helmet>
        <title>Mentions légales — Label Maison Conciergerie</title>
        <meta
          name="description"
          content="Mentions légales du site Label Maison Conciergerie : éditeur, directeur de la publication, hébergeur et contact."
        />
        <link rel="canonical" href="https://www.labelmaisoncg.fr/mentions-legales" />
      </Helmet>

      <div className="max-w-[780px] mx-auto px-6 pt-[120px] md:pt-[150px] pb-[40px]">
        <h1
          className="font-serif-title text-[34px] md:text-[48px] leading-[1.08] font-normal"
          style={{ color: INK }}
        >
          Mentions{' '}
          <span className="font-serif-italic" style={{ color: GOLD }}>
            légales
          </span>
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: INK_2 }}>
          Dernière mise à jour : {MAJ}.
        </p>

        <Bloc titre="Éditeur du site">
          <p>
            <strong style={{ color: INK }}>{EDITEUR}</strong>, {ACTIVITE}.
            <br />
            <strong style={{ color: INK }}>SIRET :</strong> <Siret />
          </p>
          <p>
            <strong style={{ color: INK }}>Contact :</strong> <LienEmail /> — {TEL} —{' '}
            <a href={SITE_URL} style={{ color: GOLD_DARK }}>
              {SITE_LIBELLE}
            </a>
            .
          </p>
        </Bloc>

        <Bloc titre="Directeur de la publication">
          <p>{EDITEUR}.</p>
        </Bloc>

        <Bloc titre="Hébergeur">
          <p>
            {HEBERGEUR.nom}, {HEBERGEUR.adresse} —{' '}
            <a href={`https://${HEBERGEUR.site}`} target="_blank" rel="noopener noreferrer" style={{ color: GOLD_DARK }}>
              {HEBERGEUR.site}
            </a>
            .
          </p>
        </Bloc>

        <Bloc titre="Données personnelles">
          <p>
            Pour savoir quelles données nous traitons, pourquoi, avec qui, et comment exercer vos droits,
            consultez notre{' '}
            <Link to="/politique-de-confidentialite" style={{ color: GOLD_DARK }}>
              politique de confidentialité
            </Link>
            . Pour toute demande : <LienEmail />.
          </p>
          <p>
            Le service payant Label Maison Studio a ses propres{' '}
            <Link to="/studio/conditions" style={{ color: GOLD_DARK }}>
              conditions de vente
            </Link>
            .
          </p>
        </Bloc>

        <Bloc titre="Droit applicable">
          <p>Droit français.</p>
        </Bloc>

        <div
          className="mt-12 pt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-semibold"
          style={{ borderTop: `1px solid ${LINE}` }}
        >
          <Link to="/politique-de-confidentialite" style={{ color: GOLD_DARK }}>
            Politique de confidentialité
          </Link>
          <Link to="/studio/conditions" style={{ color: GOLD_DARK }}>
            Conditions du Studio
          </Link>
        </div>
      </div>
    </main>
  );
}
