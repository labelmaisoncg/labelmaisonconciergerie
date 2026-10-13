import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2 } from 'lucide-react';
import { ETAPES_DOSSIER } from '../../erp/data/dossier-proprietaire';
import { valeursInitiales, type Valeurs } from '../../erp/data/etapes-formulaire';
import { BrandLogo } from '../components/BrandLogo';
import { Wizard } from '../ui/Wizard';

/**
 * /dossier-proprietaire : le dossier que le propriétaire remplit après
 * l'appel (lien envoyé depuis le CRM de l'ERP). Une question par écran ; à
 * l'envoi, le propriétaire et le logement entrent dans l'ERP et l'équipe
 * reçoit un récapitulatif par e-mail (api/dossier-proprietaire.ts).
 */

const CLE_BROUILLON = 'lm-dossier-proprietaire-v1';
const WHATSAPP = 'https://wa.me/33749548355';

type Brouillon = { valeurs: Valeurs; etape?: string };

function lireBrouillon(): Brouillon | null {
  try {
    const x = JSON.parse(localStorage.getItem(CLE_BROUILLON) ?? 'null') as Brouillon | null;
    return x && typeof x.valeurs === 'object' && x.valeurs ? x : null;
  } catch {
    return null;
  }
}

function garderBrouillon(b: Brouillon | null) {
  try {
    if (b) localStorage.setItem(CLE_BROUILLON, JSON.stringify(b));
    else localStorage.removeItem(CLE_BROUILLON);
  } catch {
    /* navigation privée, stockage plein : le dossier se remplit quand même */
  }
}

const BOUTON_PRINCIPAL =
  'inline-flex h-14 items-center justify-center rounded-full bg-[var(--color-gold-dark)] px-8 text-[17px] font-semibold text-white hover:bg-[#6A4914] focus-visible:ring-2 focus-visible:ring-[rgba(169,124,48,0.5)] focus-visible:outline-none';
const BOUTON_TEXTE =
  'inline-flex h-11 items-center justify-center rounded-full px-4 text-[16px] font-semibold text-[var(--color-gold-dark)] hover:bg-[rgba(169,124,48,0.08)] focus-visible:ring-2 focus-visible:ring-[rgba(169,124,48,0.5)] focus-visible:outline-none';

export default function DossierProprietaire() {
  const brouillon = useMemo(lireBrouillon, []);
  const [phase, setPhase] = useState<'accueil' | 'assistant' | 'envoye'>('accueil');
  const [valeurs, setValeurs] = useState<Valeurs>(() => brouillon?.valeurs ?? valeursInitiales(ETAPES_DOSSIER));
  const [etape, setEtape] = useState<string | undefined>(brouillon?.etape);
  // Leurre anti-robots : un humain ne voit ni ne remplit ce champ.
  const [leurre, setLeurre] = useState('');
  const [confirmerEffacer, setConfirmerEffacer] = useState(false);

  useEffect(() => {
    if (phase === 'assistant') garderBrouillon({ valeurs, etape });
  }, [phase, valeurs, etape]);

  const recommencer = () => {
    garderBrouillon(null);
    setValeurs(valeursInitiales(ETAPES_DOSSIER));
    setEtape(undefined);
    setPhase('assistant');
  };

  const envoyer = async () => {
    let r: Response;
    try {
      r = await fetch('/api/dossier-proprietaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valeurs, site_web: leurre }),
      });
    } catch {
      throw new Error('Connexion impossible. Vérifiez votre réseau, vos réponses restent sur cet appareil.');
    }
    const json = (await r.json().catch(() => ({}))) as { ok?: boolean; erreur?: string };
    if (!r.ok || !json.ok) throw new Error(json.erreur ?? 'Envoi impossible pour le moment. Réessayez dans un instant.');
    garderBrouillon(null);
    setPhase('envoye');
  };

  const entete = (
    <Helmet>
      <title>Dossier propriétaire — Label Maison Conciergerie</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="description" content="Le dossier de mise en service de votre logement avec Label Maison Conciergerie." />
    </Helmet>
  );

  if (phase === 'assistant') {
    return (
      <>
        {entete}
        <Wizard
          etapes={ETAPES_DOSSIER}
          valeurs={valeurs}
          onChange={setValeurs}
          onEnvoyer={envoyer}
          onFermer={() => setPhase('accueil')}
          etapeInitiale={etape}
          onEtape={setEtape}
          libelleEnvoi="Envoyer mon dossier"
          marque={<BrandLogo size={16} />}
        />
      </>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      {entete}
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+28px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <a href="/" aria-label="Label Maison Conciergerie, accueil du site" className="self-start">
          <BrandLogo size={18} />
        </a>

        {phase === 'envoye' ? (
          <div className="my-auto py-12">
            <CheckCircle2 className="size-12 text-[var(--color-gold-dark)]" aria-hidden />
            <h1 className="font-serif-title mt-5 text-[36px] leading-[1.1] sm:text-[44px]">Merci, votre dossier est envoyé</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-[#6B6252]">
              Nous le relisons et revenons vers vous pour la suite : le contrat de gestion à signer, puis la mise en service.
            </p>
            <p className="mt-3 text-[17px] leading-relaxed text-[#6B6252]">
              Pour gagner du temps, vous pouvez déjà nous envoyer quelques photos de chaque pièce.
            </p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOUTON_PRINCIPAL}>
                Envoyer mes photos sur WhatsApp
              </a>
              <a href="/" className={BOUTON_TEXTE}>
                Revenir au site
              </a>
            </div>
          </div>
        ) : (
          <div className="my-auto py-12">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-gold-dark)] uppercase">Mise en service</p>
            <h1 className="font-serif-title mt-3 text-[40px] leading-[1.05] sm:text-[52px]">
              Votre logement,{' '}
              <span className="font-serif-italic text-[var(--color-gold-dark)]">prêt à accueillir</span>
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-[#6B6252]">
              L’essentiel sur vous et votre logement, une question par écran. Nous voyons le détail ensemble lors de la visite.
            </p>
            <p className="mt-4 text-[15px] text-[#6B6252]">Environ 3 minutes. Vos réponses restent sur cet appareil jusqu’à l’envoi.</p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => setPhase('assistant')} className={BOUTON_PRINCIPAL}>
                {brouillon || etape ? 'Reprendre mon dossier' : 'Commencer'}
              </button>
              {(brouillon || etape) && !confirmerEffacer && (
                <button type="button" onClick={() => setConfirmerEffacer(true)} className={BOUTON_TEXTE}>
                  Tout recommencer
                </button>
              )}
            </div>
            {confirmerEffacer && (
              <div role="alertdialog" aria-label="Effacer vos réponses" className="mt-4 rounded-2xl border border-[rgba(64,49,24,0.14)] bg-white p-4">
                <p className="text-[15px]">Vos réponses déjà saisies seront effacées de cet appareil.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={recommencer}
                    className="inline-flex h-11 items-center rounded-full bg-[#A33A2E] px-5 text-[15px] font-semibold text-white focus-visible:ring-2 focus-visible:ring-[rgba(163,58,46,0.4)] focus-visible:outline-none"
                  >
                    Effacer et recommencer
                  </button>
                  <button type="button" onClick={() => setConfirmerEffacer(false)} className={BOUTON_TEXTE}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
            <label className="sr-only" aria-hidden>
              Site web
              <input tabIndex={-1} autoComplete="off" value={leurre} onChange={(e) => setLeurre(e.target.value)} />
            </label>
          </div>
        )}

        <p className="text-[13px] text-[#6B6252]">
          Vos données servent uniquement à la gestion de votre logement.{' '}
          <a href="/politique-de-confidentialite" className="underline underline-offset-2 hover:text-[var(--color-gold-dark)]">
            Politique de confidentialité
          </a>
        </p>
      </div>
    </main>
  );
}
