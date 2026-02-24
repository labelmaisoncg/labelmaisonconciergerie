import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Bed, Shield, Sparkles, HeartHandshake, Clock, Users } from 'lucide-react';

export function Logement() {
  const benefits = [
    {
      icon: Bed,
      title: 'Confort garanti',
      items: ['Literie haut de gamme', 'Équipements modernes', 'Propreté irréprochable'],
    },
    {
      icon: HeartHandshake,
      title: 'Service premium',
      items: ['Accueil personnalisé ou autonome', 'Assistance 7j/7', 'Conciergerie sur place ou à distance'],
    },
    {
      icon: Sparkles,
      title: 'Expérience complète',
      items: ['Transfert privé', 'Activités', 'Billetterie d\'avion via notre équipe'],
    },
    {
      icon: Shield,
      title: 'Sécurité & tranquillité',
      items: ['Contrôle d\'identité', 'Assurance', 'Assistance pendant tout le séjour'],
    },
  ];

  const categories = [
    {
      title: 'Studios & Appartements élégants',
      description: 'Espaces raffinés pour séjours urbains',
      image: 'https://images.unsplash.com/photo-1762085407076-69a9594a2c94?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxQYXJpcyUyMGFwYXJ0bWVudCUyMEVpZmZlbCUyMFRvd2VyJTIwdmlld3xlbnwxfHx8fDE3Njc0MzY0Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Suites & Love Rooms',
      description: 'Jacuzzi, ambiance romantique, service discret',
      image: 'https://images.unsplash.com/photo-1588719850278-bbf84f1fc57f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb21hbnRpYyUyMGhvdGVsJTIwc3VpdGUlMjBqYWN1enppfGVufDF8fHx8MTc2NzQzNjQ3OHww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Villas & Penthouses',
      description: 'Piscine, terrasse, services personnalisés',
      image: 'https://images.unsplash.com/photo-1519380400109-9ef80d934359?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBwZW50aG91c2UlMjB0ZXJyYWNlJTIwdmlld3xlbnwxfHx8fDE3NjczNjEwOTF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1592229506151-845940174bb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxQYXJpcyUyMGx1eHVyeSUyMGxpdmluZyUyMHJvb218ZW58MXx8fHwxNzY3NDM2NDc4fDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Luxury Parisian apartment"
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
            Plus qu'un logement,<br />une signature
          </h1>
          <p className="text-lg md:text-xl text-white/80 tracking-wide">
            Des lieux à la hauteur de votre style de vie.
          </p>
        </motion.div>
      </section>

      {/* Benefits Section - Reorganized */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Une expérience d'exception
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Chaque détail pensé pour votre confort et votre sérénité
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="border-l-2 border-[#556B2F] pl-8 py-4"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-[#f5f5f0] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-[#556B2F]" />
                    </div>
                    <h3 className="text-2xl pt-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                      {benefit.title}
                    </h3>
                  </div>
                  <ul className="space-y-3 ml-16">
                    {benefit.items.map((item) => (
                      <li key={item} className="flex items-center gap-3 text-black/70">
                        <div className="w-1.5 h-1.5 bg-[#556B2F] rounded-full" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-32 bg-[#f5f5f0]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Nos résidences
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Du studio élégant à la villa de prestige
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {categories.map((category, index) => (
              <motion.div
                key={category.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="aspect-[3/4] relative overflow-hidden mb-6 bg-black">
                  <ImageWithFallback
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <h3 className="text-2xl mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {category.title}
                </h3>
                <p className="text-black/60 leading-relaxed">{category.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Large Visual Section */}
      <section className="relative h-[60vh]">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1729615385098-738628b57f16?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB2aWxsYSUyMGluZmluaXR5JTIwcG9vbHxlbnwxfHx8fDE3Njc0MzY0Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Luxury villa infinity pool"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="text-center text-white px-6"
          >
            <p className="text-2xl md:text-3xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Chaque séjour est une expérience unique
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-black text-white py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Réservez votre séjour
            </h2>
            <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg">
              Nos experts vous accompagnent dans le choix de votre résidence idéale
            </p>
            <a 
              href="https://www.instagram.com/labelmaisoncg/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
            >
              👉 Réserver
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}