import { Request, Response, NextFunction } from 'express';
import { SuccessResponse } from '../types';
import { TransformValidationService, TransformOperation, DatasetSchema } from '../services/transform-validation.service';
import { TransformPersistenceService } from '../services/transform-persistence.service';
import { AppError } from '../middleware/error.middleware';

export class TransformController {
  private transformValidationService = new TransformValidationService();
  private transformPersistenceService = new TransformPersistenceService();

  async validateTransforms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operations, schema } = req.body;

      // Validate request body
      if (!Array.isArray(operations)) {
        throw new AppError('Operations array is required', 400, 'VALIDATION_ERROR');
      }

      if (!schema || !schema.columns || !Array.isArray(schema.columns)) {
        throw new AppError('Valid dataset schema is required', 400, 'VALIDATION_ERROR');
      }

      // Validate each operation structure
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (!operation.id || !operation.type || operation.config === undefined) {
          throw new AppError(
            `Operation ${i + 1} is missing required fields (id, type, config)`,
            400,
            'INVALID_OPERATION'
          );
        }
      }

      // Perform validation
      const validationResult = await this.transformValidationService.validateTransformPipeline(
        operations as TransformOperation[],
        schema as DatasetSchema
      );

      const result: SuccessResponse = {
        data: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          operationCount: operations.length,
          validOperations: operations.length - validationResult.errors.length
        },
        message: validationResult.valid 
          ? 'Transform pipeline validation passed'
          : `Transform pipeline validation failed with ${validationResult.errors.length} errors`
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async validateSingleTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operation, schema } = req.body;

      // Validate request body
      if (!operation || !operation.id || !operation.type || operation.config === undefined) {
        throw new AppError('Valid operation with id, type, and config is required', 400, 'VALIDATION_ERROR');
      }

      if (!schema || !schema.columns || !Array.isArray(schema.columns)) {
        throw new AppError('Valid dataset schema is required', 400, 'VALIDATION_ERROR');
      }

      // Perform validation
      const validationResult = await this.transformValidationService.validateSingleOperation(
        operation as TransformOperation,
        schema as DatasetSchema
      );

      const result: SuccessResponse = {
        data: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          operation: {
            id: operation.id,
            type: operation.type
          }
        },
        message: validationResult.valid 
          ? 'Transform operation validation passed'
          : `Transform operation validation failed with ${validationResult.errors.length} errors`
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getValidationRules(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { operationType } = req.params;

      let rules: any = {};

      switch (operationType) {
        case 'filter':
          rules = {
            requiredFields: ['field', 'operator', 'value'],
            operators: {
              string: ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex'],
              number: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between'],
              boolean: ['equals', 'not_equals'],
              date: ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between']
            },
            examples: {
              string: { field: 'name', operator: 'contains', value: 'john' },
              number: { field: 'age', operator: 'greater_than', value: 18 },
              boolean: { field: 'active', operator: 'equals', value: true },
              date: { field: 'created_at', operator: 'greater_than', value: '2023-01-01' }
            }
          };
          break;

        case 'sort':
          rules = {
            requiredFields: ['field'],
            optionalFields: ['direction'],
            directions: ['asc', 'desc'],
            example: { field: 'name', direction: 'asc' }
          };
          break;

        case 'rename':
          rules = {
            requiredFields: ['fromField', 'toField'],
            fieldNamePattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
            example: { fromField: 'old_name', toField: 'new_name' }
          };
          break;

        case 'format':
          rules = {
            requiredFields: ['field', 'formatType'],
            formatTypes: {
              string: ['uppercase', 'lowercase', 'title_case', 'trim', 'pad_left', 'pad_right'],
              number: ['decimal_places', 'thousands_separator', 'percentage', 'currency'],
              date: ['date_format', 'timezone_convert']
            },
            example: { field: 'name', formatType: 'title_case' }
          };
          break;

        case 'group':
          rules = {
            requiredFields: ['groupBy'],
            maxGroupFields: 5,
            example: { groupBy: ['category', 'status'] }
          };
          break;

        case 'aggregate':
          rules = {
            requiredFields: ['aggregations'],
            aggregationFunctions: {
              string: ['count', 'count_distinct', 'first', 'last', 'mode'],
              number: ['count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'median', 'std_dev'],
              boolean: ['count', 'count_distinct', 'sum'],
              date: ['count', 'count_distinct', 'min', 'max', 'first', 'last']
            },
            example: { 
              aggregations: [
                { field: 'revenue', function: 'sum' },
                { field: 'orders', function: 'count' }
              ]
            }
          };
          break;

        case 'join':
          rules = {
            requiredFields: ['joinType', 'leftKey', 'rightKey', 'rightDataset'],
            joinTypes: ['inner', 'left', 'right', 'full'],
            example: {
              joinType: 'left',
              leftKey: 'customer_id',
              rightKey: 'id',
              rightDataset: 'customers'
            }
          };
          break;

        case 'pivot':
          rules = {
            requiredFields: ['pivotColumn', 'valueColumn'],
            optionalFields: ['aggregationFunction'],
            example: {
              pivotColumn: 'month',
              valueColumn: 'sales',
              aggregationFunction: 'sum'
            }
          };
          break;

        default:
          throw new AppError(`Unknown operation type: ${operationType}`, 400, 'UNKNOWN_OPERATION_TYPE');
      }

      const result: SuccessResponse = {
        data: {
          operationType,
          rules,
          description: this.getOperationDescription(operationType)
        }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSupportedOperations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const operations = [
        {
          type: 'filter',
          name: 'Filter Rows',
          description: 'Filter dataset rows based on column values',
          category: 'data_selection',
          complexity: 'simple',
          supportedTypes: ['string', 'number', 'boolean', 'date']
        },
        {
          type: 'sort',
          name: 'Sort Data',
          description: 'Sort dataset by one or more columns',
          category: 'data_ordering',
          complexity: 'simple',
          supportedTypes: ['string', 'number', 'date']
        },
        {
          type: 'rename',
          name: 'Rename Column',
          description: 'Rename a column in the dataset',
          category: 'schema_modification',
          complexity: 'simple',
          supportedTypes: ['all']
        },
        {
          type: 'format',
          name: 'Format Values',
          description: 'Apply formatting to column values',
          category: 'data_transformation',
          complexity: 'intermediate',
          supportedTypes: ['string', 'number', 'date']
        },
        {
          type: 'group',
          name: 'Group Data',
          description: 'Group rows by one or more columns',
          category: 'data_aggregation',
          complexity: 'intermediate',
          supportedTypes: ['string', 'number', 'date']
        },
        {
          type: 'aggregate',
          name: 'Aggregate Values',
          description: 'Calculate aggregate functions on grouped data',
          category: 'data_aggregation',
          complexity: 'intermediate',
          supportedTypes: ['string', 'number', 'boolean', 'date']
        },
        {
          type: 'join',
          name: 'Join Datasets',
          description: 'Join with another dataset',
          category: 'data_combination',
          complexity: 'advanced',
          supportedTypes: ['all']
        },
        {
          type: 'pivot',
          name: 'Pivot Table',
          description: 'Create pivot table from data',
          category: 'data_reshaping',
          complexity: 'advanced',
          supportedTypes: ['string', 'number']
        }
      ];

      const result: SuccessResponse = {
        data: {
          operations,
          categories: [
            'data_selection',
            'data_ordering', 
            'schema_modification',
            'data_transformation',
            'data_aggregation',
            'data_combination',
            'data_reshaping'
          ],
          complexityLevels: ['simple', 'intermediate', 'advanced']
        }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  private getOperationDescription(operationType: string): string {
    const descriptions: Record<string, string> = {
      filter: 'Filter operation allows you to select rows that match specific criteria. You can filter by exact values, ranges, text patterns, and more.',
      sort: 'Sort operation arranges your data in ascending or descending order based on one or more columns.',
      rename: 'Rename operation changes the name of a column. The new name must be unique and follow valid identifier rules.',
      format: 'Format operation applies formatting rules to column values, such as changing text case, number precision, or date formats.',
      group: 'Group operation groups rows that have the same values in specified columns, preparing data for aggregation.',
      aggregate: 'Aggregate operation calculates summary statistics (sum, average, count, etc.) on grouped data.',
      join: 'Join operation combines your dataset with another dataset based on matching key columns.',
      pivot: 'Pivot operation transforms rows into columns, creating a pivot table view of your data.'
    };

    return descriptions[operationType] || 'Transform operation to modify your dataset.';
  }

  /**
   * Save a transform configuration
   */
  async saveTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, operations, description, tags, isPublic } = req.body;
      const userId = req.headers['x-user-id'] as string;

      if (!name || !operations) {
        throw new AppError('Name and operations are required', 400, 'VALIDATION_ERROR');
      }

      const savedTransform = await this.transformPersistenceService.saveTransform(
        name,
        operations,
        {
          description,
          tags,
          isPublic,
          userId
        }
      );

      const result: SuccessResponse = {
        data: savedTransform,
        message: 'Transform saved successfully'
      };

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a saved transform
   */
  async getTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const transform = await this.transformPersistenceService.getTransform(id);

      if (!transform) {
        throw new AppError('Transform not found', 404, 'NOT_FOUND');
      }

      const result: SuccessResponse = {
        data: transform
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List saved transforms
   */
  async listTransforms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.headers['x-user-id'] as string;
      const { isPublic, tags, search, limit, offset } = req.query;

      const { transforms, total } = await this.transformPersistenceService.listTransforms({
        userId: isPublic === 'true' ? undefined : userId,
        isPublic: isPublic === 'true',
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) as string[] : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined
      });

      const result: SuccessResponse = {
        data: {
          transforms,
          total,
          limit: limit ? parseInt(limit as string) : 20,
          offset: offset ? parseInt(offset as string) : 0
        }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a saved transform
   */
  async updateTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, description, operations, tags, isPublic } = req.body;

      const updatedTransform = await this.transformPersistenceService.updateTransform(
        id,
        {
          name,
          description,
          operations,
          tags,
          isPublic
        }
      );

      if (!updatedTransform) {
        throw new AppError('Transform not found', 404, 'NOT_FOUND');
      }

      const result: SuccessResponse = {
        data: updatedTransform,
        message: 'Transform updated successfully'
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a saved transform
   */
  async deleteTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await this.transformPersistenceService.deleteTransform(id);

      if (!deleted) {
        throw new AppError('Transform not found', 404, 'NOT_FOUND');
      }

      const result: SuccessResponse = {
        message: 'Transform deleted successfully',
        data: { deleted: true }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transform execution history
   */
  async getTransformHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { limit } = req.query;

      const history = await this.transformPersistenceService.getExecutionHistory(
        id,
        limit ? parseInt(limit as string) : undefined
      );

      const result: SuccessResponse = {
        data: history
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transform templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.query;

      const templates = await this.transformPersistenceService.getTemplates(
        category as string
      );

      const result: SuccessResponse = {
        data: templates
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Export transform configuration
   */
  async exportTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const exportData = await this.transformPersistenceService.exportTransform(id);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="transform-${id}.json"`);
      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Import transform configuration
   */
  async importTransform(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, operations, tags } = req.body;
      const userId = req.headers['x-user-id'] as string;

      if (!name || !operations) {
        throw new AppError('Name and operations are required', 400, 'VALIDATION_ERROR');
      }

      const importedTransform = await this.transformPersistenceService.importTransform(
        {
          name,
          description,
          operations
        },
        {
          userId,
          tags
        }
      );

      const result: SuccessResponse = {
        data: importedTransform,
        message: 'Transform imported successfully'
      };

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}