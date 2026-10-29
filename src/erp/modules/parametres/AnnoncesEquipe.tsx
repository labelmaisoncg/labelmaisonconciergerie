/**
 * Paramètres → Annonces à l'équipe (gérant) : publier un court message à
 * toute l'équipe de l'espace, affiché en haut de l'Accueil de chacun, et le
 * retirer. « Prévenir aussi par notification » (proposée quand les
 * notifications marchent sur le serveur) l'envoie une fois aux appareils qui
 * l'acceptent : l'annonce est d'abord enregistrée, puis le serveur la relit
 * dans la base et l'envoie (api/erp-notifications.ts, action « annoncer »).
 * En démonstration, aucun appel au serveur.
 *
 * Rien à voir avec l'annonce d'un logement sur Airbnb ou Booking : les mots
 * de l'écran disent toujours « à l'équipe » ou « Accueil ».
 * Règles : src/erp/data/annonces-equipe.ts.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Megaphone } from 'lucide-react';
import {
  annoncesPubliees,
  brouillonInitial,
  issueDeLaReponse,
  issueDeLErreur,
  messagePublication,
  preparerAnnonce,
  retirerAnnonce,
  TEXTE_MAX,
  TITRE_MAX,
  type AnnonceEquipe,
  type IssueNotification,
  type SaisieAnnonce,
} from '../../data/annonces-equipe';
import { espaceOuvert } from '../../data/espaces';
import { dateHeure, horodatageMaintenant } from '../../data/format';
import { nomConciergerie } from '../../data/marque-espace';
import { nouvelId, useErp } from '../../data/store';
import { Aide, Alert, Button, Card, CardHeader, Field, Input, Modal, Textarea } from '../../ui';
import { appelerServeur, ErreurServeur } from '../messagerie/_composants/serveur';
import { useNotifications } from './_application/notifications';

/** Message sous le formulaire ; `reessayer` : l'annonce dont la notification peut être relancée. */
type Retour = ReturnType<typeof messagePublication> & { reessayer?: string };

export default function AnnoncesEquipe() {
  const d = useErp();
  const n = useNotifications();
  // La case n'est proposée que si les notifications marchent sur le serveur (démonstration : pour montrer ce qui partirait).
  const notificationsPossibles = d.demo || n.serveurActif;
  const publiees = useMemo(() => annoncesPubliees(d.annoncesEquipe), [d.annoncesEquipe]);
  // Tant que l'espace n'a aucune annonce : le premier message, prêt à publier.
  const [saisie, setSaisie] = useState<SaisieAnnonce>(() => brouillonInitial(d.annoncesEquipe, nomConciergerie(espaceOuvert())));
  const [notifier, setNotifier] = useState(true);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof SaisieAnnonce, string>>>({});
  const [enCours, setEnCours] = useState(false);
  const [reessai, setReessai] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);
  const [aRetirer, setARetirer] = useState<AnnonceEquipe | null>(null);

  /** Enregistrée d'abord, puis l'action « annoncer » : le serveur ne lit que la base. */
  const annoncer = async (id: string): Promise<IssueNotification> => {
    if (d.demo) return { genre: 'demo' };
    if (!(await d.enregistrerMaintenant())) return { genre: 'non-enregistree' };
    try {
      return issueDeLaReponse(await appelerServeur<{ envoyees?: number; dejaPartie?: boolean; appareils?: number }>('/api/erp-notifications', 'POST', { action: 'annoncer', id }));
    } catch (err) {
      return err instanceof ErreurServeur ? issueDeLErreur(err.code, err.message) : issueDeLErreur(undefined, undefined);
    }
  };

  const montrer = (issue: IssueNotification, id: string) => {
    const relancer = issue.genre === 'non-enregistree' || (issue.genre === 'echec' && issue.reessayable);
    setRetour({ ...messagePublication(issue), ...(relancer ? { reessayer: id } : {}) });
  };

  const publier = async (e: FormEvent) => {
    e.preventDefault();
    if (enCours) return;
    const r = preparerAnnonce(saisie, { id: nouvelId('aeq'), maintenant: horodatageMaintenant(), par: d.utilisateur.nom });
    if (!r.ok) {
      setErreurs(r.erreurs);
      return;
    }
    setErreurs({});
    setRetour(null);
    setEnCours(true);
    // D'abord enregistrée : elle reste publiée quoi qu'il arrive à la notification.
    d.upsert('annoncesEquipe', r.annonce);
    setSaisie({ titre: '', texte: '' });
    montrer(notifier && notificationsPossibles ? await annoncer(r.annonce.id) : { genre: 'sans' }, r.annonce.id);
    setEnCours(false);
  };

  const reessayer = async () => {
    const id = retour?.reessayer;
    if (!id || reessai) return;
    setReessai(true);
    montrer(await annoncer(id), id);
    setReessai(false);
  };

  const retirer = () => {
    if (!aRetirer) return;
    d.upsert('annoncesEquipe', retirerAnnonce(aRetirer, { maintenant: horodatageMaintenant(), par: d.utilisateur.nom }));
    setARetirer(null);
    setRetour(null);
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader titre="Nouvelle annonce à l’équipe" />
        <form onSubmit={(e) => void publier(e)} className="flex flex-col gap-4" noValidate>
          <Field label="Titre" erreur={erreurs.titre}>
            <Input value={saisie.titre} maxLength={TITRE_MAX} onChange={(e) => setSaisie({ ...saisie, titre: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Texte" erreur={erreurs.texte}>
            <Textarea value={saisie.texte} maxLength={TEXTE_MAX} rows={4} onChange={(e) => setSaisie({ ...saisie, texte: e.target.value })} />
          </Field>
          {notificationsPossibles && (
            <label className="-my-1 flex min-h-11 cursor-pointer items-start gap-3 py-1">
              <input type="checkbox" className="mt-0.5 size-[18px] shrink-0 accent-(--lm-or-texte)" checked={notifier} onChange={(e) => setNotifier(e.target.checked)} />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-(--lm-encre)">Prévenir aussi par notification</span>
                <span className="block text-[12.5px] text-(--lm-encre-2)">Sur les appareils qui ont activé les notifications.</span>
              </span>
            </label>
          )}
          {retour && (
            <Alert
              tone={retour.ton}
              actionsDessous
              actions={
                retour.reessayer ? (
                  <Button size="sm" variant="secondary" chargement={reessai} onClick={() => void reessayer()}>
                    Réessayer
                  </Button>
                ) : undefined
              }
            >
              {retour.texte}
            </Alert>
          )}
          <div>
            <Button type="submit" variant="primary" icone={<Megaphone />} chargement={enCours} className="w-full sm:w-auto">
              Publier
            </Button>
          </div>
        </form>
      </Card>

      {publiees.length > 0 && (
        <Card>
          <CardHeader titre="Sur l’Accueil de l’équipe" />
          <ul className="-mb-2 divide-y divide-(--lm-bord) border-t border-(--lm-bord)">
            {publiees.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-(--lm-encre)">{a.titre}</p>
                  <p className="truncate text-[12.5px] text-(--lm-encre-2)">
                    {a.publieePar ? `${a.publieePar} · ` : ''}
                    {dateHeure(a.publieeLe)}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setARetirer(a)} aria-label={`Retirer « ${a.titre} » de l’Accueil`}>
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Aide className="mb-0">
        Chaque membre voit l’annonce en haut de son Accueil jusqu’à ce qu’il touche « J’ai lu ». Une personne qui rejoint l’équipe plus tard voit les annonces encore publiées.
        La notification part une seule fois, vers les appareils qui l’acceptent ; la case « Prévenir aussi par notification » apparaît quand les notifications sont activées
        (Paramètres → Application). Retirer une annonce la fait disparaître pour tout le monde.
      </Aide>

      <Modal
        ouvert={!!aRetirer}
        onFermer={() => setARetirer(null)}
        taille="sm"
        titre="Retirer de l’Accueil ?"
        description={aRetirer ? `« ${aRetirer.titre} » disparaîtra pour toute l’équipe.` : undefined}
        pied={
          <>
            <Button variant="secondary" onClick={() => setARetirer(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={retirer}>
              Retirer de l’Accueil
            </Button>
          </>
        }
      />
    </div>
  );
}
