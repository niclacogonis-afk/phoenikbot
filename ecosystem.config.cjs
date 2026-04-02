/**
 * PM2: bot sempre attivo dopo deploy (Linux VPS o Windows con PM2 globale).
 * npm install -g pm2
 * npm run build && npm run pm2:start
 */
module.exports = {
  apps: [
    {
      name: 'phoenikbot',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
