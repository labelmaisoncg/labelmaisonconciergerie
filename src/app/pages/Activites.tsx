import { Helmet } from 'react-helmet-async';
import { Compass, Zap, Sparkles, Search } from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  ProofVideo,
  MediaCarousel,
  Section,
} from '../components/sections/PageBlocks';

const destinations = [
  {
    title: 'Dubaï',
    description: 'Yacht privé au coucher du soleil, jet ski devant le Burj Al Arab, safari désert, hélicoptère sur la Palm. L\'exception à chaque instant.',
    image: '/images/real/activites-jetski-burj.jpg',
    badge: 'Émirats',
  },
  {
    title: 'Marrakech',
    description: 'Hammam royal et spa traditionnel, quad et désert d\'Agafay, dîner en riad privatisé, escapades dans l\'Atlas.',
    image: '/images/real/marrakech-menara.jpg',
    badge: 'Maroc',
  },
  {
    title: 'Ibiza',
    description: 'Sorties en mer, beach clubs privatisés, villas avec vue, soirées d\'exception. L\'île de tous les possibles.',
    image: '/images/real/ibiza.jpg',
    badge: 'Baléares',
  },
  {
    title: 'Rome',
    description: 'Visites privées hors foule, tables mythiques, chauffeur et guide dédiés. La dolce vita, orchestrée.',
    image: '/images/real/rome-colisee.jpg',
    badge: 'Italie',
  },
  {
    title: 'Paris',
    description: 'Croisière privée sur la Seine, rooftops avec vue Tour Eiffel, musées privés, accès aux restaurants emblématiques.',
    image: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?auto=format&fit=crop&w=1200&q=80',
    badge: 'Capitale',
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
        imageUrl="/images/real/activites-jetski-burj.jpg"
        imageAlt="Jet ski devant le Burj Al Arab à Dubaï"
        ctas={[{ label: 'Planifier une expérience', href: '/#contact', primary: true }]}
      />

      <ProofVideo
        eyebrow="En vidéo · Dubaï"
        titleStart="Des expériences"
        titleAccent="que peu peuvent s'offrir"
        text="Yacht, jet ski, fontaines de Dubaï au coucher du soleil… Voici un aperçu réel des moments que nous orchestrons pour nos clients."
        videoSrc="/videos/proof-dubai-fontaines.mp4"
        poster="/images/real/proof-dubai-fontaines-poster.jpg"
        caption="Fontaines de Dubaï"
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
              className="bg-white rounded-2xl border border-[#ECE3D0] p-6 md:p-7 shadow-[0_4px_24px_rgba(64,49,24,0.08)] flex flex-col gap-3"
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#A97C30] text-white font-bold">
                {s.n}
              </span>
              <h3 className="text-[18px] font-semibold">{s.title}</h3>
              <p className="text-[14px] text-neutral-600 leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <MediaCarousel
        cta={{ label: 'Planifier une expérience', href: '/#contact' }}
        eyebrow="Expériences en images"
        titleStart="Un aperçu réel de nos"
        titleAccent="moments d'exception"
        subtitle="Yachts, jet-ski, quad dans le désert, fontaines de Dubaï, escapades à Marrakech, Ibiza, Rome."
        items={[
          { type: 'video', src: '/videos/activite-jetski2.mp4', poster: '/images/real/activite-jetski2-poster.jpg', label: 'Jet-ski · Dubaï' },
          { type: 'video', src: '/videos/activite-catamaran2.mp4', poster: '/images/real/activite-catamaran2-poster.jpg', label: 'Catamaran' },
          { type: 'video', src: '/videos/activite-quad2.mp4', poster: '/images/real/activite-quad2-poster.jpg', label: 'Quad · Agafay' },
          { type: 'video', src: '/videos/activite-fontaines2.mp4', poster: '/images/real/activite-fontaines2-poster.jpg', label: 'Fontaines · nuit' },
          { type: 'video', src: '/videos/activite-croisiere-nuit.mp4', poster: '/images/real/activite-croisiere-nuit-poster.jpg', label: 'Croisière nocturne' },
          { type: 'video', src: '/videos/activite-skyline-nuit.mp4', poster: '/images/real/activite-skyline-nuit-poster.jpg', label: 'Skyline by night' },
          { type: 'video', src: '/videos/activite-fontaines3.mp4', poster: '/images/real/activite-fontaines3-poster.jpg', label: 'Fontaines de Dubaï' },
          { type: 'video', src: '/videos/activite-jetski3.mp4', poster: '/images/real/activite-jetski3-poster.jpg', label: 'Jet-ski' },
          { type: 'video', src: '/videos/life-jetski.mp4', poster: '/images/real/life-jetski-poster.jpg', label: 'Jet-ski' },
          { type: 'image', src: '/images/real/activites-jetski-burj.jpg', label: 'Burj Al Arab' },
          { type: 'video', src: '/videos/life-catamaran.mp4', poster: '/images/real/life-catamaran-poster.jpg', label: 'En mer' },
          { type: 'image', src: '/images/real/yacht-82.jpg', label: 'Yacht 82ft' },
          { type: 'video', src: '/videos/life-quad.mp4', poster: '/images/real/life-quad-poster.jpg', label: 'Quad · désert' },
          { type: 'image', src: '/images/real/marrakech-menara.jpg', label: 'Marrakech' },
          { type: 'video', src: '/videos/proof-dubai-fontaines.mp4', poster: '/images/real/proof-dubai-fontaines-poster.jpg', label: 'Fontaines de Dubaï' },
          { type: 'image', src: '/images/real/ibiza.jpg', label: 'Ibiza' },
          { type: 'video', src: '/videos/life-burj.mp4', poster: '/images/real/life-burj-poster.jpg', label: 'Burj Al Arab' },
          { type: 'image', src: '/images/real/yacht-55.jpg', label: 'Yacht 55ft' },
          { type: 'image', src: '/images/real/rome-colisee.jpg', label: 'Rome' },
          { type: 'image', src: '/images/real/dubai-marina.jpg', label: 'Dubaï Marina' },
        ]}
      />

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
