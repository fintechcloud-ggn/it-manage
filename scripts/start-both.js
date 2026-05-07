const net = require('net');
const { spawn } = require('child_process');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (error) => {
      resolve(error.code !== 'EADDRINUSE' && error.code !== 'EACCES');
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`Unable to find an open port starting at ${startPort}`);
}

function run(name, args, extraEnv = {}) {
  const child = spawn(npmCmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else if (code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      shutdown(code || 1);
    }
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function startAll() {
  try {
    const backendPort = await findAvailablePort(Number(process.env.PORT || 4000));
    const frontendPort = await findAvailablePort(Number(process.env.FRONTEND_PORT || 3000));
    const apiUrl = process.env.REACT_APP_API || `http://localhost:${backendPort}`;
    const requestedBackendPort = Number(process.env.PORT || 4000);
    const requestedFrontendPort = Number(process.env.FRONTEND_PORT || 3000);

    console.log(`[start] Backend port: ${backendPort}${backendPort !== requestedBackendPort ? ` (fallback from ${requestedBackendPort})` : ''}`);
    console.log(`[start] Frontend port: ${frontendPort}${frontendPort !== requestedFrontendPort ? ` (fallback from ${requestedFrontendPort})` : ''}`);
    console.log(`[start] Frontend API target: ${apiUrl}`);

    run('backend', ['run', 'start:backend'], { PORT: String(backendPort) });
    run('frontend', ['run', 'start:frontend'], {
      PORT: String(frontendPort),
      REACT_APP_API: apiUrl,
    });
  } catch (error) {
    console.error('[start] Failed to start app:', error.message);
    process.exit(1);
  }
}

startAll();
