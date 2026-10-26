import { ChevronRight, FileText, Mail, MessageCircle, Phone } from 'lucide-react';
import { dateCourte, euros, jourMois, pluriel, pourcentage } from '../data/format';
import type { ChiffresMoisVue, VueProprietaire } from '../data/types-proprietaire';
import { LIBELLE_CATEGORIE } from '../data/proprietaire';
import { Badge, Card } from '../ui';
import { CANAL, LienAction, PhotoLogement, Rubrique, TitreEspace, titreMois, type LienDocument, type OngletEspace } from './commun';

/** Net du mois : le chiffre que le propriétaire vient chercher. */
function CarteMois({ titre, c, onVoirBilan }: { titre: string; c: ChiffresMoisVue; onVoirBilan?: () => void }) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-(--lm-encre-2)">{titre}</p>
          <p className="text-[13px] text-(--lm-encre-3)">{titreMois(c.mois)}</p>
        </div>
        {c.provisoire ? <Badge tone="neutre">{titre === 'Ce mois-ci' ? 'En cours' : 'Provisoire'}</Badge> : <Badge tone="succes">Bilan publié</Badge>}
      </div>
      <p className="lm-chiffres mt-3 text-[32px] leading-none font-semibold text-(--lm-encre)">{euros(c.net, true)}</p>
      <p className="mt-1.5 text-[12.5px] text-(--lm-encre-2)">pour vous, après frais et commission</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-(--lm-bord) pt-3 text-[13px]">
        <div>
          <dt className="text-(--lm-encre-2)">Nuits réservées</dt>
          <dd className="lm-chiffres font-semibold text-(--lm-encre)">{c.nuits}</dd>
        </div>
        <div>
          <dt className="text-(--lm-encre-2)">Occupation</dt>
          <dd className="lm-chiffres font-semibold text-(--lm-encre)">{pourcentage(c.occupation)}</dd>
        </div>
      </dl>
      {onVoirBilan && (
        <div className="mt-2 -mb-1">
          <LienAction onClick={onVoirBilan}>Voir le bilan</LienAction>
        </div>
      )}
    </Card>
  );
}

export function Accueil({
  vue,
  onOnglet,
  onBilan,
  onLogement,
  LienDocument,
}: {
  vue: VueProprietaire;
  onOnglet: (o: OngletEspace) => void;
  onBilan: (mois: string) => void;
  /** Ouvre la fiche du logement (onglet « Mes logements »). */
  onLogement: (id: string) => void;
  LienDocument: LienDocument;
}) {
  const nom = (id: string) => vue.logements.find((l) => l.id === id)?.nom ?? 'Logement';
  const occupationMois = (id: string) => vue.calendrier.mois === vue.moisCourant.mois ? vue.calendrier.logements.find((c) => c.logementId === id)?.occupation : undefined;
  const publie = !vue.moisPrecedent.provisoire;
  const c = vue.contacts;
  return (
    <>
      <TitreEspace titre={`Bonjour, ${vue.proprietaire.nom}`} description={`L’activité de vos logements, mise à jour chaque jour par ${vue.conciergerie.nom}.`} />

      <div className="grid gap-3 sm:grid-cols-2">
        <CarteMois titre="Ce mois-ci" c={vue.moisCourant} />
        <CarteMois
          titre="Le mois dernier"
          c={vue.moisPrecedent}
          onVoirBilan={
            publie
              ? () => {
                  onBilan(vue.moisPrecedent.mois);
                  onOnglet('bilans');
                }
              : undefined
          }
        />
      </div>

      <Rubrique titre={vue.logements.length > 1 ? 'Vos logements' : 'Votre logement'}>
        {vue.logements.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vue.logements.map((l) => {
              const occ = occupationMois(l.id);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onLogement(l.id)}
                    className="group block w-full rounded-xl text-left focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-offset-4 focus:outline-none"
                  >
                    <PhotoLogement url={l.photo} nom={l.nom} className="aspect-[4/3] w-full rounded-xl transition-opacity group-hover:opacity-90" />
                    <span className="mt-2.5 block text-[15px] font-semibold text-(--lm-encre)">{l.nom}</span>
                    <span className="block text-[13.5px] text-(--lm-encre-2)">
                      {l.ville} · {pluriel(l.capacite, 'voyageur')} · {pluriel(l.chambres, 'chambre')}
                    </span>
                    {occ !== undefined && <span className="mt-0.5 block text-[13.5px] text-(--lm-encre-2)">Ce mois-ci : {pourcentage(occ)} réservé</span>}
                    <span className="mt-1 inline-flex min-h-8 items-center gap-0.5 text-[13px] font-medium text-(--lm-or-texte) group-hover:underline">
                      Performances et avis
                      <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[14px] text-(--lm-encre-2)">Aucun logement en gestion pour l’instant.</p>
        )}
      </Rubrique>

      <Rubrique titre="Prochaines arrivées" action={<LienAction onClick={() => onOnglet('calendrier')}>Calendrier</LienAction>}>
        {vue.prochainesArrivees.length ? (
          <Card flush>
            <ul className="divide-y divide-(--lm-bord)">
              {vue.prochainesArrivees.map((a) => (
                <li key={`${a.logementId}-${a.arrivee}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) py-1.5 text-center">
                    <span className="lm-chiffres text-[17px] leading-none font-semibold text-(--lm-encre)">{Number(a.arrivee.slice(8))}</span>
                    <span className="text-[11.5px] text-(--lm-encre-2)">{jourMois(a.arrivee).split(' ')[1]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span className="truncate font-medium text-(--lm-encre)">{vue.logements.length > 1 ? nom(a.logementId) : a.voyageur}</span>
                      <span className="lm-chiffres shrink-0 text-[13px] text-(--lm-encre-2)">{pluriel(a.nuits, 'nuit')}</span>
                    </p>
                    <p className="truncate text-[13px] text-(--lm-encre-2)">
                      {vue.logements.length > 1 ? `${a.voyageur} · ` : ''}
                      {pluriel(a.nbPersonnes, 'voyageur')} · jusqu’au {jourMois(a.depart)}
                    </p>
                    <p className="truncate text-[13px] text-(--lm-encre-2)">{CANAL[a.canal]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <p className="text-[14px] text-(--lm-encre-2)">Aucune arrivée prévue pour l’instant.</p>
        )}
      </Rubrique>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Rubrique titre="Derniers documents" action={vue.documents.length > 3 ? <LienAction onClick={() => onOnglet('documents')}>Tout voir</LienAction> : undefined}>
          {vue.documents.length ? (
            <Card flush>
              <ul className="divide-y divide-(--lm-bord)">
                {vue.documents.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <LienDocument id={d.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-(--lm-surface-2)">
                      <FileText className="size-4 shrink-0 text-(--lm-or-texte)" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-(--lm-encre)">{d.titre}</span>
                        <span className="block text-[12.5px] text-(--lm-encre-2)">
                          {LIBELLE_CATEGORIE[d.categorie]} · {dateCourte(d.ajouteLe.slice(0, 10))}
                        </span>
                      </span>
                    </LienDocument>
                  </li>
                ))}
              </ul>
            </Card>
          ) : (
            <p className="text-[14px] text-(--lm-encre-2)">Aucun document partagé pour l’instant.</p>
          )}
        </Rubrique>

        {c && (
          <Rubrique titre={`${vue.conciergerie.nom}, à votre écoute`}>
            <Card>
              <p className="text-[14px] text-(--lm-encre-2)">Une question sur un séjour, un bilan ou votre logement ? Appelez-nous ou écrivez-nous.</p>
              <ul className="mt-3 space-y-1 text-[14px]">
                <li>
                  <a href={c.lienTelephone} className="flex min-h-9 items-center gap-2.5 font-medium text-(--lm-encre) hover:text-(--lm-or-texte)">
                    <Phone className="size-4 text-(--lm-or-texte)" aria-hidden />
                    {c.telephone}
                  </a>
                </li>
                <li>
                  <a href={c.whatsapp} target="_blank" rel="noreferrer" className="flex min-h-9 items-center gap-2.5 font-medium text-(--lm-encre) hover:text-(--lm-or-texte)">
                    <MessageCircle className="size-4 text-(--lm-or-texte)" aria-hidden />
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a href={`mailto:${c.email}`} className="flex min-h-9 min-w-0 items-center gap-2.5 font-medium text-(--lm-encre) hover:text-(--lm-or-texte)">
                    <Mail className="size-4 shrink-0 text-(--lm-or-texte)" aria-hidden />
                    <span className="truncate">{c.email}</span>
                  </a>
                </li>
              </ul>
            </Card>
          </Rubrique>
        )}
      </div>
    </>
  );
}
