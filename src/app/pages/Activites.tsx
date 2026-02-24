import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { MapPin, Zap, Sparkles, Compass, Quote, Star } from 'lucide-react';

export function Activites() {
  const destinations = [
    {
      name: 'Paris',
      activities: [
        'Croisière privée sur la Seine',
        'Rooftops avec vue Tour Eiffel',
        'Musées privés',
        'Shooting photo lifestyle',
        'Accès à restaurants emblématiques',
      ],
      image: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxQYXJpcyUyMEVpZmZlbCUyMFRvd2VyfGVufDF8fHx8MTc2NzQzMjQwNHww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      name: 'Dubaï',
      activities: [
        'Yacht privé au coucher du soleil',
        'Safari désert + dîner BBQ + spectacle',
        'Vol en hélicoptère (Palm Jumeirah)',
        'Jet ski, restaurants iconiques',
      ],
      image: 'https://images.unsplash.com/photo-1677151420167-b2de389d02db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxEdWJhaSUyMGx1eHVyeSUyMHlhY2h0fGVufDF8fHx8MTc2NzQzMjQwNXww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      name: 'Marrakech',
      activities: [
        'Hammam royal & spa traditionnel',
        'Quad & désert d\'Agafay',
        'Dîner romantique en riad privatisé',
      ],
      image: 'https://images.unsplash.com/photo-1653323792487-6ecc6217040b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxNYXJyYWtlY2glMjBNb3JvY2NvfGVufDF8fHx8MTc2NzM4MjUyMnww&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  const experienceTypes = [
    { icon: Zap, label: 'Aventure & adrénaline' },
    { icon: Sparkles, label: 'Luxe & détente' },
    { icon: Compass, label: 'Culture & découverte' },
    { icon: MapPin, label: 'Expériences sur mesure' },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1743819458014-f5cf74f175e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxEdWJhaSUyMGx1eHVyeSUyMHZpbGxhfGVufDF8fHx8MTc2NzQzMjQwNXww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Villa Dubai"
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
            Vivre ce que peu<br />peuvent s'offrir
          </h1>
          <p className="text-lg md:text-xl text-white/80 tracking-wide">
            L'exception n'attend pas.
          </p>
        </motion.div>
      </section>

      {/* Destinations par ville */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Nos destinations
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg">
              Des expériences uniques dans les plus belles villes du monde
            </p>
          </motion.div>

          <div className="space-y-24">
            {destinations.map((destination, index) => (
              <motion.div
                key={destination.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                  <div className={index % 2 === 1 ? 'lg:col-start-2' : ''}>
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <ImageWithFallback
                        src={destination.image}
                        alt={destination.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-6 left-6">
                        <div className="bg-[#556B2F] text-white px-6 py-3">
                          <MapPin className="inline-block w-4 h-4 mr-2" />
                          <span className="text-lg" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                            {destination.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className={index % 2 === 1 ? 'lg:col-start-1 lg:row-start-1' : ''}>
                    <h3 className="text-3xl md:text-4xl mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                      {destination.name}
                    </h3>
                    <ul className="space-y-4">
                      {destination.activities.map((activity) => (
                        <li key={activity} className="flex items-start gap-4 text-lg">
                          <div className="w-1.5 h-1.5 bg-[#556B2F] rounded-full mt-3 flex-shrink-0" />
                          <span className="text-black/80">{activity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-[#f5f5f0]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-sm tracking-widest text-[#556B2F] mb-4 uppercase">Témoignages</p>
            <h2 className="text-4xl md:text-5xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Des moments inoubliables
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Yasmine K.',
                destination: 'Dubaï',
                text: 'Safari dans le désert suivi d\'un dîner BBQ sous les étoiles. LabelMaison a pensé à chaque détail : champagne au coucher du soleil, spectacle privé, transfert en Range Rover. Magique.',
                experience: 'Safari VIP'
              },
              {
                name: 'Maxime D.',
                destination: 'Paris',
                text: 'Shooting photo lifestyle sur les toits de Paris avec vue sur la Tour Eiffel. Organisation parfaite, photographe pro, et accès privatisé. Des souvenirs inestimables.',
                experience: 'Photo Luxury'
              },
              {
                name: 'Fatima H.',
                destination: 'Marrakech',
                text: 'Hammam royal et spa traditionnel dans un riad exclusif. Une expérience sensorielle unique, loin du tourisme de masse. Le luxe à la marocaine.',
                experience: 'Spa Royal'
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
                <div className="bg-white border border-black/5 p-8 h-full hover:shadow-xl transition-all">
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
                      <p className="text-[#556B2F] text-sm tracking-wider">{testimonial.experience}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Types d'expériences */}
      <section className="py-32 bg-[#f5f5f0]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Types d'expériences
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {experienceTypes.map((type, index) => {
              const Icon = type.icon;
              return (
                <motion.div
                  key={type.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center p-8 bg-white"
                >
                  <Icon className="w-10 h-10 mx-auto mb-4 text-[#556B2F]" />
                  <p className="text-lg" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    {type.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comment réserver */}
      <section className="py-32 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Comment réserver ?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {[
              { step: '1', text: 'Choisissez votre destination et vos envies' },
              { step: '2', text: 'Contactez-nous par message ou formulaire' },
              { step: '3', text: 'Recevez des propositions personnalisées' },
              { step: '4', text: 'Confirmez, nous organisons tout' },
            ].map((item) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <div className="w-12 h-12 bg-[#556B2F] text-white flex items-center justify-center flex-shrink-0 text-xl" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {item.step}
                </div>
                <p className="pt-2 text-lg text-black/80">{item.text}</p>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xl text-black/70 mb-12 italic" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Vous n'avez rien à faire, si ce n'est profiter pleinement.
          </p>
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
              Planifiez votre expérience
            </h2>
            <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg">
              Partagez-nous vos envies, nous créons l'expérience parfaite
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