# 📚 GUIDA COMPLETA PHOENIKBOT

## 🎯 Cos'è PhoenikBot?

PhoenikBot è un bot Discord completo scritto in TypeScript che offre:
- 🎫 Sistema di Ticket
- 🛡️ Moderazione Avanzata
- 🎁 Giveaway
- ✅ Verifica Utenti
- 🛡️ Protezione Anti-Raid/Nuke/Link
- 🤖 Moderazione AI
- 👋 Messaggi di Welcome/Leave
- 📊 Sistema di Leveling/XP
- 💰 Sistema di Economia
- 📝 Auto-Reply
- 📺 Notifiche YouTube
- 💡 Sistema di Suggerimenti

---

## 🎛️ DASHBOARD (`http://localhost:3000/dashboard`)

La dashboard è accessibile tramite browser web e permette di configurare TUTTO senza usare comandi.

### Come Accedere:
1. Vai su `http://localhost:3000/dashboard`
2. Clicca su "Login with Discord"
3. Autorizza il bot
4. Seleziona il tuo server dalla lista

---

### 📋 Sezione 1: IMPOSTAZIONI GENERALI (Tab: General)

#### Prefix
- **Cos'è**: Il simbolo prima dei comandi testuali (es. `!`, `/`, `.`)
- **Default**: `/` (slash commands)
- **Esempio**: `/help`, `!ping`

#### Lingua
- **Cos'è**: La lingua del bot
- **Opzioni**: Inglese (English)
- **Default**: English

#### Canale Log
- **Cos'è**: Dove il bot invia i log delle azioni
- **Come usarlo**: Seleziona un canale testuale dal menu a tendina
- **Cosa mostra**: Azioni generali del bot

#### Canale Log Moderazione
- **Cos'è**: Dove il bot invia i log di moderazione
- **Cosa mostra**: Warn, mute, kick, ban, ecc.

#### Staff Roles
- **Cos'è**: Ruoli che possono usare comandi staff
- **Come aggiungerli**: Clicca su "Aggiungi Ruolo" e seleziona i ruoli
- **Comandi disponibili per staff**: Tutti i comandi di moderazione

#### Admin Roles
- **Cos'è**: Ruoli che possono usare comandi admin
- **Come aggiungerli**: Clicca su "Aggiungi Ruolo" e seleziona i ruoli
- **Comandi disponibili per admin**: Configurazione moduli, impostazioni avanzate

#### Ruolo Mute
- **Cos'è**: Il ruolo assegnato quando un utente viene mutato
- **Importante**: Deve essere un ruolo che il bot può assegnare
- **Suggerimento**: Crea un ruolo "Muted" con permessi di canale limitati

---

### ⚙️ Sezione 2: MODULI (Tab: Modules)

Ogni modulo può essere attivato/disattivato con la levetta. Quando è verde = ATTIVO.

| Modulo | Descrizione | Cosa Fa |
|--------|-------------|---------|
| 🎫 Ticket | Sistema ticket | Permette agli utenti di aprire ticket di supporto |
| 🎁 Giveaway | Giveaway | Gestisce estrazioni nel server |
| ✅ Verification | Verifica | Verifica utenti prima di accedere |
| 🛡️ Anti-Raid | Anti-Raid | Protegge da raid automatici |
| ☢️ Anti-Nuke | Anti-Nuke | Protegge da distruzione del server |
| 🔗 Anti-Link | Anti-Link | Blocca link non desiderati |
| 📝 Logging | Log | Registra azioni nel server |
| 📺 YouTube | YouTube | Notifiche per nuovi video |
| 🤖 AI | AI Moderation | Moderazione automatica con AI |
| 💡 Suggestions | Suggerimenti | Sistema di suggerimenti utenti |
| 🎭 Reaction Roles | Reaction Roles | Ruoli tramite reazioni |
| 📊 Stats | Statistiche | Statistiche del server |
| ⏰ Schedule | Schedule | Messaggi programmati |
| 💾 Backup | Backup | Backup del server |
| 🎮 Minigames | Minigiochi | Giochi nel bot |
| ⚡ Automation | Automazione | Regole automatiche |

---

### 👥 Sezione 3: RUOLI (Tab: Roles)

#### Staff Roles
- Ruoli che hanno accesso ai comandi staff
- Possono usare: warn, mute, kick, purge, ticket, giveaway, ecc.

#### Admin Roles  
- Ruoli che hanno accesso ai comandi admin
- Possono usare: impostazioni, moduli, configurazione

#### Mute Role
- Ruolo assegnato automaticamente quando qualcuno viene mutato
- **Importante**: Deve essere POSIZIONATO SOPRA i ruoli da limitare

---

### 🛡️ Sezione 4: SICUREZZA (Tab: Security)

#### 🟢 Anti-Link Settings
```
Abilita Anti-Link: [ON/OFF]
Azione: [Delete only / Delete + Warn / Delete + Timeout]
```

**Azioni disponibili:**
- **Delete only**: Solo cancella il messaggio con il link
- **Delete + Warn**: Cancella e warna l'utente
- **Delete + Timeout**: Cancella e mette in timeout l'utente

**Whitelisted Domains** (domini permessi):
```
youtube.com, youtu.be, roblox.com, discord.com, discord.gg, twitch.tv
```
Questi link NON vengono bloccati.

**Blacklisted Domains** (domini bloccati):
Aggiungi domini custom da bloccare anche se non sono link

#### ⚠️ Auto-Moderation Thresholds

**Raid Detection:**
- **Joins per window**: Quanti join in X secondi attivano l'anti-raid (default: 10)
- **Time window (seconds)**: Finestra di tempo per contare i join (default: 5)

**Anti-Raid Account Age:**
- **Minimum account age (hours)**: Blocca account più recenti di X ore
- **0 = disabilitato**
- **Richiede permiso "Moderate Members"**

**Nuke Detection:**
- **Max channel deletes**: Quanti canali eliminati attivano l'anti-nuke (default: 3)
- **Max bans in window**: Quanti ban attivano l'anti-nuke (default: 5)
- **Max role deletions**: Quanti ruoli eliminati attivano l'anti-nuke (default: 3)
- **Detection window (seconds)**: Finestra di tempo (default: 30)

**Warn System:**
- **Warn → Mute (# of warns)**: Dopo quanti warn l'utente viene mutato (default: 3)
- **Warn → Ban (# of warns)**: Dopo quanti warn l'utente viene bannato (default: 5)
- **Auto-mute duration (minutes)**: Quanto dura il mute dopo warn (default: 60)

---

### ✅ Sezione 5: VERIFICA (Tab: Verification)

#### Verification Mode
| Modalità | Descrizione |
|----------|------------|
| Disabled | Nessuna verifica |
| Button Click | L'utente clicca un bottone per verificarsi |
| Captcha | L'utente deve inserire un codice da DM |
| Roblox Account Link | L'utente deve collegare account Roblox |

#### Verification Role
- Ruolo assegnato DOPO la verifica
- Seleziona dal menu a tendina

#### Comandi Discord:
```
/verify setup
```
Invia il pannello di verifica nel canale dove esegui il comando

---

### 👋 Sezione 6: WELCOME (Tab: Welcome) ⭐

Questa sezione permette di configurare MESSAGGI DI BENVENUTO e RUOLI AUTOMATICI.

#### Impostazioni Base:
- **Welcome Channel**: Canale dove inviare il messaggio di benvenuto
- **Auto-Role Delay (ms)**: Millisecondi di attesa prima di assegnare i ruoli (0 = subito)

#### Auto-Roles:
- Clicca "Aggiungi ruolo..." per selezionare ruoli da assegnare automaticamente quando qualcuno entra
- I ruoli appariranno come tag
- Clicca "×" per rimuovere un ruolo

#### 📝 Welcome Embed Settings:

**Toggle Send Welcome Message**: ON/OFF per abilitare il messaggio

**Quando ON, puoi configurare:**
- **Embed Title**: Titolo dell'embed (es: "🎉 Benvenuto!")
- **Embed Color**: Colore della barra laterale dell'embed
- **Embed Description**: Testo principale del messaggio
- **Thumbnail Image URL**: Immagine piccola (icona)
- **Background Image URL**: Immagine grande (sfondo)
- **Footer Text**: Testo in basso

#### 📌 Variabili per Description/Footer:
| Variabile | Risultato |
|-----------|-----------|
| `{user}` | Mention dell'utente (@Nome) |
| `{username}` | Nome utente (Nome) |
| `{usertag}` | Nome#0000 |
| `{server}` | Nome del server |
| `{member_count}` | Numero di membri (es: 142) |
| `{date}` | Data attuale |
| `{joined_at}` | Data di join dell'utente |

**Esempio Description:**
```
Benvenuto {user} in **{server}**!

Sei il membro #{member_count}!

Leggi le regole e presentati!
```

#### 👋 Leave Message Settings:

**Toggle Send Leave Message**: ON/OFF

**Quando ON:**
- **Leave Channel**: Canale per il messaggio di addio
- **Leave Message Title**: Titolo (es: "👋 Arrivederci")
- **Leave Description**: Testo (es: "{user} ha lasciato il server.")

---

### 💬 Sezione 7: AUTO-REPLY (Tab: Auto-reply)

#### Aggiungi Auto-Response:

**Trigger**: Parola chiave che attiva la risposta (es: "ciao", "help")
- Puoi mettere PIÙ parole separate da virgola
- Il bot risponderà quando qualcuno scrive UNA di quelle parole

**Response**: La risposta del bot
- Può essere qualsiasi testo

**Include Ticket Button**: Se attivo, aggiunge un bottone per aprire ticket

**Cooldown**: Secondi tra una risposta e l'altra (default: 30)

#### Esempio:
```
Trigger: ciao, salve, buongiorno
Response: Ciao! Come posso aiutarti?
```

---

### 🤖 Sezione 8: AI MODERATION (Tab: AI)

#### Abilita AI Moderation
Toggle ON/OFF per attivare la moderazione AI

#### AI Provider
- **OpenAI**: Usa GPT per moderare (richiede API key)
- **Anthropic**: Usa Claude per moderare (richiede API key)

#### AI Language
Lingua per le risposte dell'AI

#### Banned Words
Parole bannate che il bot rimuoverà automaticamente.

**Aggiungi Parola:**
1. Clicca "Aggiungi"
2. Inserisci la parola
3. Seleziona la lingua (o "all" per tutte)
4. Seleziona gravità: Low, Medium, High, Critical
5. Seleziona azione: Warn, Mute, Kick, Ban

**Lingue disponibili:**
- English 🇬🇧
- Italian 🇮🇹
- Spanish 🇪🇸
- French 🇫🇷
- German 🇩🇪
- Portuguese 🇵🇹
- All languages 🌍

**Gravità:**
- **Low**: Solo warn
- **Medium**: Warn + nota
- **High**: Auto-mute
- **Critical**: Auto-ban

---

### 📺 Sezione 9: YOUTUBE (Tab: YouTube)

#### Aggiungi Notifica YouTube:

**Discord Channel**: Canale dove inviare le notifiche

**YouTube Channel Name**: Nome del canale YouTube da monitorare

**Ping Role**: Ruolo da pingare quando esce un video (opzionale)

**Custom Message**: Messaggio personalizzato per le notifiche (opzionale)

**Filtri:**
- ☑️ Filter Shorts: Ignora gli short
- ☑️ Filter Lives: Ignora gli stream live

---

## 🎮 COMANDI DISCORD

### 📌 COMANDI SLASH (preceduti da `/`)

---

### 🛡️ MODERAZIONE

| Comando | Descrizione | Esempio |
|--------|------------|---------|
| `/warn <user> [reason]` | Warn un utente | `/warn @Mario spam` |
| `/warnings <user>` | Vedi gli warn di un utente | `/warnings @Mario` |
| `/removewarning <user> <id>` | Rimuovi un warn specifico | `/removewarning @Mario 3` |
| `/clearwarnings <user>` | Cancella tutti i warn | `/clearwarnings @Mario` |
| `/mute <user> [duration] [reason]` | Muta un utente | `/mute @Mario 10m spam` |
| `/unmute <user>` | Smuta un utente | `/unmute @Mario` |
| `/kick <user> [reason]` | Espelli un utente | `/kick @Mario` |
| `/ban <user> [reason]` | Banna un utente | `/ban @Mario spam` |
| `/unban <user>` | Sbanna un utente | `/unban Mario#1234` |
| `/softban <user> [reason]` | Ban + unban (cancella messaggi) | `/softban @Mario` |
| `/timeout <user> <duration> [reason]` | Timeout un utente | `/timeout @Mario 1h` |
| `/lock <channel>` | Blocca un canale | `/lock` |
| `/unlock <channel>` | Sblocca un canale | `/unlock` |
| `/slowmode <channel> <seconds>` | Imposta slowmode | `/slowmode 5` |
| `/purge <amount> [user]` | Cancella messaggi | `/purge 50 @Mario` |
| `/nuke` | Distruggi e ricrea il canale | `/nuke` |

**Durate:**
- `s` = secondi (10s)
- `m` = minuti (5m)
- `h` = ore (2h)
- `d` = giorni (1d)

---

### 🎫 TICKET

| Comando | Descrizione |
|--------|-------------|
| `/ticket setup` | Crea il pannello dei ticket |
| `/ticket add <user>` | Aggiungi utente al ticket |
| `/ticket remove <user>` | Rimuovi utente dal ticket |
| `/ticket close` | Chiudi il ticket |

---

### 🎁 GIVEAWAY

| Comando | Descrizione |
|--------|-------------|
| `/giveaway create` | Crea un giveaway (wizard interattivo) |
| `/giveaway end <message_id>` | Termina un giveaway |
| `/giveaway reroll <message_id>` | Estrae un nuovo vincitore |

---

### 📊 LEVELING

| Comando | Descrizione |
|--------|-------------|
| `/rank [user]` | Vedi il tuo rank o quello di un altro |
| `/leaderboard [page]` | Vedi la classifica XP |

**Come funziona:**
- Guadagni XP per ogni ~5 messaggi
- Più scrivi, più XP ottieni
- Ogni livello richiede più XP (formula: 100*level + 50*level^1.5)

**Cosa mostra `/rank`:**
- Livello attuale
- XP attuale / XP per prossimo livello
- Progresso percentuale
- Rank (#X di Y)
- Totale messaggi

---

### 💰 ECONOMIA

| Comando | Descrizione |
|--------|-------------|
| `/balance [user]` | Vedi il tuo bilancio |
| `/daily` | Ritira il reward giornaliero |
| `/gamble <amount>` | Scommetti per vincere il doppio |
| `/pay <user> <amount>` | Paga un altro utente |
| `/shop` | Vedi il negozio del server |

**Come funziona `/daily`:**
- Puoi ritirare una volta ogni 24 ore
- Reward base: 500 monete
- **Bonus Streak**: +10% per ogni giorno consecutivo!
  - Giorno 1: 500
  - Giorno 5: 500 + 250 = 750
  - Giorno 10: 500 + 500 = 1000

**Come funziona `/gamble`:**
- Scommetti X monete
- 50% possibilità di vincere il DOPPIO
- 50% possibilità di PERDERE tutto
- Minimo: 10 monete

---

### ✅ VERIFICA

| Comando | Descrizione |
|--------|-------------|
| `/verify setup` | Invia il pannello di verifica |
| `/verify` | Verificati (quando il sistema è attivo) |

---

### 💡 SUGGERIMENTI

| Comando | Descrizione |
|--------|-------------|
| `/suggest <idea>` | Invia un suggerimento |
| `/suggestion accept <id>` | Accetta un suggerimento |
| `/suggestion decline <id>` | Rifiuta un suggerimento |
| `/suggestion consider <id>` | Segna come "in considerazione" |

---

### 🛠️ UTILITY

| Comando | Descrizione |
|--------|-------------|
| `/userinfo [user]` | Info su un utente |
| `/serverinfo` | Info sul server |
| `/avatar [user]` | Avatar dell'utente |
| `/banner <user>` | Banner dell'utente |
| `/roleinfo <role>` | Info su un ruolo |
| `/channelinfo [channel]` | Info su un canale |
| `/permissions [user] [channel]` | Permessi utente |
| `/invite` | Link per invitare il bot |
| `/ping` | Latenza del bot |
| `/uptime` | Da quanto tempo è online |

---

## 🔄 EVENTI AUTOMATICI

Il bot gestisce automaticamente questi eventi:

### 👤 Eventi Membri:
| Evento | Cosa Succede |
|--------|--------------|
| **guildMemberAdd** | Assegna auto-roles, invia welcome message |
| **guildMemberRemove** | Invio goodbye message |

### 💬 Eventi Messaggi:
| Evento | Cosa Succede |
|--------|--------------|
| **messageCreate** | Assegna XP, AI moderation, auto-reply |
| **messageDelete** | Log del messaggio eliminato |
| **messageUpdate** | Log del messaggio modificato |

### 🛡️ Eventi Moderazione:
| Evento | Cosa Succede |
|--------|--------------|
| **channelDelete** | Rileva nuke (elim. massa canali) |
| **channelCreate** | Monitoraggio spam |
| **roleDelete** | Rileva nuke (elim. massa ruoli) |
| **guildBanAdd** | Log del ban |
| **guildBanRemove** | Log dello unban |

---

## 📊 DATABASE

Tutti i dati sono salvati in MongoDB:

| Collezione | Cosa Contiene |
|------------|--------------|
| `guilds` | Configurazione server (moduli, ruoli, ecc.) |
| `tickets` | Ticket singoli |
| `ticketconfigs` | Pannelli ticket |
| `users` | Warn e dati utenti |
| `bannedwords` | Parole bannate |
| `welcomeconfigs` | Configurazione welcome |
| `levelconfigs` | Configurazione leveling |
| `userlevels` | XP e livelli utenti |
| `economyconfigs` | Configurazione economia |
| `userwallets` | Bilanci utenti |
| `shopitems` | Oggetti del negozio |
| `transactions` | Storico transazioni |
| `autoresponses` | Auto-reply |
| `youtubeconfigs` | Notifiche YouTube |
| `stats` | Statistiche server |
| `auditlogs` | Log azioni moderation |

---

## 🔧 CONFIGURAZIONE

### File `.env`:
```env
TOKEN=token-del-bot
CLIENT_ID=id-del-client
CLIENT_SECRET=secret-del-client
MONGO_URI=mongodb://localhost:27017/phoenikbot
SESSION_SECRET=una-stringa-casuale
DASHBOARD_URL=http://localhost:3000
PORT=3000
```

### Opzionali:
```env
OPENAI_API_KEY=sk-...    # Per AI moderation
ANTHROPIC_API_KEY=sk-ant-...  # Alternativa AI
```

---

## 🚀 AVVIO

```bash
# Entra nella cartella
cd "C:/Users/nicol/.zenflow/worktrees/new-task-b6a0"

# Installa dipendenze (solo la prima volta)
npm install

# Compila il codice
npm run build

# Avvia il bot
npm start
```

---

## 📝 COMANDI RAPIDI

| Azione | Comando |
|--------|---------|
| Verificare se il bot funziona | `/ping` |
| Invitare il bot | `/invite` |
| Creare ticket | `/ticket setup` |
| Configurare welcome | Dashboard > Welcome |
| Controllare rank | `/rank` |
| Ritirare daily | `/daily` |
| Dare admin a qualcuno | Dashboard > Roles |

---

## ⚠️ PERMESSI NECESSARI

Il bot ha bisogno di questi permessi Discord:

### Permessi Base:
- ✅ Send Messages
- ✅ Embed Links
- ✅ Read Message History

### Per Moderazione:
- ✅ Manage Roles
- ✅ Kick Members
- ✅ Ban Members
- ✅ Manage Channels

### Per Ticket:
- ✅ Manage Channels
- ✅ Manage Roles

### Per Welcome:
- ✅ Send Messages
- ✅ Manage Roles (per auto-role)

---

## 💡 CONSIGLI

1. **Prima di tutto**: Configura Staff Roles e Admin Roles
2. **Sicurezza**: Attiva Anti-Raid e Anti-Nuke
3. **Welcome**: Configura il messaggio di benvenuto con il tuo stile
4. **Leveling**: Ispirala i membri a chattare!
5. **Economia**: Usa il negozio per ruoli esclusivi

---

## 🆘 PROBLEMI COMUNI

| Problema | Soluzione |
|----------|----------|
| Bot non risponde | Controlla i permessi |
| Auto-role non funziona | Il ruolo del bot deve essere SOPRA i ruoli da assegnare |
| Welcome non appare | Controlla che il canale sia selezionato nella dashboard |
| XP non si guadagna | Il modulo leveling è attivo? |

---

Vuoi che aggiunga altre funzionalità o che ti aiuti con qualcosa di specifico?
