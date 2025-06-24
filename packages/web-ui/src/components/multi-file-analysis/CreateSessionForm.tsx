import React, { useState } from 'react';
import { multiFileAnalysisApi } from '../../services/api';

interface CreateSessionFormProps {
  onSuccess?: (session: { sessionId: string; createdAt: string }) => void;
}

interface FormData {
  name: string;
  description: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  general?: string;
}

export const CreateSessionForm: React.FC<CreateSessionFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: ''
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = 'Session name is required';
    } else if (trimmedName.length >= 255) {
      newErrors.name = 'Session name must be less than 255 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }

    // Check character limit for name
    if (field === 'name' && value.length >= 255) {
      setErrors(prev => ({ ...prev, name: 'Session name must be less than 255 characters' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await multiFileAnalysisApi.createSession({
        name: formData.name.trim(),
        description: formData.description.trim()
      });

      // Reset form
      setFormData({ name: '', description: '' });

      // Call success callback
      onSuccess?.(response);
    } catch (error) {
      setErrors({
        general: 'Failed to create session. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-session-form">
      <div className="form-group">
        <label htmlFor="session-name">Session Name</label>
        <input
          id="session-name"
          type="text"
          value={formData.name}
          onChange={handleInputChange('name')}
          disabled={isSubmitting}
          className={errors.name ? 'error' : ''}
          maxLength={300} // Allow some buffer for validation message
        />
        {errors.name && <span className="error-message">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="session-description">Description</label>
        <textarea
          id="session-description"
          value={formData.description}
          onChange={handleInputChange('description')}
          disabled={isSubmitting}
          rows={4}
        />
        {errors.description && <span className="error-message">{errors.description}</span>}
      </div>

      {errors.general && (
        <div className="error-message general-error">{errors.general}</div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="submit-button"
      >
        {isSubmitting ? 'Creating...' : 'Create Session'}
      </button>
    </form>
  );
};