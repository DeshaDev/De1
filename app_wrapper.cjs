'use strict';

// cPanel/Passenger CommonJS entry point.
// The production server bundle is ESM (package.json sets "type": "module").
import('./server.js').catch((error) => {
  console.error('[Haya Naqra] Failed to start the ESM server bundle:', error);
  process.exitCode = 1;
});
