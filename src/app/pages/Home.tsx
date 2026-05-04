import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  Phone,
  MapPin,
  Mail,
  Instagram,
  Music,
  ChevronDown,
  Send,
  CheckCircle2,
  Star,
  Home as HomeIcon,
  Plane,
  Bed,
  Car,
  Compass,
  ShoppingBag,
  Sparkles,
  Zap,
  Cpu,
  ClipboardCheck,
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';
const EMAIL = 'contact@labelmaisoncgexperience.fr';

// =============================================================================
// HERO
// =============================================================================
function HeroSection() {
  return (
    <section className="relative bg-zinc-100 overflow-hidden">
      <div className="max-w-[1336px] mx-auto px-6 md:px-12 pt-[120px] md:pt-[160px] pb-12 md:pb-0 flex flex-col md:flex-row gap-10 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-20 flex flex-col items-center md:items-start text-center md:text-left gap-6 md:w-3/5 md:pr-12 md:pb-[120px]"
        >
          <span className="inline-flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full text-[13px] font-medium">
            <MapPin size={14} /> Paris · International
          </span>

          <h1 className="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight">
            Conciergerie privée haut de gamme :{' '}
            <span className="font-serif-italic font-bold text-[#556B2F]">services sur mesure</span>{' '}
            pour une clientèle d'exception
          </h1>

          <p className="text-[16px] md:text-[18px] text-neutral-700 leading-relaxed max-w-xl">
            Label Maison Conciergerie accompagne propriétaires, investisseurs et clients privés à travers une{' '}
            <strong className="font-bold">conciergerie premium</strong> alliant
            gestion de biens immobiliers, services lifestyle et expériences exclusives.
          </p>

          <div className="flex flex-row gap-3 w-full sm:w-auto">
            <a
              href="#contact"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-[14px] sm:text-[15px] px-6 sm:px-7 py-3.5 sm:py-4 rounded-full hover:bg-neutral-700 transition-colors whitespace-nowrap"
            >
              Contacter <ArrowRight size={16} className="shrink-0" />
            </a>
            <a
              href="#services"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-black/10 text-neutral-900 font-bold text-[14px] sm:text-[15px] px-6 sm:px-7 py-3.5 sm:py-4 rounded-full hover:bg-black/15 transition-colors whitespace-nowrap"
            >
              Services <ArrowDown size={16} className="shrink-0" />
            </a>
          </div>
        </motion.div>

        <div className="relative w-full md:w-2/5 md:min-h-[600px]">
          <div className="relative h-[420px] md:absolute md:inset-y-0 md:-right-[40%] md:left-0 md:w-[140%] md:h-full rounded-2xl md:rounded-none overflow-hidden">
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80"
              alt="Logement à Paris géré par Label Maison Conciergerie"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// LEAD FORM (overlapping card)
// =============================================================================
function LeadFormSection() {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className="relative z-10 mt-8 md:-mt-24">
      <div className="max-w-[1152px] mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-[0_40px_100px_rgba(14,6,53,0.1)] p-3 md:flex md:items-stretch md:gap-3 md:max-w-[900px] md:mx-auto"
        >
          <div
            className="relative md:w-5/12 min-h-[220px] md:min-h-[420px] rounded-xl overflow-hidden bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1530841377377-3ff06c0ca713?auto=format&fit=crop&w=1200&q=80')",
            }}
          />

          <div className="md:w-7/12 p-4 md:p-6">
            <h2 className="text-[24px] md:text-[32px] leading-tight font-bold">
              Découvrez notre solution de conciergerie{' '}
              <span className="font-serif-italic font-bold text-[#556B2F]">conçue pour vous !</span>
            </h2>
            <p className="mt-3 text-[15px] text-neutral-700">
              Avec nous, un appartement de 2 chambres à Paris peut vous faire gagner{' '}
              <strong className="font-bold">3 250 € par mois</strong>.
            </p>

            {submitted ? (
              <div className="mt-5 flex items-start gap-3 bg-[#556B2F]/10 text-[#3d4d22] rounded-lg p-4">
                <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Merci !</p>
                  <p className="text-[14px]">Nous vous recontactons sous 24 h.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <Field label="Adresse du bien">
                  <input
                    type="text"
                    name="adresse"
                    required
                    placeholder="Adresse du bien"
                    className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                  />
                </Field>
                <Field label="Nombre de chambres">
                  <select
                    name="chambres"
                    required
                    defaultValue=""
                    className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                  >
                    <option value="" disabled>— Choisissez —</option>
                    <option>Studio</option>
                    <option>1 chambre</option>
                    <option>2 chambres</option>
                    <option>3 chambres</option>
                    <option>4 chambres ou plus</option>
                  </select>
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Adresse e-mail" required>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="adresse@email.com"
                      className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      name="tel"
                      placeholder="+33 6 12 34 56 78"
                      className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                    />
                  </Field>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-neutral-700"
                >
                  Prendre contact <Send size={14} />
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[1px] text-neutral-600 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

// =============================================================================
// BENEFITS
// =============================================================================
const benefits = [
  {
    emoji: '🤍',
    title: 'Confidentialité absolue',
    text: "Votre vie privée et la protection de vos actifs sont notre priorité. Chaque intervention — gestion, voyage, acquisition — est menée avec la plus grande discrétion.",
  },
  {
    emoji: '🕐',
    title: 'Disponibilité 24/7',
    text: "Où que vous soyez, à tout moment, notre équipe dédiée est à votre écoute pour répondre à vos demandes : urgence, dernière minute, demande sur mesure.",
  },
  {
    emoji: '🏆',
    title: 'Excellence opérationnelle',
    text: "Un savoir-faire reconnu, un réseau mondial de partenaires sélectionnés et une exigence sans faille pour chaque prestation, du standard premium au sur-mesure exclusif.",
  },
];

// =============================================================================
// RESULTS — proof of performance with proprietor screenshots
// =============================================================================
function ResultsSection() {
  return (
    <section className="py-[60px] md:py-[100px] bg-zinc-50">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Performance mesurée"
          title={<>Des résultats <em className="font-serif-italic font-bold text-[#556B2F] not-italic">concrets</em>, mois après mois</>}
        />
        <p className="mt-4 max-w-2xl text-[15px] md:text-[16px] text-neutral-700">
          Nos chiffres ne sont pas des promesses, ce sont des preuves. Voici les revenus
          générés par un seul logement géré par notre conciergerie.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            <div className="p-6 md:p-7 border-b border-black/5">
              <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
                Décembre 2025
              </p>
              <h3 className="mt-2 text-[28px] md:text-[34px] font-bold leading-tight">
                <span className="font-serif-italic font-bold text-[#556B2F]">6 359,32 €</span>
                <br />en un seul mois
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700">
                Un seul bien géré en location courte durée. Plus de 6 000 € de revenus
                nets générés en un mois.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-zinc-50">
              <img
                src="/images/img-proprietaire-decembre.png"
                alt="Revenus Airbnb décembre 2025 — 6 359,32 €"
                className="w-full h-auto rounded-lg"
                loading="lazy"
              />
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ delay: 0.1 }}
            className="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden"
          >
            <div className="p-6 md:p-7 border-b border-black/5">
              <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
                Janvier 2026
              </p>
              <h3 className="mt-2 text-[28px] md:text-[34px] font-bold leading-tight">
                <span className="font-serif-italic font-bold text-[#556B2F]">8 782 €</span>
                <br />prévus ce mois-ci
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700">
                1 456 € déjà encaissés et 7 326 € en réservations confirmées.
                La performance se confirme dans la durée.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-zinc-50">
              <img
                src="/images/img-proprietaire-janvier.png"
                alt="Revenus Airbnb janvier 2026 — 8 782 € prévus"
                className="w-full h-auto rounded-lg"
                loading="lazy"
              />
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nos engagements"
          title={<>Pourquoi nous confier vos{' '}<em className="font-serif-italic font-bold text-[#556B2F] not-italic">demandes les plus exigeantes</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl p-6 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_60px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#556B2F]/10 text-[#556B2F] text-xl shrink-0">
                  {b.emoji}
                </div>
                <span className="text-lg font-semibold text-gray-900">{b.title}</span>
              </div>
              <p className="text-[15px] md:text-[16px] leading-relaxed text-gray-600">
                {b.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// SERVICES
// =============================================================================
const services = [
  {
    icon: HomeIcon,
    title: 'Gestion de biens immobiliers',
    text: "Gestion clé en main de votre patrimoine : entretien, location courte durée, optimisation des revenus et reporting mensuel.",
    image: 'https://images.unsplash.com/photo-1621693722835-44c9dcb724fd?auto=format&fit=crop&w=1200&q=80',
    href: '/proprietaires',
    eyebrow: 'Notre cœur de métier',
  },
  {
    icon: Plane,
    title: "Billetterie d'avion",
    text: "Vols privés, jets, classe affaires et première classe. Du sol au ciel, tout est orchestré.",
    image: 'https://images.unsplash.com/photo-1545610095-4d00a3f4f547?auto=format&fit=crop&w=1200&q=80',
    href: '/billetterie',
    eyebrow: 'Voyage premium',
  },
  {
    icon: Bed,
    title: "Logement d'exception",
    text: "Studios, suites avec jacuzzi, villas et penthouses. Des lieux à la hauteur de votre style de vie.",
    image: 'https://images.unsplash.com/photo-1592229506151-845940174bb0?auto=format&fit=crop&w=1200&q=80',
    href: '/logement',
    eyebrow: 'Résidences premium',
  },
  {
    icon: Car,
    title: 'Transport privé',
    text: "Berlines, SUV, véhicules blindés. Chaque déplacement devient un privilège avec chauffeur 24/7.",
    image: 'https://images.unsplash.com/photo-1547731269-e4073e054f12?auto=format&fit=crop&w=1200&q=80',
    href: '/transport',
    eyebrow: 'Mobilité haut de gamme',
  },
  {
    icon: Compass,
    title: 'Activités exclusives',
    text: "Yacht privé à Dubaï, croisière sur la Seine, hammam royal à Marrakech. Vivre ce que peu peuvent s'offrir.",
    image: 'https://images.unsplash.com/photo-1743819458014-f5cf74f175e3?auto=format&fit=crop&w=1200&q=80',
    href: '/activites',
    eyebrow: 'Expériences VIP',
  },
  {
    icon: ShoppingBag,
    title: 'Personal Shopping',
    text: "Haute horlogerie, mode, joaillerie. Pièces rares, éditions limitées : ce que vous désirez, nous le trouvons.",
    image: 'https://images.unsplash.com/photo-1623998021661-dc7555b2213d?auto=format&fit=crop&w=1200&q=80',
    href: '/shopping',
    eyebrow: 'Acquisitions discrètes',
  },
];

function ServicesSection() {
  return (
    <section id="services" className="relative py-[60px] md:py-[100px] overflow-hidden">
      {/* Decorative ellipses */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[500px] h-[500px] rounded-full bg-[#556B2F]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[500px] h-[500px] rounded-full bg-amber-100/40 blur-3xl" />

      <div className="relative max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nos services"
          title={<>Six expertises pour un service{' '}<em className="font-serif-italic font-bold text-[#556B2F] not-italic">d'exception</em></>}
        />
        <p className="mt-4 max-w-2xl text-[15px] md:text-[16px] text-neutral-700">
          De la gestion de votre patrimoine à l'organisation de vos expériences les plus exclusives,
          nos six pôles d'expertise couvrent tous les besoins d'une clientèle exigeante.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {services.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: (i % 3) * 0.06 }}
            >
              <Link
                to={s.href}
                className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col cursor-pointer h-full"
              >
                <div className="relative h-48 md:h-52 overflow-hidden">
                  <ImageWithFallback
                    src={s.image}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute top-4 left-4 w-11 h-11 rounded-xl bg-white/95 backdrop-blur-sm text-[#556B2F] flex items-center justify-center shadow-lg">
                    <s.icon size={20} />
                  </div>
                  <span className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-[1px] text-[#556B2F] px-2.5 py-1 rounded-full">
                    {s.eyebrow}
                  </span>
                </div>
                <div className="flex flex-col flex-1 p-5 md:p-6 gap-3">
                  <h3 className="text-[17px] md:text-[19px] font-semibold text-gray-900 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] leading-relaxed text-gray-600">{s.text}</p>
                  <div className="mt-auto pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[#556B2F] text-[13px] font-semibold group-hover:gap-2.5 transition-all">
                      En savoir plus <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 backdrop-blur-md bg-black/5 rounded-full p-2 md:p-3 flex flex-col md:flex-row items-center md:items-stretch gap-3 md:gap-4 max-w-2xl mx-auto">
          <p className="md:flex-1 px-4 py-2 text-center md:text-left text-[15px] font-medium">
            Une solution clé en main pour les propriétaires
          </p>
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-[14px] px-6 py-3 rounded-full hover:bg-neutral-700"
          >
            Nous contacter <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// PROCESS
// =============================================================================
const steps = [
  {
    n: '01',
    title: 'Premier contact',
    text: "Vous nous contactez via le formulaire, par téléphone ou par e-mail. Nous discutons de vos besoins et de votre projet.",
  },
  {
    n: '02',
    title: 'Visite et estimation',
    text: 'Nous visitons votre logement, évaluons son potentiel locatif et vous proposons une estimation détaillée des revenus.',
  },
  {
    n: '03',
    title: 'Mise en ligne',
    text: 'Nous prenons en charge les photos, la rédaction de l\'annonce, et la mise en ligne sur Airbnb, Booking et autres plateformes.',
  },
  {
    n: '04',
    title: 'Gestion quotidienne',
    text: 'Accueil des voyageurs, ménage, linge, communication, maintenance : nous gérons tout pour vous.',
  },
  {
    n: '05',
    title: 'Suivi et reporting',
    text: 'Vous recevez chaque mois un rapport détaillé de la performance de votre bien et de vos revenus.',
  },
];

function ProcessSection() {
  return (
    <section id="process" className="py-[60px] md:py-[100px] bg-zinc-50">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Comment ça marche ?"
          title={<>Notre <em className="font-serif-italic font-bold text-[#556B2F] not-italic">process</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#556B2F]/10"
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
              alt="Notre process"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#3d4d22]/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[2px] opacity-80">Notre engagement</p>
              <p className="text-[20px] md:text-[22px] font-bold leading-tight mt-1">
                De la mise en ligne à la gestion complète, vous gardez la main, nous gérons tout.
              </p>
            </div>
          </motion.div>

          <ol className="relative space-y-6 md:space-y-7">
            <span className="absolute left-[19px] top-2 bottom-2 w-px bg-[#556B2F]/30 hidden md:block" />
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.06 }}
                className="relative flex items-start gap-4 md:gap-5"
              >
                <span className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[#556B2F] text-white flex items-center justify-center font-bold text-[14px]">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-[18px] md:text-[20px] font-bold">{s.title}</h3>
                  <p className="text-[14px] md:text-[15px] text-neutral-700 mt-1 leading-relaxed">{s.text}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// OFFER
// =============================================================================
const offerFeatures = [
  "Création d'une annonce optimisée",
  'Boost de votre référencement',
  'Yield Management : Gestion dynamique des prix & calendrier',
  'Assistance communication : 24h/24 - 7j/7',
  'Entrées - Sorties',
  'Gestion du ménage & linge',
  "Maintenance et travaux d'aménagement",
  'Surprise pour vos voyageurs',
];

// =============================================================================
// CLEANING PARTNER — bnbcleaning.fr automated housekeeping
// =============================================================================
function CleaningPartnerSection() {
  return (
    <section className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="relative bg-gray-900 text-white rounded-[28px] overflow-hidden p-8 md:p-12 lg:p-16">
          {/* Decorative accents */}
          <div className="pointer-events-none absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#556B2F]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#a3c47a]/15 blur-3xl" />

          <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 md:gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-[12px] font-semibold uppercase tracking-[1.5px] px-4 py-1.5 rounded-full border border-white/15">
                <Cpu size={14} /> Partenaire technologique
              </span>

              <h2 className="mt-5 text-[28px] md:text-[40px] font-bold leading-[1.05]">
                Un ménage{' '}
                <span className="font-serif-italic font-bold text-[#a3c47a]">automatisé</span>
                {' '}et piloté par{' '}
                <a
                  href="https://bnbcleaning.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif-italic font-bold text-[#a3c47a] underline decoration-[#a3c47a]/40 underline-offset-4 hover:decoration-[#a3c47a]"
                >
                  bnbcleaning.fr
                </a>
              </h2>

              <p className="mt-5 text-[15px] md:text-[16px] text-white/80 leading-relaxed max-w-xl">
                Pour garantir un accueil impeccable à chaque voyageur, nous avons fait le choix
                d'une plateforme dédiée à l'automatisation du ménage en location courte durée.
                <strong className="font-semibold text-white"> bnbcleaning.fr</strong> connecte nos calendriers Airbnb &amp; Booking
                à un réseau d'agents professionnels, déclenche les interventions
                automatiquement entre chaque réservation, et trace chaque passage avec photos et checklist.
              </p>

              <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { icon: Zap, label: 'Déclenchement automatique entre chaque séjour' },
                  { icon: Sparkles, label: 'Agents professionnels formés à l\'hospitalité' },
                  { icon: ClipboardCheck, label: 'Photos & checklist de contrôle qualité' },
                  { icon: CheckCircle2, label: 'Linge hôtelier renouvelé à chaque rotation' },
                ].map((f) => (
                  <li key={f.label} className="flex items-start gap-3 text-[14px] md:text-[15px] text-white/85">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#556B2F]/30 text-[#a3c47a] shrink-0">
                      <f.icon size={14} />
                    </span>
                    {f.label}
                  </li>
                ))}
              </ul>

              <a
                href="https://bnbcleaning.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 bg-white text-gray-900 font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#a3c47a] transition-colors"
              >
                Découvrir bnbcleaning.fr <ArrowRight size={16} />
              </a>
            </div>

            <div className="relative">
              {/* Hero photo with floating overlay cards */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5 }}
                className="relative aspect-[4/5] md:aspect-[5/6] rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
              >
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=85"
                  alt="Logement préparé par bnbcleaning.fr"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Color grade overlay matching brand */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/30 via-transparent to-gray-900/60" />
                <div className="absolute inset-0 bg-[#556B2F]/10 mix-blend-multiply" />

                {/* TOP-LEFT — agent en mission */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.45 }}
                  className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg flex items-center gap-2.5 max-w-[200px]"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#556B2F] to-[#3d4d22] flex items-center justify-center text-white text-[13px] font-bold">
                      SR
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-900 leading-tight">
                      Sarah · Agent Pro
                    </p>
                    <p className="text-[10px] text-gray-500 leading-tight">
                      Mission en cours
                    </p>
                  </div>
                </motion.div>

                {/* BOTTOM — stats glass card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.55 }}
                  className="absolute inset-x-4 bottom-4 bg-white/95 backdrop-blur-xl rounded-2xl p-4 md:p-5 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
                      Tableau de bord · cette semaine
                    </span>
                    <span className="text-[10px] text-gray-400">bnbcleaning.fr</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                    <div>
                      <p className="text-[22px] md:text-[26px] font-bold text-gray-900 leading-none">12</p>
                      <p className="text-[10px] uppercase tracking-[1px] text-gray-500 mt-1">
                        Interventions
                      </p>
                    </div>
                    <div className="border-x border-gray-200 px-3 md:px-4">
                      <p className="text-[22px] md:text-[26px] font-bold text-gray-900 leading-none">4.9</p>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={8} className="fill-[#556B2F] text-[#556B2F]" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[22px] md:text-[26px] font-bold text-gray-900 leading-none flex items-baseline gap-0.5">
                        100<span className="text-[12px] text-gray-500">%</span>
                      </p>
                      <p className="text-[10px] uppercase tracking-[1px] text-gray-500 mt-1">
                        Photos validées
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Floating decorative checkmark badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7, type: 'spring', stiffness: 200 }}
                className="absolute -top-3 -right-3 md:-top-4 md:-right-4 w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#556B2F] flex items-center justify-center shadow-xl ring-4 ring-gray-900"
              >
                <CheckCircle2 size={26} className="text-white" strokeWidth={2.5} />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferSection() {
  return (
    <section id="offre" className="py-[60px] md:py-[100px] bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-[1152px] mx-auto px-6 space-y-10 md:space-y-14">
        <SectionHeader
          eyebrow="Notre offre"
          title={<>Notre <em className="font-serif-italic font-bold text-[#556B2F] not-italic">offre</em></>}
        />

        <p className="text-center md:text-left text-[16px] md:text-[18px] text-neutral-700 max-w-3xl">
          <strong className="font-bold text-neutral-900">L'adhésion est gratuite</strong>,
          pas de frais d'abonnements ni d'entrée.
        </p>

        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          {/* Pricing card — black, prominent 90% */}
          <div className="relative bg-gray-900 rounded-2xl p-8 md:p-10 flex flex-col gap-5 md:w-[32%] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
            <div className="flex items-start justify-center gap-1 mt-2">
              <span className="text-white text-[80px] md:text-[88px] font-extrabold leading-none">90</span>
              <div className="flex flex-col justify-start pt-3">
                <span className="text-white text-[40px] font-bold leading-none">%</span>
                <span className="text-white/70 text-[12px] font-semibold uppercase tracking-wider mt-1">
                  TTC
                </span>
              </div>
            </div>
            <p className="text-center text-white/80 text-[14px]">à la nuitée</p>
            <div className="text-center text-white text-[14px] font-semibold border border-white/20 bg-white/10 rounded-full px-5 py-3">
              De chaque réservation
            </div>
            <div className="border-t border-white/10 my-1" />
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-white text-[13px] leading-relaxed">
                + Forfait ménage / linge à la charge du voyageur
              </p>
            </div>
            <a
              href="#contact"
              className="mt-2 text-center bg-white text-gray-900 font-bold text-[14px] px-5 py-3.5 rounded-full hover:bg-neutral-100 transition-colors"
            >
              Je veux tester
            </a>
          </div>

          {/* Features card */}
          <div className="bg-white rounded-2xl border border-black/5 p-8 md:p-10 md:w-[68%]">
            <h4 className="text-[20px] md:text-[22px] font-bold mb-5 text-gray-900">Services inclus</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {offerFeatures.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#556B2F]/15 text-[#556B2F] text-xs font-bold shrink-0">
                    ✓
                  </span>
                  <span className="text-[14px] md:text-[15px] text-gray-700 leading-snug">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action banner */}
        <div className="bg-[#556B2F] text-white rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="md:flex-1">
            <h3 className="text-[26px] md:text-[34px] font-bold leading-tight">
              Je passe à <span className="font-serif-italic font-bold">l'action</span>
            </h3>
            <p className="mt-2 text-[15px] md:text-[16px] text-white/90 max-w-2xl">
              Prêt à franchir le pas et maximiser la rentabilité de votre logement ?
              Prenez contact avec nous dès aujourd'hui pour un accompagnement personnalisé.
            </p>
          </div>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-white text-[#3d4d22] font-bold text-[15px] px-7 py-4 rounded-full hover:bg-neutral-100 transition-colors"
          >
            Nous contacter <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FAQ
// =============================================================================
const faqs = [
  {
    q: 'Quels services propose Label Maison Conciergerie ?',
    a: "Six pôles d'expertise : gestion de biens immobiliers, billetterie d'avion (jets privés, première classe), logements d'exception, transport privé, activités VIP exclusives et personal shopping. Nous couvrons tous les besoins d'une clientèle premium.",
  },
  {
    q: 'Comment fonctionne la gestion de biens immobiliers ?',
    a: "Vous touchez 90 % à la nuitée TTC sur chaque réservation, le forfait ménage / linge est à la charge du voyageur. Aucun frais d'entrée, pas d'abonnement. Nous gérons annonces, accueil, ménage, communication et reporting mensuel.",
  },
  {
    q: 'Sur quelles plateformes mettez-vous mes biens en ligne ?',
    a: 'Airbnb, Booking, Vrbo, Abritel… nous diffusons votre annonce sur toutes les principales plateformes pour maximiser votre visibilité et vos réservations.',
  },
  {
    q: 'Où intervenez-vous géographiquement ?',
    a: "Notre équipe est basée à Paris mais notre réseau s'étend à la Côte d'Azur, Dubaï, Marrakech et bien d'autres destinations premium. Nous accompagnons une clientèle française et internationale.",
  },
  {
    q: 'Comment réserver un jet privé ou un vol première classe ?',
    a: "Contactez-nous via le formulaire, par téléphone ou Instagram. Nous revenons vers vous sous 2h avec des propositions sur mesure : Emirates, Qatar Airways, jets privés. Tout est négocié et orchestré pour vous.",
  },
  {
    q: 'Vos services lifestyle sont-ils accessibles 24/7 ?',
    a: "Oui. Activités exclusives, transport privé, personal shopping : nous sommes joignables 7j/7 et organisons vos demandes en temps record, y compris pour les besoins de dernière minute.",
  },
  {
    q: 'Qu\'est-ce que le service personal shopping ?',
    a: "Nous sourçons pour vous les pièces les plus rares : Rolex Daytona, Hermès Birkin, Audemars Piguet, joaillerie Cartier… Authentification, négociation, livraison sécurisée mondiale et conseil en investissement inclus.",
  },
  {
    q: 'Comment garantissez-vous la discrétion ?',
    a: "La confidentialité est au cœur de notre engagement. Chaque intervention est menée avec la plus grande discrétion, et l'identité de nos clients privés reste strictement confidentielle.",
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="py-[60px] md:py-[100px] bg-zinc-50">
      <div className="max-w-[1152px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-10 md:gap-16 items-start">
        <div className="md:sticky md:top-28">
          <span className="inline-flex items-center bg-[#556B2F]/15 text-[#3d4d22] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            FAQ
          </span>
          <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05]">
            Vous avez des <span className="font-serif-italic font-bold text-[#556B2F]">questions ?</span>
          </h2>
          <p className="mt-4 text-[15px] text-neutral-700 leading-relaxed">
            Confier sa gestion patrimoniale ou ses expériences premium soulève des questions légitimes.
            Voici les réponses aux interrogations les plus fréquentes sur l'ensemble de nos services.
          </p>
          <a
            href="#contact"
            className="mt-6 inline-flex items-center gap-2 bg-[#556B2F] text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#3d4d22]"
          >
            Nous contacter <ArrowRight size={14} />
          </a>
        </div>

        <ul className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <li
                key={f.q}
                className={`rounded-xl border transition-colors ${
                  isOpen ? 'bg-white border-[#556B2F]/30' : 'bg-white border-black/5 hover:border-black/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
                >
                  <span className="font-semibold text-[16px] md:text-[17px]">{f.q}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-[#556B2F] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 md:px-6 pb-5 md:pb-6 text-[15px] text-neutral-700 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// =============================================================================
// VALUES
// =============================================================================
type ValueItem = {
  emoji: string;
  title: string;
  description?: string;
  highlight?: string;
  list?: string[];
};

const values: ValueItem[] = [
  {
    emoji: '⏱',
    title: 'Temps',
    description: "Gagnez du temps, laissez votre conciergerie s'occuper de tout.",
  },
  {
    emoji: '📈',
    title: 'Rentabilité',
    description: 'Une conciergerie peut augmenter la rentabilité de votre location de',
    highlight: '15 à 40 %',
  },
  {
    emoji: '🛡',
    title: 'Fiabilité',
    list: [
      'Un service sûr et toujours au rendez-vous.',
      'Fiable à chaque étape, pour une tranquillité totale.',
      'Votre quotidien géré avec rigueur et efficacité.',
    ],
  },
  {
    emoji: '🌿',
    title: 'Sérénité',
    list: [
      'Libérez-vous des contraintes et profitez pleinement.',
      "La tranquillité d'esprit à portée de main.",
      'Chaque détail géré, pour un quotidien sans stress.',
    ],
  },
];

function ValuesSection() {
  return (
    <section id="valeurs" className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nos valeurs"
          title={<>Pourquoi nous <em className="font-serif-italic font-bold text-[#556B2F] not-italic">choisir ?</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {values.map((v, i) => (
            <motion.article
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl p-6 md:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#556B2F]/10 text-[#556B2F] text-xl shrink-0">
                  {v.emoji}
                </div>
                <span className="text-[16px] md:text-[18px] font-semibold text-gray-900">{v.title}</span>
              </div>
              <div className="text-[14px] md:text-[15px] leading-relaxed text-gray-600">
                {v.list ? (
                  <ul className="flex flex-col gap-1.5">
                    {v.list.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#556B2F] mt-0.5 shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    {v.description}
                    {v.highlight && (
                      <>
                        {' '}
                        <strong className="font-bold text-[#556B2F]">{v.highlight}</strong>.
                      </>
                    )}
                  </p>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// ABOUT
// =============================================================================
function AboutSection() {
  return (
    <section id="apropos" className="py-[60px] md:py-[100px] bg-zinc-50">
      <div className="max-w-[1152px] mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="relative aspect-[4/5] rounded-2xl overflow-hidden"
        >
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=1200&q=80"
            alt="Notre conciergerie à Paris"
            className="w-full h-full object-cover"
          />
          <div className="absolute -bottom-3 -right-3 bg-[#556B2F] text-white px-5 py-3 rounded-xl shadow-xl">
            <p className="text-[11px] tracking-widest uppercase opacity-90">Paris · Côte d'Azur · Dubaï · Marrakech</p>
            <p className="text-[18px] font-bold">Réseau international</p>
          </div>
        </motion.div>

        <div>
          <span className="inline-flex items-center bg-[#556B2F]/15 text-[#3d4d22] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            Qui sommes-nous ?
          </span>
          <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05]">
            L'excellence d'une conciergerie pensée pour{' '}
            <span className="font-serif-italic font-bold text-[#556B2F]">l'exception</span>
          </h2>

          <div className="mt-5 space-y-4 text-[15px] md:text-[16px] text-neutral-700 leading-relaxed">
            <p>
              Chez Label Maison Conciergerie, nous concevons la <strong className="font-bold">conciergerie privée</strong> comme un art de la précision.
              Chaque projet est abordé avec une exigence absolue, qu'il s'agisse de la <strong className="font-bold">gestion immobilière</strong>,
              de l'organisation d'un séjour ou de la création d'expériences sur mesure.
            </p>
            <p>
              Nous accompagnons propriétaires, investisseurs et <strong className="font-bold">clients privés</strong> avec une approche globale :
              stratégie, exécution et suivi permanent. De la gestion locative clé en main aux <strong className="font-bold">services premium</strong> —
              transport privé, billetterie, activités exclusives, personal shopping — chaque détail est maîtrisé,
              chaque attente anticipée.
            </p>
            <p>
              Notre engagement repose sur trois piliers : <strong className="font-bold">discrétion, performance et excellence du service</strong>.
              Vous confier à Label Maison, c'est choisir la tranquillité, la rentabilité et un niveau de prestation sans compromis.
            </p>
          </div>

          <div className="mt-6 inline-flex items-center gap-3 bg-zinc-50 rounded-xl px-5 py-4">
            <span className="w-10 h-10 rounded-full bg-[#556B2F]/15 text-[#556B2F] flex items-center justify-center font-bold text-[15px]">
              24/7
            </span>
            <p className="text-[14px] text-neutral-700">
              <span className="font-semibold text-neutral-900">Équipe joignable en permanence</span>
              <br />
              <span className="text-[12px] text-neutral-500">Réponse rapide sur l'ensemble de nos services</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// BLOG
// =============================================================================
const posts = [
  {
    title: 'Comment maximiser vos revenus locatifs à Paris en 2026',
    excerpt: "Les leviers d'optimisation pour une location courte durée rentable, saison après saison : tarification dynamique, taux d'occupation, plateformes.",
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80',
    date: 'Avril 2026',
  },
  {
    title: 'Jets privés vs première classe : que choisir pour vos voyages ?',
    excerpt: 'Comparatif des deux options premium : confort, prix, flexibilité. Notre guide pour choisir le bon mode de voyage selon votre destination.',
    image: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?auto=format&fit=crop&w=1200&q=80',
    date: 'Mars 2026',
  },
];

function BlogSection() {
  return (
    <section className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <span className="inline-flex items-center bg-[#556B2F]/15 text-[#3d4d22] text-[13px] font-semibold px-4 py-1.5 rounded-full">
              Le blog
            </span>
            <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05]">
              Dernières <span className="font-serif-italic font-bold text-[#556B2F]">publications</span>
            </h2>
          </div>

          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-black/5 text-neutral-800 font-bold text-[14px] px-6 py-3 rounded-full hover:bg-black/10 self-start"
          >
            Voir le blog <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((p) => (
            <motion.article
              key={p.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              className="group rounded-2xl overflow-hidden bg-white border border-black/5 hover:shadow-lg transition-all"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <ImageWithFallback
                  src={p.image}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <p className="text-[12px] font-semibold uppercase tracking-[1px] text-[#3d4d22]">{p.date}</p>
                <h3 className="mt-2 text-[20px] font-bold leading-tight">{p.title}</h3>
                <p className="mt-2 text-[15px] text-neutral-700">{p.excerpt}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-[#3d4d22] font-bold text-[14px]">
                  Lire l'article <ArrowRight size={14} />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// CONTACT
// =============================================================================
function ContactSection() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="contact" className="py-[60px] md:py-[100px] bg-zinc-50">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nous contacter"
          title={<>Nous <em className="font-serif-italic font-bold text-[#556B2F] not-italic">contacter</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-start">
          <div className="bg-white rounded-2xl border border-black/5 p-6 md:p-8">
            {submitted ? (
              <div className="flex items-start gap-3 bg-[#556B2F]/10 text-[#3d4d22] rounded-lg p-4">
                <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Merci pour votre message !</p>
                  <p className="text-[14px]">Nous vous répondons sous 24 h.</p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(true);
                }}
                className="space-y-4"
              >
                <Field label="Adresse du bien">
                  <input
                    type="text"
                    required
                    placeholder="Adresse du bien"
                    className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                  />
                </Field>
                <Field label="Nombre de chambres">
                  <select
                    required
                    defaultValue=""
                    className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                  >
                    <option value="" disabled>— Choisissez —</option>
                    <option>Studio</option>
                    <option>1 chambre</option>
                    <option>2 chambres</option>
                    <option>3 chambres</option>
                    <option>4 chambres ou plus</option>
                  </select>
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Adresse e-mail" required>
                    <input
                      type="email"
                      required
                      placeholder="adresse@email.com"
                      className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      placeholder="+33 6 12 34 56 78"
                      className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F]"
                    />
                  </Field>
                </div>
                <Field label="Votre message">
                  <textarea
                    rows={4}
                    placeholder="Parlez-nous de votre projet"
                    className="w-full bg-zinc-100 px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#556B2F] resize-y"
                  />
                </Field>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-black text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-neutral-700"
                >
                  Prendre contact <Send size={14} />
                </button>
              </form>
            )}
          </div>

          <div className="md:pl-8 md:border-l md:border-black/10">
            <h3 className="text-[20px] md:text-[22px] font-bold mb-5">Coordonnées</h3>
            <ul className="space-y-4 text-[15px]">
              <li className="flex items-start gap-3">
                <Phone size={20} className="text-[#556B2F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Téléphone</p>
                  <a href={PHONE_HREF} className="text-neutral-700 hover:text-[#556B2F]">
                    {PHONE_DISPLAY}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={20} className="text-[#556B2F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a href={`mailto:${EMAIL}`} className="text-neutral-700 hover:text-[#556B2F] break-all">
                    {EMAIL}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Instagram size={20} className="text-[#556B2F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Instagram</p>
                  <a
                    href="https://www.instagram.com/labelmaisoncg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:text-[#556B2F]"
                  >
                    @labelmaisoncg
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Music size={20} className="text-[#556B2F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">TikTok</p>
                  <a
                    href="https://www.tiktok.com/@labelmaison.cg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:text-[#556B2F]"
                  >
                    @labelmaison.cg
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={20} className="text-[#556B2F] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Secteur</p>
                  <p className="text-neutral-700">Paris</p>
                </div>
              </li>
            </ul>

            <div className="mt-8 aspect-[4/3] rounded-2xl overflow-hidden border border-black/5">
              <iframe
                title="Localisation Paris"
                src="https://www.openstreetmap.org/export/embed.html?bbox=2.224%2C48.815%2C2.470%2C48.902&layer=mapnik&marker=48.8566%2C2.3522"
                className="w-full h-full"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// SHARED — Section header
// =============================================================================
function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="text-center md:text-left">
      <span className="inline-flex items-center bg-[#556B2F]/15 text-[#3d4d22] text-[13px] font-semibold px-4 py-1.5 rounded-full">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05] max-w-3xl">
        {title}
      </h2>
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================
export function Home() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Label Maison Conciergerie · Conciergerie privée haut de gamme à Paris</title>
        <meta
          name="description"
          content="Conciergerie privée haut de gamme à Paris : gestion de biens immobiliers, billetterie, logement, transport, activités VIP et personal shopping. Services sur mesure pour clientèle d'exception."
        />
      </Helmet>

      <HeroSection />
      <LeadFormSection />
      <ServicesSection />
      <ResultsSection />
      <BenefitsSection />
      <ProcessSection />
      <CleaningPartnerSection />
      <OfferSection />
      <ValuesSection />
      <FaqSection />
      <AboutSection />
      <BlogSection />
      <ContactSection />
    </div>
  );
}
