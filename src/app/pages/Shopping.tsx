import { Helmet } from 'react-helmet-async';
import {
  ShoppingBag,
  Sparkles,
  Search,
  ShieldCheck,
  Truck,
  HeartHandshake,
  TrendingUp,
} from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  ProofVideo,
  MediaCarousel,
  Section,
} from '../components/sections/PageBlocks';

const categories = [
  {
    title: 'Haute horlogerie',
    description: 'Rolex, Patek Philippe, Audemars Piguet, Richard Mille. Pièces rares, éditions limitées, sourcing international.',
    image: '/images/real/montre-rolex-datejust-bleue.png',
    imageFit: 'contain' as const,
    badge: 'Watches',
  },
  {
    title: 'Mode & maroquinerie',
    description: 'Hermès, Chanel, Louis Vuitton. Birkin sur liste d\'attente, créations exclusives, sur mesure haute couture.',
    image: '/images/real/louis-vuitton.jpg',
    badge: 'Fashion',
  },
  {
    title: 'Joaillerie',
    description: 'Cartier, Van Cleef & Arpels, Bulgari. Diamants certifiés GIA, pièces d\'exception, créations sur mesure.',
    image: 'https://images.unsplash.com/photo-1640724390912-4d92d9a985fe?auto=format&fit=crop&w=1200&q=80',
    badge: 'Jewelry',
  },
  {
    title: 'Sur mesure',
    description: 'Tout ce qui fait l\'objet de votre désir, nous le trouvons. Dites-nous, nous sourçons.',
    image: '/images/real/pshop-cadeau.jpg',
    badge: 'Custom',
  },
];

const expertise = [
  {
    icon: <Search size={22} />,
    title: 'Sourcing pièces rares',
    description: "Recherche internationale, accès aux waiting lists, éditions limitées et pièces collector.",
  },
  {
    icon: <HeartHandshake size={22} />,
    title: 'Négociation discrète',
    description: 'Acquisition au juste prix, sans révéler votre identité. Anonymat préservé tout au long.',
  },
  {
    icon: <ShieldCheck size={22} />,
    title: 'Authentification',
    description: 'Expertise par horlogers, joailliers et maisons certifiées avant toute transaction.',
  },
  {
    icon: <Truck size={22} />,
    title: 'Livraison sécurisée',
    description: 'Transport assuré jusqu\'à votre domicile, n\'importe où dans le monde.',
  },
  {
    icon: <Sparkles size={22} />,
    title: 'Service après-vente',
    description: 'Entretien, polissage, révisions périodiques avec les ateliers officiels des maisons.',
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Conseil investissement',
    description: 'Pièces à fort potentiel de plus-value, marché secondaire, valorisation patrimoniale.',
  },
];

export function Shopping() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Personal Shopping · Horlogerie, mode, joaillerie · Label Maison</title>
        <meta
          name="description"
          content="Sourcing de pièces rares : Rolex, Hermès Birkin, Patek Philippe, Cartier. Authentification, négociation discrète, livraison sécurisée mondiale."
        />
      </Helmet>

      <PageHero
        badge="Acquisitions discrètes"
        badgeIcon={<ShoppingBag size={14} />}
        titleStart="L'exclusivité"
        titleAccent="sur demande"
        subtitle="Ce que vous désirez, nous le trouvons. Pièces rares, éditions limitées, sur-mesure : notre réseau international source les acquisitions les plus exigeantes."
        imageUrl="/images/real/montre-rolex-gmt.jpeg"
        imageAlt="Rolex GMT-Master II sourcée par Label Maison Conciergerie"
        ctas={[{ label: 'Demande personnalisée', href: '/#contact', primary: true }]}
      />

      <ProofVideo
        eyebrow="En vidéo · Acquisitions"
        titleStart="Des pièces"
        titleAccent="qui se portent, pas qui s'exposent"
        text="Haute horlogerie sourcée, authentifiée et livrée en main propre. « Pièce récupérée cet après-midi pour un client » : un vrai moment, en toute discrétion."
        videoSrc="/videos/proof-montre-client.mp4"
        poster="/images/real/proof-montre-client-poster.jpg"
        caption="Pièce récupérée pour un client"
      />

      <ProofVideo
        bg="white"
        eyebrow="En vidéo · Joaillerie"
        titleStart="La pièce"
        titleAccent="qui vous ressemble"
        text="Diamants, joaillerie et pièces d'exception, sourcés et authentifiés. Un aperçu réel des acquisitions confiées à Label Maison."
        videoSrc="/videos/proof-bijou-client.mp4"
        poster="/images/real/proof-bijou-client-poster.jpg"
        caption="Bracelet joaillerie sur mesure"
        reverse
      />

      <Section bg="white">
        <SectionHeader
          eyebrow="Nos spécialités"
          titleStart="Quatre univers,"
          titleAccent="un même savoir-faire"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
          {categories.map((c) => (
            <FeatureCard
              key={c.title}
              image={c.image}
              imageAlt={c.title}
              imageFit={'imageFit' in c ? c.imageFit : 'cover'}
              title={c.title}
              description={c.description}
              badge={c.badge}
            />
          ))}
        </div>
      </Section>

      <Section bg="zinc">
        <SectionHeader
          eyebrow="Notre expertise"
          titleStart="Six étapes pour"
          titleAccent="une acquisition parfaite"
          subtitle="De la recherche à la livraison, chaque étape est gérée par nos experts pour vous garantir authenticité, prix juste et discrétion."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {expertise.map((e) => (
            <FeatureCard key={e.title} icon={e.icon} title={e.title} description={e.description} />
          ))}
        </div>
      </Section>

      <MediaCarousel
        bg="zinc"
        eyebrow="Acquisitions en images"
        titleStart="Des pièces"
        titleAccent="d'exception"
        subtitle="Horlogerie, joaillerie, maroquinerie et mode : de vraies acquisitions confiées à Label Maison. Faites glisser pour explorer."
        items={[
          { type: 'video', src: '/videos/shopping-montre2.mp4', poster: '/images/real/shopping-montre2-poster.jpg', label: 'Rolex GMT · récupérée' },
          { type: 'video', src: '/videos/proof-montre-client.mp4', poster: '/images/real/proof-montre-client-poster.jpg', label: 'Rolex · client' },
          { type: 'video', src: '/videos/shopping-bijoux2.mp4', poster: '/images/real/shopping-bijoux2-poster.jpg', label: 'Joaillerie' },
          { type: 'video', src: '/videos/proof-bijou-client.mp4', poster: '/images/real/proof-bijou-client-poster.jpg', label: 'Bijou · client' },
          { type: 'image', src: '/images/real/rolex-gmt-poignet.jpg', label: 'Rolex GMT' },
          { type: 'image', src: '/images/real/louis-vuitton.jpg', label: 'Louis Vuitton' },
          { type: 'image', src: '/images/real/montre-rolex-datejust.jpeg', label: 'Rolex Datejust' },
          { type: 'image', src: '/images/real/rolex-coffret.jpg', label: 'Coffret' },
          { type: 'image', src: '/images/real/amiri-boutique.jpg', label: 'Mode' },
          { type: 'image', src: '/images/real/pshop-cadeau.jpg', label: 'Sur mesure' },
        ]}
        cta={{ label: 'Demande personnalisée', href: '/#contact' }}
      />

      <FinalCta
        titleStart="Confiez-nous"
        titleAccent="vos recherches"
        subtitle="Décrivez la pièce de vos rêves : marque, modèle, référence si connue. Nous activons notre réseau et revenons vers vous sous 48h. Discrétion garantie."
        ctaLabel="Demande personnalisée"
        ctaHref="/#contact"
      />
    </div>
  );
}
