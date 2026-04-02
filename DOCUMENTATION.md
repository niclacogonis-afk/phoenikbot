# 📚 PhoenikBot - Complete Documentation

## 🎯 Overview
PhoenikBot is a comprehensive Discord bot built with TypeScript, Discord.js, and MongoDB. It provides server management, moderation, leveling, economy, and community features.

---

## 🎛️ Dashboard Features (`/dashboard` or `http://localhost:3000/dashboard`)

### Main Sections:

#### 1. **General Settings** (Tab: General)
- **Prefix**: Command prefix for text commands
- **Language**: Bot language
- **Log Channel**: Channel for bot logs
- **Moderation Log Channel**: Channel for moderation actions
- **Staff Roles**: Roles that can use staff commands
- **Admin Roles**: Roles that can use admin commands

#### 2. **Modules** (Tab: Modules)
Toggle modules on/off:
- 🎫 Ticket System
- 🎁 Giveaways
- ✅ Verification
- 🛡️ Anti-Raid
- ☢️ Anti-Nuke
- 🔗 Anti-Link
- 📝 Logging
- 📺 YouTube
- 🤖 AI Moderation
- 💡 Suggestions
- 🎭 Reaction Roles
- 📊 Stats
- ⏰ Schedule
- 💾 Backup
- 🎮 Minigames
- ⚡ Automation

#### 3. **Roles** (Tab: Roles)
- **Staff Roles**: Manage staff permissions
- **Admin Roles**: Manage admin permissions
- **Mute Role**: Role to assign when users are muted

#### 4. **Security** (Tab: Security)

**Anti-Link Settings:**
- Enable/Disable anti-link
- Action: Delete only / Delete + Warn / Delete + Timeout
- Whitelisted Domains: `youtube.com, youtu.be, roblox.com, discord.com, discord.gg, twitch.tv`
- Blacklisted Domains: Custom domains to block

**Auto-Moderation Thresholds:**
- **Raid Detection**: Joins per window (default: 10), Time window (seconds, default: 5)
- **Anti-Raid Account Age**: Minimum account age in hours (0 = off)
- **Nuke Detection**: 
  - Max channel deletes (default: 3)
  - Max bans in window (default: 5)
  - Max role deletions (default: 3)
  - Detection window (seconds, default: 30)
- **Warn System**:
  - Warn → Mute threshold (default: 3 warns)
  - Warn → Ban threshold (default: 5 warns)
  - Auto-mute duration after warn (minutes, default: 60)

#### 5. **Verification** (Tab: Verification)
- **Mode**: Disabled / Button Click / Captcha / Roblox Account Link
- **Verification Role**: Role to give after verification
- Command: `/verify setup` in Discord to send the verification panel

#### 6. **Welcome** (Tab: Welcome) ⭐ NEW
- **Welcome Channel**: Channel for welcome messages
- **Auto-Role Delay**: Delay before applying auto-roles (ms)
- **Auto-Roles**: Select roles to assign when members join
- **Send Welcome Message**: Toggle welcome messages on/off
- **Welcome Embed**:
  - Title (default: "🎉 Welcome!")
  - Color: Embed color picker
  - Description: Message with variables
  - Image URL: Optional welcome image
  - Footer: Optional footer text
- **Leave Message**: Toggle goodbye messages on/off
- **Leave Channel**: Channel for goodbye messages
- **Leave Message Title**: (default: "👋 Member Left")
- **Leave Description**: (default: "{user} left the server")

**Variables for Welcome/Leave:**
- `{user}` - Mention the user
- `{username}` - Username
- `{usertag}` - Username#0000
- `{server}` - Server name
- `{member_count}` - Current member count
- `{date}` - Current date
- `{joined_at}` - Join date

#### 7. **Auto-Reply** (Tab: Auto-reply)
- Add custom auto-responses
- **Trigger**: Keywords that trigger the response
- **Response**: The bot's response
- **Include Ticket Button**: Option to include ticket button
- **Cooldown**: Seconds between responses (default: 30)

#### 8. **AI Moderation** (Tab: AI)
- Enable/Disable AI moderation
- **AI Provider**: OpenAI / Anthropic
- **AI Language**: Language for AI responses
- **Banned Words**: 
  - Add words in multiple languages (English, Italian, Spanish, French, German, Portuguese)
  - Severity: Low, Medium, High, Critical
  - Action: Warn, Mute, Kick, Ban

#### 9. **YouTube** (Tab: YouTube)
- Add YouTube channel notifications
- **Discord Channel**: Where to send notifications
- **YouTube Channel ID/Name**: YouTube channel to monitor
- **Ping Role**: Optional role to ping
- **Custom Message**: Optional custom notification message
- **Filter Options**: Filter shorts / Filter livestreams

---

## 🎮 Commands

### Moderation Commands (`/mod`)
| Command | Description |
|---------|-------------|
| `/warn <user> [reason]` | Warn a user |
| `/warnings <user>` | View user's warnings |
| `/removewarning <user> <id>` | Remove a specific warning |
| `/clearwarnings <user>` | Clear all warnings for a user |
| `/mute <user> [duration] [reason]` | Mute a user |
| `/unmute <user>` | Unmute a user |
| `/kick <user> [reason]` | Kick a user |
| `/ban <user> [reason]` | Ban a user |
| `/unban <user>` | Unban a user |
| `/softban <user> [reason]` | Ban and immediately unban (delete messages) |
| `/timeout <user> <duration> [reason]` | Timeout a user |
| `/lock <channel>` | Lock a channel |
| `/unlock <channel>` | Unlock a channel |
| `/slowmode <channel> <seconds>` | Set slowmode |
| `/purge <amount> [user]` | Delete messages |
| `/nuke` | Delete and recreate channel |

### Ticket Commands
| Command | Description |
|---------|-------------|
| `/ticket setup` | Create ticket panel |
| `/ticket add <user>` | Add user to ticket |
| `/ticket remove <user>` | Remove user from ticket |
| `/ticket close` | Close the ticket |

### Giveaway Commands
| Command | Description |
|---------|-------------|
| `/giveaway create` | Create a giveaway (interactive) |
| `/giveaway end <message_id>` | End a giveaway early |
| `/giveaway reroll <message_id>` | Reroll winner |

### Leveling Commands (`/level`)
| Command | Description |
|---------|-------------|
| `/rank [user]` | View your or another user's rank |
| `/leaderboard [page]` | View the XP leaderboard |

### Economy Commands (`/economy`)
| Command | Description |
|---------|-------------|
| `/balance [user]` | Check your or another user's balance |
| `/daily` | Claim daily reward (+ streak bonus!) |
| `/gamble <amount>` | Gamble for a chance to win 2x |
| `/pay <user> <amount>` | Transfer coins to another user |
| `/shop` | Browse the server shop |

### Utility Commands
| Command | Description |
|---------|-------------|
| `/userinfo <user>` | View user information |
| `/serverinfo` | View server information |
| `/avatar [user]` | View user's avatar |
| `/banner <user>` | View user's banner |
| `/roleinfo <role>` | View role information |
| `/channelinfo [channel]` | View channel information |
| `/permissions <user> [channel]` | View user's permissions |
| `/invite` | Get bot invite link |
| `/ping` | Check bot latency |
| `/uptime` | Check bot uptime |

### Suggestion Commands
| Command | Description |
|---------|-------------|
| `/suggest <idea>` | Submit a suggestion |
| `/suggestion accept <id>` | Accept a suggestion |
| `/suggestion decline <id>` | Decline a suggestion |
| `/suggestion consider <id>` | Mark as under consideration |

### Verification Commands
| Command | Description |
|---------|-------------|
| `/verify setup` | Send verification panel |
| `/verify` | Verify yourself (when verification is set up) |

---

## 🔧 Event Features

The bot automatically handles these events:

### Member Events:
- **guildMemberAdd**: Applies auto-roles, sends welcome message
- **guildMemberRemove**: Sends goodbye message

### Message Events:
- **messageCreate**: Awards XP (every ~5 messages), applies AI moderation, processes auto-responses
- **messageDelete**: Logs deleted messages
- **messageUpdate**: Logs edited messages

### Moderation Events:
- **channelDelete**: Detects nuke (mass channel delete)
- **channelCreate**: Monitors for spam
- **roleDelete**: Detects nuke (mass role delete)
- **guildBanAdd**: Logs bans
- **guildBanRemove**: Logs unbans

### Voice Events (if enabled):
- Voice channel join/leave tracking
- Voice activity for XP (future)

---

## 📊 Database Models

### Guild
Server configuration including modules, thresholds, anti-link settings

### Ticket
Individual tickets with messages and metadata

### TicketConfig
Ticket panel settings, categories, support roles

### User (Warnings)
Warning records with timestamps and reasons

### BannedWord
Custom banned words with language, severity, and action

### WelcomeConfig
Welcome messages, auto-roles, goodbye messages

### LevelConfig
Leveling system settings

### UserLevel
User XP, level, message counts

### EconomyConfig
Currency name, rewards, gamble settings

### UserWallet
User balance, transaction history

### ShopItem
Items available in the shop

### Transaction
Transaction history

### AutoResponse
Custom auto-reply triggers and responses

### YouTubeConfig
YouTube channel notifications

### Stats
Server statistics

### AuditLog
Moderation action logs

---

## 🔐 Permissions

### Admin Commands (requires Admin role):
- Module toggles
- Ticket category settings
- Welcome settings
- Anti-raid/nuke settings
- Economy settings

### Staff Commands (requires Staff role):
- All moderation commands
- Giveaway management
- Ticket management

### User Commands (everyone):
- `/rank`, `/leaderboard`
- `/balance`, `/daily`, `/gamble`, `/pay`, `/shop`
- `/suggest`
- `/verify`
- Utility commands

---

## ⚙️ Configuration Files

### `.env` (Required)
```
TOKEN=your-bot-token
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
MONGO_URI=mongodb://localhost:27017/phoenikbot
SESSION_SECRET=random-session-secret
DASHBOARD_URL=http://localhost:3000
PORT=3000
```

### Optional:
```
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

---

## 🚀 Installation

```bash
# Install dependencies
npm install

# Build
npm run build

# Run
npm start

# Development (with hot reload)
npm run dev
```

---

## 📝 Changelog

### v1.x Features:
- ✅ Moderation system (warn, mute, kick, ban, etc.)
- ✅ Ticket system with panels
- ✅ Giveaway system
- ✅ Verification (button, captcha, Roblox)
- ✅ Anti-Raid protection
- ✅ Anti-Nuke protection
- ✅ Anti-Link system
- ✅ AI Moderation with banned words
- ✅ Welcome messages with auto-roles
- ✅ Goodbye messages
- ✅ Auto-reply system
- ✅ YouTube notifications
- ✅ XP Leveling system
- ✅ Economy system with daily/hourly rewards
- ✅ Shop system
- ✅ Dashboard for all settings
- ✅ Logging system

---

## 🆘 Support

For issues or questions, check:
1. Console logs for errors
2. MongoDB connection
3. Discord bot token validity
4. Required intents enabled in Discord Developer Portal
