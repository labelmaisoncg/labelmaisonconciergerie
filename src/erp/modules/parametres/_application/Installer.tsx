/**
 * /erp/installer : la page du lien envoyé à l'équipe. Après la connexion,
 * elle reconnaît l'appareil et donne la marche à suivre : bouton « Installer »
 * quand le navigateur le permet, sinon les étapes (Safari → Partager → Sur
 * l'écran d'accueil sur iPhone). Ouverte depuis l'app, elle mène aux
 * notifications.
 */
import { Link } from 'react-router-dom';
import { Bell, Check, Download } from 'lucide-react';
import { Badge, Button, ButtonLink, Card } from '../../../ui';
import { EtapesInstallation, LienInstallation, useInstallation } from './installation';

const TITRE_ETAPES = { iphone: 'Sur votre iPhone', android: 'Sur votre téléphone Android', ordinateur: 'Sur votre ordinateur' } as const;

export default function Installer() {
  const inst = useInstallation();

  return (
    <main className="min-h-screen px-4 pt-10 pb-[max(3rem,env(safe-area-inset-bottom))] sm:pt-16">
      <div className="mx-auto flex max-w-md flex-col">
        <img src="/erp-app/icone-192.png" alt="" width={72} height={72} className="size-18 rounded-2xl shadow-(--lm-ombre)" />
        <h1 className="lm-serif mt-5 text-[28px] leading-tight text-(--lm-encre)">Installer l’app Label Maison</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-(--lm-encre-2)">
          Réservations, messages des voyageurs, problèmes signalés : une notification sur votre téléphone, comme une vraie app.
        </p>

        <Card className="mt-6">
          {inst.dansLApp ? (
            <>
              <Badge tone="succes" icone={<Check />}>
                L’app est installée
              </Badge>
              <p className="mt-3 text-[14px] text-(--lm-encre)">Dernière étape : activez les notifications sur cet appareil.</p>
              <ButtonLink to="/erp/parametres/application" variant="primary" size="lg" icone={<Bell />} className="mt-4 w-full">
                Activer les notifications
              </ButtonLink>
            </>
          ) : inst.installee ? (
            <>
              <Badge tone="succes" icone={<Check />}>
                Déjà installée
              </Badge>
              <p className="mt-3 text-[14px] text-(--lm-encre)">
                Ouvrez l’app <strong className="font-semibold">Label Maison</strong> depuis l’écran d’accueil ou vos applications, puis activez les notifications.
              </p>
            </>
          ) : inst.directe ? (
            <>
              <h2 className="text-[15px] font-semibold text-(--lm-encre)">{TITRE_ETAPES[inst.appareil]}</h2>
              <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">Un clic : l’app s’ajoute {inst.appareil === 'ordinateur' ? 'à vos applications' : 'à l’écran d’accueil'}.</p>
              <Button variant="primary" size="lg" icone={<Download />} className="mt-4 w-full" onClick={() => void inst.installer()}>
                Installer l’app
              </Button>
            </>
          ) : (
            <>
              <h2 className="mb-3 text-[15px] font-semibold text-(--lm-encre)">{TITRE_ETAPES[inst.appareil]}</h2>
              <EtapesInstallation appareil={inst.appareil} />
              {inst.appareil === 'iphone' && <p className="mt-4 text-[12.5px] text-(--lm-encre-3)">Notifications : iPhone avec iOS 16.4 ou plus récent.</p>}
            </>
          )}
        </Card>

        <div className="mt-6">
          <p className="mb-2 text-[13px] text-(--lm-encre-2)">Envoyer le lien à quelqu’un de l’équipe :</p>
          <LienInstallation />
        </div>

        <p className="mt-8 text-center text-[13.5px]">
          <Link to="/erp" className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
            {inst.dansLApp ? 'Ouvrir l’accueil' : 'Continuer dans le navigateur'}
          </Link>
        </p>
      </div>
    </main>
  );
}
