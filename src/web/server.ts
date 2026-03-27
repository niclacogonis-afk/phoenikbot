import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import path from 'path';
import { config } from '../config';
import { BotClient } from '../bot/client';
import { GuildModel, getGuild } from '../database/models/Guild';
import { TicketModel } from '../database/models/Ticket';
import { StatsModel } from '../database/models/Stats';
import { UserModel } from '../database/models/User';

export function createWebServer(client: BotClient) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

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

  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/callback', passport.authenticate('discord', {
    failureRedirect: '/',
    successRedirect: '/dashboard',
  }));
  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
  });

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>PhoenikBot Dashboard</title><style>
        body { font-family: sans-serif; background: #1a1a2e; color: #eee; text-align: center; padding: 50px; }
        h1 { color: #5865F2; } a { color: #5865F2; padding: 12px 24px; background: #5865F2; color: white; border-radius: 8px; text-decoration: none; display: inline-block; margin-top: 20px; }
      </style></head>
      <body>
        <h1>🚀 PhoenikBot Dashboard</h1>
        <p>Advanced Discord Bot Management</p>
        ${req.isAuthenticated() ? '<a href="/dashboard">Go to Dashboard</a>' : '<a href="/auth/discord">Login with Discord</a>'}
      </body>
      </html>
    `);
  });

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
  }

  app.get('/dashboard', requireAuth, (req, res) => {
    const user = req.user as any;
    const guilds = (user.guilds ?? []).filter((g: any) => (parseInt(g.permissions) & 0x20) === 0x20);
    const botGuilds = client.guilds.cache;

    const manageable = guilds.filter((g: any) => botGuilds.has(g.id));
    const invite = guilds.filter((g: any) => !botGuilds.has(g.id));

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Dashboard</title><style>
        body { font-family: sans-serif; background: #1a1a2e; color: #eee; padding: 30px; }
        h1,h2 { color: #5865F2; }
        .guild { background: #16213e; padding: 16px; border-radius: 8px; margin: 10px; display: inline-block; min-width: 200px; }
        a { color: #5865F2; text-decoration: none; } a:hover { text-decoration: underline; }
        .btn { background: #5865F2; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; display: inline-block; margin-top: 8px; }
      </style></head>
      <body>
        <h1>👋 Welcome, ${user.username}</h1>
        <h2>Your Servers with PhoenikBot</h2>
        ${manageable.map((g: any) => `
          <div class="guild">
            <strong>${g.name}</strong><br>
            <a class="btn" href="/guild/${g.id}">Manage</a>
          </div>
        `).join('') || '<p>No servers found.</p>'}
        <br><a href="/auth/logout">Logout</a>
      </body>
      </html>
    `);
  });

  app.get('/guild/:id', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      res.redirect('/dashboard');
      return;
    }

    const guildData = await getGuild(guildId);
    const modules = Object.entries(guildData.modules)
      .map(([name, enabled]) => `
        <div style="display:flex;justify-content:space-between;padding:10px;background:#0f3460;border-radius:6px;margin:5px 0">
          <span>${name}</span>
          <form method="POST" action="/api/guild/${guildId}/module" style="margin:0">
            <input type="hidden" name="module" value="${name}">
            <input type="hidden" name="enabled" value="${enabled ? 'false' : 'true'}">
            <button type="submit" style="background:${enabled ? '#ED4245' : '#57F287'};color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">${enabled ? 'Disable' : 'Enable'}</button>
          </form>
        </div>
      `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>${guild.name} - Dashboard</title><style>body { font-family: sans-serif; background: #1a1a2e; color: #eee; padding: 30px; } h1,h2 { color: #5865F2; } a { color: #5865F2; }</style></head>
      <body>
        <a href="/dashboard">← Back</a>
        <h1>⚙️ ${guild.name}</h1>
        <h2>Modules</h2>
        ${modules}
        <br>
        <a href="/guild/${guildId}/stats">📊 View Stats</a> |
        <a href="/guild/${guildId}/tickets">🎫 View Tickets</a>
      </body>
      </html>
    `);
  });

  app.post('/api/guild/:id/module', requireAuth, async (req, res) => {
    const { module, enabled } = req.body;
    await GuildModel.findOneAndUpdate(
      { guildId: req.params.id },
      { [`modules.${module}`]: enabled === 'true' },
      { upsert: true }
    );
    const { invalidateGuildCache } = await import('../modules/cache/CacheManager');
    invalidateGuildCache(req.params.id);
    res.redirect(`/guild/${req.params.id}`);
  });

  app.get('/guild/:id/stats', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    const stats = await StatsModel.find({ guildId, date: { $gte: sevenDaysAgo } }).sort({ date: 1 });

    res.json({ guildId, stats });
  });

  app.get('/guild/:id/tickets', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = 20;
    const tickets = await TicketModel.find({ guildId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ guildId, tickets: tickets.map((t) => ({
      id: t._id,
      number: t.ticketNumber,
      type: t.type,
      status: t.status,
      userId: t.userId,
      claimedBy: t.claimedBy,
      createdAt: t.createdAt,
      closedAt: t.closedAt,
    }))});
  });

  app.get('/api/guilds', requireAuth, (req, res) => {
    const user = req.user as any;
    const guilds = (user.guilds ?? []).filter((g: any) => (parseInt(g.permissions) & 0x20) === 0x20);
    res.json(guilds);
  });

  return app;
}
