const cluster = require('cluster');
const os = require('os');

// Verifica se é o processo Mestre (Primary)
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;

    console.log(`[Master] Processo mestre ${process.pid} rodando.`);
    console.log(`[Master] Detectados ${numCPUs} núcleos de CPU. Iniciando Workers...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Master] Worker ${worker.process.pid} died. Starting a new one...`);
        cluster.fork();
    });

} else {
    require('./server.js');
}
