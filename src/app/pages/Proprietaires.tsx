import { motion } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import {
  Home as HomeIcon,
  TrendingUp,
  Shield,
  Clock,
} from 'lucide-react';
import {
  PageHero,
  SectionHeader,
  FeatureCard,
  FinalCta,
  Section,
} from '../components/sections/PageBlocks';

const benefits = [
  {
    icon: <HomeIcon size={22} />,
    title: 'Gestion complète',
    description: "De l'entretien à la location, nous nous occupons absolument de tout.",
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'Rentabilité optimale',
    description: 'Maximisez le rendement de votre patrimoine immobilier grâce à un pricing dynamique.',
  },
  {
    icon: <Shield size={22} />,
    title: 'Sécurité garantie',
    description: "Protection et surveillance de vos biens 24/7, contrôle d'identité voyageurs systématique.",
  },
  {
    icon: <Clock size={22} />,
    title: 'Sérénité totale',
    description: 'Profitez de votre bien sans aucune contrainte de gestion. Reporting mensuel inclus.',
  },
];

export function Proprietaires() {
  return (
    <div className="bg-white text-neutral-900">
      <Helmet>
        <title>Gestion de biens immobiliers clé en main · Label Maison Conciergerie</title>
        <meta
          name="description"
          content="Confiez la gestion de votre patrimoine immobilier à une conciergerie privée haut de gamme à Paris. Revenus optimisés, sérénité totale, performance prouvée."
        />
      </Helmet>

      <PageHero
        badge="Notre cœur de métier"
        titleStart="Gestion clé en main de biens immobiliers"
        titleAccent="d'exception"
        subtitle="Confiez la gestion de votre patrimoine immobilier à une conciergerie privée haut de gamme et profitez d'un service sur mesure, discret et performant."
        imageUrl="https://images.unsplash.com/photo-1694967832949-09984640b143?auto=format&fit=crop&w=1600&q=80"
        imageAlt="Villa de luxe gérée par Label Maison"
        ctas={[
          {
            label: 'Audit gratuit propriétaires',
            href: 'https://audit.labelmaisoncg.fr/a5ea1983',
            primary: true,
            external: true,
          },
          { label: 'Nous contacter', href: '/#contact' },
        ]}
      />

      {/* Benefits */}
      <Section bg="white">
        <SectionHeader
          eyebrow="Nos engagements"
          titleStart="Un service de gestion immobilière"
          titleAccent="clé en main"
          subtitle="Notre gestion locative premium vous garantit une optimisation des revenus maximale tout en vous assurant une sérénité totale, à chaque étape."
        />
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b) => (
            <FeatureCard key={b.title} {...b} />
          ))}
        </div>
      </Section>

      {/* Results — Décembre */}
      <Section bg="zinc">
        <SectionHeader
          eyebrow="Performance mesurée"
          titleStart="Des résultats"
          titleAccent="concrets"
          titleEnd="en gestion immobilière"
          subtitle="Nos chiffres ne sont pas des promesses, ce sont des faits vérifiables."
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
              Décembre 2025
            </p>
            <h3 className="mt-2 text-[36px] md:text-[52px] font-bold leading-[1.05]">
              <span className="font-serif-italic font-bold text-[#556B2F]">6 359,32 €</span>
              <br />en un seul mois
            </h3>
            <p className="mt-4 text-[16px] md:text-[18px] text-neutral-700 leading-relaxed">
              Un seul bien géré en location courte durée,{' '}
              <span className="text-[#556B2F] font-semibold">plus de 6 000 € de revenus nets</span>{' '}
              générés en décembre 2025. Une performance mesurée et reproductible.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                { strong: "Taux d'occupation optimisé", text: ' : Nos biens sont réservés 90 % du temps' },
                { strong: 'Tarification dynamique', text: ' : Prix ajustés en temps réel selon la demande' },
                { strong: 'Gestion complète incluse', text: ' : Vous ne touchez à rien, nous gérons tout' },
              ].map((item) => (
                <li key={item.strong} className="flex items-start gap-3">
                  <span className="w-2 h-2 mt-2.5 rounded-full bg-[#556B2F] shrink-0" />
                  <p className="text-[15px] text-neutral-800">
                    <span className="font-semibold">{item.strong}</span>
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-br from-[#556B2F]/15 to-transparent blur-2xl" />
            <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-black/5">
              <img
                src="/images/img-proprietaire-decembre.png"
                alt="Revenus Airbnb décembre 2025 : 6 359,32 €"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-3 -right-3 bg-[#556B2F] text-white px-5 py-3 rounded-xl shadow-xl">
              <p className="text-[10px] tracking-widest uppercase opacity-90">Décembre 2025</p>
              <p className="text-[18px] font-bold">Un seul bien</p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Results — Janvier */}
      <Section bg="white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative order-2 lg:order-1 space-y-6"
          >
            <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-black/5 p-6 md:p-8">
              <div className="border-b border-black/10 pb-4">
                <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
                  Janvier 2026 (en cours)
                </p>
                <p className="mt-1 text-2xl md:text-3xl font-bold">Suivi en temps réel</p>
              </div>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg">
                  <span className="text-neutral-700">Déjà encaissé</span>
                  <span className="text-2xl font-bold text-emerald-600">1 456 €</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#556B2F]/10 border-l-4 border-[#556B2F] rounded-r-lg">
                  <span className="text-neutral-700">Réservations confirmées</span>
                  <span className="text-2xl font-bold text-[#556B2F]">7 326 €</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg mt-4 pt-5 border-t border-black/10">
                  <span className="font-semibold text-neutral-900">Total prévu janvier</span>
                  <span className="text-3xl font-bold text-amber-600">8 782 €</span>
                </div>
              </div>
            </div>

            <div className="relative bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] overflow-hidden border border-black/5">
              <img
                src="/images/img-proprietaire-janvier.png"
                alt="Revenus Airbnb janvier 2026 : 8 782 € prévus"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <p className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#556B2F]">
              Janvier 2026
            </p>
            <h3 className="mt-2 text-[36px] md:text-[52px] font-bold leading-[1.05]">
              <span className="font-serif-italic font-bold text-[#556B2F]">8 782 €</span>
              <br />prévus ce mois-ci
            </h3>
            <p className="mt-4 text-[16px] md:text-[18px] text-neutral-700 leading-relaxed">
              La performance se mesure dans la durée. Janvier 2026 confirme notre approche :{' '}
              <span className="text-[#556B2F] font-semibold">
                1 456 € déjà encaissés, 7 326 € en réservations confirmées
              </span>
              .
            </p>
            <p className="mt-4 text-[15px] text-neutral-600 leading-relaxed">
              Une <strong className="font-bold">gestion immobilière</strong> performante ne repose pas sur la chance,
              mais sur une méthode éprouvée : tarification intelligente, taux d'occupation optimal,
              et gestion opérationnelle irréprochable. Vous profitez, nous gérons.
            </p>
            <div className="mt-6 bg-zinc-50 p-5 border-l-4 border-[#556B2F] rounded-r-xl">
              <p className="text-neutral-800 italic">
                « La constance des performances, mois après mois, différencie une gestion amateur d'un service professionnel. »
              </p>
              <p className="mt-2 text-[13px] text-neutral-500">Label Maison Conciergerie</p>
            </div>
          </motion.div>
        </div>
      </Section>

      <FinalCta
        titleStart="Confiez-nous la gestion de votre"
        titleAccent="patrimoine immobilier"
        subtitle="Profitez d'une gestion immobilière premium qui allie tranquillité, performance et accompagnement sur le long terme."
        ctaLabel="Audit gratuit propriétaires"
        ctaHref="https://audit.labelmaisoncg.fr/a5ea1983"
        external
      />
    </div>
  );
}
