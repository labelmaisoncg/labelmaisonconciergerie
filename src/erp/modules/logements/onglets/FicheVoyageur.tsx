import { useEffect, useState, type FormEvent } from 'react';
import { BotMessageSquare, Eye, EyeOff, X } from 'lucide-react';
import { Badge, Button, Callout, Card, CardHeader, Field, Input, Textarea } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import type { FicheLogement, Logement } from '../../../data/types';
import { completudeFiche } from '../_composants/stats';
import { SupplementsLogement } from '../_composants/SupplementsLogement';
import { SectionGuides, SectionQuestions } from './GuidesFiche';

function Secret({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="pr-10 font-mono"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le code wifi' : 'Afficher le code wifi'}
        className="absolute top-1/2 right-0.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-(--lm-encre-3) hover:text-(--lm-encre)"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/**
 * « Infos pour l'agent » : tout ce que l'agent IA peut dire aux voyageurs de
 * ce logement. Ce qui n'y est pas, il le transmet à l'équipe. Code wifi et
 * accès ne partent qu'aux voyageurs confirmés, dans les 48 h avant l'arrivée ou pendant le séjour.
 */
export function OngletFiche({ logement: l }: { logement: Logement }) {
  const { upsert } = useErp();
  const [f, setF] = useState<FicheLogement>(l.fiche);
  const [equipement, setEquipement] = useState('');
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    setF(l.fiche);
  }, [l.fiche]);

  const maj = <K extends keyof FicheLogement>(k: K, v: FicheLogement[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setEnregistre(false);
  };
  const modifie = JSON.stringify(f) !== JSON.stringify(l.fiche);
  const c = completudeFiche(f);

  const ajouterEquipement = () => {
    const v = equipement.trim();
    if (v && !f.equipements.includes(v)) maj('equipements', [...f.equipements, v]);
    setEquipement('');
  };

  const enregistrer = (e: FormEvent) => {
    e.preventDefault();
    upsert('logements', { ...l, fiche: { ...f, aSavoir: f.aSavoir?.trim() || undefined } });
    setEnregistre(true);
  };

  return (
    <form onSubmit={enregistrer} className="flex max-w-3xl flex-col gap-5">
      <Callout tone={c.manquants.length ? 'alerte' : 'or'} icone={<BotMessageSquare />} titre="Votre agent répond aux voyageurs avec ces informations.">
        {c.manquants.length
          ? `Il manque : ${c.manquants.join(', ').toLowerCase()}. Sur ces sujets, il vous transmet la question.`
          : 'Tout est renseigné. Wifi et accès ne sont donnés qu’aux voyageurs confirmés, dans les 48 h avant l’arrivée ou pendant le séjour.'}
      </Callout>

      <Card>
        <CardHeader titre="Arrivée et départ" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Arrivée à partir de">
            <Input type="time" value={f.heureArrivee} onChange={(e) => maj('heureArrivee', e.target.value)} />
          </Field>
          <Field label="Départ avant">
            <Input type="time" value={f.heureDepart} onChange={(e) => maj('heureDepart', e.target.value)} />
          </Field>
          <Field label="Accès au logement" className="sm:col-span-2" aide={`${LIBELLES.serrure[l.serrure]}. Jamais le code lui-même : il change à chaque séjour.`}>
            <Textarea value={f.acces} onChange={(e) => maj('acces', e.target.value)} rows={3} />
          </Field>
          <Field label="Parking" className="sm:col-span-2">
            <Input value={f.parking} onChange={(e) => maj('parking', e.target.value)} placeholder="Ex. place 12 au sous-sol, ou « pas de parking »" />
          </Field>
        </div>
      </Card>

      {/* Suppléments (arrivée plus tôt, départ plus tard…) : à côté des horaires qu'ils prolongent. Pas pour un logement sorti. */}
      {l.statut !== 'sorti' && <SupplementsLogement logement={l} />}

      <Card>
        <CardHeader titre="Wifi" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom du réseau">
            <Input value={f.wifiNom} onChange={(e) => maj('wifiNom', e.target.value)} />
          </Field>
          <Field label="Code wifi">
            <Secret valeur={f.wifiCode} onChange={(v) => maj('wifiCode', v)} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader titre="Règles et équipements" />
        <Field label="Règles de la maison">
          <Textarea value={f.regles} onChange={(e) => maj('regles', e.target.value)} rows={3} />
        </Field>
        <div className="mt-4">
          <p className="mb-1.5 text-[13px] font-medium">Équipements</p>
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Équipements">
            {f.equipements.map((e) => (
              <li key={e} className="inline-flex items-center">
                <Badge tone="or">{e}</Badge>
                {/* Hors de la pastille : une vraie zone de 32 px, sans couper le libellé. */}
                <button
                  type="button"
                  aria-label={`Retirer ${e}`}
                  onClick={() => maj('equipements', f.equipements.filter((x) => x !== e))}
                  className="-ml-1.5 grid size-8 place-items-center rounded-full text-(--lm-encre-2) hover:bg-(--lm-or-lavis) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {f.equipements.length === 0 && <li className="text-[13px] text-(--lm-encre-3)">Aucun équipement renseigné.</li>}
          </ul>
          <div className="flex gap-2">
            <Input
              aria-label="Nouvel équipement"
              placeholder="Ex. Lave-vaisselle"
              value={equipement}
              onChange={(e) => setEquipement(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ajouterEquipement();
                }
              }}
            />
            <Button onClick={ajouterEquipement}>Ajouter</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader titre="À savoir" />
        <Field label="Ce que votre agent doit savoir d’autre" aide="Poubelles, chauffage, voisinage, commerces proches… Facultatif.">
          <Textarea value={f.aSavoir ?? ''} onChange={(e) => maj('aSavoir', e.target.value)} rows={4} />
        </Field>
      </Card>

      <SectionQuestions questions={f.questions ?? []} onChange={(q) => maj('questions', q.length ? q : undefined)} />

      <SectionGuides logementId={l.id} guides={f.guides ?? []} onChange={(g) => maj('guides', g.length ? g : undefined)} />

      {/* Barre collante : « Enregistrer » reste à portée, même en bas d'une longue fiche. */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-(--lm-bord) bg-(--lm-fond) px-4 py-3 sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <Button variant="primary" type="submit" disabled={!modifie}>
          Enregistrer
        </Button>
        {modifie && (
          <Button variant="ghost" onClick={() => setF(l.fiche)}>
            Annuler les modifications
          </Button>
        )}
        {enregistre && !modifie && (
          <p role="status" className="text-[12.5px] text-(--lm-succes-texte)">
            Enregistré. Votre agent s’en sert dès maintenant.
          </p>
        )}
      </div>
    </form>
  );
}
