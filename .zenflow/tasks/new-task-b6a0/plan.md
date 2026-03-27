# Discord Bot — Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/new-task-b6a0`
- **Spec**: `.zenflow/tasks/new-task-b6a0/spec.md`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Stack Summary
- **TypeScript** + **Discord.js v14**
- **MongoDB** + Mongoose
- **OpenAI GPT-4o-mini** for AI features
- **Express** web dashboard with Discord OAuth2
- **node-cron** for scheduled tasks
- YouTube (RSS), Twitch API, Roblox open API

---

## Workflow Steps

### [x] Step: Planning
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Gather requirements from user, produce `spec.md` with full architecture, database models, and system designs. Break work into concrete phases in `plan.md`.

### [ ] Step 1: Project Setup & Core Infrastructure
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Initialize the TypeScript Discord.js project from scratch.

- `package.json` with all dependencies (discord.js v14, mongoose, openai, express, node-cron, winston, dotenv, rss-parser, noblox.js, axios, html-to-text, ejs, express-session, passport, passport-discord)
- `tsconfig.json` configured for Node.js 20+
- `.env.example` with all required env vars
- `.gitignore` (node_modules, dist, .env, *.log)
- `src/config/index.ts` — typed env var loader
- `src/types/index.ts` — shared interfaces and types
- `src/utils/logger.ts` — winston logger (file + console)
- `src/utils/errorHandler.ts` — global uncaughtException + unhandledRejection handlers
- `src/utils/embed.ts` — embed builder helpers
- `src/utils/formatters.ts` — date, duration, number formatters
- `src/utils/rateLimit.ts` — per-user command rate limiter
- `src/utils/paginator.ts` — paginated embed helper
- `src/bot/client.ts` — extended Client with module registry and cache
- `src/index.ts` — entry point: connect DB, start bot, start web server
- `src/database/connection.ts` — mongoose connection with retry

### [ ] Step 2: Database Models
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Create all Mongoose models as defined in spec.md.

- `Guild.ts` — guild config + module toggles (all 18 modules)
- `Ticket.ts` — ticket with messages array, transcript, feedback
- `TicketConfig.ts` — per-guild ticket panel config
- `Giveaway.ts` — giveaway with entries, requirements, rigged mode
- `User.ts` — per-guild user (warns, mutes, risk score, roblox link, verified)
- `GlobalBan.ts` — cross-server ban list (discordId + robloxId)
- `Tag.ts` — custom tags/FAQ
- `Suggestion.ts` — suggestions with votes and status
- `AutoResponse.ts` — trigger → response mappings
- `StaffStats.ts` — staff action tracking
- `Schedule.ts` — scheduled messages (cron)
- `BackupData.ts` — server structure snapshot
- `Stats.ts` — daily server metrics
- `RobloxLink.ts` — Discord ↔ Roblox account link
- `YouTubeConfig.ts` — YouTube channel configs per guild
- `TwitchConfig.ts` — Twitch streamer configs per guild
- `ReactionRole.ts` — button-based role assignment configs
- `Permission.ts` — command-level permission overrides

### [ ] Step 3: Bot Framework — Handlers & Event Routing
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Build the core interaction routing system.

- `src/bot/handlers/commandHandler.ts` — auto-load slash commands from `commands/` subdirs, register with Discord API
- `src/bot/handlers/eventHandler.ts` — auto-load events from `events/`
- `src/bot/handlers/buttonHandler.ts` — route button interactions by `customId` prefix
- `src/bot/handlers/selectMenuHandler.ts` — route select menu interactions
- `src/bot/handlers/modalHandler.ts` — route modal submissions
- `src/bot/events/ready.ts` — log startup info, start cron jobs
- `src/bot/events/interactionCreate.ts` — main router → commands/buttons/selects/modals
- `src/modules/permissions/PermissionManager.ts` — check role-based + command-level perms
- `src/modules/cache/CacheManager.ts` — in-memory guild config cache with TTL

### [ ] Step 4: Module System & Guild Config Commands
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Implement the module ON/OFF system and guild configuration commands.

- `isModuleEnabled(guildId, moduleName)` utility used by all features
- `/config module enable <module>` — enable a module for the guild
- `/config module disable <module>` — disable a module
- `/config module list` — show all modules and their status
- `/config set logchannel <channel>` — set log channel
- `/config set modlogchannel <channel>` — set mod log channel
- `/config set staffrole <role>` — add staff role
- `/config set adminrole <role>` — add admin role
- `/config view` — show full guild config as embed
- All config commands require `Administrator` or bot admin

### [ ] Step 5: Moderation System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Full moderation suite with DB-backed warn system.

- `src/modules/moderation/WarnManager.ts` — add/remove warns, fetch history, auto-punish thresholds
- `/warn <user> [reason]` — add warn, auto-mute at 3, auto-ban at 5
- `/warnings <user>` — list all warns
- `/unwarn <user> <warn-id>` — remove specific warn
- `/mute <user> <duration> [reason]` — timeout
- `/unmute <user>` — remove timeout
- `/ban <user> [reason] [delete-days]` — ban + log
- `/unban <user-id>` — unban
- `/kick <user> [reason]` — kick + log
- `/slowmode <channel> <seconds>` — set slowmode
- `/purge <amount> [user]` — bulk delete messages
- `/lock <channel>` / `/unlock <channel>` — channel lockdown
- Mod log: all actions sent as embeds to modLogChannel
- Auto-punish: configurable thresholds per guild

### [ ] Step 6: Logging System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Comprehensive audit log for all guild events.

- `src/modules/logging/LogManager.ts` — send formatted embeds to log channel
- Events logged: message delete, message edit, member join, member leave, ban add, ban remove, channel create/delete, role create/delete, nickname change, avatar change
- Ticket events: open, close, claim, transfer, delete, transcript
- Giveaway events: start, end, winner
- Verification events: success, fail, timeout
- Mod events: warn, mute, ban, kick (already in step 5)
- Each log shows: who, what, when, before/after (where applicable)

### [ ] Step 7: Ticket System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Ultra-advanced ticket system as described in spec.

- `src/modules/ticket/TicketManager.ts` — create, close, reopen, delete, claim, transfer, auto-close
- `src/modules/ticket/TranscriptBuilder.ts` — build HTML and TXT transcripts from saved messages
- `src/modules/ticket/FeedbackManager.ts` — collect star rating + comment after close
- `/ticket panel` — create customizable panel embed with buttons (Support, Report, Purchase + custom)
- Panel config: title, description, color, image, thumbnail, button labels/emojis
- Open mode: private thread (named via configurable template)
- Initial message template with `{user}`, `{date}`, `{ticket_type}` placeholders
- Staff tag on open (configurable roles)
- Ticket management buttons: 🔒 Close, 🔓 Reopen, 🗑️ Delete, 👤 Claim, 🔄 Transfer
- Priority selector (select menu): Low / Medium / High
- Auto-close: cron job, configurable inactivity timeout
- Reminder DM to user before auto-close
- Transcript: HTML format with all messages + attachments, sent to DM (admin) + log channel
- Feedback modal: after close, user gets DM with star rating buttons + comment modal
- Feedback stored in DB and viewable via `/ticket stats`
- `/ticket stats` — tickets open/closed/avg response time

### [ ] Step 8: Verification System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Three-mode verification system.

- `src/modules/verification/VerificationManager.ts`
- Mode 1: **Button verify** — click button → assign configured role
- Mode 2: **Captcha** — generate alphanumeric code (image or text), user types in modal, timeout + retry limit, auto-kick on fail
- Mode 3: **Roblox verify** — generate unique code, user puts it in Roblox profile bio, bot polls Roblox API to confirm, assigns role + links account in DB
- `/verify setup` — configure mode, role to assign, channel for panel
- `/verify panel` — send verification panel embed with button
- Roblox verify also checks: account age (flag if < 30 days), username pattern
- On verification: update User model (verified, verifiedAt, robloxId)
- Anti-alt: if same Roblox ID already verified → block + alert staff

### [ ] Step 9: Giveaway System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Full giveaway system with rigged mode.

- `src/modules/giveaway/GiveawayManager.ts` — start, end, reroll, entry management
- `/giveaway start` — modal/options: prize, duration, winners count, required role, channel
- Enter via button (anti-bot: check account age, required role)
- Auto-end via cron: select winners, announce, update embed
- `/giveaway end <id>` — force end early
- `/giveaway reroll <id>` — pick new winners from non-winners
- `/giveaway list` — active giveaways in guild
- **Rigged mode** (`/giveaway rigged`): admin selects winner manually, bot simulates dramatic extraction publicly (shows random names cycling before "landing" on selected winner), hidden log stored in DB
- Blacklist: `/giveaway blacklist add/remove <user>`

### [ ] Step 10: Reaction Roles & Custom Message System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Button-based role assignment and the powerful /sendmessage command.

- `src/modules/reactionRoles/ReactionRoleManager.ts` — assign/remove roles on button click
- `/reactionrole create` — create role button panel: title, description, color, add multiple role↔button pairs
- Exclusive mode: only one role from group at a time
- Multi-select mode: toggle multiple roles
- Role limit: max N roles from this panel
- `/sendmessage` — powerful panel creator:
  - Choose: channel, embed or plain text
  - Embed: title, description, color, image, footer, thumbnail, author
  - Add buttons:
    - Link button (opens URL)
    - Thread creator button (opens private thread)
    - Ticket opener button (links to ticket system)
    - Role assigner button (links to reaction role)
  - Add select menus
  - Preview before sending
  - Edit existing messages (by message ID)
- All panel data stored in DB for persistence across restarts

### [ ] Step 11: Anti-Raid & Anti-Nuke System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Advanced server protection.

- `src/modules/antiraId/RaidDetector.ts` — rolling window join tracking
- `src/modules/antiraId/AntiNuke.ts` — mass action detection
- `src/modules/antilink/AntiLink.ts` — link filtering
- **Raid detection**: N joins in T seconds → LOCKDOWN mode (disable @everyone send_messages in all text channels, disable invites), DM/ping staff
- Flag criteria: account age < 7 days, no avatar, bot-like username pattern
- **Anti-Nuke**: track per-user: channel deletes, role deletes, bans in 30s window → threshold → strip admin perms from user, kick, attempt channel restore from backup
- `/antinuke config` — set thresholds, trusted admin roles (exempt from anti-nuke)
- `/lockdown` — manual server lockdown toggle
- **Anti-Link**: configurable blacklist/whitelist domains
  - Detect: scam domains, phishing, shortened links (bit.ly etc.)
  - Actions: delete message, warn, timeout
  - Whitelist: YouTube, Roblox, Discord by default
  - `/antilink config` — manage whitelist/blacklist

### [ ] Step 12: YouTube & Twitch Notifier
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Content creator notification systems.

- `src/modules/youtube/YouTubeNotifier.ts` — RSS polling, video detection
- `src/modules/twitch/TwitchNotifier.ts` — Twitch API polling, live detection
- **YouTube**: cron every 10 min, parse RSS feed `https://www.youtube.com/feeds/videos.xml?channel_id=...`, compare latest video ID with stored, send embed if new
  - Filter: skip Shorts (< 60s / #shorts tag), skip Lives
  - Embed: title, thumbnail, link, date, channel name
  - Ping role (configurable)
  - Custom message template
- `/youtube add <channel-id> [discord-channel] [ping-role]` — add tracking
- `/youtube remove <channel-id>` — remove tracking
- `/youtube list` — show tracked channels
- **Twitch**: cron every 5 min, poll Twitch API for live status
  - On live: send embed (title, game, thumbnail, link), store message ID
  - On offline: auto-delete message (configurable)
  - Filter by game (optional)
- `/twitch add <username> [discord-channel] [ping-role]` — add tracking
- `/twitch remove <username>` — remove
- `/twitch list` — show tracked streamers

### [ ] Step 13: Roblox Integration & Update Tracker
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Roblox platform integration.

- `src/modules/roblox/RobloxAPI.ts` — wrapper for Roblox open APIs
- `src/modules/roblox/UpdateTracker.ts` — track Roblox platform updates
- `/roblox link` — start Roblox account link flow (generates verification code)
- `/roblox verify` — confirm link after code placed in bio
- `/roblox check <user>` — show linked Roblox profile info (username, account age, join date)
- `/roblox unlink` — remove link
- Global ban enforcement: when user links Roblox ID that is in GlobalBan list → auto-ban
- `/globalban add <discord-id> [roblox-id] <reason>` — add to global ban list
- `/globalban check <user>` — check if user is in global ban list
- **Update Tracker**: cron every 30 min, check Roblox status API + DevForum RSS
  - Detect: maintenance, platform updates
  - Send embed to configured channel with type (Maintenance/Update), description, link
- `/roblox updates setup <channel>` — configure update notifications
- Risk scoring: low Roblox account age → increase risk score

### [ ] Step 14: AI System
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

OpenAI-powered moderation and auto-response.

- `src/modules/ai/AIModeration.ts` — analyze messages for violations
- `src/modules/ai/AutoResponse.ts` — intelligent auto-response matching
- **AI Moderation** (runs on messageCreate when module enabled):
  - Classify message: safe / suspicious / spam / scam
  - Roblox-specific: detect "free robux", fake Roblox links
  - If scam detected: delete message, warn user, alert staff embed
  - Update user risk score based on behavior patterns
  - Flood detection: same message repeated → mute
  - Rate: analyze only non-staff messages, use GPT-4o-mini with system prompt defining rules
- **Auto-Response**:
  - `/autoresponse add <trigger> <response>` — add keyword trigger
  - `/autoresponse remove <trigger>`
  - `/autoresponse list`
  - On messageCreate: check triggers (keyword match), respond with configured embed/text + optional buttons (e.g. "Open a ticket")
  - Cooldown per channel (configurable)
  - Ignore staff messages
- **Risk Score System**: each user has 0-100 score
  - Increases: new account, no avatar, spam behavior, scam detected, alt suspect
  - Decreases: verified, long activity, positive behavior
  - High risk (>70): restrict (require captcha, mute in some channels)
  - Alert staff on high-risk user join

### [ ] Step 15: Stats, Help, Tags, Suggestions & Staff Management
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Utility and management commands.

- **Help System**:
  - `/help [command]` — intelligent help with select menu categories
  - Categories: Moderation, Ticket, Giveaway, Security, Utility, Roblox, Staff
  - Autocomplete on command name
  - Shows only commands the user has permission to use
  - Detail view: description, usage, examples, required permissions

- **Stats System**:
  - `src/modules/stats/StatsManager.ts` — log events to Stats model daily
  - Track: messages sent, member joins/leaves, tickets opened/closed, raids blocked, mod actions
  - `/stats` — server stats embed (today / this week / all time)
  - `/stats user <user>` — user activity stats

- **Tags/FAQ**:
  - `/tag create <name>` — create tag (modal for content, embed or plain text)
  - `/tag edit <name>` — edit tag
  - `/tag delete <name>` — delete tag
  - `/tag <name>` — use tag (with optional `@user` target)
  - `/tag list` — paginated tag list
  - Tag aliases support
  - Anti-spam: cooldown per channel

- **Suggestions**:
  - `/suggest <text>` — submit suggestion (sent to suggestions channel as embed)
  - Up/Down vote buttons (ephemeral prevention: one vote per user stored in DB)
  - Staff: Approve / Reject / Comment buttons
  - Status shown on embed (Pending / Approved / Rejected)
  - `/suggestion list [status]` — list suggestions

- **Staff Management**:
  - `src/modules/stats/StatsManager.ts` tracks staff actions
  - Every mod action increments StaffStats
  - `/staff stats [user]` — show staff activity (tickets handled, bans, warns, etc.)
  - `/staff leaderboard` — top staff members by action count

### [ ] Step 16: Scheduling, Announcements & Mini-Games
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Time-based automation and fun features.

- `src/modules/schedule/ScheduleManager.ts` — node-cron based scheduler
- `/schedule add <channel> <message> <time> [repeat]` — schedule a message (one-time or recurring)
- `/schedule list` — list scheduled messages
- `/schedule remove <id>` — cancel a scheduled message
- `/reminder <time> <message>` — personal reminder via DM
- **Announcements**:
  - `/announce <channel> <message>` — send rich announcement embed
  - Ping options: @everyone, @here, specific role, or none
  - Embed customization: title, description, color, image
- **Mini-Games**:
  - `/quiz roblox` — random Roblox trivia question (multiple choice buttons)
  - `/trivia` — general trivia question
  - `/guess` — guess the number game (1-100)
  - Session tracking, per-user cooldowns
  - Show leaderboard for quiz scores

### [ ] Step 17: Backup System & Data Export
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Server backup and data export features.

- `src/modules/backup/BackupManager.ts` — capture and restore guild structure
- `/backup create [name]` — snapshot current channels (names, types, permissions, topics), roles (name, color, permissions, position), basic server settings
- `/backup list` — list saved backups
- `/backup restore <backup-id>` — attempt to restore (creates missing channels/roles, warns about limitations)
- `/backup delete <backup-id>` — remove backup
- Auto-backup: configurable cron (e.g. daily at midnight) — keeps last N backups
- **Data Export**:
  - `/export tickets [format]` — export ticket data as JSON or CSV
  - `/export users [format]` — export user/moderation data
  - `/export logs [format]` — export action logs
  - Formats: JSON, CSV
  - Sends as file attachment in Discord

### [ ] Step 18: Web Dashboard
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Express-based web dashboard with Discord OAuth2.

- `src/web/server.ts` — Express app setup, session, passport
- Discord OAuth2: login with Discord, verify user is admin in selected guild
- Pages:
  - `/` — home, list of guilds user can manage
  - `/guild/:id` — guild dashboard:
    - Module toggles (ON/OFF switches for all 18 modules)
    - Config: log channels, staff roles, admin roles
    - Ticket config preview
    - Anti-raid thresholds
  - `/guild/:id/stats` — stats graphs (messages/day, tickets/day, joins/day)
  - `/guild/:id/tickets` — ticket list with search/filter
  - `/guild/:id/users` — user risk scores, warns, bans
- REST API endpoints (JSON) used by dashboard:
  - `GET /api/guilds` — user's manageable guilds
  - `GET/PATCH /api/guild/:id/config` — guild config
  - `GET /api/guild/:id/stats` — stats data
  - `GET /api/guild/:id/tickets` — tickets
- Simple but clean UI (EJS templates + Bootstrap 5 or plain CSS)

### [ ] Step 19: Final Polish & Production Readiness
<!-- chat-id: 138a863c-8088-4007-9993-24592b1d47c9 -->

Make everything production-grade.

- Rate limiting on all commands (per-user, per-guild)
- Ephemeral responses where appropriate (errors, sensitive info)
- Anti-crash: global error handlers, graceful shutdown
- DB connection retry + health check
- Command cooldowns stored in CacheManager
- All user-facing strings reviewed for clarity
- Validate all env vars at startup (fail fast with clear error)
- `/ping` — show bot latency + DB status
- `/invite` — bot invite link
- Graceful handling of missing permissions (bot permissions check before actions)
- Process management: PM2 ecosystem file included
- Build script: `npm run build` → compile TS to `dist/`
- Start script: `npm start` → run `dist/index.js`
- Dev script: `npm run dev` → ts-node with nodemon
- Complete `.env.example`
