/**
 * Page de connexion d'un compte Airbnb ou Booking, servie sous notre domaine.
 *
 *   /connexion/<id>          la page d'accueil, avec le bouton
 *   /connexion/<id>/aller    fabrique la session Repull Connect et y redirige
 *   /connexion/<id>/retour   là où Repull renvoie la personne une fois fini
 *
 * La conciergerie part de chez Label Maison et y revient. Entre les deux, elle
 * est sur la page hébergée par Repull, puis chez Airbnb ou Booking, où elle
 * autorise l'accès avec SES identifiants — sans jamais créer de compte Repull.
 *
 * La session Repull est fabriquée au CLIC, pas à l'envoi du lien : un lien reçu
 * lundi et ouvert jeudi fonctionne encore.
 */

import { demarrerConnexion, finaliserConnexion } from '../src/comptes.js';
import * as store from '../src/store.js';

const OR = '#A97C30';
const IVOIRE = '#FBFAF8';
const ENCRE = '#14110E';

const page = (corps: string, titre: string) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${titre} — Label Maison Conciergerie</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:${IVOIRE};color:${ENCRE};min-height:100vh;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
    display:flex;flex-direction:column}
  header{padding:28px 24px 20px;text-align:center;border-bottom:1px solid rgba(20,17,14,.07)}
  .marque{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:${OR};font-weight:600}
  h1{font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:500;margin-top:10px;line-height:1.25}
  .sous{margin-top:10px;font-size:15px;line-height:1.55;color:rgba(20,17,14,.66);
    max-width:560px;margin-left:auto;margin-right:auto}
  .etapes{list-style:none;counter-reset:e;max-width:520px;margin:18px auto 0;text-align:left}
  .etapes li{counter-increment:e;position:relative;padding:7px 0 7px 34px;font-size:14.5px;
    line-height:1.5;color:rgba(20,17,14,.8)}
  .etapes li::before{content:counter(e);position:absolute;left:0;top:7px;width:22px;height:22px;
    border-radius:50%;background:${OR};color:#fff;font-size:12px;font-weight:600;
    display:flex;align-items:center;justify-content:center}
  .etapes b{color:${ENCRE};font-weight:600}
  main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:40px 22px 30px;gap:18px}
  .cta{display:inline-flex;align-items:center;justify-content:center;gap:11px;
    background:${OR};color:#fff;text-decoration:none;font-size:16.5px;font-weight:600;
    padding:19px 40px;border-radius:12px;box-shadow:0 3px 14px ${OR}3d;
    transition:transform .12s ease,box-shadow .12s ease;max-width:100%;text-align:center}
  .cta:hover{transform:translateY(-1px);box-shadow:0 6px 20px ${OR}52}
  .cta:active{transform:translateY(0)}
  .apres{font-size:13.5px;color:rgba(20,17,14,.55);max-width:430px;text-align:center;line-height:1.6}
  .apres b{color:${ENCRE};font-weight:600}
  footer{padding:14px 24px 26px;text-align:center;font-size:12.5px;color:rgba(20,17,14,.45);line-height:1.6}
  .erreur{margin:60px auto;max-width:440px;text-align:center;padding:0 24px}
  .erreur h1{margin-bottom:14px}
  .erreur p{color:rgba(20,17,14,.66);line-height:1.6;font-size:15px}
  @media (max-width:600px){h1{font-size:22px}main{padding:12px 10px 18px}}
</style>
</head><body>${corps}</body></html>`;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  // Un identifiant mal formé ferait échouer la requête Postgres et renverrait
  // une erreur 500 brute. On le filtre pour servir la page « expiré », qui dit
  // à la personne quoi faire.
  const id = String(req.query?.l ?? '');
  const bienForme = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!bienForme) {
    return res
      .status(404)
      .send(
        erreur(
          'Ce lien n’est pas valide.',
          "Écrivez « connecte mon compte » à votre assistant, il vous en enverra un nouveau dans la seconde.",
        ),
      );
  }

  const plateformeDe = (canal: string) => (canal === 'airbnb' ? 'Airbnb' : 'Booking.com');
  const etape = String(req.query?.etape ?? '');

  try {
    const lien = await store.lienConnexion(id);
    if (!lien) {
      return res
        .status(404)
        .send(
          erreur(
            'Ce lien a expiré.',
            "Écrivez « connecte mon compte » à votre assistant, il vous en enverra un nouveau dans la seconde.",
          ),
        );
    }
    const plateforme = plateformeDe(lien.canal);

    if (etape === 'aller') {
      const url = await demarrerConnexion(lien);
      res.setHeader('Location', url);
      return res.status(302).send('');
    }

    if (etape === 'retour') {
      const issue = await finaliserConnexion(lien);
      const [titre, detail] =
        issue.statut === 'connecte'
          ? [
              `Votre compte ${plateforme} est connecté.`,
              issue.annoncesImportees > 0
                ? `${issue.annoncesImportees} annonce(s) importée(s). Vous pouvez fermer cette page et retourner voir votre assistant.`
                : 'Vous pouvez fermer cette page et retourner voir votre assistant : il récupère vos annonces.',
            ]
          : issue.statut === 'en_attente'
            ? [
                'Connexion pas encore aboutie.',
                lien.canal === 'booking'
                  ? "Booking.com peut mettre un moment à valider. Votre assistant vous préviendra ; vous pouvez fermer cette page."
                  : "Le parcours semble avoir été interrompu. Rouvrez le lien reçu pour recommencer, ou demandez-en un nouveau à votre assistant.",
              ]
            : [
                'Connexion reçue, vérification en cours.',
                "Nous finalisons le rattachement de votre compte. Dites à votre assistant « où en est la connexion ? » dans quelques minutes.",
              ];
      return res.status(200).send(
        page(
          `<header>
  <div class="marque">Label Maison Conciergerie</div>
  <h1>${titre}</h1>
  <p class="sous">${detail}</p>
</header>`,
          `Connexion ${plateforme}`,
        ),
      );
    }

    return res.status(200).send(
      page(
        `<header>
  <div class="marque">Label Maison Conciergerie</div>
  <h1>Connectez votre compte ${plateforme}</h1>
  <p class="sous">Autorisez l'accès à vos annonces pour que votre assistant voie vos
  réservations, vos départs et vos messages voyageurs.</p>
  <p class="sous">Vos logements seront récupérés automatiquement depuis vos annonces.</p>
</header>
<main>
  <a class="cta" href="/connexion/${lien.id}/aller">Connecter mon compte ${plateforme}</a>
  <p class="apres">${
    lien.canal === 'airbnb'
      ? "Vous serez redirigé vers Airbnb pour vous identifier et <b>autoriser l'accès</b>, puis ramené ici."
      : "Vous serez guidé pour désigner notre partenaire de connectivité dans votre <b>extranet Booking.com</b> et saisir l'identifiant de votre établissement, puis ramené ici."
  }</p>
</main>
<footer>
  Vos identifiants ${plateforme} ne transitent jamais par Label Maison.<br>
  Vous pouvez révoquer cet accès à tout moment depuis votre compte ${plateforme}.
</footer>`,
        `Connexion ${plateforme}`,
      ),
    );
  } catch (err) {
    console.error('[connexion] échec :', err);
    return res
      .status(500)
      .send(erreur('Impossible d’ouvrir la connexion.', 'Réessayez dans un instant, ou prévenez votre assistant.'));
  }
}

const erreur = (titre: string, detail: string) =>
  page(
    `<div class="erreur">
  <div class="marque">Label Maison Conciergerie</div>
  <h1>${titre}</h1>
  <p>${detail}</p>
</div>`,
    titre,
  );
