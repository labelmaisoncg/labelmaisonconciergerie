import { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { EMAIL_SUR, telephoneNormalise } from '../../../data/crm';
import { ADRESSE_DOSSIER } from '../../../data/dossier-proprietaire';
import { espaceOuvert } from '../../../data/espaces';
import { dossierProprietaireDisponible } from '../../../data/marque-espace';
import type { ContactCrm } from '../../../data/types';
import { Alert, Button, classesBouton, Modal } from '../../../ui';

/** Numéro au format international pour WhatsApp (06… → 336…). */
function numeroWhatsapp(tel: string | undefined): string | undefined {
  const n = telephoneNormalise(tel);
  if (/^0[67]\d{8}$/.test(n)) return `33${n.slice(1)}`;
  return undefined;
}

export type CanalEnvoi = 'WhatsApp' | 'SMS' | 'e-mail';

/**
 * « Envoyer le dossier » : le lien du dossier propriétaire (le même pour
 * tous), avec un message prêt à partir par WhatsApp, SMS ou e-mail.
 * Label Maison seulement : les réponses arrivent dans son CRM et sa boîte.
 */
export function EnvoyerDossier({
  ouvert,
  onFermer,
  contact,
  onEnvoye,
}: {
  ouvert: boolean;
  onFermer: () => void;
  /** Sans contact : le lien seul (menu « Plus » du CRM). */
  contact?: ContactCrm;
  /** Trace dans l'historique du contact. */
  onEnvoye?: (canal: CanalEnvoi) => void;
}) {
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState('');
  const prenom = contact?.nom.trim().split(/\s+/)[0];
  const message = `Bonjour${prenom ? ` ${prenom}` : ''}, merci pour notre échange. Voici votre dossier propriétaire Label Maison, à remplir en 3 minutes : ${ADRESSE_DOSSIER}`;
  const whatsapp = numeroWhatsapp(contact?.telephone);
  const sms = contact?.telephone?.replace(/[^\d+]/g, '');
  const email = contact?.email && EMAIL_SUR.test(contact.email) ? contact.email : undefined;
  if (!dossierProprietaireDisponible(espaceOuvert())) return null;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(contact ? message : ADRESSE_DOSSIER);
      setCopie(true);
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setErreur('Copie impossible : sélectionnez le texte et copiez-le à la main.');
    }
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Envoyer le dossier propriétaire"
      description="Le propriétaire répond en 3 minutes. Son logement et sa fiche arrivent dans l’ERP, et vous recevez le récapitulatif par e-mail."
      pied={
        <Button variant="ghost" onClick={onFermer}>
          Fermer
        </Button>
      }
    >
      <div className="space-y-4 text-[13.5px]">
        <div>
          <p className="mb-1.5 font-medium text-(--lm-encre)">{contact ? 'Message' : 'Lien du dossier'}</p>
          <p className="rounded-lg border border-(--lm-bord) bg-(--lm-surface-2) px-3 py-2.5 break-words text-(--lm-encre-2)">{contact ? message : ADRESSE_DOSSIER}</p>
        </div>
        {erreur && <Alert tone="danger" titre={erreur} />}
        <div className="flex flex-wrap gap-2">
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onEnvoye?.('WhatsApp')}
              className={classesBouton('primary')}
            >
              <MessageCircle aria-hidden /> WhatsApp
            </a>
          )}
          {sms && (
            <a href={`sms:${sms}?&body=${encodeURIComponent(message)}`} onClick={() => onEnvoye?.('SMS')} className={classesBouton(whatsapp ? 'secondary' : 'primary')}>
              <MessageSquare aria-hidden /> SMS
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent('Votre dossier propriétaire Label Maison')}&body=${encodeURIComponent(message)}`}
              onClick={() => onEnvoye?.('e-mail')}
              className={classesBouton('secondary')}
            >
              <Mail aria-hidden /> E-mail
            </a>
          )}
          <Button variant={whatsapp || sms ? 'secondary' : 'primary'} icone={copie ? <Check /> : <Copy />} onClick={() => void copier()}>
            {copie ? 'Copié' : contact ? 'Copier le message' : 'Copier le lien'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
