db = db.getSiblingDB('testflow-db');

// Verifica se já existe para não duplicar (embora o script só rode na primeira vez do volume)
var user = db.users.findOne({ username: 'admin' });

if (!user) {
    db.users.insertOne({
        name: 'Administrador',
        username: 'admin',
        password: '$2b$10$6pAYVXKhjy4yE7yGdFmREuKyWH/fSXBeHtIc9qnl2JnmP5gUMO/my',
        role: 'admin',
        createdAt: new Date()
    });
    print('>>> PRE-LOAD: Usuário Admin criado com sucesso (Hash seguro).');
} else {
    print('>>> PRE-LOAD: Usuário Admin já existe.');
}
