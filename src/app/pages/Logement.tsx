import { Helmet } from 'react-helmet-async';
import { Bed, Sparkles, HeartHandshake, Shield } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
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
    image: 'https://images.unsplash.com/photo-1762085407076-69a9594a2c94?auto=format&fit=crop&w=1200&q=80',
    badge: 'Citadin',
  },
  {
    title: 'Suites & Love Rooms',
    description: 'Jacuzzi, ambiance romantique, service discret. Pour des moments d\'exception.',
    image: 'https://images.unsplash.com/photo-1588719850278-bbf84f1fc57f?auto=format&fit=crop&w=1200&q=80',
    badge: 'Romantique',
  },
  {
    title: 'Villas & Penthouses',
    description: 'Piscine, terrasse, services personnalisés. Le grand luxe à votre image.',
    image: 'https://images.unsplash.com/photo-1519380400109-9ef80d934359?auto=format&fit=crop&w=1200&q=80',
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
        imageUrl="https://images.unsplash.com/photo-1592229506151-845940174bb0?auto=format&fit=crop&w=1600&q=80"
        imageAlt="Salon luxueux à Paris"
        ctas={[{ label: 'Réserver un séjour', href: '/#contact', primary: true }]}
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
