const { spawn } = require('child_process');

async function runMigration() {
  try {
    console.log('Ejecutando despliegue SQL unificado...');

    await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:deploy'], {
        cwd: __dirname,
        stdio: 'inherit',
        shell: false,
      });

      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`db:deploy terminó con código ${code}`));
      });

      child.on('error', reject);
    });

    console.log('✓ Migración ejecutada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error.message);
    process.exit(1);
  }
}

runMigration();
