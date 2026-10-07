# Pizzagram: messa in onda

Pizzagram è una web app (PWA) servita da GitHub Pages insieme al sito, all'indirizzo
`https://www.pizza-party.net/pizzagram/`. Foto e dati stanno su Firebase.

```
pizzagram/        ← l'app pubblicata (HTML/CSS/JS statici)
pizzagram-dev/    ← regole di sicurezza, build dell'SDK, test, questa guida
```

Tempo stimato: circa 45 minuti, tutti nella console di Firebase.

---

## 1. Progetto Firebase

1. Vai su <https://console.firebase.google.com> → **Crea un progetto** (es. `pizzagram-2026`).
   Google Analytics non serve: disattivalo.
2. **Piano Blaze**: Storage (dove vanno le foto) lo richiede per i progetti nuovi.
   È a consumo: con circa 300 foto da ~400 KB restiamo sui centesimi.
   Subito dopo imposta un **avviso di budget** (es. 5 €) in
   Google Cloud Console → Fatturazione → Budget e avvisi.

### Quanto costa (stima)

Ogni foto viene salvata in tre versioni: anteprima (~30 KB), feed (~200 KB, 1080 px) e
HD per l'album (~1–1,5 MB, 2560 px). Con 60 invitati e ~300 foto:

| Voce | Quantità | Costo indicativo |
|---|---|---|
| Spazio occupato | ~0,5 GB per un mese | pochi centesimi |
| Feed sfogliato da tutti | ~3 GB scaricati | ~0,40 € |
| ZIP scaricato da tutti i 60 invitati (caso estremo) | ~25 GB scaricati | ~3 € |

Firestore e il login anonimo restano nella quota gratuita. Il budget da 5 € è un margine ampio.

## 2. Servizi

1. **Authentication** → Inizia → Metodo di accesso → **Anonimo** → Attiva.
2. **Firestore Database** → Crea database → modalità **produzione** →
   località `europe-west8 (Milano)` o `eur3`.
3. **Storage** → Inizia → modalità produzione → località **regionale europea**, la stessa
   zona di Firestore (es. `europe-west8 Milano`; con Firestore su `eur3` va bene `europe-west1`).
   Non serve una multi-regionale: costa di più e la ridondanza tra paesi qui non serve.
   Le località "senza costi" negli USA (`us-east1` ecc.) funzionano, ma portano le foto fuori
   dall'UE per risparmiare al massimo 3–4 €. **La località non si può cambiare dopo.**

## 3. Regole di sicurezza

- Firestore → **Regole**: incolla tutto `pizzagram-dev/firestore.rules` → Pubblica.
- Storage → **Regole**: incolla tutto `pizzagram-dev/storage.rules` → Pubblica.
  Se la console chiede di concedere a Storage l'accesso a Firestore, conferma:
  serve a verificare che chi carica sia un invitato.

## 4. Il codice invito

Firestore → Dati → **Avvia raccolta** `invites` → ID documento = il codice
(es. `margherita-2026`: lettere, numeri, `-` e `_`, almeno 4 caratteri) → nessun campo → Salva.

Il codice non sta da nessuna parte nel codice pubblico: esiste solo qui.
Per bloccare nuovi ingressi basta eliminare il documento. Chi è già dentro resta dentro.

## 5. Collegare l'app

1. Impostazioni progetto (⚙️) → Le tue app → icona **Web `</>`** → nome `Pizzagram`
   (Firebase Hosting non serve).
2. Copia i valori di `firebaseConfig` in `pizzagram/config.js`, al posto di `INCOLLA_QUI`.
3. Commit + push: GitHub Pages pubblica da solo.

## 6. CORS per il download dell'album

Il download ZIP legge le foto dal browser, quindi lo Storage deve accettare richieste da
`www.pizza-party.net`. Non serve caricare file: si fa tutto con un copia-incolla.

1. Apri <https://console.cloud.google.com>, seleziona il progetto in alto e clicca l'icona
   **Attiva Cloud Shell** (`>_`, in alto a destra). Si apre un terminale in fondo alla pagina.
2. Incolla questo blocco e premi Invio (se chiede di autorizzare Cloud Shell, conferma):

   ```sh
   cat > cors.json <<'EOF'
   [{"origin": ["https://www.pizza-party.net", "https://pizza-party.net"], "method": ["GET"], "maxAgeSeconds": 3600}]
   EOF
   gcloud storage buckets update gs://NOME-BUCKET --cors-file=cors.json
   ```

   `NOME-BUCKET` è il valore `storageBucket` di `config.js` (es. `pizzagram-9fe92.firebasestorage.app`).
3. Verifica: `gcloud storage buckets describe gs://NOME-BUCKET --format="default(cors_config)"`
   deve mostrare i due indirizzi del sito.

## 7. Diventare admin

1. Apri l'app dal tuo telefono con il link del QR ed entra.
2. Profilo → in fondo copia l'**ID dispositivo**.
3. Firestore → raccolta `admins` → ID documento = quell'ID → nessun campo → Salva.
4. Ricarica l'app: nel profilo compare il **Pannello organizzatore** e su ogni post il menu ⋯.

Ripeti per ogni dispositivo da cui vuoi moderare (es. anche il PC).
Attenzione: se cancelli i dati del browser l'ID cambia e va rifatto.

## 8. Cancellazione automatica dopo 30 giorni (rete di sicurezza)

Ogni documento ha un campo `expireAt` (10 ottobre + 30 giorni).

- **Firestore TTL**: nella console Firebase non c'è, si imposta da Google Cloud. In Cloud Shell
  (stesso progetto selezionato):

  ```sh
  for g in posts comments members albumRequests profiles; do
    gcloud firestore fields ttls update expireAt --collection-group=$g --enable-ttl --async
  done
  gcloud firestore fields ttls list   # dopo qualche minuto: 5 righe ACTIVE
  ```

  In alternativa da interfaccia: console.cloud.google.com → Firestore → **Time-to-live (TTL)**
  → Crea criterio, una volta per gruppo di raccolte, campo `expireAt`.
  Google cancella i documenti scaduti di solito entro 24 ore dalla data.
- Google Cloud Console → Cloud Storage → bucket → **Ciclo di vita** → Aggiungi regola →
  *Elimina oggetto* con condizione *Età: 40 giorni*.

## 9. QR code

Il link da mettere nel QR è:

```
https://www.pizza-party.net/pizzagram/#c=IL-TUO-CODICE
```

Chi lo scansiona deve solo scegliere un nickname. Sotto il QR scrivi anche il codice in chiaro,
per chi lo apre a mano. Il QR generalo con un generatore qualsiasi che produca un PNG statico,
non un "QR dinamico" con redirect a pagamento.

## 10. Prova generale (entro mercoledì 7)

Con almeno un iPhone e un Android, su rete mobile:

- [ ] scansiono il QR, scelgo il nickname ed entro;
- [ ] carico 3 foto dalla fotocamera e 2 dalla galleria;
- [ ] metto like 🍕 (anche con doppio tap) e commento dall'altro telefono;
- [ ] elimino un mio post; dall'account admin elimino un post altrui;
- [ ] "Aggiungi alla schermata Home" e riapro da lì;
- [ ] Profilo → Scarica tutte le foto (meglio da PC);
- [ ] cancello i post di prova (da admin) prima della festa.

## Dopo la festa

1. Profilo → Pannello organizzatore → **Copia email album**, poi **Copia link album**.
2. Manda una mail con gli indirizzi in **Ccn** e il link. Chi lo apre dallo stesso telefono
   della festa trova subito il download dello ZIP; da un altro dispositivo basta scegliere un nickname.
3. Il 9 novembre (o prima, se tutti hanno scaricato): Impostazioni progetto →
   **Elimina progetto**. È il modo più sicuro per cancellare davvero tutto.

---

## Sviluppo locale

Servono Node 20+ e Java 11+ (per gli emulatori Firebase).

```sh
cd pizzagram-dev
npm install
npm run dev          # emulatori + server su http://127.0.0.1:5173/pizzagram/#c=pizza-dev
npm run test:rules   # 24 test delle regole di sicurezza
npm run test:e2e     # due invitati simulati nel browser (ingresso, foto, like, commenti, album, admin)
npm run build        # rigenera pizzagram/vendor/firebase.js dopo un aggiornamento dell'SDK
npm run icons        # rigenera le icone PNG da pizzagram/icons/icon.svg
```

Dopo aver modificato i file dell'app, aumenta `CACHE` in `pizzagram/sw.js`
(`pizzagram-v2`, `-v3`…): così chi ha l'app installata riceve subito la versione nuova.
