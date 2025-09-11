module.exports = {
  apps: [{
    name: 'nestjs-app',
    script: 'src/main.js',
    cwd: '/var/www/nestjs-app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/nestjs-app-error.log',
    out_file: '/var/log/pm2/nestjs-app-out.log',
    log_file: '/var/log/pm2/nestjs-app.log',
    time: true
  }]
};