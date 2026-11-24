const mongoose = require('mongoose');

// Cada arquivo de teste usa o próprio banco no Mongo descartável do docker-compose.teste.yml,
// porque o runner executa os arquivos em paralelo.
const connectTo = (databaseName) =>
    mongoose.connect(`mongodb://mongodb-service:27017/${databaseName}`, { serverSelectionTimeoutMS: 10000 });

const dropAndDisconnect = async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
};

module.exports = { connectTo, dropAndDisconnect };
