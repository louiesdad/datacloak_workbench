import { Dataset } from '../types';
import { SyntheticDataset, DatasetSchema } from './synthetic-dataset';

export interface DataGeneratorOptions {
  type: 'users' | 'sales' | 'logs' | 'mixed' | 'custom';
  recordCount?: number;
  schema?: DatasetSchema;
  name?: string;
  variations?: DatasetVariation[];
}

export interface DatasetVariation {
  name: string;
  modifySchema: (schema: DatasetSchema) => DatasetSchema;
}

export class DataGenerator {
  static generate(options: DataGeneratorOptions): Dataset {
    const { type, recordCount = 1000, schema, name } = options;

    switch (type) {
      case 'users':
        return SyntheticDataset.generateUserDataset(recordCount);
      case 'sales':
        return SyntheticDataset.generateSalesDataset(recordCount);
      case 'logs':
        return SyntheticDataset.generateLogDataset(recordCount);
      case 'mixed':
        return SyntheticDataset.generateMixedTypesDataset(recordCount);
      case 'custom':
        if (!schema) {
          throw new Error('Custom dataset type requires a schema');
        }
        return SyntheticDataset.generate({
          recordCount,
          schema,
          name: name || 'custom-dataset'
        });
      default:
        throw new Error(`Unknown dataset type: ${type}`);
    }
  }

  static generateMultiple(configs: DataGeneratorOptions[]): Dataset[] {
    return configs.map(config => this.generate(config));
  }

  static generateWithVariations(
    baseOptions: DataGeneratorOptions,
    variations: DatasetVariation[]
  ): Dataset[] {
    const datasets: Dataset[] = [];
    
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

  static createQualityVariations(): DatasetVariation[] {
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

  static createSizeVariations(baseSizes: number[] = [100, 500, 1000, 5000]): Array<{ name: string; recordCount: number }> {
    return baseSizes.map(size => ({
      name: `size-${size}`,
      recordCount: size
    }));
  }

  static generateBenchmarkSuite(): Dataset[] {
    const datasets: Dataset[] = [];
    const types: Array<'users' | 'sales' | 'logs' | 'mixed'> = ['users', 'sales', 'logs', 'mixed'];
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