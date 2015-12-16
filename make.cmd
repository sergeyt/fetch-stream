set NODE_ENV=production
babel src --out-dir lib && webpack --config webpack.config.js
