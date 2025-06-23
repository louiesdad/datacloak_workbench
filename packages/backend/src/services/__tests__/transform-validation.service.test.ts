import { TransformValidationService } from '../transform-validation.service';
import { AppError } from '../../middleware/error.middleware';

describe('TransformValidationService', () => {
  let service: TransformValidationService;

  beforeEach(() => {
    service = new TransformValidationService();
  });

  describe('validateTransformChain', () => {
    const mockOperations = [
      {
        id: 'op1',
        type: 'filter' as const,
        config: { field: 'status', operator: 'equals', value: 'active' },
        enabled: true
      },
      {
        id: 'op2',
        type: 'sort' as const,
        config: { field: 'date', order: 'desc' },
        enabled: true
      }
    ];

    const mockSchema = {
      columns: [
        { name: 'status', type: 'string' as const, nullable: false, unique: false },
        { name: 'date', type: 'date' as const, nullable: false, unique: false },
        { name: 'amount', type: 'number' as const, nullable: true, unique: false }
      ],
      rowCount: 1000
    };

    it('should validate a valid transform chain', async () => {
      const result = await service.validateTransformChain(mockOperations, mockSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid field references', async () => {
      const invalidOps = [{
        id: 'op1',
        type: 'filter' as const,
        config: { field: 'nonexistent', operator: 'equals', value: 'test' },
        enabled: true
      }];

      const result = await service.validateTransformChain(invalidOps, mockSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        operationId: 'op1',
        field: 'field',
        code: 'INVALID_FIELD',
        message: expect.stringContaining('Field \'nonexistent\' does not exist')
      });
    });

    it('should validate type compatibility', async () => {
      const incompatibleOps = [{
        id: 'op1',
        type: 'filter' as const,
        config: { field: 'amount', operator: 'contains', value: 'text' },
        enabled: true
      }];

      const result = await service.validateTransformChain(incompatibleOps, mockSchema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({
        code: 'TYPE_MISMATCH',
        message: expect.stringContaining('Type mismatch')
      });
    });

    it('should check operation dependencies', async () => {
      const dependentOps = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { field: 'status', operator: 'equals', value: 'active' },
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { field: 'date', order: 'desc', dependsOn: ['op1'] },
          enabled: true
        }
      ];

      const result = await service.validateTransformChain(dependentOps, mockSchema);

      expect(result.valid).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const circularOps = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { field: 'status', operator: 'equals', value: 'active', dependsOn: ['op2'] },
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { field: 'date', order: 'desc', dependsOn: ['op1'] },
          enabled: true
        }
      ];

      const result = await service.validateTransformChain(circularOps, mockSchema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'CIRCULAR_DEPENDENCY'
        })
      );
    });

    it('should handle empty operations array', async () => {
      const result = await service.validateTransformChain([], mockSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip disabled operations', async () => {
      const opsWithDisabled = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { field: 'nonexistent', operator: 'equals', value: 'test' },
          enabled: false // Disabled operation should be skipped
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { field: 'date', order: 'desc' },
          enabled: true
        }
      ];

      const result = await service.validateTransformChain(opsWithDisabled, mockSchema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateOperation', () => {
    const mockSchema = {
      columns: [
        { name: 'name', type: 'string' as const, nullable: false, unique: false },
        { name: 'age', type: 'number' as const, nullable: true, unique: false },
        { name: 'active', type: 'boolean' as const, nullable: false, unique: false },
        { name: 'created', type: 'date' as const, nullable: false, unique: true }
      ],
      rowCount: 500
    };

    describe('filter operations', () => {
      it('should validate valid filter operation', () => {
        const op = {
          id: 'filter1',
          type: 'filter' as const,
          config: { field: 'name', operator: 'contains', value: 'test' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate numeric operators', () => {
        const op = {
          id: 'filter1',
          type: 'filter' as const,
          config: { field: 'age', operator: 'greater_than', value: 18 },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should reject invalid operators for field type', () => {
        const op = {
          id: 'filter1',
          type: 'filter' as const,
          config: { field: 'age', operator: 'contains', value: 'test' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_OPERATOR');
      });

      it('should validate boolean operators', () => {
        const op = {
          id: 'filter1',
          type: 'filter' as const,
          config: { field: 'active', operator: 'equals', value: true },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should validate date operators', () => {
        const op = {
          id: 'filter1',
          type: 'filter' as const,
          config: { field: 'created', operator: 'after', value: '2024-01-01' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });
    });

    describe('sort operations', () => {
      it('should validate valid sort operation', () => {
        const op = {
          id: 'sort1',
          type: 'sort' as const,
          config: { field: 'name', order: 'asc' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should reject invalid sort order', () => {
        const op = {
          id: 'sort1',
          type: 'sort' as const,
          config: { field: 'name', order: 'invalid' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_CONFIG');
      });

      it('should warn about sorting on unique fields', () => {
        const op = {
          id: 'sort1',
          type: 'sort' as const,
          config: { field: 'created', order: 'desc' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0].code).toBe('SORT_UNIQUE_FIELD');
      });
    });

    describe('rename operations', () => {
      it('should validate valid rename operation', () => {
        const op = {
          id: 'rename1',
          type: 'rename' as const,
          config: { field: 'name', newName: 'fullName' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should reject rename to existing field', () => {
        const op = {
          id: 'rename1',
          type: 'rename' as const,
          config: { field: 'name', newName: 'age' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('DUPLICATE_FIELD');
      });

      it('should reject empty new name', () => {
        const op = {
          id: 'rename1',
          type: 'rename' as const,
          config: { field: 'name', newName: '' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_CONFIG');
      });
    });

    describe('format operations', () => {
      it('should validate valid format operation', () => {
        const op = {
          id: 'format1',
          type: 'format' as const,
          config: { field: 'name', format: 'uppercase' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should validate date formatting', () => {
        const op = {
          id: 'format1',
          type: 'format' as const,
          config: { field: 'created', format: 'YYYY-MM-DD' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should reject format on boolean fields', () => {
        const op = {
          id: 'format1',
          type: 'format' as const,
          config: { field: 'active', format: 'uppercase' },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_FORMAT');
      });
    });

    describe('aggregate operations', () => {
      it('should validate valid aggregate operation', () => {
        const op = {
          id: 'agg1',
          type: 'aggregate' as const,
          config: { 
            groupBy: 'active',
            aggregations: [
              { field: 'age', function: 'avg', alias: 'avgAge' }
            ]
          },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });

      it('should reject non-numeric aggregations', () => {
        const op = {
          id: 'agg1',
          type: 'aggregate' as const,
          config: { 
            groupBy: 'active',
            aggregations: [
              { field: 'name', function: 'sum', alias: 'sumNames' }
            ]
          },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('INVALID_AGGREGATION');
      });

      it('should allow count on any field type', () => {
        const op = {
          id: 'agg1',
          type: 'aggregate' as const,
          config: { 
            groupBy: 'active',
            aggregations: [
              { field: 'name', function: 'count', alias: 'nameCount' }
            ]
          },
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(true);
      });
    });

    describe('unknown operation types', () => {
      it('should reject unknown operation types', () => {
        const op = {
          id: 'unknown1',
          type: 'unknown' as any,
          config: {},
          enabled: true
        };

        const result = service.validateOperation(op, mockSchema);

        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('UNKNOWN_OPERATION');
      });
    });
  });

  describe('checkOperationDependencies', () => {
    it('should detect simple circular dependency', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { dependsOn: ['op2'] },
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { dependsOn: ['op1'] },
          enabled: true
        }
      ];

      const result = await service.checkOperationDependencies(operations);

      expect(result.hasCycles).toBe(true);
      expect(result.errors).toHaveLength(2);
      expect(result.executionOrder).toBeUndefined();
    });

    it('should detect complex circular dependency', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { dependsOn: ['op2'] },
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { dependsOn: ['op3'] },
          enabled: true
        },
        {
          id: 'op3',
          type: 'rename' as const,
          config: { dependsOn: ['op1'] },
          enabled: true
        }
      ];

      const result = await service.checkOperationDependencies(operations);

      expect(result.hasCycles).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should determine correct execution order', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: {},
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: { dependsOn: ['op1'] },
          enabled: true
        },
        {
          id: 'op3',
          type: 'format' as const,
          config: { dependsOn: ['op1', 'op2'] },
          enabled: true
        }
      ];

      const result = await service.checkOperationDependencies(operations);

      expect(result.hasCycles).toBe(false);
      expect(result.executionOrder).toEqual(['op1', 'op2', 'op3']);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle operations with no dependencies', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: {},
          enabled: true
        },
        {
          id: 'op2',
          type: 'sort' as const,
          config: {},
          enabled: true
        }
      ];

      const result = await service.checkOperationDependencies(operations);

      expect(result.hasCycles).toBe(false);
      expect(result.executionOrder).toContain('op1');
      expect(result.executionOrder).toContain('op2');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateBusinessRules', () => {
    const mockSchema = {
      columns: [
        { name: 'ssn', type: 'string' as const, nullable: false, unique: true },
        { name: 'email', type: 'string' as const, nullable: false, unique: false },
        { name: 'created_date', type: 'date' as const, nullable: false, unique: false },
        { name: 'amount', type: 'number' as const, nullable: false, unique: false }
      ],
      rowCount: 1000
    };

    it('should detect PII exposure violations', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'format' as const,
          config: { field: 'ssn', format: 'uppercase' },
          enabled: true
        }
      ];

      const result = await service.validateBusinessRules(operations, mockSchema);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]).toMatchObject({
        rule: 'PII_EXPOSURE',
        severity: 'critical',
        message: expect.stringContaining('sensitive PII data')
      });
    });

    it('should warn about data retention on date filters', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { field: 'created_date', operator: 'before', value: '2020-01-01' },
          enabled: true
        }
      ];

      const result = await service.validateBusinessRules(operations, mockSchema);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatchObject({
        rule: 'DATA_RETENTION',
        message: expect.stringContaining('data retention policies')
      });
    });

    it('should check field sensitivity patterns', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'format' as const,
          config: { field: 'passport_number', format: 'uppercase' },
          enabled: true
        }
      ];

      const sensitiveSchema = {
        columns: [
          { name: 'passport_number', type: 'string' as const, nullable: false, unique: true }
        ],
        rowCount: 100
      };

      const result = await service.validateBusinessRules(operations, sensitiveSchema);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('PII_EXPOSURE');
    });

    it('should check multiple aggregations on large datasets', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'aggregate' as const,
          config: {
            groupBy: 'email',
            aggregations: [
              { field: 'amount', function: 'sum' },
              { field: 'amount', function: 'avg' },
              { field: 'amount', function: 'max' },
              { field: 'amount', function: 'min' }
            ]
          },
          enabled: true
        }
      ];

      const largeSchema = {
        ...mockSchema,
        rowCount: 10000000 // 10 million rows
      };

      const result = await service.validateBusinessRules(operations, largeSchema);

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          rule: 'PERFORMANCE',
          message: expect.stringContaining('performance impact')
        })
      );
    });

    it('should return empty violations for safe operations', async () => {
      const operations = [
        {
          id: 'op1',
          type: 'filter' as const,
          config: { field: 'amount', operator: 'greater_than', value: 100 },
          enabled: true
        }
      ];

      const result = await service.validateBusinessRules(operations, mockSchema);

      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle operations with missing config', () => {
      const op = {
        id: 'op1',
        type: 'filter' as const,
        config: null as any,
        enabled: true
      };

      const schema = {
        columns: [{ name: 'test', type: 'string' as const, nullable: false, unique: false }],
        rowCount: 100
      };

      const result = service.validateOperation(op, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_CONFIG');
    });

    it('should handle schema with no columns', () => {
      const op = {
        id: 'op1',
        type: 'filter' as const,
        config: { field: 'test', operator: 'equals', value: 'value' },
        enabled: true
      };

      const emptySchema = {
        columns: [],
        rowCount: 0
      };

      const result = service.validateOperation(op, emptySchema);

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_FIELD');
    });

    it('should handle null values in filter operations', () => {
      const op = {
        id: 'op1',
        type: 'filter' as const,
        config: { field: 'nullable_field', operator: 'is_null' },
        enabled: true
      };

      const schema = {
        columns: [{ name: 'nullable_field', type: 'string' as const, nullable: true, unique: false }],
        rowCount: 100
      };

      const result = service.validateOperation(op, schema);

      expect(result.valid).toBe(true);
    });

    it('should validate complex aggregate configurations', () => {
      const op = {
        id: 'agg1',
        type: 'aggregate' as const,
        config: {
          groupBy: ['category', 'status'],
          aggregations: [
            { field: 'amount', function: 'sum', alias: 'total' },
            { field: 'count', function: 'avg', alias: 'avgCount' }
          ]
        },
        enabled: true
      };

      const schema = {
        columns: [
          { name: 'category', type: 'string' as const, nullable: false, unique: false },
          { name: 'status', type: 'string' as const, nullable: false, unique: false },
          { name: 'amount', type: 'number' as const, nullable: false, unique: false },
          { name: 'count', type: 'number' as const, nullable: false, unique: false }
        ],
        rowCount: 1000
      };

      const result = service.validateOperation(op, schema);

      expect(result.valid).toBe(true);
    });
  });
});