"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyntheticDataset = void 0;
const field_generator_1 = require("./field-generator");
class SyntheticDataset {
    static generate(options) {
        const { recordCount, schema, name = 'synthetic-dataset' } = options;
        if (options.seed) {
            this.setSeed(options.seed);
        }
        const fields = {};
        for (const [fieldName, fieldConfig] of Object.entries(schema)) {
            const generationOptions = {
                count: recordCount,
                ...fieldConfig.options
            };
            fields[fieldName] = field_generator_1.FieldGenerator.generate(fieldConfig.type, generationOptions);
        }
        return {
            name,
            fields,
            metadata: {
                generatedAt: new Date().toISOString(),
                recordCount,
                fieldCount: Object.keys(schema).length,
                schema: schema
            }
        };
    }
    static generateUserDataset(recordCount = 1000) {
        const schema = {
            id: { type: 'number', options: { minValue: 1, maxValue: 10000, nullRate: 0 } },
            email: { type: 'email', options: { nullRate: 0.05 } },
            firstName: { type: 'string', options: { minLength: 2, maxLength: 15, nullRate: 0.02 } },
            lastName: { type: 'string', options: { minLength: 2, maxLength: 20, nullRate: 0.02 } },
            phone: { type: 'phone', options: { nullRate: 0.15 } },
            birthDate: { type: 'date', options: { nullRate: 0.1 } },
            isActive: { type: 'boolean', options: { nullRate: 0.01 } },
            lastLogin: { type: 'date', options: { nullRate: 0.3 } },
            profileUrl: { type: 'url', options: { nullRate: 0.4 } },
            metadata: { type: 'json', options: { nullRate: 0.2 } }
        };
        return this.generate({
            recordCount,
            schema,
            name: 'users-dataset'
        });
    }
    static generateSalesDataset(recordCount = 500) {
        const schema = {
            orderId: { type: 'string', options: { patterns: ['ORD-2024-000001', 'ORD-2024-000002'], nullRate: 0 } },
            customerId: { type: 'number', options: { minValue: 100, maxValue: 9999, nullRate: 0 } },
            customerEmail: { type: 'email', options: { nullRate: 0.1 } },
            orderDate: { type: 'date', options: { nullRate: 0 } },
            amount: { type: 'number', options: { minValue: 10, maxValue: 5000, nullRate: 0 } },
            currency: { type: 'string', options: { patterns: ['USD', 'EUR', 'GBP'], nullRate: 0 } },
            status: { type: 'string', options: { patterns: ['pending', 'completed', 'cancelled', 'refunded'], nullRate: 0 } },
            shippingAddress: { type: 'json', options: { nullRate: 0.1 } },
            items: { type: 'array', options: { nullRate: 0 } }
        };
        return this.generate({
            recordCount,
            schema,
            name: 'sales-dataset'
        });
    }
    static generateLogDataset(recordCount = 2000) {
        const schema = {
            timestamp: { type: 'date', options: { nullRate: 0 } },
            level: { type: 'string', options: { patterns: ['INFO', 'WARN', 'ERROR', 'DEBUG'], nullRate: 0 } },
            message: { type: 'string', options: { minLength: 10, maxLength: 200, nullRate: 0 } },
            userId: { type: 'number', options: { minValue: 1, maxValue: 1000, nullRate: 0.3 } },
            sessionId: { type: 'string', options: { minLength: 32, maxLength: 32, nullRate: 0.2 } },
            ipAddress: { type: 'string', options: { patterns: ['192.168.1.1', '10.0.0.1', '172.16.0.1'], nullRate: 0.1 } },
            userAgent: { type: 'string', options: { minLength: 50, maxLength: 150, nullRate: 0.2 } },
            requestId: { type: 'string', options: { minLength: 36, maxLength: 36, nullRate: 0 } }
        };
        return this.generate({
            recordCount,
            schema,
            name: 'logs-dataset'
        });
    }
    static generateMixedTypesDataset(recordCount = 100) {
        const schema = {
            stringField: { type: 'string', options: { nullRate: 0.1 } },
            numberField: { type: 'number', options: { nullRate: 0.15 } },
            booleanField: { type: 'boolean', options: { nullRate: 0.05 } },
            dateField: { type: 'date', options: { nullRate: 0.2 } },
            emailField: { type: 'email', options: { nullRate: 0.25 } },
            urlField: { type: 'url', options: { nullRate: 0.3 } },
            phoneField: { type: 'phone', options: { nullRate: 0.35 } },
            jsonField: { type: 'json', options: { nullRate: 0.4 } },
            arrayField: { type: 'array', options: { nullRate: 0.3 } },
            objectField: { type: 'object', options: { nullRate: 0.25 } }
        };
        return this.generate({
            recordCount,
            schema,
            name: 'mixed-types-dataset'
        });
    }
    static setSeed(seed) {
        let currentSeed = seed;
        Math.random = () => {
            currentSeed = (currentSeed * 9301 + 49297) % 233280;
            return currentSeed / 233280;
        };
    }
}
exports.SyntheticDataset = SyntheticDataset;
//# sourceMappingURL=synthetic-dataset.js.map