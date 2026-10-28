import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ACTIVITE, Bloc, EDITEUR, GOLD, GOLD_DARK, INK, INK_2, IVORY, LINE, LienEmail, SITE_LIBELLE, TEL } from '../legal';

// =============================================================================
// Politique de confidentialité du site et des outils de l'équipe (RGPD).
//
// Chaque fait est tiré du code — à revoir dès qu'un outil change :
//  - formulaires → CRM : api/contact.ts, api/_erp-crm.ts, src/erp/data/crm.ts
//  - agent IA des voyageurs : api/_erp-agent.ts, src/erp/data/agent-messagerie.ts
//  - connecteur Claude du CRM : api/crm-mcp/index.ts, api/_oauth.ts, src/erp/data/crm-mcp.ts
//  - traceurs : SplashIntro, CercleAnnounce, Studio (stockage local),
//    middleware.ts (cookie de session /erp et /linge), src/styles/fonts.css.
//  - cartes des logements : src/erp/carte/FondCarte.tsx (fond OpenFreeMap),
//    src/erp/data/geocodage.ts (adresse envoyée à l'IGN, outil de l'équipe seulement).
// ⚠ Studio.tsx peut charger Microsoft Clarity si VITE_CLARITY_ID est défini :
// l'activer impose un bandeau de consentement ET une mise à jour de la
// section « Cookies » ci-dessous.
// =============================================================================

const MAJ = 'octobre 2026';

const SOMMAIRE: [string, string][] = [
  ['responsable', 'Qui est responsable de vos données'],
  ['donnees', 'Les données que nous traitons'],
  ['ia', 'L’intelligence artificielle'],
  ['destinataires', 'Qui reçoit vos données'],
  ['transferts', 'Transferts hors de l’Union européenne'],
  ['cookies', 'Cookies et traceurs'],
  ['droits', 'Vos droits'],
  ['securite', 'Sécurité'],
];

/** Une situation : données, usage, base légale, durée. */
function Fiche({ titre, lignes }: { titre: string; lignes: [string, ReactNode][] }) {
  return (
    <div className="rounded-2xl p-5 md:p-6" style={{ background: '#FFFFFF', border: `1px solid ${LINE}` }}>
      <h3 className="text-[17px] font-semibold leading-snug" style={{ color: INK }}>
        {titre}
      </h3>
      <dl className="mt-4 grid gap-3.5">
        {lignes.map(([terme, valeur]) => (
          <div key={terme} className="grid gap-1 md:grid-cols-[140px_1fr] md:gap-5">
            <dt
              className="text-[12px] font-semibold uppercase tracking-[0.8px] md:pt-[3px]"
              style={{ color: GOLD_DARK }}
            >
              {terme}
            </dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const PRESTATAIRES: [string, string][] = [
  ['Vercel', 'hébergement du site et des fonctions serveur (formulaires, outil de gestion).'],
  ['Supabase', 'base de données de notre outil de gestion (fichier de prospects, réservations, messages).'],
  ['Resend', 'envoi des e-mails produits par les formulaires du site.'],
  ['Google (Gmail)', 'messagerie de l’équipe, qui reçoit ces e-mails et les messages que vous nous écrivez.'],
  ['Stripe', 'paiement des commandes du Studio.'],
  ['Anthropic (Claude)', 'intelligence artificielle : aide à la réponse aux voyageurs et connecteur du fichier de prospects.'],
  ['Apple iCloud, Google Agenda', 'agendas de l’équipe, qui y reçoit les rappels du fichier de prospects (nom, coordonnées, date de relance), lorsqu’ils sont activés.'],
  ['Repull', 'gestionnaire de canaux : nous transmet les réservations et les messages des plateformes, et achemine nos réponses.'],
  ['Telegram', 'notifications internes à l’équipe (nom du voyageur, plateforme, extrait du message), lorsqu’elles sont activées.'],
];

export function PolitiqueConfidentialite() {
  return (
    <main style={{ background: IVORY }}>
      <Helmet>
        <title>Politique de confidentialité — Label Maison Conciergerie</title>
        <meta
          name="description"
          content="Vos données chez Label Maison Conciergerie : ce que nous collectons, pourquoi, combien de temps, nos prestataires (dont l’IA Claude d’Anthropic), les cookies et vos droits RGPD."
        />
        <link rel="canonical" href="https://www.labelmaisoncg.fr/politique-de-confidentialite" />
      </Helmet>

      <div className="max-w-[780px] mx-auto px-6 pt-[120px] md:pt-[150px] pb-[40px]">
        <h1
          className="font-serif-title text-[34px] md:text-[48px] leading-[1.08] font-normal"
          style={{ color: INK }}
        >
          Politique de{' '}
          <span className="font-serif-italic" style={{ color: GOLD }}>
            confidentialité
          </span>
        </h1>
        <p className="mt-3 text-[14px]" style={{ color: INK_2 }}>
          Dernière mise à jour : {MAJ}.
        </p>
        <p className="mt-6 text-[16px] leading-relaxed" style={{ color: INK_2 }}>
          Cette page explique simplement quelles données personnelles nous traitons, pourquoi, combien
          de temps nous les gardons, qui les reçoit et comment exercer vos droits. Elle concerne le
          site {SITE_LIBELLE}, ses formulaires et les outils de gestion de notre équipe.
        </p>

        <div className="mt-8 rounded-2xl p-5 md:p-6" style={{ background: '#F6EFE2', border: `1px solid ${LINE}` }}>
          <p className="text-[12px] font-semibold uppercase tracking-[1px]" style={{ color: GOLD_DARK }}>
            L’essentiel
          </p>
          <ul className="mt-3 list-disc pl-5 grid gap-2 text-[15px] leading-relaxed" style={{ color: INK }}>
            <li>Nous ne vendons ni ne louons vos données. Le site n’affiche ni publicité, ni mesure d’audience.</li>
            <li>
              Une demande envoyée depuis un formulaire est enregistrée dans notre fichier de prospects pour
              vous rappeler, et conservée 3 ans au plus après votre dernier contact avec nous.
            </li>
            <li>
              Une intelligence artificielle, Claude (Anthropic), aide l’équipe à répondre aux voyageurs et à
              tenir ce fichier. Elle ne prend aucune décision ayant un effet juridique sur vous.
            </li>
            <li>
              Un e-mail suffit pour exercer vos droits : <LienEmail />.
            </li>
          </ul>
        </div>

        <nav aria-label="Sommaire" className="mt-8">
          <ol className="grid gap-1.5 text-[14px] sm:grid-cols-2 sm:gap-x-8">
            {SOMMAIRE.map(([id, libelle], i) => (
              <li key={id}>
                <a href={`#${id}`} className="hover:underline" style={{ color: GOLD_DARK }}>
                  {i + 1}. {libelle}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Bloc id="responsable" titre="1. Qui est responsable de vos données ?">
          <p>
            Le responsable de traitement est <strong style={{ color: INK }}>{EDITEUR}</strong>, {ACTIVITE}.
          </p>
          <p>
            Pour toute question sur vos données ou pour exercer vos droits : <LienEmail /> ou {TEL}. Les
            informations légales complètes figurent dans les{' '}
            <Link to="/mentions-legales" style={{ color: GOLD_DARK }}>
              mentions légales
            </Link>
            .
          </p>
        </Bloc>

        <Bloc id="donnees" titre="2. Les données que nous traitons">
          <p>
            Nous ne collectons que ce qui sert à chaque usage. Pour chaque situation : les données
            concernées, ce que nous en faisons, ce qui nous y autorise (la « base légale ») et la durée de
            conservation.
          </p>

          <Fiche
            titre="Vous nous contactez pour votre bien (propriétaires et prospects)"
            lignes={[
              [
                'Données',
                <>
                  Ce que vous saisissez dans un formulaire du site (demande de rappel, contact, demande d’audit) :
                  nom ou prénom, e-mail, téléphone, ville, type de bien, adresse du bien, nombre de
                  chambres, message et page d’où vous écrivez. Puis le suivi de l’équipe : étape de votre
                  dossier, date de rappel, résultat des appels et notes.
                </>,
              ],
              [
                'Pourquoi',
                <>
                  Vous rappeler, répondre à votre demande et vous présenter notre offre de gestion. Votre
                  demande nous arrive par e-mail et s’enregistre dans notre fichier de prospects (CRM) ; si
                  vous nous écrivez à nouveau, elle complète la même fiche.
                </>,
              ],
              [
                'Base légale',
                <>
                  Les mesures précontractuelles prises à votre demande, et notre intérêt légitime à assurer
                  le suivi commercial (rappels, relances).
                </>,
              ],
              [
                'Durée',
                <>
                  3 ans après votre dernier contact avec nous, conformément au référentiel de la CNIL sur
                  la prospection commerciale. La fiche est ensuite supprimée. Si vous nous confiez votre
                  bien, ce sont les règles des propriétaires clients qui s’appliquent.
                </>,
              ],
            ]}
          />

          <Fiche
            titre="Vous rejoignez le Cercle Label Maison"
            lignes={[
              [
                'Données',
                <>
                  Nom et prénom, e-mail, téléphone, ville ou zone, profil (propriétaire, agent immobilier,
                  artisan…), le fait d’avoir déjà un propriétaire en tête, et votre message.
                </>,
              ],
              [
                'Pourquoi',
                <>
                  Étudier votre candidature et vous recontacter au sujet du programme. Elle est enregistrée
                  dans le même fichier de prospects.
                </>,
              ],
              [
                'Base légale',
                <>
                  Les mesures précontractuelles prises à votre demande, que vous confirmez en cochant la case
                  du formulaire.
                </>,
              ],
              ['Durée', <>3 ans après votre dernier contact avec nous, puis suppression.</>],
            ]}
          />

          <Fiche
            titre="Vous nous confiez votre bien (propriétaires clients)"
            lignes={[
              [
                'Données',
                <>
                  Identité et coordonnées, adresse, informations sur le logement, mandat de gestion, relevés
                  de gestion et références bancaires (dans notre outil, l’IBAN n’est conservé que sous forme
                  masquée).
                </>,
              ],
              ['Pourquoi', <>Exécuter le mandat : gestion des séjours, relevés et versement de vos revenus.</>],
              ['Base légale', <>L’exécution du contrat (mandat de gestion) et nos obligations légales.</>],
              [
                'Durée',
                <>
                  Le temps du mandat, puis les durées imposées par la loi, notamment 10 ans pour les pièces
                  comptables.
                </>,
              ],
            ]}
          />

          <Fiche
            titre="Vous séjournez dans un logement que nous gérons (voyageurs)"
            lignes={[
              [
                'Données',
                <>
                  Nom affiché sur la plateforme, pays, nombre de voyageurs, dates du séjour, logement,
                  statut et montants de la réservation, numéro de confirmation, messages échangés et, le cas
                  échéant, la note et le commentaire laissés après le séjour.
                </>,
              ],
              [
                'Provenance',
                <>
                  Ces données ne sont pas collectées sur ce site. Elles viennent des plateformes de
                  réservation (Airbnb, Booking.com…), nous sont transmises par notre gestionnaire de canaux
                  Repull, puis sont lues par notre outil de gestion.
                </>,
              ],
              [
                'Pourquoi',
                <>Organiser votre séjour (accueil, ménage, accès), répondre à vos messages, tenir notre comptabilité.</>,
              ],
              [
                'Base légale',
                <>L’exécution du contrat de location, et nos obligations légales pour la comptabilité.</>,
              ],
              [
                'Durée',
                <>
                  Le temps de la relation (séjour et suites éventuelles), puis les durées imposées par la
                  loi, notamment 10 ans pour les pièces justificatives comptables.
                </>,
              ],
            ]}
          />

          <Fiche
            titre="Vous visitez le site"
            lignes={[
              [
                'Données',
                <>
                  Adresse IP et informations techniques du navigateur, reçues par notre hébergeur pour
                  afficher les pages et protéger le site. L’adresse IP sert aussi, sur le moment, à freiner
                  les envois abusifs de formulaires ; elle n’est pas enregistrée dans notre fichier de
                  prospects.
                </>,
              ],
              ['Base légale', <>Notre intérêt légitime à assurer la sécurité du site.</>],
              [
                'Durée',
                <>Nous ne les enregistrons pas ; les journaux techniques de l’hébergeur suivent ses propres délais.</>,
              ],
            ]}
          />

          <p>
            <strong style={{ color: INK }}>Clients de Label Maison Studio :</strong> le service de rendu
            déco a sa propre section sur les données personnelles (photo envoyée, paiement, conservation
            des images) dans ses{' '}
            <Link to="/studio/conditions" style={{ color: GOLD_DARK }}>
              conditions
            </Link>
            .
          </p>
        </Bloc>

        <Bloc id="ia" titre="3. L’intelligence artificielle">
          <p>
            Nous utilisons Claude, l’intelligence artificielle de la société Anthropic, pour deux usages
            précis.
          </p>
          <p>
            <strong style={{ color: INK }}>Répondre aux voyageurs.</strong> Un assistant lit les derniers
            messages d’une conversation, la réservation et les informations pratiques du logement. Il
            rédige alors une réponse, envoyée au voyageur par la plateforme, ou transmet la demande à
            l’équipe. Les questions d’argent et les litiges sont toujours transmis à une personne de
            l’équipe, et les codes d’accès ne sont communiqués qu’aux voyageurs dont la réservation est
            confirmée et l’arrivée proche.
          </p>
          <p>
            <strong style={{ color: INK }}>Tenir le fichier de prospects.</strong> Un connecteur permet aux
            gérants de consulter et de mettre à jour ce fichier depuis Claude : rechercher une fiche,
            l’ajouter, noter un appel. Seul un gérant peut l’activer, et il ne permet de supprimer aucune
            fiche.
          </p>
        </Bloc>

        <Bloc id="destinataires" titre="4. Qui reçoit vos données ?">
          <p>
            Vos données sont accessibles uniquement aux membres de l’équipe {EDITEUR} qui en ont besoin.
            Elles ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires. Nous faisons appel
            aux prestataires suivants (sous-traitants), qui les traitent pour notre compte :
          </p>
          <ul className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: `1px solid ${LINE}` }}>
            {PRESTATAIRES.map(([nom, role], i) => (
              <li
                key={nom}
                className="grid gap-0.5 md:grid-cols-[170px_1fr] md:gap-5 px-5 py-3.5"
                style={i ? { borderTop: `1px solid ${LINE}` } : undefined}
              >
                <span className="font-semibold" style={{ color: INK }}>
                  {nom}
                </span>
                <span>{role}</span>
              </li>
            ))}
          </ul>
          <p>
            Les <strong style={{ color: INK }}>plateformes de réservation</strong> (Airbnb, Booking.com…)
            sont la source des données des voyageurs : elles les collectent sous leur propre
            responsabilité, selon leur propre politique de confidentialité.
          </p>
        </Bloc>

        <Bloc id="transferts" titre="5. Transferts hors de l’Union européenne">
          <p>
            Certains de ces prestataires sont établis hors de l’Union européenne, notamment aux États-Unis.
            Ces transferts sont encadrés par les garanties prévues par le RGPD (clauses contractuelles
            types de la Commission européenne ou, le cas échéant, Data Privacy Framework UE–États-Unis).
          </p>
        </Bloc>

        <Bloc id="cookies" titre="6. Cookies et traceurs">
          <p>
            Le site n’utilise <strong style={{ color: INK }}>aucun cookie publicitaire, aucun outil de
            mesure d’audience et aucun pixel de réseau social</strong>.
          </p>
          <p>
            Il garde seulement, dans votre navigateur, quelques informations nécessaires à son
            fonctionnement, qui ne servent pas à vous suivre et ne demandent donc pas votre consentement :
          </p>
          <ul className="list-disc pl-5 grid gap-1.5">
            <li>l’animation d’accueil déjà vue, le temps de votre visite ;</li>
            <li>l’annonce du Cercle Label Maison déjà vue, pour ne pas la remontrer avant 3 jours ;</li>
            <li>sur le Studio, votre photo et l’aperçu, gardés sur votre appareil 2 heures au plus, le temps du paiement ;</li>
            <li>
              pour l’espace interne de l’équipe (/erp et /linge), un cookie de session, strictement
              nécessaire à la connexion (30 jours).
            </li>
          </ul>
          <p>Quelques contenus viennent d’autres services, qui reçoivent alors votre adresse IP :</p>
          <ul className="list-disc pl-5 grid gap-1.5">
            <li>les polices de caractères, chargées depuis Google Fonts ;</li>
            <li>la carte de la page d’accueil, fournie par OpenStreetMap ;</li>
            <li>
              les cartes des logements de l’outil de gestion, de l’espace propriétaire et de l’espace
              opérations, dont le fond est fourni par OpenFreeMap (données OpenStreetMap) ;
            </li>
            <li>
              dans l’outil de gestion de l’équipe seulement, l’adresse d’un logement géré (rue, code postal,
              commune, sans aucun nom) envoyée au service public de géolocalisation de l’IGN
              (Géoplateforme), pour placer ce logement sur la carte ;
            </li>
            <li>
              les vidéos Instagram, TikTok et YouTube de la page d’accueil, chargées seulement si vous
              cliquez pour les lire : la plateforme concernée peut alors déposer ses propres cookies, selon
              sa propre politique.
            </li>
          </ul>
          <p>
            Les liens vers nos réseaux sociaux et vers WhatsApp sont de simples liens : rien n’est chargé
            tant que vous ne cliquez pas.
          </p>
        </Bloc>

        <Bloc id="droits" titre="7. Vos droits">
          <p>Vous pouvez à tout moment :</p>
          <ul className="list-disc pl-5 grid gap-1.5">
            <li>accéder à vos données et en obtenir une copie ;</li>
            <li>les faire rectifier ;</li>
            <li>les faire effacer ;</li>
            <li>
              vous opposer à leur traitement, en particulier à la prospection : il suffit de nous le dire,
              sans avoir à vous justifier ;
            </li>
            <li>en demander la limitation ;</li>
            <li>les récupérer dans un format courant, pour les transmettre à un autre service (portabilité) ;</li>
            <li>définir des directives sur leur sort après votre décès.</li>
          </ul>
          <p>
            Écrivez-nous à <LienEmail /> : nous répondons dans un délai d’un mois. Pour les données
            détenues par une plateforme de réservation, adressez-vous aussi à celle-ci.
          </p>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation
            auprès de la CNIL (
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" style={{ color: GOLD_DARK }}>
              cnil.fr
            </a>
            ).
          </p>
        </Bloc>

        <Bloc id="securite" titre="8. Sécurité">
          <p>
            L’accès à nos outils est réservé à l’équipe {EDITEUR}, protégé par mot de passe, et chacun n’y
            voit que ce dont il a besoin.
          </p>
          <p>
            L’intelligence artificielle n’est jamais utilisée pour prendre une décision automatisée
            produisant des effets juridiques à votre égard.
          </p>
        </Bloc>

        <Bloc titre="9. Mise à jour">
          <p>
            Cette politique évolue avec nos outils. Dernière mise à jour : {MAJ}.
          </p>
        </Bloc>

        <div
          className="mt-12 pt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-semibold"
          style={{ borderTop: `1px solid ${LINE}` }}
        >
          <Link to="/mentions-legales" style={{ color: GOLD_DARK }}>
            Mentions légales
          </Link>
          <Link to="/studio/conditions" style={{ color: GOLD_DARK }}>
            Conditions du Studio
          </Link>
        </div>
      </div>
    </main>
  );
}
