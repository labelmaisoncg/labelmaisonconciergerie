import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, PenLine, RotateCcw } from 'lucide-react';
import {
  canalParDefaut,
  LIBELLE_PROFIL,
  noterRelanceEnvoyee,
  prochaineAction,
  profilContact,
  scoreContact,
  type CanalRelance,
  type Relance,
} from '../../../data/crm-assistant';
import { MODE_DEMO } from '../../../data/config';
import { espaceOuvert } from '../../../data/espaces';
import { AUJOURDHUI, horodatageMaintenant } from '../../../data/format';
import { signatureEspace } from '../../../data/marque-espace';
import { useErp } from '../../../data/store';
import type { ContactCrm } from '../../../data/types';
import { Alert, Button, Drawer, Field, Input, Segmente, Skeleton, Textarea } from '../../../ui';
import { demanderRelance } from './relance';

export interface PreparerRelanceProps {
  contact: ContactCrm | undefined;
  /** Ouverte depuis « Préparer la relance » : le brouillon est demandé tout de suite (un clic). */
  auto: boolean;
  onFermer: () => void;
  onModifier: (c: ContactCrm) => void;
  onOuvrirFiche: (id: string) => void;
  auteur: string;
  lectureSeule: boolean;
}

type Etat = { etape: 'vide' } | { etape: 'chargement' } | { etape: 'pret'; relance: Relance; avis?: string } | { etape: 'erreur'; message: string };

const NOM_CANAL: Record<CanalRelance, string> = { sms: 'SMS', email: 'E-mail' };

/**
 * Relance d'un contact : la prochaine action, pourquoi il est en tête de la
 * file (points), puis le brouillon rédigé par l'IA (SMS ou e-mail), à
 * relire, retoucher et copier. Rien n'est envoyé par l'ERP : « C’est
 * envoyé » note seulement la relance dans l'historique et fixe la suivante.
 */
export function PreparerRelance({ contact, auto, onFermer, onModifier, onOuvrirFiche, auteur, lectureSeule }: PreparerRelanceProps) {
  const d = useErp();
  const [canal, setCanal] = useState<CanalRelance | null>(null);
  const [etats, setEtats] = useState<Partial<Record<CanalRelance, Etat>>>({});
  const [objet, setObjet] = useState('');
  const [texte, setTexte] = useState('');
  const [copie, setCopie] = useState<'ok' | 'echec' | null>(null);
  const demande = useRef(0);
  const id = contact?.id;

  const action = contact ? prochaineAction(contact, AUJOURDHUI) : undefined;
  const defaut = contact ? canalParDefaut(contact, action) : null;

  // Nouveau contact ouvert : on repart de zéro (et on demande le brouillon si l'ouverture vient du bouton).
  useEffect(() => {
    demande.current++;
    setEtats({});
    setCopie(null);
    setCanal(defaut);
    if (contact && auto && defaut) void preparer(defaut);
  }, [id]);

  if (!contact) return <Drawer ouvert={false} onFermer={onFermer} titre="">{null}</Drawer>;

  const profil = profilContact(contact);
  const score = scoreContact(contact, AUJOURDHUI);
  const etat: Etat = (canal && etats[canal]) || { etape: 'vide' };
  const possibles = (['sms', 'email'] as const).filter((x) => (x === 'sms' ? !!contact.telephone?.trim() : !!contact.email?.trim()));

  async function preparer(c: CanalRelance) {
    if (!contact) return;
    const numero = ++demande.current;
    setCopie(null);
    setEtats((e) => ({ ...e, [c]: { etape: 'chargement' } }));
    try {
      const r = await demanderRelance(contact, c, { demo: MODE_DEMO, signature: signatureEspace(d, espaceOuvert()) });
      if (numero !== demande.current) return;
      setEtats((e) => ({ ...e, [c]: { etape: 'pret', relance: r.relance, avis: r.avis } }));
      setObjet(r.relance.objet ?? '');
      setTexte(r.relance.texte);
    } catch (err) {
      if (numero !== demande.current) return;
      setEtats((e) => ({ ...e, [c]: { etape: 'erreur', message: err instanceof Error ? err.message : 'Votre agent ne répond pas pour l’instant : réessayez dans un instant.' } }));
    }
  }

  const choisirCanal = (c: CanalRelance) => {
    setCanal(c);
    setCopie(null);
    const deja = etats[c];
    if (deja?.etape === 'pret') {
      setObjet(deja.relance.objet ?? '');
      setTexte(deja.relance.texte);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte.trim());
      setCopie('ok');
    } catch {
      setCopie('echec');
    }
  };

  const envoye = () => {
    if (!canal) return;
    onModifier(noterRelanceEnvoyee(contact, canal, auteur, horodatageMaintenant(), AUJOURDHUI));
    onFermer();
  };

  const pret = etat.etape === 'pret';
  const pied = !canal ? undefined : pret ? (
    <>
      {!lectureSeule && (
        <Button variant="secondary" icone={<Check />} onClick={envoye} disabled={!texte.trim()}>
          C’est envoyé
        </Button>
      )}
      <Button variant="primary" icone={copie === 'ok' ? <Check /> : <Copy />} onClick={copier} disabled={!texte.trim()}>
        {copie === 'ok' ? 'Copié' : 'Copier'}
      </Button>
    </>
  ) : (
    <Button variant="primary" icone={<PenLine />} chargement={etat.etape === 'chargement'} onClick={() => void preparer(canal)}>
      {etat.etape === 'erreur' ? 'Réessayer' : 'Préparer la relance'}
    </Button>
  );

  return (
    <Drawer
      ouvert
      onFermer={onFermer}
      titre={contact.nom}
      sousTitre={[LIBELLE_PROFIL[profil], contact.ville].filter(Boolean).join(' · ')}
      pied={pied}
    >
      <div className="space-y-5">
        <section aria-labelledby="relance-action">
          <h3 id="relance-action" className="text-[12.5px] font-medium text-(--lm-encre-3)">
            Prochaine action
          </h3>
          <p className="mt-1 text-[15px] text-(--lm-encre)">{action?.phrase}</p>
          <details className="group mt-2">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
              Pourquoi en tête de la file ? {score.points} points
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="mt-1 space-y-1 rounded-lg bg-(--lm-surface-2) px-3 py-2 text-[13px] text-(--lm-encre-2)">
              {score.raisons.map((r) => (
                <li key={r.libelle} className="flex justify-between gap-3">
                  <span>{r.libelle}</span>
                  <span className="lm-chiffres shrink-0">{r.points > 0 ? `+${r.points}` : r.points}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        {possibles.length === 0 ? (
          <Alert tone="alerte" titre="Ni téléphone ni e-mail dans la fiche.">
            <Button size="sm" variant="secondary" onClick={() => onOuvrirFiche(contact.id)}>
              Ouvrir la fiche
            </Button>
          </Alert>
        ) : (
          <section aria-labelledby="relance-brouillon" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="relance-brouillon" className="text-[14px] font-semibold text-(--lm-encre)">
                Relance
              </h3>
              {possibles.length > 1 && canal && (
                <Segmente label="Envoyer par" valeur={canal} onChange={choisirCanal} options={possibles.map((x) => ({ valeur: x, libelle: NOM_CANAL[x] }))} />
              )}
            </div>
            {etat.etape === 'vide' && <p className="text-[13.5px] text-(--lm-encre-2)">Votre agent rédige un {canal === 'email' ? 'e-mail' : 'SMS'} au ton de la maison. Vous le relisez avant de l’envoyer.</p>}
            {etat.etape === 'chargement' && (
              <div className="space-y-2" aria-live="polite" aria-busy>
                <p className="text-[13.5px] text-(--lm-encre-2)">Votre agent rédige…</p>
                <Skeleton className="h-28 w-full" />
              </div>
            )}
            {etat.etape === 'erreur' && <Alert tone="alerte">{etat.message}</Alert>}
            {pret && (
              <>
                {canal === 'email' && (
                  <Field label="Objet">
                    <Input value={objet} onChange={(e) => setObjet(e.target.value)} />
                  </Field>
                )}
                <Field label={canal === 'email' ? 'Message' : 'SMS'}>
                  <Textarea
                    rows={canal === 'email' ? 10 : 6}
                    value={texte}
                    onChange={(e) => {
                      setTexte(e.target.value);
                      setCopie(null);
                    }}
                  />
                </Field>
                {etat.avis && <p className="text-[12.5px] text-(--lm-encre-2)">{etat.avis}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-(--lm-encre-3)" role="status" aria-live="polite">
                    {copie === 'echec'
                      ? 'Copie impossible : sélectionnez le texte.'
                      : `${canal === 'sms' ? `${texte.length} caractères · ` : ''}Rien n’est envoyé par l’ERP.`}
                  </p>
                  <Button size="sm" variant="ghost" icone={<RotateCcw />} onClick={() => canal && void preparer(canal)}>
                    Réécrire
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </Drawer>
  );
}
