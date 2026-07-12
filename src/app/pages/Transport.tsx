import { Helmet } from 'react-helmet-async';
import { Car, ShieldCheck, Plane, CalendarClock, Route, Truck } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  ProofVideo,
  MediaCarousel,
  Section,
} from '../components/sections/PageBlocks';

const vehicles = [
  {
    title: 'Mercedes Classe G',
    description: "L'icône tout-terrain de luxe. Présence, confort et sécurité pour vos déplacements en ville comme en escapade.",
    image: '/images/real/g-wagon.jpg',
    badge: 'Iconique',
  },
  {
    title: 'Lamborghini Urus',
    description: 'Le super-SUV. Sensations et prestige pour ceux qui veulent marquer chaque arrivée.',
    image: '/images/real/lamborghini.jpg',
    badge: 'Sport',
  },
  {
    title: 'McLaren',
    description: "L'exception à l'état pur. Une supercar pour les occasions qui ne se répètent pas.",
    image: '/images/real/voiture-sport.jpg',
    badge: 'Supercar',
  },
  {
    title: 'Ferrari',
    description: 'Le mythe italien. Louez la légende, avec chauffeur ou pour vous-même.',
    image: '/images/real/ferrari.jpg',
    badge: 'Exclusif',
  },
  {
    title: 'Berline & intérieur VIP',
    description: "L'élégance discrète pour vos trajets professionnels et transferts, dans un habitacle soigné.",
    image: '/images/real/voiture-vip-interieur.jpeg',
    badge: 'Élégance',
  },
  {
    title: 'Van premium',
    description: 'Pour vos déplacements en groupe ou avec bagages. Espace, confort et discrétion.',
    image: '/images/real/mercedes-van.jpg',
    badge: 'Groupe',
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

      <ProofVideo
        eyebrow="En vidéo · Coulisses"
        titleStart="L'accueil"
        titleAccent="fait toute la différence"
        text="Chaque déplacement devient un privilège : accueil personnalisé, attentions, coordination parfaite. Voici un vrai moment client, capté sur le terrain."
        videoSrc="/videos/proof-client-retour.mp4"
        poster="/images/real/proof-client-retour-poster.jpg"
        caption="Accueil client · fleurs & attentions"
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

      <ProofVideo
        bg="white"
        eyebrow="En vidéo · Flotte"
        titleStart="Une flotte"
        titleAccent="à la hauteur de vos trajets"
        text="Berlines, SUV, sportives et vans premium, coordonnés avec des chauffeurs formés, à Paris comme à l'international. Un aperçu réel de nos prestations."
        videoSrc="/videos/proof-transport.mp4"
        poster="/images/real/proof-transport-poster.jpg"
        caption="Transport privé"
        reverse
      />

      <MediaCarousel
        bg="zinc"
        cta={{ label: 'Réserver un chauffeur', href: '/#contact' }}
        eyebrow="La flotte en images"
        titleStart="Notre univers"
        titleAccent="mobilité"
        subtitle="Voitures d'exception, transferts privés et arrivées soignées, en images réelles."
        items={[
          { type: 'video', src: '/videos/transport-lambo.mp4', poster: '/images/real/transport-lambo-poster.jpg', label: 'Lamborghini Urus' },
          { type: 'image', src: '/images/real/lamborghini.jpg', label: 'Lamborghini' },
          { type: 'video', src: '/videos/proof-voiture-nuit.mp4', poster: '/images/real/proof-voiture-nuit-poster.jpg', label: 'De nuit' },
          { type: 'image', src: '/images/real/g-wagon.jpg', label: 'Mercedes Classe G' },
          { type: 'image', src: '/images/real/voiture-sport.jpg', label: 'McLaren' },
          { type: 'video', src: '/videos/proof-transport.mp4', poster: '/images/real/proof-transport-poster.jpg', label: 'Transport privé' },
          { type: 'image', src: '/images/real/ferrari.jpg', label: 'Ferrari' },
          { type: 'image', src: '/images/real/voiture-vip-interieur.jpeg', label: 'Intérieur VIP' },
          { type: 'video', src: '/videos/proof-arrivee.mp4', poster: '/images/real/proof-arrivee-poster.jpg', label: 'Arrivée' },
          { type: 'image', src: '/images/real/mercedes-van.jpg', label: 'Van premium' },
        ]}
      />

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
