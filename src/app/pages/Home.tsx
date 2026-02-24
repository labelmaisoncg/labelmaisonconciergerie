import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { ArrowRight, Shield, Clock, Award, Home as HomeIcon, Sparkles, Globe } from 'lucide-react';

export function Home() {
  const services = [
    {
      title: 'Gestion de biens immobiliers',
      href: '/proprietaires',
      description: 'Gestion d\'exception de vos biens immobiliers',
      image: 'https://images.unsplash.com/photo-1621693722835-44c9dcb724fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtYW5zaW9uJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzY3NDM0MDE0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Billetterie d\'avion',
      href: '/billetterie',
      description: 'Voyages en classe affaires et vols privés',
      image: 'https://images.unsplash.com/photo-1625513123245-fcb02d69ad12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcml2YXRlJTIwamV0JTIwaW50ZXJpb3J8ZW58MXx8fHwxNzY3Mzc5NjgxfDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Logement',
      href: '/logement',
      description: 'Résidences d\'exception à votre image',
      image: 'https://images.unsplash.com/photo-1759223198981-661cadbbff36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob3RlbCUyMHN1aXRlfGVufDF8fHx8MTc2NzQzMTcxN3ww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Transport privé',
      href: '/transport',
      description: 'Déplacements avec élégance et discrétion',
      image: 'https://images.unsplash.com/photo-1698840059740-ba83e510733b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBjYXIlMjBjaGF1ZmZldXJ8ZW58MXx8fHwxNzY3NDM0MDE2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Activités exclusives',
      href: '/activites',
      description: 'Expériences VIP inoubliables',
      image: 'https://images.unsplash.com/photo-1612095977457-0f2a6354574c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxQYXJpcyUyMGx1eHVyeSUyMGxpZmVzdHlsZXxlbnwxfHx8fDE3Njc0MzQwMTZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Personal Shopping',
      href: '/shopping',
      description: 'Accès à l\'exclusivité sur demande',
      image: 'https://images.unsplash.com/photo-1767009951357-9d9d455aa903?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3YXRjaCUyMG1hbiUyMHdyaXN0fGVufDF8fHx8MTc2NzQzMzkyOHww&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  const scrollToServices = () => {
    const servicesSection = document.getElementById('nos-services');
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>Conciergerie privée haut de gamme | LabelMaison CG</title>
        <meta name="description" content="Conciergerie privée haut de gamme proposant gestion de biens immobiliers, services premium et accompagnement sur mesure pour une clientèle d'exception." />
      </Helmet>

      {/* Hero Section avec H1 SEO */}
      <section className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1598635031829-4bfae29d33eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMGV4dGVyaW9yfGVufDF8fHx8MTc2NzM0MzI2MHww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Luxury villa exterior"
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative z-10 text-center text-white px-6 max-w-5xl"
        >
          <h1 className="text-4xl md:text-6xl mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Conciergerie privée haut de gamme : Services sur mesure pour une clientèle d'exception
          </h1>
          
          <p className="text-base md:text-lg text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            LabelMaison CG accompagne propriétaires, investisseurs et clients privés à travers une conciergerie premium alliant gestion de biens immobiliers, services de luxe et expériences exclusives.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={scrollToServices}
              className="px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
            >
              Découvrir nos services
            </button>
            <a
              href="https://www.instagram.com/labelmaisoncg/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 border-2 border-white/40 text-white hover:bg-white/10 transition-all tracking-wide text-lg"
            >
              Confier mon projet
            </a>
          </div>
        </motion.div>
      </section>

      {/* Section Positionnement */}
      <section className="py-28 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Une conciergerie privée multi-services, pensée pour l'excellence
            </h2>
            <p className="text-black/70 text-lg leading-relaxed mb-6">
              LabelMaison CG incarne l'excellence d'une <strong>conciergerie privée haut de gamme</strong>, dédiée à une clientèle exigeante en quête de services exceptionnels. Nous accompagnons propriétaires, investisseurs et clients privés dans la gestion de leur patrimoine immobilier et l'accès à des expériences exclusives.
            </p>
            <p className="text-black/70 text-lg leading-relaxed">
              Notre approche repose sur trois piliers : <strong>gestion de biens immobiliers</strong> clé en main, <strong>services personnalisés premium</strong>, et une discrétion absolue dans chaque intervention. Du suivi de résidences secondaires aux prestations lifestyle sur mesure, chaque détail est maîtrisé.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section Cœur d'Expertise - Pilier SEO Immobilier */}
      <section className="py-32 bg-[#f5f5f0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-2 lg:order-1"
            >
              <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Notre cœur d'expertise</p>
              <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Conciergerie immobilière & gestion de biens d'exception
              </h2>
              <p className="text-black/70 mb-6 text-lg leading-relaxed">
                La <strong>gestion de biens immobiliers</strong> est au cœur de notre activité. Nous prenons en charge l'intégralité de vos <strong>résidences secondaires et locations courte durée</strong> avec une exigence premium : optimisation des revenus, suivi opérationnel permanent, et expérience haut de gamme pour vos locataires.
              </p>
              <p className="text-black/70 mb-8 text-lg leading-relaxed">
                Nos propriétaires bénéficient d'un <strong>accompagnement clé en main</strong> : de la mise en location à la maintenance, en passant par l'accueil personnalisé et le service après-séjour. Transparence, rentabilité et tranquillité garanties.
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  'Gestion clé en main de biens immobiliers',
                  'Résidences secondaires & locations courte durée',
                  'Optimisation des revenus & suivi permanent',
                  'Accompagnement propriétaires & investisseurs',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 bg-[#556B2F] rounded-full mt-2.5 flex-shrink-0" />
                    <span className="text-black/80 text-lg">{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/proprietaires"
                className="inline-flex items-center gap-3 text-[#556B2F] hover:gap-5 transition-all text-lg font-medium"
              >
                Découvrir notre service propriétaires
                <ArrowRight size={20} />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2 aspect-[4/5] relative overflow-hidden"
            >
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1621693722835-44c9dcb724fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtYW5zaW9uJTIwaW50ZXJpb3J8ZW58MXx8fHwxNzY3NDM0MDE0fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Luxury property interior"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Engagements */}
      <section className="bg-white py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Nos engagements en conciergerie privée
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Les valeurs qui définissent notre approche du service
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-[#556B2F]/10 flex items-center justify-center">
                  <Shield className="w-10 h-10 text-[#556B2F]" />
                </div>
              </div>
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Confidentialité absolue dans la gestion de votre patrimoine
              </h3>
              <p className="text-black/60 leading-relaxed">
                Votre vie privée et la protection de vos actifs sont notre priorité. Chaque intervention est menée avec la plus grande discrétion.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-[#556B2F]/10 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-[#556B2F]" />
                </div>
              </div>
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Disponibilité 24/7 pour propriétaires et clients privés
              </h3>
              <p className="text-black/60 leading-relaxed">
                Où que vous soyez, à tout moment, notre équipe dédiée est à votre écoute pour répondre à vos besoins.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-[#556B2F]/10 flex items-center justify-center">
                  <Award className="w-10 h-10 text-[#556B2F]" />
                </div>
              </div>
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Excellence opérationnelle & standards premium
              </h3>
              <p className="text-black/60 leading-relaxed">
                Un savoir-faire reconnu, un réseau mondial, et une exigence sans faille pour chaque prestation de service.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Complémentaires */}
      <section className="py-32 bg-[#f5f5f0]" id="nos-services">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Au-delà de l'immobilier</p>
            <h2 className="text-4xl md:text-6xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Des services de conciergerie haut de gamme sur mesure
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Une gamme complète de prestations premium pour accompagner votre style de vie
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.href}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={service.href}
                  className="group block relative overflow-hidden aspect-[3/4] bg-black"
                >
                  <ImageWithFallback
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-70 transition-opacity duration-500" />
                  
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-white transform translate-y-0 group-hover:translate-y-[-8px] transition-transform duration-500">
                    <h3 className="text-3xl mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                      {service.title}
                    </h3>
                    <p className="text-sm text-white/90 mb-6 leading-relaxed">
                      {service.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-[#D4AF37] tracking-wide">
                      Découvrir
                      <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform duration-300" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section Philosophie */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Notre philosophie</p>
              <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                L'excellence d'une conciergerie pensée pour l'exception
              </h2>
              <p className="text-black/70 mb-6 text-lg leading-relaxed">
                Chez LabelMaison CG, nous concevons la <strong>conciergerie privée</strong> comme un art de la précision. Chaque projet est abordé avec une exigence absolue, qu'il s'agisse de la <strong>gestion immobilière</strong>, de l'organisation d'un séjour ou de la création d'expériences sur mesure.
              </p>
              <p className="text-black/70 mb-6 text-lg leading-relaxed">
                Nous accompagnons propriétaires, investisseurs et <strong>clients privés</strong> avec une approche globale : stratégie, exécution et suivi permanent. De la gestion locative clé en main aux <strong>services premium</strong> : transport privé, billetterie, activités exclusives, personal shopping. Chaque détail est maîtrisé, chaque attente anticipée.
              </p>
              <p className="text-black/70 mb-8 text-lg leading-relaxed">
                Notre engagement repose sur trois piliers : discrétion, performance et excellence du service. Vous confier à LabelMaison CG, c'est choisir la tranquillité, la rentabilité et un niveau de prestation sans compromis.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="aspect-[4/5] relative overflow-hidden"
            >
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1598635031829-4bfae29d33eb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMGV4dGVyaW9yfGVufDF8fHx8MTc2NzM0MzI2MHww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Luxury villa exterior"
                className="w-full h-full object-cover"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section Ancrage Géographique */}
      <section className="py-28 bg-[#f5f5f0]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-[#556B2F]/10 flex items-center justify-center">
                <Globe className="w-10 h-10 text-[#556B2F]" />
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Une conciergerie privée internationale
            </h2>
            <p className="text-black/70 text-lg leading-relaxed mb-6">
              LabelMaison CG accompagne une clientèle française et internationale à travers une <strong>conciergerie privée haut de gamme</strong>, avec une expertise particulière sur les destinations premium : Paris, Côte d'Azur, Dubaï, Marrakech, et bien d'autres.
            </p>
            <p className="text-black/70 text-lg leading-relaxed">
              Notre réseau mondial de partenaires sélectionnés nous permet d'intervenir partout où vous en avez besoin, avec les mêmes standards d'excellence et de discrétion.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-black text-white py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-sm tracking-widest text-[#D4AF37] mb-4 uppercase">Accès exclusif</p>
            <h2 className="text-4xl md:text-6xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Rejoignez une clientèle d'exception
            </h2>
            <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg leading-relaxed">
              Nos services sont réservés à une clientèle privée partageant nos valeurs d'excellence, de discrétion et de raffinement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://www.instagram.com/labelmaisoncg/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
              >
                Soumettre ma demande
              </a>
              <a
                href="https://audit.labelmaisoncg.fr/a5ea1983"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-10 py-5 border-2 border-white/40 text-white hover:bg-white/10 transition-all tracking-wide text-lg"
              >
                Demander une estimation
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}