import { FileSignature, Save } from 'lucide-react';
import { useErp } from '../../../data/store';
import { dateCourte, dateHeure, euros } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import type { Prospect } from '../../../data/types';
import { Badge, Button, Drawer, StatusBadge, Timeline } from '../../../ui';
import { FormProspect, brouillonDe, versProspect } from './FormProspect';

export function FicheProspect({
  prospect,
  onFermer,
  onEnregistre,
  onLancer,
}: {
  prospect: Prospect | undefined;
  onFermer: () => void;
  onEnregistre: (p: Prospect) => void;
  onLancer: (p: Prospect) => void;
}) {
  const { journal, upsert } = useErp();
  if (!prospect) return null;
  const p = prospect;
  const historique = journal.filter((j) => j.entiteId === p.id).slice(0, 8);
  const formId = `fiche-${p.id}`;

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={p.nom}
      sousTitre={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge type="etapeProspect" valeur={p.etape} />
          <Badge>{LIBELLES.sourceProspect[p.source]}</Badge>
          <span>Créé le {dateCourte(p.creeLe)}</span>
        </span>
      }
      pied={
        <>
          {(p.etape === 'negociation' || p.etape === 'proposition') && (
            <Button icone={<FileSignature />} onClick={() => onLancer(p)}>
              Lancer le mandat
            </Button>
          )}
          <Button variant="primary" type="submit" form={formId} icone={<Save />}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) p-3 text-center">
        {[
          { l: 'Revenu estimé', v: euros(p.revenuEstimeAnnuelCentimes, true) },
          { l: 'Commission à 18 %', v: euros(Math.round(p.revenuEstimeAnnuelCentimes * 0.18), true) },
          { l: 'Commission à 20 %', v: euros(Math.round(p.revenuEstimeAnnuelCentimes * 0.2), true) },
        ].map((x) => (
          <div key={x.l}>
            <p className="text-[11.5px] text-(--lm-encre-2)">{x.l}</p>
            <p className="lm-chiffres text-[15px] font-semibold text-(--lm-encre)">{x.v}</p>
          </div>
        ))}
      </div>
      <FormProspect
        key={p.id + p.etape}
        id={formId}
        initial={brouillonDe(p)}
        onValide={(b) => {
          const maj = versProspect(b, { id: p.id, creeLe: p.creeLe });
          upsert('prospects', maj);
          onEnregistre(maj);
        }}
      />
      <h3 className="mt-6 mb-3 text-[13px] font-semibold text-(--lm-encre)">Historique</h3>
      <Timeline
        vide="Aucune action enregistrée pour ce prospect."
        elements={historique.map((j) => ({ id: j.id, titre: j.action, meta: `${j.auteur}, ${dateHeure(j.horodatage)}`, description: j.details || undefined }))}
      />
    </Drawer>
  );
}
