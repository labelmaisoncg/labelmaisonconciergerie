import { Helmet } from 'react-helmet-async';
import { Compass, Zap, Sparkles, Search } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  Section,
} from '../components/sections/PageBlocks';

const destinations = [
  {
    title: 'Paris',
    description: 'Croisière privée sur la Seine, rooftops avec vue Tour Eiffel, musées privés, shooting photo lifestyle, accès aux restaurants emblématiques.',
    image: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?auto=format&fit=crop&w=1200&q=80',
    badge: 'Capitale',
  },
  {
    title: 'Dubaï',
    description: 'Yacht privé au coucher du soleil, safari désert + dîner BBQ + spectacle, vol en hélicoptère sur la Palm Jumeirah, jet ski et restaurants iconiques.',
    image: 'https://images.unsplash.com/photo-1677151420167-b2de389d02db?auto=format&fit=crop&w=1200&q=80',
    badge: 'Émirats',
  },
  {
    title: 'Marrakech',
    description: 'Hammam royal et spa traditionnel, quad et désert d\'Agafay, dîner romantique en riad privatisé, escapades dans l\'Atlas.',
    image: 'https://images.unsplash.com/photo-1653323792487-6ecc6217040b?auto=format&fit=crop&w=1200&q=80',
    badge: 'Maroc',
  },
];

const experiences = [
  {
    icon: <Zap size={22} />,
    title: 'Aventure & adrénaline',
    description: 'Jet ski, parachute, héliski, courses sur circuit. Pour les amateurs de sensations fortes.',
  },
  {
    icon: <Sparkles size={22} />,
    title: 'Luxe & détente',
    description: 'Spa, hammam, yacht privé, dîner étoilé. Le pur plaisir du temps suspendu.',
  },
  {
    icon: <Compass size={22} />,
    title: 'Culture & découverte',
    description: 'Musées privés, châteaux, monuments avec guide expert. La culture sans la foule.',
  },
  {
    icon: <Search size={22} />,
    title: 'Sur mesure',
    description: "Un anniversaire, une demande en mariage, un événement intime. Dites-nous, nous l'organisons.",
  },
];

const steps = [
  { n: '01', title: 'Choisissez votre destination', text: 'Et précisez vos envies, votre budget, vos dates.' },
  { n: '02', title: 'Contactez-nous', text: 'Par message, formulaire ou téléphone. Nous répondons en quelques heures.' },
  { n: '03', title: 'Recevez des propositions', text: 'Sur mesure, négociées, avec photos et programme détaillé.' },
  { n: '04', title: 'Profitez sans souci', text: "Nous orchestrons, vous vivez l'instant. Notre équipe veille en coulisses." },
];

export function Activites() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Activités exclusives VIP · Paris, Dubaï, Marrakech · Label Maison</title>
        <meta
          name="description"
          content="Yacht privé Dubaï, croisière Seine, hammam royal Marrakech, shooting Tour Eiffel : expériences exclusives orchestrées sur mesure."
        />
      </Helmet>

      <PageHero
        badge="Expériences VIP"
        badgeIcon={<Compass size={14} />}
        titleStart="Vivre ce que peu"
        titleAccent="peuvent s'offrir"
        subtitle="L'exception n'attend pas. Yacht privé, hammam royal, dîner étoilé, shooting privatif : nous orchestrons les expériences que vous n'oublierez pas."
        imageUrl="https://images.unsplash.com/photo-1743819458014-f5cf74f175e3?auto=format&fit=crop&w=1600&q=80"
        imageAlt="Yacht privé au coucher du soleil"
        ctas={[{ label: 'Planifier une expérience', href: '/#contact', primary: true }]}
      />

      <Section bg="white">
        <SectionHeader
          eyebrow="Nos destinations"
          titleStart="Trois villes,"
          titleAccent="mille expériences"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {destinations.map((d) => (
            <FeatureCard
              key={d.title}
              image={d.image}
              imageAlt={d.title}
              title={d.title}
              description={d.description}
              badge={d.badge}
            />
          ))}
        </div>
      </Section>

      <Section bg="zinc">
        <SectionHeader
          eyebrow="Vos envies"
          titleStart="Quatre univers, votre"
          titleAccent="signature"
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {experiences.map((e) => (
            <FeatureCard key={e.title} icon={e.icon} title={e.title} description={e.description} />
          ))}
        </div>
      </Section>

      <Section bg="white">
        <SectionHeader
          eyebrow="Comment ça marche"
          titleStart="Quatre étapes,"
          titleAccent="zéro friction"
        />
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s) => (
            <li
              key={s.n}
              className="bg-white rounded-2xl p-6 md:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.07)] flex flex-col gap-3"
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#556B2F] text-white font-bold">
                {s.n}
              </span>
              <h3 className="text-[18px] font-semibold">{s.title}</h3>
              <p className="text-[14px] text-neutral-600 leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <FinalCta
        titleStart="Planifiez votre"
        titleAccent="expérience"
        subtitle="Décrivez-nous votre rêve : destination, ambiance, personnes, dates. Nous orchestrons l'expérience qui correspondra."
        ctaLabel="Nous contacter"
        ctaHref="/#contact"
      />
    </div>
  );
}
