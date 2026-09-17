import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { StudioFooter, StudioHeader } from '../components/StudioChrome';

// =============================================================================
// Conditions du service payant « Label Maison Studio » : CGV, remboursement,
// données personnelles (RGPD) et mentions légales. Page sobre, lisible, sans
// fioriture — c'est un document, pas une vitrine.
//
// ⚠ Tout est au nom de Label Maison Conciergerie. Seul le SIRET reste à
// renseigner (constante SIRET ci-dessous) : c'est une donnée officielle, on ne
// l'invente pas. Dès qu'il est saisi, la mention « à compléter » disparaît.
// =============================================================================

const GOLD = '#A97C30';
const GOLD_DARK = '#7C561D';
const INK = '#2C2418';
const INK_2 = '#6B6252';
const IVORY = '#FBF9F4';
const LINE = '#E6DDC9';

// Renseigner le numéro SIRET ici : il s'affichera automatiquement dans les
// mentions légales (obligatoire pour une vente en ligne à des particuliers).
const SIRET = '';

const EDITEUR = 'Label Maison Conciergerie';
const EMAIL = 'labelmaisonconciergerie@gmail.com';
const TEL = '+33 7 49 54 83 55';
const MAJ = '17 septembre 2026';

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif-title text-[24px] md:text-[30px] leading-tight" style={{ color: INK }}>
        {titre}
      </h2>
      <div className="mt-3 grid gap-3 text-[15px] leading-relaxed" style={{ color: INK_2 }}>
        {children}
      </div>
    </section>
  );
}

export function StudioConditions() {
  return (
    <main style={{ background: IVORY }}>
      <Helmet>
        <title>Conditions, remboursement et données — Label Maison Studio</title>
        <meta
          name="description"
          content="Conditions générales de vente, politique de remboursement, protection des données personnelles et mentions légales du service Label Maison Studio."
        />
        <meta name="robots" content="noindex,follow" />
        <link rel="canonical" href="https://labelmaisoncgexperience.fr/studio/conditions" />
      </Helmet>

      <StudioHeader cta={false} />

      <div className="max-w-[780px] mx-auto px-6 pt-[120px] pb-[80px]">
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: GOLD_DARK }}
        >
          <ArrowLeft size={15} /> Retour au studio
        </Link>

        <h1
          className="mt-6 font-serif-title text-[34px] md:text-[48px] leading-[1.08] font-normal"
          style={{ color: INK }}
        >
          Label Maison Studio —{' '}
          <span className="font-serif-italic" style={{ color: GOLD }}>
            conditions
          </span>
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: INK_2 }}>
          Dernière mise à jour : {MAJ}.
        </p>

        <Bloc titre="1. Objet du service">
          <p>
            Label Maison Studio est un service numérique édité par Label Maison Conciergerie. À
            partir d’une photographie fournie par l’utilisateur et d’une ambiance choisie, il génère
            une représentation de la même pièce « après mise en valeur », au moyen d’un modèle
            d’intelligence artificielle.
          </p>
          <p>
            <strong style={{ color: INK }}>Le rendu est fourni à titre indicatif et non contractuel.</strong>{' '}
            Il illustre un potentiel de décoration et de mise en scène. Il ne constitue ni un projet
            d’architecte, ni un devis de travaux, ni une promesse de résultat locatif.
          </p>
        </Bloc>

        <Bloc titre="2. Prix et paiement">
          <p>
            L’aperçu flouté est gratuit et limité à une génération par visiteur. Le déblocage du
            rendu haute définition sans filigrane, accompagné de la vidéo avant/après, fait l’objet
            d’un <strong style={{ color: INK }}>paiement unique de 9,99 € TTC</strong>. Une offre
            « pack 3 rendus » est proposée à 24,90 € TTC.
          </p>
          <p>
            Il ne s’agit en aucun cas d’un abonnement : aucun prélèvement récurrent n’est mis en
            place. Les paiements sont encaissés par Stripe Payments Europe. Label Maison Conciergerie
            n’a accès à aucune donnée de carte bancaire et n’en conserve aucune.
          </p>
        </Bloc>

        <Bloc titre="3. Livraison et droit de rétractation">
          <p>
            Le rendu est livré immédiatement après confirmation du paiement : affichage et
            téléchargement dans la page, et envoi d’une copie par e-mail.
          </p>
          <p>
            Conformément à l’article L221-28 13° du code de la consommation, en demandant
            l’exécution immédiate de la prestation, l’utilisateur renonce expressément à son droit de
            rétractation de quatorze jours pour ce contenu numérique, une fois celui-ci délivré.
          </p>
        </Bloc>

        <Bloc titre="4. Remboursement">
          <p>Le paiement est intégralement remboursé, sur simple demande, lorsque :</p>
          <ul className="list-disc pl-5 grid gap-1.5">
            <li>aucun rendu haute définition n’a pu être délivré après le paiement ;</li>
            <li>le fichier livré est inexploitable (corrompu, vide, sans rapport avec la photo envoyée) ;</li>
            <li>un double paiement est intervenu pour un même rendu.</li>
          </ul>
          <p>
            La demande se fait par e-mail à <a href={`mailto:${EMAIL}`} style={{ color: GOLD_DARK }}>{EMAIL}</a>,
            en précisant l’adresse e-mail utilisée au paiement, sous trente jours. Le remboursement
            est effectué sur le moyen de paiement d’origine sous quatorze jours.
          </p>
          <p>
            Une insatisfaction portant sur le style ou le goût du rendu — qui reste une proposition
            créative — n’ouvre pas droit à remboursement automatique ; nous proposons alors une
            nouvelle génération dans une autre ambiance.
          </p>
        </Bloc>

        <Bloc titre="5. Vos données personnelles (RGPD)">
          <p>
            <strong style={{ color: INK }}>Responsable de traitement :</strong> Label Maison
            Conciergerie. <strong style={{ color: INK }}>Finalités :</strong> produire et livrer le
            rendu commandé, traiter le paiement, et — pour les clients ayant payé — proposer une
            estimation de revenus en location courte durée.
          </p>
          <p>
            <strong style={{ color: INK }}>Données traitées :</strong> la photographie envoyée,
            l’ambiance choisie, l’adresse e-mail transmise par Stripe lors du paiement, et les
            données techniques de connexion nécessaires à la lutte contre les abus.
          </p>
          <p>
            <strong style={{ color: INK }}>Bases légales :</strong> l’exécution du contrat pour la
            production et la livraison du rendu ; l’intérêt légitime pour la prise de contact
            commerciale auprès de nos clients et la prévention des abus.
          </p>
          <p>
            <strong style={{ color: INK }}>Destinataires :</strong> les sous-traitants techniques
            strictement nécessaires — hébergement (Vercel Inc.), paiement (Stripe Payments Europe),
            envoi d’e-mails (Resend), génération et stockage des images (fournisseur de modèle
            d’image et, le cas échéant, Supabase). Vos données ne sont ni vendues, ni cédées à des
            tiers à des fins publicitaires, et vos photos ne sont jamais publiées.
          </p>
          <p>
            <strong style={{ color: INK }}>Conservation :</strong> les images générées sont
            conservées le temps nécessaire à la livraison et au service après-vente, puis supprimées
            (30 jours au maximum). Les coordonnées des clients sont conservées trois ans à compter du
            dernier contact.
          </p>
          <p>
            <strong style={{ color: INK }}>Vos droits :</strong> accès, rectification, effacement,
            limitation, opposition et portabilité, en écrivant à{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: GOLD_DARK }}>{EMAIL}</a>. Vous pouvez
            également introduire une réclamation auprès de la CNIL (cnil.fr).
          </p>
        </Bloc>

        <Bloc titre="6. Propriété et usage du rendu">
          <p>
            Vous restez propriétaire de la photographie que vous envoyez et vous garantissez disposer
            du droit de l’utiliser. Le rendu généré vous est cédé pour un usage personnel et
            promotionnel de votre bien (annonce, réseaux sociaux). Label Maison Conciergerie ne
            publie vos images qu’avec votre accord écrit préalable.
          </p>
          <p>
            Sont interdits : l’envoi de photographies de personnes identifiables sans leur accord, de
            contenus illicites, ainsi que toute présentation du rendu comme l’état réel du bien dans
            une annonce de location ou de vente.
          </p>
        </Bloc>

        <Bloc titre="7. Mentions légales">
          <p>
            <strong style={{ color: INK }}>Éditeur du site et du service :</strong> {EDITEUR},
            conciergerie et gestion locative courte durée — Paris, France.
            <br />
            <strong style={{ color: INK }}>SIRET :</strong>{' '}
            {SIRET || (
              <span
                className="px-2 py-0.5 rounded"
                style={{ background: '#F6EAD6', color: GOLD_DARK, fontSize: '13px' }}
              >
                à compléter
              </span>
            )}
            <br />
            <strong style={{ color: INK }}>Directeur de la publication :</strong> {EDITEUR}.
            <br />
            <strong style={{ color: INK }}>Contact :</strong>{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: GOLD_DARK }}>{EMAIL}</a> — {TEL} —{' '}
            <a href="https://labelmaisoncg.fr" style={{ color: GOLD_DARK }}>labelmaisoncg.fr</a>.
          </p>
          <p>
            <strong style={{ color: INK }}>Hébergeur :</strong> Vercel Inc., 340 S Lemon Ave #4133,
            Walnut, CA 91789, États-Unis — vercel.com.
          </p>
          <p>
            <strong style={{ color: INK }}>Paiement :</strong> Stripe Payments Europe, Ltd., 1 Grand
            Canal Street Lower, Grand Canal Dock, Dublin, Irlande.
          </p>
          <p>
            <strong style={{ color: INK }}>Litiges et médiation :</strong> écrivez-nous d’abord à{' '}
            <a href={`mailto:${EMAIL}`} style={{ color: GOLD_DARK }}>{EMAIL}</a> : nous répondons
            sous quatorze jours. À défaut d’accord, le consommateur peut recourir gratuitement à un
            médiateur de la consommation ; les coordonnées du médiateur dont relève {EDITEUR} sont
            communiquées sur simple demande, ainsi que sur la plateforme européenne de règlement en
            ligne des litiges.
          </p>
          <p>Droit applicable : droit français.</p>
        </Bloc>

        <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${LINE}` }}>
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 font-bold text-[14px] px-6 py-3.5 rounded-full"
            style={{ background: `linear-gradient(180deg, #E6CD93, ${GOLD})`, color: '#2B220C' }}
          >
            <ArrowLeft size={15} /> Revenir au studio
          </Link>
        </div>
      </div>

      <StudioFooter />
    </main>
  );
}
