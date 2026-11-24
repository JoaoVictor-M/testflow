const cluster = require('cluster');
const os = require('os');
const { logger } = require('./utils/logger');

// Verifica se é o processo Mestre (Primary)
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;

    logger.info('Processo mestre rodando', { pid: process.pid, workers: numCPUs });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        logger.warn('Worker encerrou, iniciando outro', { pid: worker.process.pid });
        cluster.fork();
    });

} else {
    require('./server.js').start();
}
