import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { SEUIL_NOTE_CONTROLE } from '../../../data/constantes';
import { dateCourte, note } from '../../../data/format';
import { nouvelId, useErp } from '../../../data/store';
import type { Mission } from '../../../data/types';
import { Badge, Button, Card, CardHeader, Field, Select } from '../../../ui';
import { controlePlanifie, nouveauControle } from './outils';

interface Props {
  mission: Mission;
  onMessage: (texte: string) => void;
}

/** Contrôle qualité d'une mission : drapeau, note de contrôle, planification. */
export function ControleCarte({ mission: m, onMessage }: Props) {
  const { missions, reservations, logements, upsert } = useErp();
  const [noteSaisie, setNoteSaisie] = useState(m.noteControle !== undefined ? String(m.noteControle) : '');
  const r = reservations.find((x) => x.id === m.reservationId);
  const basse = r?.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE;
  const planifie = controlePlanifie(m, missions);

  const basculer = () => {
    upsert('missions', { ...m, controleQualite: !m.controleQualite });
    onMessage(m.controleQualite ? 'Mission retirée du contrôle qualité.' : 'Mission marquée pour contrôle qualité.');
  };
  const enregistrer = () => {
    if (!noteSaisie) return;
    upsert('missions', { ...m, controleQualite: true, noteControle: Number(noteSaisie) });
    onMessage(`Contrôle enregistré : ${noteSaisie}/5.`);
  };
  const planifier = () => {
    const c = nouveauControle(m, nouvelId('mis'), logements.find((l) => l.id === m.logementId));
    upsert('missions', c);
    onMessage(`Contrôle physique planifié le ${dateCourte(c.date)}.`);
  };

  if (m.type !== 'menage') return null;
  return (
    <Card>
      <CardHeader
        titre="Contrôle qualité"
        actions={m.controleQualite || basse ? <Badge tone="or" icone={<ClipboardCheck />}>À contrôler</Badge> : undefined}
      />
      <div className="space-y-3 text-[13px]">
        {basse && <p className="text-(--lm-danger)">Note voyageur {note(r?.noteVoyageur)} : contrôle obligatoire (seuil {note(SEUIL_NOTE_CONTROLE)}).</p>}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={m.controleQualite} onChange={basculer} className="size-4 accent-(--lm-or)" />
          Mission sélectionnée pour contrôle physique
        </label>
        <div className="flex items-end gap-2">
          <Field label="Note du contrôle" className="flex-1">
            <Select
              value={noteSaisie}
              onChange={(e) => setNoteSaisie(e.target.value)}
              placeholder="Non contrôlée"
              options={[5, 4, 3, 2, 1].map((n) => ({ valeur: String(n), libelle: `${n} sur 5` }))}
            />
          </Field>
          <Button variant="secondary" onClick={enregistrer} disabled={!noteSaisie}>
            Enregistrer
          </Button>
        </div>
        {planifie ? (
          <p>
            Contrôle physique :{' '}
            <Link className="text-(--lm-info) hover:underline" to={`/erp/menages/${planifie.id}`}>
              planifié le {dateCourte(planifie.date)}
            </Link>
          </p>
        ) : (
          <Button size="sm" variant="secondary" icone={<ClipboardCheck />} onClick={planifier}>
            Planifier un contrôle
          </Button>
        )}
      </div>
    </Card>
  );
}
