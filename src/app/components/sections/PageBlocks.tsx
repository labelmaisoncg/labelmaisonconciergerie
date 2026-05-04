import type { ReactNode } from 'react';
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
    <section className="relative bg-zinc-100 overflow-hidden">
      <div className="max-w-[1336px] mx-auto px-6 md:px-12 pt-[120px] md:pt-[160px] pb-[280px] md:pb-0 flex flex-col md:flex-row gap-10 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-20 flex flex-col items-center md:items-start text-center md:text-left gap-6 md:w-3/5 md:pr-12 md:pb-[120px]"
        >
          <span className="inline-flex items-center gap-2 bg-black/10 px-4 py-1.5 rounded-full text-[13px] font-medium">
            {badgeIcon ?? <MapPin size={14} />} {badge}
          </span>

          <h1 className="text-[34px] md:text-[48px] leading-[1.05] font-bold tracking-tight">
            {titleStart && <>{titleStart} </>}
            <span className="font-serif-italic font-bold text-[#556B2F]">{titleAccent}</span>
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
                      ? 'bg-[#556B2F] text-white hover:bg-[#3d4d22]'
                      : 'bg-black text-white hover:bg-neutral-700'
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
      <span className="inline-flex items-center bg-[#556B2F]/15 text-[#3d4d22] text-[13px] font-semibold px-4 py-1.5 rounded-full">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-[30px] md:text-[40px] font-bold leading-[1.05] max-w-3xl mx-auto md:mx-0">
        {titleStart && <>{titleStart} </>}
        <span className="font-serif-italic font-bold text-[#556B2F]">{titleAccent}</span>
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
  icon,
  badge,
  title,
  description,
}: {
  image?: string;
  imageAlt?: string;
  icon?: ReactNode;
  badge?: string;
  title: string;
  description: string;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.07)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col"
    >
      {image && (
        <div className="relative h-48 md:h-52 overflow-hidden">
          <ImageWithFallback
            src={image}
            alt={imageAlt ?? title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          {icon && (
            <div className="absolute top-4 left-4 w-11 h-11 rounded-xl bg-white/95 backdrop-blur-sm text-[#556B2F] flex items-center justify-center shadow-lg">
              {icon}
            </div>
          )}
          {badge && (
            <span className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-[1px] text-[#556B2F] px-2.5 py-1 rounded-full">
              {badge}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col flex-1 p-5 md:p-6 gap-3">
        {!image && icon && (
          <div className="w-12 h-12 rounded-xl bg-[#556B2F]/10 text-[#556B2F] flex items-center justify-center shrink-0">
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
      <Quote size={28} className="text-[#a3c47a] mb-3" />
      <div className="flex gap-1 mb-3">
        {[...Array(5)].map((_, idx) => (
          <Star key={idx} size={14} className="fill-[#a3c47a] text-[#a3c47a]" />
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
          <span className="text-[11px] font-semibold uppercase tracking-[1px] text-[#a3c47a] whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
    </motion.article>
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
        <div className="bg-[#556B2F] text-white rounded-2xl p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="md:flex-1">
            <h2 className="text-[26px] md:text-[36px] font-bold leading-tight">
              {titleStart && <>{titleStart} </>}
              <span className="font-serif-italic font-bold">{titleAccent}</span>
              {titleEnd && <> {titleEnd}</>}
            </h2>
            <p className="mt-3 text-[15px] md:text-[17px] text-white/90 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
          <a
            href={ctaHref}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="inline-flex items-center gap-2 bg-white text-[#3d4d22] font-bold text-[15px] px-7 py-4 rounded-full hover:bg-neutral-100 transition-colors whitespace-nowrap"
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
      ? 'bg-zinc-50'
      : '';
  return (
    <section id={id} className={`py-[60px] md:py-[100px] ${bgClass}`}>
      <div className="max-w-[1152px] mx-auto px-6">{children}</div>
    </section>
  );
}
