# PizzaParty 🍕

Il sito del **PizzaParty**, la festa che quest'anno compie dieci anni (sabato 10 ottobre 2026).
La repository contiene due cose distinte, pubblicate con GitHub Pages su
[www.pizza-party.net](https://www.pizza-party.net):

| | Cosa | Dove |
|---|---|---|
| **Iscrizioni** | Il modulo per registrarsi alla festa, pagare la quota e scaricare il promemoria | [`/`](https://www.pizza-party.net) (file nella radice) |
| **Pizzagram** | Il social network ufficiale del PizzaParty: il feed fotografico della serata | [`/pizzagram/`](https://www.pizza-party.net/pizzagram/) |

---

## Pizzagram

### Perché esiste

Durante una festa tutti scattano foto, ma restano sparse nei telefoni di ognuno e quasi
nessuno le rivede. Pizzagram le raccoglie in **un unico feed cronologico** che racconta la
serata dall'inizio alla fine, con l'aspetto e i gesti di un social che tutti conoscono
(il nome fa il verso a Instagram) e l'identità grafica del PizzaParty.

### Come funziona per gli invitati

1. All'ingresso c'è un **QR code**: si inquadra, si sceglie un nickname e si entra.
   Niente app da installare, niente account (volendo si aggiunge alla schermata Home come un'app).
2. Con il **+** si caricano le foto, fino a 10 alla volta, ognuna con la sua didascalia.
3. Il **feed** si aggiorna in tempo reale e si può leggere dalle più recenti o
   "dall'inizio della serata", in ordine di scatto.
4. Si mettono i **like a forma di pizza** (anche con doppio tocco sulla foto) e si commenta.
5. Dopo la festa ognuno può scaricare l'**album completo in alta qualità** (ZIP in ordine
   di scatto), oppure lasciare l'email per ricevere il link.

### Pensato per la serata

- **Rete mobile non eccellente**: le foto vengono ridimensionate sul telefono e pubblicate
  subito in una versione leggera. La versione HD per l'album parte dopo, in background, e
  riprende da sola se l'app viene chiusa.
- **Privacy**: il feed è visibile solo a chi ha il codice invito. Dalle foto vengono tolti
  i dati di posizione (GPS), e foto e commenti vengono **cancellati 30 giorni dopo la festa**.
  Ognuno può eliminare i propri post in qualsiasi momento.
- **Moderazione**: l'organizzatore ha un pannello per eliminare qualsiasi post, vedere
  qualche numero e raccogliere le email per l'invio dell'album.
- **Avvio**: una breve animazione mostra una pizza che entra nel forno a legna e ne esce
  trasformata nell'icona di Pizzagram.

### Come è fatto

- **Web app statica** (HTML, CSS, JavaScript senza framework) in [`pizzagram/`](pizzagram/),
  servita da GitHub Pages insieme al sito delle iscrizioni.
- **Firebase** per i dati: login anonimo, Firestore per post, like e commenti, Storage per le foto.
  Le autorizzazioni (chi entra, chi può pubblicare, modificare o cancellare) sono nelle
  regole di sicurezza, non nel codice dell'app.
- In [`pizzagram-dev/`](pizzagram-dev/) ci sono le regole Firebase, gli strumenti per lo
  sviluppo con gli emulatori locali e i test automatici (regole di sicurezza e prova completa
  nel browser con due invitati simulati).

La configurazione passo-passo di Firebase, la prova generale e le istruzioni per dopo la
festa sono in [`pizzagram-dev/SETUP.md`](pizzagram-dev/SETUP.md).
