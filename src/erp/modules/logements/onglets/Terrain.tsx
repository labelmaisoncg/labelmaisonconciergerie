/**
 * « Terrain » : ce que l'équipe doit savoir sur place, en trois cartes —
 * ménage et linge (dotation, durée, produits, consignes), qui appeler
 * (contacts du logement, puis les responsables rattachés qui ont un numéro)
 * et les repères techniques (compteurs, disjoncteur, chaudière…). Rien d'ici
 * ne part aux voyageurs, à l'agent IA ni au propriétaire (data/terrain.ts).
 *
 * Les champs vides ne s'affichent pas ; une carte sans rien montre une
 * phrase et « Compléter », qui ouvre la modification à la bonne section.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { Button, Card, CardHeader } from '../../../ui';
import { useErp } from '../../../data/store';
import { quiSuit, ROLES_OPERATIONS } from '../../../data/operations';
import { CHAMPS_MENAGE, CHAMPS_TECHNIQUE, LIBELLE_ROLE_CONTACT, contactsRenseignes, lienTelephone, menageRenseigne, techniqueRenseignee } from '../../../data/terrain';
import type { Logement } from '../../../data/types';

/** Section de la modification qu'un « Compléter » ouvre. */
export type SectionTerrain = 'menage' | 'contacts' | 'technique';

interface Props {
  logement: Logement;
  /** Ouvre la modification du logement à cette section (absent : lecture seule). */
  onCompleter?: (section: SectionTerrain) => void;
}

const lien = 'inline-flex min-h-8 items-center gap-1 text-[13px] font-medium lm-lien';

/** Un repère court : libellé à largeur fixe, valeur à gauche (lisible même sur plusieurs lignes). */
function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-[13.5px]">
      <dt className="w-32 shrink-0 text-(--lm-encre-2) sm:w-36">{libelle}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words whitespace-pre-line text-(--lm-encre)">{children}</dd>
    </div>
  );
}

/** Un texte long : libellé au-dessus, texte en dessous, à gauche. */
function Bloc({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="py-2 first:pt-0">
      <dt className="text-[12.5px] text-(--lm-encre-2)">{libelle}</dt>
      <dd className="mt-0.5 text-[13.5px] leading-relaxed font-medium break-words whitespace-pre-line text-(--lm-encre)">{children}</dd>
    </div>
  );
}

/** Carte vide : une phrase et « Compléter » (si l'on peut modifier) ; 44 px au toucher. */
function Vide({ texte, section, onCompleter }: { texte: string; section: SectionTerrain; onCompleter?: (s: SectionTerrain) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[13.5px] text-(--lm-encre-2)">{texte}</p>
      {onCompleter && (
        <Button size="sm" className="max-sm:min-h-11" onClick={() => onCompleter(section)}>
          Compléter
        </Button>
      )}
    </div>
  );
}

/** Lien discret « Compléter » en tête de carte, quand elle est vide ou presque (un seul champ rempli). */
function Completer({ section, onCompleter }: { section: SectionTerrain; onCompleter?: (s: SectionTerrain) => void }) {
  if (!onCompleter) return null;
  return (
    <button type="button" onClick={() => onCompleter(section)} className={lien}>
      Compléter
    </button>
  );
}

export function OngletTerrain({ logement: l, onCompleter }: Props) {
  return (
    <>
      <p className="mb-5 max-w-3xl text-[13.5px] text-(--lm-encre-2)">
        Ce que l’équipe doit savoir sur place. Rien d’ici n’est transmis aux voyageurs, à votre agent ni au propriétaire.
      </p>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <MenageEtLinge logement={l} onCompleter={onCompleter} />
        <QuiAppeler logement={l} onCompleter={onCompleter} />
        <Technique logement={l} onCompleter={onCompleter} />
      </div>
    </>
  );
}

/* --------------------------------------------------------- ménage et linge */

function MenageEtLinge({ logement: l, onCompleter }: Props) {
  const d = useErp();
  const m = l.menage;
  const menage = menageRenseigne(m);
  const dotation = l.dotationLinge.filter((x) => x.article.trim() && x.quantite > 0);
  // Page Linge : seulement si du linge de ce logement y est déjà suivi.
  const lingeSuivi = d.mouvementsLinge.some((x) => x.logementId === l.id);
  const vide = !menage && dotation.length === 0;
  return (
    <Card>
      <CardHeader
        titre="Ménage et linge"
        actions={
          vide ? undefined : (
            <span className="flex items-center gap-3">
              {!menage && <Completer section="menage" onCompleter={onCompleter} />}
              {lingeSuivi && (
                <Link to={`/erp/linge?logement=${encodeURIComponent(l.id)}`} className={lien}>
                  Linge <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </span>
          )
        }
      />
      {vide ? (
        <Vide texte={'Durée, produits et consignes du ménage : rien de noté pour l’instant.'} section="menage" onCompleter={onCompleter} />
      ) : (
        <>
          {menage && (
            <dl className="divide-y divide-(--lm-bord)">
              {CHAMPS_MENAGE.filter((c) => m?.[c.cle]?.trim()).map((c) => (
                <Bloc key={c.cle} libelle={c.libelle}>
                  {m![c.cle]}
                </Bloc>
              ))}
            </dl>
          )}
          {dotation.length > 0 && (
            <div className={menage ? 'mt-4 border-t border-(--lm-bord) pt-3' : ''}>
              <p className="mb-1.5 text-[13px] font-semibold text-(--lm-encre)">Dotation de linge</p>
              <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-1">
                {dotation.map((x) => (
                  <li key={x.article} className="flex items-baseline justify-between gap-3 py-1 text-[13.5px]">
                    <span className="min-w-0 truncate text-(--lm-encre-2)">{x.article}</span>
                    <span className="lm-chiffres shrink-0 font-medium text-(--lm-encre)">× {x.quantite}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* --------------------------------------------------------------- contacts */

function Telephone({ nom, telephone }: { nom: string; telephone?: string }) {
  const href = lienTelephone(telephone);
  if (!telephone?.trim()) return null;
  if (!href) return <span className="lm-chiffres shrink-0 text-[13px] text-(--lm-encre-2)">{telephone}</span>;
  return (
    <a
      href={href}
      aria-label={`Appeler ${nom}`}
      className="lm-chiffres inline-flex min-h-8 shrink-0 items-center gap-1.5 text-[13px] font-medium whitespace-nowrap text-(--lm-encre) hover:underline max-sm:min-h-11"
    >
      <Phone className="size-3.5 shrink-0 text-(--lm-encre-2)" aria-hidden />
      {telephone}
    </a>
  );
}

function QuiAppeler({ logement: l, onCompleter }: Props) {
  const d = useErp();
  const contacts = contactsRenseignes(l.contacts);
  // Les responsables rattachés (Paramètres → Accès) restent où ils sont ; repris ici, en lecture, s'ils ont un numéro.
  const equipe = quiSuit(d.donnees.equipe, l.id)
    .filter((m) => lienTelephone(m.telephone))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (contacts.length === 0 && equipe.length === 0) {
    return (
      <Card>
        <CardHeader titre="Qui appeler" />
        <Vide texte="Ménage, serrurier, urgence… personne de noté pour l’instant." section="contacts" onCompleter={onCompleter} />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader titre="Qui appeler" actions={contacts.length === 0 ? <Completer section="contacts" onCompleter={onCompleter} /> : undefined} />
      {contacts.length > 0 && (
        <ul className="divide-y divide-(--lm-bord)">
          {contacts.map((c, i) => (
            <li key={`${c.role}-${c.nom}-${i}`} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-(--lm-encre-2)">{LIBELLE_ROLE_CONTACT[c.role] ?? LIBELLE_ROLE_CONTACT.autre}</span>
                <span className="block text-[13.5px] font-semibold text-(--lm-encre)">{c.nom}</span>
                {c.note?.trim() && <span className="block text-[12.5px] text-(--lm-encre-2)">{c.note}</span>}
              </span>
              <Telephone nom={c.nom} telephone={c.telephone} />
            </li>
          ))}
        </ul>
      )}
      {equipe.length > 0 && (
        <div className={contacts.length ? 'mt-3 border-t border-(--lm-bord) pt-3' : ''}>
          <p className="mb-1 text-[12px] font-medium text-(--lm-encre-2)">Équipe rattachée</p>
          <ul className="divide-y divide-(--lm-bord)">
            {equipe.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-(--lm-encre)">{m.nom}</span>
                  <span className="block text-[12.5px] text-(--lm-encre-2)">{ROLES_OPERATIONS[m.role]}</span>
                </span>
                <Telephone nom={m.nom} telephone={m.telephone} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------- technique */

function Technique({ logement: l, onCompleter }: Props) {
  const t = l.technique;
  const lignes = CHAMPS_TECHNIQUE.filter((c) => t?.[c.cle]?.trim());
  const notes = t?.notes?.trim();
  // Presque vide (un seul repère) : « Compléter » en tête ; au-delà, « Modifier » en haut de page suffit.
  const presqueVide = techniqueRenseignee(t) && lignes.length + (notes ? 1 : 0) <= 1;
  return (
    <Card>
      {/* « Jamais transmis aux voyageurs » : déjà dit par l'introduction de l'onglet, pas répété ici. */}
      <CardHeader titre="Technique" actions={presqueVide ? <Completer section="technique" onCompleter={onCompleter} /> : undefined} />
      {!techniqueRenseignee(t) ? (
        <Vide texte={'Compteurs, disjoncteur, chaudière, arrivée d’eau : rien de noté pour l’instant.'} section="technique" onCompleter={onCompleter} />
      ) : (
        <>
          {lignes.length > 0 && (
            <dl className="divide-y divide-(--lm-bord)">
              {lignes.map((c) => (
                <Ligne key={c.cle} libelle={c.libelle}>
                  {t![c.cle]}
                </Ligne>
              ))}
            </dl>
          )}
          {notes && (
            <div className={lignes.length ? 'mt-3 border-t border-(--lm-bord) pt-3' : ''}>
              <p className="mb-1 text-[13px] font-semibold text-(--lm-encre)">Notes</p>
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre-2)">{notes}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
