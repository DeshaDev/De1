'use strict';

/**
 * CommonJS entrypoint for Namecheap cPanel (Phusion Passenger / LiteSpeed lsnode).
 * Passenger loads the configured startup file with CommonJS require(), so this
 * thin wrapper bridges safely into the bundled ES module server.js.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

import('./server.js').catch((err) => {
  console.error('Failed to start Baseera server from app.cjs:', err);
  process.exit(1);
});
