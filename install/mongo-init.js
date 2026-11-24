db = db.getSiblingDB('testflow-db');

// Runs only when the data volume is created. The admin's bcrypt hash comes from the environment:
// no account with a known password ships with the repository.
var hash = process.env.TESTFLOW_ADMIN_PASSWORD_HASH;
// bcrypt with cost 10 to 31 and the bcrypt alphabet only.
var bcryptHash = /^\$2[aby]\$(?:1\d|2\d|3[01])\$[./A-Za-z0-9]{53}$/;
var guide = 'Veja "Primeiro administrador" no README.';

if (db.users.findOne({ username: 'admin' })) {
    print('>>> PRE-LOAD: Usuário Admin já existe.');
} else if (!hash) {
    print('>>> PRE-LOAD: Admin NÃO criado: TESTFLOW_ADMIN_PASSWORD_HASH não está definida. ' + guide);
} else if (!bcryptHash.test(hash)) {
    print('>>> PRE-LOAD: Admin NÃO criado: TESTFLOW_ADMIN_PASSWORD_HASH não é um hash bcrypt válido ' +
        '(custo de 10 a 31). ' + guide);
} else {
    db.users.insertOne({
        name: 'Administrador',
        username: 'admin',
        password: hash,
        role: 'admin',
        createdAt: new Date()
    });
    print('>>> PRE-LOAD: Usuário Admin criado com o hash informado.');
}
