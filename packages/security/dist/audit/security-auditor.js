"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityAuditor = void 0;
class SecurityAuditor {
    constructor(dataCloakBridge, config = {}) {
        this.auditHistory = [];
        this.dataCloakBridge = dataCloakBridge;
        this.config = {
            enableRealTimeMonitoring: false,
            complianceThreshold: 0.8,
            alertOnViolations: true,
            logLevel: 'info',
            ...config
        };
    }
    async auditFile(filePath) {
        if (!this.dataCloakBridge.isAvailable()) {
            throw new Error('DataCloak bridge is not available');
        }
        const result = await this.dataCloakBridge.auditSecurity(filePath);
        this.auditHistory.push(result);
        if (this.config.alertOnViolations && result.violations.length > 0) {
            this.triggerAlert(result);
        }
        this.log('info', `Audited file: ${filePath} - Score: ${result.complianceScore}`);
        return result;
    }
    async auditMultipleFiles(filePaths) {
        const reportId = this.generateReportId();
        const auditResults = [];
        for (const filePath of filePaths) {
            try {
                const result = await this.auditFile(filePath);
                auditResults.push(result);
            }
            catch (error) {
                this.log('error', `Failed to audit ${filePath}: ${error}`);
            }
        }
        return this.generateReport(reportId, auditResults);
    }
    async validatePIIMasking(originalText, maskedText) {
        const originalPII = await this.dataCloakBridge.detectPII(originalText);
        const maskedPII = await this.dataCloakBridge.detectPII(maskedText);
        const unmaskPIICount = maskedPII.filter(pii => originalPII.some(orig => orig.sample === pii.sample)).length;
        const maskingEffectiveness = 1 - (unmaskPIICount / Math.max(originalPII.length, 1));
        return maskingEffectiveness >= this.config.complianceThreshold;
    }
    getAuditHistory() {
        return [...this.auditHistory];
    }
    clearAuditHistory() {
        this.auditHistory = [];
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    generateReport(reportId, auditResults) {
        const totalPIIDetected = auditResults.reduce((sum, result) => sum + result.piiItemsDetected, 0);
        const averageAccuracy = auditResults.length > 0
            ? auditResults.reduce((sum, result) => sum + result.maskingAccuracy, 0) / auditResults.length
            : 0;
        const complianceScore = auditResults.length > 0
            ? auditResults.reduce((sum, result) => sum + result.complianceScore, 0) / auditResults.length
            : 0;
        const criticalViolations = auditResults
            .filter(result => result.complianceScore < this.config.complianceThreshold)
            .flatMap(result => result.violations);
        const recommendations = [...new Set(auditResults.flatMap(result => result.recommendations))];
        return {
            reportId,
            timestamp: new Date(),
            filesAudited: auditResults.length,
            totalPIIDetected,
            averageAccuracy,
            complianceScore,
            criticalViolations,
            recommendations,
            auditResults
        };
    }
    generateReportId() {
        return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    triggerAlert(result) {
        this.log('warn', `Security violations detected in ${result.fileProcessed}: ${result.violations.join(', ')}`);
    }
    log(level, message) {
        const levels = {
            error: 0, warn: 1, info: 2, debug: 3
        };
        if (levels[level] <= levels[this.config.logLevel]) {
            console.log(`[${level.toUpperCase()}] ${new Date().toISOString()} - ${message}`);
        }
    }
}
exports.SecurityAuditor = SecurityAuditor;
//# sourceMappingURL=security-auditor.js.map