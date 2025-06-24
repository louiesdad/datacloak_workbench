import React, { useState, useEffect } from 'react';
import { automationService, AutomationRule, Condition, Action, TestResult } from '../services/automationService';

interface TriggerBuilderProps {
  onSave: (rule: AutomationRule) => void;
  onCancel: () => void;
  existingRule?: AutomationRule | null;
}

export const TriggerBuilder: React.FC<TriggerBuilderProps> = ({
  onSave,
  onCancel,
  existingRule
}) => {
  const [ruleName, setRuleName] = useState(existingRule?.name || '');
  const [conditions, setConditions] = useState<Condition[]>(
    existingRule?.conditions?.rules || []
  );
  const [logicOperator, setLogicOperator] = useState<'AND' | 'OR'>(
    existingRule?.conditions?.operator || 'AND'
  );
  const [actions, setActions] = useState<Action[]>(existingRule?.actions || []);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testData, setTestData] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAvailableFields();
  }, []);

  const loadAvailableFields = async () => {
    try {
      const fields = await automationService.getFields();
      setAvailableFields(fields);
    } catch (error) {
      console.error('Failed to load fields:', error);
    }
  };

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: '', operator: 'equals', value: '' }
    ]);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([
      ...actions,
      { type: 'email', config: {} }
    ]);
  };

  const updateAction = (index: number, updates: Partial<Action>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!ruleName.trim()) {
      newErrors.ruleName = 'Rule name is required';
    }

    if (conditions.length === 0) {
      newErrors.conditions = 'At least one condition is required';
    }

    if (actions.length === 0) {
      newErrors.actions = 'At least one action is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const ruleData = {
        name: ruleName,
        conditions: {
          operator: logicOperator,
          rules: conditions
        },
        actions,
        isActive: true
      };

      let savedRule: AutomationRule;
      if (existingRule?.id) {
        savedRule = await automationService.updateRule(existingRule.id, ruleData);
      } else {
        savedRule = await automationService.createRule(ruleData);
      }

      onSave(savedRule);
    } catch (error) {
      console.error('Failed to save rule:', error);
      setErrors({ save: 'Failed to save rule. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRule = async () => {
    if (!testData.trim()) return;

    try {
      const parsedTestData = JSON.parse(testData);
      
      const ruleToTest = {
        name: ruleName,
        conditions: {
          operator: logicOperator,
          rules: conditions
        },
        actions,
        isActive: true
      };

      const result = await automationService.testRuleData(ruleToTest, parsedTestData);
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test rule:', error);
      setTestResult({
        triggered: false,
        message: 'Failed to test rule. Please check your test data format.'
      });
    }
  };

  const renderCondition = (condition: Condition, index: number) => (
    <div key={index} data-testid={`condition-${index}`} className="condition-item">
      <select
        data-testid={`field-select-${index}`}
        value={condition.field}
        onChange={(e) => updateCondition(index, { field: e.target.value })}
      >
        <option value="">Select field</option>
        {availableFields.map(field => (
          <option key={field} value={field}>{field}</option>
        ))}
      </select>

      <select
        data-testid={`operator-select-${index}`}
        value={condition.operator}
        onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
      >
        <option value="equals">equals</option>
        <option value="notEquals">not equals</option>
        <option value="greaterThan">greater than</option>
        <option value="lessThan">less than</option>
        <option value="greaterThanOrEquals">greater than or equals</option>
        <option value="lessThanOrEquals">less than or equals</option>
      </select>

      <input
        data-testid={`value-input-${index}`}
        type="text"
        value={condition.value}
        onChange={(e) => {
          const value = isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value);
          updateCondition(index, { value });
        }}
        placeholder="Value"
      />

      <button
        data-testid={`delete-condition-${index}`}
        onClick={() => removeCondition(index)}
        type="button"
      >
        Delete
      </button>
    </div>
  );

  const renderAction = (action: Action, index: number) => (
    <div key={index} data-testid={`action-${index}`} className="action-item">
      <select
        data-testid={`action-type-${index}`}
        value={action.type}
        onChange={(e) => updateAction(index, { type: e.target.value as any, config: {} })}
      >
        <option value="email">Email</option>
        <option value="createTask">Create Task</option>
        <option value="slack">Slack</option>
        <option value="webhook">Webhook</option>
      </select>

      {action.type === 'email' && (
        <>
          <input
            data-testid={`email-to-${index}`}
            type="email"
            placeholder="To email"
            value={action.config.to || ''}
            onChange={(e) => updateAction(index, {
              config: { ...action.config, to: e.target.value }
            })}
          />
          <input
            data-testid={`email-subject-${index}`}
            type="text"
            placeholder="Subject"
            value={action.config.subject || ''}
            onChange={(e) => updateAction(index, {
              config: { ...action.config, subject: e.target.value }
            })}
          />
        </>
      )}

      {action.type === 'createTask' && (
        <>
          <input
            data-testid={`task-name-${index}`}
            type="text"
            placeholder="Task name"
            value={action.config.taskName || ''}
            onChange={(e) => updateAction(index, {
              config: { ...action.config, taskName: e.target.value }
            })}
          />
          <select
            data-testid={`task-priority-${index}`}
            value={action.config.priority || 'medium'}
            onChange={(e) => updateAction(index, {
              config: { ...action.config, priority: e.target.value }
            })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </>
      )}

      <button onClick={() => removeAction(index)} type="button">
        Delete
      </button>
    </div>
  );

  const generateRulePreview = () => {
    if (conditions.length === 0) return '';

    const conditionTexts = conditions.map(condition => {
      if (!condition.field || !condition.operator || condition.value === '') {
        return '';
      }
      return `${condition.field} ${condition.operator} ${condition.value}`;
    }).filter(Boolean);

    if (conditionTexts.length === 0) return '';

    const operator = logicOperator.toLowerCase();
    const conditionsText = conditionTexts.join(` ${operator} `);
    
    return `When ${conditionsText}`;
  };

  const showTestSection = conditions.length > 0 && actions.length > 0;

  return (
    <div className="trigger-builder">
      <h2>{existingRule ? 'Edit Automation Rule' : 'Create New Automation Rule'}</h2>
      
      <div className="form-section">
        <label htmlFor="rule-name">Rule Name</label>
        <input
          id="rule-name"
          type="text"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
          placeholder="Enter rule name"
        />
        {errors.ruleName && <div className="error">{errors.ruleName}</div>}
      </div>

      <div className="form-section">
        <h3>Conditions</h3>
        {conditions.map(renderCondition)}
        
        {conditions.length > 1 && (
          <select
            data-testid="logic-operator"
            value={logicOperator}
            onChange={(e) => setLogicOperator(e.target.value as 'AND' | 'OR')}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        )}
        
        <button onClick={addCondition} type="button">Add Condition</button>
        {errors.conditions && <div className="error">{errors.conditions}</div>}
      </div>

      <div className="form-section">
        <h3>Actions</h3>
        {actions.map(renderAction)}
        <button onClick={addAction} type="button">Add Action</button>
        {errors.actions && <div className="error">{errors.actions}</div>}
      </div>

      {generateRulePreview() && (
        <div className="form-section">
          <h3>Rule Preview</h3>
          <div className="rule-preview">{generateRulePreview()}</div>
        </div>
      )}

      {showTestSection && (
        <div className="form-section">
          <h3>Test This Rule</h3>
          <textarea
            data-testid="test-data-input"
            value={testData}
            onChange={(e) => setTestData(e.target.value)}
            placeholder='Enter test data as JSON, e.g. {"customerId": "TEST-001", "customerLifetimeValue": 5000}'
            rows={4}
          />
          <button onClick={handleTestRule} type="button">Test Rule</button>
          
          {testResult && (
            <div className="test-result">
              {testResult.message}
            </div>
          )}
        </div>
      )}

      <div className="form-actions">
        <button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Rule'}
        </button>
        <button onClick={onCancel} type="button">Cancel</button>
        {errors.save && <div className="error">{errors.save}</div>}
      </div>
    </div>
  );
};