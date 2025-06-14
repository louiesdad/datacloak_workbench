import React, { useState, useCallback } from 'react';
import './TransformOperationEditor.css';
import type { 
  TransformOperation, 
  TableSchema, 
  FilterConfig, 
  SortConfig, 
  SelectConfig, 
  RenameConfig, 
  ComputeConfig, 
  AggregateConfig, 
  JoinConfig, 
  DeduplicateConfig,
  ComparisonOperator,
  AggregateFunction,
  JoinType,
  SortDirection
} from '../types/transforms';
import './TransformOperationEditor.css';

interface TransformOperationEditorProps {
  operation: TransformOperation;
  sourceSchema: TableSchema;
  onOperationChange: (updates: Partial<TransformOperation>) => void;
}

export const TransformOperationEditor: React.FC<TransformOperationEditorProps> = ({
  operation,
  sourceSchema,
  onOperationChange
}) => {
  const [localConfig, setLocalConfig] = useState(operation.config);

  const updateConfig = useCallback((updates: any) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onOperationChange({ config: newConfig });
  }, [localConfig, onOperationChange]);

  const updateName = useCallback((name: string) => {
    onOperationChange({ name });
  }, [onOperationChange]);

  const renderConfigEditor = () => {
    switch (operation.type) {
      case 'filter':
        return <FilterEditor config={localConfig as FilterConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'sort':
        return <SortEditor config={localConfig as SortConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'select':
        return <SelectEditor config={localConfig as SelectConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'rename':
        return <RenameEditor config={localConfig as RenameConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'compute':
        return <ComputeEditor config={localConfig as ComputeConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'aggregate':
        return <AggregateEditor config={localConfig as AggregateConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'join':
        return <JoinEditor config={localConfig as JoinConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      case 'deduplicate':
        return <DeduplicateEditor config={localConfig as DeduplicateConfig} onChange={updateConfig} sourceSchema={sourceSchema} />;
      default:
        return <div className="unsupported-operation">Unsupported operation type: {operation.type}</div>;
    }
  };

  return (
    <div className="transform-operation-editor">
      <div className="operation-header">
        <div className="operation-title">
          <span className="operation-type-badge">{operation.type}</span>
          <input
            type="text"
            value={operation.name}
            onChange={(e) => updateName(e.target.value)}
            className="operation-name-input"
            placeholder="Operation name"
          />
        </div>
      </div>

      <div className="operation-config">
        {renderConfigEditor()}
      </div>
    </div>
  );
};

// Individual config editors

const FilterEditor: React.FC<{
  config: FilterConfig;
  onChange: (updates: Partial<FilterConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const operators: { value: ComparisonOperator; label: string }[] = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_equal', label: 'Greater or Equal' },
    { value: 'less_equal', label: 'Less or Equal' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'regex', label: 'Regex Match' },
    { value: 'is_null', label: 'Is Null' },
    { value: 'is_not_null', label: 'Is Not Null' }
  ];

  const needsValue = !['is_null', 'is_not_null'].includes(config.operator);

  return (
    <div className="filter-editor">
      <div className="form-group">
        <label>Field</label>
        <select
          value={config.field}
          onChange={(e) => onChange({ field: e.target.value })}
        >
          <option value="">Select field...</option>
          {sourceSchema.fields.map(field => (
            <option key={field.name} value={field.name}>
              {field.name} ({field.type})
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Operator</label>
        <select
          value={config.operator}
          onChange={(e) => onChange({ operator: e.target.value as ComparisonOperator })}
        >
          {operators.map(op => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>
      </div>

      {needsValue && (
        <div className="form-group">
          <label>Value</label>
          <input
            type="text"
            value={config.value?.toString() || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Enter comparison value"
          />
          {['contains', 'starts_with', 'ends_with', 'regex'].includes(config.operator) && (
            <div className="form-option">
              <label>
                <input
                  type="checkbox"
                  checked={!config.caseSensitive}
                  onChange={(e) => onChange({ caseSensitive: !e.target.checked })}
                />
                Case insensitive
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SortEditor: React.FC<{
  config: SortConfig;
  onChange: (updates: Partial<SortConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const addSortField = () => {
    onChange({
      fields: [...config.fields, { field: '', direction: 'asc' }]
    });
  };

  const updateSortField = (index: number, updates: Partial<{ field: string; direction: SortDirection }>) => {
    const newFields = [...config.fields];
    newFields[index] = { ...newFields[index], ...updates };
    onChange({ fields: newFields });
  };

  const removeSortField = (index: number) => {
    onChange({
      fields: config.fields.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="sort-editor">
      <div className="sort-fields">
        {config.fields.map((sortField, index) => (
          <div key={index} className="sort-field-row">
            <div className="form-group flex-1">
              <select
                value={sortField.field}
                onChange={(e) => updateSortField(index, { field: e.target.value })}
              >
                <option value="">Select field...</option>
                {sourceSchema.fields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name} ({field.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <select
                value={sortField.direction}
                onChange={(e) => updateSortField(index, { direction: e.target.value as SortDirection })}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <button
              type="button"
              className="remove-button"
              onClick={() => removeSortField(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-button" onClick={addSortField}>
        + Add Sort Field
      </button>
    </div>
  );
};

const SelectEditor: React.FC<{
  config: SelectConfig;
  onChange: (updates: Partial<SelectConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const toggleField = (fieldName: string) => {
    const fields = config.fields.includes(fieldName)
      ? config.fields.filter(f => f !== fieldName)
      : [...config.fields, fieldName];
    onChange({ fields });
  };

  const toggleAll = () => {
    if (config.fields.length === sourceSchema.fields.length) {
      onChange({ fields: [] });
    } else {
      onChange({ fields: sourceSchema.fields.map(f => f.name) });
    }
  };

  return (
    <div className="select-editor">
      <div className="form-group">
        <div className="form-option">
          <label>
            <input
              type="checkbox"
              checked={config.exclude || false}
              onChange={(e) => onChange({ exclude: e.target.checked })}
            />
            Exclude selected fields (instead of include)
          </label>
        </div>
      </div>

      <div className="field-selection">
        <div className="selection-header">
          <button type="button" className="toggle-all-button" onClick={toggleAll}>
            {config.fields.length === sourceSchema.fields.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="selection-count">
            {config.fields.length} of {sourceSchema.fields.length} selected
          </span>
        </div>

        <div className="field-list">
          {sourceSchema.fields.map(field => (
            <div key={field.name} className="field-item">
              <label>
                <input
                  type="checkbox"
                  checked={config.fields.includes(field.name)}
                  onChange={() => toggleField(field.name)}
                />
                <span className="field-name">{field.name}</span>
                <span className="field-type">({field.type})</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RenameEditor: React.FC<{
  config: RenameConfig;
  onChange: (updates: Partial<RenameConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const addMapping = () => {
    onChange({
      mappings: [...config.mappings, { oldName: '', newName: '' }]
    });
  };

  const updateMapping = (index: number, updates: Partial<{ oldName: string; newName: string }>) => {
    const newMappings = [...config.mappings];
    newMappings[index] = { ...newMappings[index], ...updates };
    onChange({ mappings: newMappings });
  };

  const removeMapping = (index: number) => {
    onChange({
      mappings: config.mappings.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="rename-editor">
      <div className="mappings">
        {config.mappings.map((mapping, index) => (
          <div key={index} className="mapping-row">
            <div className="form-group flex-1">
              <label>Original Name</label>
              <select
                value={mapping.oldName}
                onChange={(e) => updateMapping(index, { oldName: e.target.value })}
              >
                <option value="">Select field...</option>
                {sourceSchema.fields.map(field => (
                  <option key={field.name} value={field.name}>
                    {field.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group flex-1">
              <label>New Name</label>
              <input
                type="text"
                value={mapping.newName}
                onChange={(e) => updateMapping(index, { newName: e.target.value })}
                placeholder="Enter new name"
              />
            </div>
            <button
              type="button"
              className="remove-button"
              onClick={() => removeMapping(index)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-button" onClick={addMapping}>
        + Add Rename
      </button>
    </div>
  );
};

const ComputeEditor: React.FC<{
  config: ComputeConfig;
  onChange: (updates: Partial<ComputeConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  return (
    <div className="compute-editor">
      <div className="form-group">
        <label>New Field Name</label>
        <input
          type="text"
          value={config.newField}
          onChange={(e) => onChange({ newField: e.target.value })}
          placeholder="Enter field name"
        />
      </div>

      <div className="form-group">
        <label>Data Type</label>
        <select
          value={config.dataType}
          onChange={(e) => onChange({ dataType: e.target.value as ComputeConfig['dataType'] })}
        >
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="date">Date</option>
        </select>
      </div>

      <div className="form-group">
        <label>Expression</label>
        <textarea
          value={config.expression}
          onChange={(e) => onChange({ expression: e.target.value })}
          placeholder="Enter expression (e.g., column1 + column2)"
          rows={3}
        />
        <div className="expression-help">
          <p><strong>Available fields:</strong> {sourceSchema.fields.map(f => f.name).join(', ')}</p>
          <p><strong>Functions:</strong> UPPER(), LOWER(), CONCAT(), ABS(), ROUND(), etc.</p>
        </div>
      </div>
    </div>
  );
};

const AggregateEditor: React.FC<{
  config: AggregateConfig;
  onChange: (updates: Partial<AggregateConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const functions: { value: AggregateFunction; label: string }[] = [
    { value: 'count', label: 'Count' },
    { value: 'sum', label: 'Sum' },
    { value: 'avg', label: 'Average' },
    { value: 'min', label: 'Minimum' },
    { value: 'max', label: 'Maximum' },
    { value: 'first', label: 'First' },
    { value: 'last', label: 'Last' },
    { value: 'distinct_count', label: 'Distinct Count' }
  ];

  const toggleGroupBy = (fieldName: string) => {
    const groupBy = config.groupBy.includes(fieldName)
      ? config.groupBy.filter(f => f !== fieldName)
      : [...config.groupBy, fieldName];
    onChange({ groupBy });
  };

  const addAggregation = () => {
    onChange({
      aggregations: [...config.aggregations, { field: '', function: 'count' }]
    });
  };

  const updateAggregation = (index: number, updates: Partial<{ field: string; function: AggregateFunction; alias: string }>) => {
    const newAggregations = [...config.aggregations];
    newAggregations[index] = { ...newAggregations[index], ...updates };
    onChange({ aggregations: newAggregations });
  };

  const removeAggregation = (index: number) => {
    onChange({
      aggregations: config.aggregations.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="aggregate-editor">
      <div className="form-group">
        <label>Group By Fields</label>
        <div className="field-list">
          {sourceSchema.fields.map(field => (
            <div key={field.name} className="field-item">
              <label>
                <input
                  type="checkbox"
                  checked={config.groupBy.includes(field.name)}
                  onChange={() => toggleGroupBy(field.name)}
                />
                <span className="field-name">{field.name}</span>
                <span className="field-type">({field.type})</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Aggregations</label>
        <div className="aggregations">
          {config.aggregations.map((agg, index) => (
            <div key={index} className="aggregation-row">
              <div className="form-group flex-1">
                <select
                  value={agg.field}
                  onChange={(e) => updateAggregation(index, { field: e.target.value })}
                >
                  <option value="">Select field...</option>
                  {sourceSchema.fields.map(field => (
                    <option key={field.name} value={field.name}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <select
                  value={agg.function}
                  onChange={(e) => updateAggregation(index, { function: e.target.value as AggregateFunction })}
                >
                  {functions.map(func => (
                    <option key={func.value} value={func.value}>{func.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-1">
                <input
                  type="text"
                  value={agg.alias || ''}
                  onChange={(e) => updateAggregation(index, { alias: e.target.value })}
                  placeholder="Alias (optional)"
                />
              </div>
              <button
                type="button"
                className="remove-button"
                onClick={() => removeAggregation(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="add-button" onClick={addAggregation}>
          + Add Aggregation
        </button>
      </div>
    </div>
  );
};

const JoinEditor: React.FC<{
  config: JoinConfig;
  onChange: (updates: Partial<JoinConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const joinTypes: { value: JoinType; label: string }[] = [
    { value: 'inner', label: 'Inner Join' },
    { value: 'left', label: 'Left Join' },
    { value: 'right', label: 'Right Join' },
    { value: 'full', label: 'Full Outer Join' }
  ];

  const addCondition = () => {
    onChange({
      conditions: [...config.conditions, { leftField: '', rightField: '' }]
    });
  };

  const updateCondition = (index: number, updates: Partial<{ leftField: string; rightField: string }>) => {
    const newConditions = [...config.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange({ conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      conditions: config.conditions.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="join-editor">
      <div className="form-group">
        <label>Right Table</label>
        <input
          type="text"
          value={config.rightTable}
          onChange={(e) => onChange({ rightTable: e.target.value })}
          placeholder="Enter table name"
        />
      </div>

      <div className="form-group">
        <label>Join Type</label>
        <select
          value={config.type}
          onChange={(e) => onChange({ type: e.target.value as JoinType })}
        >
          {joinTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Join Conditions</label>
        <div className="conditions">
          {config.conditions.map((condition, index) => (
            <div key={index} className="condition-row">
              <div className="form-group flex-1">
                <select
                  value={condition.leftField}
                  onChange={(e) => updateCondition(index, { leftField: e.target.value })}
                >
                  <option value="">Select left field...</option>
                  {sourceSchema.fields.map(field => (
                    <option key={field.name} value={field.name}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="join-operator">=</div>
              <div className="form-group flex-1">
                <input
                  type="text"
                  value={condition.rightField}
                  onChange={(e) => updateCondition(index, { rightField: e.target.value })}
                  placeholder="Right field name"
                />
              </div>
              <button
                type="button"
                className="remove-button"
                onClick={() => removeCondition(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="add-button" onClick={addCondition}>
          + Add Condition
        </button>
      </div>
    </div>
  );
};

const DeduplicateEditor: React.FC<{
  config: DeduplicateConfig;
  onChange: (updates: Partial<DeduplicateConfig>) => void;
  sourceSchema: TableSchema;
}> = ({ config, onChange, sourceSchema }) => {
  const toggleField = (fieldName: string) => {
    const fields = config.fields || [];
    const newFields = fields.includes(fieldName)
      ? fields.filter(f => f !== fieldName)
      : [...fields, fieldName];
    onChange({ fields: newFields.length > 0 ? newFields : undefined });
  };

  return (
    <div className="deduplicate-editor">
      <div className="form-group">
        <div className="form-option">
          <label>
            <input
              type="checkbox"
              checked={config.keepFirst !== false}
              onChange={(e) => onChange({ keepFirst: e.target.checked })}
            />
            Keep first occurrence (uncheck to keep last)
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>Fields to Consider for Duplicates</label>
        <p className="field-help">Leave empty to consider all fields</p>
        <div className="field-list">
          {sourceSchema.fields.map(field => (
            <div key={field.name} className="field-item">
              <label>
                <input
                  type="checkbox"
                  checked={(config.fields || []).includes(field.name)}
                  onChange={() => toggleField(field.name)}
                />
                <span className="field-name">{field.name}</span>
                <span className="field-type">({field.type})</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};