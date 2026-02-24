import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Plane, Shield, Star, Clock, Quote } from 'lucide-react';

export function Billetterie() {
  return (
    <div className="min-h-screen pt-20">
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1545610095-4d00a3f4f547?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920"
            alt="Business class cabin"
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
            Voyager n'est plus<br />une contrainte
          </h1>
          <p className="text-lg md:text-xl text-white/80 tracking-wide">
            Du sol au ciel, tout est orchestré.
          </p>
        </motion.div>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              L'excellence du voyage
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto">
              Des solutions sur-mesure pour tous vos déplacements professionnels et privés
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Plane, title: 'Vols privés', desc: 'Jets privés et hélicoptères' },
              { icon: Star, title: 'Première classe', desc: 'Meilleures cabines mondiales' },
              { icon: Shield, title: 'Priorité totale', desc: 'Fast track et salons VIP' },
              { icon: Clock, title: 'Disponibilité 24/7', desc: 'Réservation instantanée' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
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
                    {item.title}
                  </h3>
                  <p className="text-sm text-black/60">{item.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Témoignages</p>
            <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Voyagez comme nos clients
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Karim A.',
                destination: 'Paris → Dubaï',
                text: 'Vol business avec Emirates réservé en 2h. Siège lie-flat, lounge privé, et transfert hôtel inclus. LabelMaison a tout géré, je n\'ai eu qu\'à embarquer.',
                class: 'Business Class'
              },
              {
                name: 'Nadia R.',
                destination: 'Paris → Doha',
                text: 'Qatar Airways First Class. Un rêve. Suite privée, service aux petits soins, et champagne Krug à volonté. Merci pour cette expérience inoubliable.',
                class: 'First Class'
              },
              {
                name: 'Thomas V.',
                destination: 'Genève → Marrakech',
                text: 'Jet privé pour un weekend entre amis. Organisation parfaite, discrétion totale, prix négocié. On ne voyage plus autrement maintenant.',
                class: 'Jet Privé'
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
                <div className="bg-[#f5f5f0] border border-black/5 p-8 h-full hover:shadow-xl transition-all">
                  <Quote className="w-8 h-8 text-[#556B2F] mb-4" />
                  
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]" />
                    ))}
                  </div>

                  <p className="text-black/80 mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-black/10">
                    <div>
                      <p className="text-black">{testimonial.name}</p>
                      <p className="text-sm text-black/50">{testimonial.destination}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#556B2F] text-sm tracking-wider">{testimonial.class}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black text-white py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Réservez votre prochain voyage
            </h2>
            <p className="text-white/70 mb-8 max-w-2xl mx-auto">
              Laissez-nous organiser votre prochain déplacement avec le niveau de service que vous méritez
            </p>
            <a 
              href="https://www.instagram.com/labelmaisoncg/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
            >
              👉 Nous contacter
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}