"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataGenerator = void 0;
const synthetic_dataset_1 = require("./synthetic-dataset");
class DataGenerator {
    static generate(options) {
        const { type, recordCount = 1000, schema, name } = options;
        switch (type) {
            case 'users':
                return synthetic_dataset_1.SyntheticDataset.generateUserDataset(recordCount);
            case 'sales':
                return synthetic_dataset_1.SyntheticDataset.generateSalesDataset(recordCount);
            case 'logs':
                return synthetic_dataset_1.SyntheticDataset.generateLogDataset(recordCount);
            case 'mixed':
                return synthetic_dataset_1.SyntheticDataset.generateMixedTypesDataset(recordCount);
            case 'custom':
                if (!schema) {
                    throw new Error('Custom dataset type requires a schema');
                }
                return synthetic_dataset_1.SyntheticDataset.generate({
                    recordCount,
                    schema,
                    name: name || 'custom-dataset'
                });
            default:
                throw new Error(`Unknown dataset type: ${type}`);
        }
    }
    static generateMultiple(configs) {
        return configs.map(config => this.generate(config));
    }
    static generateWithVariations(baseOptions, variations) {
        const datasets = [];
        const baseDataset = this.generate(baseOptions);
        datasets.push(baseDataset);
        if (baseOptions.schema) {
            for (const variation of variations) {
                const modifiedSchema = variation.modifySchema(baseOptions.schema);
                const variantDataset = this.generate({
                    ...baseOptions,
                    schema: modifiedSchema,
                    name: `${baseOptions.name || 'dataset'}-${variation.name}`
                });
                datasets.push(variantDataset);
            }
        }
        return datasets;
    }
    static createQualityVariations() {
        return [
            {
                name: 'high-quality',
                modifySchema: (schema) => {
                    const modified = { ...schema };
                    for (const field of Object.values(modified)) {
                        if (field.options) {
                            field.options.nullRate = Math.min(field.options.nullRate || 0.1, 0.05);
                        }
                    }
                    return modified;
                }
            },
            {
                name: 'low-quality',
                modifySchema: (schema) => {
                    const modified = { ...schema };
                    for (const field of Object.values(modified)) {
                        if (field.options) {
                            field.options.nullRate = Math.max(field.options.nullRate || 0.1, 0.3);
                        }
                    }
                    return modified;
                }
            },
            {
                name: 'sparse',
                modifySchema: (schema) => {
                    const modified = { ...schema };
                    for (const field of Object.values(modified)) {
                        if (field.options) {
                            field.options.nullRate = 0.7;
                        }
                    }
                    return modified;
                }
            }
        ];
    }
    static createSizeVariations(baseSizes = [100, 500, 1000, 5000]) {
        return baseSizes.map(size => ({
            name: `size-${size}`,
            recordCount: size
        }));
    }
    static generateBenchmarkSuite() {
        const datasets = [];
        const types = ['users', 'sales', 'logs', 'mixed'];
        const sizes = [100, 500, 1000];
        for (const type of types) {
            for (const size of sizes) {
                const dataset = this.generate({
                    type,
                    recordCount: size,
                    name: `benchmark-${type}-${size}`
                });
                datasets.push(dataset);
            }
        }
        return datasets;
    }
}
exports.DataGenerator = DataGenerator;
//# sourceMappingURL=data-generator.js.map