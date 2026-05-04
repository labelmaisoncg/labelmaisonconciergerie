import { Helmet } from 'react-helmet-async';
import { Plane, Crown, Zap, Clock } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
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
        subtitle="Du sol au ciel, tout est orchestré. Jets privés, première classe et business sur les meilleures compagnies du monde — réservation en quelques heures."
        imageUrl="https://images.unsplash.com/photo-1545610095-4d00a3f4f547?auto=format&fit=crop&w=1600&q=80"
        imageAlt="Cabine première classe luxe"
        ctas={[{ label: 'Réserver mon vol', href: '/#contact', primary: true }]}
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
