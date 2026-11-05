import { demandesATraiter, peutVoirDemandes } from '../../../data/demandes-proprietaires';
import { useErp } from '../../../data/store';
import { Tabs } from '../../../ui';

/**
 * Logements · Avis · Demandes : vues de la même rubrique, sans entrée de menu
 * de plus. « Demandes » (celles des propriétaires, avec le nombre qui attend
 * une réponse) : le gérant seulement.
 */
export function OngletsLogements() {
  const d = useErp();
  const gerant = peutVoirDemandes(d.utilisateur.role);
  const attente = gerant ? demandesATraiter(d.demandesProprietaires).length : 0;
  return (
    <Tabs
      label="Vues des logements"
      onglets={[
        { cle: 'liste', libelle: 'Tous', to: '/erp/logements', end: true },
        { cle: 'avis', libelle: 'Avis', to: '/erp/logements/avis' },
        ...(gerant
          ? [
              {
                cle: 'demandes',
                // « Demandes des propriétaires » sur ordinateur, « Demandes » sur téléphone (l'onglet tient sur la ligne).
                libelle: (
                  <>
                    <span className="max-sm:hidden">Demandes des propriétaires</span>
                    <span className="sm:hidden">Demandes</span>
                  </>
                ),
                to: '/erp/logements/demandes',
                ...(attente ? { compteur: attente } : {}),
              },
            ]
          : []),
      ]}
    />
  );
}
