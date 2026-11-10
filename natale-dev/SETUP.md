# Cena di Natale: collegare il modulo al Foglio Google

La pagina è in [`../natale/`](../natale/) e viene pubblicata su `www.pizza-party.net/natale/`.
Finché in `natale/app.js` resta `SCRIPT_URL: "INCOLLA_QUI"`, la pagina funziona in **anteprima**:
mostra un avviso e non salva nessuna risposta.

## Collegamento (una volta sola)

1. Crea un nuovo Foglio Google (es. "Cena di Natale 2026").
2. Nel foglio: **Estensioni > Apps Script**. Cancella il contenuto di `Codice.gs` e incolla
   tutto [`apps-script.gs`](apps-script.gs). Salva.
3. **Esegui il deployment > Nuovo deployment > App web**:
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
4. Autorizza quando richiesto e copia l'**URL dell'app web** (finisce con `/exec`).
5. Incolla l'URL in `natale/app.js`, al posto di `INCOLLA_QUI` in `SCRIPT_URL`.

Alla prima risposta lo script crea da solo la scheda "Risposte" con le intestazioni.

Se in seguito modifichi lo script, serve **Gestisci deployment > Modifica > Nuova versione**:
l'URL resta lo stesso.

## Dati dell'evento

Titolo, orario, luogo e quote sono in cima a `natale/app.js` (`CONFIG`).
