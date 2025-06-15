import React, { useState, useEffect } from 'react';
import type { ValidationError, ValidationRule } from '../utils/errorHandling';
import { ValidationUtils } from '../utils/errorHandling';
import './FormField.css';

interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'file' | 'checkbox';
  value?: any;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ value: string; label: string }>;
  multiple?: boolean;
  accept?: string;
  rows?: number;
  validationRules?: ValidationRule[];
  onChange?: (value: any) => void;
  onBlur?: () => void;
  className?: string;
  helpText?: string;
  maxFileSize?: number; // in GB
  allowedFileTypes?: string[];
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  type = 'text',
  value = '',
  placeholder,
  required = false,
  disabled = false,
  options = [],
  multiple = false,
  accept,
  rows = 3,
  validationRules = [],
  onChange,
  onBlur,
  className = '',
  helpText,
  maxFileSize = 50,
  allowedFileTypes = ['.csv', '.xlsx', '.xls', '.tsv']
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  // Update internal value when prop changes
  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
  }, [value]);

  // Build validation rules based on props
  const buildValidationRules = (): ValidationRule[] => {
    const rules: ValidationRule[] = [...validationRules];

    if (required) {
      rules.push({ field: name, type: 'required' });
    }

    if (type === 'email') {
      rules.push({ field: name, type: 'email' });
    }

    return rules;
  };

  // Validate field value
  const validateField = (fieldValue: any): ValidationError[] => {
    const rules = buildValidationRules();
    const fieldErrors: ValidationError[] = [];

    // File-specific validation
    if (type === 'file' && fieldValue) {
      const files = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
      
      for (const file of files) {
        if (file instanceof File) {
          const sizeError = ValidationUtils.validateFileSize(file, maxFileSize);
          if (sizeError) fieldErrors.push(sizeError);

          const typeError = ValidationUtils.validateFileType(file, allowedFileTypes);
          if (typeError) fieldErrors.push(typeError);
        }
      }
    }

    // Standard validation rules
    for (const rule of rules) {
      const error = validateSingleRule(fieldValue, rule);
      if (error) fieldErrors.push(error);
    }

    return fieldErrors;
  };

  const validateSingleRule = (fieldValue: any, rule: ValidationRule): ValidationError | null => {
    switch (rule.type) {
      case 'required':
        return ValidationUtils.validateRequired(fieldValue, label);
      case 'email':
        return fieldValue ? ValidationUtils.validateEmail(fieldValue) : null;
      case 'minLength':
        return fieldValue && rule.minLength 
          ? ValidationUtils.validateMinLength(fieldValue, rule.minLength, label) 
          : null;
      case 'maxLength':
        return fieldValue && rule.maxLength 
          ? ValidationUtils.validateMaxLength(fieldValue, rule.maxLength, label) 
          : null;
      case 'range':
        return typeof fieldValue === 'number' && rule.min !== undefined && rule.max !== undefined
          ? ValidationUtils.validateRange(fieldValue, rule.min, rule.max, label)
          : null;
      case 'custom':
        return rule.validator ? rule.validator(fieldValue, name) : null;
      default:
        return null;
    }
  };

  // Handle value change
  const handleChange = (newValue: any) => {
    setInternalValue(newValue);
    
    // Validate on change if field has been touched
    if (touched) {
      const fieldErrors = validateField(newValue);
      setErrors(fieldErrors);
    }

    if (onChange) {
      onChange(newValue);
    }
  };

  // Handle blur event
  const handleBlur = () => {
    setTouched(true);
    setFocused(false);
    
    // Validate on blur
    const fieldErrors = validateField(internalValue);
    setErrors(fieldErrors);

    if (onBlur) {
      onBlur();
    }
  };

  // Handle focus event
  const handleFocus = () => {
    setFocused(true);
  };

  // Render different input types
  const renderInput = () => {
    const commonProps = {
      name,
      disabled,
      onFocus: handleFocus,
      onBlur: handleBlur,
      className: `form-input ${errors.length > 0 ? 'error' : ''} ${focused ? 'focused' : ''}`,
      'aria-describedby': `${name}-help ${name}-error`,
      'aria-invalid': errors.length > 0
    };

    switch (type) {
      case 'select':
        return (
          <select
            {...commonProps}
            value={internalValue}
            onChange={(e) => handleChange(e.target.value)}
            multiple={multiple}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'textarea':
        return (
          <textarea
            {...commonProps}
            value={internalValue}
            placeholder={placeholder}
            rows={rows}
            onChange={(e) => handleChange(e.target.value)}
          />
        );

      case 'file':
        return (
          <input
            {...commonProps}
            type="file"
            accept={accept || allowedFileTypes.join(',')}
            multiple={multiple}
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                const fileArray = Array.from(files);
                handleChange(multiple ? fileArray : fileArray[0]);
              }
            }}
          />
        );

      case 'checkbox':
        return (
          <label className="checkbox-wrapper">
            <input
              {...commonProps}
              type="checkbox"
              checked={!!internalValue}
              onChange={(e) => handleChange(e.target.checked)}
              className="checkbox-input"
            />
            <span className="checkbox-label">{label}</span>
          </label>
        );

      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            value={internalValue}
            placeholder={placeholder}
            onChange={(e) => handleChange(parseFloat(e.target.value) || '')}
          />
        );

      default:
        return (
          <input
            {...commonProps}
            type={type}
            value={internalValue}
            placeholder={placeholder}
            onChange={(e) => handleChange(e.target.value)}
          />
        );
    }
  };

  const hasErrors = errors.length > 0;
  const showErrors = touched && hasErrors;

  if (type === 'checkbox') {
    return (
      <div className={`form-field checkbox-field ${className} ${showErrors ? 'has-error' : ''}`}>
        {renderInput()}
        {showErrors && (
          <div id={`${name}-error`} className="field-errors" role="alert">
            {errors.map((error, index) => (
              <span key={index} className="error-message">
                {error.message}
              </span>
            ))}
          </div>
        )}
        {helpText && (
          <div id={`${name}-help`} className="field-help">
            {helpText}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`form-field ${className} ${showErrors ? 'has-error' : ''} ${focused ? 'focused' : ''}`}>
      <label htmlFor={name} className="field-label">
        {label}
        {required && <span className="required-indicator" aria-label="required">*</span>}
      </label>

      <div className="field-input-wrapper">
        {renderInput()}
        
        {type === 'file' && (
          <div className="file-constraints">
            <span>Max size: {maxFileSize}GB</span>
            <span>Allowed: {allowedFileTypes.join(', ')}</span>
          </div>
        )}
      </div>

      {helpText && (
        <div id={`${name}-help`} className="field-help">
          {helpText}
        </div>
      )}

      {showErrors && (
        <div id={`${name}-error`} className="field-errors" role="alert">
          {errors.map((error, index) => (
            <span key={index} className="error-message">
              {error.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// Hook for managing form state with validation
export const useFormState = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRule[]> = {}
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, ValidationError[]>>({} as Record<keyof T, ValidationError[]>);
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  const setValue = (field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Validate field if it has been touched
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const setFieldTouched = (field: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  };

  const validateField = (field: keyof T, value: any) => {
    const rules = validationRules[field] || [];
    const fieldErrors: ValidationError[] = [];

    for (const rule of rules) {
      const error = ValidationUtils.validateForm({ [field]: value }, [rule]);
      fieldErrors.push(...error);
    }

    setErrors(prev => ({ ...prev, [field]: fieldErrors }));
    return fieldErrors.length === 0;
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors: Record<keyof T, ValidationError[]> = {} as Record<keyof T, ValidationError[]>;

    for (const field in values) {
      const rules = validationRules[field] || [];
      const fieldErrors: ValidationError[] = [];

      for (const rule of rules) {
        const error = ValidationUtils.validateForm({ [field]: values[field] }, [rule]);
        fieldErrors.push(...error);
      }

      newErrors[field] = fieldErrors;
      if (fieldErrors.length > 0) {
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, ValidationError[]>);
    setTouched({} as Record<keyof T, boolean>);
  };

  const getFieldError = (field: keyof T): string | null => {
    const fieldErrors = errors[field];
    return fieldErrors && fieldErrors.length > 0 ? fieldErrors[0].message : null;
  };

  const hasErrors = Object.values(errors).some(fieldErrors => fieldErrors.length > 0);

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField,
    validateForm,
    resetForm,
    getFieldError,
    hasErrors
  };
};