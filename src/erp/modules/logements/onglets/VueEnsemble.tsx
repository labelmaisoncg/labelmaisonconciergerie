import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BedDouble, ExternalLink, Mail, Phone, Sofa, X } from 'lucide-react';
import { ETAPES_DOSSIER } from '../../../data/dossier-proprietaire';
import { FormProprietaire } from '../../proprietaires/FormProprietaire';
import { FormMandat } from '../../mandats/FormMandat';
import { Badge, Button, Card, CardHeader, EmptyState, FicheEtapes, Field, IconButton, Input, Repli } from '../../../ui';
import { GraphiqueCourbe } from '../../../ui/Graphiques';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from '../../../data/repull';
import { AUJOURDHUI, SANS_DONNEE, dateCourte, dateHeure, euros, horodatageMaintenant, jourMois, note, pluriel, pourcentage } from '../../../data/format';
import { estActive, nuitsAnnee, proprietaireById } from '../../../data/selectors';
import type { Canal, DescriptifLogement, Logement } from '../../../data/types';
import { CompteurNuits } from '../_composants/CompteurNuits';
import { Galerie } from '../_composants/Galerie';
import { SansPhoto } from '../_composants/SansPhoto';
import { AjouterPhotos, LienAirbnb, OrganiserPhotos } from '../_composants/PhotosEquipe';
import { CarteEspaceProprietaire } from '../_composants/EspaceProprietaireGerant';
import { ResponsablesLogement } from '../_composants/ResponsablesLogement';
import { mandatDuProprietaire } from '../../../data/acces-gerant';
import { IncidentsLogement } from '../_composants/IncidentsLogement';
import { idAirbnbDuLogement } from '../../../data/page-airbnb';
import { photosLogement, prixAVenir, statsLogement } from '../_composants/stats';
import { previsionLogement } from '../../../data/previsionnel';
import { CartePrevisionnel, TITRE_PREVISIONNEL } from '../_composants/Previsionnel';
import { PrixConseilles } from '../_composants/PrixConseilles';
import { CarteAvisLogement } from '../_composants/Avis';

const PLATEFORME: Record<Canal, string> = { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'Site direct' };

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13.5px]">
      <dt className="shrink-0 text-(--lm-encre-2)">{libelle}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-(--lm-encre)">{children}</dd>
    </div>
  );
}

// Zone de toucher de 32 px ; les marges négatives gardent la hauteur de la ligne.
const lien = '-my-1.5 inline-flex min-h-8 items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline';

/** Trois repères dans une seule carte, côte à côte même sur téléphone. */
function Chiffres({ elements }: { elements: { libelle: string; valeur: string; detail?: string }[] }) {
  return (
    <Card flush>
      <dl className="grid grid-cols-3 divide-x divide-(--lm-bord)">
        {elements.map((e) => (
          <div key={e.libelle} className="min-w-0 px-3 py-3.5 sm:px-5 sm:py-4">
            <dt className="truncate text-[12px] font-medium text-(--lm-encre-2) sm:text-[12.5px]">{e.libelle}</dt>
            <dd className="lm-chiffres mt-1 text-[19px] leading-tight font-semibold text-(--lm-encre) sm:text-[22px]">{e.valeur}</dd>
            {e.detail && <dd className="mt-0.5 truncate text-[11.5px] text-(--lm-encre-3)">{e.detail}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Aperçu d'un logement, comme dans un channel manager : photos, trois
 * repères, les prochains séjours et les prix lus sur les plateformes ; à
 * côté, le propriétaire, le logement et ses annonces.
 */
export function OngletVueEnsemble({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const s = statsLogement(d, l);
  const prix = prixAVenir(l);
  const prevision = previsionLogement(l, d.reservations, AUJOURDHUI);
  const resas = d.reservations
    .filter((r) => r.logementId === l.id && estActive(r) && r.depart >= AUJOURDHUI)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
    .slice(0, 5);
  const desc = l.descriptif;
  // Le couchage de l'annonce (pièce par pièce) remplace la ligne saisie à la main.
  const lits = desc?.couchage?.length ? '' : l.lits.map((x) => `${x.nombre} ${LIBELLES.typeLit[x.type].toLowerCase()}`).join(', ');
  const jours = (l.tarifs?.jours ?? []).filter((j) => j.date >= AUJOURDHUI).slice(0, 60);
  const importe = !!l.repull?.majLe || l.id.startsWith('repull-');
  const bas = jours.length ? Math.min(...jours.map((j) => j.prixCentimes)) : 0;
  const haut = jours.length ? Math.max(...jours.map((j) => j.prixCentimes)) : 0;

  return (
    <>
      {photosLogement(l).length ? (
        <>
          <Galerie photos={photosLogement(l)} nom={l.nom} />
          {!d.lectureSeule && (
            <div className="-mt-3 mb-5 flex flex-wrap justify-end gap-2">
              <OrganiserPhotos logement={l} />
              <AjouterPhotos logement={l} />
            </div>
          )}
        </>
      ) : (
        <SansPhoto logement={l} />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Chiffres
            elements={[
              {
                libelle: 'Prix par nuit',
                valeur: prix ? euros(prix.moyen, true) : s.adr90 ? euros(s.adr90, true) : SANS_DONNEE,
                detail: prix ? '30 j à venir' : s.adr90 ? 'constaté, 90 j' : undefined,
              },
              { libelle: 'Occupation', valeur: pourcentage(s.occupation30), detail: '30 derniers j' },
              { libelle: 'Note', valeur: s.note === undefined ? SANS_DONNEE : `${note(s.note)} / 5`, detail: s.note === undefined ? undefined : '12 mois' },
            ]}
          />
          {prevision && <CartePrevisionnel prevision={prevision} titre={TITRE_PREVISIONNEL} />}
          <PrixConseilles logement={l} />

          <IncidentsLogement logement={l} />
          <Card flush>
            <div className="p-4 pb-0 sm:p-5 sm:pb-0">
              <CardHeader
                titre="Prochains séjours"
                actions={
                  <Link to={`/erp/reservations?logement=${l.id}`} className={lien}>
                    Planning <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                }
              />
            </div>
            {resas.length === 0 ? (
              <EmptyState className="m-4 mt-0" titre="Aucun séjour à venir." />
            ) : (
              <ul className="divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
                {resas.map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/erp/reservations/${r.id}`}
                      className="flex items-center gap-x-4 px-4 py-2.5 hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none focus-visible:ring-inset sm:px-5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium text-(--lm-encre)">{r.voyageur.nom}</span>
                        <span className="block text-[12px] text-(--lm-encre-2)">
                          {r.arrivee === AUJOURDHUI
                            ? `Arrive aujourd’hui, jusqu’au ${jourMois(r.depart)}`
                            : r.depart === AUJOURDHUI
                              ? 'Part aujourd’hui'
                              : r.arrivee < AUJOURDHUI
                                ? `Sur place jusqu’au ${jourMois(r.depart)}`
                                : `Du ${jourMois(r.arrivee)} au ${jourMois(r.depart)}`} · {pluriel(r.nuits, 'nuit')} ·{' '}
                          {LIBELLES.canal[r.canal]}
                        </span>
                      </span>
                      <span className="lm-chiffres shrink-0 text-[13.5px] font-medium text-(--lm-encre)">{euros(r.montantBrutCentimes, true)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <CarteAvisLogement logement={l} />

          {desc && <Annonce descriptif={desc} />}

          {!!desc?.couchage?.length && <Couchage pieces={desc.couchage} />}

          {((jours.length > 1 && prix) || desc?.prix) && (
            <Card>
              {jours.length > 1 && prix ? (
                <>
                  <CardHeader
                    titre="Prix des prochaines semaines"
                    description={`De ${euros(bas, true)} à ${euros(haut, true)} par nuit sur ${jours.length} jours · lus sur les plateformes le ${dateHeure(prix.luLe)}`}
                  />
                  <GraphiqueCourbe
                    label={`Prix par nuit des ${jours.length} prochains jours, de ${euros(bas, true)} à ${euros(haut, true)}`}
                    points={jours.map((j) => ({ libelle: jourMois(j.date), valeur: j.prixCentimes }))}
                    formater={(v) => `${euros(v, true)} la nuit`}
                    formaterAxe={(v) => euros(v, true)}
                    domaine={[0, 'auto']}
                    paliers
                    hauteur={180}
                  />
                </>
              ) : (
                <CardHeader titre="Prix" description="Prix de base de l’annonce, lus sur les plateformes" />
              )}
              {desc?.prix && <PrixDeBase prix={desc.prix} frais={desc.frais ?? []} separe={jours.length > 1 && !!prix} />}
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Proprietaire logement={l} />
          <ResponsablesLogement logement={l} />

          <Card>
            <CardHeader titre="Le logement" />
            <dl className="divide-y divide-(--lm-bord)">
              <Ligne libelle="Adresse">
                {l.adresse ? `${l.adresse}, ${l.codePostal} ${l.ville}`.replace(/^, |, $/, '') : l.ville}
              </Ligne>
              {lits && <Ligne libelle="Couchage">{lits}</Ligne>}
              {l.surfaceM2 > 0 && <Ligne libelle="Surface">{l.surfaceM2} m²</Ligne>}
              {!!desc?.sallesDeBain && <Ligne libelle="Salles de bain">{String(desc.sallesDeBain).replace('.', ',')}</Ligne>}
              <Ligne libelle="Arrivée · départ">
                {l.fiche.heureArrivee || '—'} · {l.fiche.heureDepart || '—'}
              </Ligne>
              <Ligne libelle="Accès">{desc?.conditions?.arrivee ?? LIBELLES.serrure[l.serrure]}</Ligne>
            </dl>
          </Card>

          {desc && <Conditions descriptif={desc} />}

          <Card>
            <CardHeader titre="Plateformes" />
            {l.annonces.length === 0 ? (
              <p className="text-[13.5px] text-(--lm-encre-2)">Aucune annonce reliée.</p>
            ) : (
              <ul className="space-y-2">
                {l.annonces.map((a) => {
                  // Lien Airbnb saisi par l'équipe (pas une annonce reliée) : on peut le retirer.
                  const saisi = a.canal === 'airbnb' && !a.connecte && !(l.repull?.canaux ?? []).some((c) => /airbnb/i.test(c.plateforme));
                  return (
                    <li key={a.canal} className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="flex items-center gap-2">
                        <span className="font-medium text-(--lm-encre)">{PLATEFORME[a.canal] ?? a.canal}</span>
                        {saisi ? (
                          <span className="text-[12.5px] text-(--lm-encre-2)">Lien ajouté</span>
                        ) : (
                          <Badge tone={a.connecte ? 'succes' : 'neutre'}>{a.connecte ? 'En ligne' : 'Hors ligne'}</Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {a.url && /^https:\/\//.test(a.url) && (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className={lien} aria-label={`Voir l’annonce ${PLATEFORME[a.canal] ?? a.canal}`}>
                            Voir <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        )}
                        {saisi && !d.lectureSeule && (
                          <IconButton
                            label="Retirer le lien Airbnb"
                            size="sm"
                            onClick={() => d.upsert('logements', { ...l, annonces: l.annonces.filter((x) => x !== a) })}
                          >
                            <X />
                          </IconButton>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* Sans photo, l'encadré du haut propose déjà le lien : pas de doublon. */}
            {photosLogement(l).length > 0 && !idAirbnbDuLogement(l) && !d.lectureSeule && (
              <div className="mt-3 border-t border-(--lm-bord) pt-3">
                <LienAirbnb logement={l} />
              </div>
            )}
          </Card>

          {l.residencePrincipale && <CompteurNuits compteur={nuitsAnnee(d.reservations, l.id)} />}

          <Repli titre="Administratif">
            <dl className="divide-y divide-(--lm-bord)">
              <Ligne libelle="N° d’enregistrement">{l.numeroEnregistrement || <span className="text-(--lm-encre-3)">Non renseigné</span>}</Ligne>
              <Ligne libelle="DPE">{l.dpe || <span className="text-(--lm-encre-3)">Non renseigné</span>}</Ligne>
              <Ligne libelle="Résidence principale">{l.residencePrincipale ? 'Oui (120 nuits par an)' : 'Non'}</Ligne>
            </dl>
            {!importe && d.utilisateur.role === 'gerant' && <Relier logement={l} />}
          </Repli>
        </div>
      </div>
    </>
  );
}

/**
 * Logement créé à la main (ou par le dossier propriétaire) dont l'annonce est
 * déjà connectée : le relier évite un logement en double à la prochaine
 * mise à jour. Réservé au gérant.
 */
function Relier({ logement: l }: { logement: Logement }) {
  const { upsert } = useErp();
  const [numero, setNumero] = useState(l.repull?.id ?? '');
  const actuel = l.repull?.id ?? '';
  return (
    <div className="mt-4 border-t border-(--lm-bord) pt-4">
      <p className="mb-2 text-[13px] text-(--lm-encre-2)">Son annonce est déjà connectée ? Reliez-la pour éviter un logement en double.</p>
      <div className="flex items-end gap-2">
        <Field label="Numéro de l’annonce" className="min-w-0 flex-1">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ex. 5668" inputMode="numeric" />
        </Field>
        <Button
          disabled={actuel === numero.trim()}
          onClick={() => upsert('logements', { ...l, repull: numero.trim() ? { ...(l.repull ?? {}), id: numero.trim() } : undefined })}
        >
          Relier
        </Button>
      </div>
    </div>
  );
}

/**
 * Le propriétaire, dans la fiche de son logement : coordonnées, « Modifier »,
 * et le dossier qu'il a rempli (s'il existe) — il n'y a plus de rubrique
 * Propriétaires.
 */
function Proprietaire({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [edition, setEdition] = useState(false);
  const [nouveauMandat, setNouveauMandat] = useState(false);
  const prop = proprietaireById(d, l.proprietaireId);
  const dossier = d.donnees.dossiers.find((x) => x.logementId === l.id);
  const renseigne = prop && prop.id !== ID_PROPRIETAIRE_A_RENSEIGNER;
  // Mandat de gestion du logement avec son propriétaire actuel (celui d'un ancien propriétaire ne compte pas).
  const mandat = mandatDuProprietaire(d.mandats, l.id, prop?.id);
  const ligneMandat = !mandat
    ? renseigne && d.mandats.some((m) => m.logementId === l.id)
      ? `Pas de mandat avec ${prop!.nom}`
      : undefined
    : mandat.statut === 'signe'
      ? `Mandat signé le ${dateCourte(mandat.signeLe ?? mandat.dateDebut)} · ${String(mandat.commissionPct).replace('.', ',')} %`
      : mandat.statut === 'envoye'
        ? 'Mandat envoyé, pas encore signé'
        : mandat.statut === 'resilie'
          ? `Mandat résilié${mandat.resilieLe ? ` le ${dateCourte(mandat.resilieLe)}` : ''}`
          : 'Mandat en préparation';
  return (
    <>
      <Card>
        <CardHeader
          titre="Propriétaire"
          actions={
            renseigne &&
            !d.lectureSeule && (
              <button
                type="button"
                onClick={() => setEdition(true)}
                aria-label="Modifier le propriétaire"
                className="inline-flex h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline"
              >
                Modifier
              </button>
            )
          }
        />
        {!renseigne ? (
          <p className="text-[13.5px] text-(--lm-encre-2)">Pas encore renseigné : « Modifier » en haut de la page permet de le choisir.</p>
        ) : (
          <div className="space-y-1.5 text-[13.5px]">
            <p className="font-semibold text-(--lm-encre)">{prop.nom}</p>
            {prop.contact.telephone && (
              <a href={`tel:${prop.contact.telephone.replace(/[^\d+]/g, '')}`} className="flex min-h-8 items-center gap-2 text-(--lm-encre-2) hover:text-(--lm-or-texte)">
                <Phone className="size-3.5 shrink-0" aria-hidden />
                {prop.contact.telephone}
              </a>
            )}
            {prop.contact.email && (
              <a href={`mailto:${prop.contact.email}`} className="flex min-h-8 min-w-0 items-center gap-2 text-(--lm-encre-2) hover:text-(--lm-or-texte)">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{prop.contact.email}</span>
              </a>
            )}
            {ligneMandat && <p className="pt-0.5 text-(--lm-encre-2)">{ligneMandat}</p>}
            {/* Sans mandat avec le propriétaire actuel (après un transfert) : pas de taux de commission tant qu'il n'est pas saisi. */}
            {!mandat && ligneMandat && d.utilisateur.role === 'gerant' && !d.lectureSeule && (
              <button
                type="button"
                onClick={() => setNouveauMandat(true)}
                className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline"
              >
                Ajouter son mandat
              </button>
            )}
          </div>
        )}
        {nouveauMandat && prop && (
          <FormMandat
            ouvert
            onFermer={() => setNouveauMandat(false)}
            preselection={{ proprietaireId: prop.id, logementId: l.id, dejaSigne: true, ...(l.proprietaireDepuis ? { dateDebut: l.proprietaireDepuis } : {}) }}
          />
        )}
        {/* Espace propriétaire : le gérant seul (accès, bilans à publier, documents). */}
        {renseigne && d.utilisateur.role === 'gerant' && !d.lectureSeule && <CarteEspaceProprietaire proprietaire={prop} logement={l} />}
      </Card>
      {dossier && (
        <Repli titre="Dossier propriétaire" description={`Réponses reçues le ${dateCourte(dossier.recuLe.slice(0, 10))}`}>
          <FicheEtapes
            etapes={ETAPES_DOSSIER}
            valeurs={dossier.valeurs}
            lectureSeule={d.lectureSeule}
            onChange={(valeurs) => d.upsert('dossiers', { ...dossier, valeurs, majLe: horodatageMaintenant() })}
          />
        </Repli>
      )}
      {renseigne && <FormProprietaire ouvert={edition} onFermer={() => setEdition(false)} proprietaire={prop} />}
    </>
  );
}

/* ------------------------------------------------------- l'annonce */

/** Titre et textes de l'annonce, repliés au-delà de quelques lignes. */
function Annonce({ descriptif: d }: { descriptif: DescriptifLogement }) {
  const [ouvert, setOuvert] = useState(false);
  const t = d.textes ?? {};
  const principal = [t.resume, t.description].filter(Boolean).join('\n\n');
  const autres = [
    { titre: 'Le logement', texte: t.espace },
    { titre: 'Accès des voyageurs', texte: t.accesVoyageurs },
    { titre: 'Le quartier', texte: t.quartier },
    { titre: 'Se déplacer', texte: t.transports },
  ].filter((x): x is { titre: string; texte: string } => !!x.texte);
  if (!d.titre && !principal && !autres.length) return null;
  const long = principal.length > 320 || autres.length > 0;
  return (
    <Card>
      <CardHeader titre="L’annonce" description="Telle que les voyageurs la lisent sur les plateformes" />
      {d.titre && <p className="text-[15px] font-semibold text-(--lm-encre)">{d.titre}</p>}
      {principal && (
        // Replié : le premier paragraphe seulement, sur trois lignes au plus.
        <p className={`mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre-2) ${!ouvert && long ? 'line-clamp-3' : ''}`}>
          {!ouvert && long ? principal.split(/\n\n/)[0] : principal}
        </p>
      )}
      {ouvert &&
        autres.map((x) => (
          <div key={x.titre} className="mt-4">
            <h3 className="text-[13.5px] font-semibold text-(--lm-encre)">{x.titre}</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line text-(--lm-encre-2)">{x.texte}</p>
          </div>
        ))}
      {long && (
        <button
          type="button"
          aria-expanded={ouvert}
          onClick={() => setOuvert((o) => !o)}
          className="mt-2 inline-flex h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline"
        >
          {ouvert ? 'Réduire' : 'Lire la suite'}
        </button>
      )}
    </Card>
  );
}

/** Où dorment les voyageurs, pièce par pièce (comme sur l'annonce). */
function Couchage({ pieces }: { pieces: NonNullable<DescriptifLogement['couchage']> }) {
  return (
    <Card>
      <CardHeader titre="Couchage" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {pieces.map((p, i) => {
          const Icone = /canapé/i.test(p.lits) && !/lit (double|simple|queen|king)/i.test(p.lits) ? Sofa : BedDouble;
          return (
            <li key={`${p.piece}-${i}`} className="rounded-lg border border-(--lm-bord) p-3.5">
              <Icone className="size-5 text-(--lm-encre-2)" aria-hidden />
              <p className="mt-2 text-[13.5px] font-semibold text-(--lm-encre)">{p.piece}</p>
              <p className="text-[12.5px] text-(--lm-encre-2)">{p.lits}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const pct = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} %`;

/** Prix de base de l'annonce : nuit, week-end, ménage, caution, remises. */
function PrixDeBase({ prix: p, frais, separe }: { prix: NonNullable<DescriptifLogement['prix']>; frais: string[]; separe: boolean }) {
  const lignes = [
    { libelle: 'Nuit (prix de base)', valeur: p.nuit !== undefined ? euros(p.nuit, true) : '' },
    { libelle: 'Nuit le week-end', valeur: p.weekend !== undefined ? euros(p.weekend, true) : '' },
    { libelle: 'Ménage', valeur: p.menage !== undefined ? euros(p.menage, true) : '' },
    {
      libelle: 'Voyageur en plus',
      valeur: p.voyageurSupplementaire ? `${euros(p.voyageurSupplementaire, true)} / nuit${p.voyageursInclus ? ` au-delà de ${p.voyageursInclus}` : ''}` : '',
    },
    { libelle: 'Caution', valeur: p.caution ? euros(p.caution, true) : '' },
    { libelle: 'Remise à la semaine', valeur: p.remiseSemainePct ? pct(p.remiseSemainePct) : '' },
    { libelle: 'Remise au mois', valeur: p.remiseMoisPct ? pct(p.remiseMoisPct) : '' },
    // Autres frais, déjà en clair : « Animal : 15 € par séjour ».
    ...frais.map((f) => {
      const i = f.indexOf(' : ');
      return i > 0 ? { libelle: f.slice(0, i), valeur: f.slice(i + 3) } : { libelle: 'Frais', valeur: f };
    }),
  ].filter((x) => x.valeur);
  if (!lignes.length) return null;
  return (
    <dl className={`divide-y divide-(--lm-bord) ${separe ? 'mt-4 border-t border-(--lm-bord) pt-2' : ''}`}>
      {lignes.map((x) => (
        <Ligne key={x.libelle} libelle={x.libelle}>
          <span className="lm-chiffres">{x.valeur}</span>
        </Ligne>
      ))}
    </dl>
  );
}

const permis = (v: boolean | undefined, oui: string, non: string) => (v === undefined ? '' : v ? oui : non);

/** Règles et conditions de l'annonce, en clair. */
function Conditions({ descriptif: d }: { descriptif: DescriptifLogement }) {
  const c = d.conditions ?? {};
  const s = d.sejour ?? {};
  const lignes = [
    { libelle: 'Durée du séjour', valeur: [s.nuitsMin ? `${pluriel(s.nuitsMin, 'nuit')} minimum` : '', s.nuitsMax ? `${s.nuitsMax} maximum` : ''].filter(Boolean).join(', ') },
    { libelle: 'Arrivée', valeur: c.arriveeJusqua ? `Jusqu’à ${c.arriveeJusqua}` : '' },
    { libelle: 'Animaux', valeur: permis(c.animaux, 'Acceptés', 'Non acceptés') },
    { libelle: 'Fumer', valeur: permis(c.fumeur, 'Autorisé', 'Interdit') },
    { libelle: 'Fêtes', valeur: permis(c.fetes, 'Autorisées', 'Interdites') },
    { libelle: 'Enfants', valeur: [permis(c.enfants, 'Bienvenus', 'Non adapté'), c.ageMinEnfants ? `dès ${c.ageMinEnfants} ans` : ''].filter(Boolean).join(', ') },
    { libelle: 'Heures de calme', valeur: c.calme ? `${c.calme.debut} – ${c.calme.fin}` : '' },
    { libelle: 'Réservation', valeur: s.reservationInstantanee === undefined ? '' : s.reservationInstantanee ? 'Instantanée' : 'Sur demande' },
    { libelle: 'Annulation', valeur: c.annulation ?? '' },
  ].filter((x) => x.valeur);
  if (!lignes.length) return null;
  return (
    <Card>
      <CardHeader titre="Conditions" />
      <dl className="divide-y divide-(--lm-bord)">
        {lignes.map((x) => (
          <Ligne key={x.libelle} libelle={x.libelle}>
            {x.valeur}
          </Ligne>
        ))}
      </dl>
    </Card>
  );
}
