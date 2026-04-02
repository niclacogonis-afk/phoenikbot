import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import https from 'https';
import path from 'path';
import { ChannelType } from 'discord.js';
import { config } from '../config';
import { BotClient } from '../bot/client';
import { GuildModel, getGuild } from '../database/models/Guild';
import { TicketModel } from '../database/models/Ticket';
import { TicketConfigModel, getTicketConfig } from '../database/models/TicketConfig';
import { StatsModel } from '../database/models/Stats';
import { AutoResponseModel } from '../database/models/AutoResponse';
import { YouTubeConfigModel } from '../database/models/YouTubeConfig';
import { invalidateGuildCache } from '../modules/cache/CacheManager';
import { logger } from '../utils/logger';
import { TicketManager } from '../modules/ticket/TicketManager';
import { AIModeration } from '../modules/ai/AIModeration';
import { getWelcomeConfig, WelcomeConfigModel } from '../database/models/WelcomeConfig';
import { layoutPage, guildRedirect } from './render/layout';
import { safeEmbedMediaUrl } from '../utils/embedUrl';
import { AutomationRuleModel } from '../database/models/AutomationRule';
import type { GuildModules } from '../types';
import { parseTicketButtonsJson, buildTicketOpenButtons, normalizeTicketButtons } from '../utils/ticketButtons';
import { AuditLogModel } from '../database/models/AuditLog';
import { BannedWordModel } from '../database/models/BannedWord';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function isDiscordManagePermission(permissionsStr: string | undefined): boolean {
  if (permissionsStr == null || permissionsStr === '') return false;
  try {
    const p = BigInt(String(permissionsStr));
    return (p & 8n) === 8n || (p & 32n) === 32n;
  } catch {
    const n = parseInt(String(permissionsStr), 10);
    return (n & 8) === 8 || (n & 32) === 32;
  }
}

export function createWebServer(client: BotClient) {
  const app = express();

  if (!config.isDev) {
    app.set('trust proxy', 1);
  }

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/assets', express.static(PUBLIC_DIR));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
  }));

  passport.use(new DiscordStrategy({
    clientID: config.clientId,
    clientSecret: config.clientSecret,
    callbackURL: `${config.dashboardUrl}/auth/callback`,
    scope: ['identify', 'guilds'],
  }, async (accessToken: string, refreshToken: string, profile: any, done: (err: any, user?: any) => void) => {
    try {
      if (!profile.guilds || profile.guilds.length === 0) {
        await new Promise<void>((resolve) => {
          const req = https.get({
            hostname: 'discord.com',
            path: '/api/v10/users/@me/guilds',
            headers: { Authorization: `Bearer ${accessToken}` },
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              try { profile.guilds = JSON.parse(data); } catch { profile.guilds = []; }
              resolve();
            });
          });
          req.on('error', () => { profile.guilds = []; resolve(); });
          req.end();
        });
      }
    } catch {
      profile.guilds = [];
    }
    return done(null, profile);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user: Express.User, done) => done(null, user));

  app.use(passport.initialize());
  app.use(passport.session());

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
  }

  /** Owner, Discord Administrator (0x8), or Manage Requiresr / Manage Guild (0x20). */
  function isGuildAdmin(req: express.Request, guildId: string): boolean {
    const user = req.user as any;
    if (!user) return false;
    if (config.ownerIds.includes(user.id)) return true;
    const guild = (user.guilds ?? []).find((g: any) => g.id === guildId);
    return Boolean(guild && isDiscordManagePermission(guild.permissions));
  }

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/callback', passport.authenticate('discord', {
    failureRedirect: '/?error=auth',
    successRedirect: '/dashboard',
  }));
  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
  });

  app.get('/', (req, res) => {
    const user = req.user as any;
    res.send(layoutPage('Home', `
      <div class="hero">
        <h1 class="hero-title">🔥 Phoenik<span class="brand-hot">Bot</span></h1>
        <p>Advanced Discord bot with tickets, moderation, giveaways, verification, and more.</p>
        ${user
          ? `<a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>`
          : `<a href="/auth/discord" class="btn btn-primary">Login with Discord</a>`
        }
        <div style="margin-top:48px;display:flex;gap:24px;justify-content:center;flex-wrap:wrap">
          ${['🎫 Ticket System','🛡️ Moderation','🎉 Giveaways','✅ Verification','📊 Statistics','🤖 AI Moderation'].map(f =>
            `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px 24px;font-weight:600">${f}</div>`
          ).join('')}
        </div>
      </div>
    `, user));
  });

  app.get('/dashboard', requireAuth, (req, res) => {
    const user = req.user as any;
    const userGuilds = (user.guilds ?? []).filter((g: any) =>
      config.ownerIds.includes(user.id) || isDiscordManagePermission(g.permissions)
    );
    const botGuilds = client.guilds.cache;
    const manageable = userGuilds.filter((g: any) => botGuilds.has(g.id));
    const invitable = userGuilds.filter((g: any) => !botGuilds.has(g.id));

    res.send(layoutPage('Dashboard', `
      <div class="container">
        <div class="page-title">👋 Welcome, ${user.username}</div>
        <div class="page-subtitle">Select a server to manage</div>
        ${manageable.length === 0 ? `<div class="card"><p style="color:var(--text-muted)">No servers found with <strong>Manage Requiresr</strong> or <strong>Administrator</strong> permission where PhoenikBot is present.</p></div>` : ''}
        <div class="guild-grid">
          ${manageable.map((g: any) => `
            <div class="guild-card">
              <div class="guild-icon">
                ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" alt="${g.name}">` : g.name.charAt(0).toUpperCase()}
              </div>
              <div class="guild-name">${g.name}</div>
              <a href="/guild/${g.id}" class="btn btn-primary btn-sm">Manage</a>
            </div>
          `).join('')}
          ${invitable.map((g: any) => `
            <div class="guild-card" style="opacity:.6">
              <div class="guild-icon">
                ${g.icon ? `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png" alt="${g.name}">` : g.name.charAt(0).toUpperCase()}
              </div>
              <div class="guild-name">${g.name}</div>
              <a href="https://discord.com/api/oauth2/authorize?client_id=${config.clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}" target="_blank" class="btn btn-secondary btn-sm">Invite Bot</a>
            </div>
          `).join('')}
        </div>
      </div>
    `, user));
  });

  app.get('/guild/:id', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.redirect('/dashboard'); return; }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect('/dashboard'); return; }

    await guild.channels.fetch().catch(() => null);

    const [guildData, ticketConfig, welcomeConfig, stats, autoResponses, ytConfigs, recentTickets, automationRules, auditEntries] = await Promise.all([
      getGuild(guildId),
      getTicketConfig(guildId),
      getWelcomeConfig(guildId),
      StatsModel.find({ guildId }).sort({ date: -1 }).limit(7),
      AutoResponseModel.find({ guildId }).sort({ createdAt: -1 }).limit(50),
      YouTubeConfigModel.find({ guildId }),
      TicketModel.find({ guildId }).sort({ createdAt: -1 }).limit(8),
      AutomationRuleModel.find({ guildId }).sort({ createdAt: -1 }).limit(50),
      AuditLogModel.find({ guildId }).sort({ createdAt: -1 }).limit(150),
    ]);

    const channels = guild.channels.cache
      .filter(
        (c) =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          !c.isThread()
      )
      .sort((a, b) => (a as any).position - (b as any).position)
      .map((c) => ({ id: c.id, name: (c as any).name ?? c.id }));

    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

    const categories = guild.channels.cache
      .filter((c) => c.type === 4) // GUILD_CATEGORY
      .sort((a, b) => (a as any).position - (b as any).position)
      .map((c) => ({ id: c.id, name: (c as any).name ?? c.id }));

    const totalMessages = stats.reduce((s, d) => s + (d.messages ?? 0), 0);
    const totalJoins = stats.reduce((s, d) => s + (d.joins ?? 0), 0);
    const openTickets = await TicketModel.countDocuments({ guildId, status: 'open' });
    const closedTickets = await TicketModel.countDocuments({ guildId, status: 'closed' });
    const maxStatMsg = Math.max(1, ...stats.map((d) => d.messages ?? 0));

    const moduleKeysList = [
      'ticket', 'giveaway', 'verification', 'antirAid', 'antinuke', 'antilink', 'logging', 'youtube', 'twitch',
      'roblox', 'ai', 'suggestions', 'reactionRoles', 'stats', 'schedule', 'backup', 'minigames', 'moderation', 'automation',
    ] as const;
    const modulesMerged: Record<string, boolean> = {};
    for (const k of moduleKeysList) {
      modulesMerged[k] = Boolean(guildData.modules[k as keyof GuildModules]);
    }

    const flash = req.query.saved
      ? `<div class="alert alert-success">✅ Impostazioni salvate.</div>`
      : req.query.error
        ? `<div class="alert alert-danger">❌ ${escapeHtml(String(req.query.error))}</div>`
        : '';

    const moduleDescriptions: Record<string, string> = {
      ticket: 'Ticket support system', giveaway: 'Giveaway system',
      verification: 'Member verification', antirAid: 'Anti-raid protection',
      antinuke: 'Anti-nuke protection', antilink: 'Anti-link filter',
      logging: 'Message & action logs', youtube: 'YouTube notifications',
      twitch: 'Twitch notifications', roblox: 'Roblox integrations',
      ai: 'AI moderation', suggestions: 'Suggestion system',
      reactionRoles: 'Reaction/button roles', stats: 'Statistics tracking',
      schedule: 'Scheduled messages', backup: 'Requiresr backup',
      minigames: 'Mini games', moderation: 'Moderation commands',
      automation: 'IF/THEN rules (keyword → reply)',
    };

    const chartBars = [...stats].reverse().map((d) => {
      const h = Math.round(((d.messages ?? 0) / maxStatMsg) * 100);
      return `<div class="chart-bar" style="height:${h}%"><span>${escapeHtml(String(d.date).slice(5))}</span></div>`;
    }).join('');

    res.send(layoutPage(`${guild.name}`, `
      <div class="container">
        <div class="guild-header-row">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <a href="/dashboard" class="btn btn-ghost btn-sm">← Requiresr</a>
            ${guild.iconURL({ size: 64 }) ? `<img src="${guild.iconURL({ size: 64 })}" width="40" height="40" style="border-radius:50%;border:1px solid var(--border)">` : ''}
            <div>
              <div class="page-title" style="margin:0">${escapeHtml(guild.name)}</div>
              <div class="page-subtitle" style="margin:0">${escapeHtml(guild.id)} · ${guild.memberCount} members</div>
            </div>
          </div>
          <span class="pill">Dashboard live</span>
        </div>

        ${flash}

        <button type="button" class="btn btn-secondary btn-sm mobile-sidebar-toggle" id="mobileSidebarToggle">☰ Menu</button>

        <div class="guild-shell">
          <aside class="sidebar-rail">
            <nav class="sidebar-nav" aria-label="Sections">
              <div class="sidebar-section">Home</div>
              <a class="active" href="#" data-tab="tab-overview">Overview</a>
              <div class="sidebar-section">Core</div>
              <a href="#" data-tab="tab-modules">Modules</a>
              <a href="#" data-tab="tab-tickets">Tickets</a>
              <a href="#" data-tab="tab-general">Requiresr</a>
              <a href="#" data-tab="tab-logging">Logs</a>
              <a href="#" data-tab="tab-audit">Audit</a>
              <a href="#" data-tab="tab-roles">Roles</a>
              <a href="#" data-tab="tab-automod">Security</a>
              <div class="sidebar-section">Community</div>
              <a href="#" data-tab="tab-verify">Verification</a>
              <a href="#" data-tab="tab-autoresponse">Auto‑reply</a>
              <a href="#" data-tab="tab-welcome">Welcome</a>
              <a href="#" data-tab="tab-youtube">YouTube</a>
              <a href="#" data-tab="tab-stats">Statistics</a>
              <div class="sidebar-section">LAB</div>
              <a href="#" data-tab="tab-ai">AI assist</a>
              <a href="#" data-tab="tab-automations">Automations</a>
              <a href="#" data-tab="tab-roadmap">Roadmap</a>
            </nav>
          </aside>

          <div class="guild-main">
            <div id="tab-overview" class="tab-content">
              <div class="grid-3">
                <div class="card stat-card glass-card"><div class="stat-value">${totalMessages}</div><div class="stat-label">Messages (7d)</div></div>
                <div class="card stat-card glass-card"><div class="stat-value">${openTickets}</div><div class="stat-label">Open tickets</div></div>
                <div class="card stat-card glass-card"><div class="stat-value">${totalJoins}</div><div class="stat-label">New users (7d)</div></div>
              </div>
              <div class="grid-2" style="margin-top:16px">
                <div class="card">
                  <div class="card-title">Message Activity</div>
                  ${stats.length ? `<div class="chart-row">${chartBars}</div>` : '<p class="placeholder-panel">No data yet — the bot collects daily stats.</p>'}
                </div>
                <div class="card">
                  <div class="card-title">Recent Tickets</div>
                  ${recentTickets.length === 0
                    ? '<p class="placeholder-panel">No tickets registered.</p>'
                    : `<table class="table"><thead><tr><th>#</th><th>Status</th><th>Type</th><th>User</th></tr></thead><tbody>
                      ${recentTickets.map((t) => `<tr>
                        <td>#${t.ticketNumber}</td>
                        <td><span class="badge ${t.status === 'open'
                          ? 'badge-success'
                          : t.status === 'closed'
                            ? 'badge-danger'
                            : 'badge-warn'}">${t.status}</span></td>
                        <td>${escapeHtml(t.type)}</td>
                        <td><code style="font-size:.78rem">${t.userId}</code></td>
                      </tr>`).join('')}
                    </tbody></table>
                    <p style="margin-top:10px;font-size:.85rem;color:var(--muted)">Apri la sezione <strong>Ticket</strong> per inbox completa e azioni staff.</p>`}
                </div>
              </div>
            </div>

            <!-- MODULES TAB -->
            <div id="tab-modules" class="tab-content">
              <div class="card">
                <div class="card-title">📦 Module Management</div>
                <form method="POST" action="/api/guild/${guildId}/modules">
                  ${Object.entries(modulesMerged).map(([name, enabled]) => `
                    <div class="toggle-row">
                      <div>
                        <div class="toggle-label">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
                        <div class="toggle-desc">${moduleDescriptions[name] ?? ''}</div>
                      </div>
                      <label class="switch">
                        <input type="checkbox" name="${name}" ${enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                      </label>
                    </div>
                  `).join('')}
                  <div style="margin-top:16px">
                    <button type="submit" class="btn btn-primary">Save Modules</button>
                  </div>
                </form>
              </div>
            </div>

            <!-- GENERAL TAB -->
            <div id="tab-general" class="tab-content">
              <div class="card">
                <div class="card-title">⚙️ General Settings</div>
                <form method="POST" action="/api/guild/${guildId}/general">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Log Channel</label>
                      <select name="logChannel">
                        <option value="">None</option>
                        ${channels.map((c) => `<option value="${c.id}" ${guildData.logChannel === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Mod Log Channel</label>
                      <select name="modLogChannel">
                        <option value="">None</option>
                        ${channels.map((c) => `<option value="${c.id}" ${guildData.modLogChannel === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Suggestions Channel</label>
                      <select name="suggestionsChannel">
                        <option value="">None</option>
                        ${channels.map((c) => `<option value="${c.id}" ${guildData.suggestionsChannel === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Warn → Mute Threshold</label>
                      <input type="number" name="warnMuteThreshold" value="${guildData.autoModThresholds.warnMuteThreshold}" min="1" max="20">
                    </div>
                    <div class="form-group">
                      <label>Warn → Ban Threshold</label>
                      <input type="number" name="warnBanThreshold" value="${guildData.autoModThresholds.warnBanThreshold}" min="1" max="20">
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">Save Settings</button>
                </form>
              </div>
            </div>

            <div id="tab-tickets" class="tab-content">
              <div class="card">
                <div class="card-title">🎫 Ticket Inbox</div>
                <p style="color:var(--muted);font-size:.88rem;margin-bottom:12px">Select a ticket to view saved messages, AI insights (if configured), and quick actions.</p>
                <div class="inbox-split">
                  <div class="inbox-list" id="ticketInboxList"><div style="padding:12px;color:var(--muted)">Loading…</div></div>
                  <div class="inbox-detail" id="ticketInboxDetail" style="color:var(--muted)">Select a ticket from the list.</div>
                </div>
              </div>

              <form id="ticketConfigForm" method="POST" action="/api/guild/${guildId}/ticket/config">
              <div class="grid-2">
                <div class="card">
                <div class="card-title">🎫 Ticket Panel — Content</div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Titolo embed</label>
                    <input type="text" name="embedTitle" id="fldEmbedTitle" value="${escapeHtml(ticketConfig.embedTitle)}">
                  </div>
                  <div class="form-group">
                    <label>Colore</label>
                    <div style="display:flex;align-items:center;gap:8px">
                      <input type="color" name="embedColor" value="${ticketConfig.embedColor}" style="width:50px;height:38px;padding:2px;cursor:pointer" id="embedColorPicker" onchange="document.getElementById('embedColorText').value=this.value;document.getElementById('embedColorPreview').style.background=this.value;window.phoenixSyncPreview && window.phoenixSyncPreview()">
                      <input type="text" name="embedColorText" id="embedColorText" value="${escapeHtml(ticketConfig.embedColor)}" style="flex:1" oninput="document.getElementById('embedColorPicker').value=this.value;document.getElementById('embedColorPreview').style.background=this.value;window.phoenixSyncPreview && window.phoenixSyncPreview()">
                      <span id="embedColorPreview" class="color-preview" style="background:${ticketConfig.embedColor}"></span>
                    </div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Descrizione embed</label>
                  <textarea name="embedDescription" id="fldEmbedDesc">${escapeHtml(ticketConfig.embedDescription)}</textarea>
                </div>
                </div>
                <div class="card">
                  <div class="card-title">📺 Live Preview</div>
                  <div id="embedLivePreview" class="embed-preview" style="border-left-color:${escapeHtml(ticketConfig.embedColor)}">
                    <div class="t" id="pvTitle">${escapeHtml(ticketConfig.embedTitle)}</div>
                    <div class="d" id="pvDesc">${escapeHtml(ticketConfig.embedDescription)}</div>
                    <div class="f">PhoenikBot · preview</div>
                  </div>
                  <p style="margin-top:10px;font-size:.78rem;color:var(--muted)">L’anteprima aggiorna mentre modifichi titolo, descrizione e colore.</p>
                </div>
              </div>
                <div class="card">
                  <div class="card-title">🖼️ Embed Images</div>
                  <div class="alert alert-info" style="margin-bottom:12px">
                    <strong>📌 How to get Discord image URLs:</strong><br>
                    1. Upload your image in Discord chat<br>
                    2. <strong>Right-click the image</strong> → "Copy Link"<br>
                    3. Paste the link (must contain <code>cdn.discordapp.com</code>)<br>
                    <br>
                    <strong>⚠️ Don't copy the message link!</strong> You need the direct image URL.
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Image URL (shown below description)</label>
                      <input type="text" name="embedImage" id="embedImageField" value="${escapeHtml(ticketConfig.embedImage ?? '')}" placeholder="https://cdn.discordapp.com/attachments/...">
                      <div id="embedImageStatus" style="font-size:.75rem;margin-top:4px"></div>
                    </div>
                    <div class="form-group">
                      <label>Thumbnail URL (top-right corner)</label>
                      <input type="text" name="embedThumbnail" id="embedThumbnailField" value="${escapeHtml(ticketConfig.embedThumbnail ?? '')}" placeholder="https://cdn.discordapp.com/avatars/...">
                      <div id="embedThumbnailStatus" style="font-size:.75rem;margin-top:4px"></div>
                    </div>
                  </div>
                  <script>
                    function validateImageUrl(fieldId, statusId) {
                      const field = document.getElementById(fieldId);
                      const status = document.getElementById(statusId);
                      const value = field.value.trim();
                      
                      if (!value) {
                        status.innerHTML = '<span style="color:var(--text-muted)">Optional field</span>';
                        field.style.borderColor = '';
                        return;
                      }
                      
                      // Check for Discord message links
                      if (value.includes('discord.com/channels/') || value.includes('discord.com/messages/')) {
                        status.innerHTML = '<span style="color:#ED4245">❌ This is a message link, not an image! Right-click the image itself and copy its link.</span>';
                        field.style.borderColor = '#ED4245';
                        return;
                      }
                      
                      // Check for valid patterns
                      const validPatterns = ['cdn.discordapp.com', 'media.discordapp.net', 'images.unsplash.com', 'imgur.com', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
                      const isValid = validPatterns.some(p => value.includes(p));
                      
                      if (isValid) {
                        status.innerHTML = '<span style="color:#57F287">✅ Valid image URL</span>';
                        field.style.borderColor = '#57F287';
                      } else {
                        status.innerHTML = '<span style="color:#FEE75C">⚠️ URL format unknown. Try copying the direct image link from Discord.</span>';
                        field.style.borderColor = '#FEE75C';
                      }
                    }
                    
                    document.getElementById('embedImageField')?.addEventListener('input', () => validateImageUrl('embedImageField', 'embedImageStatus'));
                    document.getElementById('embedThumbnailField')?.addEventListener('input', () => validateImageUrl('embedThumbnailField', 'embedThumbnailStatus'));
                    validateImageUrl('embedImageField', 'embedImageStatus');
                    validateImageUrl('embedThumbnailField', 'embedThumbnailStatus');
                  </script>
                </div>
                <div class="form-group">
                  <label>Footer Text (optional)</label>
                  <input type="text" name="embedFooter" value="${escapeHtml(ticketConfig.embedFooter ?? '')}" placeholder="Your server name or custom text">
                </div>

              <div class="card">
                <div class="card-title">🔘 Panel Buttons (max 25)</div>
                <p style="font-size:.82rem;color:var(--muted);margin-bottom:10px">Customize label, emoji (optional), <strong>type ID</strong> (only <code>a-z</code>, <code>0-9</code>, <code>_</code>, <code>-</code>) and style. Each type opens a ticket with that type (e.g. <code>support</code>, <code>vip</code>). Paste Discord images: copy attachment link or GIF (CDN <code>cdn.discordapp.com</code> / <code>media.discordapp.net</code>).</p>
                <div id="ticketBtnBuilder" class="ticket-btn-builder"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="ticketBtnAdd">+ Add Button</button>
                <input type="hidden" name="ticketButtonsJson" id="ticketButtonsJsonField" value="">
              </div>

              <div class="card">
                <div class="card-title">🧵 Thread Settings</div>
                <div class="grid-2">
                  <div class="form-group">
                    <label>Thread Name Template</label>
                    <input type="text" name="threadNameTemplate" value="${escapeHtml(ticketConfig.threadNameTemplate)}" placeholder="{type}-{username}">
                    <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Vars: {type} {username} {id} {ticket_number}</div>
                  </div>
                  <div class="form-group">
                    <label>Auto-close after inactivity (hours, 0 = disabled)</label>
                    <input type="number" name="autoCloseHours" value="${ticketConfig.autoCloseHours}" min="0" max="168">
                  </div>
                </div>
                <div class="form-group" style="margin-top:12px">
                  <label>Ticket Category (where to create ticket channels)</label>
                  <select name="ticketCategory">
                    <option value="">No category (default)</option>
                    ${categories.map((c) => `<option value="${c.id}" ${guildData.ticketCategory === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
              </div>

              <div class="card">
                <div class="card-title">💬 Thread Opening Message</div>
                <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">This is the first message sent inside the ticket thread when it's opened. Fully customizable.</p>
                <div class="toggle-row" style="margin-bottom:12px">
                  <div><div class="toggle-label">Send as Embed</div><div class="toggle-desc">If off, sends as plain text</div></div>
                  <label class="switch">
                    <input type="checkbox" name="openMessageIsEmbed" id="openMessageIsEmbed" ${ticketConfig.openMessageIsEmbed !== false ? 'checked' : ''} onchange="document.getElementById('embedFields').style.display=this.checked?'block':'none'">
                    <span class="slider"></span>
                  </label>
                </div>
                <div id="embedFields" style="display:${ticketConfig.openMessageIsEmbed !== false ? 'block' : 'none'}">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Embed Title</label>
                      <input type="text" name="openMessageEmbedTitle" value="${escapeHtml(ticketConfig.openMessageEmbedTitle ?? '🎫 Ticket #{ticket_number}')}" placeholder="🎫 Ticket #{ticket_number}">
                    </div>
                    <div class="form-group">
                      <label>Embed Color</label>
                      <div style="display:flex;align-items:center;gap:8px">
                        <input type="color" name="openMessageEmbedColor" value="${ticketConfig.openMessageEmbedColor ?? '#5865F2'}" style="width:50px;height:38px;padding:2px;cursor:pointer" id="omColorPicker" onchange="document.getElementById('omColorText').value=this.value;document.getElementById('omColorPreview').style.background=this.value">
                        <input type="text" name="openMessageEmbedColorText" id="omColorText" value="${escapeHtml(ticketConfig.openMessageEmbedColor ?? '#5865F2')}" style="flex:1" oninput="document.getElementById('omColorPicker').value=this.value;document.getElementById('omColorPreview').style.background=this.value">
                        <span id="omColorPreview" class="color-preview" style="background:${ticketConfig.openMessageEmbedColor ?? '#5865F2'}"></span>
                      </div>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Author text (optional, small text above title)</label>
                    <input type="text" name="openMessageEmbedAuthor" value="${escapeHtml(ticketConfig.openMessageEmbedAuthor ?? '')}" placeholder="Support Team">
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Thumbnail URL (top-right image)</label>
                      <input type="text" name="openMessageEmbedThumbnail" value="${escapeHtml(ticketConfig.openMessageEmbedThumbnail ?? '')}" placeholder="https://...">
                    </div>
                    <div class="form-group">
                      <label>Image URL (large image below description)</label>
                      <input type="text" name="openMessageEmbedImage" value="${escapeHtml(ticketConfig.openMessageEmbedImage ?? '')}" placeholder="https://...">
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Footer Text (optional)</label>
                    <input type="text" name="openMessageEmbedFooter" value="${escapeHtml(ticketConfig.openMessageEmbedFooter ?? '')}" placeholder="Ticket will be closed after 48h of inactivity">
                  </div>
                </div>
                <div class="form-group">
                  <label>Message Content / Embed Description</label>
                  <textarea name="openMessageTemplate" style="min-height:120px">${escapeHtml(ticketConfig.openMessageTemplate)}</textarea>
                  <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Variables: {user} {username} {date} {ticket_type} {ticket_number}</div>
                </div>
              </div>

              <div class="card">
                <div class="card-title">Staff ticket & log</div>
                <div class="form-group">
                  <label>Staff Roles (thread access)</label>
                  <div id="ticketStaffTags" style="margin-bottom:8px">
                    ${ticketConfig.staffRoles.map((id) => {
                        const r = roles.find((x) => x.id === id);
                        return `<span class="tag">${r ? escapeHtml(r.name) : id} <span class="tag-remove" onclick="removeTicketStaff('${id}',this.parentElement)">×</span></span>`;
                      }).join('')}
                  </div>
                  <input type="hidden" name="staffRoles" id="ticketStaffInput" value="${ticketConfig.staffRoles.join(',')}">
                  <select id="ticketStaffSelect" onchange="addTicketStaff(this)">
                    <option value="">Aggiungi ruolo…</option>
                    ${roles.map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Canale log ticket</label>
                  <select name="logChannel">
                    <option value="">None</option>
                    ${channels.map((c) => `<option value="${c.id}" ${ticketConfig.logChannelId === c.id ? 'selected' : ''}>#${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
                <button type="submit" class="btn btn-primary">Save ticket configuration</button>
              </div>
              </form>

              <div class="card">
                <div class="card-title">📤 Send Ticket Panel</div>
                <p style="color:var(--text-muted);font-size:.9rem;margin-bottom:16px">Send the ticket panel embed with buttons to a channel. Save your config above first!</p>
                <form method="POST" action="/api/guild/${guildId}/ticket/panel">
                  <div class="form-group">
                    <label>Send to Channel</label>
                    <select name="channelId" required>
                      <option value="">Select a channel...</option>
                      ${channels.map((c) => `<option value="${c.id}" ${ticketConfig.panelChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                    </select>
                  </div>
                  ${ticketConfig.panelChannelId ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">Currently in <strong>#${channels.find(c=>c.id===ticketConfig.panelChannelId)?.name ?? ticketConfig.panelChannelId}</strong></p>` : ''}
                  <button type="submit" class="btn btn-success">📤 Send Panel</button>
                </form>
              </div>
            </div>

            <!-- LOGGING TAB -->
            <div id="tab-logging" class="tab-content">
              <div class="card">
                <div class="card-title">📋 Logging Configuration</div>
                <form method="POST" action="/api/guild/${guildId}/general">
                  <div class="form-group">
                    <label>General Log Channel</label>
                    <select name="logChannel">
                      <option value="">None (disable logging)</option>
                      ${channels.map((c) => `<option value="${c.id}" ${guildData.logChannel === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Moderation Log Channel</label>
                    <select name="modLogChannel">
                      <option value="">None</option>
                      ${channels.map((c) => `<option value="${c.id}" ${guildData.modLogChannel === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary">Save</button>
                </form>
              </div>
            </div>

            <div id="tab-audit" class="tab-content">
              <div class="card">
                <div class="card-title">Audit (dashboard)</div>
                <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">Eventi registrati dal bot (apertura/chiusura ticket, ecc.). API REST: <code>GET ${escapeHtml(config.dashboardUrl)}/api/v1/guild/${guildId}/audit</code> con header <code>Authorization: Bearer TUA_CHIAVE</code> o <code>X-API-Key</code> (variabile <code>DASHBOARD_API_KEY</code> nel <code>.env</code>).</p>
                ${auditEntries.length === 0
                  ? '<p class="placeholder-panel">No events yet.</p>'
                  : `<div style="overflow:auto;max-height:420px;border:1px solid var(--border);border-radius:12px"><table class="table"><thead><tr><th>Date</th><th>Action</th><th>Actor</th><th>Details</th></tr></thead><tbody>
                    ${auditEntries.map((a: any) => `<tr>
                      <td style="white-space:nowrap;font-size:.78rem">${escapeHtml(new Date(a.createdAt).toLocaleString())}</td>
                      <td><code>${escapeHtml(a.action)}</code></td>
                      <td style="font-size:.78rem">${a.actorId ? '<code>'+escapeHtml(a.actorId)+'</code>' : '—'}</td>
                      <td style="font-size:.78rem;max-width:280px">${a.detail ? escapeHtml(a.detail) : '—'}</td>
                    </tr>`).join('')}
                    </tbody></table></div>`}
              </div>
            </div>

            <!-- ROLES TAB -->
            <div id="tab-roles" class="tab-content">
              <div class="card">
                <div class="card-title">👥 Staff & Admin Roles</div>
                <form method="POST" action="/api/guild/${guildId}/roles">
                  <div class="form-group">
                    <label>Staff Roles (can manage tickets, view mod info)</label>
                    <div id="staffRolesTags" style="margin-bottom:8px">
                      ${guildData.staffRoles.map((id) => {
                        const r = roles.find((x) => x.id === id);
                        return `<span class="tag">${r ? r.name : id} <span class="tag-remove" onclick="removeTag('staffRoles','${id}',this.parentElement)">×</span></span>`;
                      }).join('')}
                    </div>
                    <input type="hidden" name="staffRoles" id="staffRolesInput" value="${guildData.staffRoles.join(',')}">
                    <select onchange="addTag('staffRoles',this)">
                      <option value="">Add staff role...</option>
                      ${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Admin Roles (full bot control)</label>
                    <div id="adminRolesTags" style="margin-bottom:8px">
                      ${guildData.adminRoles.map((id) => {
                        const r = roles.find((x) => x.id === id);
                        return `<span class="tag">${r ? r.name : id} <span class="tag-remove" onclick="removeTag('adminRoles','${id}',this.parentElement)">×</span></span>`;
                      }).join('')}
                    </div>
                    <input type="hidden" name="adminRoles" id="adminRolesInput" value="${guildData.adminRoles.join(',')}">
                    <select onchange="addTag('adminRoles',this)">
                      <option value="">Add admin role...</option>
                      ${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                  </div>
                  <button type="submit" class="btn btn-primary">Save Roles</button>
                </form>
              </div>
            </div>

            <!-- AUTOMOD TAB -->
            <div id="tab-automod" class="tab-content">
              <div class="card">
                <div class="card-title">🛡️ Anti-Link Settings</div>
                <form method="POST" action="/api/guild/${guildId}/antilink">
                  <div class="toggle-row">
                    <div><div class="toggle-label">Enable Anti-Link</div></div>
                    <label class="switch">
                      <input type="checkbox" name="enabled" ${guildData.antilink.enabled ? 'checked' : ''}>
                      <span class="slider"></span>
                    </label>
                  </div>
                  <div class="form-group" style="margin-top:12px">
                    <label>Action</label>
                    <select name="action">
                      <option value="delete" ${guildData.antilink.action === 'delete' ? 'selected' : ''}>Delete message only</option>
                      <option value="delete_warn" ${guildData.antilink.action === 'delete_warn' ? 'selected' : ''}>Delete + Warn</option>
                      <option value="delete_timeout" ${guildData.antilink.action === 'delete_timeout' ? 'selected' : ''}>Delete + Timeout</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Whitelisted Domains (comma-separated)</label>
                    <input type="text" name="whitelist" value="${guildData.antilink.whitelist.join(', ')}">
                  </div>
                  <div class="form-group">
                    <label>Blacklisted Domains (comma-separated)</label>
                    <input type="text" name="blacklist" value="${guildData.antilink.blacklist.join(', ')}">
                  </div>
                  <button type="submit" class="btn btn-primary">Save Anti-Link</button>
                </form>
              </div>

              <div class="card">
                <div class="card-title">⚠️ Auto-Moderation Thresholds</div>
                <form method="POST" action="/api/guild/${guildId}/general">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Raids: Joins per window</label>
                      <input type="number" name="raidJoins" value="${guildData.autoModThresholds.raidJoins}" min="2" max="50">
                    </div>
                    <div class="form-group">
                      <label>Raids: Time window (seconds)</label>
                      <input type="number" name="raidSeconds" value="${guildData.autoModThresholds.raidSeconds}" min="1" max="60">
                    </div>
                    <div class="form-group">
                      <label>Anti-raid: Minimum account age (hours, 0 = off)</label>
                      <input type="number" name="raidMinAccountAgeHours" value="${guildData.autoModThresholds.raidMinAccountAgeHours ?? 0}" min="0" max="8760" title="If > 0, new accounts will be timed out (requires ModerateMembers permission)">
                    </div>
                    <div class="form-group">
                      <label>Nuke: Max channel deletes</label>
                      <input type="number" name="nukeChannelDeletes" value="${guildData.autoModThresholds.nukeChannelDeletes}" min="1" max="20">
                    </div>
                    <div class="form-group">
                      <label>Nuke: Max bans in window</label>
                      <input type="number" name="nukeBans" value="${guildData.autoModThresholds.nukeBans}" min="1" max="30">
                    </div>
                    <div class="form-group">
                      <label>Warn → Mute (# of warns)</label>
                      <input type="number" name="warnMuteThreshold" value="${guildData.autoModThresholds.warnMuteThreshold}" min="1" max="20">
                    </div>
                    <div class="form-group">
                      <label>Warn → Ban (# of warns)</label>
                      <input type="number" name="warnBanThreshold" value="${guildData.autoModThresholds.warnBanThreshold}" min="1" max="20">
                    </div>
                    <div class="form-group">
                      <label>Auto-mute duration after warn (minutes)</label>
                      <input type="number" name="muteDurationMinutes" value="${Math.round((guildData.autoModThresholds.muteDuration ?? 3600000) / 60000)}" min="1" max="10080">
                    </div>
                    <div class="form-group">
                      <label>Nuke: Max role deletions</label>
                      <input type="number" name="nukeRoleDeletes" value="${guildData.autoModThresholds.nukeRoleDeletes}" min="1" max="30">
                    </div>
                    <div class="form-group">
                      <label>Nuke: Detection window (seconds)</label>
                      <input type="number" name="nukeWindowSeconds" value="${guildData.autoModThresholds.nukeWindowSeconds}" min="5" max="300">
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">Save Thresholds</button>
                </form>
              </div>
            </div>

            <!-- VERIFY TAB -->
            <div id="tab-verify" class="tab-content">
              <div class="card">
                <div class="card-title">✅ Verification Settings</div>
                <form method="POST" action="/api/guild/${guildId}/verify">
                  <div class="form-group">
                    <label>Verification Mode</label>
                    <select name="verifyMode">
                      <option value="">Disabled</option>
                      <option value="button" ${guildData.verifyMode === 'button' ? 'selected' : ''}>Button Click (simplest)</option>
                      <option value="captcha" ${guildData.verifyMode === 'captcha' ? 'selected' : ''}>Captcha (code in DM)</option>
                      <option value="roblox" ${guildData.verifyMode === 'roblox' ? 'selected' : ''}>Roblox Account Link</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Role to give after verification</label>
                    <select name="verifyRole">
                      <option value="">None</option>
                      ${roles.map((r) => `<option value="${r.id}" ${guildData.verifyRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Role to remove after verification (e.g., "Not Verified")</label>
                    <select name="unverifiedRole">
                      <option value="">None</option>
                      ${roles.map((r) => `<option value="${r.id}" ${guildData.unverifiedRole === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
                    </select>
                  </div>
                  <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">Use <strong>/verify setup</strong> in Discord to send the verification panel to a channel.</p>
                  <button type="submit" class="btn btn-primary">💾 Save Verification</button>
                </form>
              </div>
            </div>

            <!-- WELCOME TAB -->
            <div id="tab-welcome" class="tab-content">
              <div class="card">
                <div class="card-title">👋 Welcome Message Settings</div>
                <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:16px">Configure welcome messages and auto-roles for new members joining the server.</p>
                
                <form method="POST" action="/api/guild/${guildId}/welcome">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Welcome Channel</label>
                      <select name="welcomeChannelId">
                        <option value="">None (disabled)</option>
                        ${channels.map((c) => `<option value="${c.id}" ${welcomeConfig.welcomeChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Auto-Role Delay (ms)</label>
                      <input type="number" name="autoRoleDelay" value="${welcomeConfig.autoRoleDelay || 0}" min="0" max="60000" step="1000" placeholder="0 = immediately">
                      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Delay before applying auto-roles (0 = immediately)</div>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Auto-Roles (assigned when member joins)</label>
                    <div id="welcomeAutoRoles" style="margin-bottom:8px">
                      ${welcomeConfig.autoRoleIds && welcomeConfig.autoRoleIds.length > 0 
                        ? welcomeConfig.autoRoleIds.map((rid) => {
                            const r = roles.find((x: any) => x.id === rid);
                            return r ? `<span class="badge badge-secondary" style="margin:4px;display:inline-flex;align-items:center;gap:4px;padding:4px 8px"><input type="hidden" name="autoRoleIds" value="${r.id}">${r.name} <a href="javascript:void(0)" onclick="this.parentElement.remove()" style="color:var(--text-muted);margin-left:4px">×</a></span>` : '';
                          }).join('')
                        : '<span style="color:var(--text-muted);font-size:.85rem">No auto-roles selected</span>'
                      }
                    </div>
                    <select onchange="addAutoRole(this.value, '${guildId}'); this.value=''">
                      <option value="">Add role...</option>
                      ${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}
                    </select>
                    <script>
                      function addAutoRole(roleId, guildId) {
                        if (!roleId) return;
                        const container = document.getElementById('welcomeAutoRoles');
                        const roleName = this.document.querySelector('option[value="' + roleId + '"]')?.text || roleId;
                        const span = document.createElement('span');
                        span.className = 'badge badge-secondary';
                        span.style = 'margin:4px;display:inline-flex;align-items:center;gap:4px;padding:4px 8px';
                        span.innerHTML = '<input type="hidden" name="autoRoleIds" value="' + roleId + '">' + roleName + ' <a href="javascript:void(0)" onclick="this.parentElement.remove()" style="color:var(--text-muted);margin-left:4px">×</a>';
                        container.appendChild(span);
                      }
                    </script>
                  </div>

                  <div class="card" style="margin-top:16px">
                    <div class="card-title">📝 Welcome Embed</div>
                    <div class="grid-2">
                      <div class="form-group">
                        <label>Welcome Channel</label>
                        <select name="welcomeChannelId" id="welcomeChannelSelect">
                          <option value="">None (disabled)</option>
                          ${channels.map((c) => `<option value="${c.id}" ${welcomeConfig.welcomeChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                        </select>
                      </div>
                    </div>

                    <div class="toggle-row" style="margin-bottom:12px">
                      <div><div class="toggle-label">Send Welcome Message</div><div class="toggle-desc">Send a message when someone joins</div></div>
                      <label class="switch">
                        <input type="checkbox" name="welcomeMessageEnabled" id="welcomeMsgToggle" ${welcomeConfig.welcomeMessageEnabled !== false ? 'checked' : ''} onchange="document.getElementById('welcomeFields').style.display=this.checked?'block':'none'">
                        <span class="slider"></span>
                      </label>
                    </div>

                    <div id="welcomeFields" style="display:${welcomeConfig.welcomeMessageEnabled !== false ? 'block' : 'none'}">
                      <div class="grid-2">
                        <div class="form-group">
                          <label>Embed Title</label>
                          <input type="text" name="welcomeEmbedTitle" value="${escapeHtml(welcomeConfig.welcomeEmbedTitle || '🎉 Welcome!')}" placeholder="🎉 Welcome!">
                        </div>
                        <div class="form-group">
                          <label>Embed Color</label>
                          <input type="color" name="welcomeEmbedColor" value="${welcomeConfig.welcomeEmbedColor || '#5865F2'}" style="width:50px;height:38px">
                        </div>
                      </div>
                      <div class="form-group">
                        <label>Embed Description</label>
                        <textarea name="welcomeEmbedDescription" rows="3" placeholder="Welcome {user} to {server}!">${escapeHtml(welcomeConfig.welcomeEmbedDescription || 'Welcome {user} to {server}!')}</textarea>
                        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Variables: {user}, {username}, {usertag}, {server}, {member_count}, {date}, {joined_at}</div>
                      </div>
                      <div class="grid-2">
                        <div class="form-group">
                          <label>Thumbnail Image URL (optional)</label>
                          <input type="text" name="welcomeEmbedThumbnail" value="${escapeHtml(welcomeConfig.welcomeEmbedThumbnail || '')}" placeholder="https://... (shows as user avatar)">
                        </div>
                        <div class="form-group">
                          <label>Background Image URL (optional)</label>
                          <input type="text" name="welcomeEmbedImage" value="${escapeHtml(welcomeConfig.welcomeEmbedImage || '')}" placeholder="https://... (full width image)">
                        </div>
                      </div>
                      <div class="form-group">
                        <label>Footer Text (optional)</label>
                        <input type="text" name="welcomeEmbedFooter" value="${escapeHtml(welcomeConfig.welcomeEmbedFooter || '')}" placeholder="Your server name">
                      </div>
                    </div>
                  </div>

                  <div class="card" style="margin-top:16px">
                    <div class="card-title">👋 Leave Message Settings</div>
                    <div class="toggle-row" style="margin-bottom:12px">
                      <div><div class="toggle-label">Send Leave Message</div><div class="toggle-desc">Send a message when someone leaves</div></div>
                      <label class="switch">
                        <input type="checkbox" name="leaveMessageEnabled" id="leaveMsgToggle" ${welcomeConfig.leaveMessageEnabled ? 'checked' : ''} onchange="document.getElementById('leaveFields').style.display=this.checked?'block':'none'">
                        <span class="slider"></span>
                      </label>
                    </div>
                    <div id="leaveFields" style="display:${welcomeConfig.leaveMessageEnabled ? 'block' : 'none'}">
                      <div class="grid-2">
                        <div class="form-group">
                          <label>Leave Channel</label>
                          <select name="leaveChannelId">
                            <option value="">None</option>
                            ${channels.map((c) => `<option value="${c.id}" ${welcomeConfig.leaveChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                          </select>
                        </div>
                        <div class="form-group">
                          <label>Leave Message</label>
                          <input type="text" name="leaveEmbedTitle" value="${escapeHtml(welcomeConfig.leaveEmbedTitle || '👋 Member Left')}" placeholder="👋 Member Left">
                        </div>
                      </div>
                      <div class="form-group">
                        <label>Leave Description</label>
                        <textarea name="leaveEmbedDescription" rows="2">${escapeHtml(welcomeConfig.leaveEmbedDescription || '{user} left the server.')}</textarea>
                      </div>
                    </div>
                  </div>

                  <button type="submit" class="btn btn-primary" style="margin-top:16px">💾 Save Welcome Settings</button>
                </form>
              </div>
            </div>

            <!-- AUTO-RESPONSE TAB -->
            <div id="tab-autoresponse" class="tab-content">
              <div class="card">
                <div class="card-title">➕ Add Auto-response</div>
                <form method="POST" action="/api/guild/${guildId}/autoresponse/add">
                  <div class="form-group">
                    <label>Trigger Keywords (comma-separated)</label>
                    <input type="text" name="triggers" placeholder="verifica, verify, how to verify" required>
                  </div>
                  <div class="form-group">
                    <label>Response Text</label>
                    <textarea name="response" placeholder="To verify, click the button in #verify channel!" required></textarea>
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Cooldown (seconds)</label>
                      <input type="number" name="cooldownSeconds" value="30" min="5" max="3600">
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;padding-top:22px">
                      <label class="switch">
                        <input type="checkbox" name="includeTicketButton">
                        <span class="slider"></span>
                      </label>
                      <span style="font-size:.9rem">Add "Open Ticket" button</span>
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">➕ Add Auto-response</button>
                </form>
              </div>
              <div class="card">
                <div class="card-title">📋 Configured Auto-responses (${autoResponses.length})</div>
                ${autoResponses.length === 0 ? '<p style="color:var(--text-muted)">No auto-responses configured yet.</p>' :
                  '<table class="table"><thead><tr><th>Triggers</th><th>Response</th><th>Cooldown</th><th>Ticket Btn</th><th></th></tr></thead><tbody>' +
                  autoResponses.map((ar) => `<tr>
                    <td><code style="font-size:.8rem">${escapeHtml(ar.triggers.join(', '))}</code></td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(ar.response.slice(0, 80))}${ar.response.length > 80 ? '…' : ''}</td>
                    <td>${ar.cooldownSeconds}s</td>
                    <td>${ar.includeTicketButton ? '✅' : '—'}</td>
                    <td><form method="POST" action="/api/guild/${guildId}/autoresponse/${(ar as any)._id}/delete" style="display:inline"><button class="btn btn-danger btn-sm" type="submit">Delete</button></form></td>
                  </tr>`).join('') +
                  '</tbody></table>'}
              </div>
            </div>

            <!-- YOUTUBE TAB -->
            <div id="tab-youtube" class="tab-content">
              <div class="card">
                <div class="card-title">➕ Add YouTube Notifier</div>
                <form method="POST" action="/api/guild/${guildId}/youtube/add">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>YouTube Channel ID</label>
                      <input type="text" name="youtubeChannelId" placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" required>
                      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Find it in the channel's URL or About page</div>
                    </div>
                    <div class="form-group">
                      <label>YouTube Channel Name (label)</label>
                      <input type="text" name="youtubeChannelName" placeholder="My Channel" required>
                    </div>
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Discord Notification Channel</label>
                      <select name="discordChannelId" required>
                        <option value="">Select channel...</option>
                        ${channels.map((c) => `<option value="${c.id}">#${c.name}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Ping Role (optional)</label>
                      <select name="pingRoleId">
                        <option value="">None</option>
                        ${roles.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Custom Message (optional, appears above embed)</label>
                    <input type="text" name="customMessage" placeholder="🔔 New video from {channel}!">
                  </div>
                  <div style="display:flex;gap:24px;margin-bottom:16px">
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                      <input type="checkbox" name="filterShorts" checked> Filter Shorts
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                      <input type="checkbox" name="filterLives"> Filter Live streams
                    </label>
                  </div>
                  <button type="submit" class="btn btn-primary">➕ Add Notifier</button>
                </form>
              </div>
              <div class="card">
                <div class="card-title">📋 Configured YouTube Notifiers (${ytConfigs.length})</div>
                ${ytConfigs.length === 0 ? '<p style="color:var(--text-muted)">No YouTube notifiers configured.</p>' :
                  '<table class="table"><thead><tr><th>Channel</th><th>Discord Channel</th><th>Ping Role</th><th>Shorts</th><th></th></tr></thead><tbody>' +
                  ytConfigs.map((yt) => {
                    const dcName = channels.find(c=>c.id===yt.discordChannelId)?.name;
                    const pingRole = roles.find(r=>r.id===yt.pingRoleId);
                    return `<tr>
                      <td><strong>${escapeHtml(yt.youtubeChannelName)}</strong></td>
                      <td>${dcName ? '#'+dcName : yt.discordChannelId}</td>
                      <td>${pingRole ? '@'+pingRole.name : '—'}</td>
                      <td>${yt.filterShorts ? 'filtered' : 'allowed'}</td>
                      <td><form method="POST" action="/api/guild/${guildId}/youtube/${(yt as any)._id}/delete" style="display:inline"><button class="btn btn-danger btn-sm" type="submit">Delete</button></form></td>
                    </tr>`;
                  }).join('') +
                  '</tbody></table>'}
              </div>
            </div>

            <div id="tab-ai" class="tab-content">
              <div class="card">
                <div class="card-title">🤖 AI Moderation Settings</div>
                <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:12px">Configure the AI moderation module. Requires <code>OPENAI_API_KEY</code> in the <code>.env</code> file for AI-powered content analysis. The bot already uses AI for anti-scam moderation when the AI module is active.</p>
              </div>

              <div class="card">
                <div class="card-title">🚫 Banned Words (Auto-Moderation)</div>
                <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">Add custom banned words that will be automatically detected and actioned. Supports multiple languages. Words are checked case-insensitively.</p>
                
                <form method="POST" action="/api/guild/${guildId}/bannedwords/add" style="margin-bottom:20px">
                  <div class="grid-4">
                    <div class="form-group">
                      <label>Word/Phrase</label>
                      <input type="text" name="word" required placeholder="badword" maxlength="100">
                    </div>
                    <div class="form-group">
                      <label>Severity</label>
                      <select name="severity">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Language</label>
                      <select name="language">
                        <option value="all">All Languages</option>
                        <option value="en">English</option>
                        <option value="it">Italian</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="pt">Portuguese</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Action</label>
                      <select name="action">
                        <option value="warn">Warn</option>
                        <option value="mute">Mute (1h)</option>
                        <option value="kick">Kick</option>
                        <option value="ban">Ban</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">➕ Add Banned Word</button>
                </form>

                <div id="bannedWordsList"></div>
                <script>
                  async function loadBannedWords() {
                    const list = document.getElementById('bannedWordsList');
                    if (!list) return;
                    try {
                      const res = await fetch('/api/guild/${guildId}/bannedwords');
                      const data = await res.json();
                      if (!data.words?.length) {
                        list.innerHTML = '<p style="color:var(--text-muted)">No banned words configured yet.</p>';
                        return;
                      }
                      list.innerHTML = '<table class="table"><thead><tr><th>Word</th><th>Severity</th><th>Language</th><th>Action</th><th></th></tr></thead><tbody>' +
                        data.words.map(w => '<tr>' +
                          '<td><code>' + esc(w.word) + '</code></td>' +
                          '<td><span class="badge badge-' + (w.severity === 'critical' ? 'danger' : w.severity === 'high' ? 'warn' : 'secondary') + '">' + w.severity + '</span></td>' +
                          '<td>' + w.language + '</td>' +
                          '<td>' + w.action + '</td>' +
                          '<td><a href="/api/guild/${guildId}/bannedwords/delete/' + w._id + '" class="btn btn-ghost btn-sm" onclick="return confirm(\'Delete this word?\')">🗑️</a></td>' +
                        '</tr>').join('') + '</tbody></table>';
                    } catch (e) {
                      list.innerHTML = '<p style="color:#ED4245">Failed to load banned words.</p>';
                    }
                  }
                  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
                  loadBannedWords();
                </script>
              </div>
            </div>

            <div id="tab-automations" class="tab-content">
              <div class="card">
                <div class="card-title">⚡ IF → THEN Automations</div>
                <p style="color:var(--muted);font-size:.88rem;margin-bottom:12px">Enable the <strong>Automation</strong> module in Modules. Rules: if the message contains the <strong>keyword</strong> (case-insensitive), the bot replies or deletes the message. Cooldown per rule. For the "Delete" action the bot must have <strong>Manage Messages</strong>.</p>
                <form method="POST" action="/api/guild/${guildId}/automations" style="margin-bottom:20px">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Nome regola</label>
                      <input type="text" name="name" required placeholder="es. Saluto" maxlength="80">
                    </div>
                    <div class="form-group">
                      <label>Parola chiave (contiene)</label>
                      <input type="text" name="keyword" required placeholder="es. ciao" maxlength="200">
                    </div>
                    <div class="form-group">
                      <label>Azione</label>
                      <select name="action">
                        <option value="reply">Rispondi nel canale</option>
                        <option value="delete">Elimina messaggio</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Cooldown (secondi)</label>
                      <input type="number" name="cooldownSeconds" value="30" min="5" max="3600">
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Response text (if action = Reply)</label>
                    <textarea name="replyText" rows="2" placeholder="Bot message"></textarea>
                  </div>
                  <button type="submit" class="btn btn-primary">Aggiungi regola</button>
                </form>
                ${automationRules.length === 0
                  ? '<p class="placeholder-panel">No rules yet. Add one above.</p>'
                  : `<table class="table"><thead><tr><th>Name</th><th>Keyword</th><th>Action</th><th>Cooldown</th><th>Status</th><th></th></tr></thead><tbody>
                    ${automationRules.map((r: any) => `<tr>
                      <td>${escapeHtml(r.name)}</td>
                      <td><code>${escapeHtml(r.keyword)}</code></td>
                      <td>${escapeHtml(r.action)}</td>
                      <td>${r.cooldownSeconds}s</td>
                      <td>${r.enabled ? '<span class="badge badge-success">on</span>' : '<span class="badge badge-warn">off</span>'}</td>
                      <td>
                        <form method="POST" action="/api/guild/${guildId}/automations/${String(r._id)}/toggle" style="display:inline"><button type="submit" class="btn btn-ghost btn-sm">${r.enabled ? 'Off' : 'On'}</button></form>
                        <form method="POST" action="/api/guild/${guildId}/automations/${String(r._id)}/delete" style="display:inline" onsubmit="return confirm('Eliminare questa regola?')"><button type="submit" class="btn btn-danger btn-sm">Elimina</button></form>
                      </td>
                    </tr>`).join('')}
                    </tbody></table>`}
              </div>
            </div>

            <div id="tab-roadmap" class="tab-content">
              <div class="card">
                <div class="card-title">🚀 Roadmap (upcoming features)</div>
                <ul style="margin-left:18px;color:var(--muted);font-size:.9rem;line-height:1.7">
                  <li>Visual IF/THEN automations, economy/levels plugins, premium tier</li>
                  <li>Advanced analytics (hourly graphs, retention, response times)</li>
                  <li>Audit avanzato con ricerca full-text, webhooks verso Zapier, plugin marketplace</li>
                  <li>Multi-server overview e notifiche live (WebSocket)</li>
                </ul>
              </div>
            </div>

            <!-- STATS TAB -->
            <div id="tab-stats" class="tab-content">
              <div class="card">
                <div class="card-title">📊 Statistics (Last 7 Days)</div>
                <div class="grid-3">
                  <div class="stat-card"><div class="stat-value">${totalMessages}</div><div class="stat-label">Messages</div></div>
                  <div class="stat-card"><div class="stat-value">${totalJoins}</div><div class="stat-label">New Members</div></div>
                  <div class="stat-card"><div class="stat-value">${openTickets + closedTickets}</div><div class="stat-label">Total Tickets</div></div>
                </div>
                <div style="margin-top:16px">
                  <table class="table">
                    <thead><tr><th>Date</th><th>Messages</th><th>Joins</th><th>Tickets Opened</th></tr></thead>
                    <tbody>
                      ${stats.map((s) => `<tr><td>${s.date}</td><td>${s.messages ?? 0}</td><td>${s.joins ?? 0}</td><td>${s.ticketsOpened ?? 0}</td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--text-muted);text-align:center">No data yet</td></tr>'}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <script>
        (function(){
          const GUILD_ID = '${guildId}';
          function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
          function removeTag(key, id, el) {
            el.remove();
            const input = document.getElementById(key + 'Input');
            input.value = input.value.split(',').filter(x => x && x !== id).join(',');
          }
          function addTag(key, select) {
            const id = select.value;
            const text = select.options[select.selectedIndex]?.text;
            if (!id) return;
            select.value = '';
            const input = document.getElementById(key + 'Input');
            const existing = input.value ? input.value.split(',') : [];
            if (existing.includes(id)) return;
            existing.push(id);
            input.value = existing.join(',');
            const container = document.getElementById(key + 'Tags');
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = text + ' <span class="tag-remove" onclick="removeTag(\\''+key+'\\',\\''+id+'\\',this.parentElement)">×</span>';
            container.appendChild(tag);
          }
          function removeTicketStaff(id, el) {
            el.remove();
            const input = document.getElementById('ticketStaffInput');
            input.value = input.value.split(',').filter(x => x && x !== id).join(',');
          }
          function addTicketStaff(select) {
            const id = select.value;
            const text = select.options[select.selectedIndex]?.text;
            if (!id) return;
            select.value = '';
            const input = document.getElementById('ticketStaffInput');
            const existing = input.value ? input.value.split(',') : [];
            if (existing.includes(id)) return;
            existing.push(id);
            input.value = existing.join(',');
            const container = document.getElementById('ticketStaffTags');
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.innerHTML = text + ' <span class="tag-remove" onclick="removeTicketStaff(\\''+id+'\\',this.parentElement)">×</span>';
            container.appendChild(tag);
          }
          window.removeTag = removeTag; window.addTag = addTag;
          window.removeTicketStaff = removeTicketStaff; window.addTicketStaff = addTicketStaff;

          window.phoenixSyncPreview = function() {
            const t = document.getElementById('fldEmbedTitle');
            const d = document.getElementById('fldEmbedDesc');
            const c = document.getElementById('embedColorText');
            const pv = document.getElementById('embedLivePreview');
            const pt = document.getElementById('pvTitle');
            const pd = document.getElementById('pvDesc');
            if (pt && t) pt.textContent = t.value || '';
            if (pd && d) pd.textContent = d.value || '';
            if (pv && c) pv.style.borderLeftColor = c.value || '#5865F2';
          };
          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('fldEmbedTitle')?.addEventListener('input', window.phoenixSyncPreview);
            document.getElementById('fldEmbedDesc')?.addEventListener('input', window.phoenixSyncPreview);
            var TB_INIT = ${JSON.stringify(
              (ticketConfig.buttons || []).map((b: { label?: string; emoji?: string; type?: string; style?: number }) => ({
                label: String(b.label ?? ''),
                emoji: String(b.emoji ?? ''),
                type: String(b.type ?? 'support'),
                style: Number(b.style) || 1,
              }))
            )};
            function tbSync() {
              var field = document.getElementById('ticketButtonsJsonField');
              var box = document.getElementById('ticketBtnBuilder');
              if (!field || !box) return;
              var rows = box.querySelectorAll('.ticket-btn-row');
              var arr = [];
              rows.forEach(function(row) {
                var label = row.querySelector('[data-f="label"]');
                var emoji = row.querySelector('[data-f="emoji"]');
                var typeEl = row.querySelector('[data-f="type"]');
                var styleEl = row.querySelector('[data-f="style"]');
                var lab = (label && label.value) ? label.value.trim() : '';
                if (!lab) return;
                var typ = (typeEl && typeEl.value) ? typeEl.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'support';
                if (!typ) typ = 'support';
                var st = styleEl ? parseInt(styleEl.value, 10) : 1;
                if (!st || st < 1 || st > 4) st = 1;
                arr.push({ label: lab, emoji: (emoji && emoji.value) ? emoji.value.trim() : '', type: typ, style: st });
              });
              field.value = JSON.stringify(arr);
            }
            function tbRowHtml(b) {
              b = b || { label: '', emoji: '', type: 'support', style: 1 };
              var st = parseInt(String(b.style), 10) || 1;
              if (st < 1 || st > 4) st = 1;
              function sel(n) { return st === n ? ' selected' : ''; }
              return '<div class="ticket-btn-row">' +
                '<div class="form-group" style="margin-bottom:8px"><label>Etichetta</label><input data-f="label" type="text" value="'+esc(b.label)+'" maxlength="80"></div>' +
                '<div class="form-group" style="margin-bottom:8px"><label>Emoji (opz.)</label><input data-f="emoji" type="text" value="'+esc(b.emoji)+'" placeholder="🎫"></div>' +
                '<div class="form-group" style="margin-bottom:8px"><label>ID tipo (slug)</label><input data-f="type" type="text" value="'+esc(b.type)+'" placeholder="support"></div>' +
                '<div class="form-group" style="margin-bottom:8px"><label>Stile</label><select data-f="style">' +
                '<option value="1"'+sel(1)+'>Primario</option><option value="2"'+sel(2)+'>Secondario</option><option value="3"'+sel(3)+'>Success</option><option value="4"'+sel(4)+'>Danger</option>' +
                '</select></div>' +
                '<button type="button" class="btn btn-danger btn-sm tb-remove" style="margin-top:4px">Rimuovi</button></div>';
            }
            function tbWire(row) {
              row.querySelectorAll('input,select').forEach(function(i){ i.addEventListener('input', tbSync); i.addEventListener('change', tbSync); });
              row.querySelector('.tb-remove').addEventListener('click', function(){ row.remove(); tbSync(); });
            }
            function tbRender() {
              var box = document.getElementById('ticketBtnBuilder');
              if (!box) return;
              box.innerHTML = '';
              (TB_INIT || []).forEach(function(b) {
                var wrap = document.createElement('div');
                wrap.innerHTML = tbRowHtml(b);
                var row = wrap.firstElementChild;
                if (row) { box.appendChild(row); tbWire(row); }
              });
              tbSync();
            }
            document.getElementById('ticketBtnAdd')?.addEventListener('click', function() {
              var box = document.getElementById('ticketBtnBuilder');
              if (!box || box.querySelectorAll('.ticket-btn-row').length >= 25) return;
              var wrap = document.createElement('div');
              wrap.innerHTML = tbRowHtml({ label: 'Button', emoji: '', type: 'custom', style: 1 });
              var row = wrap.firstElementChild;
              if (row) { box.appendChild(row); tbWire(row); tbSync(); }
            });
            document.getElementById('ticketConfigForm')?.addEventListener('submit', function(){ tbSync(); });
            tbRender();
          });

          let selectedId = null;
          async function refreshList() {
            const list = document.getElementById('ticketInboxList');
            if (!list) return;
            try {
              const res = await fetch('/api/guild/'+GUILD_ID+'/tickets?limit=80');
              const data = await res.json();
              if (!data.tickets?.length) { list.innerHTML = '<div style="padding:12px;color:var(--muted)">No tickets.</div>'; return; }
              list.innerHTML = data.tickets.map(function(t) {
                const active = selectedId === String(t.id) ? ' active' : '';
                const badge = t.status === 'open' ? 'badge-success' : (t.status === 'closed' ? 'badge-danger' : 'badge-warn');
                return '<div class="inbox-item'+active+'" data-id="'+t.id+'"><span><strong>#'+t.number+'</strong> · '+esc(t.type)+'</span><span class="badge '+badge+'">'+esc(t.status)+'</span></div>';
              }).join('');
              list.querySelectorAll('.inbox-item').forEach(function(el) {
                el.addEventListener('click', function() { loadDetail(el.getAttribute('data-id')); });
              });
            } catch {
              list.innerHTML = '<div style="padding:12px;color:var(--muted)">Errore caricamento lista.</div>';
            }
          }
          async function loadDetail(id) {
            selectedId = id;
            const detail = document.getElementById('ticketInboxDetail');
            if (!detail || !id) return;
            detail.innerHTML = '<div style="color:var(--muted)">Caricamento…</div>';
            try {
              const res = await fetch('/api/guild/'+GUILD_ID+'/tickets/'+id);
              const t = await res.json();
              if (!res.ok) { detail.innerHTML = '<div class="alert alert-danger">'+esc(t.error||'Errore')+'</div>'; refreshList(); return; }
              const msgs = (t.ticket.messages||[]).slice(-50).map(function(m) {
                return '<div class="msg-line"><div class="msg-meta">'+esc(m.authorTag)+' · '+new Date(m.timestamp).toLocaleString()+'</div><div>'+esc(m.content)+'</div></div>';
              }).join('') || '<div style="color:var(--muted)">No messages saved in DB for this thread.</div>';
              const actions = [];
              if (t.ticket.status === 'open') {
                actions.push('<form method="POST" action="/api/guild/'+GUILD_ID+'/tickets/'+id+'/claim" style="display:inline"><button class="btn btn-secondary btn-sm" type="submit">Claim</button></form>');
                actions.push('<form method="POST" action="/api/guild/'+GUILD_ID+'/tickets/'+id+'/close" style="display:inline" onsubmit="return confirm(\\'Chiudere questo ticket?\\')"><button class="btn btn-danger btn-sm" type="submit">Chiudi</button></form>');
              }
              actions.push('<button type="button" class="btn btn-ghost btn-sm" id="aiInsightBtn">AI · summary &amp; classifica</button>');
              const reply = t.ticket.status === 'open'
                ? '<form method="POST" action="/api/guild/'+GUILD_ID+'/tickets/'+id+'/message" style="margin-top:12px">'+
                  '<div class="form-group"><label>Message in thread</label><textarea name="content" rows="3" required placeholder="Visible in Discord ticket"></textarea></div>'+
                  '<button class="btn btn-primary btn-sm" type="submit">Send</button></form>' : '';
              detail.innerHTML = '<div><strong>#'+t.ticket.number+'</strong> · '+esc(t.ticket.type)+' · User <code>'+esc(t.ticket.userId)+'</code>'+
                (t.ticket.claimedBy ? ' · Claim: <code>'+esc(t.ticket.claimedBy)+'</code>' : '')+'</div>'+
                '<div style="margin:10px 0;display:flex;gap:8px;flex-wrap:wrap">'+actions.join('')+'</div>'+
                '<div class="msg-log">'+msgs+'</div>'+reply+
                '<div id="aiInsightOut" class="card" style="margin-top:12px;display:none;padding:12px"></div>';
              document.getElementById('aiInsightBtn')?.addEventListener('click', async function() {
                const out = document.getElementById('aiInsightOut');
                if (!out) return;
                out.style.display = 'block';
                out.innerHTML = '<div style="color:var(--muted)">Analisi in corso…</div>';
                try {
                  const ir = await fetch('/api/guild/'+GUILD_ID+'/tickets/'+id+'/insights');
                  const j = await ir.json();
                  if (!ir.ok) { out.innerHTML = '<div class="alert alert-danger">'+esc(j.error||'AI error')+'</div>'; return; }
                  out.innerHTML = '<div class="card-title" style="margin-bottom:8px;font-size:.9rem">Esito AI</div>'+
                    '<div style="font-size:.85rem"><strong>Classifica:</strong> '+esc(j.classification)+'</div>'+
                    '<div style="font-size:.85rem;margin-top:6px"><strong>Riassunto:</strong> '+esc(j.summary)+'</div>'+
                    '<div style="font-size:.85rem;margin-top:6px"><strong>Suggerimento staff:</strong> '+esc(j.staffHint)+'</div>';
                } catch {
                  out.innerHTML = '<div class="alert alert-danger">Impossibile contattare il servizio AI.</div>';
                }
              });
            } catch {
              detail.innerHTML = '<div class="alert alert-danger">Errore caricamento ticket.</div>';
            }
            refreshList();
          }
          document.addEventListener('DOMContentLoaded', function() {
            refreshList();
            window.addEventListener('phoenik:tab', function(e) {
              if (e.detail === 'tab-tickets') refreshList();
            });
          });
        })();
      </script>
    `, req.user as any));
  });

  app.post('/api/guild/:id/modules', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const moduleKeys = ['ticket','giveaway','verification','antirAid','antinuke','antilink','logging','youtube','twitch','roblox','ai','suggestions','reactionRoles','stats','schedule','backup','minigames','moderation','automation'];
    const updates: Record<string, boolean> = {};
    for (const key of moduleKeys) {
      updates[`modules.${key}`] = key in req.body;
    }
    await GuildModel.findOneAndUpdate({ guildId }, updates, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-modules' }));
  });

  app.post('/api/guild/:id/automations', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body as Record<string, string>;
    const name = String(b.name || '').trim().slice(0, 80);
    const keyword = String(b.keyword || '').trim().toLowerCase().slice(0, 200);
    const action = b.action === 'delete' ? 'delete' : 'reply';
    const replyText = String(b.replyText || '').slice(0, 2000);
    const cooldownSeconds = Math.min(3600, Math.max(5, parseInt(String(b.cooldownSeconds), 10) || 30));
    if (!name || !keyword) {
      res.redirect(guildRedirect(guildId, { error: 'Nome+e+keyword+richiesti', tab: 'tab-automations' }));
      return;
    }
    await AutomationRuleModel.create({
      guildId,
      name,
      keyword,
      enabled: true,
      action,
      replyText,
      cooldownSeconds,
    });
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-automations' }));
  });

  app.post('/api/guild/:id/automations/:ruleId/delete', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    await AutomationRuleModel.deleteOne({ _id: req.params.ruleId, guildId });
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-automations' }));
  });

  app.post('/api/guild/:id/automations/:ruleId/toggle', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const rule = await AutomationRuleModel.findOne({ _id: req.params.ruleId, guildId });
    if (rule) {
      rule.enabled = !rule.enabled;
      await rule.save();
    }
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-automations' }));
  });

  // Banned Words API
  app.get('/api/guild/:id/bannedwords', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const words = await BannedWordModel.find({ guildId }).sort({ createdAt: -1 });
    res.json({ words });
  });

  app.post('/api/guild/:id/bannedwords/add', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const { word, severity, language, action } = req.body as Record<string, string>;
    
    if (!word || !word.trim()) {
      res.redirect(guildRedirect(guildId, { error: 'Word is required', tab: 'tab-ai' }));
      return;
    }

    const cleanWord = word.trim().toLowerCase();
    const existing = await BannedWordModel.findOne({ guildId, word: cleanWord });
    if (existing) {
      res.redirect(guildRedirect(guildId, { error: 'Word already exists', tab: 'tab-ai' }));
      return;
    }

    await BannedWordModel.create({
      guildId,
      word: cleanWord,
      severity: severity || 'medium',
      language: language || 'all',
      action: action || 'warn',
      enabled: true,
    });

    AIModeration.clearCache(guildId);
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-ai' }));
  });

  app.get('/api/guild/:id/bannedwords/delete/:wordId', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    
    await BannedWordModel.findByIdAndDelete(req.params.wordId);
    AIModeration.clearCache(guildId);
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-ai' }));
  });

  app.post('/api/guild/:id/general', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    const pick = (key: string) => Object.prototype.hasOwnProperty.call(b, key);

    if (pick('logChannel')) update.logChannel = String(b['logChannel'] ?? '') || null;
    if (pick('modLogChannel')) update.modLogChannel = String(b['modLogChannel'] ?? '') || null;
    if (pick('suggestionsChannel')) update.suggestionsChannel = String(b['suggestionsChannel'] ?? '') || null;

    if (pick('warnMuteThreshold')) {
      update['autoModThresholds.warnMuteThreshold'] = Math.min(Math.max(parseInt(String(b['warnMuteThreshold']), 10) || 3, 1), 20);
    }
    if (pick('warnBanThreshold')) {
      update['autoModThresholds.warnBanThreshold'] = Math.min(Math.max(parseInt(String(b['warnBanThreshold']), 10) || 5, 1), 20);
    }
    if (pick('raidJoins')) {
      update['autoModThresholds.raidJoins'] = Math.min(Math.max(parseInt(String(b['raidJoins']), 10) || 10, 2), 50);
    }
    if (pick('raidSeconds')) {
      update['autoModThresholds.raidSeconds'] = Math.min(Math.max(parseInt(String(b['raidSeconds']), 10) || 5, 1), 60);
    }
    if (pick('nukeChannelDeletes')) {
      update['autoModThresholds.nukeChannelDeletes'] = Math.min(Math.max(parseInt(String(b['nukeChannelDeletes']), 10) || 3, 1), 20);
    }
    if (pick('nukeBans')) {
      update['autoModThresholds.nukeBans'] = Math.min(Math.max(parseInt(String(b['nukeBans']), 10) || 5, 1), 30);
    }
    if (pick('nukeRoleDeletes')) {
      update['autoModThresholds.nukeRoleDeletes'] = Math.min(Math.max(parseInt(String(b['nukeRoleDeletes']), 10) || 3, 1), 30);
    }
    if (pick('nukeWindowSeconds')) {
      update['autoModThresholds.nukeWindowSeconds'] = Math.min(Math.max(parseInt(String(b['nukeWindowSeconds']), 10) || 30, 5), 300);
    }
    if (pick('muteDurationMinutes')) {
      const muteMinutes = Math.min(Math.max(parseInt(String(b['muteDurationMinutes']), 10) || 60, 1), 10080);
      update['autoModThresholds.muteDuration'] = muteMinutes * 60 * 1000;
    }
    if (pick('raidMinAccountAgeHours')) {
      update['autoModThresholds.raidMinAccountAgeHours'] = Math.min(
        8760,
        Math.max(0, parseInt(String(b['raidMinAccountAgeHours']), 10) || 0)
      );
    }

    await GuildModel.findOneAndUpdate({ guildId }, update, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1' }));
  });

  app.post('/api/guild/:id/roles', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const staffRoles = (req.body.staffRoles || '').split(',').filter(Boolean);
    const adminRoles = (req.body.adminRoles || '').split(',').filter(Boolean);
    await GuildModel.findOneAndUpdate({ guildId }, { staffRoles, adminRoles }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/antilink', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    const whitelist = (b.whitelist || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const blacklist = (b.blacklist || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    await GuildModel.findOneAndUpdate({ guildId }, {
      'antilink.enabled': 'enabled' in b,
      'antilink.action': b.action || 'delete_warn',
      'antilink.whitelist': whitelist,
      'antilink.blacklist': blacklist,
    }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/ticket/config', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    const normalizeColor = (c: string) => {
      if (!c) return '#5865F2';
      return c.startsWith('#') ? c : `#${c}`;
    };
    const embedColor = normalizeColor(b.embedColorText || b.embedColor);
    const omEmbedColor = normalizeColor(b.openMessageEmbedColorText || b.openMessageEmbedColor);
    const ticketStaffRoles = String(b.staffRoles ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const buttonsParsed = parseTicketButtonsJson(
      typeof b.ticketButtonsJson === 'string' ? b.ticketButtonsJson : undefined
    );
    await TicketConfigModel.findOneAndUpdate({ guildId }, {
      embedTitle: b.embedTitle || '🎫 Support Tickets',
      embedDescription: b.embedDescription || 'Click a button to open a ticket.',
      embedColor,
      embedImage: safeEmbedMediaUrl(String(b.embedImage ?? '')) ?? null,
      embedThumbnail: safeEmbedMediaUrl(String(b.embedThumbnail ?? '')) ?? null,
      embedFooter: b.embedFooter || null,
      threadNameTemplate: b.threadNameTemplate || '{type}-{username}',
      openMessageTemplate: b.openMessageTemplate || 'Hello {user}! Staff will be with you shortly.',
      autoCloseHours: parseInt(String(b.autoCloseHours), 10) || 48,
      openMessageIsEmbed: 'openMessageIsEmbed' in b,
      openMessageEmbedTitle: b.openMessageEmbedTitle || '🎫 Ticket #{ticket_number}',
      openMessageEmbedColor: omEmbedColor,
      openMessageEmbedImage: safeEmbedMediaUrl(String(b.openMessageEmbedImage ?? '')) ?? null,
      openMessageEmbedThumbnail: safeEmbedMediaUrl(String(b.openMessageEmbedThumbnail ?? '')) ?? null,
      openMessageEmbedFooter: b.openMessageEmbedFooter || null,
      openMessageEmbedAuthor: b.openMessageEmbedAuthor || null,
      staffRoles: ticketStaffRoles,
      logChannelId: b.logChannel || null,
      buttons: buttonsParsed,
    }, { upsert: true });
    // Save ticket category to Guild model
    await GuildModel.findOneAndUpdate({ guildId }, {
      ticketCategory: b.ticketCategory || null,
    }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-tickets' }));
  });

  app.post('/api/guild/:id/ticket/panel', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const channelId = req.body.channelId;
    if (!channelId) { res.redirect(guildRedirect(guildId, { error: 'No+channel+selected', tab: 'tab-tickets' })); return; }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect(guildRedirect(guildId, { error: 'Guild+not+found', tab: 'tab-tickets' })); return; }

    const channel = guild.channels.cache.get(channelId) as any;
    if (!channel?.isTextBased()) { res.redirect(guildRedirect(guildId, { error: 'Invalid+channel', tab: 'tab-tickets' })); return; }

    const ticketConfig = await getTicketConfig(guildId);
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
      .setColor(ticketConfig.embedColor as `#${string}`)
      .setTitle(ticketConfig.embedTitle)
      .setDescription(ticketConfig.embedDescription)
      .setTimestamp();

    const panelImg = safeEmbedMediaUrl(ticketConfig.embedImage);
    if (panelImg) embed.setImage(panelImg);
    const panelThumb = safeEmbedMediaUrl(ticketConfig.embedThumbnail);
    if (panelThumb) embed.setThumbnail(panelThumb);
    if (ticketConfig.embedFooter) embed.setFooter({ text: ticketConfig.embedFooter });

    const buttons = buildTicketOpenButtons(normalizeTicketButtons(ticketConfig.buttons as unknown));

    const rows: any[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder<InstanceType<typeof ButtonBuilder>>().addComponents(buttons.slice(i, i + 5)));
    }

    try {
      const msg = await channel.send({ embeds: [embed], components: rows });
      await TicketConfigModel.findOneAndUpdate({ guildId }, {
        panelChannelId: channelId,
        panelMessageId: msg.id,
      });
      res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-tickets' }));
    } catch (err) {
      logger.error('Failed to send ticket panel:', err instanceof Error ? err : new Error(String(err)));
      res.redirect(guildRedirect(guildId, { error: 'Failed+to+send+panel', tab: 'tab-tickets' }));
    }
  });

  app.get('/api/guild/:id/tickets', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const lim = Math.min(Math.max(parseInt(String(req.query.limit ?? '40'), 10) || 40, 1), 200);
    const page = parseInt(String(req.query.page ?? '1'), 10) || 1;
    const tickets = await TicketModel.find({ guildId })
      .sort({ createdAt: -1 })
      .skip(Math.max(0, page - 1) * lim)
      .limit(lim);
    res.json({
      tickets: tickets.map((t) => ({
        id: String(t._id),
        number: t.ticketNumber,
        type: t.type,
        status: t.status,
        userId: t.userId,
        claimedBy: t.claimedBy,
        createdAt: t.createdAt,
        closedAt: t.closedAt,
      })),
    });
  });

  app.get('/api/guild/:id/tickets/:ticketId', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const ticket = await TicketModel.findOne({ _id: req.params.ticketId, guildId });
    if (!ticket) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({
      ticket: {
        id: String(ticket._id),
        number: ticket.ticketNumber,
        type: ticket.type,
        status: ticket.status,
        userId: ticket.userId,
        claimedBy: ticket.claimedBy,
        threadId: ticket.threadId,
        messages: ticket.messages,
        createdAt: ticket.createdAt,
        closedAt: ticket.closedAt,
      },
    });
  });

  app.get('/api/guild/:id/tickets/:ticketId/insights', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const ticket = await TicketModel.findOne({ _id: req.params.ticketId, guildId });
    if (!ticket) { res.status(404).json({ error: 'Not found' }); return; }
    const { TicketInsights } = await import('../modules/ai/TicketInsights');
    const lines = ticket.messages.map((m) => ({ authorTag: m.authorTag, content: m.content }));
    const insight = await TicketInsights.analyzeTranscript(lines);
    res.json(insight);
  });

  app.post('/api/guild/:id/tickets/:ticketId/claim', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const user = req.user as { id: string };
    if (!isGuildAdmin(req, guildId)) { res.status(403).send('Forbidden'); return; }
    await TicketModel.findOneAndUpdate(
      { _id: req.params.ticketId, guildId, status: 'open' },
      { claimedBy: user.id }
    );
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-tickets' }));
  });

  app.post('/api/guild/:id/tickets/:ticketId/close', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const user = req.user as { id: string };
    if (!isGuildAdmin(req, guildId)) { res.status(403).send('Forbidden'); return; }
    const guild = client.guilds.cache.get(guildId);
    const ticket = await TicketModel.findOne({ _id: req.params.ticketId, guildId });
    if (!guild || !ticket?.threadId) {
      res.redirect(guildRedirect(guildId, { error: 'ticket', tab: 'tab-tickets' }));
      return;
    }
    const ch = await guild.channels.fetch(ticket.threadId).catch(() => null);
    if (!ch?.isThread()) {
      res.redirect(guildRedirect(guildId, { error: 'thread', tab: 'tab-tickets' }));
      return;
    }
    await TicketManager.closeTicket(ch, user.id, guild);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-tickets' }));
  });

  app.post('/api/guild/:id/tickets/:ticketId/message', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const user = req.user as { id: string; username?: string };
    if (!isGuildAdmin(req, guildId)) { res.status(403).send('Forbidden'); return; }
    const content = String(req.body.content ?? '').trim();
    if (!content) {
      res.redirect(guildRedirect(guildId, { error: 'empty_message', tab: 'tab-tickets' }));
      return;
    }
    const guild = client.guilds.cache.get(guildId);
    const ticket = await TicketModel.findOne({ _id: req.params.ticketId, guildId, status: 'open' });
    if (!guild || !ticket?.threadId) {
      res.redirect(guildRedirect(guildId, { error: 'ticket', tab: 'tab-tickets' }));
      return;
    }
    const ch = await guild.channels.fetch(ticket.threadId).catch(() => null);
    if (!ch?.isTextBased()) {
      res.redirect(guildRedirect(guildId, { error: 'channel', tab: 'tab-tickets' }));
      return;
    }
    const tag = user.username ?? user.id;
    await ch.send({ content: `**[Staff · ${tag}]** ${content}` }).catch(() => null);
    await TicketManager.trackMessage(ticket.threadId!, user.id, tag, content, []);
    res.redirect(guildRedirect(guildId, { saved: '1', tab: 'tab-tickets' }));
  });

  app.post('/api/guild/:id/module', requireAuth, async (req, res) => {
    const { module, enabled } = req.body;
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    await GuildModel.findOneAndUpdate({ guildId }, { [`modules.${module}`]: enabled === 'true' }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}`);
  });

  app.post('/api/guild/:id/verify', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    await GuildModel.findOneAndUpdate({ guildId }, {
      verifyMode: b.verifyMode || null,
      verifyRole: b.verifyRole || null,
      unverifiedRole: b.unverifiedRole || null,
    }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  // Welcome & Auto-role settings
  app.post('/api/guild/:id/welcome', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    
    // Get autoRoleIds - can be array or single value
    let autoRoleIds: string[] = [];
    if (b.autoRoleIds) {
      autoRoleIds = Array.isArray(b.autoRoleIds) ? b.autoRoleIds : [b.autoRoleIds];
      autoRoleIds = autoRoleIds.filter(Boolean);
    }

    const welcomeConfig = {
      // Handle array values - take first if array
      welcomeChannelId: Array.isArray(b.welcomeChannelId) ? b.welcomeChannelId[0] : (b.welcomeChannelId || null),
      welcomeMessageEnabled: b.welcomeMessageEnabled === 'on',
      welcomeEmbedTitle: b.welcomeEmbedTitle || '🎉 Welcome!',
      welcomeEmbedDescription: b.welcomeEmbedDescription || 'Welcome {user} to {server}!',
      welcomeEmbedColor: b.welcomeEmbedColor || '#5865F2',
      welcomeEmbedImage: b.welcomeEmbedImage || null,
      welcomeEmbedThumbnail: b.welcomeEmbedThumbnail || null,
      welcomeEmbedFooter: b.welcomeEmbedFooter || null,
      leaveMessageEnabled: b.leaveMessageEnabled === 'on',
      leaveChannelId: Array.isArray(b.leaveChannelId) ? b.leaveChannelId[0] : (b.leaveChannelId || null),
      leaveEmbedTitle: b.leaveEmbedTitle || '👋 Member Left',
      leaveEmbedDescription: b.leaveEmbedDescription || '{user} left the server.',
      autoRoleIds,
      autoRoleDelay: parseInt(b.autoRoleDelay) || 0,
    };

    await WelcomeConfigModel.findOneAndUpdate({ guildId }, welcomeConfig, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/autoresponse/add', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    const count = await AutoResponseModel.countDocuments({ guildId });
    if (count >= 50) { res.redirect(`/guild/${guildId}?error=Max+50+auto-responses`); return; }
    const triggers = (b.triggers || '').split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
    if (!triggers.length || !b.response) { res.redirect(`/guild/${guildId}?error=Missing+fields`); return; }
    await AutoResponseModel.create({
      guildId,
      triggers,
      response: b.response,
      includeTicketButton: 'includeTicketButton' in b,
      cooldownSeconds: parseInt(b.cooldownSeconds) || 30,
    });
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/autoresponse/:arId/delete', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    await AutoResponseModel.findOneAndDelete({ _id: req.params.arId, guildId });
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/youtube/add', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    if (!b.youtubeChannelId || !b.discordChannelId || !b.youtubeChannelName) {
      res.redirect(`/guild/${guildId}?error=Missing+fields`); return;
    }
    try {
      await YouTubeConfigModel.create({
        guildId,
        channelId: b.discordChannelId,
        youtubeChannelId: b.youtubeChannelId.trim(),
        youtubeChannelName: b.youtubeChannelName.trim(),
        discordChannelId: b.discordChannelId,
        pingRoleId: b.pingRoleId || null,
        customMessage: b.customMessage || null,
        filterShorts: 'filterShorts' in b,
        filterLives: 'filterLives' in b,
      });
      res.redirect(`/guild/${guildId}?saved=1`);
    } catch {
      res.redirect(`/guild/${guildId}?error=Already+configured+for+this+YouTube+channel`);
    }
  });

  app.post('/api/guild/:id/youtube/:ytId/delete', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    await YouTubeConfigModel.findOneAndDelete({ _id: req.params.ytId, guildId });
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
    const key = config.dashboardApiKey;
    if (!key) {
      res.status(503).json({ error: 'DASHBOARD_API_KEY not configured' });
      return;
    }
    const auth = req.headers.authorization;
    const bearer = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const xk = req.headers['x-api-key'];
    const xkStr = Array.isArray(xk) ? xk[0] : xk;
    if (bearer === key || (xkStr && xkStr === key)) {
      next();
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }

  app.get('/api/v1/guild/:id/audit', requireApiKey, async (req, res) => {
    const guildId = req.params.id;
    if (!client.guilds.cache.has(guildId)) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }
    const lim = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
    const entries = await AuditLogModel.find({ guildId }).sort({ createdAt: -1 }).limit(lim);
    res.json({
      entries: entries.map((e) => ({
        id: String(e._id),
        action: e.action,
        actorId: e.actorId,
        targetId: e.targetId,
        detail: e.detail,
        createdAt: e.createdAt,
      })),
    });
  });

  return app;
}
