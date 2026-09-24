import type { ReactNode } from 'react';
import { Printer } from 'lucide-react';
import { Button, Modal } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../../data/constantes';
import { AUJOURDHUI, dateCourte, euros } from '../../../data/format';
import type { Logement, Mandat, Proprietaire } from '../../../data/types';
import { Imprimable } from './Imprimable';
import { NON_SOLLICITATION_MOIS, SOCIETE } from './societe';

interface Parties {
  mandat: Mandat;
  proprietaire?: Proprietaire;
  logement?: Logement;
}

function Article({ n, titre, children }: { n: number; titre: string; children: ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3 className="mb-1.5 text-[13px] font-semibold tracking-wide text-(--lm-brun) uppercase">
        Article {n}. {titre}
      </h3>
      <div className="space-y-2 text-[13.5px] leading-relaxed text-(--lm-encre)">{children}</div>
    </section>
  );
}

/** Mandat de gestion mis en page, pour l'aperçu et l'impression. */
export function DocumentContrat({ mandat: m, proprietaire: p, logement: l }: Parties) {
  const date = m.signeLe ?? AUJOURDHUI;
  return (
    <article className="mx-auto max-w-[720px] bg-white text-(--lm-encre)">
      <header className="border-b border-(--lm-or-anneau) pb-4 text-center">
        <p className="lm-serif text-[22px] text-(--lm-brun)">{SOCIETE.nom}</p>
        <p className="text-[12px] text-(--lm-encre-2)">
          {SOCIETE.forme} · SIRET {SOCIETE.siret} · {SOCIETE.adresse}
        </p>
        <h2 className="lm-serif mt-4 text-[20px]">Mandat de gestion locative saisonnière</h2>
        <p className="text-[12.5px] text-(--lm-encre-2)">Référence {m.reference}</p>
      </header>

      <section className="mt-5 grid gap-4 text-[13.5px] sm:grid-cols-2">
        <div className="rounded-lg border border-(--lm-bord) p-3">
          <p className="text-[11.5px] tracking-wide text-(--lm-encre-3) uppercase">Le Gestionnaire</p>
          <p className="font-semibold">{SOCIETE.nom}</p>
          <p>Société par actions simplifiée unipersonnelle (SASU)</p>
          <p>SIRET {SOCIETE.siret}</p>
          <p>{SOCIETE.adresse}</p>
        </div>
        <div className="rounded-lg border border-(--lm-bord) p-3">
          <p className="text-[11.5px] tracking-wide text-(--lm-encre-3) uppercase">Le Mandant</p>
          <p className="font-semibold">{p?.nom ?? 'Propriétaire à renseigner'}</p>
          {p && <p>{LIBELLES.typeProprietaire[p.type]}</p>}
          <p>{p?.adresse}</p>
          <p>{p?.contact.email}</p>
        </div>
      </section>

      <Article n={1} titre="Objet">
        <p>
          Le Mandant confie au Gestionnaire la gestion en location meublée de courte durée du logement
          {l ? ` « ${l.nom} », ${l.adresse}, ${l.codePostal} ${l.ville} (${LIBELLES.typeLogement[l.type]}, ${l.surfaceM2} m², ${l.capacite} voyageurs)` : ' désigné en annexe'}.
          {l?.numeroEnregistrement && ` Numéro d’enregistrement meublé de tourisme : ${l.numeroEnregistrement}.`}
        </p>
        <p>
          La mission comprend la diffusion et la mise à jour des annonces, la relation avec les voyageurs, l’accueil, le ménage, la gestion du
          linge, le suivi des incidents et un relevé mensuel détaillé des réservations, montants versés, commissions et frais de ménage.
        </p>
      </Article>

      <Article n={2} titre="Durée et période d’essai">
        <p>
          Le mandat prend effet le {dateCourte(m.dateDebut)}
          {m.dateFin ? ` et prend fin le ${dateCourte(m.dateFin)}` : ' pour une durée d’un an, renouvelable par tacite reconduction'}.
        </p>
        {m.periodeEssaiFin && (
          <p>Une période d’essai court jusqu’au {dateCourte(m.periodeEssaiFin)}, pendant laquelle chaque partie peut mettre fin au mandat par écrit sans préavis.</p>
        )}
      </Article>

      <Article n={3} titre="Rémunération du Gestionnaire">
        <p>
          Le Gestionnaire perçoit une commission de <strong>{m.commissionPct} %</strong> des revenus d’hébergement, calculée après déduction des
          commissions des plateformes et des frais de ménage.
        </p>
      </Article>

      <Article n={4} titre="Frais de ménage">
        <p>
          Des frais de ménage de <strong>{euros(m.fraisMenageCentimes)}</strong> par séjour sont facturés au voyageur. Ils sont acquis au
          Gestionnaire, qui rémunère les prestataires de ménage et de blanchisserie.
        </p>
      </Article>

      <Article n={5} titre="Engagements du Mandant">
        <p>Le Mandant fournit une attestation d’assurance du logement, le diagnostic de performance énergétique et le numéro d’enregistrement.</p>
        <p>Le Mandant ne modifie pas les annonces ni le calendrier sans concertation préalable avec le Gestionnaire.</p>
        {l?.residencePrincipale && (
          <p>Le logement étant la résidence principale du Mandant, la location est limitée à {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile.</p>
        )}
      </Article>

      <Article n={6} titre="Non-sollicitation">
        <p>
          Pendant la durée du mandat et {NON_SOLLICITATION_MOIS} mois après sa fin, le Mandant s’interdit de contracter directement avec les voyageurs
          et prestataires présentés par le Gestionnaire.
        </p>
      </Article>

      <Article n={7} titre="Résiliation">
        <p>
          Hors période d’essai, chaque partie peut résilier le mandat par lettre recommandée avec un préavis de {m.preavisJours} jours. Les
          réservations confirmées avant la notification sont honorées.
        </p>
      </Article>

      <footer className="mt-8 break-inside-avoid">
        <p className="text-[13.5px]">
          Fait à {SOCIETE.ville}, le {dateCourte(date)}, en deux exemplaires.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-6 text-[13px]">
          <div className="h-28 rounded-lg border border-dashed border-(--lm-bord-fort) p-3">
            Pour le Gestionnaire
            <br />
            <span className="text-(--lm-encre-3)">{SOCIETE.nom}</span>
          </div>
          <div className="h-28 rounded-lg border border-dashed border-(--lm-bord-fort) p-3">
            Le Mandant
            <br />
            <span className="text-(--lm-encre-3)">Lu et approuvé</span>
          </div>
        </div>
      </footer>
    </article>
  );
}

export function ApercuContrat({ ouvert, onFermer, ...parties }: Parties & { ouvert: boolean; onFermer: () => void }) {
  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      taille="lg"
      titre="Aperçu du contrat"
      description={`Mandat ${parties.mandat.reference}, prêt à imprimer ou à enregistrer en PDF.`}
      pied={
        <>
          <Button onClick={onFermer}>Fermer</Button>
          <Button variant="primary" icone={<Printer />} onClick={() => window.print()}>
            Imprimer
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-(--lm-bord) bg-white p-4 sm:p-8">
        <DocumentContrat {...parties} />
      </div>
      {ouvert && (
        <Imprimable>
          <DocumentContrat {...parties} />
        </Imprimable>
      )}
    </Modal>
  );
}
