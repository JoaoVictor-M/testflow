db = db.getSiblingDB('testflow-db');

// Runs only when the data volume is created. The admin's bcrypt hash comes from the environment:
// no account with a known password ships with the repository.
var hash = process.env.TESTFLOW_ADMIN_PASSWORD_HASH;
var bcryptHash = /^\$2[aby]\$\d{2}\$.{53}$/;

if (db.users.findOne({ username: 'admin' })) {
    print('>>> PRE-LOAD: Usuário Admin já existe.');
} else if (!hash || !bcryptHash.test(hash)) {
    print('>>> PRE-LOAD: Admin NÃO criado. Defina TESTFLOW_ADMIN_PASSWORD_HASH (hash bcrypt) no .env ' +
        'e recrie o volume, ou crie o primeiro admin pelo procedimento do README.');
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
