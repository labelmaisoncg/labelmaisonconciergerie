import { LogIn, LogOut, ShieldCheck, UserX, Wrench } from 'lucide-react';
import { jourMois } from '../data/format';
import type { ElementProgrammeOps } from '../data/types-operations';
import { Button } from '../ui';
import { LigneControle } from './Controles';
import { LigneIncident } from './Incidents';
import { LienAction, Ligne, Liste, Rubrique, TitreEspace, court, useOps } from './commun';

const MAX = 5;

/**
 * Accueil de l'espace (pensé pour le téléphone) : les urgences d'abord, puis
 * les incidents ouverts, les contrôles en retard, le programme du jour sur
 * ses logements et, pour le responsable de pôle, qui remplace qui.
 */
export function Aujourdhui() {
  const { vue, pole, naviguer } = useOps();
  const ouverts = vue.incidents.filter((i) => i.statut !== 'resolu');
  const urgences = ouverts.filter((i) => i.urgent);
  const normaux = ouverts.filter((i) => !i.urgent);
  const enRetard = vue.controles.filter((c) => c.enRetard);
  const calme = !urgences.length && !normaux.length && !enRetard.length;
  const date = new Date(`${vue.aujourdhui}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <TitreEspace
        titre={`Bonjour, ${vue.moi.nom.split(' ')[0]}`}
        description={date.charAt(0).toUpperCase() + date.slice(1)}
        action={
          <Button variant="primary" onClick={() => naviguer({ signaler: '' })}>
            Signaler un incident
          </Button>
        }
      />

      {calme && (
        <p className="mb-7 flex items-center gap-2 rounded-xl border border-(--lm-bord) bg-(--lm-surface) px-4 py-3 text-[14px] text-(--lm-encre-2)">
          <ShieldCheck className="size-5 shrink-0 text-(--lm-succes)" aria-hidden />
          Rien d’urgent : aucun incident ouvert, aucun contrôle en retard.
        </p>
      )}

      {urgences.length > 0 && (
        <Rubrique titre={`Urgences (${urgences.length})`}>
          <Liste label="Urgences">
            {urgences.map((i) => (
              <LigneIncident key={i.id} incident={i} />
            ))}
          </Liste>
        </Rubrique>
      )}

      {normaux.length > 0 && (
        <Rubrique
          titre={pole ? `Incidents ouverts (${normaux.length})` : `Mes incidents (${normaux.length})`}
          action={normaux.length > MAX && <LienAction onClick={() => naviguer({ onglet: 'incidents' })}>Tout voir</LienAction>}
        >
          <Liste label="Incidents ouverts">
            {normaux.slice(0, MAX).map((i) => (
              <LigneIncident key={i.id} incident={i} />
            ))}
          </Liste>
        </Rubrique>
      )}

      {enRetard.length > 0 && (
        <Rubrique titre={`Contrôles en retard (${enRetard.length})`}>
          <Liste label="Contrôles en retard">
            {enRetard.map((c) => (
              <LigneControle key={c.cle} c={c} />
            ))}
          </Liste>
        </Rubrique>
      )}

      <Rubrique titre="Programme du jour">
        {vue.programme.length ? (
          <Liste label="Programme du jour">
            {vue.programme.map((e) => {
              const c = e.controleCle ? vue.controles.find((x) => x.cle === e.controleCle) : undefined;
              return c ? <LigneControle key={e.cle} c={c} /> : <LigneProgramme key={e.cle} e={e} />;
            })}
          </Liste>
        ) : (
          <p className="text-[13.5px] text-(--lm-encre-2)">Ni arrivée, ni départ, ni intervention aujourd’hui sur vos logements.</p>
        )}
      </Rubrique>

      {pole && vue.absences.length > 0 && (
        <Rubrique titre="Absences et remplacements" action={<LienAction onClick={() => naviguer({ onglet: 'equipe' })}>Équipe</LienAction>}>
          <Liste label="Absences">
            {vue.absences.map((a) => {
              const m = vue.equipe.find((x) => x.id === a.membreId);
              // Ses logements, suivis aujourd'hui par leur remplaçant.
              const siens = new Set(vue.affectations.filter((x) => x.responsableId === a.membreId).map((x) => x.id));
              const repris = [...new Set(vue.logements.filter((l) => siens.has(l.id) && l.suiviPar && l.suiviPar !== m?.nom).map((l) => court(l.suiviPar)))];
              return (
                <Ligne
                  key={a.id}
                  icone={<UserX />}
                  titre={m?.nom ?? 'Membre'}
                  sousTitre={[a.du <= vue.aujourdhui ? `Absence jusqu’au ${jourMois(a.au)}` : `Absence du ${jourMois(a.du)} au ${jourMois(a.au)}`, repris.length ? `relais : ${repris.join(', ')}` : undefined]
                    .filter(Boolean)
                    .join(' · ')}
                  onClick={() => naviguer({ onglet: 'equipe', absence: a.id })}
                />
              );
            })}
          </Liste>
        </Rubrique>
      )}
    </>
  );
}

/** Départ, arrivée ou intervention : le logement, ce qui s'y passe, l'heure à droite. */
function LigneProgramme({ e }: { e: ElementProgrammeOps }) {
  const { vue, naviguer, nomLogement } = useOps();
  const s = e.reservationId ? vue.sejours.find((x) => x.id === e.reservationId) : undefined;
  const voyageurs = s ? `${s.voyageur}${s.nbPersonnes ? `, ${s.nbPersonnes} pers.` : ''}` : '';
  const modele =
    e.type === 'depart'
      ? { icone: <LogOut />, texte: `Départ${voyageurs ? ` · ${voyageurs}` : ''}` }
      : e.type === 'arrivee'
        ? { icone: <LogIn />, texte: `Arrivée${voyageurs ? ` · ${voyageurs}` : ''}` }
        : { icone: <Wrench />, texte: 'Intervention' };
  return (
    <Ligne
      icone={modele.icone}
      titre={nomLogement(e.logementId)}
      sousTitre={modele.texte}
      fin={e.heure && <span className="lm-chiffres text-[13px] text-(--lm-encre-2)">{e.heure}</span>}
      onClick={() => naviguer({ logement: e.logementId })}
    />
  );
}
