import { motion } from 'motion/react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export function Transport() {
  const vehicles = [
    {
      title: 'Berlines de luxe',
      image: 'https://images.unsplash.com/photo-1597509560792-796c8682d017?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBiZXJsaW5lJTIwY2FyfGVufDF8fHx8MTc2NzQzMjkwNXww&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'SUV premium',
      image: 'https://images.unsplash.com/photo-1739950075618-f9ae2f90b0c0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBTVVYlMjBibGFja3xlbnwxfHx8fDE3Njc0MzI5MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
    {
      title: 'Véhicules blindés',
      image: 'https://images.unsplash.com/photo-1637252166739-b47f8875f304?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcm1vcmVkJTIwbHV4dXJ5JTIwdmVoaWNsZXxlbnwxfHx8fDE3Njc0MzI5MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    },
  ];

  return (
    <div className="min-h-screen pt-20">
      {/* Hero Section */}
      <section className="relative h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-black">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1547731269-e4073e054f12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzZWRhbiUyMGludGVyaW9yfGVufDF8fHx8MTc2NzQzMjkwNHww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Luxury car interior"
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
            Chaque déplacement<br />devient un privilège
          </h1>
          <p className="text-lg md:text-xl text-white/80 tracking-wide">
            Arrivez avec élégance.
          </p>
        </motion.div>
      </section>

      {/* Vehicle Gallery */}
      <section className="py-0">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {vehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2 }}
              className="relative aspect-[4/3] group overflow-hidden"
            >
              <ImageWithFallback
                src={vehicle.image}
                alt={vehicle.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
                <h3 className="text-white text-2xl" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {vehicle.title}
                </h3>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Disponible 24h/24, 7j/7
            </h2>
            <p className="text-black/60 max-w-2xl mx-auto text-lg mb-12">
              Des véhicules d'exception, des chauffeurs professionnels, une ponctualité irréprochable
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              'Transferts aéroport VIP',
              'Mise à disposition',
              'Événementiel',
              'Location longue durée',
              'Circuits privés',
              'Convoyage',
            ].map((service, index) => (
              <motion.div
                key={service}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="text-center p-6 border border-black/10"
              >
                <p className="text-black/80">{service}</p>
              </motion.div>
            ))}
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
            <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Réservez votre chauffeur
            </h2>
            <p className="text-white/70 mb-10 max-w-2xl mx-auto text-lg">
              Service premium pour tous vos déplacements
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
