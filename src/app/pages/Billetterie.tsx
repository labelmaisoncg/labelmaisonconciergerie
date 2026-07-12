import { Helmet } from 'react-helmet-async';
import { Plane, Crown, Zap, Clock } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  ProofVideo,
  MediaCarousel,
  Section,
} from '../components/sections/PageBlocks';

const benefits = [
  {
    icon: <Plane size={22} />,
    title: 'Vols privés',
    description: 'Jets privés et hélicoptères pour vos déplacements en toute discrétion.',
  },
  {
    icon: <Crown size={22} />,
    title: 'Première classe',
    description: 'Les meilleures cabines du monde : Emirates, Qatar Airways, Singapore Airlines.',
  },
  {
    icon: <Zap size={22} />,
    title: 'Priorité totale',
    description: 'Fast track aéroport, salons VIP, transferts limousine inclus à chaque voyage.',
  },
  {
    icon: <Clock size={22} />,
    title: 'Disponibilité 24/7',
    description: 'Réservation instantanée, même à la dernière minute. Notre équipe est joignable en permanence.',
  },
];

const cabins = [
  {
    title: 'Business Class',
    description: "Sièges lie-flat, lounges privés, transferts inclus. Le confort premium pour vos voyages d'affaires.",
    image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1200&q=80',
    badge: 'Emirates · Qatar',
  },
  {
    title: 'Première Classe',
    description: "Suites privées, douche en vol, champagne Krug. L'expérience aérienne ultime.",
    image: 'https://images.unsplash.com/photo-1540339832862-474599807836?auto=format&fit=crop&w=1200&q=80',
    badge: 'Qatar Airways',
  },
  {
    title: 'Jet Privé',
    description: "Vol sur mesure, départ quand vous voulez, depuis l'aéroport de votre choix. Discrétion totale.",
    image: 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?auto=format&fit=crop&w=1200&q=80',
    badge: 'Sur mesure',
  },
];

export function Billetterie() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Billetterie d'avion · Vols privés et première classe · Label Maison</title>
        <meta
          name="description"
          content="Réservation de vols premium : jets privés, première classe Emirates, Qatar Airways. Notre équipe orchestre vos voyages 24/7 avec discrétion."
        />
      </Helmet>

      <PageHero
        badge="Voyage premium"
        badgeIcon={<Plane size={14} />}
        titleStart="Voyager n'est plus"
        titleAccent="une contrainte"
        subtitle="Du sol au ciel, tout est orchestré. Jets privés, première classe et business sur les meilleures compagnies du monde. Réservation en quelques heures."
        imageUrl="/images/real/billetterie-avion.jpg"
        imageAlt="Vol premium au-dessus des nuages"
        ctas={[{ label: 'Réserver mon vol', href: '/#contact', primary: true }]}
      />

      <ProofVideo
        eyebrow="En vidéo · En vol"
        titleStart="Du sol au ciel,"
        titleAccent="tout est orchestré"
        text="Première classe, business, jet privé : nous réservons et coordonnons chaque étape. Un instant réel, capté au-dessus des nuages."
        videoSrc="/videos/proof-avion.mp4"
        poster="/images/real/proof-avion-poster.jpg"
        caption="Au-dessus des nuages"
      />

      <Section bg="white">
        <SectionHeader
          eyebrow="Notre expertise"
          titleStart="Tout est"
          titleAccent="orchestré"
          titleEnd="pour votre confort"
          subtitle="De la sélection de la compagnie au transfert depuis l'aéroport, chaque détail est anticipé."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b) => (
            <FeatureCard key={b.title} {...b} />
          ))}
        </div>
      </Section>

      <Section bg="zinc">
        <SectionHeader
          eyebrow="Nos cabines"
          titleStart="Trois façons de"
          titleAccent="prendre les airs"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {cabins.map((c) => (
            <FeatureCard
              key={c.title}
              image={c.image}
              imageAlt={c.title}
              title={c.title}
              description={c.description}
              badge={c.badge}
            />
          ))}
        </div>
      </Section>

      <MediaCarousel
        bg="zinc"
        eyebrow="Destinations en images"
        titleStart="Le voyage,"
        titleAccent="orchestré de bout en bout"
        subtitle="Du vol premium aux plus belles destinations : Dubaï, Marrakech, Ibiza, Rome. Faites glisser pour explorer."
        items={[
          { type: 'video', src: '/videos/proof-avion.mp4', poster: '/images/real/proof-avion-poster.jpg', label: 'Au-dessus des nuages' },
          { type: 'video', src: '/videos/activite-skyline-nuit.mp4', poster: '/images/real/activite-skyline-nuit-poster.jpg', label: 'Dubaï by night' },
          { type: 'video', src: '/videos/activite-croisiere-nuit.mp4', poster: '/images/real/activite-croisiere-nuit-poster.jpg', label: 'Croisière nocturne' },
          { type: 'image', src: '/images/real/billetterie-avion.jpg', label: 'Vol premium' },
          { type: 'image', src: '/images/real/dubai-skyline.jpg', label: 'Dubaï' },
          { type: 'image', src: '/images/real/dubai-marina.jpg', label: 'Dubaï Marina' },
          { type: 'image', src: '/images/real/marrakech-menara.jpg', label: 'Marrakech' },
          { type: 'image', src: '/images/real/ibiza.jpg', label: 'Ibiza' },
          { type: 'image', src: '/images/real/rome-colisee.jpg', label: 'Rome' },
        ]}
        cta={{ label: 'Réserver mon voyage', href: '/#contact' }}
      />

      <FinalCta
        titleStart="Réservez votre"
        titleAccent="prochain voyage"
        subtitle="Notre équipe vous propose les meilleures options selon votre destination, vos dates et votre budget. Réponse sous 2 heures."
        ctaLabel="Nous contacter"
        ctaHref="/#contact"
      />
    </div>
  );
}
