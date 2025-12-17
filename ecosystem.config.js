// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'interview-bot-prod',
      script: './dist/main.js',
      
      // Instances
      instances: 1,
      exec_mode: 'cluster',
      
      // Environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Logging
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart behavior
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 4000,
      
      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // Cron restart (optional - restart every day at 3 AM)
      // cron_restart: '0 3 * * *',
      
      // Health check (if you have /health endpoint)
      // health_check: {
      //   interval: 30000,  // 30 seconds
      //   url: 'http://localhost:3000/health',
      //   type: 'http',
      // },
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'SSH_USERNAME',
      host: 'SSH_HOSTMACHINE',
      ref: 'origin/main',
      repo: 'GIT_REPOSITORY',
      path: '/var/www/interview-bot-prod',
      'pre-deploy-local': '',
      'post-deploy': 'yarn install && yarn build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};