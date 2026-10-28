/**
 * Livret d'accueil du voyageur (/sejour) : une seule colonne, pensée pour le
 * téléphone. Bienvenue et dates, check-in en ligne, accès et wifi (ou
 * « Code communiqué dans les 48 heures avant l'arrivée »), adresse,
 * règlement, à savoir, guides, départ, et comment nous écrire. Pendant le
 * séjour, l'accès passe avant le check-in ; après, il n'est plus montré.
 * Tout vient de la vue du serveur (data/sejour.ts, vueSejour) : la page ne
 * décide jamais seule d'afficher un code.
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  BookOpen,
  CalendarDays,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Image,
  Info,
  KeyRound,
  Link2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PlayCircle,
  ScrollText,
  TrainFront,
  Wifi,
} from 'lucide-react';
import { Button, Card, classesBouton, cn } from '../ui';
import { MESSAGES_REFUS_CHECKIN, type ErreurCheckin, type GuideSejour, type LangueSejour, type SaisieCheckin, type VueSejour } from '../data/sejour';
import { FormulaireCheckin } from './FormulaireCheckin';
import { TEXTES, dateCourteSejour, dateLongueSejour, jourHorodatage, texteConsignes, texteFiche } from './textes';

export interface LivretSejourProps {
  vue: VueSejour;
  langue: LangueSejour;
  onLangue: () => void;
  aujourdhui: string;
  onEnvoyer: (saisie: SaisieCheckin) => Promise<{ erreurs?: ErreurCheckin[]; message?: string } | null>;
  /** Bandeau au-dessus de l'en-tête (démonstration). */
  bandeau?: ReactNode;
}

/** Une rubrique du livret : une carte, son icône et son titre. */
function Rubrique({ icone, titre, children, id, className }: { icone: ReactNode; titre: string; children: ReactNode; id?: string; className?: string }) {
  return (
    <Card className={cn('scroll-mt-20', className)} {...(id ? { id } : {})}>
      <h2 className="mb-3 flex items-center gap-2 text-[16px] font-semibold text-(--lm-encre) [&_svg]:size-[18px] [&_svg]:text-(--lm-or-texte)">
        <span aria-hidden>{icone}</span>
        {titre}
      </h2>
      {children}
    </Card>
  );
}

/** Texte écrit par l'équipe, retours à la ligne gardés. */
const Texte = ({ children }: { children: string }) => <p className="text-[15px] leading-relaxed whitespace-pre-line text-(--lm-encre-2)">{children}</p>;

function BoutonCopier({ valeur, libelle, langue }: { valeur: string; libelle: string; langue: LangueSejour }) {
  const t = TEXTES[langue];
  const [copie, setCopie] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icone={copie ? <CheckCircle2 /> : <Copy />}
        aria-label={`${t.copier} : ${libelle}`}
        onClick={() => {
          void navigator.clipboard?.writeText(valeur).then(
            () => {
              setCopie(true);
              setTimeout(() => setCopie(false), 2000);
            },
            () => undefined,
          );
        }}
      >
        {copie ? t.copie : t.copier}
      </Button>
      {/* Annoncé aux lecteurs d'écran : le libellé du bouton change, sans focus déplacé. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copie ? `${libelle} : ${t.copie}` : ''}
      </span>
    </>
  );
}

const ICONES_GUIDE: Record<GuideSejour['type'], ReactNode> = { video: <PlayCircle />, photo: <Image />, document: <FileText />, lien: <Link2 /> };

function ListeGuides({ guides, langue }: { guides: GuideSejour[]; langue: LangueSejour }) {
  const t = TEXTES[langue];
  return (
    <ul className="-mx-2 flex flex-col">
      {guides.map((g) => (
        <li key={g.id}>
          <a
            href={g.lien}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
          >
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-(--lm-or-lavis) text-(--lm-or-texte) [&_svg]:size-4">
              {ICONES_GUIDE[g.type]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-(--lm-encre)">{g.titre}</span>
              <span className="block text-[12.5px] text-(--lm-encre-3)">{t.typesGuide[g.type]}</span>
            </span>
            <ExternalLink className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function LivretSejour({ vue, langue, onLangue, aujourdhui, onEnvoyer, bandeau }: LivretSejourProps) {
  const t = TEXTES[langue];
  const l = vue.logement;
  const c = vue.checkin;
  const [edition, setEdition] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const carteCheckin = useRef<HTMLDivElement>(null);
  const tx = (s: string) => texteFiche(s, langue);

  const envoyer = async (saisie: SaisieCheckin) => {
    const r = await onEnvoyer(saisie);
    if (!r) {
      setEdition(false);
      setEnvoye(true);
      carteCheckin.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    return r;
  };

  const conditions = l.conditions;
  const lignesConditions = [
    conditions?.fetes !== undefined ? t.fetes(conditions.fetes) : '',
    conditions?.fumeur !== undefined ? t.fumeur(conditions.fumeur) : '',
    conditions?.animaux !== undefined ? t.animaux(conditions.animaux) : '',
    conditions?.calme ? t.calme(conditions.calme.debut, conditions.calme.fin) : '',
  ].filter(Boolean);
  const reglement = !!l.regles || lignesConditions.length > 0;
  const voirReglement = reglement ? () => document.getElementById('reglement')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) : undefined;
  const montrerCheckin = c.ouvert && (c.fait || c.modifiable);
  // Le titre de l'annonce ; sans titre, la ville (jamais le nom interne du logement).
  const nomLogement = l.nom || l.ville || t.votreLogement;

  const carteCheckinEl = montrerCheckin && (
    <div ref={carteCheckin} className="scroll-mt-20">
      <Card className={cn(!c.fait && !edition && 'border-(--lm-or-anneau)')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-(--lm-encre)">
              <ClipboardCheck className="size-[18px] text-(--lm-or-texte)" aria-hidden />
              {t.checkinTitre}
            </h2>
            {c.fait ? (
              <p role="status" className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[14px] text-(--lm-encre-2)">
                <span className="inline-flex items-center gap-1 font-medium text-(--lm-succes-texte)">
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t.checkinFait}
                </span>
                {envoye ? <span>{t.merci}</span> : c.envoyeLe && <span>{t.checkinEnvoye(jourHorodatage(c.envoyeLe, langue))}</span>}
              </p>
            ) : (
              !edition && <p className="mt-1 text-[14px] text-(--lm-encre-2)">{vue.moment === 'pendant' ? t.checkinEnCours : t.checkinAFaire}</p>
            )}
            {c.fait && c.raison === 'limite' && <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">{MESSAGES_REFUS_CHECKIN.limite[langue]}</p>}
          </div>
          {c.fait && c.modifiable && !edition && (
            <Button variant="secondary" size="sm" onClick={() => setEdition(true)}>
              {t.modifier}
            </Button>
          )}
        </div>
        {!c.fait && c.modifiable && !edition && (
          <Button variant="primary" size="lg" className="mt-4 w-full sm:w-auto" onClick={() => setEdition(true)}>
            {t.faireCheckin}
          </Button>
        )}
        {edition && (
          <div className="mt-4 border-t border-(--lm-bord) pt-4">
            <FormulaireCheckin vue={vue} langue={langue} aujourdhui={aujourdhui} onEnvoyer={envoyer} onAnnuler={() => setEdition(false)} onVoirReglement={voirReglement} />
          </div>
        )}
      </Card>
    </div>
  );

  // Après le départ, plus d'accès du tout ; le jour du départ, le code reste celui de l'arrivée.
  const carteAcces = vue.moment !== 'apres' && (
    <Rubrique icone={<KeyRound />} titre={t.accesTitre}>
      {vue.acces.visible ? (
        <div className="flex flex-col gap-4">
          {vue.acces.texte && <Texte>{vue.acces.texte}</Texte>}
          {vue.acces.wifi && (
            <div className="rounded-lg bg-(--lm-surface-2) p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-(--lm-encre-2)">
                <Wifi className="size-4" aria-hidden />
                {t.wifi}
              </p>
              <dl className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <dt className="text-[12px] text-(--lm-encre-3)">{t.reseau}</dt>
                    <dd className="truncate font-mono text-[15px] text-(--lm-encre)">{vue.acces.wifi.nom}</dd>
                  </div>
                  <BoutonCopier valeur={vue.acces.wifi.nom} libelle={t.reseau} langue={langue} />
                </div>
                {vue.acces.wifi.code && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <dt className="text-[12px] text-(--lm-encre-3)">{t.motDePasse}</dt>
                      <dd className="font-mono text-[15px] break-all text-(--lm-encre)">{vue.acces.wifi.code}</dd>
                    </div>
                    <BoutonCopier valeur={vue.acces.wifi.code} libelle={t.motDePasse} langue={langue} />
                  </div>
                )}
              </dl>
            </div>
          )}
          {vue.acces.guides.length > 0 && <ListeGuides guides={vue.acces.guides} langue={langue} />}
        </div>
      ) : vue.acces.aPartirDu ? (
        <div className="flex items-start gap-3 rounded-lg bg-(--lm-surface-2) p-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
          <div>
            <p className="text-[15px] font-medium text-(--lm-encre)">{t.codeAttente}</p>
            <p className="mt-0.5 text-[13.5px] text-(--lm-encre-2)">{t.codeAttenteDate(dateLongueSejour(vue.acces.aPartirDu, langue))}</p>
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-(--lm-encre-2)">{t.accesJourDepart}</p>
      )}
    </Rubrique>
  );

  return (
    <div className="min-h-screen bg-(--lm-fond)">
      {bandeau}
      <header className="sticky top-0 z-20 border-b border-(--lm-bord) bg-(--lm-surface)/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between gap-3 px-4">
          <p className="lm-serif min-w-0 truncate text-[18px] leading-tight text-(--lm-brun)">{vue.conciergerie}</p>
          <Button variant="secondary" size="sm" onClick={onLangue} lang={langue === 'fr' ? 'en' : 'fr'} aria-label={t.langue} className="font-semibold">
            {t.langueCode}
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 pt-4 pb-12">
        {l.photo && <img src={l.photo} alt="" className="aspect-[16/10] w-full rounded-xl bg-(--lm-surface-2) object-cover" />}

        <section className="px-1 pt-1">
          <p className="text-[13px] font-medium tracking-wide text-(--lm-or-texte) uppercase">{t.titrePage}</p>
          <h1 className="lm-serif mt-1 text-[30px] leading-tight text-(--lm-encre)">{t.bonjour(vue.prenom)}</h1>
          <p className="mt-1 text-[16px] text-(--lm-encre-2)">{nomLogement}</p>
          {vue.moment === 'apres' && <p className="mt-2 text-[15px] text-(--lm-encre-2)">{t.apres}</p>}
        </section>

        <Card>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-[12.5px] text-(--lm-encre-3)">{t.arrivee}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-(--lm-encre) first-letter:uppercase">{dateCourteSejour(vue.arrivee, langue)}</dd>
              {l.heureArrivee && <dd className="text-[14px] text-(--lm-encre-2)">{t.des(l.heureArrivee)}</dd>}
            </div>
            <div>
              <dt className="text-[12.5px] text-(--lm-encre-3)">{t.depart}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold text-(--lm-encre) first-letter:uppercase">{dateCourteSejour(vue.depart, langue)}</dd>
              {l.heureDepart && <dd className="text-[14px] text-(--lm-encre-2)">{t.avant(l.heureDepart)}</dd>}
            </div>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 border-t border-(--lm-bord) pt-3 text-[13.5px] text-(--lm-encre-2)">
            <CalendarDays className="size-4 text-(--lm-encre-3)" aria-hidden />
            {t.nuits(vue.nuits)} · {t.voyageurs(vue.voyageurs)}
          </p>
        </Card>

        {/* Sur place, l'accès compte le plus : il passe avant le check-in. */}
        {vue.moment === 'pendant' ? (
          <>
            {carteAcces}
            {carteCheckinEl}
          </>
        ) : (
          <>
            {carteCheckinEl}
            {carteAcces}
          </>
        )}

        {(l.adresse || l.parking || l.transports) && (
          <Rubrique icone={<MapPin />} titre={t.adresseTitre}>
            <div className="flex flex-col gap-4">
              {l.adresse && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="min-w-0 text-[15px] text-(--lm-encre)">{l.adresse}</p>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.adresse)}`} target="_blank" rel="noopener noreferrer" className={classesBouton('secondary', 'md')}>
                    <MapPin aria-hidden />
                    {t.itineraire}
                  </a>
                </div>
              )}
              {l.parking && (
                <div>
                  <p className="mb-0.5 flex items-center gap-1.5 text-[13px] font-medium text-(--lm-encre-2)">
                    <Car className="size-4" aria-hidden />
                    {t.parking}
                  </p>
                  <Texte>{tx(l.parking)}</Texte>
                </div>
              )}
              {l.transports && (
                <div>
                  <p className="mb-0.5 flex items-center gap-1.5 text-[13px] font-medium text-(--lm-encre-2)">
                    <TrainFront className="size-4" aria-hidden />
                    {t.transports}
                  </p>
                  <Texte>{tx(l.transports)}</Texte>
                </div>
              )}
            </div>
          </Rubrique>
        )}

        {reglement && (
          <Rubrique icone={<ScrollText />} titre={t.reglesTitre} id="reglement">
            <div className="flex flex-col gap-3">
              {l.regles && <Texte>{tx(l.regles)}</Texte>}
              {lignesConditions.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {lignesConditions.map((x) => (
                    <li key={x} className="flex items-center gap-2 text-[15px] text-(--lm-encre-2)">
                      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--lm-or)" />
                      {x}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Rubrique>
        )}

        {(l.aSavoir || l.questions.length > 0) && (
          <Rubrique icone={<Info />} titre={t.aSavoirTitre}>
            <div className="flex flex-col gap-3">
              {l.aSavoir && <Texte>{tx(l.aSavoir)}</Texte>}
              {l.questions.length > 0 && (
                <div>
                  {l.aSavoir && <p className="mb-1 text-[13px] font-medium text-(--lm-encre-2)">{t.questionsTitre}</p>}
                  <ul className="divide-y divide-(--lm-bord) border-y border-(--lm-bord)">
                    {l.questions.map((q) => (
                      <li key={q.question}>
                        <details className="group">
                          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-[15px] text-(--lm-encre) [&::-webkit-details-marker]:hidden">
                            {tx(q.question)}
                            <span aria-hidden className="text-[18px] text-(--lm-encre-3) transition-transform group-open:rotate-45">
                              +
                            </span>
                          </summary>
                          <div className="pb-3">
                            <Texte>{tx(q.reponse)}</Texte>
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Rubrique>
        )}

        {vue.guides.length > 0 && (
          <Rubrique icone={<BookOpen />} titre={t.guidesTitre}>
            <ListeGuides guides={vue.guides} langue={langue} />
          </Rubrique>
        )}

        {/* L'heure de départ est déjà dans la carte des dates : ici, seulement les consignes. */}
        <Rubrique icone={<LogOut />} titre={t.departTitre}>
          <Texte>{l.consignesDepart ? texteConsignes(l.consignesDepart, langue) : t.departDefaut}</Texte>
        </Rubrique>

        {(vue.contact.plateforme || vue.contact.email || vue.contact.telephone) && (
          <Rubrique icone={<MessageCircle />} titre={t.aideTitre}>
            {vue.contact.plateforme ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[15px] text-(--lm-encre-2)">{t.aidePlateforme(vue.contact.plateforme)}</p>
                {vue.contact.lien && (
                  <a href={vue.contact.lien} target="_blank" rel="noopener noreferrer" className={classesBouton('secondary', 'lg')}>
                    <MessageCircle aria-hidden />
                    {t.ouvrir(vue.contact.plateforme)}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                <p className="text-[15px] text-(--lm-encre-2)">{t.aideDirect}</p>
                <div className="flex flex-wrap gap-2">
                  {vue.contact.telephone && (
                    <a href={`tel:${vue.contact.telephone.replace(/[^\d+]/g, '')}`} className={classesBouton('secondary', 'lg')}>
                      <Phone aria-hidden />
                      {t.appeler}
                    </a>
                  )}
                  {vue.contact.email && (
                    <a href={`mailto:${vue.contact.email}`} className={classesBouton('secondary', 'lg')}>
                      <Mail aria-hidden />
                      {t.ecrireEmail}
                    </a>
                  )}
                </div>
              </div>
            )}
          </Rubrique>
        )}

        <footer className="flex flex-col items-center gap-1 px-2 pt-2 text-center text-[12.5px] text-(--lm-encre-3)">
          <p>{t.lienPerso}</p>
          <a href="/politique-de-confidentialite" className="inline-flex min-h-8 items-center underline-offset-2 hover:underline">
            {t.confidentialiteLien}
          </a>
        </footer>
      </main>
    </div>
  );
}
