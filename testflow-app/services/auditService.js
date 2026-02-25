const AuditLog = require('../models/AuditLog');

const logAudit = async (action, entity, entityId, userId, details = {}) => {
    try {
        const audit = new AuditLog({
            action,
            entity,
            entityId,
            user: userId,
            details
        });
        await audit.save();
    } catch (error) {
        console.error('Falha ao registrar log de auditoria:', error); // eslint-disable-line no-console
    }
};

module.exports = {
    logAudit
};
