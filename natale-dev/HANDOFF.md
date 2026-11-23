# Cena di Natale 2026 — handoff

Passaggio di consegne per la nuova sessione che rifarà la parte grafica in **pixel art**
(tema: Natale + dinosauri). Qui c'è solo ciò che riguarda l'evento, il modulo e il sito:
le scelte grafiche e di animazione delle sessioni precedenti sono **scartate** e non vanno
prese come riferimento.

## La richiesta

Un modulo di adesione per la **cena annuale tra amici del 19 dicembre 2026**, sul modello
del modulo di iscrizione del PizzaParty (radice di questa repo: `index.html`, `app.js`).
L'evento è indipendente dal PizzaParty: la repo serve come riferimento di funzionamento e
perché la pagina va pubblicata sullo stesso sito, a un indirizzo diverso.

Obiettivi dichiarati da Arturo:

- un'esperienza tematica curata, con molto lavoro sulle animazioni;
- un layout pensato per PC e uno pensato per telefono (non solo lo stesso layout ristretto);
- i dinosauri sono la mascotte del PizzaParty e devono essere i personaggi della scena.
  Non esiste un disegno ufficiale della mascotte: va inventata.

## Dove sta e come viene pubblicata

- Indirizzo: **`www.pizza-party.net/natale/`**. Il sito è servito da GitHub Pages dal ramo
  principale (`CNAME` nella radice); nulla è ancora sul ramo principale, quindi la pagina
  **non è online**.
- Branch di lavoro: `ccr-4863b10f-8yd2e3`. Nessuna pull request aperta: Arturo deciderà
  quando pubblicare.
- File: `natale/` (pagina) e `natale-dev/` (backend e istruzioni, non servono al sito ma
  vengono pubblicati comunque da Pages perché sono nella repo; non contengono segreti).
- La pagina è statica (HTML, CSS, JS senza framework, senza build), come il resto del sito.
- Ha `<meta name="robots" content="noindex">`: è un invito tra amici, non va indicizzata.
- Content-Security-Policy restrittiva, come nel modulo PizzaParty: script, stili e font solo
  dallo stesso sito; connessioni solo verso `script.google.com` e
  `script.googleusercontent.com`. Una nuova grafica che usi immagini, font o librerie esterne
  deve tenerne conto (meglio ospitare tutto in `natale/`).
- I font del sito sono in `../fonts/` (Fraunces e Kalam, licenza OFL) e si possono riusare;
  per la pixel art probabilmente servirà un font pixel da ospitare localmente (con licenza).

## Dati dell'evento (decisi)

| | |
|---|---|
| Nome | Cena di Natale 2026 |
| Data e ora | sabato 19 dicembre 2026, dalle 20:00 (fine indicativa 23:30, usata solo per il calendario) |
| Luogo | **da definire**: finché non c'è, non va mostrato da nessuna parte |
| Quota | 5€ a persona (10€ con il +1) |
| Motivo della quota | coprire i costi di preparazione del primo, a base di pasta fresca (ancora da scegliere) |
| Pagamento | online (stessi link PayPal e Satispay del PizzaParty) oppure contanti la sera della cena |
| Conservazione dati | cancellazione entro 30 giorni dalla cena (18 gennaio 2027) |

Tutto questo è in cima a `natale/app.js`, nell'oggetto `CONFIG`.

## Contenuto del modulo (deciso)

Quattro passi. Chi risponde "No" compila solo il primo e invia da lì.

1. **Chi viene a cena**
   - Nome e cognome (obbligatorio)
   - Email (obbligatoria; controllata sul backend per evitare doppie risposte)
   - Ci sarai? Sì / Forse / No
   - Vieni in compagnia? Da solo/a / Con un +1 (se +1: nome dell'accompagnatore)
2. **Cosa porti** — caselle multiple: Antipasto, Secondo, Contorno, Dolce, Bevande
   (nessuna è obbligatoria) + campo libero facoltativo per i dettagli.
3. **Secret Santa** (collegato alla cena, serve ad Arturo per l'estrazione dei nomi)
   - Vuoi partecipare? Sì / No — risposta **obbligatoria e senza valore predefinito**.
   - Solo per chi viene con il +1: "Partecipa anche il mio +1". Se spuntato, il **nome del
     +1 diventa obbligatorio** (è lo stesso campo del primo passo: compilarlo in uno dei due
     punti lo compila anche nell'altro).
4. **La quota** — importo (5€ o 10€), motivo della quota, scelta del metodo di pagamento,
   pulsanti PayPal/Satispay se online, casella obbligatoria di conferma della quota.

Dopo l'invio: schermata di esito diversa per chi viene e per chi non viene, con link
"Aggiungi al calendario" (Google Calendar, fuso Europe/Rome) per chi viene.

Comportamenti ripresi dal PizzaParty e già implementati in `natale/app.js`:

- risposte salvate in `sessionStorage` e ripristinate se la pagina si ricarica (succede su
  telefono tornando dalla scheda di PayPal/Satispay);
- anti-bot: campo nascosto (honeypot) e scarto degli invii fatti in meno di 3 secondi,
  con finto successo;
- indirizzo email di contatto composto via JS e non scritto per intero nell'HTML;
- modalità **anteprima** finché `SCRIPT_URL` vale `"INCOLLA_QUI"`: avviso in pagina e
  nessun invio.

**Testi**: tutte le frasi attuali (etichette, suggerimenti, informativa privacy, esiti) sono
provvisorie. Arturo vuole rivederle una per una più avanti.

## Backend (Foglio Google)

- Scelta di Arturo: un **Foglio Google nuovo**, separato da quello del PizzaParty.
- Codice: `natale-dev/apps-script.gs`. Istruzioni passo-passo: `natale-dev/SETUP.md`.
- Endpoint:
  - `GET ?action=checkEmail&email=…` → `{"exists": true|false}`
  - `POST` con il JSON della risposta nel corpo (inviato `no-cors` dalla pagina; l'esito
    viene verificato rifacendo `checkEmail`).
- Lo script scrive nella scheda "Risposte", con le colonne: Ricevuta il, Email, Nome,
  Conferma, Partecipazione, Nome +1, Contributo, Dettaglio, Secret Santa, Secret Santa +1,
  Quota, Pagamento, Compilata il. Rifiuta email non valide e doppioni, neutralizza le
  formule, ha un tetto di 300 righe.
- Campi del payload inviato da `buildPayload()` in `natale/app.js`: `email`, `nome`,
  `conferma`, `partecipazione`, `plus1nome`, `contributo`, `dettaglio`, `secretSanta`,
  `secretSantaPlus1`, `quota`, `metodoPagamento`, `timestamp`. Se si cambiano, vanno
  allineati `FIELDS` e `HEADERS` nello script.
- **Da fare (Arturo)**: creare il foglio, incollare lo script, pubblicarlo come app web e
  passare l'URL `/exec`, da mettere in `CONFIG.SCRIPT_URL`.
- Mai provato contro un foglio vero: è stato testato solo l'invio simulato.

## Cosa riusare e cosa buttare

Da **tenere** (logica, indipendente dalla grafica):

- `natale/app.js`: configurazione, passi e salti, validazioni, Secret Santa, salvataggio
  locale, invio e verifica, link al calendario. Usa un oggetto `Scene` (definito in
  `natale/scene.js`) solo tramite queste funzioni: `Scene.stepSwap`, `Scene.reveal`,
  `Scene.finale`, `Scene.popIn`, `Scene.starFlash`, `Scene.reduced`. La nuova grafica
  può fornire le stesse funzioni con un'implementazione nuova, oppure si adatta `app.js`.
- La struttura del `<form>` in `natale/index.html` (id e `name` dei campi sono quelli letti
  da `app.js`).
- `natale-dev/apps-script.gs` e `natale-dev/SETUP.md`.

Da **rifare da zero** (scelte grafiche scartate): `natale/styles.css`, `natale/scene.js`,
tutte le illustrazioni SVG, l'apertura e il finale in `natale/index.html`, palette, font
del titolo, impaginazione PC/telefono.

Uniche indicazioni di Arturo sulla resa che restano valide:

- vuole qualcosa di **d'impatto**, non "semplice"; un effetto 3D simulato era gradito;
- **ambientazione**: una stanza natalizia con camino (va tenuta), con i dinosauri vestiti
  con maglioni natalizi come personaggi (due o tre, di specie diverse);
- i dinosauri devono **vivere nella stanza** (piccole azioni ricorrenti), **reagire al
  modulo** (seguire, esultare quando si avanza, reagire a sì/no) ed essere **protagonisti
  del finale**;
- **finale**: la risposta chiusa in una **busta con la ceralacca** (preferita al pacco
  regalo, che è stato scartato);
- vanno mantenute le **transizioni** tra i passi del modulo (passaggio animato da un passo
  all'altro) e l'idea di un'**apertura** prima della pagina;
- nuovo stile: **pixel art**, Natale + dinosauri.

Accorgimenti tecnici da conservare in qualsiasi grafica: rispetto di "riduci movimento"
del sistema, animazioni ferme quando la scena non è visibile, possibilità di saltare
l'apertura, nessuna dipendenza da CDN (vedi CSP).

## Punti aperti

- Luogo della cena.
- URL dello script del Foglio Google.
- Revisione di tutti i testi con Arturo.
- Pull request verso il ramo principale per pubblicare, quando Arturo lo chiede.
