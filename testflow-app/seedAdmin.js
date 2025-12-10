const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = 'mongodb://localhost:27017/testflow-db'; // Adjust if running inside docker vs local.
// If running from host machine accessing docker mongo mapped to 27017, localhost is fine.

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('Conectado ao MongoDB...');

        const adminUsername = 'admin';
        const adminPassword = 'admin';

        try {
            const existingAdmin = await User.findOne({ username: adminUsername });
            if (existingAdmin) {
                console.log('Usuário admin já existe.');
            } else {
                const newAdmin = new User({
                    username: adminUsername,
                    password: adminPassword,
                    role: 'admin'
                });
                await newAdmin.save();
                console.log(`Usuário admin criado com sucesso! User: ${adminUsername}, Pass: ${adminPassword}`);
            }
        } catch (error) {
            console.error('Erro ao criar admin:', error);
        } finally {
            mongoose.disconnect();
        }
    })
    .catch(err => {
        console.error('Erro de conexão:', err);
    });
