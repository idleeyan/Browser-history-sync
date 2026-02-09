const path = require('path');

module.exports = {
  entry: './background/service_worker.js',
  output: {
    filename: 'background.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  mode: 'production',
  target: 'webworker',
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false,
      "util": false,
      "buffer": false,
      "path": false,
      "fs": false,
      "url": false,
      "querystring": false,
      "http": false,
      "https": false,
      "net": false,
      "tls": false,
      "zlib": false,
      "os": false,
      "assert": false,
      "constants": false,
      "timers": false,
      "vm": false,
      "process": false
    }
  },
  optimization: {
    minimize: true
  }
};
