import { Helmet } from 'react-helmet-async';
import { Bed, Sparkles, HeartHandshake, Shield } from 'lucide-react';
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
    icon: <Bed size={22} />,
    title: 'Confort garanti',
    description: 'Literie haut de gamme, équipements modernes, propreté irréprochable à chaque arrivée.',
  },
  {
    icon: <Sparkles size={22} />,
    title: 'Service premium',
    description: 'Accueil personnalisé ou autonome, assistance 7j/7, conciergerie sur place ou à distance.',
  },
  {
    icon: <HeartHandshake size={22} />,
    title: 'Expérience complète',
    description: "Transfert privé, activités, billetterie d'avion : tout coordonné par notre équipe.",
  },
  {
    icon: <Shield size={22} />,
    title: 'Sécurité & tranquillité',
    description: "Contrôle d'identité, assurance, assistance pendant tout votre séjour.",
  },
];

const residences = [
  {
    title: 'Studios & Appartements',
    description: 'Espaces raffinés pour vos séjours urbains, idéalement placés à Paris.',
    image: '/images/real/suite-hotel.jpg',
    badge: 'Citadin',
  },
  {
    title: 'Suites & Love Rooms',
    description: 'Jacuzzi, ambiance romantique, service discret. Pour des moments d\'exception.',
    image: '/images/real/jacuzzi.jpg',
    badge: 'Romantique',
  },
  {
    title: 'Villas & Penthouses',
    description: 'Piscine, terrasse, services personnalisés. Le grand luxe à votre image.',
    image: '/images/real/desert-pool.jpg',
    badge: 'Prestige',
  },
];

export function Logement() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Logements d'exception · Suites, villas et penthouses · Label Maison</title>
        <meta
          name="description"
          content="Studios élégants, suites avec jacuzzi, villas et penthouses : des lieux à la hauteur de votre style de vie. Service conciergerie inclus."
        />
      </Helmet>

      <PageHero
        badge="Résidences premium"
        badgeIcon={<Bed size={14} />}
        titleStart="Plus qu'un logement,"
        titleAccent="une signature"
        subtitle="Des lieux à la hauteur de votre style de vie. De l'appartement parisien au penthouse avec piscine, chaque résidence est sélectionnée et inspectée par nos soins."
        imageUrl="/images/real/hero-logement-exception.jpg"
        imageAlt="Terrasse avec piscine à débordement et vue panoramique, logement d'exception Label Maison"
        ctas={[{ label: 'Réserver un séjour', href: '/#contact', primary: true }]}
      />

      <ProofVideo
        eyebrow="En vidéo · Visite"
        titleStart="Des intérieurs"
        titleAccent="pensés dans le moindre détail"
        text="Chaque bien est sélectionné, préparé et inspecté par nos soins avant votre arrivée. Visite réelle d'un logement géré par Label Maison."
        videoSrc="/videos/proof-logement.mp4"
        poster="/images/real/proof-logement-poster.jpg"
        caption="Visite d'un bien géré"
      />

      <Section bg="white">
        <SectionHeader
          eyebrow="Pourquoi nous"
          titleStart="L'excellence dans"
          titleAccent="chaque détail"
          subtitle="Chaque résidence est inspectée, équipée et entretenue selon nos standards premium pour garantir un séjour sans accroc."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b) => (
            <FeatureCard key={b.title} {...b} />
          ))}
        </div>
      </Section>

      <Section bg="zinc">
        <SectionHeader
          eyebrow="Nos résidences"
          titleStart="Trois univers,"
          titleAccent="une même exigence"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {residences.map((r) => (
            <FeatureCard
              key={r.title}
              image={r.image}
              imageAlt={r.title}
              title={r.title}
              description={r.description}
              badge={r.badge}
            />
          ))}
        </div>
      </Section>

      <ProofVideo
        eyebrow="Nouveau · Love Rooms"
        titleStart="Suites romantiques &"
        titleAccent="Love Rooms d'exception"
        text="Jacuzzi privatif, lumière tamisée, pétales et attentions sur mesure : une parenthèse hors du temps, mise en scène dans le plus grand soin du détail. Service discret, réservation confidentielle."
        videoSrc="/videos/loveroom-petales.mp4"
        poster="/images/real/loveroom-petales-poster.jpg"
        caption="Mise en scène Love Room"
      />

      <MediaCarousel
        bg="zinc"
        eyebrow="Nos résidences en images"
        titleStart="Des intérieurs"
        titleAccent="d'exception"
        subtitle="Love Rooms, suites, jacuzzis, riads et vues panoramiques : un aperçu réel des biens que nous gérons. Faites glisser pour explorer."
        items={[
          { type: 'video', src: '/videos/loveroom-jacuzzi.mp4', poster: '/images/real/loveroom-jacuzzi-poster.jpg', label: 'Love Room · Jacuzzi' },
          { type: 'video', src: '/videos/loveroom-petales.mp4', poster: '/images/real/loveroom-petales-poster.jpg', label: 'Ambiance romantique' },
          { type: 'video', src: '/videos/logement-salon.mp4', poster: '/images/real/logement-salon-poster.jpg', label: 'Salon design' },
          { type: 'video', src: '/videos/logement-chambre2.mp4', poster: '/images/real/logement-chambre2-poster.jpg', label: 'Chambre' },
          { type: 'video', src: '/videos/logement-riad.mp4', poster: '/images/real/logement-riad-poster.jpg', label: 'Riad' },
          { type: 'video', src: '/videos/logement-sdb.mp4', poster: '/images/real/logement-sdb-poster.jpg', label: 'Salle de bain' },
          { type: 'video', src: '/videos/proof-logement.mp4', poster: '/images/real/proof-logement-poster.jpg', label: "Visite d'un bien" },
          { type: 'image', src: '/images/real/hero-logement-exception.jpg', label: 'Terrasse piscine' },
          { type: 'image', src: '/images/real/jacuzzi.jpg', label: 'Jacuzzi' },
          { type: 'image', src: '/images/real/desert-pool.jpg', label: 'Piscine' },
        ]}
        cta={{ label: 'Réserver un séjour', href: '/#contact' }}
      />

      <FinalCta
        titleStart="Réservez votre"
        titleAccent="séjour signature"
        subtitle="Décrivez-nous votre projet : lieu, dates, ambiance recherchée. Nous vous proposons les résidences qui correspondent à vos envies."
        ctaLabel="Nous contacter"
        ctaHref="/#contact"
      />
    </div>
  );
}
