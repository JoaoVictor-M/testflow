const cluster = require('cluster');
const os = require('os');

// Verifica se é o processo Mestre (Primary)
if (cluster.isPrimary) {
    const numCPUs = os.cpus().length;

    console.log(`[Master] Processo mestre ${process.pid} rodando.`);
    console.log(`[Master] Detectados ${numCPUs} núcleos de CPU. Iniciando Workers...`);

    // Cria um worker para cada núcleo da CPU
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Ouvinte para quando um worker morre (para reiniciar automaticamente)
    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Master] Worker ${worker.process.pid} morreu (código: ${code}). Iniciando um novo...`);
        cluster.fork();
    });

} else {
    // Se não for o processo Mestre, é um Worker.
    // O worker vai executar o código do servidor (Express) que antes estava no index.js
    console.log(`[Worker] Processo worker ${process.pid} iniciado.`);
    require('./server.js');
}
