import { useEffect, useState, type FormEvent } from 'react';
import { Bot, Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import { Alert, Badge, Button, Callout, Card, CardHeader, Field, Input, ProgressBar, Textarea } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import type { FicheLogement, Logement } from '../../../data/types';
import { completudeFiche } from '../_composants/stats';

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
        className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded text-(--lm-encre-3) hover:text-(--lm-encre)"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function OngletFiche({ logement: l }: { logement: Logement }) {
  const { upsert } = useErp();
  const [f, setF] = useState<FicheLogement>(l.fiche);
  const [equipement, setEquipement] = useState('');
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => setF(l.fiche), [l.fiche]);

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
    upsert('logements', { ...l, fiche: { ...f, equipements: f.equipements } });
    setEnregistre(true);
  };

  return (
    <form onSubmit={enregistrer} className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <Callout tone="or" icone={<Bot />} titre="Source de vérité de l’agent IA">
          Cette fiche est la seule source que l’agent IA utilise pour répondre aux voyageurs. Une fiche incomplète bloque la messagerie automatique.
        </Callout>

        <Card>
          <CardHeader titre="Connexion wifi" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nom du réseau">
              <Input value={f.wifiNom} onChange={(e) => maj('wifiNom', e.target.value)} />
            </Field>
            <Field label="Code wifi" aide="Masqué par défaut.">
              <Secret valeur={f.wifiCode} onChange={(v) => maj('wifiCode', v)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader titre="Arrivée, départ et accès" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Arrivée à partir de">
              <Input type="time" value={f.heureArrivee} onChange={(e) => maj('heureArrivee', e.target.value)} />
            </Field>
            <Field label="Départ avant">
              <Input type="time" value={f.heureDepart} onChange={(e) => maj('heureDepart', e.target.value)} />
            </Field>
            <Field label="Instructions d’accès" className="sm:col-span-2" aide="Emplacement de la boîte ou de la serrure, étage, digicode de l’immeuble. Jamais le code de la boîte : il change à chaque séjour.">
              <Textarea value={f.acces} onChange={(e) => maj('acces', e.target.value)} rows={3} />
            </Field>
            <div className="flex items-center gap-3 rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) px-3 py-2.5 sm:col-span-2">
              <KeyRound className="size-4 shrink-0 text-(--lm-or)" aria-hidden />
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="font-medium">Code d’accès : {LIBELLES.serrure[l.serrure]}</p>
                <p className="text-(--lm-encre-2)">
                  {l.serrure === 'cles' ? 'Remise en main propre, aucun code.' : 'Code unique généré pour chaque séjour, jamais stocké en clair ici.'}
                </p>
              </div>
              <span aria-label="Code masqué" className="font-mono tracking-widest text-(--lm-encre-3)">••••</span>
            </div>
            <Field label="Parking" className="sm:col-span-2">
              <Input value={f.parking} onChange={(e) => maj('parking', e.target.value)} />
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
                <li key={e}>
                  <Badge tone="or" className="pr-1">
                    {e}
                    <button
                      type="button"
                      aria-label={`Retirer ${e}`}
                      onClick={() => maj('equipements', f.equipements.filter((x) => x !== e))}
                      className="ml-1 rounded-full p-0.5 hover:bg-(--lm-or-lavis)"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
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
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader titre="Complétude" description="Champs utilisés par l’agent IA." />
          <ProgressBar valeur={c.ratio} afficherValeur tone={c.ratio === 1 ? 'succes' : 'alerte'} label={c.ratio === 1 ? 'Fiche complète' : `${c.manquants.length} champ${c.manquants.length > 1 ? 's' : ''} manquant${c.manquants.length > 1 ? 's' : ''}`} />
          {c.manquants.length > 0 && (
            <Alert tone="alerte" titre="Messagerie automatique bloquée" className="mt-3">
              À compléter : {c.manquants.join(', ')}.
            </Alert>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <Button variant="primary" type="submit" disabled={!modifie}>
              Enregistrer la fiche
            </Button>
            {modifie && (
              <Button variant="ghost" onClick={() => setF(l.fiche)}>
                Annuler les modifications
              </Button>
            )}
            {enregistre && !modifie && <p role="status" className="text-center text-[12.5px] text-(--lm-succes)">Fiche enregistrée.</p>}
          </div>
        </Card>
        <Callout tone="info" icone={<ShieldCheck />} titre="Confidentialité des accès">
          Code wifi et code d’accès ne sont transmis qu’aux voyageurs dont la réservation est confirmée, dans les 48 h précédant l’arrivée.
        </Callout>
      </div>
    </form>
  );
}
