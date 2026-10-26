import { CarteSynchroRepull } from './SynchroRepull';

/**
 * Plateformes : la mise à jour depuis Airbnb et Booking.com (état réel, bouton
 * « Synchroniser maintenant », lien vers les connexions). Les détails
 * techniques restent repliés dans « Avancé ».
 */
export default function Integrations() {
  return (
    <div className="max-w-3xl">
      <CarteSynchroRepull />
    </div>
  );
}
