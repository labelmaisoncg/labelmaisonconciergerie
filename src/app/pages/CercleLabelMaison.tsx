import { useState, type FormEvent, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowDown,
  ChevronDown,
  CheckCircle2,
  Mail,
  Instagram,
  Wallet,
  Users,
  TrendingUp,
  HeartHandshake,
} from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

// =============================================================================
// Cercle LabelMaison — landing du programme d'affiliation
// Charte « Ivoire & or » du site : canvas ivoire/blanc dominant, or (#A97C30)
// en accent, titres Playfair. Hero + formulaire en brun profond (photo) pour
// la dramatisation ; sections claires alternées pour le rythme.
// =============================================================================

const EMAIL = 'labelmaisonconciergerie@gmail.com';
const INSTA_HANDLE = '@labelmaisoncg';
const INSTA_URL = 'https://instagram.com/labelmaisoncg';

const DARK_BG = 'linear-gradient(135deg, #4A3A17 0%, #372C11 55%, #2B220C 100%)';

// Charte site
const GOLD = '#A97C30';
const GOLD_DARK = '#7C561D';
const GOLD_LIGHT = '#E6CD93';
const GOLD_SOFT = '#ECD8A0';
const INK = '#2C2418';
const INK_2 = '#7A7264';
const IVORY = '#FBF9F4';
const IVORY_ALT = '#F7F4EE';
// Textes sur fond sombre
const TXT_DARK = '#F2ECD9';
const TXT_DARK_2 = '#C2B795';

const fadeUp = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------
function Eyebrow({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  const color = tone === 'dark' ? GOLD_SOFT : GOLD_DARK;
  const rule = tone === 'dark' ? 'rgba(236,216,160,0.5)' : 'rgba(169,124,48,0.45)';
  return (
    <span className="inline-flex items-center gap-3 text-[12px] font-semibold uppercase" style={{ color, letterSpacing: '0.28em' }}>
      <span className="h-px w-8" style={{ background: rule }} />
      {children}
    </span>
  );
}

// -----------------------------------------------------------------------------
// HERO (photo réelle + voile sombre → fort contraste)
// -----------------------------------------------------------------------------
function Hero() {
  return (
    <section className="relative overflow-hidden min-h-[620px] md:min-h-[86vh] flex items-center">
      {/* fond photo réel */}
      <div className="absolute inset-0 z-0">
        <ImageWithFallback
          src="/images/real/hero-logement-exception.jpg"
          alt="Intérieur d'un logement géré par LabelMaison Conciergerie"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(28,22,8,0.62) 0%, rgba(43,34,12,0.55) 45%, rgba(28,22,8,0.82) 100%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-[900px] mx-auto px-6 pt-[120px] pb-16 text-center flex flex-col items-center gap-6"
      >
        <span className="inline-flex items-center gap-3 text-[12px] font-semibold uppercase text-white/85" style={{ letterSpacing: '0.28em' }}>
          <span className="h-px w-8 bg-white/50" />
          Programme d'affiliation
          <span className="h-px w-8 bg-white/50" />
        </span>
        <h1 className="font-serif-title text-[44px] md:text-[76px] leading-[1.04] font-normal text-white">
          Le Cercle <span className="font-serif-italic" style={{ color: GOLD_LIGHT }}>LabelMaison</span>
        </h1>
        <p className="text-[17px] md:text-[22px] max-w-[620px] text-white/90">
          Recommandez un propriétaire. Gagnez 150&nbsp;€.{' '}
          <span className="font-serif-italic" style={{ color: GOLD_SOFT }}>Rejoignez le Cercle.</span>
        </p>
        <a
          href="#candidature"
          className="mt-2 inline-flex items-center gap-2 font-bold text-[15px] px-8 py-4 rounded-full transition-transform hover:-translate-y-0.5"
          style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C', boxShadow: '0 12px 34px rgba(0,0,0,0.34)' }}
        >
          Je rejoins le programme <ArrowDown size={16} />
        </a>
        <p className="text-[12px] tracking-wide text-white/60">
          by LabelMaison Conciergerie · Location courte durée
        </p>
      </motion.div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// LE PRINCIPE (ivoire — 150 € dominant)
// -----------------------------------------------------------------------------
function Principe() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY }}>
      <div className="max-w-[1000px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Le principe</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: INK }}>
            Un principe simple.{' '}
            <span className="font-serif-italic" style={{ color: GOLD }}>Une récompense concrète.</span>
          </h2>
        </motion.div>

        <motion.div {...fadeUp} className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          <span className="font-serif-title leading-none" style={{ fontSize: 'clamp(90px, 20vw, 172px)', color: GOLD }}>
            150&nbsp;€
          </span>
          <p className="max-w-[320px] text-[18px] md:text-[20px] text-center md:text-left" style={{ color: INK_2 }}>
            pour chaque propriétaire que vous nous présentez.
          </p>
        </motion.div>

        <motion.p {...fadeUp} className="mt-10 max-w-[680px] mx-auto text-center text-[16px] md:text-[18px] leading-relaxed" style={{ color: INK_2 }}>
          Vous connaissez un propriétaire qui loue — ou pourrait louer — son logement en courte durée&nbsp;?
          Présentez-le-nous. On s'occupe de tout. Vous êtes récompensé.
        </motion.p>

        <motion.div {...fadeUp} className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[760px] mx-auto">
          {['Aucune commission à payer', 'Aucune paperasse', 'Aucun engagement'].map((t) => (
            <div key={t} className="rounded-xl px-5 py-4 text-center bg-white" style={{ border: `1px solid rgba(169,124,48,0.35)` }}>
              <span className="text-[15px] font-semibold" style={{ color: INK }}>{t}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// COMMENT ÇA MARCHE (brun profond + bande photos)
// -----------------------------------------------------------------------------
const STEPS = [
  { n: '01', title: 'Vous recommandez', text: 'Vous nous présentez un propriétaire de votre entourage via un simple formulaire. Ça vous prend deux minutes.' },
  { n: '02', title: "On s'occupe de tout", text: "Le propriétaire signe avec LabelMaison, et nous mettons son logement en ligne (Airbnb, Booking…). Vous n'avez rien à gérer." },
  { n: '03', title: 'Vous touchez 150 €', text: 'Dès la première réservation du logement, votre prime de 150 € est déclenchée. Du concret, pas des promesses.' },
];

const STEP_PHOTOS = [
  '/images/real/logement-salon-poster.jpg',
  '/images/real/residence-penthouse.jpg',
  '/images/real/gestion-villa.jpg',
];

function CommentCaMarche() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: DARK_BG }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow tone="dark">Comment ça marche</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: TXT_DARK }}>
            Trois étapes, et vous êtes <span className="font-serif-italic" style={{ color: GOLD_LIGHT }}>payé</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-0">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.08 }}
              className="relative px-2 md:px-8 text-center md:text-left"
            >
              {i > 0 && (
                <span className="hidden md:block absolute left-0 top-2 bottom-2 w-px" style={{ background: 'rgba(236,216,160,0.35)' }} />
              )}
              <div className="mb-5 h-32 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(236,216,160,0.2)' }}>
                <ImageWithFallback src={STEP_PHOTOS[i]} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="font-serif-title text-[44px] md:text-[54px] leading-none" style={{ color: GOLD_LIGHT }}>{s.n}</span>
              <h3 className="mt-3 text-[20px] font-bold" style={{ color: TXT_DARK }}>{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: TXT_DARK_2 }}>{s.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.div {...fadeUp} className="mt-14 rounded-2xl px-7 py-8 md:px-12 md:py-10 text-center" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(236,216,160,0.28)' }}>
          <h3 className="font-serif-italic text-[24px] md:text-[30px]" style={{ color: GOLD_LIGHT }}>Payé quand c'est réel.</h3>
          <p className="mt-3 max-w-[640px] mx-auto text-[15px] md:text-[16px] leading-relaxed" style={{ color: TXT_DARK_2 }}>
            La prime tombe à la première réservation — la preuve que la mise en relation a créé de la valeur.
            Simple, transparent, sans mauvaise surprise.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// PREUVE DE REVENUS (ivoire) — crédibilité de conversion
// -----------------------------------------------------------------------------
function PreuveRevenus() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY_ALT }}>
      <div className="max-w-[1100px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 items-center">
        <motion.div {...fadeUp}>
          <Eyebrow>Pourquoi ça se déclenche vraiment</Eyebrow>
          <h2 className="mt-4 font-serif-title text-[30px] md:text-[44px] font-normal leading-[1.1]" style={{ color: INK }}>
            Nos logements <span className="font-serif-italic" style={{ color: GOLD }}>se réservent</span>
          </h2>
          <p className="mt-4 text-[16px] md:text-[17px] leading-relaxed" style={{ color: INK_2 }}>
            Votre prime dépend d'une vraie réservation — et c'est justement là que nous sommes bons.
            Un seul bien géré en courte durée a généré{' '}
            <span className="font-semibold" style={{ color: GOLD_DARK }}>plus de 6 000 € en un mois</span>.
            Quand vous recommandez, la première réservation arrive vite. Votre 150 € aussi.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              'Mise en ligne pro sur Airbnb, Booking et plus',
              'Tarification dynamique et taux d\'occupation optimisé',
              'La première réservation déclenche votre prime',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="w-2 h-2 mt-2 rounded-full shrink-0" style={{ background: GOLD }} />
                <span className="text-[15px]" style={{ color: INK }}>{t}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div {...fadeUp} className="relative">
          <div className="absolute -inset-4 blur-2xl" style={{ background: 'linear-gradient(135deg, rgba(169,124,48,0.16), transparent)' }} />
          <div className="relative bg-white rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(64,49,24,0.12)]" style={{ border: '1px solid #ECE3D0' }}>
            <ImageWithFallback
              src="/images/img-proprietaire-decembre.png"
              alt="Revenus réels d'un logement géré en location courte durée"
              className="w-full h-auto"
            />
          </div>
          <div className="absolute -bottom-3 -right-3 px-5 py-3 rounded-xl shadow-xl" style={{ background: GOLD, color: '#fff' }}>
            <p className="text-[10px] tracking-widest uppercase opacity-90">Un seul bien</p>
            <p className="text-[18px] font-bold">6 359,32 €</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// POURQUOI REJOINDRE (ivoire)
// -----------------------------------------------------------------------------
const REASONS = [
  { icon: Wallet, title: 'Un revenu simple', text: "Vous gagnez de l'argent pour une recommandation — quelque chose que vous faites déjà naturellement, sans rien avoir à gérer." },
  { icon: HeartHandshake, title: 'Vous rendez service', text: 'Vous offrez à vos contacts propriétaires une gestion sérieuse qui fait performer leur bien. Tout le monde y gagne.' },
  { icon: TrendingUp, title: 'Vous montez en statut', text: 'Plus vous recommandez, plus vous grimpez — avec des avantages croissants à chaque palier.' },
  { icon: Users, title: 'Vous entrez dans un cercle', text: "Un réseau privé de propriétaires, d'investisseurs et de pros de l'immobilier. On y est mieux entouré, mieux connecté." },
];

const TIERS = [
  { name: 'Membre', sub: "À l'entrée", highlight: false },
  { name: 'Ambassadeur', sub: '1ᵉʳ apport', highlight: false },
  { name: 'Élite', sub: 'Volume régulier', highlight: false },
  { name: 'Cercle Restreint', sub: 'Sur cooptation', highlight: true },
];

function PourquoiRejoindre() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Pourquoi rejoindre</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: INK }}>
            Bien plus qu'une <span className="font-serif-italic" style={{ color: GOLD }}>prime</span>
          </h2>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[880px] mx-auto">
          {REASONS.map((r, i) => (
            <motion.div
              key={r.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.06 }}
              className="rounded-2xl p-6 md:p-7 flex gap-4 bg-white"
              style={{ border: '1px solid rgba(64,49,24,0.1)', boxShadow: '0 12px 34px rgba(64,49,24,0.05)' }}
            >
              <span className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full" style={{ background: 'rgba(169,124,48,0.12)', color: GOLD }}>
                <r.icon size={20} />
              </span>
              <div>
                <h3 className="text-[18px] font-bold" style={{ color: INK }}>{r.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: INK_2 }}>{r.text}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* frise des paliers */}
        <motion.div {...fadeUp} className="mt-14 flex flex-col md:flex-row items-stretch md:items-center justify-center gap-3 md:gap-0">
          {TIERS.map((t, i) => (
            <div key={t.name} className="flex flex-col md:flex-row items-center md:items-stretch">
              <div className="flex flex-col items-center text-center px-4 py-2">
                <span className="font-serif-title text-[19px] md:text-[21px]" style={{ color: t.highlight ? GOLD_DARK : INK }}>
                  {t.name}
                </span>
                <span className="mt-1 text-[12px] uppercase tracking-[0.14em]" style={{ color: t.highlight ? GOLD : INK_2 }}>
                  {t.sub}
                </span>
              </div>
              {i < TIERS.length - 1 && (
                <span aria-hidden className="self-center mx-1 my-1 md:my-0 w-8 h-px md:w-10" style={{ background: 'rgba(169,124,48,0.45)' }} />
              )}
            </div>
          ))}
        </motion.div>

        <motion.p {...fadeUp} className="mt-8 max-w-[720px] mx-auto text-center text-[14px] leading-relaxed" style={{ color: INK_2 }}>
          Au-delà des 150&nbsp;€ : bonus au volume, cadeaux, formations, invitations aux événements,
          classements et trophées — jusqu'au Cercle Restreint, sur cooptation.
        </motion.p>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// FAQ (ivoire alt, accordéon)
// -----------------------------------------------------------------------------
const FAQS: { q: string; a: string }[] = [
  { q: 'Qui peut rejoindre le Cercle ?', a: "Tout le monde. Aucun statut professionnel n'est requis : propriétaires, investisseurs, agents immobiliers, artisans, photographes, créateurs de contenu, conciergeries, agents d'entretien… Si vous connaissez des propriétaires, votre place est ici." },
  { q: 'Quand exactement suis-je payé ?', a: 'À la première réservation du logement recommandé — pas à la signature. La prime récompense une mise en relation qui a réellement créé de la valeur.' },
  { q: 'Combien de propriétaires puis-je recommander ?', a: "Autant que vous voulez, c'est illimité. Chaque propriétaire signé qui décroche sa première réservation vous rapporte 150 €." },
  { q: 'Est-ce que ça me coûte quelque chose ?', a: 'Non. Aucune commission, aucun frais, aucun engagement. Rejoindre le Cercle et recommander est entièrement gratuit.' },
  { q: 'Comment je suis payé ?', a: 'Par virement, après validation de la première réservation du logement recommandé.' },
  { q: 'Que se passe-t-il si le propriétaire ne signe pas ?', a: 'Aucune prime, mais aucune conséquence non plus. Et votre recommandation reste valable : si ce propriétaire revient plus tard et signe, la prime vous est due.' },
  { q: 'Dois-je déclarer cette prime ?', a: 'Oui, la prime constitue un revenu. Selon votre situation, les modalités diffèrent — nous vous orientons vers un conseil personnalisé plutôt que de donner un avis fiscal général.' },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY_ALT }}>
      <div className="max-w-[820px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: INK }}>
            Tout ce qu'il faut <span className="font-serif-italic" style={{ color: GOLD }}>savoir</span>
          </h2>
        </motion.div>

        <ul className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            const panelId = `cercle-faq-panel-${i}`;
            const btnId = `cercle-faq-btn-${i}`;
            return (
              <li key={f.q} className="rounded-xl overflow-hidden bg-white" style={{ border: `1px solid ${isOpen ? 'rgba(169,124,48,0.4)' : 'rgba(64,49,24,0.1)'}` }}>
                <button
                  type="button"
                  id={btnId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 md:p-6 text-left"
                >
                  <span className="text-[16px] md:text-[17px] font-semibold" style={{ color: INK }}>{f.q}</span>
                  <ChevronDown size={20} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: GOLD }} />
                </button>
                {isOpen && (
                  <div id={panelId} role="region" aria-labelledby={btnId} className="px-5 md:px-6 pb-5 md:pb-6 text-[15px] leading-relaxed" style={{ color: INK_2 }}>
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

// -----------------------------------------------------------------------------
// FORMULAIRE DE CANDIDATURE (brun profond + photo latérale)
// -----------------------------------------------------------------------------
const PROFILS = ['Propriétaire', 'Investisseur', 'Agent immobilier', 'Artisan', 'Photographe', 'Créateur de contenu', 'Conciergerie', "Agent d'entretien", 'Autre'];

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(236,216,160,0.35)',
  color: TXT_DARK,
};

function DarkField({ label, htmlFor, required, children }: { label: string; htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: TXT_DARK_2 }}>
        {label}
        {required && <span style={{ color: GOLD_LIGHT }} className="ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

function CandidatureForm() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    if (!data.nom?.trim()) return setError("Merci d'indiquer votre nom et prénom.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) return setError('Adresse e-mail invalide.');
    if (!data.tel?.trim()) return setError("Merci d'indiquer un téléphone.");
    if (!data.rgpd) return setError("Merci d'accepter la politique de confidentialité.");

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cercle', page: '/cerclelabelmaison', ...data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) setError(json.error || `Erreur ${res.status}`);
      else setSubmitted(true);
    } catch {
      setError('Connexion impossible. Réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="candidature" className="py-[70px] md:py-[110px] relative overflow-hidden" style={{ background: DARK_BG }}>
      <img src="/images/key-gold-deep.png" alt="" aria-hidden className="pointer-events-none absolute left-[-70px] bottom-[-40px] w-[360px] max-w-[45%] h-auto opacity-[0.06]" />
      <div className="max-w-[720px] mx-auto px-6 relative z-10">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow tone="dark">Ouvert à tous ceux qui croisent des propriétaires</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: TXT_DARK }}>
            Rejoignez le <span className="font-serif-italic" style={{ color: GOLD_LIGHT }}>Cercle</span>
          </h2>
          <p className="max-w-[560px] text-[15px] md:text-[16px]" style={{ color: TXT_DARK_2 }}>
            Propriétaires, investisseurs, agents, artisans, photographes, créateurs de contenu,
            conciergeries, cleaners… si vous connaissez des propriétaires, votre place est ici.
          </p>
          <p className="font-serif-italic text-[16px] md:text-[18px]" style={{ color: GOLD_SOFT }}>
            Les 100 premiers deviennent Membres Fondateurs — à vie.
          </p>
        </motion.div>

        {submitted ? (
          <motion.div {...fadeUp} className="mt-10 rounded-2xl p-8 text-center flex flex-col items-center gap-3" style={{ border: '1px solid rgba(236,216,160,0.4)', background: 'rgba(0,0,0,0.22)' }}>
            <CheckCircle2 size={40} style={{ color: GOLD_LIGHT }} />
            <h3 className="font-serif-title text-[24px]" style={{ color: TXT_DARK }}>Bienvenue dans le Cercle</h3>
            <p className="text-[15px]" style={{ color: TXT_DARK_2 }}>On vous recontacte sous 48&nbsp;h.</p>
          </motion.div>
        ) : (
          <motion.form {...fadeUp} onSubmit={onSubmit} noValidate className="mt-10 space-y-5">
            {/* honeypot anti-spam */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute w-px h-px opacity-0 -z-10 pointer-events-none" style={{ left: '-9999px' }} />

            <DarkField label="Nom et prénom" htmlFor="c-nom" required>
              <input id="c-nom" name="nom" type="text" required autoComplete="name" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle} />
            </DarkField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DarkField label="E-mail" htmlFor="c-email" required>
                <input id="c-email" name="email" type="email" required autoComplete="email" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle} />
              </DarkField>
              <DarkField label="Téléphone" htmlFor="c-tel" required>
                <input id="c-tel" name="tel" type="tel" required autoComplete="tel" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle} />
              </DarkField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DarkField label="Ville / zone" htmlFor="c-ville">
                <input id="c-ville" name="ville" type="text" autoComplete="address-level2" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle} />
              </DarkField>
              <DarkField label="Vous êtes ?" htmlFor="c-profil">
                <select id="c-profil" name="profil" defaultValue="" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle}>
                  <option value="" disabled>Choisissez</option>
                  {PROFILS.map((p) => (<option key={p} value={p} style={{ color: '#2B220C' }}>{p}</option>))}
                </select>
              </DarkField>
            </div>

            <DarkField label="Avez-vous déjà un propriétaire en tête ?" htmlFor="c-deja">
              <select id="c-deja" name="dejaProprio" defaultValue="" className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93]" style={inputStyle}>
                <option value="" disabled>Choisissez</option>
                <option value="Oui" style={{ color: '#2B220C' }}>Oui</option>
                <option value="Pas encore" style={{ color: '#2B220C' }}>Pas encore</option>
              </select>
            </DarkField>

            <DarkField label="Message (facultatif)" htmlFor="c-message">
              <textarea id="c-message" name="message" rows={3} className="w-full px-3.5 py-3 rounded-md focus:outline-none focus:border-[#E6CD93] resize-y" style={inputStyle} />
            </DarkField>

            <label htmlFor="c-rgpd" className="flex items-start gap-3 cursor-pointer">
              <input id="c-rgpd" name="rgpd" type="checkbox" required value="oui" className="mt-1 w-4 h-4 shrink-0 accent-[#C9A961]" />
              <span className="text-[13px] leading-relaxed" style={{ color: TXT_DARK_2 }}>
                J'accepte que mes informations soient utilisées pour être recontacté au sujet du Cercle LabelMaison. *
              </span>
            </label>

            {error && (<p role="alert" className="text-[14px] font-semibold" style={{ color: '#F0A6A6' }}>{error}</p>)}

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 font-bold text-[15px] px-8 py-4 rounded-full transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C', boxShadow: '0 12px 34px rgba(0,0,0,0.34)' }}
            >
              {sending ? 'Envoi…' : 'Je rejoins le programme'} {!sending && <ArrowRight size={16} />}
            </button>
          </motion.form>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5 text-[14px]">
          <a href={`mailto:${EMAIL}`} className="inline-flex items-center gap-2 hover:underline" style={{ color: TXT_DARK_2 }}>
            <Mail size={16} style={{ color: GOLD_LIGHT }} /> {EMAIL}
          </a>
          <a href={INSTA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:underline" style={{ color: TXT_DARK_2 }}>
            <Instagram size={16} style={{ color: GOLD_LIGHT }} /> {INSTA_HANDLE}
          </a>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// PAGE
// -----------------------------------------------------------------------------
export function CercleLabelMaison() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div style={{ background: IVORY }}>
      <Helmet>
        <title>Le Cercle LabelMaison — Recommandez un propriétaire, gagnez 150 €</title>
        <meta
          name="description"
          content="Recommandez un propriétaire. Gagnez 150 €. Rejoignez le Cercle LabelMaison, le programme d'affiliation de LabelMaison Conciergerie. Aucune commission, aucun engagement — prime à la première réservation."
        />
        <link rel="canonical" href="https://labelmaisoncg.fr/cerclelabelmaison" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Le Cercle LabelMaison — Recommandez un propriétaire, gagnez 150 €" />
        <meta property="og:description" content="Recommandez un propriétaire. Gagnez 150 €. Rejoignez le Cercle." />
        <meta property="og:url" content="https://labelmaisoncg.fr/cerclelabelmaison" />
        <meta property="og:image" content="https://labelmaisoncg.fr/images/real/hero-logement-exception.jpg" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <Hero />
      <Principe />
      <CommentCaMarche />
      <PreuveRevenus />
      <PourquoiRejoindre />
      <FaqSection />
      <CandidatureForm />
    </div>
  );
}
