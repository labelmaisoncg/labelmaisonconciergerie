/**
 * Paramètres → Application : installer l'app sur cet appareil, le lien à
 * envoyer à l'équipe, et les notifications de cet appareil (une par type,
 * notification d'essai). Le gérant trouve dans « Avancé » les clés du serveur
 * de notifications, à ranger une fois dans Vercel.
 */
import { useState } from 'react';
import { Bell, Check, Copy, Download, KeyRound, Send } from 'lucide-react';
import { espaceOuvert } from '../../data/espaces';
import { notificationsIphone, titreCarteApp } from '../../data/marque-espace';
import { useErp } from '../../data/store';
import { TYPES_NOTIFICATION } from '../../data/notifications';
import { Alert, Badge, Button, Card, CardHeader, Interrupteur, Repli, Skeleton, cn } from '../../ui';
import { EtapesInstallation, LienInstallation, useInstallation } from './_application/installation';
import { genererCles, useNotifications, PREFERENCES_DEFAUT, type ClesGenerees } from './_application/notifications';

export default function Application() {
  const { utilisateur } = useErp();
  const inst = useInstallation();
  const n = useNotifications();
  // Un seul bouton principal : installer d'abord quand le navigateur le propose.
  const installerEnPremier = !inst.installee && inst.directe;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <CarteInstallation inst={inst} principal={installerEnPremier} />
      <CarteNotifications n={n} gerant={utilisateur.role === 'gerant'} principal={!installerEnPremier} />
      {utilisateur.role === 'gerant' && <Avance serveurActif={n.serveurActif} demo={n.etape === 'demo'} />}
    </div>
  );
}

/* ---------------------------------------------------------- installation */

function CarteInstallation({ inst, principal }: { inst: ReturnType<typeof useInstallation>; principal: boolean }) {
  const [refus, setRefus] = useState(false);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <img src="/erp-app/icone-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-(--lm-encre)">{titreCarteApp(espaceOuvert())}</h3>
            {inst.installee && (
              <Badge tone="succes" icone={<Check />}>
                Installée
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-(--lm-encre-2)">
            {inst.dansLApp
              ? 'Vous utilisez l’app. Elle se met à jour toute seule.'
              : inst.installee
                ? 'L’app est installée sur cet appareil : ouvrez-la depuis l’écran d’accueil ou vos applications.'
                : 'Sur l’écran d’accueil du téléphone ou dans le Dock, comme une vraie app, avec les notifications.'}
          </p>
        </div>
      </div>

      {!inst.installee && inst.directe && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant={principal ? 'primary' : 'secondary'}
            icone={<Download />}
            onClick={() =>
              void inst.installer().then((ok) => {
                setRefus(!ok);
              })
            }
          >
            Installer l’app
          </Button>
          {refus && <span className="text-[13px] text-(--lm-encre-2)">Installation annulée. Vous pourrez la relancer d’ici.</span>}
        </div>
      )}
      {!inst.installee && !inst.directe && <EtapesInstallation appareil={inst.appareil} className="mt-4" />}

      <div className="mt-4 border-t border-(--lm-bord) pt-4">
        <p className="mb-2 text-[13px] text-(--lm-encre-2)">Pour l’équipe : envoyez ce lien. Chacun se connecte, puis suit les étapes de son téléphone.</p>
        <LienInstallation />
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- notifications */

function CarteNotifications({ n, gerant, principal }: { n: ReturnType<typeof useNotifications>; gerant: boolean; principal: boolean }) {
  const actives = n.etape === 'actives';
  const listeVisible = actives || n.etape === 'demo';

  return (
    <Card>
      <CardHeader
        titre="Notifications"
        description="Réservations, messages des voyageurs, problèmes signalés : une notification sur cet appareil, même app fermée."
        actions={
          actives ? (
            <Badge tone="succes" point>
              Activées
            </Badge>
          ) : undefined
        }
      />

      {n.retour && (
        <Alert tone={n.retour.ton} className="mb-3">
          {n.retour.texte}
        </Alert>
      )}

      {n.etape === 'chargement' && (
        <div role="status" aria-label="Chargement" className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
        </div>
      )}
      {n.etape === 'demo' && (
        <Alert tone="neutre" className="mb-3">
          Indisponible en démonstration.
        </Alert>
      )}
      {n.etape === 'serveur-inactif' && (
        <Alert tone="neutre" titre="Notifications pas encore activées sur le serveur">
          {gerant ? 'Activez-les une fois pour toute l’équipe : Avancé, plus bas.' : 'Le gérant les active une fois pour toute l’équipe.'}
        </Alert>
      )}
      {n.etape === 'iphone-hors-app' && (
        <Alert tone="info" titre="Installez d’abord l’app">
          Sur iPhone, les notifications arrivent dans l’app de l’écran d’accueil (iOS 16.4 ou plus récent). Suivez les étapes ci-dessus, puis revenez ici depuis l’app.
        </Alert>
      )}
      {n.etape === 'navigateur' && (
        <Alert tone="neutre" titre="Ce navigateur ne reçoit pas les notifications">
          Utilisez Chrome, Edge ou Safari à jour.
        </Alert>
      )}
      {n.etape === 'refusee' && (
        <Alert
          tone="alerte"
          titre="Notifications bloquées sur cet appareil"
          actions={
            <Button size="sm" variant="secondary" onClick={() => void n.relire()}>
              Vérifier
            </Button>
          }
        >
          Autorisez-les dans les réglages : sur iPhone, Réglages → {notificationsIphone(espaceOuvert())} ; dans un navigateur, le cadenas à gauche de l’adresse → Notifications.
        </Alert>
      )}
      {n.etape === 'erreur' && !n.retour && (
        <Alert tone="danger" actions={<Button size="sm" variant="secondary" onClick={() => void n.relire()}>Réessayer</Button>}>
          État des notifications illisible pour l’instant.
        </Alert>
      )}
      {n.etape === 'erreur' && n.retour && (
        <Button size="sm" variant="secondary" onClick={() => void n.relire()}>
          Réessayer
        </Button>
      )}

      {n.etape === 'a-activer' && (
        <div className="flex flex-col items-start gap-2">
          <Button variant={principal ? 'primary' : 'secondary'} icone={<Bell />} chargement={n.occupe === 'activer'} onClick={() => void n.activer()}>
            Activer les notifications
          </Button>
          <p className="text-[12.5px] text-(--lm-encre-3)">Votre appareil vous demandera l’autorisation. Vous choisirez ensuite quoi recevoir.</p>
        </div>
      )}

      {listeVisible && (
        <ul className="divide-y divide-(--lm-bord) rounded-lg border border-(--lm-bord)">
          {TYPES_NOTIFICATION.map((t) => {
            const actif = actives ? n.estActive(t.type) : PREFERENCES_DEFAUT[t.type];
            return (
              <li key={t.type}>
                <label className={cn('flex min-h-14 items-center gap-3 px-3 py-2.5', actives && 'cursor-pointer')}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-(--lm-encre)">{t.libelle}</span>
                    <span className="block text-[12.5px] text-(--lm-encre-2)">{t.detail}</span>
                  </span>
                  <Interrupteur actif={actif} onChange={(v) => void n.regler(t.type, v)} label={t.libelle} disabled={!actives} />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {actives && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" icone={<Send />} chargement={n.occupe === 'tester'} onClick={() => void n.tester()}>
            Envoyer une notification de test
          </Button>
          <Button variant="ghost" chargement={n.occupe === 'desactiver'} onClick={() => void n.desactiver()}>
            Désactiver sur cet appareil
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- avancé */

const VERCEL = 'https://vercel.com/dashboard';

function Avance({ serveurActif, demo }: { serveurActif: boolean; demo: boolean }) {
  const [cles, setCles] = useState<ClesGenerees | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const generer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      setCles(await genererCles());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Repli titre="Avancé" description="Clés du serveur de notifications (gérant)." ouvert={!!cles}>
      <div className="flex flex-col gap-3 text-[13.5px] text-(--lm-encre-2)">
        <p>
          Les notifications passent par les services d’Apple, de Google et de Mozilla. Le serveur signe chaque envoi avec une paire de clés Web Push (VAPID), rangée dans
          Vercel et jamais dans le code.
        </p>
        <p className="flex items-center gap-2">
          <span className="text-(--lm-encre-3)">Sur le serveur :</span>
          {serveurActif ? (
            <Badge tone="succes" point>
              Clés en place
            </Badge>
          ) : (
            <Badge tone="neutre" point>
              Pas encore de clés
            </Badge>
          )}
        </p>

        {erreur && <Alert tone="danger">{erreur}</Alert>}

        {!cles && (
          <div className="flex flex-col items-start gap-2">
            {serveurActif && <p>Remplacer les clés oblige chaque appareil à réactiver ses notifications.</p>}
            <Button variant="secondary" icone={<KeyRound />} chargement={enCours} disabled={demo} onClick={() => void generer()}>
              {serveurActif ? 'Générer de nouvelles clés' : 'Générer les clés'}
            </Button>
            {demo && <p className="text-[12.5px] text-(--lm-encre-3)">Indisponible en démonstration.</p>}
          </div>
        )}

        {cles && (
          <>
            <Alert tone="alerte" titre="Affichées une seule fois">
              Copiez-les maintenant dans Vercel. Ne les envoyez à personne : la clé privée permet d’envoyer des notifications en votre nom.
            </Alert>
            <dl className="flex flex-col gap-2">
              <LigneCle nom="VAPID_PUBLIC_KEY" valeur={cles.publique} />
              <LigneCle nom="VAPID_PRIVATE_KEY" valeur={cles.privee} secrete />
              <LigneCle nom="VAPID_SUBJECT" valeur="https://www.labelmaisoncg.fr" note="Facultative : c’est déjà la valeur par défaut." />
            </dl>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Ouvrez{' '}
                <a href={VERCEL} target="_blank" rel="noreferrer" className="font-medium text-(--lm-or-texte) hover:underline">
                  Vercel
                </a>
                , le projet du site, puis Settings → Environment Variables.
              </li>
              <li>Ajoutez ces variables pour l’environnement Production.</li>
              <li>Redéployez le site (Deployments → Redeploy).</li>
              <li>Revenez ici et activez les notifications sur chaque appareil.</li>
            </ol>
            <div>
              <Button variant="ghost" size="sm" onClick={() => setCles(null)}>
                J’ai copié les clés
              </Button>
            </div>
          </>
        )}
      </div>
    </Repli>
  );
}

function LigneCle({ nom, valeur, secrete, note }: { nom: string; valeur: string; secrete?: boolean; note?: string }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* copie refusée : la valeur reste sélectionnable */
    }
  };
  return (
    <div className="rounded-lg border border-(--lm-bord) px-3 py-2">
      <dt className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12.5px] font-semibold text-(--lm-encre)">{nom}</span>
        <Button size="sm" variant="secondary" icone={copie ? <Check /> : <Copy />} onClick={() => void copier()} aria-label={`Copier ${nom}`}>
          {copie ? 'Copié' : 'Copier'}
        </Button>
      </dt>
      <dd className={cn('mt-1 font-mono text-[12px] break-all text-(--lm-encre-2) select-all', secrete && 'text-(--lm-encre)')}>{valeur}</dd>
      {note && <dd className="mt-1 text-[12px] text-(--lm-encre-3)">{note}</dd>}
    </div>
  );
}
