import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { config } from '../config';
import { BotClient } from '../bot/client';
import { GuildModel, getGuild } from '../database/models/Guild';
import { TicketModel } from '../database/models/Ticket';
import { TicketConfigModel, getTicketConfig } from '../database/models/TicketConfig';
import { StatsModel } from '../database/models/Stats';
import { invalidateGuildCache } from '../modules/cache/CacheManager';
import { logger } from '../utils/logger';

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0e1117; --surface: #161b22; --surface2: #21262d;
    --border: #30363d; --primary: #5865F2; --primary-dark: #4752c4;
    --success: #57F287; --danger: #ED4245; --warning: #FEE75C;
    --text: #e6edf3; --text-muted: #8b949e;
    --radius: 8px; --shadow: 0 4px 16px rgba(0,0,0,.4);
  }
  body { font-family: 'Segoe UI',system-ui,sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .nav { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 56px; }
  .nav-brand { font-size: 1.2rem; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
  .nav-brand span { color: var(--primary); }
  .nav-links { display: flex; gap: 12px; align-items: center; }
  .nav-links a { color: var(--text-muted); font-size: .9rem; padding: 6px 10px; border-radius: 6px; transition: all .2s; }
  .nav-links a:hover { background: var(--surface2); color: var(--text); text-decoration: none; }
  .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
  .page-title { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
  .page-subtitle { color: var(--text-muted); margin-bottom: 32px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
  .card-title { font-size: 1rem; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
  .guild-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; text-align: center; transition: all .2s; }
  .guild-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow); }
  .guild-icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 12px; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; overflow: hidden; }
  .guild-icon img { width: 100%; height: 100%; object-fit: cover; }
  .guild-name { font-weight: 600; margin-bottom: 12px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: 6px; font-size: .9rem; font-weight: 500; border: none; cursor: pointer; transition: all .15s; text-decoration: none; }
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover { background: var(--primary-dark); text-decoration: none; color: white; }
  .btn-success { background: var(--success); color: #000; }
  .btn-danger { background: var(--danger); color: white; }
  .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--border); text-decoration: none; color: var(--text); }
  .btn-sm { padding: 4px 12px; font-size: .8rem; }
  .form-group { margin-bottom: 16px; }
  label { display: block; font-size: .85rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 500; }
  input[type=text], input[type=number], input[type=color], select, textarea {
    width: 100%; padding: 9px 12px; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 6px; color: var(--text); font-size: .9rem; outline: none; transition: border-color .2s;
  }
  input[type=text]:focus, select:focus, textarea:focus { border-color: var(--primary); }
  textarea { resize: vertical; min-height: 80px; font-family: inherit; }
  .toggle-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--border); }
  .toggle-row:last-child { border-bottom: none; }
  .toggle-label { font-size: .9rem; }
  .toggle-desc { font-size: .78rem; color: var(--text-muted); margin-top: 2px; }
  .switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; inset: 0; background: var(--surface2); border: 1px solid var(--border); border-radius: 24px; transition: .3s; }
  .slider:before { position: absolute; content: ''; height: 18px; width: 18px; left: 2px; bottom: 2px; background: var(--text-muted); border-radius: 50%; transition: .3s; }
  input:checked + .slider { background: var(--primary); border-color: var(--primary); }
  input:checked + .slider:before { transform: translateX(20px); background: white; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: .75rem; font-weight: 600; }
  .badge-success { background: rgba(87,242,135,.15); color: var(--success); }
  .badge-danger { background: rgba(237,66,69,.15); color: var(--danger); }
  .badge-warning { background: rgba(254,231,92,.15); color: var(--warning); }
  .sidebar-layout { display: grid; grid-template-columns: 220px 1fr; gap: 24px; }
  .sidebar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px; height: fit-content; }
  .sidebar-section { font-size: .72rem; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); font-weight: 600; padding: 8px 10px 4px; }
  .sidebar-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; color: var(--text-muted); font-size: .9rem; cursor: pointer; transition: all .15s; text-decoration: none; margin-bottom: 2px; }
  .sidebar-item:hover, .sidebar-item.active { background: var(--surface2); color: var(--text); text-decoration: none; }
  .sidebar-item.active { color: var(--primary); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .alert { padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; font-size: .9rem; }
  .alert-success { background: rgba(87,242,135,.1); border: 1px solid rgba(87,242,135,.3); color: var(--success); }
  .alert-danger { background: rgba(237,66,69,.1); border: 1px solid rgba(237,66,69,.3); color: var(--danger); }
  .stat-card { text-align: center; }
  .stat-value { font-size: 2rem; font-weight: 700; color: var(--primary); }
  .stat-label { font-size: .85rem; color: var(--text-muted); margin-top: 4px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th { text-align: left; padding: 10px 12px; font-size: .8rem; text-transform: uppercase; color: var(--text-muted); border-bottom: 1px solid var(--border); }
  .table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: .9rem; }
  .table tr:last-child td { border-bottom: none; }
  .hero { text-align: center; padding: 80px 24px; }
  .hero h1 { font-size: 3rem; font-weight: 800; margin-bottom: 16px; }
  .hero h1 span { color: var(--primary); }
  .hero p { color: var(--text-muted); font-size: 1.1rem; max-width: 500px; margin: 0 auto 32px; }
  .color-preview { width: 36px; height: 36px; border-radius: 6px; border: 1px solid var(--border); display: inline-block; vertical-align: middle; margin-left: 8px; }
  .input-row { display: flex; gap: 8px; align-items: flex-end; }
  .input-row .form-group { flex: 1; margin-bottom: 0; }
  .tag { display: inline-block; background: var(--surface2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; font-size: .8rem; margin: 2px; }
  .tag-remove { cursor: pointer; color: var(--danger); margin-left: 4px; }
  @media (max-width: 768px) { .sidebar-layout { grid-template-columns: 1fr; } .grid-2,.grid-3 { grid-template-columns: 1fr; } }
`;

function layout(title: string, content: string, user?: any) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} - PhoenikBot</title>
  <style>${CSS}</style>
</head>
<body>
  <nav class="nav">
    <div class="nav-brand">🔥 Phoenik<span>Bot</span></div>
    <div class="nav-links">
      ${user ? `<span style="color:var(--text-muted);font-size:.9rem">👤 ${user.username}</span><a href="/auth/logout">Logout</a>` : '<a href="/auth/discord" class="btn btn-primary btn-sm">Login with Discord</a>'}
    </div>
  </nav>
  <div>${content}</div>
  <script>
    function toggleTab(id) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-item[data-tab]').forEach(t => t.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
      document.querySelector('[data-tab="'+id+'"]')?.classList.add('active');
      localStorage.setItem('activeTab_'+location.pathname, id);
    }
    document.addEventListener('DOMContentLoaded', () => {
      const saved = localStorage.getItem('activeTab_'+location.pathname);
      if (saved && document.getElementById(saved)) toggleTab(saved);
      else { const first = document.querySelector('.tab-content'); if (first) first.classList.add('active'); }
    });
    function previewColor(val, previewId) {
      const el = document.getElementById(previewId);
      if (el) el.style.background = val;
    }
  </script>
</body>
</html>`;
}

export function createWebServer(client: BotClient) {
  const app = express();

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
  }, (accessToken, refreshToken, profile, done) => {
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

  function isGuildAdmin(req: express.Request, guildId: string): boolean {
    const user = req.user as any;
    if (!user) return false;
    if (config.ownerIds.includes(user.id)) return true;
    const guild = (user.guilds ?? []).find((g: any) => g.id === guildId);
    return guild && (parseInt(guild.permissions) & 0x20) === 0x20;
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
    res.send(layout('Home', `
      <div class="hero">
        <h1>🔥 Phoenik<span style="color:var(--primary)">Bot</span></h1>
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
    const userGuilds = (user.guilds ?? []).filter((g: any) => (parseInt(g.permissions) & 0x20) === 0x20);
    const botGuilds = client.guilds.cache;
    const manageable = userGuilds.filter((g: any) => botGuilds.has(g.id));
    const invitable = userGuilds.filter((g: any) => !botGuilds.has(g.id));

    res.send(layout('Dashboard', `
      <div class="container">
        <div class="page-title">👋 Welcome, ${user.username}</div>
        <div class="page-subtitle">Select a server to manage</div>
        ${manageable.length === 0 ? `<div class="card"><p style="color:var(--text-muted)">No servers found where you have Administrator permissions and PhoenikBot is added.</p></div>` : ''}
        <div class="grid-3">
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

    const [guildData, ticketConfig, stats] = await Promise.all([
      getGuild(guildId),
      getTicketConfig(guildId),
      StatsModel.find({ guildId }).sort({ date: -1 }).limit(7),
    ]);

    const channels = guild.channels.cache
      .filter((c) => c.type === 0)
      .sort((a, b) => (a as any).position - (b as any).position)
      .map((c) => ({ id: c.id, name: (c as any).name ?? c.id }));

    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

    const totalMessages = stats.reduce((s, d) => s + (d.messages ?? 0), 0);
    const totalJoins = stats.reduce((s, d) => s + (d.joins ?? 0), 0);
    const openTickets = await TicketModel.countDocuments({ guildId, status: 'open' });
    const closedTickets = await TicketModel.countDocuments({ guildId, status: 'closed' });

    const flash = req.query.saved ? `<div class="alert alert-success">✅ Settings saved successfully!</div>` :
                  req.query.error ? `<div class="alert alert-danger">❌ Error: ${req.query.error}</div>` : '';

    const moduleDescriptions: Record<string, string> = {
      ticket: 'Ticket support system', giveaway: 'Giveaway system',
      verification: 'Member verification', antirAid: 'Anti-raid protection',
      antinuke: 'Anti-nuke protection', antilink: 'Anti-link filter',
      logging: 'Message & action logs', youtube: 'YouTube notifications',
      twitch: 'Twitch notifications', roblox: 'Roblox integrations',
      ai: 'AI moderation', suggestions: 'Suggestion system',
      reactionRoles: 'Reaction/button roles', stats: 'Statistics tracking',
      schedule: 'Scheduled messages', backup: 'Server backup',
      minigames: 'Mini games', moderation: 'Moderation commands',
    };

    res.send(layout(`${guild.name} - Dashboard`, `
      <div class="container">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <a href="/dashboard" style="color:var(--text-muted);font-size:.9rem">← Back</a>
        </div>
        <div class="page-title">
          ${guild.iconURL() ? `<img src="${guild.iconURL()}" style="width:36px;height:36px;border-radius:50%;vertical-align:middle;margin-right:8px">` : ''}
          ${guild.name}
        </div>
        <div class="page-subtitle">${guild.memberCount} members</div>

        <div class="grid-3" style="margin-bottom:24px">
          <div class="card stat-card"><div class="stat-value">${totalMessages}</div><div class="stat-label">Messages (7d)</div></div>
          <div class="card stat-card"><div class="stat-value">${openTickets}</div><div class="stat-label">Open Tickets</div></div>
          <div class="card stat-card"><div class="stat-value">${totalJoins}</div><div class="stat-label">Joins (7d)</div></div>
        </div>

        ${flash}

        <div class="sidebar-layout">
          <div class="sidebar">
            <div class="sidebar-section">Settings</div>
            <a class="sidebar-item active" data-tab="tab-modules" onclick="toggleTab('tab-modules')">📦 Modules</a>
            <a class="sidebar-item" data-tab="tab-general" onclick="toggleTab('tab-general')">⚙️ General</a>
            <a class="sidebar-item" data-tab="tab-ticket" onclick="toggleTab('tab-ticket')">🎫 Tickets</a>
            <a class="sidebar-item" data-tab="tab-logging" onclick="toggleTab('tab-logging')">📋 Logging</a>
            <a class="sidebar-item" data-tab="tab-roles" onclick="toggleTab('tab-roles')">👥 Roles</a>
            <a class="sidebar-item" data-tab="tab-automod" onclick="toggleTab('tab-automod')">🛡️ AutoMod</a>
            <div class="sidebar-section">Data</div>
            <a class="sidebar-item" data-tab="tab-tickets-list" onclick="toggleTab('tab-tickets-list')">📝 Ticket List</a>
            <a class="sidebar-item" data-tab="tab-stats" onclick="toggleTab('tab-stats')">📊 Stats</a>
          </div>

          <div style="min-width:0">

            <!-- MODULES TAB -->
            <div id="tab-modules" class="tab-content">
              <div class="card">
                <div class="card-title">📦 Module Management</div>
                <form method="POST" action="/api/guild/${guildId}/modules">
                  ${Object.entries(guildData.modules).map(([name, enabled]) => `
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

            <!-- TICKET TAB -->
            <div id="tab-ticket" class="tab-content">
              <div class="card">
                <div class="card-title">🎫 Ticket Panel Embed</div>
                <form method="POST" action="/api/guild/${guildId}/ticket/config">
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Embed Title</label>
                      <input type="text" name="embedTitle" value="${escapeHtml(ticketConfig.embedTitle)}">
                    </div>
                    <div class="form-group">
                      <label>Embed Color</label>
                      <div style="display:flex;align-items:center;gap:8px">
                        <input type="color" name="embedColor" value="${ticketConfig.embedColor}" style="width:50px;height:38px;padding:2px;cursor:pointer" id="embedColorPicker" onchange="previewColor(this.value,'embedColorPreview')">
                        <input type="text" name="embedColorText" value="${escapeHtml(ticketConfig.embedColor)}" style="flex:1" oninput="document.getElementById('embedColorPicker').value=this.value;previewColor(this.value,'embedColorPreview')">
                        <span id="embedColorPreview" class="color-preview" style="background:${ticketConfig.embedColor}"></span>
                      </div>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Embed Description</label>
                    <textarea name="embedDescription">${escapeHtml(ticketConfig.embedDescription)}</textarea>
                  </div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Image URL (optional)</label>
                      <input type="text" name="embedImage" value="${escapeHtml(ticketConfig.embedImage ?? '')}">
                    </div>
                    <div class="form-group">
                      <label>Thumbnail URL (optional)</label>
                      <input type="text" name="embedThumbnail" value="${escapeHtml(ticketConfig.embedThumbnail ?? '')}">
                    </div>
                  </div>
                  <div class="card-title" style="margin-top:16px">🔧 Thread Settings</div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Thread Name Template</label>
                      <input type="text" name="threadNameTemplate" value="${escapeHtml(ticketConfig.threadNameTemplate)}" placeholder="{type}-{username}">
                      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Variables: {type} {username} {id}</div>
                    </div>
                    <div class="form-group">
                      <label>Auto-close after (hours, 0 = disabled)</label>
                      <input type="number" name="autoCloseHours" value="${ticketConfig.autoCloseHours}" min="0" max="168">
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Opening Message Template</label>
                    <textarea name="openMessageTemplate">${escapeHtml(ticketConfig.openMessageTemplate)}</textarea>
                    <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">Variables: {user} {date} {ticket_type}</div>
                  </div>
                  <div class="card-title" style="margin-top:16px">📢 Staff & Logging</div>
                  <div class="grid-2">
                    <div class="form-group">
                      <label>Staff Role</label>
                      <select name="staffRole">
                        <option value="">None</option>
                        ${roles.map((r) => `<option value="${r.id}" ${ticketConfig.staffRoles.includes(r.id) ? 'selected' : ''}>${r.name}</option>`).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Log Channel</label>
                      <select name="logChannel">
                        <option value="">None</option>
                        ${channels.map((c) => `<option value="${c.id}" ${ticketConfig.logChannelId === c.id ? 'selected' : ''}>#${c.name}</option>`).join('')}
                      </select>
                    </div>
                  </div>
                  <button type="submit" class="btn btn-primary">Save Ticket Config</button>
                </form>
              </div>

              <div class="card">
                <div class="card-title">📤 Send Ticket Panel</div>
                <p style="color:var(--text-muted);font-size:.9rem;margin-bottom:16px">Send the ticket panel embed with buttons to a channel.</p>
                <form method="POST" action="/api/guild/${guildId}/ticket/panel">
                  <div class="form-group">
                    <label>Send to Channel</label>
                    <select name="channelId" required>
                      <option value="">Select a channel...</option>
                      ${channels.map((c) => `<option value="${c.id}">#${c.name}</option>`).join('')}
                    </select>
                  </div>
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
                  </div>
                  <button type="submit" class="btn btn-primary">Save Thresholds</button>
                </form>
              </div>
            </div>

            <!-- TICKETS LIST TAB -->
            <div id="tab-tickets-list" class="tab-content">
              <div class="card">
                <div class="card-title">📝 Recent Tickets</div>
                <div id="ticketsList">Loading...</div>
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

        async function loadTickets() {
          const el = document.getElementById('ticketsList');
          if (!el) return;
          const tab = document.getElementById('tab-tickets-list');
          if (!tab || !tab.classList.contains('active')) return;
          try {
            const res = await fetch('/api/guild/${guildId}/tickets');
            const data = await res.json();
            if (!data.tickets.length) { el.innerHTML = '<p style="color:var(--text-muted)">No tickets yet.</p>'; return; }
            el.innerHTML = '<table class="table"><thead><tr><th>#</th><th>Type</th><th>Status</th><th>User ID</th><th>Created</th></tr></thead><tbody>' +
              data.tickets.map(t => '<tr><td>#'+t.number+'</td><td>'+t.type+'</td><td><span class="badge badge-'+(t.status==='open'?'success':'danger')+'">'+t.status+'</span></td><td>'+t.userId+'</td><td>'+new Date(t.createdAt).toLocaleDateString()+'</td></tr>').join('') +
              '</tbody></table>';
          } catch { el.innerHTML = '<p style="color:var(--text-muted)">Failed to load tickets.</p>'; }
        }

        document.addEventListener('DOMContentLoaded', () => {
          const saved = localStorage.getItem('activeTab_'+location.pathname);
          if (saved && document.getElementById(saved)) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.sidebar-item[data-tab]').forEach(t => t.classList.remove('active'));
            document.getElementById(saved).classList.add('active');
            document.querySelector('[data-tab="'+saved+'"]')?.classList.add('active');
          } else {
            document.getElementById('tab-modules').classList.add('active');
            document.querySelector('[data-tab="tab-modules"]').classList.add('active');
          }
          loadTickets();
        });

        document.querySelectorAll('.sidebar-item[data-tab]').forEach(item => {
          item.addEventListener('click', () => setTimeout(loadTickets, 100));
        });
      </script>
    `, req.user as any));
  });

  app.post('/api/guild/:id/modules', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const moduleKeys = ['ticket','giveaway','verification','antirAid','antinuke','antilink','logging','youtube','twitch','roblox','ai','suggestions','reactionRoles','stats','schedule','backup','minigames','moderation'];
    const updates: Record<string, boolean> = {};
    for (const key of moduleKeys) {
      updates[`modules.${key}`] = key in req.body;
    }
    await GuildModel.findOneAndUpdate({ guildId }, updates, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1#modules`);
  });

  app.post('/api/guild/:id/general', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const b = req.body;
    await GuildModel.findOneAndUpdate({ guildId }, {
      logChannel: b.logChannel || null,
      modLogChannel: b.modLogChannel || null,
      suggestionsChannel: b.suggestionsChannel || null,
      'autoModThresholds.warnMuteThreshold': parseInt(b.warnMuteThreshold) || 3,
      'autoModThresholds.warnBanThreshold': parseInt(b.warnBanThreshold) || 5,
      'autoModThresholds.raidJoins': parseInt(b.raidJoins) || 10,
      'autoModThresholds.raidSeconds': parseInt(b.raidSeconds) || 5,
      'autoModThresholds.nukeChannelDeletes': parseInt(b.nukeChannelDeletes) || 3,
      'autoModThresholds.nukeBans': parseInt(b.nukeBans) || 5,
    }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}?saved=1`);
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
    const color = b.embedColorText || b.embedColor || '#5865F2';
    const staffRole = b.staffRole ? [b.staffRole] : [];
    await TicketConfigModel.findOneAndUpdate({ guildId }, {
      embedTitle: b.embedTitle || '🎫 Support Tickets',
      embedDescription: b.embedDescription || 'Click a button to open a ticket.',
      embedColor: color.startsWith('#') ? color : `#${color}`,
      embedImage: b.embedImage || null,
      embedThumbnail: b.embedThumbnail || null,
      threadNameTemplate: b.threadNameTemplate || '{type}-{username}',
      openMessageTemplate: b.openMessageTemplate || 'Hello {user}! Staff will be with you shortly.',
      autoCloseHours: parseInt(b.autoCloseHours) || 48,
      staffRoles: staffRole,
      logChannelId: b.logChannel || null,
    }, { upsert: true });
    res.redirect(`/guild/${guildId}?saved=1`);
  });

  app.post('/api/guild/:id/ticket/panel', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const channelId = req.body.channelId;
    if (!channelId) { res.redirect(`/guild/${guildId}?error=No+channel+selected`); return; }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) { res.redirect(`/guild/${guildId}?error=Guild+not+found`); return; }

    const channel = guild.channels.cache.get(channelId) as any;
    if (!channel?.isTextBased()) { res.redirect(`/guild/${guildId}?error=Invalid+channel`); return; }

    const ticketConfig = await getTicketConfig(guildId);
    const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import('discord.js');

    const embed = new EmbedBuilder()
      .setColor(ticketConfig.embedColor as `#${string}`)
      .setTitle(ticketConfig.embedTitle)
      .setDescription(ticketConfig.embedDescription)
      .setTimestamp();

    if (ticketConfig.embedImage) embed.setImage(ticketConfig.embedImage);
    if (ticketConfig.embedThumbnail) embed.setThumbnail(ticketConfig.embedThumbnail);

    const buttons = ticketConfig.buttons.map((b) =>
      new ButtonBuilder()
        .setCustomId(`ticket:open:${b.type}`)
        .setLabel(b.label)
        .setEmoji(b.emoji)
        .setStyle(b.style)
    );

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
      res.redirect(`/guild/${guildId}?saved=1`);
    } catch (err) {
      logger.error('Failed to send ticket panel:', err instanceof Error ? err : new Error(String(err)));
      res.redirect(`/guild/${guildId}?error=Failed+to+send+panel`);
    }
  });

  app.get('/api/guild/:id/tickets', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const tickets = await TicketModel.find({ guildId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    res.json({ tickets: tickets.map((t) => ({
      id: t._id, number: t.ticketNumber, type: t.type,
      status: t.status, userId: t.userId, claimedBy: t.claimedBy,
      createdAt: t.createdAt, closedAt: t.closedAt,
    }))});
  });

  app.post('/api/guild/:id/module', requireAuth, async (req, res) => {
    const { module, enabled } = req.body;
    const guildId = req.params.id;
    if (!isGuildAdmin(req, guildId)) { res.status(403).json({ error: 'Forbidden' }); return; }
    await GuildModel.findOneAndUpdate({ guildId }, { [`modules.${module}`]: enabled === 'true' }, { upsert: true });
    invalidateGuildCache(guildId);
    res.redirect(`/guild/${guildId}`);
  });

  return app;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
