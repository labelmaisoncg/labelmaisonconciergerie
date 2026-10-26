import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Mail, Phone } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Repli } from '../../../ui';
import { GraphiqueCourbe } from '../../../ui/Graphiques';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from '../../../data/repull';
import { AUJOURDHUI, SANS_DONNEE, dateHeure, euros, jourMois, note, pluriel, pourcentage } from '../../../data/format';
import { estActive, nuitsAnnee, proprietaireById } from '../../../data/selectors';
import type { Canal, Logement } from '../../../data/types';
import { CompteurNuits } from '../_composants/CompteurNuits';
import { Galerie } from '../_composants/Galerie';
import { photosLogement, prixAVenir, statsLogement } from '../_composants/stats';

const PLATEFORME: Record<Canal, string> = { airbnb: 'Airbnb', booking: 'Booking.com', direct: 'Site direct' };

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[13.5px]">
      <dt className="shrink-0 text-(--lm-encre-2)">{libelle}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-(--lm-encre)">{children}</dd>
    </div>
  );
}

const lien = 'inline-flex items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline';

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
  const prop = proprietaireById(d, l.proprietaireId);
  const resas = d.reservations
    .filter((r) => r.logementId === l.id && estActive(r) && r.depart >= AUJOURDHUI)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
    .slice(0, 5);
  const lits = l.lits.map((x) => `${x.nombre} ${LIBELLES.typeLit[x.type].toLowerCase()}`).join(', ');
  const jours = (l.tarifs?.jours ?? []).filter((j) => j.date >= AUJOURDHUI).slice(0, 60);
  const importe = !!l.repull?.majLe || l.id.startsWith('repull-');

  return (
    <>
      <Galerie photos={photosLogement(l)} nom={l.nom} />

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
                          {r.arrivee <= AUJOURDHUI ? `Sur place jusqu’au ${jourMois(r.depart)}` : `Du ${jourMois(r.arrivee)} au ${jourMois(r.depart)}`} · {pluriel(r.nuits, 'nuit')} ·{' '}
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

          {jours.length > 1 && prix && (
            <Card>
              <CardHeader
                titre="Prix des prochaines semaines"
                description={`De ${euros(prix.min, true)} à ${euros(prix.max, true)} par nuit sur 30 jours · lus sur les plateformes le ${dateHeure(prix.luLe)}`}
              />
              <GraphiqueCourbe
                label={`Prix par nuit des ${jours.length} prochains jours, de ${euros(prix.min, true)} à ${euros(prix.max, true)}`}
                points={jours.map((j) => ({ libelle: jourMois(j.date), valeur: j.prixCentimes }))}
                formater={(v) => `${euros(v, true)} la nuit`}
                formaterAxe={(v) => euros(v, true)}
                domaine={[0, 'auto']}
                paliers
                hauteur={180}
              />
            </Card>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardHeader titre="Propriétaire" />
            {!prop || prop.id === ID_PROPRIETAIRE_A_RENSEIGNER ? (
              <p className="text-[13.5px] text-(--lm-encre-2)">Pas encore renseigné : utilisez « Modifier » pour le choisir.</p>
            ) : (
              <div className="space-y-1.5 text-[13.5px]">
                <Link to={`/erp/proprietaires/${prop.id}`} className="font-semibold text-(--lm-encre) hover:text-(--lm-or-texte) hover:underline">
                  {prop.nom}
                </Link>
                {prop.contact.telephone && (
                  <a href={`tel:${prop.contact.telephone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2 text-(--lm-encre-2) hover:text-(--lm-or-texte)">
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    {prop.contact.telephone}
                  </a>
                )}
                {prop.contact.email && (
                  <a href={`mailto:${prop.contact.email}`} className="flex min-w-0 items-center gap-2 text-(--lm-encre-2) hover:text-(--lm-or-texte)">
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{prop.contact.email}</span>
                  </a>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader titre="Le logement" />
            <dl className="divide-y divide-(--lm-bord)">
              <Ligne libelle="Adresse">
                {l.adresse ? `${l.adresse}, ${l.codePostal} ${l.ville}`.replace(/^, |, $/, '') : l.ville}
              </Ligne>
              <Ligne libelle="Voyageurs">{l.capacite || SANS_DONNEE}</Ligne>
              <Ligne libelle="Couchage">{[pluriel(l.chambres, 'chambre'), lits].filter(Boolean).join(', ')}</Ligne>
              {l.surfaceM2 > 0 && <Ligne libelle="Surface">{l.surfaceM2} m²</Ligne>}
              <Ligne libelle="Arrivée · départ">
                {l.fiche.heureArrivee || '—'} · {l.fiche.heureDepart || '—'}
              </Ligne>
              <Ligne libelle="Accès">{LIBELLES.serrure[l.serrure]}</Ligne>
            </dl>
          </Card>

          <Card>
            <CardHeader titre="Plateformes" />
            {l.annonces.length === 0 ? (
              <p className="text-[13.5px] text-(--lm-encre-2)">Aucune annonce reliée.</p>
            ) : (
              <ul className="space-y-2">
                {l.annonces.map((a) => (
                  <li key={a.canal} className="flex items-center justify-between gap-3 text-[13.5px]">
                    <span className="flex items-center gap-2">
                      <span className="font-medium text-(--lm-encre)">{PLATEFORME[a.canal] ?? a.canal}</span>
                      <Badge tone={a.connecte ? 'succes' : 'neutre'}>{a.connecte ? 'En ligne' : 'Hors ligne'}</Badge>
                    </span>
                    {a.url && /^https:\/\//.test(a.url) && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className={lien} aria-label={`Voir l’annonce ${PLATEFORME[a.canal] ?? a.canal}`}>
                        Voir <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
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
