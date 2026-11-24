const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado. Token não fornecido.' });
    }

    const secret = getJwtSecret();
    try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
        req.user = decoded;
        next();
    } catch {
        return res.status(403).json({ message: 'Token inválido ou expirado.' });
    }
};

module.exports = authMiddleware;
