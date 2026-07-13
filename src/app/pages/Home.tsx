import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
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
// ⚠️  HERO_IMAGE : mets ici le chemin d'un VRAI intérieur que tu gères
//     (dépose-le dans public/images/real/, ex. '/images/real/hero-appartement.jpg').
//     Tant qu'il vaut null, le hero affiche un canvas ivoire de marque (aucun stock).
const HERO_IMAGE: string | null = null;

function HeroSection() {
  const hasPhoto = Boolean(HERO_IMAGE);
  return (
    <section
      className="relative overflow-hidden min-h-[640px] md:min-h-[88vh] flex flex-col justify-center"
      style={
        hasPhoto
          ? undefined
          : { background: 'radial-gradient(130% 90% at 50% 0%, #FDFCF9 0%, #F9F7F1 58%, #F1EADB 100%)' }
      }
    >
      {/* Fond photo cinématique (si vraie photo dispo) */}
      {hasPhoto && (
        <div className="absolute inset-0 z-0">
          <ImageWithFallback
            src={HERO_IMAGE as string}
            alt="Intérieur d'un bien géré par Label Maison Conciergerie"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
        </div>
      )}

      {/* Filigrane monogramme discret (mode canvas ivoire) */}
      {!hasPhoto && (
        <img
          src="/images/key-gold-deep.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute right-[-40px] top-1/2 -translate-y-1/2 w-[420px] max-w-[55%] h-auto opacity-[0.06]"
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className={`relative z-10 w-full max-w-[1000px] mx-auto px-6 pt-[120px] md:pt-[132px] pb-16 md:pb-[132px] flex flex-col items-center text-center gap-7 ${
          hasPhoto ? 'text-white' : 'text-[#2C2418]'
        }`}
      >
        <span
          className={`inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.28em] ${
            hasPhoto ? 'text-white/80' : 'text-[#7C561D]'
          }`}
        >
          <span className={`h-px w-8 ${hasPhoto ? 'bg-white/50' : 'bg-[#a8813a]'}`} />
          Paris · Dubaï · Marrakech
          <span className={`h-px w-8 ${hasPhoto ? 'bg-white/50' : 'bg-[#a8813a]'}`} />
        </span>

        <h1 className="text-[38px] md:text-[64px] leading-[1.04] font-bold tracking-tight max-w-[16ch]">
          Votre patrimoine,{' '}
          <span className={`font-serif-italic font-bold ${hasPhoto ? 'text-[#E7D4A6]' : 'text-[#A97C30]'}`}>
            géré comme une maison de confiance.
          </span>
        </h1>

        <p
          className={`text-[16px] md:text-[19px] leading-relaxed max-w-xl ${
            hasPhoto ? 'text-white/85' : 'text-neutral-700'
          }`}
        >
          Gestion de biens, séjours d'exception et services sur mesure pour
          propriétaires et clients privés, avec exigence, présence et discrétion.
        </p>

        <div className="flex flex-row gap-3 mt-1">
          <a
            href="#contact"
            className="inline-flex items-center justify-center gap-2 bg-[#403118] text-white font-bold text-[14px] sm:text-[15px] px-7 py-4 rounded-full hover:bg-[#2C2418] transition-colors whitespace-nowrap"
          >
            Prendre contact <ArrowRight size={16} className="shrink-0" />
          </a>
          <a
            href="#services"
            className={`inline-flex items-center justify-center gap-2 font-bold text-[14px] sm:text-[15px] px-7 py-4 rounded-full transition-colors whitespace-nowrap ${
              hasPhoto
                ? 'border border-white/40 text-white hover:bg-white/10'
                : 'border border-[#403118]/20 text-[#403118] hover:border-[#A97C30] hover:text-[#7C561D]'
            }`}
          >
            Nos services <ArrowDown size={16} className="shrink-0" />
          </a>
        </div>
      </motion.div>
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
    <section className="relative z-10 mt-8 md:-mt-16">
      <div className="max-w-[1152px] mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl border border-[#ECE3D0] shadow-[0_30px_80px_rgba(64,49,24,0.08)] p-3 md:flex md:items-stretch md:gap-3 md:max-w-[900px] md:mx-auto"
        >
          <div
            className="relative md:w-5/12 min-h-[220px] md:min-h-[420px] rounded-xl overflow-hidden bg-cover bg-center"
            style={{
              backgroundImage: "url('/images/real/gestion-villa.jpg')",
            }}
          />

          <div className="md:w-7/12 p-4 md:p-6">
            <h2 className="font-serif-title text-[26px] md:text-[36px] leading-[1.1] font-normal">
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
// STORY / FONDATEUR — récit de marque (à la Maison Rivage)
// -----------------------------------------------------------------------------
// ⚠️  À PERSONNALISER : remplace le texte ci-dessous par ta vraie histoire et
//     la photo placeholder (bloc monogramme) par un vrai portrait :
//     dépose ta photo dans public/images/real/ (ex. portrait-fondateur.jpg)
//     puis mets STORY_PORTRAIT = '/images/real/portrait-fondateur.jpg'.
// =============================================================================
const STORY_PORTRAIT: string | null = '/images/real/portrait-abdel.jpg'; // portrait d'Abdel, fondateur

// Panneau monogramme de marque — sert de fond ET de fallback si la photo manque.
function MonogramPanel() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6"
      style={{ background: 'radial-gradient(120% 100% at 50% 0%, #403118 0%, #2C2418 100%)' }}
    >
      <img
        src="/images/key-gold-deep.png"
        alt=""
        aria-hidden
        className="w-16 md:w-20 h-auto opacity-95"
        style={{ filter: 'drop-shadow(0 6px 24px rgba(169,124,48,0.4))' }}
      />
      <p className="font-serif-italic text-[#D5C69F] text-[22px] md:text-[26px] tracking-wide">
        Label Maison
      </p>
    </div>
  );
}

// Portrait d'Abdel superposé au monogramme ; retombe sur le monogramme si le fichier est absent.
function StoryPortrait() {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <MonogramPanel />
      {STORY_PORTRAIT && !failed && (
        <img
          src={STORY_PORTRAIT}
          alt="Abdel, fondateur de Label Maison Conciergerie"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      )}
    </>
  );
}

function StorySection() {
  return (
    <section id="histoire" className="py-[72px] md:py-[120px] bg-[#FBF9F4]">
      <div className="max-w-[1152px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-12 md:gap-20 items-center">
        {/* PORTRAIT — vraie photo si dispo, sinon panneau monogramme de marque */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="relative aspect-[4/5] rounded-[20px] overflow-hidden"
        >
          <StoryPortrait />
        </motion.div>

        {/* RÉCIT */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <span className="block text-[#7C561D] text-[12px] font-semibold uppercase tracking-[0.24em]">
            Notre histoire
          </span>
          <span className="mt-3 block h-px w-11 bg-gradient-to-r from-[#a8813a] to-transparent" />

          <h2 className="mt-6 text-[30px] md:text-[44px] font-bold leading-[1.08] max-w-2xl">
            Née d'une conviction&nbsp;:{' '}
            <span className="font-serif-italic font-bold text-[#A97C30]">
              un bien confié mérite le même soin qu'un bien habité.
            </span>
          </h2>

          <div className="mt-7 space-y-5 text-[16px] md:text-[17px] text-neutral-700 leading-relaxed max-w-xl">
            <p>
              Trop de propriétaires vivent la même chose&nbsp;: un logement laissé
              à des prestataires qui ne se coordonnent pas, des séjours gérés à distance,
              un patrimoine qui perd de la valeur faute d'un vrai interlocuteur.{' '}
              <strong className="font-semibold text-neutral-900">Label Maison est née de ce constat.</strong>
            </p>
            <p>
              Nous avons bâti une conciergerie qui prend réellement en charge&nbsp;:
              présence sur le terrain, exigence à chaque détail, transparence sur les
              résultats. Pas de promesses, des preuves, mois après mois.
            </p>
            <p>
              {/* ✏️  Abdel : ajuste librement ce paragraphe avec ton vrai parcours. */}
              Je m'appelle <strong className="font-semibold text-neutral-900">Abdel</strong>. J'ai fondé Label Maison
              pour offrir aux propriétaires ce que je cherchais moi-même&nbsp;: quelqu'un qui traite
              leur bien comme le sien, à Paris comme à Dubaï ou Marrakech, sans jamais rogner
              sur l'exigence.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <span className="font-serif-italic text-[#A97C30] text-[26px] md:text-[30px]">
              Abdel
            </span>
            <span className="text-[13px] text-neutral-500 leading-tight">
              Fondateur
              <br />
              Label Maison Conciergerie · Paris · Dubaï · Marrakech
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// =============================================================================
// SERVICES CARROUSEL — coverflow 3D à défilement automatique
// (fusion « Nos services » + « En images ») — port du design Carrousel Conciergerie
// =============================================================================
function ServicesCarousel() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const n = services.length;

  // Navigation au glissement (tactile / souris), sans auto-défilement
  const swipe = useRef({ down: false, startX: 0, moved: false });
  const go = (dir: number) => setActive((a) => (a + dir + n) % n);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swipe.current = { down: true, startX: e.clientX, moved: false };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipe.current.down && Math.abs(e.clientX - swipe.current.startX) > 8) swipe.current.moved = true;
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.down) return;
    const dx = e.clientX - swipe.current.startX;
    swipe.current.down = false;
    if (dx < -40) go(1);
    else if (dx > 40) go(-1);
  };

  const offsetFor = (j: number) => {
    let o = j - active;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };

  const cardStyle = (o: number): React.CSSProperties => {
    const a = Math.abs(o);
    const sc = Math.max(1 - a * 0.14, 0.56);
    const rot = Math.max(Math.min(o * -28, 52), -52);
    const op = a > 3 ? 0 : Math.max(1 - a * 0.28, 0.16);
    return {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 300,
      height: 440,
      marginTop: -220,
      marginLeft: -150,
      borderRadius: 18,
      overflow: 'hidden',
      background: '#FFFFFF',
      cursor: 'pointer',
      transition:
        'transform .75s cubic-bezier(.22,.61,.36,1), opacity .6s, box-shadow .6s, border-color .6s',
      transform: `translateX(${o * 214}px) scale(${sc}) rotateY(${rot}deg)`,
      opacity: op,
      zIndex: 30 - a,
      pointerEvents: a > 3 ? 'none' : 'auto',
      boxShadow:
        o === 0
          ? '0 40px 70px -22px rgba(64,49,24,.34), 0 0 0 1px rgba(169,124,48,.5)'
          : '0 26px 50px -26px rgba(64,49,24,.28)',
      border: o === 0 ? '1px solid rgba(169,124,48,.5)' : '1px solid #ECE3D0',
    };
  };

  return (
    <section
      id="services"
      className="relative overflow-hidden py-[80px] md:py-[120px]"
      style={{ background: 'radial-gradient(120% 80% at 50% 0%, #FFFFFF 0%, #FBF9F4 46%, #F4ECDA 100%)' }}
    >
      {/* En-tête */}
      <div className="relative z-[5] max-w-[660px] mx-auto px-6 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <span className="h-px w-6" style={{ background: 'linear-gradient(90deg,transparent,#C39A4A)' }} />
          <span className="text-[12px] tracking-[0.34em] uppercase text-[#A97C30] font-semibold">Nos services</span>
          <span className="h-px w-6" style={{ background: 'linear-gradient(90deg,#C39A4A,transparent)' }} />
        </div>
        <h2 className="font-bold leading-[1.06] tracking-[-0.015em] text-[clamp(32px,5vw,52px)]">
          Six expertises pour un service{' '}
          <em className="font-serif-italic font-bold text-[#A97C30]">d'exception</em>
        </h2>
        <p className="mt-4 text-[#6E6554] text-[15.5px] leading-[1.6]">
          De la gestion de votre patrimoine à l'organisation de vos expériences les plus
          exclusives, nos six pôles couvrent tous les besoins d'une clientèle exigeante.
        </p>
      </div>

      {/* Scène coverflow */}
      <div
        className="relative w-full max-w-[1120px] mx-auto flex items-center justify-center min-h-[540px] mt-6 cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 w-[460px] h-[400px] rounded-full"
          style={{
            transform: 'translate(-50%,-50%)',
            background: 'radial-gradient(circle, rgba(169,124,48,.16) 0%, rgba(169,124,48,0) 70%)',
            filter: 'blur(14px)',
            animation: 'cc-glow 6.5s ease-in-out infinite',
          }}
        />
        <div style={{ position: 'relative', width: '100%', height: 500, perspective: '1800px', transformStyle: 'preserve-3d' }}>
          {services.map((s, j) => {
            const o = offsetFor(j);
            const isCenter = o === 0;
            return (
              <div
                key={s.title}
                style={cardStyle(o)}
                onClick={() => {
                  if (swipe.current.moved) return;
                  isCenter ? navigate(s.href) : setActive(j);
                }}
                role={isCenter ? 'link' : 'button'}
                aria-label={isCenter ? `Découvrir ${s.title}` : `Voir ${s.title}`}
              >
                <div style={{ position: 'relative', height: 236, overflow: 'hidden', background: '#F1EEE7' }}>
                  <ImageWithFallback src={s.image} alt={s.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(180deg, rgba(24,18,8,0) 42%, rgba(24,18,8,.55) 100%)' }}
                  />
                  <div
                    className="absolute left-[18px] bottom-3.5 text-[11px] tracking-[0.16em] uppercase font-semibold pointer-events-none"
                    style={{ color: '#F6EFDE', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}
                  >
                    {s.eyebrow}
                  </div>
                </div>
                <div className="flex flex-col" style={{ padding: '20px 22px 22px', height: 'calc(100% - 236px)' }}>
                  <h3 className="text-[19px] font-bold leading-[1.2] tracking-[-0.01em] text-[#2C2418] mb-2">{s.title}</h3>
                  <p className="text-[14px] leading-[1.55] text-[#6E6554]">{s.text}</p>
                  <div className="mt-auto pt-3.5 flex items-center gap-1.5 text-[#A97C30] text-[13px] font-semibold">
                    En savoir plus <span className="text-[15px]">→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Repères (glissez pour naviguer) */}
      <div className="relative z-[5] flex flex-col items-center gap-4 mt-2">
        <span className="font-serif-title text-[17px] text-[#A97C30] tracking-[0.1em]">
          {String(active + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
        </span>
        <div className="flex gap-2.5">
          {services.map((_, j) => (
            <button
              key={j}
              onClick={() => setActive(j)}
              aria-label={`Aller à la carte ${j + 1}`}
              className="h-2 rounded-md border-0 p-0 transition-all"
              style={{ width: j === active ? 26 : 8, background: j === active ? '#A97C30' : 'rgba(169,124,48,.28)' }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// LIFESTYLE SHOWCASE — bande vidéo cinématique + galerie photos défilante
// (vraies photos/vidéos IG @labelmaisoncg)
// =============================================================================
const LIFESTYLE_VIDEOS: { src: string; poster: string; label: string }[] = [
  { src: '/videos/life-dubai.mp4', poster: '/images/real/life-dubai-poster.jpg', label: 'Dubaï' },
  { src: '/videos/life-burj.mp4', poster: '/images/real/life-burj-poster.jpg', label: 'Burj Al Arab' },
  { src: '/videos/life-jetski.mp4', poster: '/images/real/life-jetski-poster.jpg', label: 'Jet-ski' },
  { src: '/videos/sejour-mer.mp4', poster: '/images/real/sejour-mer-poster.jpg', label: 'Séjours en mer' },
  { src: '/videos/life-catamaran.mp4', poster: '/images/real/life-catamaran-poster.jpg', label: 'En mer' },
  { src: '/videos/proof-avion.mp4', poster: '/images/real/proof-avion-poster.jpg', label: 'Vol premium' },
  { src: '/videos/proof-voiture-nuit.mp4', poster: '/images/real/proof-voiture-nuit-poster.jpg', label: 'Transport privé' },
  { src: '/videos/life-quad.mp4', poster: '/images/real/life-quad-poster.jpg', label: 'Quad · désert' },
  { src: '/videos/proof-dubai-fontaines.mp4', poster: '/images/real/proof-dubai-fontaines-poster.jpg', label: 'Fontaines de Dubaï' },
];

function LifestyleShowcase() {
  // Boucle infinie : on triple les items et on recentre invisiblement sur le set du milieu
  const items = [...LIFESTYLE_VIDEOS, ...LIFESTYLE_VIDEOS, ...LIFESTYLE_VIDEOS];
  // Défilement tactile : glisser à la souris ET au doigt (pas d'auto-scroll, pas de CTA)
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0 });

  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = el.scrollWidth / 3; // démarre sur le set du milieu
  }, []);

  // Recentre en boucle : dès qu'on approche d'un bord, on saute d'un set (imperceptible)
  const onScrollLoop = () => {
    const el = trackRef.current;
    if (!el) return;
    const set = el.scrollWidth / 3;
    if (el.scrollLeft < set * 0.5) {
      el.scrollLeft += set;
      drag.current.startLeft += set;
    } else if (el.scrollLeft > set * 1.5) {
      el.scrollLeft -= set;
      drag.current.startLeft -= set;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft };
    el.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || !drag.current.down) return;
    el.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    drag.current.down = false;
    trackRef.current?.releasePointerCapture?.(e.pointerId);
  };
  return (
    <section className="bg-[#FBF9F4]">
      {/* Bande vidéo cinématique */}
      <div className="relative w-full h-[58vh] md:h-[76vh] overflow-hidden">
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/videos/sejour-mer.mp4"
          poster="/images/real/sejour-mer-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(20,14,6,.35) 0%, rgba(20,14,6,.22) 45%, rgba(20,14,6,.72) 100%)' }}
        />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 h-full flex flex-col items-center justify-center text-center text-white px-6"
        >
          <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.28em] text-white/80">
            <span className="h-px w-8 bg-white/50" /> Séjours &amp; expériences <span className="h-px w-8 bg-white/50" />
          </span>
          <h2 className="mt-5 font-serif-title text-[34px] md:text-[56px] font-normal leading-[1.06] max-w-[18ch]">
            L'art de vivre Label Maison,{' '}
            <span className="font-serif-italic text-[#E7D4A6]">en mouvement.</span>
          </h2>
          <p className="mt-5 text-[16px] md:text-[18px] text-white/85 max-w-xl leading-relaxed">
            De Paris à Dubaï, de Marrakech aux plus belles côtes : un aperçu réel
            de nos séjours, expériences et acquisitions.
          </p>
          <a
            href="#contact"
            className="mt-8 inline-flex items-center gap-2 bg-white text-[#2C2418] font-bold text-[14px] px-7 py-4 rounded-full hover:bg-[#E7D4A6] transition-colors"
          >
            Composer votre séjour <ArrowRight size={16} />
          </a>
        </motion.div>
      </div>

      {/* Galerie vidéos — défilement tactile (swipe), sans auto-scroll */}
      <div className="py-[56px] md:py-[80px]">
        <div
          ref={trackRef}
          onScroll={onScrollLoop}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          className="flex gap-4 md:gap-5 overflow-x-auto px-6 md:px-10 pb-2 select-none touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing"
        >
          {items.map((p, i) => (
            <figure
              key={i}
              className="relative shrink-0 snap-start w-[210px] h-[280px] md:w-[260px] md:h-[340px] rounded-2xl overflow-hidden bg-neutral-200"
            >
              <video
                src={p.src}
                poster={p.poster}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <figcaption className="absolute bottom-3.5 left-4 text-white text-[12px] font-semibold uppercase tracking-[1.5px]">
                {p.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
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
const results = [
  {
    month: 'Décembre 2025',
    amount: '6 359,32 €',
    label: 'en un seul mois',
    text: 'Un seul bien géré en location courte durée : plus de 6 000 € de revenus nets, générés en un mois.',
    stats: [
      { k: 'Revenus nets', v: '6 359 €' },
      { k: 'Bien géré', v: '1 seul' },
    ],
    img: '/images/img-proprietaire-decembre.png',
    imgAlt: 'Revenus Airbnb décembre 2025 : 6 359,32 € — capture réelle',
  },
  {
    month: 'Janvier 2026',
    amount: '8 782 €',
    label: 'prévus ce mois-ci',
    text: 'La performance se confirme dans la durée, avec des réservations déjà sécurisées.',
    stats: [
      { k: 'Déjà encaissé', v: '1 456 €' },
      { k: 'Confirmé', v: '7 326 €' },
    ],
    img: '/images/img-proprietaire-janvier.png',
    imgAlt: 'Revenus Airbnb janvier 2026 : 8 782 € prévus — capture réelle',
  },
];

function ResultsSection() {
  return (
    <section className="relative py-[80px] md:py-[140px] bg-[#F7F4EE] overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -right-20 w-[440px] h-[440px] rounded-full bg-[#A97C30]/10 blur-3xl" />
      <div className="relative max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Performance mesurée"
          title={<>Des résultats <em className="font-serif-italic font-bold text-[#A97C30] not-italic">concrets</em>, mois après mois</>}
        />
        <p className="mt-4 max-w-2xl text-[15px] md:text-[16px] text-neutral-700">
          Nos chiffres ne sont pas des promesses, ce sont des preuves. Voici les revenus
          générés par un seul logement géré par notre conciergerie.
        </p>

        <div className="mt-12 flex flex-col gap-8 md:gap-10">
          {results.map((r, i) => (
            <motion.article
              key={r.month}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: i * 0.1 }}
              className="group relative bg-white rounded-[22px] border border-[#ECE3D0] shadow-[0_18px_54px_rgba(64,49,24,0.07)] hover:shadow-[0_24px_66px_rgba(64,49,24,0.11)] transition-shadow duration-300 overflow-hidden"
            >
              <div className="h-1 w-full bg-gradient-to-r from-[#C39A4A] via-[#A97C30] to-[#7C561D]" />

              {/* En-tête : montant + détail */}
              <div className="p-6 md:p-9 flex flex-col md:flex-row md:items-center gap-5 md:gap-10">
                <div className="md:w-[40%] md:shrink-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[12px] font-semibold uppercase tracking-[1.6px] text-[#A97C30]">
                      {r.month}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#7C561D] bg-[#A97C30]/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={13} /> Preuve réelle
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="font-serif-italic font-bold text-[#A97C30] text-[46px] md:text-[60px] leading-[0.92]">
                      {r.amount}
                    </span>
                    <TrendingUp className="text-[#A97C30] mb-2.5 shrink-0" size={30} strokeWidth={2} />
                  </div>
                  <p className="mt-1.5 text-[20px] md:text-[24px] font-bold text-[#2C2418]">{r.label}</p>
                </div>

                <div className="md:flex-1">
                  <p className="text-[14px] md:text-[15px] text-neutral-600 leading-relaxed max-w-md">{r.text}</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {r.stats.map((s) => (
                      <div
                        key={s.k}
                        className="flex flex-col px-4 py-2.5 rounded-xl bg-[#FBF6EC] border border-[#ECE3D0]"
                      >
                        <span className="text-[10.5px] uppercase tracking-[0.5px] text-[#8A7A52]">{s.k}</span>
                        <span className="text-[16px] font-bold text-[#403118]">{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preuve : la capture Airbnb, en grand */}
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <div className="relative rounded-xl overflow-hidden border border-[#ECE3D0] shadow-[0_10px_30px_rgba(64,49,24,0.10)]">
                  <img src={r.img} alt={r.imgAlt} className="w-full h-auto block" loading="lazy" />
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitsSection() {
  return (
    <section className="py-[80px] md:py-[140px]">
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
              className="bg-white rounded-2xl border border-[#ECE3D0] p-6 md:p-8 shadow-[0_10px_40px_rgba(64,49,24,0.05)] hover:shadow-[0_14px_46px_rgba(64,49,24,0.07)] transition-shadow duration-300 flex flex-col gap-4"
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
    image: '/images/real/gestion-villa.jpg',
    href: '/proprietaires',
    eyebrow: 'Notre cœur de métier',
  },
  {
    icon: Plane,
    title: "Billetterie d'avion",
    text: "Vols privés, jets, classe affaires et première classe. Du sol au ciel, tout est orchestré.",
    image: '/images/real/billetterie-avion.jpg',
    href: '/billetterie',
    eyebrow: 'Voyage premium',
  },
  {
    icon: Bed,
    title: "Logement d'exception",
    text: "Studios, suites avec jacuzzi, villas et penthouses. Des lieux à la hauteur de votre style de vie.",
    image: '/images/real/logement-suite.jpg',
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
    image: '/images/real/activites-jetski-burj.jpg',
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

// (ServicesSection en grille remplacé par ServicesCarousel — voir plus haut)

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
    <section id="process" className="py-[80px] md:py-[140px] bg-[#F7F4EE]">
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
              src="/images/real/hero-logement-exception.jpg"
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
    <section className="py-[80px] md:py-[140px]">
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

              <h2 className="mt-5 font-serif-title text-[30px] md:text-[46px] font-normal leading-[1.08]">
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
    <section id="faq" className="py-[80px] md:py-[140px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-10 md:gap-16 items-start">
        <div className="md:sticky md:top-28">
          <span className="inline-flex items-center bg-[#A97C30]/15 text-[#7C561D] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            FAQ
          </span>
          <h2 className="mt-4 font-serif-title text-[34px] md:text-[52px] font-normal leading-[1.08]">
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
  n: string;
  title: string;
  lead: string;
  text: string;
};

const values: ValueItem[] = [
  {
    icon: Clock,
    n: '01',
    title: 'Temps',
    lead: 'Gagnez un temps précieux',
    text: "Laissez votre conciergerie s'occuper de tout, de la mise en ligne à la remise des clés.",
  },
  {
    icon: TrendingUp,
    n: '02',
    title: 'Rentabilité',
    lead: '+15 à 40 % de revenus',
    text: 'Une gestion professionnelle qui optimise le rendement de votre bien en location courte durée.',
  },
  {
    icon: ShieldCheck,
    n: '03',
    title: 'Fiabilité',
    lead: 'Toujours au rendez-vous',
    text: 'Un service sûr et rigoureux, fiable à chaque étape, pour une tranquillité totale.',
  },
  {
    icon: Feather,
    n: '04',
    title: 'Sérénité',
    lead: "L'esprit enfin tranquille",
    text: 'Libérez-vous des contraintes : chaque détail est géré, pour un quotidien sans stress.',
  },
];

function ValuesSection() {
  return (
    <section id="valeurs" className="py-[80px] md:py-[140px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nos valeurs"
          title={<>Pourquoi nous <em className="font-serif-italic font-bold text-[#A97C30] not-italic">choisir&nbsp;?</em></>}
        />

        <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          {values.map((v, i) => (
            <motion.article
              key={v.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden bg-gradient-to-b from-white to-[#FBF8F1] rounded-[20px] border border-[#ECE3D0] p-7 md:p-8 shadow-[0_10px_36px_rgba(64,49,24,0.05)] hover:shadow-[0_22px_50px_-14px_rgba(64,49,24,0.16)] hover:-translate-y-1 hover:border-[#A97C30]/40 transition-all duration-[400ms] flex flex-col"
            >
              {/* Numéro filigrane serif */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-4 right-3 font-serif-title text-[92px] leading-none text-[#A97C30] opacity-[0.07] select-none"
              >
                {v.n}
              </span>

              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-[#A97C30]/10 text-[#A97C30] ring-1 ring-[#A97C30]/20 group-hover:bg-[#A97C30]/15 transition-colors">
                <v.icon size={20} strokeWidth={1.6} />
              </div>

              <h3 className="relative mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                {v.title}
              </h3>
              <p className="relative mt-2 font-serif-title text-[21px] md:text-[23px] leading-[1.15] text-[#A97C30]">
                {v.lead}
              </p>
              <p className="relative mt-3 text-[14px] md:text-[15px] leading-relaxed text-gray-600">
                {v.text}
              </p>
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
    <section id="apropos" className="py-[80px] md:py-[140px] bg-[#F7F4EE]">
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
          <h2 className="mt-4 font-serif-title text-[34px] md:text-[52px] font-normal leading-[1.08]">
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
    }
  | {
      kind: 'localvideo';
      src: string;
      poster: string;
      label: string;
      caption: string;
    };

// Vidéos réelles (stories IG @labelmaisoncg) montées en preuve/coulisses
const proofVideos: ProofItem[] = [
  { kind: 'localvideo', src: '/videos/proof-client-retour.mp4', poster: '/images/real/proof-client-retour-poster.jpg', label: 'Retour client', caption: 'Accueil client · fleurs & attentions' },
  { kind: 'localvideo', src: '/videos/proof-voiture-nuit.mp4', poster: '/images/real/proof-voiture-nuit-poster.jpg', label: 'Mobilité haut de gamme', caption: 'Chaque déplacement devient un privilège' },
  { kind: 'localvideo', src: '/videos/proof-arrivee.mp4', poster: '/images/real/proof-arrivee-poster.jpg', label: 'Transfert privé', caption: 'De l\'aéroport à la maison, sans couture' },
  { kind: 'localvideo', src: '/videos/proof-dubai-marina.mp4', poster: '/images/real/proof-dubai-marina-poster.jpg', label: 'Coulisses', caption: 'Marina de Dubaï, de nuit' },
  { kind: 'localvideo', src: '/videos/proof-dubai-fontaines.mp4', poster: '/images/real/proof-dubai-fontaines-poster.jpg', label: 'Coulisses', caption: 'Fontaines de Dubaï' },
  { kind: 'localvideo', src: '/videos/proof-avion.mp4', poster: '/images/real/proof-avion-poster.jpg', label: 'Voyage premium', caption: 'Au-dessus des nuages' },
];

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
  if (kind === 'localvideo') {
    return (
      <span className="inline-flex items-center gap-1 bg-[#403118] text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md">
        Vidéo
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
          : item.kind === 'localvideo'
            ? 'Voir la vidéo'
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

        {item.kind === 'localvideo' && (
          <>
            <ImageWithFallback
              src={item.poster}
              alt={item.caption}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] opacity-90">
                Réel
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
  const externalUrl =
    item.kind === 'instagram' || item.kind === 'tiktok' || item.kind === 'youtube'
      ? item.url
      : null;
  const platformLabel =
    item.kind === 'youtube'
      ? 'YouTube'
      : item.kind === 'instagram'
        ? 'Instagram'
        : item.kind === 'tiktok'
          ? 'TikTok'
          : item.kind === 'localvideo'
            ? 'Vidéo'
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
        ) : item.kind === 'localvideo' ? (
          <video
            src={item.src}
            poster={item.poster}
            controls
            autoPlay
            playsInline
            className="w-full h-auto max-h-[85vh] rounded-2xl shadow-2xl mx-auto block bg-black"
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
    <article className="bg-white rounded-2xl border border-[#ECE3D0] overflow-hidden shadow-[0_6px_20px_rgba(10,10,10,0.06)] flex">
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
  const videos = [...proofVideos, ...proofs.filter((p) => p.kind !== 'screenshot')];

  return (
    <section className="py-[80px] md:py-[140px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="text-center mb-12 md:mb-16">
          <span className="inline-flex items-center bg-[#A97C30]/15 text-[#7C561D] text-[13px] font-semibold px-4 py-1.5 rounded-full">
            Preuves & coulisses
          </span>
          <h2 className="mt-4 font-serif-title text-[34px] md:text-[52px] font-normal leading-[1.08]">
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
    <section id="contact" className="py-[80px] md:py-[140px] bg-[#F7F4EE]">
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader
          eyebrow="Nous contacter"
          title={<>Nous <em className="font-serif-italic font-bold text-[#A97C30] not-italic">contacter</em></>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-start">
          <div className="bg-white rounded-2xl border border-[#ECE3D0] p-6 md:p-8">
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
      <span className="mt-3 block mx-auto md:mx-0 h-px w-16 bg-gradient-to-r from-[#a8813a] to-transparent" />
      <h2 className="mt-5 font-serif-title text-[34px] md:text-[52px] font-normal leading-[1.08] tracking-[-0.01em] max-w-3xl">
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
      <StorySection />
      <ServicesCarousel />
      <LifestyleShowcase />
      <ResultsSection />
      <ProcessSection />
      <CleaningPartnerSection />
      <ValuesSection />
      <FaqSection />
      <ProofSection />
      <ContactSection />
    </div>
  );
}
