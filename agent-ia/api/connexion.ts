/**
 * Page de connexion d'un compte Airbnb ou Booking, servie sous notre domaine.
 *
 * Deux problèmes réglés d'un coup :
 *
 * 1. La conciergerie ne voit jamais « channex.io ». Elle reste chez Label
 *    Maison, du message Telegram jusqu'à la page d'autorisation.
 * 2. Le jeton Channex ne vit que 15 minutes. Il est fabriqué ICI, à
 *    l'ouverture de la page — donc un lien reçu lundi et ouvert jeudi
 *    fonctionne encore. C'était le piège numéro un de l'onboarding.
 *
 * L'écran Channex est intégré en iframe, mode `headless`, sans son interface :
 * c'est le mode d'intégration que Channex prévoit pour les éditeurs. On ne peut
 * pas en retirer le bouton rouge « Connect with Airbnb » — il est chez eux —
 * mais tout ce qui l'entoure est à nous.
 */

import * as channex from '../src/channex.js';
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
  /* Recadrage de l'écran Channex.
     On ne peut pas retirer d'éléments d'une iframe d'un autre domaine : on la
     dimensionne donc en grand et on n'en laisse voir qu'une fenêtre — le
     panneau du canal, sans la liste ni la navigation Channex.
     Valeurs calées sur un panneau de 950 px ancré à droite. Si Channex change
     sa mise en page, ce sont ces quatre nombres qu'il faut reprendre. */
  .hublot{position:relative;width:100%;max-width:940px;height:1320px;overflow:hidden;
    background:#fff;border:1px solid rgba(20,17,14,.09);border-radius:14px;
    box-shadow:0 1px 3px rgba(20,17,14,.05)}
  /* Seul le décalage HORIZONTAL est calé : le panneau Channex fait 940 px et
     est ancré à droite, donc on décale de (largeur iframe − 940) pour ne
     laisser voir que lui, sans la liste ni la navigation. Aucun calage
     vertical : viser un bouton au pixel près sur la page d'un tiers casserait
     à leur première mise à jour. */
  .hublot iframe{position:absolute;top:0;left:-660px;width:1600px;height:1320px;border:0}
  @media (max-width:980px){
    .hublot iframe{left:-700px;width:1640px}
  }
  footer{padding:14px 24px 26px;text-align:center;font-size:12.5px;color:rgba(20,17,14,.45);line-height:1.6}
  .avis{max-width:560px;margin:0 auto 14px;padding:11px 15px;border-radius:10px;
    background:#fff6e8;border:1px solid #e8c98a;color:#6b4c12;font-size:13.5px;line-height:1.5}
  .erreur{margin:60px auto;max-width:440px;text-align:center;padding:0 24px}
  .erreur h1{margin-bottom:14px}
  .erreur p{color:rgba(20,17,14,.66);line-height:1.6;font-size:15px}
  @media (max-width:600px){h1{font-size:22px}main{padding:12px 10px 18px}}
</style>
</head><body>${corps}</body></html>`;

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const id = String(req.query?.l ?? '');
  if (!id) return res.status(400).send(erreur('Lien incomplet.', "L'adresse est tronquée. Redemandez un lien à votre assistant."));

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

    const [conciergerie, logement] = await Promise.all([
      store.conciergerieParId(lien.conciergerieId),
      store.logementParId(lien.logementId),
    ]);
    if (!conciergerie?.channexGroupId || !logement?.channexPropertyId) {
      return res.status(500).send(erreur('Configuration incomplète.', 'Prévenez votre assistant, il régénérera le lien.'));
    }

    // Le jeton est fabriqué MAINTENANT, à l'ouverture. C'est ce qui permet
    // qu'un lien reçu il y a trois jours fonctionne encore.
    const url = await channex.lienConnexion(
      logement.channexPropertyId,
      conciergerie.channexGroupId,
      lien.canal,
      conciergerie.nom,
      lien.channexCanalId ?? undefined,
    );

    const plateforme = lien.canal === 'airbnb' ? 'Airbnb' : 'Booking.com';
    const bouton = lien.canal === 'airbnb' ? 'Connect with Airbnb' : 'Connect with Booking.com';

    return res.status(200).send(
      page(
        `<header>
  <div class="marque">Label Maison Conciergerie</div>
  <h1>Connectez votre compte ${plateforme}</h1>
  <p class="sous">Autorisez l'accès à vos annonces pour que votre assistant voie vos
  réservations, vos départs et vos messages voyageurs.</p>
  <p class="sous">Votre logement est déjà paramétré de notre côté.
  Il ne reste qu'une autorisation à donner.</p>
</header>
<main>
  <a class="cta" href="${url}">Connecter mon compte ${plateforme}</a>
  <p class="apres">Sur l'écran suivant, cliquez sur le bouton rouge
  <b>${bouton}</b>, en bas du formulaire. Vous serez alors redirigé vers
  ${plateforme} pour vous identifier.</p>
</main>
<footer>
  ${
    channex.enProduction()
      ? ''
      : `<div class="avis">Environnement de test : cette page ne connectera pas un vrai compte ${plateforme}.</div>`
  }
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
