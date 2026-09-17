import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { StudioFooter, StudioHeader } from '../components/StudioChrome';
import {
  ArrowRight,
  Check,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
} from 'lucide-react';

// =============================================================================
// Label Maison Studio — produit payant : le visiteur envoie la photo d'une
// pièce, choisit une ambiance, voit un aperçu flouté gratuit, puis paie une
// fois (9,99 €) pour récupérer le rendu HD sans filigrane + la vidéo
// avant/après à poster.
//
// Toute la partie sensible vit côté serveur (api/studio-*.ts) : le rendu HD
// n'arrive dans cette page qu'après vérification du paiement chez Stripe.
// Charte « Ivoire & or » du site : canvas ivoire, or en accent, titres Playfair.
// =============================================================================

const GOLD = '#A97C30';
const GOLD_DARK = '#7C561D';
const GOLD_LIGHT = '#E6CD93';
const INK = '#2C2418';
const INK_2 = '#7A7264';
const IVORY = '#FBF9F4';
const IVORY_ALT = '#F7F4EE';
const LINE = '#E6DDC9';
const DARK_BG = 'linear-gradient(135deg, #4A3A17 0%, #372C11 55%, #2B220C 100%)';

const AMBIANCES = [
  { key: 'contemporain', label: 'Contemporain chic', desc: 'Noyer, laiton brossé, lignes nettes' },
  { key: 'haussmannien', label: 'Haussmannien', desc: 'Parquet chevrons, moulures, velours' },
  { key: 'boheme', label: 'Bohème doux', desc: 'Rotin, lin, verdure, tons terreux' },
  { key: 'minimaliste', label: 'Minimaliste lumineux', desc: 'Chêne clair, blanc cassé, respiration' },
] as const;

type AmbianceKey = (typeof AMBIANCES)[number]['key'];

type Offre = { label: string; centimes: number; rendus: number };

const OFFRES_DEFAUT: Record<'unique' | 'trio', Offre> = {
  unique: { label: 'Rendu HD + vidéo avant/après', centimes: 999, rendus: 1 },
  trio: { label: 'Pack 3 rendus HD + vidéos', centimes: 2490, rendus: 3 },
};

const prix = (centimes: number) => `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

const MEMOIRE = 'lm_studio_etat';
const DUREE_MEMOIRE = 2 * 60 * 60 * 1000; // 2 h : le temps d'un aller-retour Stripe

type EtatMemorise = {
  photo: string;
  apercu: string;
  scelle: string;
  ambiance: AmbianceKey;
  jeton?: string | null;
  sessionId?: string | null;
  t: number;
};

function memoriser(etat: Omit<EtatMemorise, 't'>) {
  try {
    window.localStorage.setItem(MEMOIRE, JSON.stringify({ ...etat, t: Date.now() }));
  } catch {
    /* stockage plein ou indisponible : on continue sans mémoire */
  }
}

function relire(): EtatMemorise | null {
  try {
    const brut = window.localStorage.getItem(MEMOIRE);
    if (!brut) return null;
    const etat = JSON.parse(brut) as EtatMemorise;
    if (!etat?.t || Date.now() - etat.t > DUREE_MEMOIRE) return null;
    return etat;
  } catch {
    return null;
  }
}

const SITE = 'https://www.labelmaisoncg.fr';

// Données structurées : produit payant + questions fréquentes + fil d'Ariane.
// Le même contenu que ce qui est affiché sur la page (rien d'inventé).
const donneesStructurees = () => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Product',
      name: 'Label Maison Studio — rendu luxe de votre pièce',
      description:
        "À partir d'une photo de votre pièce, le studio génère un rendu photoréaliste de la même pièce mise en valeur : mêmes murs, mêmes ouvertures, même point de vue. Rendu à titre indicatif, non contractuel.",
      image: `${SITE}/images/studio/exemple-apres.jpg`,
      brand: { '@type': 'Brand', name: 'Label Maison Conciergerie' },
      offers: {
        '@type': 'Offer',
        price: (OFFRES_DEFAUT.unique.centimes / 100).toFixed(2),
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: `${SITE}/studio`,
        description: 'Paiement unique, sans abonnement : rendu HD sans filigrane et vidéo avant/après.',
      },
    },
    {
      '@type': 'HowTo',
      name: 'Obtenir le rendu luxe de sa pièce à partir d’une photo',
      totalTime: 'PT1M',
      step: [
        { '@type': 'HowToStep', name: 'La photo', text: 'Photographiez la pièce en entier, de jour, en montrant les fenêtres.' },
        { '@type': 'HowToStep', name: "L'ambiance", text: 'Choisissez contemporain chic, haussmannien, bohème doux ou minimaliste lumineux, et précisez vos envies.' },
        { '@type': 'HowToStep', name: "L'aperçu gratuit", text: 'Le rendu s’affiche en une trentaine de secondes, flouté et filigrané.' },
        { '@type': 'HowToStep', name: 'Le rendu HD', text: 'Un paiement unique de 9,99 € débloque l’image haute définition et la vidéo avant/après.' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.r },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Label Maison Studio', item: `${SITE}/studio` },
      ],
    },
  ],
});

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------
function Eyebrow({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  const color = tone === 'dark' ? GOLD_LIGHT : GOLD_DARK;
  const rule = tone === 'dark' ? 'rgba(230,205,147,0.5)' : 'rgba(169,124,48,0.45)';
  return (
    <span
      className="inline-flex items-center gap-3 text-[12px] font-semibold uppercase"
      style={{ color, letterSpacing: '0.28em' }}
    >
      <span className="h-px w-8" style={{ background: rule }} />
      {children}
    </span>
  );
}

function BoutonOr({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-bold text-[15px] px-7 py-4 rounded-full transition-transform hover:-translate-y-0.5 disabled:opacity-55 disabled:hover:translate-y-0 disabled:cursor-not-allowed ${className}`}
      style={{
        background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`,
        color: '#2B220C',
        boxShadow: '0 12px 30px rgba(169,124,48,0.28)',
      }}
    >
      {children}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Comparateur avant / après (sert au rendu du client, pas de vitrine fabriquée)
// -----------------------------------------------------------------------------
function Comparateur({
  avant,
  apres,
  flou,
  legende,
  ratio = '4 / 3',
}: {
  avant: string;
  apres: string;
  flou?: boolean;
  legende?: string;
  ratio?: string;
}) {
  const [position, setPosition] = useState(52);
  return (
    <div
      className="relative overflow-hidden rounded-2xl select-none"
      style={{ border: `1px solid ${LINE}`, background: IVORY_ALT, aspectRatio: ratio }}
    >
      <img src={apres} alt="Rendu Label Maison Studio" className="absolute inset-0 w-full h-full object-cover" />
      {/* La photo d'origine occupe tout le cadre et n'est que rognée : les deux
          images restent ainsi parfaitement superposées quel que soit le curseur. */}
      <img
        src={avant}
        alt="Votre pièce avant"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />
      {flou && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(44,36,24,0.05), rgba(44,36,24,0.35))' }}
        />
      )}

      <span
        className="absolute top-3 left-3 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full text-white"
        style={{ background: 'rgba(44,36,24,0.66)', letterSpacing: '0.16em' }}
      >
        Avant
      </span>
      <span
        className="absolute top-3 right-3 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full text-white"
        style={{ background: 'rgba(124,86,29,0.8)', letterSpacing: '0.16em' }}
      >
        {legende || 'Après'}
      </span>

      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Comparer avant et après"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
      <div
        className="absolute inset-y-0 w-10 -translate-x-1/2 flex items-center justify-center pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <span className="w-px h-full" style={{ background: 'rgba(255,255,255,0.85)' }} />
        <span
          className="absolute w-10 h-10 rounded-full bg-white flex items-center justify-center text-[13px] font-bold"
          style={{ color: GOLD_DARK, boxShadow: '0 8px 22px rgba(44,36,24,0.28)' }}
        >
          ‹ ›
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Outils image : réduction côté client avant envoi (poids + coût de génération)
// -----------------------------------------------------------------------------
async function chargerImage(fichier: File): Promise<HTMLImageElement | ImageBitmap> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* format non décodable par createImageBitmap : on tente la balise <img> */
    }
  }
  const url = URL.createObjectURL(fichier);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('lecture impossible'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

async function reduirePhoto(fichier: File, cote = 1600): Promise<string> {
  const source = await chargerImage(fichier);
  const l = 'width' in source ? source.width : 0;
  const h = 'height' in source ? source.height : 0;
  const ratio = Math.min(1, cote / Math.max(l, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(l * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');
  ctx.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}

function telecharger(url: string, nom: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// -----------------------------------------------------------------------------
// Vidéo avant/après 9:16, fabriquée dans le navigateur (canvas + MediaRecorder)
// -----------------------------------------------------------------------------
function typeVideoSupporte(): { mime: string; ext: string } {
  const candidats = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidats) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', ext: 'webm' };
}

async function fabriquerVideo(avantUrl: string, apresUrl: string, ambiance: string): Promise<Blob> {
  const [avant, apres] = await Promise.all(
    [avantUrl, apresUrl].map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image illisible'));
          img.src = src;
        }),
    ),
  );

  const L = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponible');

  try {
    await (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  } catch {
    /* polices déjà prêtes ou API absente */
  }

  const couvrir = (img: HTMLImageElement) => {
    const r = Math.max(L / img.width, H / img.height);
    const l = img.width * r;
    const h = img.height * r;
    ctx.drawImage(img, (L - l) / 2, (H - h) / 2, l, h);
  };

  const etiquette = (texte: string, x: number, aDroite = false) => {
    ctx.font = "700 34px Figtree, -apple-system, sans-serif";
    const largeur = ctx.measureText(texte).width + 56;
    const gx = aDroite ? x - largeur : x;
    ctx.fillStyle = aDroite ? 'rgba(124,86,29,0.86)' : 'rgba(44,36,24,0.7)';
    ctx.beginPath();
    ctx.roundRect(gx, 120, largeur, 74, 37);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(texte, gx + 28, 159);
  };

  const signature = () => {
    const g = ctx.createLinearGradient(0, H - 340, 0, H);
    g.addColorStop(0, 'rgba(28,22,8,0)');
    g.addColorStop(1, 'rgba(28,22,8,0.86)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H - 340, L, 340);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = "600 62px 'Playfair Display', Georgia, serif";
    ctx.fillText('LABEL MAISON', L / 2, H - 190);
    ctx.fillStyle = GOLD_LIGHT;
    ctx.font = "600 27px Figtree, sans-serif";
    ctx.fillText('C O N C I E R G E R I E', L / 2, H - 142);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = "500 26px Figtree, sans-serif";
    ctx.fillText(`Ambiance ${ambiance} · labelmaisoncg.fr`, L / 2, H - 92);
    ctx.textAlign = 'left';
  };

  const dessiner = (avancement: number) => {
    couvrir(apres);
    const coupe = Math.max(0, Math.min(1, avancement)) * L;
    if (coupe > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, coupe, H);
      ctx.clip();
      couvrir(avant);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(coupe - 3, 0, 6, H);
    }
    if (avancement > 0.06) etiquette('AVANT', 60);
    if (avancement < 0.94) etiquette('APRÈS', L - 60, true);
    signature();
  };

  const { mime, ext } = typeVideoSupporte();
  const flux = canvas.captureStream(30);
  const enregistreur = new MediaRecorder(flux, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const morceaux: BlobPart[] = [];
  enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);

  const fini = new Promise<Blob>((resolve) => {
    enregistreur.onstop = () => resolve(new Blob(morceaux, { type: mime || `video/${ext}` }));
  });

  enregistreur.start();
  const depart = performance.now();
  const DUREE = 7000;
  await new Promise<void>((resolve) => {
    let termine = false;
    const finir = () => {
      if (termine) return;
      termine = true;
      resolve();
    };
    // Filet de sécurité : si l'onglet passe en arrière-plan, le navigateur bride
    // les animations. On borne quand même la durée du montage.
    const secours = window.setTimeout(finir, DUREE + 12_000);
    const boucle = () => {
      const t = (performance.now() - depart) / DUREE;
      // 0–18 % : on montre l'avant ; 18–68 % : balayage ; 68–100 % : on admire l'après.
      const avancement = t < 0.18 ? 1 : t < 0.68 ? 1 - (t - 0.18) / 0.5 : 0;
      dessiner(avancement);
      if (t >= 1) {
        window.clearTimeout(secours);
        return finir();
      }
      // requestAnimationFrame est suspendu quand l'onglet n'est pas visible :
      // on repasse alors sur un minuteur pour que le montage aboutisse malgré tout.
      if (document.visibilityState === 'visible') requestAnimationFrame(boucle);
      else window.setTimeout(boucle, 40);
    };
    boucle();
  });
  enregistreur.stop();
  return fini;
}

// -----------------------------------------------------------------------------
// HERO — mur d'images en mouvement (vraies photos de logements gérés) + titre
// -----------------------------------------------------------------------------
const MUR_HAUT = [
  { src: '/images/studio/exemple-apres.jpg', alt: 'Rendu du studio — séjour contemporain chic' },
  { src: '/images/studio/rendu-chambre.jpg', alt: 'Rendu du studio — chambre contemporain chic' },
  { src: '/images/real/hero-logement-exception.jpg', alt: 'Terrasse d’un logement géré par Label Maison' },
  { src: '/images/studio/rendu-salle-de-bain.jpg', alt: 'Rendu du studio — salle de bain minimaliste' },
  { src: '/images/studio/rendu-haussmannien.jpg', alt: 'Rendu du studio — chambre haussmannienne' },
];

const MUR_BAS = [
  { src: '/images/studio/rendu-suite.jpg', alt: 'Rendu du studio — chambre style hôtel' },
  { src: '/images/real/gestion-villa.jpg', alt: 'Villa gérée par Label Maison Conciergerie' },
  { src: '/images/studio/rendu-riad.jpg', alt: 'Rendu du studio — ambiance bohème' },
  { src: '/images/studio/rendu-chambre-claire.jpg', alt: 'Rendu du studio — chambre minimaliste lumineuse' },
  { src: '/images/real/desert-pool.jpg', alt: 'Piscine d’un bien géré par Label Maison Conciergerie' },
];

function Rangee({
  images,
  sens,
  duree,
}: {
  images: { src: string; alt: string }[];
  sens: 'gauche' | 'droite';
  duree: number;
}) {
  return (
    <div
      className="lm-mur-rangee flex gap-3 md:gap-4"
      style={{ width: 'max-content', animation: `lm-defile-${sens} ${duree}s linear infinite` }}
    >
      {[...images, ...images].map((img, i) => (
        <div
          key={`${img.src}-${i}`}
          className="shrink-0 w-[150px] md:w-[260px] rounded-2xl overflow-hidden"
          style={{ aspectRatio: '3 / 4', border: '1px solid rgba(230,205,147,0.16)' }}
        >
          <img
            src={img.src}
            alt=""
            aria-hidden
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative overflow-hidden min-h-[620px] md:min-h-[88vh] flex items-center"
      style={{ background: '#1B1508' }}
    >
      <style>{`
        @keyframes lm-defile-gauche { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes lm-defile-droite { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .lm-mur-rangee { animation: none !important; } }
      `}</style>

      {/* Le mur : deux rangées qui glissent en sens inverse */}
      <div className="absolute inset-0 flex flex-col justify-center gap-3 md:gap-4 pointer-events-none">
        <Rangee images={MUR_HAUT} sens="gauche" duree={68} />
        <Rangee images={MUR_BAS} sens="droite" duree={84} />
      </div>

      {/* Voile : le mur reste perceptible, le texte reste lisible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(118% 76% at 50% 48%, rgba(18,13,4,0.74) 0%, rgba(18,13,4,0.6) 48%, rgba(18,13,4,0.42) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(18,13,4,0.9) 0%, rgba(18,13,4,0.1) 26%, rgba(18,13,4,0.1) 74%, rgba(18,13,4,0.9) 100%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[900px] mx-auto px-6 pt-[120px] pb-[70px] md:pt-[130px] md:pb-[80px] text-center flex flex-col items-center gap-6"
      >
        <span
          className="inline-flex items-center gap-3 text-[11px] md:text-[12px] font-semibold uppercase text-white/80"
          style={{ letterSpacing: '0.28em' }}
        >
          <span className="h-px w-8 bg-white/40" />
          Label Maison Studio
          <span className="h-px w-8 bg-white/40" />
        </span>

        <h1 className="font-serif-title text-[44px] md:text-[82px] leading-[1.02] font-normal text-white">
          Votre bien, révélé en{' '}
          <span className="font-serif-italic" style={{ color: GOLD_LIGHT }}>
            version luxe
          </span>
          .
        </h1>

        <p className="text-[17px] md:text-[21px] max-w-[640px] text-white/85">
          Une photo de votre pièce, une ambiance, trente secondes. Vous repartez avec le rendu HD et
          la vidéo avant/après à poster.
        </p>

        <a
          href="#studio"
          className="mt-2 inline-flex items-center gap-2 font-bold text-[15px] md:text-[16px] px-9 py-4 md:py-5 rounded-full transition-transform hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`,
            color: '#2B220C',
            boxShadow: '0 16px 40px rgba(0,0,0,0.42)',
          }}
        >
          Composer mon rendu <ArrowRight size={17} />
        </a>

        <p className="text-[13px] text-white/65">
          Aperçu gratuit · rendu HD à {prix(OFFRES_DEFAUT.unique.centimes)}, paiement unique, sans
          abonnement
        </p>
        <p className="text-[11.5px] text-white/45 max-w-[560px]">
          Images de fond : photos de logements que nous gérons et rendus produits par le studio à
          partir de ces mêmes photos.
        </p>
      </motion.div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// EXEMPLE — un vrai avant/après produit par le studio (photo réelle d'un bien)
// -----------------------------------------------------------------------------
function Exemple() {
  return (
    <section className="py-[60px] md:py-[100px]" style={{ background: IVORY_ALT }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-10 md:gap-14 items-center">
          <motion.div {...fadeUp}>
            <Eyebrow>Un exemple, pas une promesse</Eyebrow>
            <h2
              className="mt-5 font-serif-title text-[30px] md:text-[46px] font-normal leading-[1.08]"
              style={{ color: INK }}
            >
              La même cuisine,{' '}
              <span className="font-serif-italic" style={{ color: GOLD }}>
                révélée
              </span>
              .
            </h2>
            <p className="mt-4 text-[15px] md:text-[17px] leading-relaxed" style={{ color: INK_2 }}>
              La photo brute d’une cuisine à rénover, puis le rendu produit par le studio en ambiance{' '}
              <strong style={{ color: INK }}>Contemporain chic</strong> : même fenêtre, même
              ouverture sur le séjour, même lumière d’origine, même point de vue. Seuls les
              finitions, le mobilier et la mise en scène changent.
            </p>
            <ul className="mt-6 grid gap-2 text-[14px]" style={{ color: INK_2 }}>
              {[
                'L’architecture du bien est conservée à l’identique',
                'Aucune pièce inventée, aucun mur déplacé',
                'Rendu à titre indicatif, non contractuel',
              ].map((l) => (
                <li key={l} className="flex items-start gap-2">
                  <Check size={15} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                  {l}
                </li>
              ))}
            </ul>
            <a
              href="#studio"
              className="mt-8 inline-flex items-center gap-2 font-bold text-[15px] px-7 py-4 rounded-full transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
            >
              Essayer avec ma photo <ArrowRight size={16} />
            </a>
          </motion.div>

          <motion.div {...fadeUp} className="max-w-[360px] w-full mx-auto">
            {/* La vidéo que le studio livre avec le rendu HD : format vertical 9:16,
                prête à poster. Elle tourne en boucle, sans son. */}
            <video
              src="/videos/studio-demo.mp4"
              poster="/videos/studio-demo-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              controls
              className="w-full rounded-2xl"
              style={{ border: `1px solid ${LINE}`, aspectRatio: '9 / 16', objectFit: 'cover', background: IVORY_ALT }}
            />
            <p className="mt-3 text-center text-[12px]" style={{ color: INK_2 }}>
              La vidéo avant/après livrée avec le rendu — format vertical, prête pour Instagram et
              TikTok.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// LE STUDIO — conversation : on envoie une photo, on dit ce qu'on veut,
// le studio répond avec le rendu. Tout le tunnel (aperçu gratuit, paiement,
// rendu HD, vidéo) se déroule dans le fil de discussion.
// -----------------------------------------------------------------------------
const MESSAGES_ATTENTE = [
  'Lecture de l’architecture de la pièce…',
  'Réglage de la lumière naturelle…',
  'Choix des matières et des finitions…',
  'Mise en scène du mobilier…',
  'Dernières retouches…',
];

type Bulle =
  | { id: string; de: 'studio'; type: 'texte'; texte: ReactNode }
  | { id: string; de: 'studio'; type: 'ambiances' }
  | { id: string; de: 'studio'; type: 'attente' }
  | { id: string; de: 'studio'; type: 'apercu'; apercu: string; ambiance: string }
  | { id: string; de: 'studio'; type: 'rendu'; hd: string; avant: string; ambiance: string }
  | { id: string; de: 'moi'; type: 'texte'; texte: string }
  | { id: string; de: 'moi'; type: 'photo'; url: string };

let compteurBulles = 0;
const idBulle = () => `b${(compteurBulles += 1)}`;

const ACCUEIL: Bulle = {
  id: idBulle(),
  de: 'studio',
  type: 'texte',
  texte: (
    <>
      Bonjour, ici le studio Label Maison. <strong>Envoyez-moi une photo de la pièce</strong> que
      vous aimeriez voir en version luxe — chambre, salon, salle de bain — et dites-moi ce dont vous
      avez envie. Le premier aperçu est offert.
    </>
  ),
};

function LeStudio() {
  const [fil, setFil] = useState<Bulle[]>([ACCUEIL]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ambiance, setAmbiance] = useState<AmbianceKey>('contemporain');
  const [saisie, setSaisie] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [scelle, setScelle] = useState<string | null>(null);
  const [hd, setHd] = useState<string | null>(null);
  const [offres, setOffres] = useState(OFFRES_DEFAUT);
  const [message, setMessage] = useState(MESSAGES_ATTENTE[0]);
  const [survol, setSurvol] = useState(false);
  const [videoEnCours, setVideoEnCours] = useState(false);
  const [videoPrete, setVideoPrete] = useState<{ url: string; ext: string } | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rendusRestants, setRendusRestants] = useState(0);
  const [emailClient, setEmailClient] = useState('');

  const filRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLInputElement>(null);

  const ajouter = useCallback((b: Omit<Bulle, 'id'>) => {
    setFil((f) => [...f, { ...b, id: idBulle() } as Bulle]);
  }, []);

  const remplacerAttente = useCallback((b: Omit<Bulle, 'id'> | null) => {
    setFil((f) => {
      const sans = f.filter((x) => x.type !== 'attente');
      return b ? [...sans, { ...b, id: idBulle() } as Bulle] : sans;
    });
  }, []);

  const libelleAmbiance = useMemo(
    () => AMBIANCES.find((a) => a.key === ambiance)?.label ?? '',
    [ambiance],
  );

  // Le fil défile tout seul à chaque nouvelle bulle. On repasse un peu plus tard :
  // les images (aperçu, rendu) changent la hauteur une fois chargées.
  useEffect(() => {
    const bas = (doux: boolean) => {
      const el = filRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: doux ? 'smooth' : 'auto' });
    };
    bas(true);
    const t1 = window.setTimeout(() => bas(false), 400);
    const t2 = window.setTimeout(() => bas(false), 1200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [fil]);

  // Messages qui défilent pendant la génération.
  useEffect(() => {
    if (!fil.some((b) => b.type === 'attente')) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % MESSAGES_ATTENTE.length;
      setMessage(MESSAGES_ATTENTE[i]);
    }, 3200);
    return () => window.clearInterval(id);
  }, [fil]);

  const erreur = useCallback(
    (texte: string) => ajouter({ de: 'studio', type: 'texte', texte: <span style={{ color: '#8A3520' }}>{texte}</span> }),
    [ajouter],
  );

  // ---------------------------------------------------------------------------
  // Génération
  // ---------------------------------------------------------------------------
  const lancer = useCallback(
    async (photoUrl: string, amb: AmbianceKey, precisions: string) => {
      setOccupe(true);
      setMessage(MESSAGES_ATTENTE[0]);
      ajouter({ de: 'studio', type: 'attente' });
      try {
        const rep = await fetch('/api/studio-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photo: photoUrl, ambiance: amb, precisions, jeton }),
        });
        const json = await rep.json().catch(() => ({}));
        if (!rep.ok || !json.ok) throw new Error(json.error || `Erreur ${rep.status}`);
        setApercu(json.apercu);
        setScelle(json.scelle);
        setHd(null);
        setVideoPrete(null);
        if (json.offres) setOffres(json.offres);
        const label = AMBIANCES.find((a) => a.key === amb)?.label ?? '';
        remplacerAttente({ de: 'studio', type: 'apercu', apercu: json.apercu, ambiance: label });
        memoriser({ photo: photoUrl, apercu: json.apercu, scelle: json.scelle, ambiance: amb, jeton, sessionId });
      } catch (err) {
        remplacerAttente(null);
        erreur(err instanceof Error ? err.message : 'Génération impossible pour le moment.');
      } finally {
        setOccupe(false);
      }
    },
    [ajouter, remplacerAttente, erreur, jeton, sessionId],
  );

  // ---------------------------------------------------------------------------
  // Photo
  // ---------------------------------------------------------------------------
  const recevoirPhoto = useCallback(
    async (fichier: File | undefined) => {
      if (!fichier) return;
      if (!/^image\//.test(fichier.type)) {
        erreur('Je ne lis que les images : envoyez un JPG ou un PNG.');
        return;
      }
      try {
        const reduite = await reduirePhoto(fichier);
        setPhoto(reduite);
        setApercu(null);
        setHd(null);
        setVideoPrete(null);
        ajouter({ de: 'moi', type: 'photo', url: reduite });
        ajouter({
          de: 'studio',
          type: 'texte',
          texte: (
            <>
              Photo bien reçue. <strong>Quelle ambiance</strong> voulez-vous voir ? Choisissez
              ci-dessous, ou écrivez-moi votre envie (« canapé beige, plus de lumière »).
            </>
          ),
        });
        ajouter({ de: 'studio', type: 'ambiances' });
      } catch {
        erreur('Cette image n’a pas pu être lue. Essayez un JPG ou un PNG.');
      }
    },
    [ajouter, erreur],
  );

  const choisirAmbiance = useCallback(
    (key: AmbianceKey) => {
      const label = AMBIANCES.find((a) => a.key === key)?.label ?? '';
      setAmbiance(key);
      ajouter({ de: 'moi', type: 'texte', texte: label });
      if (!photo) {
        erreur('Envoyez-moi d’abord une photo de la pièce (bouton photo, à gauche du champ).');
        return;
      }
      void lancer(photo, key, saisie.trim());
    },
    [ajouter, erreur, photo, saisie, lancer],
  );

  const envoyer = useCallback(() => {
    const texte = saisie.trim();
    if (!texte || occupe) return;
    ajouter({ de: 'moi', type: 'texte', texte });
    setSaisie('');
    if (!photo) {
      ajouter({
        de: 'studio',
        type: 'texte',
        texte: (
          <>
            Il me faut d’abord une photo de la pièce : touchez le bouton photo à gauche du champ,
            ou déposez votre image ici.
          </>
        ),
      });
      return;
    }
    void lancer(photo, ambiance, texte);
  }, [saisie, occupe, ajouter, photo, ambiance, lancer]);

  // ---------------------------------------------------------------------------
  // Paiement et déblocage
  // ---------------------------------------------------------------------------
  const payer = useCallback(
    async (offre: 'unique' | 'trio') => {
      if (!scelle) return;
      setOccupe(true);
      try {
        const rep = await fetch('/api/studio-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scelle, offre }),
        });
        const json = await rep.json().catch(() => ({}));
        if (!rep.ok || !json.ok || !json.url) throw new Error(json.error || `Erreur ${rep.status}`);
        window.location.href = json.url;
      } catch (err) {
        setOccupe(false);
        erreur(err instanceof Error ? err.message : 'Paiement indisponible pour le moment.');
      }
    },
    [scelle, erreur],
  );

  const utiliserCredit = useCallback(async () => {
    if (!scelle || !sessionId || !jeton) return;
    setOccupe(true);
    try {
      const rep = await fetch('/api/studio-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, scelle, jeton }),
      });
      const json = await rep.json().catch(() => ({}));
      if (!rep.ok || !json.ok) throw new Error(json.error || `Erreur ${rep.status}`);
      setHd(json.hd);
      setJeton(json.jeton ?? null);
      setRendusRestants(json.rendusRestants ?? 0);
      ajouter({
        de: 'studio',
        type: 'rendu',
        hd: json.hd,
        avant: photo || '',
        ambiance: json.ambianceLabel || libelleAmbiance,
      });
    } catch (err) {
      erreur(err instanceof Error ? err.message : 'Déblocage impossible pour le moment.');
    } finally {
      setOccupe(false);
    }
  }, [scelle, sessionId, jeton, photo, libelleAmbiance, ajouter, erreur]);

  // Retour de Stripe : on reprend le fil là où il s'était arrêté.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paiement = params.get('paiement');
    if (!paiement) return;

    const nettoyer = () => window.history.replaceState({}, '', '/studio');
    const etat = relire();
    if (etat) {
      setPhoto(etat.photo);
      setApercu(etat.apercu);
      setScelle(etat.scelle);
      setAmbiance(etat.ambiance);
      setJeton(etat.jeton ?? null);
      const label = AMBIANCES.find((a) => a.key === etat.ambiance)?.label ?? '';
      setFil([
        ACCUEIL,
        { id: idBulle(), de: 'moi', type: 'photo', url: etat.photo },
        { id: idBulle(), de: 'moi', type: 'texte', texte: label },
      ]);
    }

    if (paiement === 'annule') {
      nettoyer();
      setFil((f) => [
        ...f,
        {
          id: idBulle(),
          de: 'studio',
          type: 'texte',
          texte: 'Paiement annulé — votre aperçu est toujours là, vous pouvez réessayer quand vous voulez.',
        },
        ...(etat ? [{ id: idBulle(), de: 'studio', type: 'apercu', apercu: etat.apercu, ambiance: AMBIANCES.find((a) => a.key === etat.ambiance)?.label ?? '' } as Bulle] : []),
      ]);
      return;
    }

    const session = params.get('session_id');
    nettoyer();
    if (paiement !== 'ok' || !session || !etat) {
      if (paiement === 'ok' && !etat) {
        setFil((f) => [
          ...f,
          {
            id: idBulle(),
            de: 'studio',
            type: 'texte',
            texte:
              'Paiement bien reçu. Votre aperçu n’est plus en mémoire sur cet appareil, mais votre rendu HD vous est envoyé par e-mail.',
          },
        ]);
      }
      return;
    }

    setSessionId(session);
    setOccupe(true);
    setFil((f) => [...f, { id: idBulle(), de: 'studio', type: 'attente' }]);

    (async () => {
      try {
        const rep = await fetch('/api/studio-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session, scelle: etat.scelle, jeton: etat.jeton ?? null }),
        });
        const json = await rep.json().catch(() => ({}));
        if (!rep.ok || !json.ok) throw new Error(json.error || `Erreur ${rep.status}`);
        setHd(json.hd);
        setEmailClient(json.email || '');
        setJeton(json.jeton ?? null);
        setRendusRestants(json.rendusRestants ?? 0);
        setFil((f) => [
          ...f.filter((b) => b.type !== 'attente'),
          {
            id: idBulle(),
            de: 'studio',
            type: 'texte',
            texte: 'Merci ! Voici votre rendu en haute définition, sans filigrane.',
          },
          {
            id: idBulle(),
            de: 'studio',
            type: 'rendu',
            hd: json.hd,
            avant: etat.photo,
            ambiance: json.ambianceLabel || '',
          },
        ]);
        memoriser({
          photo: etat.photo,
          apercu: etat.apercu,
          scelle: etat.scelle,
          ambiance: etat.ambiance,
          jeton: json.jeton ?? null,
          sessionId: session,
        });
        // Au retour de Stripe, on amène le visiteur droit sur la conversation.
        window.setTimeout(
          () => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          150,
        );
      } catch (err) {
        setFil((f) => [
          ...f.filter((b) => b.type !== 'attente'),
          {
            id: idBulle(),
            de: 'studio',
            type: 'texte',
            texte: `${err instanceof Error ? err.message : 'Déblocage impossible'} — votre rendu HD vous est aussi envoyé par e-mail.`,
          },
        ]);
      } finally {
        setOccupe(false);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Vidéo avant/après
  // ---------------------------------------------------------------------------
  const genererVideo = useCallback(async () => {
    if (!photo || !hd) return;
    setVideoEnCours(true);
    try {
      const blob = await fabriquerVideo(photo, hd, libelleAmbiance);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      setVideoPrete({ url: URL.createObjectURL(blob), ext });
    } catch {
      erreur('La vidéo n’a pas pu être fabriquée dans ce navigateur. Essayez depuis Chrome ou Safari à jour.');
    } finally {
      setVideoEnCours(false);
    }
  }, [photo, hd, libelleAmbiance, erreur]);

  const credit = Boolean(jeton && sessionId && rendusRestants > 0);

  return (
    <section id="studio" className="py-[64px] md:py-[110px]" style={{ background: IVORY }}>
      <div className="max-w-[900px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Le studio</Eyebrow>
          <h2 className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]" style={{ color: INK }}>
            Dites-moi ce que vous voulez{' '}
            <span className="font-serif-italic" style={{ color: GOLD }}>
              changer
            </span>
          </h2>
          <p className="max-w-[560px] text-[15px] md:text-[16px]" style={{ color: INK_2 }}>
            Envoyez une photo, écrivez votre envie, recevez le rendu. Le premier aperçu est gratuit ;
            le rendu HD sans filigrane et la vidéo avant/après se débloquent pour{' '}
            {prix(offres.unique.centimes)}.
          </p>
        </motion.div>

        <div
          className="mt-9 md:mt-12 rounded-[26px] overflow-hidden bg-white"
          style={{ border: `1px solid ${LINE}`, boxShadow: '0 28px 80px rgba(64,49,24,0.10)' }}
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSurvol(false);
            void recevoirPhoto(e.dataTransfer.files?.[0]);
          }}
        >
          {/* En-tête du fil */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: `1px solid ${LINE}`, background: '#FDFCF9' }}
          >
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0"
              style={{ background: 'rgba(169,124,48,0.1)' }}
            >
              <img src="/images/key-gold.png" alt="" aria-hidden className="w-5 h-auto" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-serif-title text-[17px]" style={{ color: INK }}>
                Label Maison Studio
              </span>
              <span className="text-[12px]" style={{ color: INK_2 }}>
                {occupe ? 'écrit…' : 'en ligne · répond en moins d’une minute'}
              </span>
            </span>
          </div>

          {/* Le fil */}
          <div
            ref={filRef}
            className="px-4 md:px-6 py-6 overflow-y-auto flex flex-col gap-4"
            style={{
              minHeight: 260,
              maxHeight: 'min(70vh, 560px)',
              background: survol ? '#FBF5E9' : '#FFFFFF',
              transition: 'background .15s',
            }}
          >
            {!photo && (
              <label
                htmlFor="studio-depot"
                className="block cursor-pointer rounded-2xl text-center px-6 py-10 transition-colors"
                style={{
                  border: `1.5px dashed ${survol ? GOLD : '#D9CBA6'}`,
                  background: survol ? '#F7F1E4' : IVORY_ALT,
                }}
              >
                <span className="flex flex-col items-center gap-2">
                  <ImagePlus size={28} style={{ color: GOLD }} />
                  <span className="text-[16px] font-bold" style={{ color: INK }}>
                    Déposez votre photo ici
                  </span>
                  <span className="text-[13px]" style={{ color: INK_2 }}>
                    JPG ou PNG · glissez-déposez ou cliquez · le premier aperçu est offert
                  </span>
                </span>
                <input
                  id="studio-depot"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void recevoirPhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            )}

            {fil.map((b) => (
              <BulleDuFil
                key={b.id}
                bulle={b}
                message={message}
                offres={offres}
                occupe={occupe}
                credit={credit}
                rendusRestants={rendusRestants}
                email={emailClient}
                videoEnCours={videoEnCours}
                videoPrete={videoPrete}
                ambianceActive={ambiance}
                onAmbiance={choisirAmbiance}
                onPayer={payer}
                onCredit={utiliserCredit}
                onVideo={genererVideo}
              />
            ))}
          </div>

          {/* Le composeur */}
          <div className="px-3 md:px-4 py-3" style={{ borderTop: `1px solid ${LINE}`, background: '#FDFCF9' }}>
            {photo && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {AMBIANCES.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => choisirAmbiance(a.key)}
                    disabled={occupe}
                    className="shrink-0 text-[12.5px] font-semibold px-3.5 py-2 rounded-full transition-colors disabled:opacity-50"
                    style={{
                      border: `1px solid ${a.key === ambiance ? GOLD : LINE}`,
                      background: a.key === ambiance ? '#FBF5E9' : '#FFFFFF',
                      color: a.key === ambiance ? GOLD_DARK : INK_2,
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <label
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full cursor-pointer"
                style={{ border: `1px solid ${LINE}`, background: '#FFFFFF', color: GOLD_DARK }}
                title="Ajouter une photo"
              >
                <ImagePlus size={19} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    void recevoirPhoto(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <span className="sr-only">Ajouter une photo</span>
              </label>

              <input
                ref={champRef}
                type="text"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value.slice(0, 300))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    envoyer();
                  }
                }}
                placeholder={
                  photo ? 'Ex. : canapé beige, tapis, plus de lumière…' : 'Envoyez une photo, puis écrivez votre envie…'
                }
                className="flex-1 text-[15px] px-4 py-3 rounded-full outline-none"
                style={{ border: `1px solid ${LINE}`, background: '#FFFFFF', color: INK }}
              />

              <button
                type="button"
                onClick={envoyer}
                disabled={occupe || !saisie.trim()}
                aria-label="Envoyer"
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full disabled:opacity-45"
                style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
              >
                {occupe ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>

            <p className="mt-2 px-1 text-[11.5px] leading-relaxed" style={{ color: INK_2 }}>
              Un aperçu gratuit par visiteur. Votre photo sert uniquement à produire le rendu. Rendu à
              titre indicatif, non contractuel.
            </p>
          </div>
        </div>

        <p className="mt-5 text-center text-[12px]" style={{ color: INK_2 }}>
          Paiement unique de {prix(offres.unique.centimes)}, sans abonnement, encaissé par Stripe —
          aucune donnée bancaire n’est stockée par Label Maison.{' '}
          <Link to="/studio/conditions" className="underline" style={{ color: GOLD_DARK }}>
            Conditions et remboursement
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Une bulle du fil
// -----------------------------------------------------------------------------
function BulleDuFil({
  bulle,
  message,
  offres,
  occupe,
  credit,
  rendusRestants,
  email,
  videoEnCours,
  videoPrete,
  ambianceActive,
  onAmbiance,
  onPayer,
  onCredit,
  onVideo,
}: {
  bulle: Bulle;
  message: string;
  offres: Record<'unique' | 'trio', Offre>;
  occupe: boolean;
  credit: boolean;
  rendusRestants: number;
  email: string;
  videoEnCours: boolean;
  videoPrete: { url: string; ext: string } | null;
  ambianceActive: AmbianceKey;
  onAmbiance: (k: AmbianceKey) => void;
  onPayer: (o: 'unique' | 'trio') => void;
  onCredit: () => void;
  onVideo: () => void;
}) {
  const moi = bulle.de === 'moi';

  const enveloppe = (contenu: ReactNode, large = false) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${moi ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`rounded-2xl px-4 py-3 ${large ? 'w-full max-w-[420px]' : 'max-w-[86%] md:max-w-[75%]'}`}
        style={
          moi
            ? { background: 'linear-gradient(180deg, #F6EAD3, #EFDFC1)', color: INK, borderTopRightRadius: 6 }
            : { background: IVORY_ALT, color: INK, border: `1px solid ${LINE}`, borderTopLeftRadius: 6 }
        }
      >
        {contenu}
      </div>
    </motion.div>
  );

  if (bulle.type === 'texte') {
    return enveloppe(<p className="text-[15px] leading-relaxed">{bulle.texte}</p>);
  }

  if (bulle.type === 'photo') {
    // Vignette bornée en hauteur : le fil reste lisible même avec une photo verticale.
    return enveloppe(
      <img
        src={bulle.url}
        alt="La pièce que vous avez envoyée"
        className="rounded-xl w-full object-cover"
        style={{ maxHeight: 260 }}
      />,
    );
  }

  if (bulle.type === 'ambiances') {
    return enveloppe(
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AMBIANCES.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => onAmbiance(a.key)}
            disabled={occupe}
            className="text-left rounded-xl px-3.5 py-2.5 transition-colors disabled:opacity-50"
            style={{
              border: `1px solid ${a.key === ambianceActive ? GOLD : LINE}`,
              background: '#FFFFFF',
            }}
          >
            <span className="block text-[13.5px] font-bold" style={{ color: INK }}>
              {a.label}
            </span>
            <span className="block text-[12px] mt-0.5" style={{ color: INK_2 }}>
              {a.desc}
            </span>
          </button>
        ))}
      </div>,
      true,
    );
  }

  if (bulle.type === 'attente') {
    return enveloppe(
      <div className="flex items-center gap-3">
        <span className="relative inline-flex items-center justify-center w-9 h-9 shrink-0">
          <span
            className="absolute inset-0 rounded-full animate-spin"
            style={{
              background: `conic-gradient(from 0deg, transparent, ${GOLD_LIGHT}, ${GOLD})`,
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
            }}
          />
          <img src="/images/key-gold.png" alt="" aria-hidden className="w-4 h-auto" />
        </span>
        <span className="text-[14px]" style={{ color: INK_2 }}>
          {message}
        </span>
      </div>,
    );
  }

  if (bulle.type === 'apercu') {
    return enveloppe(
      <div>
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '4 / 3' }}>
          <img src={bulle.apercu} alt="Aperçu flouté de votre rendu" className="absolute inset-0 w-full h-full object-cover" />
          <div
            className="absolute inset-0 flex flex-col items-center justify-end text-center gap-1.5 p-4"
            style={{ background: 'linear-gradient(180deg, rgba(44,36,24,0.05), rgba(44,36,24,0.62))' }}
          >
            <Lock size={16} className="text-white/90" />
            <p className="font-serif-title text-[18px] text-white">Votre rendu luxe est prêt</p>
            <p className="text-[12.5px] text-white/85">Débloquez-le en HD, net et sans filigrane.</p>
          </div>
          <span
            className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full text-white"
            style={{ background: 'rgba(124,86,29,0.8)', letterSpacing: '0.14em' }}
          >
            {bulle.ambiance}
          </span>
        </div>

        {credit ? (
          <button
            type="button"
            onClick={onCredit}
            disabled={occupe}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 font-bold text-[14px] px-5 py-3 rounded-full disabled:opacity-55"
            style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
          >
            {occupe ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Débloquer avec mon crédit ({rendusRestants} restant{rendusRestants > 1 ? 's' : ''})
          </button>
        ) : (
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => onPayer('unique')}
              disabled={occupe}
              className="w-full inline-flex items-center justify-center gap-2 font-bold text-[14px] px-5 py-3 rounded-full disabled:opacity-55"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
            >
              {occupe ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
              Débloquer mon rendu HD — {prix(offres.unique.centimes)}
            </button>
            <button
              type="button"
              onClick={() => onPayer('trio')}
              disabled={occupe}
              className="w-full rounded-full px-5 py-2.5 text-[13px] font-semibold disabled:opacity-55"
              style={{ border: `1px solid ${GOLD}`, color: GOLD_DARK, background: '#FFFFFF' }}
            >
              Pack 3 rendus — {prix(offres.trio.centimes)}
            </button>
            <p className="text-[11px] leading-relaxed" style={{ color: INK_2 }}>
              <ShieldCheck size={12} className="inline mr-1" style={{ color: GOLD }} />
              Paiement unique par Stripe. Rendu HD sans filigrane + vidéo avant/après 9:16.
            </p>
          </div>
        )}
      </div>,
      true,
    );
  }

  // bulle.type === 'rendu'
  return enveloppe(
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: GOLD_DARK }}>
        <Check size={15} /> Rendu HD {bulle.ambiance ? `— ${bulle.ambiance}` : ''}
      </div>

      {bulle.avant ? (
        <Comparateur avant={bulle.avant} apres={bulle.hd} legende="Après · HD" />
      ) : (
        <img src={bulle.hd} alt="Votre rendu HD" className="rounded-xl w-full h-auto" />
      )}

      <div className="mt-3 grid gap-2">
        <button
          type="button"
          onClick={() => telecharger(bulle.hd, `label-maison-studio-${Date.now()}.jpg`)}
          className="w-full inline-flex items-center justify-center gap-2 font-bold text-[14px] px-5 py-3 rounded-full"
          style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
        >
          <Download size={16} /> Télécharger le rendu HD
        </button>

        {videoPrete ? (
          <button
            type="button"
            onClick={() => telecharger(videoPrete.url, `label-maison-avant-apres.${videoPrete.ext}`)}
            className="w-full rounded-full px-5 py-2.5 text-[13px] font-semibold inline-flex items-center justify-center gap-2"
            style={{ border: `1px solid ${GOLD}`, color: GOLD_DARK, background: '#FFFFFF' }}
          >
            <Download size={15} /> Télécharger la vidéo 9:16
          </button>
        ) : (
          <button
            type="button"
            onClick={onVideo}
            disabled={videoEnCours}
            className="w-full rounded-full px-5 py-2.5 text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-55"
            style={{ border: `1px solid ${GOLD}`, color: GOLD_DARK, background: '#FFFFFF' }}
          >
            {videoEnCours ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
            {videoEnCours ? 'Montage de la vidéo…' : 'Créer la vidéo avant/après (9:16)'}
          </button>
        )}

        {videoPrete && (
          <video
            src={videoPrete.url}
            controls
            playsInline
            className="w-full rounded-xl"
            style={{ border: `1px solid ${LINE}`, maxHeight: 360 }}
          />
        )}

        <p className="text-[11.5px] leading-relaxed" style={{ color: INK_2 }}>
          {email ? `Une copie part aussi vers ${email}. ` : ''}
          {rendusRestants > 0
            ? `Il vous reste ${rendusRestants} rendu${rendusRestants > 1 ? 's' : ''} : envoyez une autre photo quand vous voulez. `
            : ''}
          Rendu à titre indicatif, non contractuel.
        </p>
      </div>
    </div>,
    true,
  );
}

// -----------------------------------------------------------------------------
// PREUVE — chiffres réels de gestion (capture d'écran propriétaire)
// -----------------------------------------------------------------------------
function Preuve() {
  return (
    <section className="py-[70px] md:py-[110px] relative overflow-hidden" style={{ background: DARK_BG }}>
      <img
        src="/images/key-gold-deep.png"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-[-70px] bottom-[-40px] w-[360px] max-w-[45%] h-auto opacity-[0.06]"
      />
      <div className="max-w-[1100px] mx-auto px-6 relative z-10">
        <motion.div {...fadeUp} className="flex flex-col items-center text-center gap-4">
          <Eyebrow tone="dark">Preuve réelle · Décembre 2025</Eyebrow>
          <h2
            className="font-serif-title text-[32px] md:text-[48px] font-normal leading-[1.1]"
            style={{ color: '#F2ECD9' }}
          >
            Un rendu fait rêver.{' '}
            <span className="font-serif-italic" style={{ color: GOLD_LIGHT }}>
              La gestion fait les revenus.
            </span>
          </h2>
          <p className="max-w-[620px] text-[15px] md:text-[16px]" style={{ color: '#C2B795' }}>
            Le studio montre le potentiel de votre logement. Notre métier, c’est la suite : le mettre
            en ligne et le gérer en location courte durée.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <motion.div {...fadeUp}>
            <p
              className="text-[12px] font-semibold uppercase"
              style={{ color: GOLD_LIGHT, letterSpacing: '0.2em' }}
            >
              Décembre 2025
            </p>
            <p className="mt-3 font-serif-title text-[46px] md:text-[64px] leading-none" style={{ color: GOLD_LIGHT }}>
              6 359,32 €
            </p>
            <p className="mt-3 text-[16px] md:text-[18px]" style={{ color: '#E8E0CB' }}>
              de revenus nets sur un seul bien géré, en un seul mois — capture réelle du tableau de
              bord propriétaire.
            </p>
            <Link
              to="/proprietaires"
              className="mt-7 inline-flex items-center gap-2 font-bold text-[14px] px-6 py-3.5 rounded-full transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
            >
              Faire estimer mes revenus <ArrowRight size={15} />
            </Link>
          </motion.div>

          <motion.div {...fadeUp} className="relative">
            <div
              className="rounded-2xl overflow-hidden bg-white"
              style={{ border: '1px solid rgba(230,205,147,0.28)', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}
            >
              <img
                src="/images/img-proprietaire-decembre.png"
                alt="Revenus Airbnb décembre 2025 : 6 359,32 € — capture réelle"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------
const FAQ = [
  {
    q: 'Comment ça marche ?',
    r: 'Vous déposez une photo de votre pièce et vous choisissez une ambiance. Notre studio génère en une trentaine de secondes une version « après mise en valeur » de la même pièce : mêmes murs, mêmes fenêtres, même point de vue, mais finitions, mobilier et lumière repensés. L’aperçu flouté est gratuit ; le rendu HD et la vidéo avant/après se débloquent en un paiement unique.',
  },
  {
    q: 'Est-ce réaliste ?',
    r: 'Le rendu respecte l’architecture existante et reste volontairement crédible : pas de mur déplacé, pas de pièce inventée. Il illustre un potentiel de décoration et de mise en scène, pas un devis de travaux. Il est fourni à titre indicatif et non contractuel.',
  },
  {
    q: 'Que se passe-t-il après le paiement ?',
    r: 'Le rendu HD s’affiche immédiatement dans cette page, téléchargeable sans filigrane, et une copie part par e-mail. Vous pouvez aussi générer la vidéo avant/après au format vertical 9:16, prête à poster sur Instagram ou TikTok.',
  },
  {
    q: 'Puis-je vous confier la gestion du bien ?',
    r: 'Oui, c’est notre métier principal. Label Maison Conciergerie gère la location courte durée de A à Z : photos, annonce, tarification dynamique, voyageurs, ménage et reporting. Écrivez-nous ou demandez une estimation de revenus depuis la page propriétaires.',
  },
  {
    q: 'Et mes photos ?',
    r: 'Votre photo sert uniquement à produire votre rendu. Elle n’est ni revendue, ni publiée. Les détails figurent dans nos conditions et notre politique de confidentialité.',
  },
];

function FaqSection() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY_ALT }}>
      <div className="max-w-[820px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2
            className="font-serif-title text-[32px] md:text-[44px] font-normal leading-[1.1]"
            style={{ color: INK }}
          >
            Tout savoir avant de{' '}
            <span className="font-serif-italic" style={{ color: GOLD }}>
              composer
            </span>
          </h2>
        </motion.div>

        <div className="mt-10 grid gap-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white px-5 py-4"
              style={{ border: `1px solid ${LINE}` }}
            >
              <summary
                className="cursor-pointer list-none flex items-center justify-between gap-4 text-[16px] font-semibold"
                style={{ color: INK }}
              >
                {item.q}
                <span className="shrink-0 transition-transform group-open:rotate-45" style={{ color: GOLD }}>
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed" style={{ color: INK_2 }}>
                {item.r}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// IDÉES DÉCO — maillage interne vers le silo (pages statiques de public/)
// -----------------------------------------------------------------------------
const IDEES = [
  { url: '/idee-deco-chambre-luxe', titre: 'Idée déco chambre luxe', texte: '12 pistes concrètes, de la tête de lit à la lumière.' },
  { url: '/relooker-sa-chambre-sans-travaux', titre: 'Relooker sa chambre sans travaux', texte: "La méthode en un week-end, sans percer un mur." },
  { url: '/chambre-style-hotel-de-luxe', titre: 'Chambre style hôtel de luxe', texte: 'Les codes des palaces, applicables chez vous.' },
  { url: '/idee-deco-salon-luxe', titre: 'Idée déco salon luxe', texte: 'Composer une vraie pièce de réception.' },
  { url: '/decoration-style-haussmannien', titre: 'Décoration haussmannienne', texte: "L'élégance parisienne sans le pastiche." },
  { url: '/home-staging-virtuel', titre: 'Home staging virtuel', texte: 'Montrer le potentiel sans meubler le bien.' },
  { url: '/simulateur-decoration-interieure-ia', titre: 'Simulateur de déco par IA', texte: "Ce que l'outil sait faire, et ce qu'il ne fait pas." },
  { url: '/avant-apres-decoration-interieure', titre: 'Avant/après décoration', texte: 'Les règles d\'une comparaison honnête.' },
  { url: '/ameliorer-photos-annonce-airbnb', titre: "Photos d'annonce qui font cliquer", texte: 'Cadrage, lumière, ordre des photos.' },
];

function Idees() {
  return (
    <section className="py-[60px] md:py-[100px]" style={{ background: IVORY }}>
      <div className="max-w-[1080px] mx-auto px-6">
        <motion.div {...fadeUp} className="text-center flex flex-col items-center gap-4">
          <Eyebrow>Des idées avant le rendu</Eyebrow>
          <h2
            className="font-serif-title text-[30px] md:text-[44px] font-normal leading-[1.1]"
            style={{ color: INK }}
          >
            Vous cherchez des idées pour{' '}
            <span className="font-serif-italic" style={{ color: GOLD }}>
              changer votre pièce
            </span>{' '}
            ?
          </h2>
          <p className="max-w-[620px] text-[15px] md:text-[16px]" style={{ color: INK_2 }}>
            Nos guides de décoration, pièce par pièce et style par style, écrits à partir des biens
            que nous préparons toute l’année.
          </p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {IDEES.map((i) => (
            <a
              key={i.url}
              href={i.url}
              className="block rounded-2xl bg-white px-5 py-5 transition-transform hover:-translate-y-0.5"
              style={{ border: `1px solid ${LINE}` }}
            >
              <span className="block text-[15px] font-bold" style={{ color: INK }}>
                {i.titre}
              </span>
              <span className="block mt-1 text-[13.5px] leading-relaxed" style={{ color: INK_2 }}>
                {i.texte}
              </span>
              <span
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: GOLD_DARK }}
              >
                Lire le guide <ArrowRight size={13} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// CTA final
// -----------------------------------------------------------------------------
function CtaFinal() {
  return (
    <section className="py-[70px] md:py-[110px]" style={{ background: IVORY }}>
      <div className="max-w-[900px] mx-auto px-6">
        <motion.div
          {...fadeUp}
          className="rounded-[26px] text-center px-7 py-12 md:px-14 md:py-16"
          style={{
            background: 'linear-gradient(160deg, #F7F4EE, #FFFFFF)',
            border: `1px solid ${LINE}`,
            boxShadow: '0 24px 70px rgba(64,49,24,0.10)',
          }}
        >
          <Eyebrow>Votre patrimoine, géré comme une maison de confiance</Eyebrow>
          <h2
            className="mt-5 font-serif-title text-[30px] md:text-[44px] font-normal leading-[1.1]"
            style={{ color: INK }}
          >
            Prêt à voir ce que votre bien{' '}
            <span className="font-serif-italic" style={{ color: GOLD }}>
              peut devenir
            </span>{' '}
            ?
          </h2>
          <p className="mt-4 text-[15px] md:text-[17px] max-w-[520px] mx-auto" style={{ color: INK_2 }}>
            Un aperçu gratuit, un rendu HD à {prix(OFFRES_DEFAUT.unique.centimes)}, et si vous le
            souhaitez, une estimation de revenus en location courte durée.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#studio"
              className="inline-flex items-center gap-2 font-bold text-[15px] px-8 py-4 rounded-full transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(180deg, ${GOLD_LIGHT}, ${GOLD})`, color: '#2B220C' }}
            >
              Composer mon rendu <ArrowRight size={16} />
            </a>
            <Link
              to="/proprietaires"
              className="inline-flex items-center gap-2 font-semibold text-[15px] px-7 py-4 rounded-full"
              style={{ border: `1px solid ${LINE}`, color: INK }}
            >
              Confier mon bien à la conciergerie
            </Link>
          </div>
          <p className="mt-6 text-[12px]" style={{ color: INK_2 }}>
            Paris · Dubaï · Marrakech — +33 7 49 54 83 55 ·{' '}
            <Link to="/studio/conditions" className="underline">
              Conditions, remboursement et données personnelles
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------
export function Studio() {
  // Microsoft Clarity : chargé seulement si un identifiant de projet est fourni.
  useEffect(() => {
    const id = import.meta.env.VITE_CLARITY_ID;
    if (!id || document.getElementById('lm-clarity')) return;
    const script = document.createElement('script');
    script.id = 'lm-clarity';
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${id}`;
    document.head.appendChild(script);
  }, []);

  return (
    <main>
      <Helmet>
        <title>Votre chambre en version luxe : rendu déco à partir d’une photo — Label Maison Studio</title>
        <meta
          name="description"
          content="Une idée déco pour votre chambre ou votre salon ? Envoyez une photo : le studio Label Maison en génère la version luxe photoréaliste, sans travaux. Aperçu gratuit, rendu HD et vidéo avant/après à 9,99 € en paiement unique."
        />
        <link rel="canonical" href={`${SITE}/studio`} />
        <meta name="robots" content="index,follow,max-image-preview:large" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="fr_FR" />
        <meta property="og:site_name" content="Label Maison Conciergerie" />
        <meta property="og:title" content="Votre chambre en version luxe, à partir d’une simple photo" />
        <meta
          property="og:description"
          content="Idées déco et rendu photoréaliste de votre propre pièce : aperçu gratuit, HD à 9,99 €."
        />
        <meta property="og:url" content={`${SITE}/studio`} />
        <meta property="og:image" content={`${SITE}/images/studio/exemple-apres.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content={GOLD} />
        <script type="application/ld+json">{JSON.stringify(donneesStructurees())}</script>
      </Helmet>

      <StudioHeader />
      <Hero />
      <Exemple />
      <LeStudio />
      <Preuve />
      <FaqSection />
      <Idees />
      <CtaFinal />
      <StudioFooter />
    </main>
  );
}
