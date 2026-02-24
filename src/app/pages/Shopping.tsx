import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { Watch, ShoppingBag, Gem, Sparkles, Quote, Star } from 'lucide-react';

export function Shopping() {
  const categories = [
    { 
      icon: Watch, 
      title: 'Haute horlogerie', 
      desc: 'Rolex, Patek Philippe, Audemars Piguet, pièces rares et éditions limitées',
      image: 'https://images.unsplash.com/photo-1623998021661-dc7555b2213d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3cmlzdHdhdGNoJTIwY2xvc2V1cHxlbnwxfHx8fDE3Njc0MzM2Nzd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    { 
      icon: ShoppingBag, 
      title: 'Mode & Maroquinerie', 
      desc: 'Hermès, Chanel, Louis Vuitton, créations exclusives sur-mesure',
      image: 'https://images.unsplash.com/photo-1722236525367-00a4ff86ec00?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxIZXJtZXMlMjBCaXJraW4lMjBiYWd8ZW58MXx8fHwxNzY3NDMzNjc2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    { 
      icon: Gem, 
      title: 'Joaillerie', 
      desc: 'Cartier, Van Cleef & Arpels, pièces d\'exception et diamants',
      image: 'https://images.unsplash.com/photo-1640724390912-4d92d9a985fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBqZXdlbHJ5JTIwd29tYW4lMjBoYW5kfGVufDF8fHx8MTc2NzQzMzc0Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    { 
      icon: Sparkles, 
      title: 'Sur-mesure', 
      desc: 'Tout ce qui fait l\'objet de votre désir, nous le trouvons',
      image: 'https://images.unsplash.com/flagged/photo-1553277004-39d655b57262?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXNoaW9uJTIwd2VlayUyMHJ1bndheXxlbnwxfHx8fDE3Njc0Mjg0MDl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1767009951357-9d9d455aa903?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3YXRjaCUyMG1hbiUyMHdyaXN0fGVufDF8fHx8MTc2NzQzMzkyOHww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Man wearing luxury watch"
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
            L'exclusivité<br />sur demande
          </h1>
          <p className="text-lg md:text-xl text-white/80 tracking-wide">
            Ce que vous désirez, nous le trouvons.
          </p>
        </motion.div>
      </section>

      {/* Categories Grid */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Nos spécialités
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Accédez aux pièces les plus rares, aux éditions limitées, aux créations sur-mesure
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {categories.map((category, index) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group"
                >
                  <div className="aspect-[4/3] relative overflow-hidden mb-6 bg-black">
                    <ImageWithFallback
                      src={category.image}
                      alt={category.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute top-8 left-8">
                      <Icon className="w-12 h-12 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {category.title}
                  </h3>
                  <p className="text-black/60 leading-relaxed">{category.desc}</p>
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
              L'art de trouver l'introuvable
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Rachid M.',
                item: 'Rolex Daytona',
                text: 'J\'attendais cette Daytona depuis 2 ans chez mon AD. LabelMaison me l\'a trouvée en 3 semaines. Prix juste, authentification complète, discrétion totale. Un service irréprochable.',
                category: 'Haute Horlogerie'
              },
              {
                name: 'Claire B.',
                item: 'Hermès Birkin 25',
                text: 'Mon Birkin 25 rouge Hermès, la pièce que je cherchais partout. Ils ont utilisé leur réseau pour me la sourcer. Authenticité garantie, état neuf. Je suis ravie.',
                category: 'Maroquinerie'
              },
              {
                name: 'David L.',
                item: 'Audemars Piguet',
                text: 'Royal Oak Offshore en platine, édition limitée. Une pièce quasi-impossible à trouver. LabelMaison l\'a dénichée et négociée pour moi. Expertise et professionnalisme au top.',
                category: 'Montres de luxe'
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
                      <p className="text-sm text-black/50">{testimonial.item}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#556B2F] text-sm tracking-wider">{testimonial.category}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Expertise Section */}
      <section className="py-32 bg-[#f5f5f0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="aspect-[4/3] relative overflow-hidden"
            >
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1649357585015-179ed98f513d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB3YXRjaCUyMFJvbGV4fGVufDF8fHx8MTc2NzQzMzY3NXww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Luxury timepiece close-up"
                className="w-full h-full object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Notre expertise à votre service
              </h2>
              <p className="text-black/70 mb-8 text-lg leading-relaxed">
                Grâce à notre réseau mondial et nos relations privilégiées avec les plus grandes maisons, nous vous donnons accès à l'inaccessible.
              </p>
              <ul className="space-y-5">
                {[
                  'Sourcing de pièces rares et éditions limitées',
                  'Négociation et acquisition discrète',
                  'Authentification et expertise',
                  'Livraison sécurisée mondiale',
                  'Service après-vente premium',
                  'Conseil en investissement',
                ].map((service) => (
                  <li key={service} className="flex items-center gap-4 text-lg">
                    <div className="w-1.5 h-1.5 bg-[#556B2F] rounded-full flex-shrink-0" />
                    <span className="text-black/80">{service}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
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
            <p className="text-sm tracking-widest text-[#D4AF37] mb-4 uppercase">Discrétion garantie</p>
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Confiez-nous vos recherches
            </h2>
            <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg">
              Quelle que soit la pièce que vous recherchez, nous mettons tout en œuvre pour l'acquérir
            </p>
            <a 
              href="https://www.instagram.com/labelmaisoncg/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide text-lg"
            >
              👉 Demande personnalisée
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}