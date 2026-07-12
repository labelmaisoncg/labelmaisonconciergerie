import { useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, MapPin, Quote, Star } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

// =============================================================================
// PAGE HERO — branded hero with image background, badge pill and italic accent
// =============================================================================
type Cta = { label: string; href: string; primary?: boolean; external?: boolean };

export function PageHero({
  badge,
  badgeIcon,
  titleStart,
  titleAccent,
  titleEnd,
  subtitle,
  imageUrl,
  imageAlt,
  ctas = [],
}: {
  badge: string;
  badgeIcon?: ReactNode;
  titleStart?: string;
  titleAccent: string;
  titleEnd?: string;
  subtitle: string;
  imageUrl: string;
  imageAlt: string;
  ctas?: Cta[];
}) {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: 'radial-gradient(130% 90% at 50% 0%, #FDFCF9 0%, #F9F7F1 62%, #F4EFE6 100%)' }}
    >
      <div className="max-w-[1336px] mx-auto px-6 md:px-12 pt-[120px] md:pt-[160px] pb-[280px] md:pb-0 flex flex-col md:flex-row gap-10 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-20 flex flex-col items-center md:items-start text-center md:text-left gap-6 md:w-3/5 md:pr-12 md:pb-[120px]"
        >
          <span className="inline-flex items-center gap-2 bg-white border border-[#E2D7BD] text-[#403118] px-4 py-1.5 rounded-full text-[13px] font-medium">
            {badgeIcon ?? <MapPin size={14} className="text-[#A97C30]" />} {badge}
          </span>

          <h1 className="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight">
            {titleStart && <>{titleStart} </>}
            <span className="font-serif-italic font-bold text-[#A97C30]">{titleAccent}</span>
            {titleEnd && <> {titleEnd}</>}
          </h1>

          <p className="text-[16px] md:text-[18px] text-neutral-700 leading-relaxed max-w-xl">
            {subtitle}
          </p>

          {ctas.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {ctas.map((cta, i) => (
                <a
                  key={cta.href + i}
                  href={cta.href}
                  target={cta.external ? '_blank' : undefined}
                  rel={cta.external ? 'noopener noreferrer' : undefined}
                  className={`inline-flex items-center justify-center gap-2 font-bold text-[15px] px-7 py-4 rounded-full transition-colors ${
                    cta.primary
                      ? 'bg-[#A97C30] text-white hover:bg-[#7C561D]'
                      : 'bg-[#403118] text-white hover:bg-[#2C2418]'
                  }`}
                >
                  {cta.label} <ArrowRight size={16} />
                </a>
              ))}
            </div>
          )}
        </motion.div>

        <div className="relative md:w-2/5 min-h-[280px] md:min-h-[600px]">
          <div className="absolute inset-x-0 -bottom-[280px] md:bottom-0 md:inset-y-0 md:-right-[40%] md:left-0 md:w-[140%] h-[400px] md:h-full overflow-hidden rounded-2xl md:rounded-none">
            <ImageWithFallback
              src={imageUrl}
              alt={imageAlt}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-100/40 to-transparent md:bg-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// SECTION HEADER — eyebrow pill + bold title with italic Playfair accent
// =============================================================================
export function SectionHeader({
  eyebrow,
  titleStart,
  titleAccent,
  titleEnd,
  subtitle,
  align = 'left',
}: {
  eyebrow: string;
  titleStart?: string;
  titleAccent: string;
  titleEnd?: string;
  subtitle?: string;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'text-center mx-auto' : 'text-center md:text-left'}>
      <span className="block text-[#7C561D] text-[12px] font-semibold uppercase tracking-[0.24em]">
        {eyebrow}
      </span>
      <span
        className={`mt-2.5 block h-px w-11 bg-gradient-to-r from-[#a8813a] to-transparent ${
          align === 'center' ? 'mx-auto' : 'mx-auto md:mx-0'
        }`}
      />
      <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05] max-w-3xl mx-auto md:mx-0">
        {titleStart && <>{titleStart} </>}
        <span className="font-serif-italic font-bold text-[#A97C30]">{titleAccent}</span>
        {titleEnd && <> {titleEnd}</>}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-2xl text-[15px] md:text-[16px] text-neutral-700 mx-auto md:mx-0">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// FEATURE CARD — image on top + olive icon badge + title + body
// =============================================================================
export function FeatureCard({
  image,
  imageAlt,
  imageFit = 'cover',
  icon,
  badge,
  title,
  description,
}: {
  image?: string;
  imageAlt?: string;
  imageFit?: 'cover' | 'contain';
  icon?: ReactNode;
  badge?: string;
  title: string;
  description: string;
}) {
  const contain = imageFit === 'contain';
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      className="group relative bg-white rounded-[20px] border border-[#ECE3D0] overflow-hidden shadow-[0_10px_36px_rgba(64,49,24,0.05)] hover:shadow-[0_24px_60px_-12px_rgba(64,49,24,0.18)] hover:-translate-y-1 transition-all duration-[400ms] flex flex-col"
    >
      {image && (
        <div
          className={`relative overflow-hidden ${
            contain ? 'h-64 md:h-80 bg-[#F4F1EA]' : 'h-72 md:h-[360px]'
          }`}
        >
          <ImageWithFallback
            src={image}
            alt={imageAlt ?? title}
            className={`w-full h-full transition-transform duration-[600ms] ease-out ${
              contain
                ? 'object-contain p-4 group-hover:scale-[1.03]'
                : 'object-cover group-hover:scale-[1.06]'
            }`}
          />
          {!contain && (
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/25 to-transparent pointer-events-none" />
          )}
          {icon && (
            <div className="absolute top-4 left-4 w-11 h-11 rounded-full bg-white/90 backdrop-blur-md text-[#A97C30] flex items-center justify-center shadow-md">
              {icon}
            </div>
          )}
          {badge && (
            <span className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-[10px] font-semibold uppercase tracking-[1.5px] text-[#7C561D] px-3 py-1.5 rounded-full shadow-sm">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col flex-1 p-6 md:p-7 gap-2.5">
        {!image && icon && (
          <div className="w-12 h-12 rounded-xl bg-[#A97C30]/10 text-[#A97C30] flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <h3 className="text-[17px] md:text-[19px] font-semibold text-gray-900 leading-snug">
          {title}
        </h3>
        <p className="text-[14px] md:text-[15px] leading-relaxed text-gray-600">
          {description}
        </p>
      </div>
    </motion.article>
  );
}

// =============================================================================
// TESTIMONIAL CARD — for use on dark sections
// =============================================================================
export function TestimonialCard({
  name,
  context,
  quote,
  badge,
  index = 0,
}: {
  name: string;
  context: string;
  quote: string;
  badge?: string;
  index?: number;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ delay: (index % 3) * 0.05 }}
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-7 hover:bg-white/10 transition-colors duration-300 flex flex-col"
    >
      <Quote size={28} className="text-[#D5C69F] mb-3" />
      <div className="flex gap-1 mb-3">
        {[...Array(5)].map((_, idx) => (
          <Star key={idx} size={14} className="fill-[#D5C69F] text-[#D5C69F]" />
        ))}
      </div>
      <p className="text-[14px] md:text-[15px] text-white/85 italic leading-relaxed flex-1">
        « {quote} »
      </p>
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white text-[14px]">{name}</p>
          <p className="text-[12px] text-white/50">{context}</p>
        </div>
        {badge && (
          <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#D5C69F] whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
    </motion.article>
  );
}

// =============================================================================
// PROOF VIDEO — vraie vidéo (story IG) en preuve, format téléphone + texte
// =============================================================================
export function ProofVideo({
  eyebrow = 'En vidéo',
  titleStart,
  titleAccent,
  text,
  videoSrc,
  poster,
  caption,
  reverse = false,
  bg = 'zinc',
}: {
  eyebrow?: string;
  titleStart?: string;
  titleAccent: string;
  text: string;
  videoSrc: string;
  poster: string;
  caption?: string;
  reverse?: boolean;
  bg?: 'white' | 'zinc' | 'gradient';
}) {
  return (
    <Section bg={bg}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
        <div className={reverse ? 'md:order-2' : ''}>
          <div className="relative mx-auto w-full max-w-[300px] aspect-[9/16] rounded-[24px] overflow-hidden shadow-[0_30px_70px_-20px_rgba(64,49,24,0.5)] ring-1 ring-black/5 bg-black">
            <video
              src={videoSrc}
              poster={poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10 pointer-events-none" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white text-[11px] font-semibold uppercase tracking-[1.5px] opacity-90 pointer-events-none">
              <span>Réel</span>
              <span>@labelmaisoncg</span>
            </div>
            {caption && (
              <p className="absolute bottom-4 left-4 right-4 text-white text-[13px] font-semibold leading-tight drop-shadow-md pointer-events-none">
                {caption}
              </p>
            )}
          </div>
        </div>

        <div className={reverse ? 'md:order-1' : ''}>
          <span className="block text-[#7C561D] text-[12px] font-semibold uppercase tracking-[0.24em]">
            {eyebrow}
          </span>
          <span className="mt-3 block h-px w-16 bg-gradient-to-r from-[#a8813a] to-transparent" />
          <h2 className="mt-5 font-serif-title text-[30px] md:text-[44px] font-normal leading-[1.08]">
            {titleStart && <>{titleStart} </>}
            <span className="font-serif-italic font-bold text-[#A97C30]">{titleAccent}</span>
          </h2>
          <p className="mt-5 text-[16px] md:text-[17px] text-neutral-700 leading-relaxed max-w-xl">
            {text}
          </p>
        </div>
      </div>
    </Section>
  );
}

// =============================================================================
// MEDIA MARQUEE — galerie défilante mixte (photos + vidéos), plein largeur
// =============================================================================
type MediaItem = { type: 'image' | 'video'; src: string; poster?: string; label?: string };

export function MediaMarquee({
  eyebrow = 'En images',
  titleStart,
  titleAccent,
  subtitle,
  items,
  bg = 'white',
}: {
  eyebrow?: string;
  titleStart?: string;
  titleAccent: string;
  subtitle?: string;
  items: MediaItem[];
  bg?: 'white' | 'zinc' | 'gradient';
}) {
  const doubled = [...items, ...items];
  const bgHex = bg === 'zinc' ? '#F7F4EE' : '#FFFFFF';
  const sectionBg = bg === 'zinc' ? 'bg-[#F7F4EE]' : bg === 'gradient' ? 'bg-gradient-to-br from-gray-50 to-gray-100' : 'bg-white';
  return (
    <section className={`py-[60px] md:py-[100px] overflow-hidden ${sectionBg}`}>
      <div className="max-w-[1152px] mx-auto px-6">
        <SectionHeader eyebrow={eyebrow} titleStart={titleStart} titleAccent={titleAccent} subtitle={subtitle} />
      </div>
      <div className="lifestyle-marquee-wrap relative mt-12 md:mt-16">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-16 md:w-32 z-10"
          style={{ background: `linear-gradient(to right, ${bgHex}, transparent)` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-16 md:w-32 z-10"
          style={{ background: `linear-gradient(to left, ${bgHex}, transparent)` }}
        />
        <div className="lifestyle-marquee flex gap-4 md:gap-5 w-max">
          {doubled.map((m, i) => (
            <figure
              key={i}
              className="relative shrink-0 w-[220px] h-[300px] md:w-[270px] md:h-[360px] rounded-2xl overflow-hidden bg-neutral-200"
            >
              {m.type === 'video' ? (
                <video
                  src={m.src}
                  poster={m.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <ImageWithFallback src={m.src} alt={m.label ?? ''} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              {m.label && (
                <figcaption className="absolute bottom-3.5 left-4 text-white text-[12px] font-semibold uppercase tracking-[1.5px]">
                  {m.label}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// MEDIA CAROUSEL — carrousel interactif (flèches) mixte photos/vidéos + CTA
// =============================================================================
export function MediaCarousel({
  eyebrow = 'En images',
  titleStart,
  titleAccent,
  subtitle,
  items,
  cta,
  bg = 'white',
}: {
  eyebrow?: string;
  titleStart?: string;
  titleAccent: string;
  subtitle?: string;
  items: MediaItem[];
  cta?: { label: string; href: string; external?: boolean };
  bg?: 'white' | 'zinc' | 'gradient';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const sectionBg =
    bg === 'zinc' ? 'bg-[#F7F4EE]' : bg === 'gradient' ? 'bg-gradient-to-br from-gray-50 to-gray-100' : 'bg-white';

  const Arrows = ({ className = '' }: { className?: string }) => (
    <div className={`items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label="Précédent"
        className="w-12 h-12 rounded-full border border-[#A97C30]/40 bg-white text-[#A97C30] text-[18px] flex items-center justify-center hover:bg-[#FBF6EC] transition-colors"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label="Suivant"
        className="w-12 h-12 rounded-full bg-[#403118] text-[#F6EFDE] text-[18px] flex items-center justify-center hover:bg-[#2C2418] transition-colors"
      >
        →
      </button>
    </div>
  );

  return (
    <section className={`py-[60px] md:py-[100px] ${sectionBg}`}>
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="flex items-end justify-between gap-6">
          <SectionHeader eyebrow={eyebrow} titleStart={titleStart} titleAccent={titleAccent} subtitle={subtitle} />
          <Arrows className="hidden md:flex shrink-0 pb-1" />
        </div>

        <div
          ref={trackRef}
          className="mt-10 md:mt-12 flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((m, i) => (
            <figure
              key={i}
              className="relative shrink-0 snap-start w-[240px] h-[320px] md:w-[290px] md:h-[390px] rounded-2xl overflow-hidden bg-neutral-200"
            >
              {m.type === 'video' ? (
                <video
                  src={m.src}
                  poster={m.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <ImageWithFallback src={m.src} alt={m.label ?? ''} className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              {m.label && (
                <figcaption className="absolute bottom-3.5 left-4 text-white text-[12px] font-semibold uppercase tracking-[1.5px]">
                  {m.label}
                </figcaption>
              )}
            </figure>
          ))}
        </div>

        <div className="mt-9 flex items-center gap-4">
          {cta && (
            <a
              href={cta.href}
              target={cta.external ? '_blank' : undefined}
              rel={cta.external ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center gap-2 bg-[#A97C30] text-white font-bold text-[15px] px-7 py-4 rounded-full hover:bg-[#7C561D] transition-colors"
            >
              {cta.label} <ArrowRight size={16} />
            </a>
          )}
          <Arrows className="flex md:hidden ml-auto" />
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// FINAL CTA — green action banner at end of page
// =============================================================================
export function FinalCta({
  titleStart,
  titleAccent,
  titleEnd,
  subtitle,
  ctaLabel,
  ctaHref,
  external = false,
}: {
  titleStart?: string;
  titleAccent: string;
  titleEnd?: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  external?: boolean;
}) {
  return (
    <section className="py-[60px] md:py-[100px]">
      <div className="max-w-[1152px] mx-auto px-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#403118] to-[#2A2013] text-white rounded-2xl p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="pointer-events-none absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full bg-[#A97C30]/20 blur-3xl" />
          <div className="relative md:flex-1">
            <h2 className="text-[26px] md:text-[36px] font-bold leading-tight">
              {titleStart && <>{titleStart} </>}
              <span className="font-serif-italic font-bold text-[#D5C69F]">{titleAccent}</span>
              {titleEnd && <> {titleEnd}</>}
            </h2>
            <p className="mt-3 text-[15px] md:text-[17px] text-white/80 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
          <a
            href={ctaHref}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="relative inline-flex items-center gap-2 bg-gradient-to-r from-[#C39A4A] to-[#A97C30] text-[#2A1E0C] font-bold text-[15px] px-7 py-4 rounded-full hover:to-[#C39A4A] transition-all whitespace-nowrap"
          >
            {ctaLabel} <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

// =============================================================================
// SECTION WRAPPER — consistent vertical rhythm
// =============================================================================
export function Section({
  id,
  bg = 'white',
  children,
}: {
  id?: string;
  bg?: 'white' | 'zinc' | 'gradient';
  children: ReactNode;
}) {
  const bgClass =
    bg === 'gradient'
      ? 'bg-gradient-to-br from-gray-50 to-gray-100'
      : bg === 'zinc'
      ? 'bg-[#F7F4EE]'
      : '';
  return (
    <section id={id} className={`py-[60px] md:py-[100px] ${bgClass}`}>
      <div className="max-w-[1152px] mx-auto px-6">{children}</div>
    </section>
  );
}
