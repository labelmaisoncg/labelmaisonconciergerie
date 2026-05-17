import { Helmet } from 'react-helmet-async';
import { Car, ShieldCheck, Plane, CalendarClock, Route, Truck } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  Section,
} from '../components/sections/PageBlocks';

const vehicles = [
  {
    title: 'Berlines de luxe',
    description: "Mercedes Classe S, BMW Série 7, Audi A8. L'élégance discrète pour vos déplacements urbains et professionnels.",
    image: 'https://images.unsplash.com/photo-1597509560792-796c8682d017?auto=format&fit=crop&w=1200&q=80',
    badge: 'Classique',
  },
  {
    title: 'SUV premium',
    description: 'Mercedes Classe G, Range Rover, BMW X7. Pour vos déplacements en groupe ou avec bagages volumineux.',
    image: 'https://images.unsplash.com/photo-1739950075618-f9ae2f90b0c0?auto=format&fit=crop&w=1200&q=80',
    badge: 'Polyvalent',
  },
  {
    title: 'Véhicules blindés',
    description: "Pour les déplacements à haut niveau de sécurité. Conducteurs formés, discrétion absolue.",
    image: 'https://images.unsplash.com/photo-1637252166739-b47f8875f304?auto=format&fit=crop&w=1200&q=80',
    badge: 'Sécurité',
  },
];

const services = [
  {
    icon: <Plane size={22} />,
    title: 'Transferts aéroport VIP',
    description: 'Accueil personnalisé, prise en charge des bagages, fast track aéroport selon les compagnies.',
  },
  {
    icon: <CalendarClock size={22} />,
    title: 'Mise à disposition',
    description: 'Chauffeur dédié à la journée ou à la demi-journée pour vos rendez-vous et obligations.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Événementiel',
    description: 'Mariages, soirées, conférences. Une flotte coordonnée pour vos invités VIP.',
  },
  {
    icon: <Route size={22} />,
    title: 'Location longue durée',
    description: 'Véhicule + chauffeur pour vos séjours à Paris, sur la Côte d\'Azur ou à l\'international.',
  },
  {
    icon: <Car size={22} />,
    title: 'Circuits privés',
    description: 'Découverte de Paris, châteaux de la Loire, Provence. Itinéraires sur mesure avec guide.',
  },
  {
    icon: <Truck size={22} />,
    title: 'Convoyage',
    description: 'Transfert de véhicules entre vos résidences, domiciles, garages. Discrétion garantie.',
  },
];

export function Transport() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Transport privé · Berlines, SUV, véhicules blindés · Label Maison</title>
        <meta
          name="description"
          content="Chauffeur privé à Paris et international : berlines de luxe, SUV premium, véhicules blindés. Disponibilité 24/7."
        />
      </Helmet>

      <PageHero
        badge="Mobilité haut de gamme"
        badgeIcon={<Car size={14} />}
        titleStart="Chaque déplacement devient"
        titleAccent="un privilège"
        subtitle="Arrivez avec élégance. Une flotte premium, des chauffeurs formés et une coordination parfaite pour tous vos trajets, à Paris comme à l'international."
        imageUrl="/images/real/voiture-vip-interieur.jpeg"
        imageAlt="Intérieur d'un véhicule premium Label Maison Conciergerie"
        ctas={[{ label: 'Réserver un chauffeur', href: '/#contact', primary: true }]}
      />

      <Section bg="white">
        <SectionHeader
          eyebrow="Notre flotte"
          titleStart="Le véhicule adapté à"
          titleAccent="chaque mission"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {vehicles.map((v) => (
            <FeatureCard
              key={v.title}
              image={v.image}
              imageAlt={v.title}
              title={v.title}
              description={v.description}
              badge={v.badge}
            />
          ))}
        </div>
      </Section>

      <Section bg="zinc">
        <SectionHeader
          eyebrow="Nos prestations"
          titleStart="Six services pour"
          titleAccent="chaque besoin"
          subtitle="Réservation 24/7, chauffeur dédié, véhicules entretenus selon les standards premium."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s) => (
            <FeatureCard key={s.title} icon={s.icon} title={s.title} description={s.description} />
          ))}
        </div>
      </Section>

      <FinalCta
        titleStart="Réservez votre"
        titleAccent="chauffeur"
        subtitle="Précisez votre besoin : trajet ponctuel, mise à disposition, transfert aéroport ou événement. Nous coordonnons toute la prestation."
        ctaLabel="Nous contacter"
        ctaHref="/#contact"
      />
    </div>
  );
}
