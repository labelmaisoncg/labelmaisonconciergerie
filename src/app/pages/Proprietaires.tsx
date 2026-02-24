import { motion } from 'motion/react';
import { Helmet } from 'react-helmet-async';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Home, TrendingUp, Shield, Clock, ArrowRight, Star, Quote } from 'lucide-react';

// Images des performances (Décembre 2025 et Janvier 2026)
const airbnbRevenue = '/images/img-proprietaire-decembre.png';
const airbnbRevenueJanvier = '/images/img-proprietaire-janvier.png';

export function Proprietaires() {
  const benefits = [
    {
      icon: Home,
      title: 'Gestion complète',
      description: 'De l\'entretien à la location, nous nous occupons de tout',
    },
    {
      icon: TrendingUp,
      title: 'Rentabilité optimale',
      description: 'Maximisez le rendement de votre patrimoine immobilier',
    },
    {
      icon: Shield,
      title: 'Sécurité garantie',
      description: 'Protection et surveillance de vos biens 24/7',
    },
    {
      icon: Clock,
      title: 'Sérénité totale',
      description: 'Profitez de votre bien sans contraintes de gestion',
    },
  ];

  return (
    <div className="min-h-screen pt-20">
      <Helmet>
        <title>Gestion de biens immobiliers clé en main | LabelMaison CG</title>
        <meta name="description" content="Confiez la gestion de votre patrimoine immobilier à une conciergerie privée haut de gamme. Revenus optimisés, sérénité totale." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1694967832949-09984640b143?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Luxury villa"
            className="w-full h-full object-cover opacity-50"
          />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center text-white px-6 max-w-4xl"
        >
          <h1 className="text-5xl md:text-7xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Gestion clé en main de biens immobiliers d'exception
          </h1>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-3xl mx-auto leading-relaxed">
            Confiez la gestion de votre patrimoine immobilier à une conciergerie privée haut de gamme et profitez d'un service sur mesure, discret et performant.
          </p>
          <a 
            href="https://audit.labelmaisoncg.fr/a5ea1983"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
          >
            Audit gratuit pour propriétaires
          </a>
        </motion.div>
      </section>

      {/* Section Service Clé en Main */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Un service de gestion immobilière clé en main
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg leading-relaxed">
              Notre <strong>gestion locative</strong> premium vous garantit une <strong>optimisation des revenus</strong> maximale tout en vous assurant une <strong>sérénité propriétaire</strong> totale. Bénéficiez d'un <strong>accompagnement personnalisé</strong> à chaque étape de la gestion de votre patrimoine immobilier.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center p-6"
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#f5f5f0] flex items-center justify-center">
                    <Icon className="w-8 h-8 text-[#556B2F]" />
                  </div>
                  <h3 className="text-xl mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-black/60">
                    {benefit.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section Résultats - Décembre */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Performance mesurée</p>
            <h2 className="text-4xl md:text-6xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Des résultats concrets en gestion immobilière
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Nos chiffres ne sont pas des promesses, ce sont des faits vérifiables
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Décembre 2025</p>
              <h3 className="text-4xl md:text-6xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                6 359,32 € en<br />un seul mois
              </h3>
              <p className="text-xl text-black/70 mb-6 leading-relaxed">
                Un seul bien géré en location courte durée, <span className="text-[#556B2F]">plus de 6 000 € de revenus nets</span> générés en décembre 2025. Une performance mesurée et reproductible.
              </p>
              <p className="text-black/60 mb-8 leading-relaxed">
                Notre approche combine expertise en <strong>gestion locative</strong>, <strong>optimisation des revenus</strong> par tarification dynamique, et gestion complète pour vous garantir tranquillité et rentabilité maximale.
              </p>
              <div className="space-y-4 mb-10">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#D4AF37] mt-2 flex-shrink-0" />
                  <p className="text-black/80">
                    <span className="font-semibold">Taux d'occupation optimisé</span> — Nos biens sont réservés 90% du temps
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#D4AF37] mt-2 flex-shrink-0" />
                  <p className="text-black/80">
                    <span className="font-semibold">Tarification dynamique</span> — Prix ajustés en temps réel selon la demande
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#D4AF37] mt-2 flex-shrink-0" />
                  <p className="text-black/80">
                    <span className="font-semibold">Gestion complète incluse</span> — Vous ne touchez à rien, nous gérons tout
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative">
                {/* Decorative background */}
                <div className="absolute -inset-4 bg-gradient-to-br from-[#556B2F]/10 to-[#D4AF37]/10 blur-2xl" />
                
                {/* Screenshot */}
                <div className="relative bg-white rounded-sm shadow-2xl overflow-hidden border border-black/5">
                  <img 
                    src={airbnbRevenue} 
                    alt="Revenus Airbnb décembre 2025 - 6359,32 €" 
                    className="w-full h-auto"
                  />
                </div>

                {/* Badge overlay */}
                <div className="absolute -bottom-3 -right-3 bg-[#556B2F] text-white px-5 py-3 shadow-xl">
                  <p className="text-xs tracking-widest uppercase mb-0.5">Décembre 2025</p>
                  <p className="text-xl" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    Un seul bien
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-[#f5f5f0] to-transparent opacity-50 pointer-events-none" />
      </section>

      {/* Section Résultats - Janvier */}
      <section className="py-20 bg-[#f5f5f0] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative order-2 lg:order-1"
            >
              <div className="relative space-y-6">
                {/* Dashboard Section */}
                <div className="relative">
                  {/* Decorative background */}
                  <div className="absolute -inset-4 bg-gradient-to-br from-[#556B2F]/10 to-[#D4AF37]/10 blur-2xl" />
                  
                  <div className="relative bg-white rounded-sm shadow-2xl overflow-hidden border border-black/5 p-8">
                    <div className="space-y-6">
                      <div className="border-b border-black/10 pb-4">
                        <p className="text-sm text-black/50 mb-1">JANVIER 2026 — EN COURS</p>
                        <p className="text-3xl" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                          Suivi en temps réel
                        </p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-green-50 border-l-4 border-green-500">
                          <span className="text-black/70">Déjà encaissé</span>
                          <span className="text-2xl text-green-600" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                            1 456 €
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-[#556B2F]/5 border-l-4 border-[#556B2F]">
                          <span className="text-black/70">Réservations confirmées</span>
                          <span className="text-2xl text-[#556B2F]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                            7 326 €
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-[#D4AF37]/10 border-l-4 border-[#D4AF37] mt-4 pt-6 border-t border-black/10">
                          <span className="text-black/90">Total prévu janvier</span>
                          <span className="text-3xl text-[#D4AF37]" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                            8 782 €
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Screenshot Airbnb */}
                <div className="relative">
                  {/* Decorative background */}
                  <div className="absolute -inset-4 bg-gradient-to-br from-[#556B2F]/10 to-[#D4AF37]/10 blur-2xl" />
                  
                  {/* Screenshot */}
                  <div className="relative bg-white rounded-sm shadow-2xl overflow-hidden border border-black/5">
                    <img 
                      src={airbnbRevenueJanvier} 
                      alt="Revenus Airbnb janvier 2026 - 1456,48 € encaissés + 7325,74 € à venir" 
                      className="w-full h-auto"
                    />
                  </div>

                  {/* Badge overlay */}
                  <div className="absolute -bottom-3 -right-3 bg-[#D4AF37] text-black px-5 py-3 shadow-xl">
                    <p className="text-xs tracking-widest uppercase mb-0.5">Janvier 2026</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <p className="text-sm tracking-widest text-[#D4AF37] mb-4 uppercase">Janvier 2026</p>
              <h3 className="text-4xl md:text-6xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                8 782 € prévus<br />ce mois-ci
              </h3>
              <p className="text-xl text-black/70 mb-6 leading-relaxed">
                La performance se mesure dans la durée. Janvier 2026 confirme notre approche : <span className="text-[#556B2F]">1 456 € déjà encaissés, 7 326 € en réservations confirmées</span>.
              </p>
              <p className="text-black/60 mb-8 leading-relaxed">
                Une <strong>gestion immobilière</strong> performante ne repose pas sur la chance, mais sur une méthode éprouvée : tarification intelligente, taux d'occupation optimal, et gestion opérationnelle irréprochable. Vous profitez, nous gérons.
              </p>
              <div className="bg-white p-6 border-l-4 border-[#556B2F] shadow-lg">
                <p className="text-black/80 italic">
                  "La constance des performances, mois après mois, différencie une gestion amateur d'un service professionnel."
                </p>
                <p className="text-sm text-black/50 mt-3">— LabelMaison CG</p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-white to-transparent opacity-50 pointer-events-none" />
      </section>

      {/* Section Preuve Sociale - Témoignages */}
      <section className="py-24 bg-black text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm tracking-widest text-[#D4AF37] mb-4 uppercase">Témoignages clients</p>
            <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Ils nous font confiance pour la gestion de leurs biens immobiliers
            </h2>
            <p className="text-white/60 max-w-2xl mx-auto text-lg">
              Propriétaires et investisseurs partagent leur expérience avec LabelMaison CG
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Alexandre D.',
                location: 'Paris 16ème',
                text: 'Mes revenus ont augmenté de 47% en 6 mois. LabelMaison a transformé mon studio en véritable machine à cash flow. Service impeccable, discrétion absolue.',
                increase: '+47% revenus'
              },
              {
                name: 'Sophie M.',
                location: 'Neuilly-sur-Seine',
                text: 'Je ne m\'occupe plus de rien et mes appartements sont réservés 95% du temps. Leur expertise en pricing dynamique fait toute la différence.',
                increase: '+8 200€/mois'
              },
              {
                name: 'Laurent B.',
                location: 'Cannes',
                text: 'Après des années à gérer seul, j\'ai confié mes 3 villas à LabelMaison. Résultat : zéro stress, revenus doublés, et un reporting mensuel au millimètre.',
                increase: 'Revenus x2'
              }
            ].map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative group"
              >
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-8 h-full hover:bg-white/10 transition-all">
                  <Quote className="w-8 h-8 text-[#D4AF37] mb-4" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
                    ))}
                  </div>

                  <p className="text-white/80 mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div>
                      <p className="text-white">{testimonial.name}</p>
                      <p className="text-sm text-white/50">{testimonial.location}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#D4AF37] text-sm tracking-wider">{testimonial.increase}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-[#f5f5f0] text-black py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Confiez-nous la gestion de votre patrimoine immobilier
            </h2>
            <p className="text-black/70 mb-8 max-w-2xl mx-auto text-lg leading-relaxed">
              Profitez d'une <strong>gestion immobilière</strong> premium qui allie tranquillité, performance et accompagnement sur le long terme. Nos propriétaires bénéficient d'une expertise reconnue et d'un service discret pensé pour maximiser la rentabilité de leur patrimoine.
            </p>
            <a 
              href="https://audit.labelmaisoncg.fr/a5ea1983"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
            >
              Audit gratuit pour propriétaires
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}