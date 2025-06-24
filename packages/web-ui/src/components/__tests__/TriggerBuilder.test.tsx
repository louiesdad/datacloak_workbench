import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { TriggerBuilder } from '../TriggerBuilder';

// Mock the API service
vi.mock('../../services/automationService', () => ({
  automationService: {
    createRule: vi.fn(),
    testRule: vi.fn(),
    getFields: vi.fn(),
    getTemplates: vi.fn(),
    testRuleData: vi.fn()
  }
}));

import { automationService } from '../../services/automationService';
const mockApiService = automationService as any;

describe('TriggerBuilder', () => {
  const defaultProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    existingRule: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService.getFields.mockResolvedValue([
      'customerLifetimeValue',
      'sentimentScore',
      'daysSinceLastOrder',
      'supportTickets'
    ]);
    mockApiService.getTemplates.mockResolvedValue([
      { id: 'customer-at-risk', name: 'Customer at Risk' },
      { id: 'upsell-opportunity', name: 'Upsell Opportunity' }
    ]);
  });

  describe('Initial render', () => {
    test('should display the trigger builder form', async () => {
      render(<TriggerBuilder {...defaultProps} />);

      expect(screen.getByText('Create New Automation Rule')).toBeInTheDocument();
      expect(screen.getByLabelText('Rule Name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Condition' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Action' })).toBeInTheDocument();
    });

    test('should load available fields on mount', async () => {
      render(<TriggerBuilder {...defaultProps} />);

      await waitFor(() => {
        expect(mockApiService.getFields).toHaveBeenCalled();
      });
    });
  });

  describe('Rule name input', () => {
    test('should update rule name when user types', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const nameInput = screen.getByLabelText('Rule Name');
      await user.type(nameInput, 'High-value customer at risk');

      expect(nameInput).toHaveValue('High-value customer at risk');
    });

    test('should show validation error for empty rule name', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const saveButton = screen.getByRole('button', { name: 'Save Rule' });
      await user.click(saveButton);

      expect(screen.getByText('Rule name is required')).toBeInTheDocument();
    });
  });

  describe('Condition builder', () => {
    test('should add new condition when "Add Condition" is clicked', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const addConditionButton = screen.getByRole('button', { name: 'Add Condition' });
      await user.click(addConditionButton);

      await waitFor(() => {
        expect(screen.getByTestId('condition-0')).toBeInTheDocument();
      });
    });

    test('should allow selecting field, operator, and value for condition', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add a condition
      const addConditionButton = screen.getByRole('button', { name: 'Add Condition' });
      await user.click(addConditionButton);

      await waitFor(async () => {
        // Select field
        const fieldSelect = screen.getByTestId('field-select-0');
        await user.selectOptions(fieldSelect, 'customerLifetimeValue');

        // Select operator
        const operatorSelect = screen.getByTestId('operator-select-0');
        await user.selectOptions(operatorSelect, 'greaterThan');

        // Enter value
        const valueInput = screen.getByTestId('value-input-0');
        await user.type(valueInput, '1000');

        expect(fieldSelect).toHaveValue('customerLifetimeValue');
        expect(operatorSelect).toHaveValue('greaterThan');
        expect(valueInput).toHaveValue('1000');
      });
    });

    test('should remove condition when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add a condition
      const addConditionButton = screen.getByRole('button', { name: 'Add Condition' });
      await user.click(addConditionButton);

      await waitFor(async () => {
        expect(screen.getByTestId('condition-0')).toBeInTheDocument();

        // Delete the condition
        const deleteButton = screen.getByTestId('delete-condition-0');
        await user.click(deleteButton);

        expect(screen.queryByTestId('condition-0')).not.toBeInTheDocument();
      });
    });

    test('should allow switching between AND/OR logic', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add two conditions
      const addConditionButton = screen.getByRole('button', { name: 'Add Condition' });
      await user.click(addConditionButton);
      await user.click(addConditionButton);

      await waitFor(async () => {
        expect(screen.getByTestId('condition-0')).toBeInTheDocument();
        expect(screen.getByTestId('condition-1')).toBeInTheDocument();

        // Should show logic selector
        const logicSelect = screen.getByTestId('logic-operator');
        expect(logicSelect).toBeInTheDocument();

        // Switch to OR
        await user.selectOptions(logicSelect, 'OR');
        expect(logicSelect).toHaveValue('OR');
      });
    });
  });

  describe('Action builder', () => {
    test('should add new action when "Add Action" is clicked', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const addActionButton = screen.getByRole('button', { name: 'Add Action' });
      await user.click(addActionButton);

      await waitFor(() => {
        expect(screen.getByTestId('action-0')).toBeInTheDocument();
      });
    });

    test('should allow configuring email action', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add an action
      const addActionButton = screen.getByRole('button', { name: 'Add Action' });
      await user.click(addActionButton);

      await waitFor(async () => {
        // Select email action type
        const typeSelect = screen.getByTestId('action-type-0');
        await user.selectOptions(typeSelect, 'email');

        // Configure email details
        const emailInput = screen.getByTestId('email-to-0');
        await user.type(emailInput, 'manager@company.com');

        const subjectInput = screen.getByTestId('email-subject-0');
        await user.type(subjectInput, 'Customer Alert');

        expect(typeSelect).toHaveValue('email');
        expect(emailInput).toHaveValue('manager@company.com');
        expect(subjectInput).toHaveValue('Customer Alert');
      });
    });

    test('should allow configuring CRM task action', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add an action
      const addActionButton = screen.getByRole('button', { name: 'Add Action' });
      await user.click(addActionButton);

      await waitFor(async () => {
        // Select createTask action type
        const typeSelect = screen.getByTestId('action-type-0');
        await user.selectOptions(typeSelect, 'createTask');

        // Configure task details
        const taskNameInput = screen.getByTestId('task-name-0');
        await user.type(taskNameInput, 'Follow up with customer');

        const prioritySelect = screen.getByTestId('task-priority-0');
        await user.selectOptions(prioritySelect, 'high');

        expect(typeSelect).toHaveValue('createTask');
        expect(taskNameInput).toHaveValue('Follow up with customer');
        expect(prioritySelect).toHaveValue('high');
      });
    });
  });

  describe('Rule testing', () => {
    test('should show test section when conditions and actions are added', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add condition and action
      await user.click(screen.getByRole('button', { name: 'Add Condition' }));
      await user.click(screen.getByRole('button', { name: 'Add Action' }));

      await waitFor(() => {
        expect(screen.getByText('Test This Rule')).toBeInTheDocument();
      });
    });

    test('should allow testing rule with sample data', async () => {
      const user = userEvent.setup();
      mockApiService.testRuleData.mockResolvedValue({
        triggered: true,
        message: 'Rule would trigger for this data'
      });

      render(<TriggerBuilder {...defaultProps} />);

      // Add condition and action first
      await user.click(screen.getByRole('button', { name: 'Add Condition' }));
      await user.click(screen.getByRole('button', { name: 'Add Action' }));

      await waitFor(async () => {
        // Enter test data
        const testDataInput = screen.getByTestId('test-data-input');
        await user.type(testDataInput, JSON.stringify({
          customerId: 'TEST-001',
          customerLifetimeValue: 5000,
          sentimentScore: 30
        }));

        // Test the rule
        const testButton = screen.getByRole('button', { name: 'Test Rule' });
        await user.click(testButton);

        await waitFor(() => {
          expect(mockApiService.testRuleData).toHaveBeenCalled();
          expect(screen.getByText('Rule would trigger for this data')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Rule preview', () => {
    test('should show human-readable rule preview', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      // Add rule name
      const nameInput = screen.getByLabelText('Rule Name');
      await user.type(nameInput, 'High-value customer at risk');

      // Add condition
      await user.click(screen.getByRole('button', { name: 'Add Condition' }));

      await waitFor(async () => {
        const fieldSelect = screen.getByTestId('field-select-0');
        await user.selectOptions(fieldSelect, 'customerLifetimeValue');

        const operatorSelect = screen.getByTestId('operator-select-0');
        await user.selectOptions(operatorSelect, 'greaterThan');

        const valueInput = screen.getByTestId('value-input-0');
        await user.type(valueInput, '1000');

        // Should show preview
        expect(screen.getByText(/When.*customerLifetimeValue.*greater than.*1000/)).toBeInTheDocument();
      });
    });
  });

  describe('Form validation', () => {
    test('should prevent saving rule without conditions', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const nameInput = screen.getByLabelText('Rule Name');
      await user.type(nameInput, 'Test Rule');

      const saveButton = screen.getByRole('button', { name: 'Save Rule' });
      await user.click(saveButton);

      expect(screen.getByText('At least one condition is required')).toBeInTheDocument();
    });

    test('should prevent saving rule without actions', async () => {
      const user = userEvent.setup();
      render(<TriggerBuilder {...defaultProps} />);

      const nameInput = screen.getByLabelText('Rule Name');
      await user.type(nameInput, 'Test Rule');

      // Add condition
      await user.click(screen.getByRole('button', { name: 'Add Condition' }));

      const saveButton = screen.getByRole('button', { name: 'Save Rule' });
      await user.click(saveButton);

      expect(screen.getByText('At least one action is required')).toBeInTheDocument();
    });
  });

  describe('Save functionality', () => {
    test('should call onSave with correct rule data when saved', async () => {
      const user = userEvent.setup();
      mockApiService.createRule.mockResolvedValue({ id: 'rule-123' });

      render(<TriggerBuilder {...defaultProps} />);

      // Fill out the form
      const nameInput = screen.getByLabelText('Rule Name');
      await user.type(nameInput, 'Test Rule');

      // Add condition
      await user.click(screen.getByRole('button', { name: 'Add Condition' }));
      
      await waitFor(async () => {
        const fieldSelect = screen.getByTestId('field-select-0');
        await user.selectOptions(fieldSelect, 'customerLifetimeValue');

        const operatorSelect = screen.getByTestId('operator-select-0');
        await user.selectOptions(operatorSelect, 'greaterThan');

        const valueInput = screen.getByTestId('value-input-0');
        await user.type(valueInput, '1000');
      });

      // Add action
      await user.click(screen.getByRole('button', { name: 'Add Action' }));

      await waitFor(async () => {
        const typeSelect = screen.getByTestId('action-type-0');
        await user.selectOptions(typeSelect, 'email');

        const emailInput = screen.getByTestId('email-to-0');
        await user.type(emailInput, 'test@example.com');
      });

      // Save the rule
      const saveButton = screen.getByRole('button', { name: 'Save Rule' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockApiService.createRule).toHaveBeenCalledWith({
          name: 'Test Rule',
          conditions: {
            operator: 'AND',
            rules: [{
              field: 'customerLifetimeValue',
              operator: 'greaterThan',
              value: 1000
            }]
          },
          actions: [{
            type: 'email',
            config: {
              to: 'test@example.com'
            }
          }],
          isActive: true
        });

        expect(defaultProps.onSave).toHaveBeenCalledWith({ id: 'rule-123' });
      });
    });
  });

  describe('Edit mode', () => {
    test('should load existing rule data when in edit mode', () => {
      const existingRule = {
        id: 'rule-123',
        name: 'Existing Rule',
        conditions: {
          operator: 'AND',
          rules: [{
            field: 'sentimentScore',
            operator: 'lessThan',
            value: 40
          }]
        },
        actions: [{
          type: 'createTask',
          config: {
            taskName: 'Follow up',
            priority: 'medium'
          }
        }],
        isActive: true
      };

      render(<TriggerBuilder {...defaultProps} existingRule={existingRule} />);

      expect(screen.getByDisplayValue('Existing Rule')).toBeInTheDocument();
      expect(screen.getByText('Edit Automation Rule')).toBeInTheDocument();
    });
  });
});