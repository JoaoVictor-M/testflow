const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

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
        logger.error('Falha ao registrar log de auditoria', { err: error });
    }
};

module.exports = {
    logAudit
};
