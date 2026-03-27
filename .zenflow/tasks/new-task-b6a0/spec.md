# Discord Bot — Technical Specification

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| Runtime | Node.js 20+ |
| Discord Library | discord.js v14 |
| Database | MongoDB + Mongoose |
| AI | OpenAI GPT-4o-mini |
| Web Dashboard | Express + EJS (or plain HTML) |
| Cache | In-memory (Map) + Redis optional |
| Scheduler | node-cron |
| YouTube | RSS feed (rss-parser) |
| Twitch | Twitch API (EventSub / polling) |
| Roblox | Roblox open API (unofficial + noblox.js) |
| Transcript | html-to-text + custom HTML builder |
| Logger | winston |
| Env | dotenv |

---

## Project Structure

```
src/
├── index.ts                        # Entry point
├── bot/
│   ├── client.ts                   # Extended Discord Client
│   ├── handlers/
│   │   ├── commandHandler.ts       # Load slash commands
│   │   ├── eventHandler.ts         # Load events
│   │   ├── buttonHandler.ts        # Route button interactions
│   │   ├── selectMenuHandler.ts    # Route select menu interactions
│   │   └── modalHandler.ts         # Route modal interactions
│   ├── commands/
│   │   ├── admin/                  # /config, /backup, /export, /schedule
│   │   ├── moderation/             # /warn, /mute, /ban, /kick, /slowmode
│   │   ├── ticket/                 # /ticket (panel), /ticket-config
│   │   ├── giveaway/               # /giveaway start/end/reroll/rigged
│   │   ├── verification/           # /verify, /verify-config
│   │   ├── roblox/                 # /roblox link, /roblox check
│   │   ├── utility/                # /help, /stats, /tag, /suggest, /sendmessage
│   │   ├── staff/                  # /staff stats, /staff leaderboard
│   │   ├── youtube/                # /youtube add, /youtube remove
│   │   ├── twitch/                 # /twitch add, /twitch remove
│   │   ├── antinuke/               # /antinuke config
│   │   └── minigames/              # /quiz, /trivia, /guess
│   └── events/
│       ├── ready.ts
│       ├── interactionCreate.ts
│       ├── messageCreate.ts
│       ├── messageDelete.ts
│       ├── messageUpdate.ts
│       ├── guildMemberAdd.ts
│       ├── guildMemberRemove.ts
│       ├── guildMemberBan.ts
│       ├── channelCreate.ts
│       ├── channelDelete.ts
│       ├── roleCreate.ts
│       ├── roleDelete.ts
│       └── guildBanAdd.ts
├── modules/
│   ├── ticket/
│   │   ├── TicketManager.ts
│   │   ├── TranscriptBuilder.ts
│   │   └── FeedbackManager.ts
│   ├── giveaway/
│   │   └── GiveawayManager.ts
│   ├── moderation/
│   │   ├── WarnManager.ts
│   │   └── AutoMod.ts
│   ├── verification/
│   │   ├── VerificationManager.ts
│   │   └── CaptchaGenerator.ts
│   ├── antiraId/
│   │   ├── RaidDetector.ts
│   │   └── AntiNuke.ts
│   ├── antilink/
│   │   └── AntiLink.ts
│   ├── ai/
│   │   ├── AIModeration.ts
│   │   └── AutoResponse.ts
│   ├── logging/
│   │   └── LogManager.ts
│   ├── youtube/
│   │   └── YouTubeNotifier.ts
│   ├── twitch/
│   │   └── TwitchNotifier.ts
│   ├── roblox/
│   │   ├── RobloxAPI.ts
│   │   └── UpdateTracker.ts
│   ├── backup/
│   │   └── BackupManager.ts
│   ├── suggestions/
│   │   └── SuggestionManager.ts
│   ├── permissions/
│   │   └── PermissionManager.ts
│   ├── cache/
│   │   └── CacheManager.ts
│   ├── stats/
│   │   └── StatsManager.ts
│   ├── schedule/
│   │   └── ScheduleManager.ts
│   └── reactionRoles/
│       └── ReactionRoleManager.ts
├── database/
│   ├── connection.ts
│   └── models/
│       ├── Guild.ts               # Guild config + module toggles
│       ├── Ticket.ts
│       ├── TicketConfig.ts
│       ├── Giveaway.ts
│       ├── User.ts                # Per-guild user data (warns, risk score)
│       ├── GlobalBan.ts           # Cross-server ban list (Discord ID + Roblox ID)
│       ├── Tag.ts
│       ├── Suggestion.ts
│       ├── AutoResponse.ts
│       ├── StaffStats.ts
│       ├── Schedule.ts
│       ├── BackupData.ts
│       ├── Stats.ts               # Daily server stats
│       ├── RobloxLink.ts          # Discord → Roblox links
│       ├── YouTubeConfig.ts
│       ├── TwitchConfig.ts
│       ├── ReactionRole.ts
│       └── Permission.ts          # Custom command-level permissions
├── web/
│   ├── server.ts                  # Express app
│   ├── routes/
│   │   ├── index.ts
│   │   ├── auth.ts               # Discord OAuth2
│   │   ├── guilds.ts             # Guild config endpoints
│   │   └── stats.ts              # Stats endpoints
│   ├── middleware/
│   │   └── auth.ts
│   └── views/
│       ├── index.ejs
│       ├── guild.ejs
│       └── stats.ejs
├── utils/
│   ├── embed.ts                  # Embed builder helpers
│   ├── permissions.ts            # Permission checks
│   ├── rateLimit.ts              # Command rate limiting
│   ├── logger.ts                 # Winston logger
│   ├── errorHandler.ts           # Global error handler / anti-crash
│   ├── paginator.ts              # Paginated embeds
│   └── formatters.ts             # Date, duration, number formatters
├── types/
│   └── index.ts                  # Shared TypeScript types/interfaces
└── config/
    └── index.ts                  # Env vars + constants
```

---

## Database Models

### Guild (per-server configuration)
```ts
{
  guildId: string
  prefix: string
  language: 'en'
  modules: {
    ticket: boolean
    giveaway: boolean
    verification: boolean
    antirAid: boolean
    antinuke: boolean
    antilink: boolean
    logging: boolean
    youtube: boolean
    twitch: boolean
    roblox: boolean
    ai: boolean
    suggestions: boolean
    reactionRoles: boolean
    stats: boolean
    schedule: boolean
    backup: boolean
    minigames: boolean
  }
  logChannel: string | null
  modLogChannel: string | null
  staffRoles: string[]      // roles with elevated permissions
  adminRoles: string[]
  createdAt: Date
  updatedAt: Date
}
```

### Ticket
```ts
{
  guildId, channelId/threadId, userId,
  type: 'support' | 'report' | 'purchase' | string,
  status: 'open' | 'closed' | 'deleted',
  claimedBy: string | null,
  priority: 'low' | 'medium' | 'high',
  messages: [{ authorId, content, attachments, timestamp }],
  transcript: { html, txt },
  feedback: { rating: 1-5, comment: string },
  createdAt, closedAt
}
```

### User (per-guild)
```ts
{
  guildId, userId,
  warns: [{ reason, moderatorId, timestamp }],
  mutes: [...],
  riskScore: number,          // 0-100
  riskFlags: string[],        // 'new-account', 'vpn', 'alt-suspect', etc.
  robloxId: string | null,
  verified: boolean,
  verifiedAt: Date | null
}
```

### GlobalBan
```ts
{
  discordId: string,
  robloxId: string | null,
  reason: string,
  bannedBy: string,
  bannedAt: Date
}
```

---

## Key Systems Design

### Module System
Each guild has `modules` object. Every feature checks `isModuleEnabled(guildId, 'ticket')` before executing.

### Permission System (Levels)
1. **Discord default** — standard discord permissions
2. **Role-based** — staffRoles / adminRoles in Guild config
3. **Command-level override** — `Permission` model allows per-command role overrides
4. **Developer** — hardcoded bot owner ID

### Ticket System
- Panel created via `/ticket panel` with full embed customization (title, description, color, image, buttons)
- Button types: Support, Report, Purchase (configurable)
- Opening mode: private thread
- Thread name: configurable template `{username}-{type}-{id}`
- Initial message: dynamic template `{user}`, `{date}`, `{ticket_type}`
- Staff actions via buttons: Close, Reopen, Delete, Claim, Transfer
- Transcript: full HTML with attachments list, sent to DM + log channel
- Auto-close: cron job checks inactivity
- Feedback: star rating + comment after close

### Anti-Raid
- Track joins per second using rolling window
- Trigger lockdown: disable all channel write perms
- Flag new accounts (< 7 days old)
- Log raid report

### Anti-Nuke
- Track channel deletions, role deletions, mass bans in 30s window
- Threshold trigger → strip permissions from responsible user
- Attempt to restore deleted channels from backup

### Verification System
- Mode 1: Button → role assignment
- Mode 2: Captcha (generate code image, user DMs/types it)
- Mode 3: Roblox verification (generate code, user puts in profile bio, bot checks via Roblox API)

### Giveaway System
- Create with duration, winners count, requirements (role, min-level)
- Button to enter, anti-bot filter
- Auto-end via cron + winner selection
- Reroll command
- Rigged mode: admin selects winner manually, simulated extraction shown publicly

### AI System (OpenAI)
- Message analysis: spam, scam, bot-like behavior detection
- Roblox scam detection: "free robux", fake links
- Auto-response: similarity matching using embeddings or keyword matching
- Risk scoring: update user risk score based on behavior

### YouTube Notifier
- Check RSS feed every 10 minutes via cron
- Compare with stored latest video ID
- Send embed on new video (filter: shorts, lives optional)

### Twitch Notifier
- Poll Twitch API every 5 minutes
- Detect live status change → send embed
- Auto-remove message when stream ends

### Roblox Integration
- Link Discord ↔ Roblox via bio verification
- Check account age, username history (via Roblox API)
- Cross-ban: if banned Discord user links same Roblox ID → auto-ban
- Track Roblox platform updates via RSS / status API

### Web Dashboard
- Discord OAuth2 login
- View/edit guild config
- Enable/disable modules
- View stats and ticket history
- Protected routes (must be guild admin)

### Backup System
- Snapshot guild channels + roles + permissions to DB
- `/backup create` → saves current state
- `/backup restore` → attempts to recreate structure
- Auto-backup on schedule (cron)

---

## Environment Variables
```env
DISCORD_TOKEN=
CLIENT_ID=
MONGODB_URI=
OPENAI_API_KEY=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
YOUTUBE_API_KEY=          # optional (using RSS)
ROBLOX_COOKIE=            # optional for authenticated requests
SESSION_SECRET=           # for web dashboard
DASHBOARD_URL=
BOT_OWNER_ID=
PORT=3000
```

---

## Implementation Phases

See `plan.md` for the phase breakdown.
