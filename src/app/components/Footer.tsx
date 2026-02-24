import { Instagram, Mail, Music } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-black text-white">
      {/* Nous contacter section */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm tracking-widest text-[#D4AF37] mb-4 uppercase">Contactez-nous</p>
              <h2 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Nous sommes à votre écoute
              </h2>
              <p className="text-white/70 text-lg leading-relaxed mb-8">
                Notre équipe est disponible 24/7 pour répondre à toutes vos demandes et vous accompagner dans vos projets les plus exclusifs.
              </p>
              <div className="space-y-4">
                <a
                  href="https://www.instagram.com/labelmaisoncg/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 text-white/80 hover:text-white transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#556B2F] transition-all">
                    <Instagram size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Instagram</p>
                    <p className="text-white">@labelmaisoncg</p>
                  </div>
                </a>
                <a
                  href="https://www.tiktok.com/@labelmaison.cg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 text-white/80 hover:text-white transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#556B2F] transition-all">
                    <Music size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">TikTok</p>
                    <p className="text-white">@labelmaison.cg</p>
                  </div>
                </a>
                <a
                  href="mailto:contact@labelmaisoncgexperience.fr"
                  className="flex items-center gap-4 text-white/80 hover:text-white transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#556B2F] transition-all">
                    <Mail size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Email</p>
                    <p className="text-white">contact@labelmaisoncgexperience.fr</p>
                  </div>
                </a>
              </div>
            </div>
            
            <div className="bg-white/5 backdrop-blur-sm p-10 border border-white/10">
              <h3 className="text-2xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Demande d'information
              </h3>
              <p className="text-white/60 mb-6 text-sm">
                Pour toute demande spécifique, contactez-nous directement via Instagram ou email. Notre équipe vous répondra dans les plus brefs délais.
              </p>
              <a
                href="https://www.instagram.com/labelmaisoncg/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center px-8 py-4 bg-[#556B2F] text-white hover:bg-[#6B8E3A] transition-all tracking-wide"
              >
                Envoyer un message
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center justify-center text-center space-y-6">
            <h2 className="text-4xl md:text-5xl tracking-wider" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              LabelMaison <span className="text-[#D4AF37]">CG</span>
            </h2>
            
            <div className="flex flex-col items-center space-y-2">
              <p className="text-sm text-white/60 tracking-wide uppercase">
                Conciergerie privée d'exception
              </p>
              <p className="text-xs text-white/40 max-w-md">
                Service sur-mesure réservé à une clientèle privée exigeante
              </p>
            </div>

            <div className="pt-8 border-t border-white/10 w-full max-w-md">
              <p className="text-xs text-white/40">
                © 2026 LabelMaison CG. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}