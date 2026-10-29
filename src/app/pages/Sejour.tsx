import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import '../../erp/erp.css';
import { completer } from '../../erp/data/collections';
import { CONTACTS_LABEL_MAISON } from '../../erp/data/proprietaire';
import { CLE_DEMO, MODE_DEMO } from '../../erp/data/config';
import { AUJOURDHUI, MAINTENANT, horodatageMaintenant } from '../../erp/data/format';
import {
  MAX_VOYAGEURS,
  MESSAGES_REFUS_CHECKIN,
  etatLienSejour,
  jetonDuFragment,
  lireSaisieCheckin,
  nouveauCheckin,
  vueSejour,
  type ErreurCheckin,
  type LangueSejour,
  type SaisieCheckin,
  type VueSejour,
} from '../../erp/data/sejour';
import type { ErpDonnees, Reservation } from '../../erp/data/types';
import { checkinsDemo, garderCheckinDemo } from '../../erp/sejour/demo';
import { LivretSejour } from '../../erp/sejour/LivretSejour';
import { TEXTES } from '../../erp/sejour/textes';
import { Button, Card, Skeleton } from '../../erp/ui';

/**
 * /sejour#<jeton> : le livret d'accueil et le check-in en ligne d'un séjour,
 * pour le voyageur, sans compte. Le jeton (signé par le serveur, lien reçu
 * dans la messagerie de la plateforme) reste après « # » : il n'est jamais
 * envoyé au serveur dans l'adresse, seulement dans le corps des appels à
 * api/sejour.ts, qui renvoie la vue du séjour (data/sejour.ts, vueSejour).
 *
 * Démo (VITE_ERP_DEMO=1) : ?apercu=<id d'une réservation>, calculé sur le jeu
 * de démo ; sans id, le prochain séjour. Le check-in de démo reste dans ce
 * navigateur (CLE_DEMO_CHECKINS).
 */

const API = '/api/sejour';
/** Langue choisie sur cet appareil (rien d'autre n'est gardé). */
const CLE_LANGUE = 'lm-sejour-langue';

function langueInitiale(): LangueSejour {
  try {
    const l = window.localStorage.getItem(CLE_LANGUE);
    if (l === 'fr' || l === 'en') return l;
  } catch {
    // Stockage indisponible (navigation privée) : la langue du navigateur.
  }
  return /^fr\b/i.test(navigator.language || 'fr') ? 'fr' : 'en';
}

type Etat = { nom: 'chargement' } | { nom: 'message'; texte: string; reessayer?: boolean; conciergerie?: string } | { nom: 'pret'; vue: VueSejour };

/** En-tête des écrans de message : le nom de la conciergerie, avec le monogramme LM pour Label Maison seulement. */
function EnteteMarque({ nom }: { nom: string }) {
  return (
    <div className="mb-5 flex flex-col items-center gap-2 text-center">
      {nom === 'Label Maison' && (
        <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-(--lm-brun) text-[15px] font-semibold text-(--lm-sur-brun)">
          LM
        </span>
      )}
      <p className="lm-titre text-[22px] leading-tight text-(--lm-brun)">{nom}</p>
    </div>
  );
}

async function appeler(corps: Record<string, unknown>): Promise<{ statut: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(API, { method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    return { statut: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { statut: 0, json: {} };
  }
}

/* ------------------------------------------------------------------ démo */

function lireDemo(): ErpDonnees | null {
  try {
    const brut = window.localStorage.getItem(CLE_DEMO);
    const d = brut ? (JSON.parse(brut) as Partial<ErpDonnees>) : null;
    return d && typeof d === 'object' && Array.isArray(d.logements) ? completer(d) : null;
  } catch {
    return null;
  }
}

/** Séjour de démonstration : celui demandé, sinon le prochain (arrivée la plus proche, pas annulé). */
async function sejourDemo(apercu: string): Promise<{ reservation: Reservation; donnees: ErpDonnees } | null> {
  const donnees = lireDemo() ?? (await import('../../erp/data/seed')).creerSeed();
  const reservation = apercu
    ? donnees.reservations.find((r) => r.id === apercu)
    : donnees.reservations.filter((r) => r.statut !== 'annulee' && r.depart > AUJOURDHUI).sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0];
  return reservation ? { reservation, donnees } : null;
}

function vueDemo(s: { reservation: Reservation; donnees: ErpDonnees }): VueSejour {
  return vueSejour({
    conciergerie: 'Label Maison',
    reservation: s.reservation,
    logement: s.donnees.logements.find((l) => l.id === s.reservation.logementId),
    checkin: checkinsDemo()[s.reservation.id],
    aujourdhui: AUJOURDHUI,
    // L'heure de la démo (10:30) : le jour du départ, le séjour dure jusqu'à l'heure de départ.
    heure: MAINTENANT.slice(11, 16),
    checkinOuvert: true,
    // Comme le serveur pour Label Maison (séjour direct : « Appeler », « Écrire un e-mail »).
    contacts: { email: CONTACTS_LABEL_MAISON.email, telephone: CONTACTS_LABEL_MAISON.telephone },
  });
}

/* ------------------------------------------------------------------ page */

export default function Sejour() {
  const [parametres] = useSearchParams();
  const apercu = MODE_DEMO ? (parametres.get('apercu') ?? '') : '';
  const [langue, setLangue] = useState<LangueSejour>(langueInitiale);
  const [etat, setEtat] = useState<Etat>({ nom: 'chargement' });
  const [jeton, setJeton] = useState(() => jetonDuFragment(window.location.hash));
  const [demo, setDemo] = useState<{ reservation: Reservation; donnees: ErpDonnees } | null>(null);
  const t = TEXTES[langue];

  useEffect(() => {
    const lire = () => setJeton(jetonDuFragment(window.location.hash));
    window.addEventListener('hashchange', lire);
    return () => window.removeEventListener('hashchange', lire);
  }, []);

  const changerLangue = () => {
    const l: LangueSejour = langue === 'fr' ? 'en' : 'fr';
    setLangue(l);
    try {
      window.localStorage.setItem(CLE_LANGUE, l);
    } catch {
      // Navigation privée : la langue vaut pour cette visite.
    }
  };

  const charger = useCallback(async () => {
    setEtat({ nom: 'chargement' });
    if (MODE_DEMO) {
      const s = await sejourDemo(apercu);
      setDemo(s);
      if (!s) return setEtat({ nom: 'message', texte: 'Démonstration : séjour introuvable.' });
      const e = etatLienSejour(s.reservation, AUJOURDHUI);
      if (e !== 'ouvert') return setEtat({ nom: 'message', texte: e === 'annule' ? MESSAGES_REFUS_CHECKIN.annule[langue] : TEXTES[langue].lienExpire, conciergerie: 'Label Maison' });
      return setEtat({ nom: 'pret', vue: vueDemo(s) });
    }
    if (!jeton) return setEtat({ nom: 'message', texte: TEXTES[langue].lienIncomplet });
    const r = await appeler({ action: 'vue', jeton, langue });
    if (r.statut === 200 && r.json.vue) return setEtat({ nom: 'pret', vue: r.json.vue as VueSejour });
    if (r.statut === 0) return setEtat({ nom: 'message', texte: TEXTES[langue].erreurReseau, reessayer: true });
    // Séjour annulé ou lien expiré (410) : le serveur donne aussi le nom de la conciergerie, pour l'en-tête.
    const conciergerie = r.statut === 410 && typeof r.json.conciergerie === 'string' ? r.json.conciergerie.slice(0, 80) : '';
    const texte = r.statut === 410 && r.json.code === 'expire' ? TEXTES[langue].lienExpire : String(r.json.erreur ?? TEXTES[langue].erreur);
    setEtat({ nom: 'message', texte, reessayer: r.statut >= 500 || r.statut === 429, ...(conciergerie ? { conciergerie } : {}) });
    // Changer de langue ne recharge pas la vue : les textes de la fiche ne changent pas.
  }, [apercu, jeton]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void charger();
  }, [charger]);

  const envoyer = async (saisie: SaisieCheckin): Promise<{ erreurs?: ErreurCheckin[]; message?: string } | null> => {
    if (MODE_DEMO) {
      if (!demo) return { message: t.erreur };
      const tous = checkinsDemo();
      const precedent = tous[demo.reservation.id];
      // Comme le serveur : « garder les fiches » les reprend du check-in gardé.
      const relu = lireSaisieCheckin(saisie, { maxPersonnes: MAX_VOYAGEURS, aujourdhui: AUJOURDHUI, arrivee: demo.reservation.arrivee, ...(precedent?.fiches?.length ? { fichesPrecedentes: precedent.fiches } : {}) });
      if (!relu.ok) return { erreurs: relu.erreurs, message: t.verifier };
      const r = nouveauCheckin(precedent, relu.saisie, { reservation: demo.reservation, langue, maintenant: horodatageMaintenant(), aujourdhui: AUJOURDHUI });
      if (!r.ok) return { message: MESSAGES_REFUS_CHECKIN[r.raison][langue] };
      if (!garderCheckinDemo(r.checkin)) return { message: t.erreur };
      setEtat({ nom: 'pret', vue: vueDemo(demo) });
      return null;
    }
    const r = await appeler({ action: 'checkin', jeton, langue, checkin: saisie });
    if (r.statut === 200 && r.json.vue) {
      setEtat({ nom: 'pret', vue: r.json.vue as VueSejour });
      return null;
    }
    if (r.statut === 0) return { message: t.erreurReseau };
    return { erreurs: Array.isArray(r.json.erreurs) ? (r.json.erreurs as ErreurCheckin[]) : [], message: String(r.json.erreur ?? t.erreur) };
  };

  const bandeau = MODE_DEMO && demo ? <p className="border-b border-(--lm-bord) bg-(--lm-surface-2) px-4 py-2 text-center text-[12.5px] font-medium text-(--lm-encre)">Démonstration · séjour de {demo.reservation.voyageur.nom}</p> : undefined;

  return (
    <div className="erp-root" lang={langue}>
      <Helmet>
        <html lang={langue} />
        <title>{etat.nom === 'pret' ? `${t.titrePage} · ${etat.vue.conciergerie}` : t.titrePage}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      {etat.nom === 'pret' ? (
        <LivretSejour vue={etat.vue} langue={langue} onLangue={changerLangue} aujourdhui={AUJOURDHUI} onEnvoyer={envoyer} bandeau={bandeau} />
      ) : etat.nom === 'message' ? (
        <div className="grid min-h-screen place-items-center bg-(--lm-fond) px-4 py-10">
          <div className="w-full max-w-sm">
            {etat.conciergerie && <EnteteMarque nom={etat.conciergerie} />}
            <Card className="w-full p-6 text-center">
              <p className="text-[15px] text-(--lm-encre-2)">{etat.texte}</p>
              {etat.reessayer && (
                <Button variant="secondary" className="mt-4" onClick={() => void charger()}>
                  {t.reessayer}
                </Button>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-20" aria-busy="true" aria-label={t.chargement}>
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}
