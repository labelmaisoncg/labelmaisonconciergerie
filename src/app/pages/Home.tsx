import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
  Lock,
  Clock,
  Award,
  TrendingUp,
  ShieldCheck,
  Feather,
  type LucideIcon,
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { DragCarousel } from '../components/drag-carousel/DragCarousel';

const PHONE_DISPLAY = '+33 7 49 54 83 55';
const PHONE_HREF = 'tel:+33749548355';
const EMAIL = 'contact@labelmaisoncgexperience.fr';

async function submitContactForm(
  type: 'lead' | 'contact',
  form: HTMLFormElement,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `Erreur ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Connexion impossible. Réessayez.' };
  }
}

// =============================================================================
// HERO
// =============================================================================
function HeroSection() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'radial-gradient(130% 90% at 50% 0%, #FDFCF9 0%, #F9F7F1 62%, #F4EFE6 100%)' }}
    >
      <div className="max-w-[1336px] mx-auto px-6 md:px-12 pt-[120px] md:pt-[160px] pb-12 md:pb-0 flex flex-col md:flex-row gap-10 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-20 flex flex-col items-center md:items-start text-center md:text-left gap-6 md:w-3/5 md:pr-12 md:pb-[120px]"
        >
          <span className="inline-flex items-center gap-2 bg-white border border-[#E2D7BD] text-[#403118] px-4 py-1.5 rounded-full text-[13px] font-medium">
            <MapPin size={14} className="text-[#A97C30]" /> Paris · International
          </span>

          <h1 className="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight">
            Conciergerie privée haut de gamme :{' '}
            <span className="font-serif-italic font-bold text-[#A97C30]">services sur mesure</span>{' '}
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-[#403118] text-white font-bold text-[14px] sm:text-[15px] px-6 sm:px-7 py-3.5 sm:py-4 rounded-full hover:bg-[#2C2418] transition-colors whitespace-nowrap"
            >
              Contacter <ArrowRight size={16} className="shrink-0" />
            </a>
            <a
              href="#services"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-transparent border border-[#403118]/20 text-[#403118] font-bold text-[14px] sm:text-[15px] px-6 sm:px-7 py-3.5 sm:py-4 rounded-full hover:border-[#A97C30] hover:text-[#7C561D] transition-colors whitespace-nowrap"
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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const result = await submitContactForm('lead', e.currentTarget);
    setSending(false);
    if (result.ok) setSubmitted(true);
    else setError(result.error);
  };

  return (
    <section className="relative z-10 mt-8 md:-mt-24">
      <div className="max-w-[1152px] mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl border border-[#ECE3D0] shadow-[0_40px_100px_rgba(14,6,53,0.1)] p-3 md:flex md:items-stretch md:gap-3 md:max-w-[900px] md:mx-auto"
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
              <span className="font-serif-italic font-bold text-[#A97C30]">conçue pour vous&nbsp;!</span>
            </h2>
            <p className="mt-3 text-[15px] text-neutral-700">
              Avec nous, un appartement de 2 chambres à Paris peut vous faire gagner{' '}
              <strong className="font-bold">3 250 € par mois</strong>.
            </p>

            {submitted ? (
              <div className="mt-5 flex items-start gap-3 bg-[#A97C30]/10 text-[#7C561D] rounded-lg p-4">
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
                    className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                  />
                </Field>
                <Field label="Nombre de chambres">
                  <select
                    name="chambres"
                    required
                    defaultValue=""
                    className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                  >
                    <option value="" disabled>Choisissez</option>
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
                      className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      name="tel"
                      placeholder="+33 6 12 34 56 78"
                      className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                    />
                  </Field>
                </div>
                {error && (
                  <p className="text-[13px] font-semibold text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center justify-center gap-2 bg-[#403118] text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#2C2418] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Envoi…' : 'Prendre contact'} <Send size={14} />
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
const benefits: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Lock,
    title: 'Confidentialité absolue',
    text: "Votre vie privée et la protection de vos actifs sont notre priorité. Chaque intervention (gestion, voyage, acquisition) est menée avec la plus grande discrétion.",
  },
  {
    icon: Clock,
    title: 'Disponibilité 24/7',
    text: "Où que vous soyez, à tout moment, notre équipe dédiée est à votre écoute pour répondre à vos demandes : urgence, dernière minute, demande sur mesure.",
  },
  {
    icon: Award,
    title: 'Excellence opérationnelle',
    text: "Un savoir-faire reconnu, un réseau mondial de partenaires sélectionnés et une exigence sans faille pour chaque prestation, du standard premium au sur-mesure exclusif.",
  },
];

// =============================================================================
// RESULTS — proof of performance with proprietor screenshots
// =============================================================================
function ResultsSection() {
  return (
    <section className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Performance mesurée"
          title={<>Des résultats <em className="font-serif-italic font-bold text-[#A97C30] not-italic">concrets</em>, mois après mois</>}
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
            className="relative bg-white rounded-2xl border border-[#ECE3D0] shadow-[0_8px_40px_rgba(64,49,24,0.09)] overflow-hidden"
          >
            <div className="p-6 md:p-7 border-b border-black/5">
              <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#A97C30]">
                Décembre 2025
              </p>
              <h3 className="mt-2 text-[28px] md:text-[34px] font-bold leading-tight">
                <span className="font-serif-italic font-bold text-[#A97C30]">6 359,32 €</span>
                <br />en un seul mois
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700">
                Un seul bien géré en location courte durée. Plus de 6 000 € de revenus
                nets générés en un mois.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-[#F7F4EE]">
              <img
                src="/images/img-proprietaire-decembre.png"
                alt="Revenus Airbnb décembre 2025 : 6 359,32 €"
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
            className="relative bg-white rounded-2xl border border-[#ECE3D0] shadow-[0_8px_40px_rgba(64,49,24,0.09)] overflow-hidden"
          >
            <div className="p-6 md:p-7 border-b border-black/5">
              <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#A97C30]">
                Janvier 2026
              </p>
              <h3 className="mt-2 text-[28px] md:text-[34px] font-bold leading-tight">
                <span className="font-serif-italic font-bold text-[#A97C30]">8 782 €</span>
                <br />prévus ce mois-ci
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700">
                1 456 € déjà encaissés et 7 326 € en réservations confirmées.
                La performance se confirme dans la durée.
              </p>
            </div>
            <div className="p-3 md:p-4 bg-[#F7F4EE]">
              <img
                src="/images/img-proprietaire-janvier.png"
                alt="Revenus Airbnb janvier 2026 : 8 782 € prévus"
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
          title={<>Pourquoi nous confier vos{' '}<em className="font-serif-italic font-bold text-[#A97C30] not-italic">demandes les plus exigeantes</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl border border-[#ECE3D0] p-6 md:p-8 shadow-[0_8px_40px_rgba(64,49,24,0.09)] hover:shadow-[0_16px_60px_rgba(64,49,24,0.11)] transition-shadow duration-300 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#A97C30]/10 text-[#A97C30] shrink-0">
                  <b.icon size={20} strokeWidth={1.6} />
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
    image: '/images/real/voiture-vip-interieur.jpeg',
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
    image: '/images/real/montre-rolex-datejust.jpeg',
    href: '/shopping',
    eyebrow: 'Acquisitions discrètes',
  },
];

function ServicesSection() {
  return (
    <section id="services" className="relative py-[60px] md:py-[100px] overflow-hidden">
      {/* Decorative ellipses */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[500px] h-[500px] rounded-full bg-[#A97C30]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[500px] h-[500px] rounded-full bg-amber-100/40 blur-3xl" />

      <div className="relative max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nos services"
          title={<>Six expertises pour un service{' '}<em className="font-serif-italic font-bold text-[#A97C30] not-italic">d'exception</em></>}
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
                className="group relative bg-white rounded-2xl border border-[#ECE3D0] overflow-hidden shadow-[0_4px_24px_rgba(64,49,24,0.08)] hover:shadow-[0_8px_40px_rgba(64,49,24,0.11)] transition-shadow duration-300 flex flex-col cursor-pointer h-full"
              >
                <div className="relative h-48 md:h-52 overflow-hidden">
                  <ImageWithFallback
                    src={s.image}
                    alt={s.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute top-4 left-4 w-11 h-11 rounded-xl bg-white/95 backdrop-blur-sm text-[#A97C30] flex items-center justify-center shadow-lg">
                    <s.icon size={20} />
                  </div>
                  <span className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-[1px] text-[#A97C30] px-2.5 py-1 rounded-full">
                    {s.eyebrow}
                  </span>
                </div>
                <div className="flex flex-col flex-1 p-5 md:p-6 gap-3">
                  <h3 className="text-[17px] md:text-[19px] font-semibold text-gray-900 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-[14px] md:text-[15px] leading-relaxed text-gray-600">{s.text}</p>
                  <div className="mt-auto pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[#A97C30] text-[13px] font-semibold group-hover:gap-2.5 transition-all">
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
            className="inline-flex items-center justify-center gap-2 bg-[#403118] text-white font-bold text-[14px] px-6 py-3 rounded-full hover:bg-[#2C2418]"
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
    <section id="process" className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Comment ça marche ?"
          title={<>Notre <em className="font-serif-italic font-bold text-[#A97C30] not-italic">process</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-10 md:gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#A97C30]/10"
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"
              alt="Notre process"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#7C561D]/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[2px] opacity-80">Notre engagement</p>
              <p className="text-[20px] md:text-[22px] font-bold leading-tight mt-1">
                De la mise en ligne à la gestion complète, vous gardez la main, nous gérons tout.
              </p>
            </div>
          </motion.div>

          <ol className="relative space-y-6 md:space-y-7">
            <span className="absolute left-[19px] top-2 bottom-2 w-px bg-[#A97C30]/30 hidden md:block" />
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.06 }}
                className="relative flex items-start gap-4 md:gap-5"
              >
                <span className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-[#A97C30] text-white flex items-center justify-center font-bold text-[14px]">
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
// CLEANING PARTNER — bnbcleaning.fr automated housekeeping
// =============================================================================
function CleaningPartnerSection() {
  return (
    <section className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="relative bg-[#403118] text-white rounded-[28px] overflow-hidden p-8 md:p-12 lg:p-16">
          {/* Decorative accents */}
          <div className="pointer-events-none absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#A97C30]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[#D5C69F]/15 blur-3xl" />

          <div className="relative grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-10 md:gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white text-[12px] font-semibold uppercase tracking-[1.5px] px-4 py-1.5 rounded-full border border-white/15">
                <Cpu size={14} /> Partenaire technologique
              </span>

              <h2 className="mt-5 text-[28px] md:text-[40px] font-bold leading-[1.05]">
                Un ménage{' '}
                <span className="font-serif-italic font-bold text-[#D5C69F]">automatisé</span>
                {' '}et piloté par{' '}
                <a
                  href="https://bnbcleaning.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif-italic font-bold text-[#D5C69F] underline decoration-[#D5C69F]/40 underline-offset-4 hover:decoration-[#D5C69F]"
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
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#A97C30]/30 text-[#D5C69F] shrink-0">
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
                className="mt-8 inline-flex items-center gap-2 bg-white text-gray-900 font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#D5C69F] transition-colors"
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
                <div className="absolute inset-0 bg-[#A97C30]/10 mix-blend-multiply" />

                {/* TOP-LEFT — agent en mission */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.45 }}
                  className="absolute top-4 left-4 bg-white/90 backdrop-blur-md rounded-2xl px-3 py-2 shadow-lg flex items-center gap-2.5 max-w-[200px]"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#A97C30] to-[#7C561D] flex items-center justify-center text-white text-[13px] font-bold">
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
                    <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#A97C30]">
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
                          <Star key={i} size={8} className="fill-[#A97C30] text-[#A97C30]" />
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
                className="absolute -top-3 -right-3 md:-top-4 md:-right-4 w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#A97C30] flex items-center justify-center shadow-xl ring-4 ring-gray-900"
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
    <section id="faq" className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-10 md:gap-16 items-start">
        <div className="md:sticky md:top-28">
          <span className="inline-flex items-center bg-[#A97C30]/15 text-[#7C561D] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            FAQ
          </span>
          <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05]">
            Vous avez des <span className="font-serif-italic font-bold text-[#A97C30]">questions&nbsp;?</span>
          </h2>
          <p className="mt-4 text-[15px] text-neutral-700 leading-relaxed">
            Confier sa gestion patrimoniale ou ses expériences premium soulève des questions légitimes.
            Voici les réponses aux interrogations les plus fréquentes sur l'ensemble de nos services.
          </p>
          <a
            href="#contact"
            className="mt-6 inline-flex items-center gap-2 bg-gradient-to-r from-[#A97C30] to-[#7C561D] text-white font-bold text-[14px] px-6 py-3.5 rounded-full shadow-[0_6px_20px_rgba(124,86,29,0.28)] hover:to-[#5C4A26] transition-all"
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
                  isOpen ? 'bg-white border-[#A97C30]/30' : 'bg-white border-black/5 hover:border-black/10'
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
                    className={`shrink-0 text-[#A97C30] transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
  icon: LucideIcon;
  title: string;
  description?: string;
  highlight?: string;
  list?: string[];
};

const values: ValueItem[] = [
  {
    icon: Clock,
    title: 'Temps',
    description: "Gagnez du temps, laissez votre conciergerie s'occuper de tout.",
  },
  {
    icon: TrendingUp,
    title: 'Rentabilité',
    description: 'Une conciergerie peut augmenter la rentabilité de votre location de',
    highlight: '15 à 40 %',
  },
  {
    icon: ShieldCheck,
    title: 'Fiabilité',
    list: [
      'Un service sûr et toujours au rendez-vous.',
      'Fiable à chaque étape, pour une tranquillité totale.',
      'Votre quotidien géré avec rigueur et efficacité.',
    ],
  },
  {
    icon: Feather,
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
          title={<>Pourquoi nous <em className="font-serif-italic font-bold text-[#A97C30] not-italic">choisir&nbsp;?</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {values.map((v, i) => (
            <motion.article
              key={v.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.06 }}
              className="bg-white rounded-2xl border border-[#ECE3D0] p-6 md:p-7 shadow-[0_4px_24px_rgba(64,49,24,0.08)] hover:shadow-[0_8px_40px_rgba(64,49,24,0.11)] transition-shadow duration-300 flex flex-col gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#A97C30]/10 text-[#A97C30] shrink-0">
                  <v.icon size={20} strokeWidth={1.6} />
                </div>
                <span className="text-[16px] md:text-[18px] font-semibold text-gray-900">{v.title}</span>
              </div>
              <div className="text-[14px] md:text-[15px] leading-relaxed text-gray-600">
                {v.list ? (
                  <ul className="flex flex-col gap-1.5">
                    {v.list.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#A97C30] mt-0.5 shrink-0">✓</span>
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
                        <strong className="font-bold text-[#A97C30]">{v.highlight}</strong>.
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
    <section id="apropos" className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
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
          <div className="absolute -bottom-3 -right-3 bg-[#A97C30] text-white px-5 py-3 rounded-xl shadow-xl">
            <p className="text-[11px] tracking-widest uppercase opacity-90">Paris · Côte d'Azur · Dubaï · Marrakech</p>
            <p className="text-[18px] font-bold">Réseau international</p>
          </div>
        </motion.div>

        <div>
          <span className="inline-flex items-center bg-[#A97C30]/15 text-[#7C561D] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            Qui sommes-nous ?
          </span>
          <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05]">
            L'excellence d'une conciergerie pensée pour{' '}
            <span className="font-serif-italic font-bold text-[#A97C30]">l'exception</span>
          </h2>

          <div className="mt-5 space-y-4 text-[15px] md:text-[16px] text-neutral-700 leading-relaxed">
            <p>
              Chez Label Maison Conciergerie, nous concevons la <strong className="font-bold">conciergerie privée</strong> comme un art de la précision.
              Chaque projet est abordé avec une exigence absolue, qu'il s'agisse de la <strong className="font-bold">gestion immobilière</strong>,
              de l'organisation d'un séjour ou de la création d'expériences sur mesure.
            </p>
            <p>
              Nous accompagnons propriétaires, investisseurs et <strong className="font-bold">clients privés</strong> avec une approche globale :
              stratégie, exécution et suivi permanent. De la gestion locative clé en main aux <strong className="font-bold">services premium</strong>
              (transport privé, billetterie, activités exclusives, personal shopping), chaque détail est maîtrisé,
              chaque attente anticipée.
            </p>
            <p>
              Notre engagement repose sur trois piliers : <strong className="font-bold">discrétion, performance et excellence du service</strong>.
              Vous confier à Label Maison, c'est choisir la tranquillité, la rentabilité et un niveau de prestation sans compromis.
            </p>
          </div>

          <div className="mt-6 inline-flex items-center gap-3 bg-[#F7F4EE] rounded-xl px-5 py-4">
            <span className="w-10 h-10 rounded-full bg-[#A97C30]/15 text-[#A97C30] flex items-center justify-center font-bold text-[15px]">
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
// PROOF — drag carousel (screenshots + reels Instagram/TikTok/YouTube)
// =============================================================================
type ProofItem =
  | {
      kind: 'screenshot';
      image: string;
      label: string;
      caption: string;
    }
  | {
      kind: 'instagram' | 'tiktok' | 'youtube';
      url: string;
      poster?: string;
      label: string;
      caption: string;
    };

const proofs: ProofItem[] = [
  {
    kind: 'screenshot',
    image: '/images/proof/IMG_7303.jpeg',
    label: 'Message client',
    caption: '« Franchement merci beaucoup, c\'est vraiment top ce que vous faites. »',
  },
  {
    kind: 'screenshot',
    image: '/images/proof/IMG_7304.jpeg',
    label: 'Message client',
    caption: 'Retour propriétaire après remise en gestion',
  },
  {
    kind: 'screenshot',
    image: '/images/proof/IMG_7305.jpeg',
    label: 'Message client',
    caption: 'Avis post-séjour voyageur',
  },
  {
    kind: 'screenshot',
    image: '/images/proof/IMG_7306.jpeg',
    label: 'Message client',
    caption: 'Suivi locatif courte durée',
  },
  {
    kind: 'youtube',
    url: 'https://youtu.be/v6YqaM2bW78',
    poster: 'https://i.ytimg.com/vi/v6YqaM2bW78/hqdefault.jpg',
    label: 'Podcast YouTube',
    caption: 'Génération Business · LabelMaison CG',
  },
  {
    kind: 'youtube',
    url: 'https://youtu.be/bI8vGt5UN9w',
    poster: 'https://i.ytimg.com/vi/bI8vGt5UN9w/hqdefault.jpg',
    label: 'Podcast YouTube',
    caption: 'Coulisses & business mindset',
  },
  {
    kind: 'instagram',
    url: 'https://www.instagram.com/reel/DRE5FEOiNdw/',
    label: 'Reel Instagram',
    caption: 'Coulisses ménage & check-in',
  },
  {
    kind: 'instagram',
    url: 'https://www.instagram.com/reel/DU2xyqUiH_B/',
    label: 'Reel Instagram',
    caption: 'Standards qualité Label Maison',
  },
  {
    kind: 'instagram',
    url: 'https://www.instagram.com/reel/DQwkeSAiOhU/',
    label: 'Reel Instagram',
    caption: 'Préparation d\'un appartement',
  },
  {
    kind: 'instagram',
    url: 'https://www.instagram.com/reel/DV6ccxiCMKF/',
    label: 'Reel Instagram',
    caption: 'Le quotidien de l\'équipe terrain',
  },
  {
    kind: 'instagram',
    url: 'https://www.instagram.com/reel/DV3zKRGiDgX/',
    label: 'Reel Instagram',
    caption: 'Avant / après remise en location',
  },
  {
    kind: 'tiktok',
    url: 'https://www.tiktok.com/@labelmaisoncg/video/7611119478264401185',
    label: 'TikTok',
    caption: '@labelmaisoncg · Coulisses',
  },
  {
    kind: 'tiktok',
    url: 'https://www.tiktok.com/@labelmaisoncg/video/7610028564758465824',
    label: 'TikTok',
    caption: '@labelmaisoncg · Conseils proprio',
  },
  {
    kind: 'tiktok',
    url: 'https://www.tiktok.com/@labelmaisoncg/video/7628608422681873686',
    label: 'TikTok',
    caption: '@labelmaisoncg · Mission terrain',
  },
  {
    kind: 'tiktok',
    url: 'https://www.tiktok.com/@labelmaisoncg/video/7596974690468384022',
    label: 'TikTok',
    caption: '@labelmaisoncg · Astuce locative',
  },
  {
    kind: 'tiktok',
    url: 'https://www.tiktok.com/@labelmaisoncg/video/7625243889615506710',
    label: 'TikTok',
    caption: '@labelmaisoncg · Standards Label Maison',
  },
];

function PlatformBadge({ kind }: { kind: ProofItem['kind'] }) {
  if (kind === 'youtube') {
    return (
      <span className="inline-flex items-center gap-1 bg-[#FF0000] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md">
        YouTube
      </span>
    );
  }
  if (kind === 'instagram') {
    return (
      <span
        className="inline-flex items-center gap-1 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
        style={{
          background:
            'linear-gradient(45deg,#F58529 0%,#DD2A7B 50%,#8134AF 75%,#515BD4 100%)',
        }}
      >
        Instagram
      </span>
    );
  }
  if (kind === 'tiktok') {
    return (
      <span className="inline-flex items-center gap-1 bg-black text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md">
        TikTok
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-[#A97C30] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md">
      Avis client
    </span>
  );
}

function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-14 h-14 rounded-full bg-white/95 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex items-center justify-center">
        <svg width="20" height="22" viewBox="0 0 20 22" fill="none">
          <path d="M2 2L18 11L2 20V2Z" fill="#0A0A0A" />
        </svg>
      </div>
    </div>
  );
}

function ProofCard({ item, isCenter }: { item: ProofItem; isCenter: boolean }) {
  const ctaLabel =
    item.kind === 'youtube'
      ? 'Regarder sur YouTube'
      : item.kind === 'instagram'
        ? 'Voir sur Instagram'
        : item.kind === 'tiktok'
          ? 'Voir sur TikTok'
          : 'Avis vérifié';

  return (
    <article
      className="relative bg-white rounded-[28px] overflow-hidden border border-black/5 transition-all duration-500 flex flex-col"
      style={{
        height: 520,
        transform: isCenter ? 'scale(1)' : 'scale(0.94)',
        boxShadow: isCenter
          ? '0 28px 60px rgba(10,10,10,0.18)'
          : '0 8px 24px rgba(10,10,10,0.08)',
      }}
    >
      {/* Header type "BNBCleaning ✓" */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full bg-[#A97C30] text-white flex items-center justify-center text-[12px] font-bold shrink-0">
          LM
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-bold text-neutral-900 truncate">
              Label Maison
            </span>
            <CheckCircle2 size={12} className="text-[#1d9bf0] shrink-0" />
          </div>
          <span className="text-[11px] text-neutral-500 truncate block">{item.label}</span>
        </div>
        <PlatformBadge kind={item.kind} />
      </div>

      {/* Visuel */}
      <div className="relative flex-1 mx-3 rounded-2xl overflow-hidden bg-neutral-100">
        {item.kind === 'screenshot' && (
          <ImageWithFallback
            src={item.image}
            alt={item.caption}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {item.kind === 'youtube' && (
          <>
            <ImageWithFallback
              src={item.poster ?? ''}
              alt={item.caption}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <PlayOverlay />
          </>
        )}

        {(item.kind === 'instagram' || item.kind === 'tiktok') && (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  item.kind === 'instagram'
                    ? 'linear-gradient(135deg,#F58529 0%,#DD2A7B 45%,#8134AF 75%,#515BD4 100%)'
                    : 'linear-gradient(135deg,#25F4EE 0%,#000000 50%,#FE2C55 100%)',
              }}
            />
            <div className="absolute inset-0 bg-black/15" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] opacity-90">
                {item.kind === 'instagram' ? 'Reel' : 'Video'}
              </span>
              <span className="text-[11px] font-semibold opacity-90">@labelmaisoncg</span>
            </div>
            <PlayOverlay />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <p className="text-[13px] font-semibold leading-tight drop-shadow-md">
                {item.caption}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer / CTA visuel (toute la carte est cliquable) */}
      <div className="px-4 pt-3 pb-4">
        {item.kind === 'screenshot' ? (
          <p className="text-[12px] text-neutral-700 leading-snug line-clamp-2">
            {item.caption}
          </p>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full bg-neutral-900 text-white text-[13px] font-semibold py-2.5 rounded-full">
            {ctaLabel} <ArrowRight size={13} />
          </div>
        )}
      </div>
    </article>
  );
}

// Wrapper qui rend la carte cliquable sans déclencher après un drag
function ClickableCard({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  const startRef = useRef({ x: 0, y: 0, dragged: false });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className="cursor-pointer h-full outline-none focus-visible:ring-2 focus-visible:ring-[#A97C30] focus-visible:ring-offset-2 rounded-[28px]"
      onPointerDown={(e) => {
        startRef.current = { x: e.clientX, y: e.clientY, dragged: false };
      }}
      onPointerMove={(e) => {
        const { x, y } = startRef.current;
        if (Math.abs(e.clientX - x) > 6 || Math.abs(e.clientY - y) > 6) {
          startRef.current.dragged = true;
        }
      }}
      onClick={() => {
        if (!startRef.current.dragged) onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
}

// Extrait l'URL d'embed selon la plateforme
function getEmbedUrl(item: ProofItem): string | null {
  if (item.kind === 'youtube') {
    const m = item.url.match(/(?:youtu\.be\/|v=)([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0&modestbranding=1` : null;
  }
  if (item.kind === 'instagram') {
    const m = item.url.match(/\/reel\/([\w-]+)/);
    return m ? `https://www.instagram.com/reel/${m[1]}/embed/captioned/` : null;
  }
  if (item.kind === 'tiktok') {
    const m = item.url.match(/\/video\/(\d+)/);
    return m
      ? `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&music_info=1&description=1`
      : null;
  }
  return null;
}

function ProofLightbox({ item, onClose }: { item: ProofItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const embed = item.kind !== 'screenshot' ? getEmbedUrl(item) : null;
  const isYouTube = item.kind === 'youtube';
  const externalUrl = item.kind !== 'screenshot' ? item.url : null;
  const platformLabel =
    item.kind === 'youtube'
      ? 'YouTube'
      : item.kind === 'instagram'
        ? 'Instagram'
        : item.kind === 'tiktok'
          ? 'TikTok'
          : 'Image';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Lecture ${platformLabel}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-2xl leading-none transition-colors z-10"
      >
        ×
      </button>

      <div
        className="relative w-full"
        style={{ maxWidth: isYouTube ? 960 : 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        {item.kind === 'screenshot' ? (
          <img
            src={item.image}
            alt={item.caption}
            className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl mx-auto block"
          />
        ) : embed ? (
          <div
            className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl"
            style={{ aspectRatio: isYouTube ? '16 / 9' : '9 / 16', maxHeight: '85vh' }}
          >
            <iframe
              src={embed}
              title={item.caption}
              className="w-full h-full block"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : null}

        {externalUrl && (
          <div className="mt-4 flex justify-center">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-[13px] font-semibold px-5 py-2.5 rounded-full transition-colors"
            >
              Ouvrir sur {platformLabel} <ArrowRight size={13} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Carte compacte pour la colonne verticale (screenshots clients)
function CompactProofCard({ item }: { item: Extract<ProofItem, { kind: 'screenshot' }> }) {
  return (
    <article className="bg-white rounded-2xl border border-[#ECE3D0] border border-black/5 overflow-hidden shadow-[0_6px_20px_rgba(10,10,10,0.06)] flex">
      <div className="relative w-[120px] shrink-0 bg-neutral-50">
        <ImageWithFallback
          src={item.image}
          alt={item.caption}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      </div>
      <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#A97C30] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
            LM
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-neutral-900 truncate">
                Label Maison
              </span>
              <CheckCircle2 size={12} className="text-[#1d9bf0] shrink-0" />
            </div>
            <span className="text-[11px] text-neutral-500 truncate block">{item.label}</span>
          </div>
          <span className="bg-[#A97C30]/10 text-[#7C561D] text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0">
            Vérifié
          </span>
        </div>
        <p className="text-[13px] text-neutral-700 italic leading-snug line-clamp-3">
          {item.caption}
        </p>
      </div>
    </article>
  );
}

function VerticalProofColumn({
  items,
  onSelect,
}: {
  items: Extract<ProofItem, { kind: 'screenshot' }>[];
  onSelect: (i: ProofItem) => void;
}) {
  const doubled = [...items, ...items];
  return (
    <div
      className="proof-vscroll-wrap relative h-[520px] md:h-[600px] overflow-hidden mx-auto w-full max-w-[420px]"
      style={{
        maskImage:
          'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)',
      }}
    >
      <div className="proof-vscroll flex flex-col">
        {doubled.map((item, i) => (
          <div key={i} className="mb-4">
            <ClickableCard
              ariaLabel={`Voir le message client : ${item.caption}`}
              onClick={() => onSelect(item)}
            >
              <CompactProofCard item={item} />
            </ClickableCard>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofSection() {
  const [active, setActive] = useState<ProofItem | null>(null);
  const screenshots = proofs.filter(
    (p): p is Extract<ProofItem, { kind: 'screenshot' }> => p.kind === 'screenshot',
  );
  const videos = proofs.filter((p) => p.kind !== 'screenshot');

  return (
    <section className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="inline-flex items-center bg-[#A97C30]/15 text-[#7C561D] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            Preuves & coulisses
          </span>
          <h2 className="mt-4 text-[30px] md:text-[44px] font-bold leading-[1.05]">
            Ils adorent,{' '}
            <span className="font-serif-italic font-bold text-[#A97C30]">
              pourquoi pas vous&nbsp;?
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-8 items-start">
          {/* COLONNE GAUCHE — screenshots clients (auto-scroll vertical) */}
          <div className="flex flex-col">
            <VerticalProofColumn items={screenshots} onSelect={setActive} />
            <div className="mt-6 md:mt-8">
              <h3 className="text-[20px] md:text-[24px] font-bold leading-tight">
                Ils nous font confiance
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700 leading-relaxed">
                Propriétaires & voyageurs nous écrivent au quotidien. Chaque message
                provient d'un client réel pris en charge par Label Maison Conciergerie.
              </p>
            </div>
          </div>

          {/* COLONNE DROITE — reels Instagram, TikTok, YouTube */}
          <div className="flex flex-col">
            <div className="-mx-2">
              <DragCarousel
                count={videos.length}
                cardWidth={260}
                loop
                ariaLabel="Coulisses Label Maison, faites glisser pour explorer"
                renderCard={({ index, isCenter }) => {
                  const item = videos[index];
                  return (
                    <ClickableCard
                      ariaLabel={`Lire ${item.label} : ${item.caption}`}
                      onClick={() => setActive(item)}
                    >
                      <ProofCard item={item} isCenter={isCenter} />
                    </ClickableCard>
                  );
                }}
              />
            </div>
            <div className="mt-6 md:mt-8">
              <h3 className="text-[20px] md:text-[24px] font-bold leading-tight">
                Dans les coulisses de Label Maison
              </h3>
              <p className="mt-2 text-[14px] md:text-[15px] text-neutral-700 leading-relaxed">
                Reels Instagram, vidéos TikTok et podcasts YouTube : le quotidien terrain
                de l'équipe et nos conseils en gestion locative, lecture directe depuis
                le site.
              </p>
            </div>
          </div>
        </div>
      </div>

      {active && <ProofLightbox item={active} onClose={() => setActive(null)} />}
    </section>
  );
}

// =============================================================================
// CONTACT
// =============================================================================
function ContactSection() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    const result = await submitContactForm('contact', e.currentTarget);
    setSending(false);
    if (result.ok) setSubmitted(true);
    else setError(result.error);
  };

  return (
    <section id="contact" className="py-[60px] md:py-[100px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nous contacter"
          title={<>Nous <em className="font-serif-italic font-bold text-[#A97C30] not-italic">contacter</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-start">
          <div className="bg-white rounded-2xl border border-[#ECE3D0] border border-black/5 p-6 md:p-8">
            {submitted ? (
              <div className="flex items-start gap-3 bg-[#A97C30]/10 text-[#7C561D] rounded-lg p-4">
                <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Merci pour votre message !</p>
                  <p className="text-[14px]">Nous vous répondons sous 24 h.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Adresse du bien">
                  <input
                    type="text"
                    name="adresse"
                    required
                    placeholder="Adresse du bien"
                    className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                  />
                </Field>
                <Field label="Nombre de chambres">
                  <select
                    name="chambres"
                    required
                    defaultValue=""
                    className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                  >
                    <option value="" disabled>Choisissez</option>
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
                      className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      name="tel"
                      placeholder="+33 6 12 34 56 78"
                      className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30]"
                    />
                  </Field>
                </div>
                <Field label="Votre message">
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Parlez-nous de votre projet"
                    className="w-full bg-[#F4F1EA] px-3 py-2.5 rounded-md border-b border-neutral-300 focus:outline-none focus:border-[#A97C30] resize-y"
                  />
                </Field>
                {error && (
                  <p className="text-[13px] font-semibold text-red-600">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center justify-center gap-2 bg-[#403118] text-white font-bold text-[14px] px-6 py-3.5 rounded-full hover:bg-[#2C2418] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending ? 'Envoi…' : 'Prendre contact'} <Send size={14} />
                </button>
              </form>
            )}
          </div>

          <div className="md:pl-8 md:border-l md:border-black/10">
            <h3 className="text-[20px] md:text-[22px] font-bold mb-5">Coordonnées</h3>
            <ul className="space-y-4 text-[15px]">
              <li className="flex items-start gap-3">
                <Phone size={20} className="text-[#A97C30] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Téléphone</p>
                  <a href={PHONE_HREF} className="text-neutral-700 hover:text-[#A97C30]">
                    {PHONE_DISPLAY}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={20} className="text-[#A97C30] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Email</p>
                  <a href={`mailto:${EMAIL}`} className="text-neutral-700 hover:text-[#A97C30] break-all">
                    {EMAIL}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Instagram size={20} className="text-[#A97C30] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Instagram</p>
                  <a
                    href="https://www.instagram.com/labelmaisoncg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:text-[#A97C30]"
                  >
                    @labelmaisoncg
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Music size={20} className="text-[#A97C30] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">TikTok</p>
                  <a
                    href="https://www.tiktok.com/@labelmaisoncg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 hover:text-[#A97C30]"
                  >
                    @labelmaisoncg
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={20} className="text-[#A97C30] shrink-0 mt-0.5" />
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
      <span className="block text-[#7C561D] text-[12px] font-semibold uppercase tracking-[0.24em]">
        {eyebrow}
      </span>
      <span className="mt-2.5 block mx-auto md:mx-0 h-px w-11 bg-gradient-to-r from-[#a8813a] to-transparent" />
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
    <div className="bg-[#FBF9F4] text-[#2C2418]">
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
      <ValuesSection />
      <FaqSection />
      <AboutSection />
      <ProofSection />
      <ContactSection />
    </div>
  );
}
