import { useState } from 'react';
import { CalendrierDefilant, CalendrierMois, PilulesLogement, datesSejour, ligneChiffres, type ChargeurMois, type SejourCalendrier } from '../calendrier';
import { dateCourte, pluriel } from '../data/format';
import type { CalendrierLogement, VueProprietaire } from '../data/types-proprietaire';
import { Drawer } from '../ui';
import { CANAL, TitreEspace } from './commun';

/**
 * Mois du calendrier connus de la page (le mois de la vue d'abord), et le
 * chargeur d'une plage de mois (`GET ?action=calendrier&de=…&a=…`, ou la
 * même fonction pure sur le jeu de démonstration).
 */
export interface CalendrierEspace {
  connus: Readonly<Record<string, CalendrierLogement[] | undefined>>;
  charger: ChargeurMois;
}

/** Détail d'un séjour touché sur le calendrier : dates, nuits, voyageurs, plateforme. */
function DetailSejour({ sejour: s, logement, onFermer }: { sejour: SejourCalendrier | null; logement?: string; onFermer: () => void }) {
  const lignes = s
    ? [
        { libelle: 'Dates', valeur: datesSejour(s) },
        { libelle: 'Nuits', valeur: pluriel(s.nuits, 'nuit') },
        { libelle: 'Voyageurs', valeur: pluriel(s.nbPersonnes, 'voyageur') },
        { libelle: 'Plateforme', valeur: CANAL[s.canal] },
      ]
    : [];
  return (
    <Drawer ouvert={!!s} onFermer={onFermer} titre={s?.voyageur ?? ''} sousTitre={logement} largeur="md">
      <dl className="divide-y divide-(--lm-bord)">
        {lignes.map((l) => (
          <div key={l.libelle} className="flex items-baseline justify-between gap-4 py-3 text-[14px]">
            <dt className="text-(--lm-encre-2)">{l.libelle}</dt>
            <dd className="lm-chiffres text-right font-medium text-(--lm-encre)">{l.valeur}</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  );
}

/**
 * Onglet Calendrier : les mois les uns sous les autres, comme sur Airbnb,
 * pour le logement choisi ; toucher une bande ouvre le détail du séjour.
 */
export function Calendrier({ vue, calendrier }: { vue: VueProprietaire; calendrier: CalendrierEspace }) {
  // Ses logements, puis ceux qu'il a cédés (calendrier borné à sa période).
  const choixPossibles = [...vue.logements.map((l) => ({ id: l.id, nom: l.nom })), ...vue.logementsCedes.map((l) => ({ id: l.id, nom: l.nom }))];
  const [choix, setChoix] = useState(choixPossibles[0]?.id);
  const [ouvert, setOuvert] = useState<SejourCalendrier | null>(null);
  const premier = vue.calendrier.logements.find((x) => x.logementId === choix) ?? vue.calendrier.logements[0];
  const logementId = premier?.logementId;
  const logement = choixPossibles.find((l) => l.id === logementId);
  const cede = vue.logementsCedes.find((l) => l.id === logementId);
  const hors = new Set(premier?.jours.map((j) => j.hors).filter((x): x is 'avant' | 'apres' | 'autre' => !!x));
  const duLogement = (logements: CalendrierLogement[]) => logements.find((x) => x.logementId === logementId) ?? logements[0];

  return (
    <div className="mx-auto w-full max-w-[44rem]">
      <TitreEspace titre="Calendrier" description="Vos séjours, mois après mois." />

      <PilulesLogement logements={choixPossibles} choisi={logementId} onChoisir={setChoix} className="mb-4" />

      {(cede || hors.size > 0) && (
        <p className="mb-4 text-[13.5px] text-(--lm-encre-2)">
          {[
            cede && `${cede.nom} : plus en gestion pour vous depuis le ${dateCourte(cede.jusquAu)}.`,
            'Le calendrier montre votre période seulement.',
            // Jours grisés dans sa période : le séjour de l'ancien propriétaire, arrivé avant le changement.
            hors.has('autre') && 'Le séjour en cours au changement reste à l’ancien propriétaire.',
          ]
            .filter(Boolean)
            .join(' ')}
        </p>
      )}

      {!premier ? (
        <p className="text-[14px] text-(--lm-encre-2)">Aucun logement en gestion pour l’instant.</p>
      ) : (
        <CalendrierDefilant
          moisInitial={vue.calendrier.mois}
          connus={calendrier.connus}
          charger={calendrier.charger}
          rendreMois={(mois, logements) => {
            const c = duLogement(logements);
            return c ? <CalendrierMois mois={mois} jours={c.jours} sejours={c.sejours} aujourdhui={vue.aujourdhui} chiffres={ligneChiffres(c)} onSejour={setOuvert} /> : null;
          }}
        />
      )}

      <DetailSejour sejour={ouvert} logement={choixPossibles.length > 1 ? logement?.nom : undefined} onFermer={() => setOuvert(null)} />
    </div>
  );
}
