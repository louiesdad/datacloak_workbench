import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField } from '../FormField';

describe('FormField', () => {
  const user = userEvent.setup();

  it('should render text input field', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
  });

  it('should render select field', () => {
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ];

    render(
      <FormField
        label="Select Option"
        type="select"
        name="option"
        value=""
        onChange={vi.fn()}
        options={options}
      />
    );

    expect(screen.getByLabelText('Select Option')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should render textarea field', () => {
    render(
      <FormField
        label="Description"
        type="textarea"
        name="description"
        value=""
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render checkbox field', () => {
    render(
      <FormField
        label="Accept Terms"
        type="checkbox"
        name="terms"
        checked={false}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Accept Terms')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('should handle input changes', async () => {
    const onChange = vi.fn();

    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'test@example.com');

    expect(onChange).toHaveBeenCalled();
  });

  it('should show validation error', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
        error="Invalid email format"
      />
    );

    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should show help text', () => {
    render(
      <FormField
        label="Password"
        type="password"
        name="password"
        value=""
        onChange={vi.fn()}
        helpText="Must be at least 8 characters"
      />
    );

    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('should mark required fields', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
        required
      />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('required');
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should apply custom className', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
        className="custom-field"
      />
    );

    const fieldContainer = screen.getByLabelText('Email').closest('.form-field');
    expect(fieldContainer).toHaveClass('custom-field');
  });

  it('should handle placeholder text', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
        placeholder="Enter your email"
      />
    );

    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
  });

  it('should associate label with input', () => {
    render(
      <FormField
        label="Email"
        type="email"
        name="email"
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox');
    const label = screen.getByText('Email');
    
    expect(input).toHaveAttribute('id');
    expect(label).toHaveAttribute('for', input.getAttribute('id'));
  });

  it('should handle number input', async () => {
    const onChange = vi.fn();

    render(
      <FormField
        label="Age"
        type="number"
        name="age"
        value=""
        onChange={onChange}
        min={0}
        max={120}
      />
    );

    const input = screen.getByRole('spinbutton');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '120');

    await user.type(input, '25');
    expect(onChange).toHaveBeenCalled();
  });

  it('should handle select changes', async () => {
    const onChange = vi.fn();
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' }
    ];

    render(
      <FormField
        label="Select Option"
        type="select"
        name="option"
        value=""
        onChange={onChange}
        options={options}
      />
    );

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'option1');

    expect(onChange).toHaveBeenCalled();
  });

  it('should handle checkbox changes', async () => {
    const onChange = vi.fn();

    render(
      <FormField
        label="Accept Terms"
        type="checkbox"
        name="terms"
        checked={false}
        onChange={onChange}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(onChange).toHaveBeenCalled();
  });
});