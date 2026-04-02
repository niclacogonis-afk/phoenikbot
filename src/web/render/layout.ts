export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function layoutPage(title: string, body: string, user?: { username?: string } | null): string {
  const u = user?.username ? escapeHtml(user.username) : '';
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#1a0508">
  <title>${escapeHtml(title)} · PhoenikBot</title>
  <link rel="stylesheet" href="/assets/dashboard.css">
  <script defer src="/assets/dashboard.js"></script>
</head>
<body class="phoenix-app">
  <div class="ember-layer" aria-hidden="true"></div>
  <div class="ember-particles" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="/">
      <img class="brand-logo" src="/assets/logo.png" alt="" width="40" height="40" loading="lazy" onerror="this.style.display='none'">
      <span class="brand-text">Phoenik<span class="brand-hot">Bot</span></span>
    </a>
    <div class="topbar-actions">
      ${user?.username
        ? `<span class="user-pill">${u}</span><a class="btn btn-ghost btn-sm" href="/auth/logout">Esci</a>`
        : `<a class="btn btn-primary btn-sm" href="/auth/discord">Accedi con Discord</a>`}
    </div>
  </header>
  <main class="page-wrap">${body}</main>
</body>
</html>`;
}

/** Preserve active tab after form POST */
export function guildRedirect(guildId: string, query: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `/guild/${guildId}?${s}` : `/guild/${guildId}`;
}
