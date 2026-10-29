import { useEffect, useState } from 'react';
import { CalendarPlus, Check, Copy } from 'lucide-react';
import { filtresAgenda, type FiltreAgenda } from '../../../data/agenda-crm';
import { espaceOuvert } from '../../../data/espaces';
import { pluriel } from '../../../data/format';
import { Alert, Button, classesBouton, Field, Modal, Select } from '../../../ui';
import { appelerRouteGerant } from './api-connecteur';

interface ReponseAgenda {
  ok?: boolean;
  erreur?: string;
  liens?: number;
  webcal?: string;
  https?: string;
}

const appelerAgenda = (corps?: Record<string, unknown>) =>
  appelerRouteGerant<ReponseAgenda>('/api/erp-agenda', corps, 'Agenda indisponible pour le moment. Réessayez dans un instant.');

const LIBELLE_FILTRE: Record<FiltreAgenda, string> = { tous: 'Toute l’équipe', abdel: 'Abdel', kamel: 'Kamel' };

/**
 * « Relances dans Calendrier » : un lien d'abonnement à l'agenda des relances
 * du CRM (api/crm-agenda). Calendrier d'Apple le relit tout seul ; chaque
 * appel et chaque relance y apparaît à sa date. Le lien n'est montré qu'une
 * fois (la base n'en garde que l'empreinte) ; « Couper » les révoque tous.
 */
export function AgendaCrm({ ouvert, onFermer, demo }: { ouvert: boolean; onFermer: () => void; demo: boolean }) {
  // Label Maison : toute l'équipe, Abdel ou Kamel ; un autre espace : toute l'équipe (pas de choix à faire).
  const choix = filtresAgenda(espaceOuvert().id).map((valeur) => ({ valeur, libelle: LIBELLE_FILTRE[valeur] }));
  const [filtre, setFiltre] = useState<FiltreAgenda>('tous');
  const [lien, setLien] = useState<{ webcal: string; https: string }>();
  const [liens, setLiens] = useState<number>();
  const [erreur, setErreur] = useState('');
  const [copie, setCopie] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState<'creer' | 'couper'>();

  useEffect(() => {
    if (!ouvert || demo) return;
    appelerAgenda().then(
      (r) => setLiens(r.liens ?? 0),
      () => setLiens(undefined), // l'état est un bonus : la création reste possible
    );
  }, [ouvert, demo]);

  const fermer = () => {
    setLien(undefined);
    setConfirmer(false);
    setErreur('');
    onFermer();
  };

  const creer = async () => {
    setEnCours('creer');
    setErreur('');
    try {
      const r = await appelerAgenda({ action: 'creer', filtre });
      if (!r.webcal || !r.https) throw new Error('Lien indisponible. Réessayez dans un instant.');
      setLien({ webcal: r.webcal, https: r.https });
      setLiens((n) => (n ?? 0) + 1);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
    }
  };

  const couper = async () => {
    setEnCours('couper');
    setErreur('');
    try {
      await appelerAgenda({ action: 'couper' });
      setLiens(0);
      setLien(undefined);
      setConfirmer(false);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(undefined);
    }
  };

  const copier = async () => {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien.https);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur('Copie impossible : sélectionnez le lien et copiez-le à la main.');
    }
  };

  const lienTexte =
    'inline-flex h-8 items-center rounded-md text-[12.5px] font-medium lm-lien focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none';

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      titre="Relances dans Calendrier"
      description="Vos appels et relances du CRM dans votre agenda, chacun à sa date, avec un rappel à 9 h. Mise à jour automatique."
      pied={
        <Button variant="ghost" onClick={fermer}>
          {lien ? 'Terminé' : 'Fermer'}
        </Button>
      }
    >
      {demo ? (
        <Alert tone="neutre" titre="Disponible avec vos données réelles." />
      ) : (
        <div className="space-y-4 text-[13.5px] text-(--lm-encre)">
          {erreur && <Alert tone="danger" titre={erreur} />}
          {lien ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a href={lien.webcal} className={classesBouton('primary', 'md', 'w-full sm:w-auto')}>
                  <CalendarPlus aria-hidden /> Ouvrir dans Calendrier
                </a>
                <Button variant="secondary" className="w-full sm:w-auto" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
                  {copie ? 'Copié' : 'Copier le lien'}
                </Button>
              </div>
              <input
                readOnly
                value={lien.https}
                aria-label="Lien de l’agenda"
                onFocus={(e) => e.target.select()}
                className="h-9 w-full rounded-lg border border-(--lm-bord-fort) bg-(--lm-surface-2) px-3 font-mono text-[12px] text-(--lm-encre-2)"
              />
              <ul className="space-y-2 text-(--lm-encre-2)">
                <li>
                  <span className="font-medium text-(--lm-encre)">iPhone ou Mac :</span> « Ouvrir dans Calendrier », puis « S’abonner ». Choisissez
                  iCloud : l’agenda suit sur tous vos appareils.
                </li>
                <li>
                  <span className="font-medium text-(--lm-encre)">Sur un autre appareil :</span> collez le lien dans Calendrier → Fichier → Nouvel
                  abonnement, ou dans Google Agenda → Autres agendas → À partir de l’URL.
                </li>
              </ul>
              <p className="text-[12.5px] text-(--lm-encre-2)">
                Ce lien montre les noms et numéros de vos contacts : gardez-le pour vous. Il ne s’affiche qu’une fois.
              </p>
            </>
          ) : (
            <>
              {choix.length > 1 && (
                <Field label="Relances de">
                  <Select value={filtre} onChange={(e) => setFiltre(e.target.value as FiltreAgenda)} options={choix} />
                </Field>
              )}
              <Button variant="primary" icone={<CalendarPlus />} chargement={enCours === 'creer'} onClick={() => void creer()}>
                Créer le lien
              </Button>
            </>
          )}
          {!!liens && (
            <div className="border-t border-(--lm-bord) pt-3 text-[12.5px] text-(--lm-encre-2)">
              <p>{pluriel(liens, 'lien actif', 'liens actifs')}</p>
              {confirmer ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span>Les agendas abonnés ne se mettront plus à jour.</span>
                  <Button size="sm" variant="danger" chargement={enCours === 'couper'} onClick={() => void couper()}>
                    Couper
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmer(false)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmer(true)} className={lienTexte}>
                  Couper tous les liens…
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
