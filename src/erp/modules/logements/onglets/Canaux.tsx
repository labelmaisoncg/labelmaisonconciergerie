import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Link2, Link2Off, Radio } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, Field, Input } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import type { Annonce, Canal, Logement } from '../../../data/types';
import { CarteAnnonceLogement } from '../../annonces/_composants/CarteAnnonceLogement';

const CANAUX: Canal[] = ['airbnb', 'booking', 'direct'];

export function OngletCanaux({ logement: l }: { logement: Logement }) {
  const { upsert } = useErp();
  const [idRepull, setIdRepull] = useState(l.repull?.id ?? '');
  const [urls, setUrls] = useState<Record<Canal, string>>(() => urlsDe(l));
  useEffect(() => {
    setIdRepull(l.repull?.id ?? '');
    setUrls(urlsDe(l));
  }, [l]);
  // Logement importé de Repull : l'état des annonces vient de Repull (la synchronisation le réécrit).
  const importe = !!l.repull?.majLe || l.id.startsWith('repull-');

  const annonce = (c: Canal): Annonce | undefined => l.annonces.find((a) => a.canal === c);
  const majAnnonce = (c: Canal, patch: Partial<Annonce>) => {
    const existante = annonce(c) ?? { canal: c, connecte: false };
    const suivante = { ...existante, ...patch };
    const annonces = annonce(c) ? l.annonces.map((a) => (a.canal === c ? suivante : a)) : [...l.annonces, suivante];
    upsert('logements', { ...l, annonces });
  };
  const connectees = l.annonces.filter((a) => a.connecte).length;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        {l.statut !== 'actif' && connectees > 0 && (
          <Alert tone="alerte" titre="Annonces connectées sur un logement non actif">
            Fermez le calendrier des canaux tant que le logement n’est pas actif.
          </Alert>
        )}
        {CANAUX.map((c) => {
          const a = annonce(c);
          return (
            <Card key={c}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or)">
                  <Radio className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{LIBELLES.canal[c]}</p>
                  <p className="text-[12.5px] text-(--lm-encre-2)">
                    {a ? (a.connecte ? (l.repull ? 'Synchronisé via Repull' : 'Connectée (suivi manuel)') : 'Annonce non synchronisée') : 'Aucune annonce créée'}
                  </p>
                </div>
                {a?.connecte ? (
                  <Badge tone="succes" point>Connecté</Badge>
                ) : (
                  <Badge tone={a ? 'alerte' : 'neutre'} point>{a ? 'Déconnecté' : 'Absent'}</Badge>
                )}
                {!(importe && c !== 'direct') && (
                  <Button size="sm" icone={a?.connecte ? <Link2Off /> : <Link2 />} onClick={() => majAnnonce(c, { connecte: !a?.connecte })}>
                    {a?.connecte ? 'Déconnecter' : 'Connecter'}
                  </Button>
                )}
              </div>
              {c !== 'direct' && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <Field label="URL de l’annonce" className="min-w-0 flex-1">
                    <Input value={urls[c]} onChange={(e) => setUrls((u) => ({ ...u, [c]: e.target.value }))} placeholder="https://" />
                  </Field>
                  <div className="flex gap-2">
                    <Button size="md" onClick={() => majAnnonce(c, { url: urls[c].trim() || undefined })} disabled={(a?.url ?? '') === urls[c].trim()}>
                      Enregistrer
                    </Button>
                    {a?.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-(--lm-bord-fort) px-3 text-sm font-medium hover:bg-(--lm-surface-2)"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        Ouvrir
                      </a>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        <Alert tone="info" titre="Clause contractuelle">
          Le propriétaire ne modifie pas l’annonce sans concertation avec Label Maison.
        </Alert>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <CarteAnnonceLogement logement={l} />
        <Card>
          <CardHeader titre="Repull" description="Relie Airbnb, Booking.com et les autres plateformes : annonces, réservations, messages et avis arrivent seuls dans l’ERP." />
          {importe ? (
            <>
              <Badge tone="succes" point className="mb-3">
                Importé de Repull · annonce n° {l.repull?.id}
              </Badge>
              {!!l.repull?.canaux?.length && (
                <ul className="mb-2 space-y-1 text-[12.5px] text-(--lm-encre-2)">
                  {l.repull.canaux.map((ch) => (
                    <li key={`${ch.plateforme}-${ch.idExterne}`}>
                      {canalAnnonceLibelle(ch.plateforme)} : <span className="lm-chiffres">{ch.idExterne}</span> {ch.actif ? '' : '(inactive)'}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[12.5px] text-(--lm-encre-3)">
                Nom, adresse, capacité, horaires, wifi et état des annonces sont tenus à jour par Repull. Propriétaire, mandat, serrure, linge et checklist restent à l’équipe.
              </p>
            </>
          ) : (
            <>
              <Badge tone={l.repull?.id ? 'info' : 'alerte'} point className="mb-3">
                {l.repull?.id ? `Relié à l’annonce Repull n° ${l.repull.id}` : 'Pas encore relié à Repull'}
              </Badge>
              <p className="mb-3 text-[12.5px] text-(--lm-encre-2)">
                Connectez l’annonce dans{' '}
                <a href="https://repull.dev/dashboard" target="_blank" rel="noreferrer" className="text-(--lm-or) hover:underline">
                  Repull
                </a>{' '}
                : elle arrive dans l’ERP à la synchronisation suivante. Pour qu’elle mette à jour ce logement plutôt que d’en créer un second, saisissez son identifiant d’annonce Repull.
              </p>
              <Field label="Identifiant d’annonce Repull">
                <Input value={idRepull} onChange={(e) => setIdRepull(e.target.value)} placeholder="ex. 5668" inputMode="numeric" />
              </Field>
              <Button
                className="mt-3 w-full"
                onClick={() => upsert('logements', { ...l, repull: idRepull.trim() ? { ...(l.repull ?? {}), id: idRepull.trim() } : undefined })}
                disabled={(l.repull?.id ?? '') === idRepull.trim()}
              >
                Relier à Repull
              </Button>
            </>
          )}
        </Card>
        <Card>
          <CardHeader titre="Accès voyageur" />
          <p className="flex items-center gap-2 text-[13.5px]">
            <KeyRound className="size-4 text-(--lm-or)" aria-hidden />
            {LIBELLES.serrure[l.serrure]}
          </p>
          {l.serrure === 'cles' && <p className="mt-2 text-[12.5px] text-(--lm-alerte)">Remise de clés : accès non sécurisé au sens de la checklist.</p>}
        </Card>
      </div>
    </div>
  );
}

function urlsDe(l: Logement): Record<Canal, string> {
  const u = (c: Canal) => l.annonces.find((a) => a.canal === c)?.url ?? '';
  return { airbnb: u('airbnb'), booking: u('booking'), direct: u('direct') };
}

function canalAnnonceLibelle(plateforme: string): string {
  const p = plateforme.toLowerCase();
  if (p === 'airbnb') return 'Airbnb';
  if (p === 'booking' || p === 'booking.com') return 'Booking.com';
  return plateforme.charAt(0).toUpperCase() + plateforme.slice(1);
}
