# E-mail à envoyer à Channex

**À :** support@channex.io (et `partners@channex.io` en copie si l'adresse existe)
**Objet :** Certification request — Label Maison Conciergerie (short-term rental PMS)

---

Hello,

I'm Abdel Hadri, founder of Label Maison Conciergerie (France). We operate a
property-management assistant for short-term rental concierges, and we've built
our integration against your staging environment. I'd like to start the
certification process.

**What we've implemented so far**

- Properties, room types and rate plans created via API
- Availability updates — batched, several date ranges in a single `POST /availability`
- Rates and restrictions — batched, via `POST /restrictions` (rate, `min_stay_arrival`,
  `closed_to_arrival`, `closed_to_departure`, `stop_sell`)
- Booking Revisions Feed as the primary path, plus a webhook, plus a 15-minute
  catch-up job — with `POST /booking_revisions/:id/ack` on every revision we've
  successfully stored
- Airbnb and Booking.com channel creation, with OAuth delegated to the host via
  the one-time token link
- ARI writes are user-triggered deltas only. We never run a full re-sync on a timer.

**What we need from you**

1. **OTA test accounts on staging.** We can't complete the booking tests
   (create / modify / cancel) without them — our staging account has no
   bookings, so there's nothing to acknowledge. Could you enable Airbnb and
   Booking.com test properties on our account?

2. **A question about the Airbnb OAuth link.** Today our users click
   "Connect with Airbnb" inside the Channex screen. Is there an API endpoint
   that returns the Airbnb authorization URL directly, so we can send our
   customers straight to Airbnb from our own interface? We'd rather not
   reproduce the `state` parameter ourselves.

3. **Two documentation points that don't match the API.**
   - The certification guide references `POST /rates`, but that path returns
     `resource_not_found` on staging. We're using `POST /restrictions` with a
     `rate` field, which works. Is that the correct approach?
   - Is there a documented page for the Booking Revisions Feed? The links we
     found return 404; we worked from `llms-full.txt`.

4. **Messaging & Reviews pricing.** Your pricing page says "same rates as the
   channel manager" for this module. Does that mean a second $130 platform fee,
   or only the per-unit fee? It materially changes our costing.

**Answers to your certification "Extra Notes" questions, up front**

- *Min Stay Through and Arrival?* We use `min_stay_arrival` only. Our properties
  are whole-home vacation rentals, where arrival-based minimum stay is the norm.
  We can add Through if it's required.
- *Unsupported restrictions?* None that we need. We support stop-sell, CTA, CTD
  and min stay.
- *Multiple room types and rate plans?* Our model is one property = one whole
  home = one room type + one rate plan. Our code doesn't assume a single one,
  but our use case doesn't produce more.
- *Credit card details with bookings?* We don't request, store or process card
  data at any point. Payments stay with the OTA.
- *PCI certification?* Not applicable, for the reason above.

Our staging account is under **kamelhadri94@gmail.com**. Happy to arrange the
screen-sharing review whenever suits you.

Best regards,

Abdel Hadri
Label Maison Conciergerie
labelmaisonconciergerie@gmail.com

---

## Notes pour toi, à ne pas envoyer

- **La question 4 est celle qui a le plus d'impact financier.** Si le module de
  messagerie ajoute 130 $/mois, ton socle fixe double et le seuil de rentabilité
  passe de deux à quatre conciergeries environ.
- **La question 2 est celle qui te tient à cœur** — le bouton unique vers Airbnb.
- **La question 1 est bloquante** pour finir la certification : sans réservation
  de test, le test « Booking Receiving » ne peut pas être joué.
- Si tu préfères une version française, dis-le. Mais leur documentation et leur
  support étant en anglais, la réponse viendra plus vite ainsi.
