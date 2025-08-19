export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface ValidationErrors {
  [key: string]: string;
}

export const validateField = (
  value: any,
  rules: ValidationRule
): string | null => {
  // Check custom validation first (it can handle required logic)
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  if (
    rules.required &&
    (!value || (typeof value === "string" && !value.trim()))
  ) {
    return "This field is required";
  }

  if (value && typeof value === "string") {
    if (rules.minLength && value.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `Must be no more than ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return "Invalid format";
    }
  }

  return null;
};

export const validateForm = (
  data: Record<string, any>,
  rules: Record<string, ValidationRule>
): ValidationErrors => {
  const errors: ValidationErrors = {};

  Object.keys(rules).forEach((field) => {
    const error = validateField(data[field], rules[field]);
    if (error) {
      errors[field] = error;
    }
  });

  return errors;
};

// Snippet-specific validation rules
export const snippetValidationRules = {
  title: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  description: {
    maxLength: 500,
  },
  code: {
    required: true,
    minLength: 1,
    custom: (value: string) => {
      if (value && value.trim().length === 0) {
        return "Code cannot be empty or only whitespace";
      }
      return null;
    },
  },
  language: {
    required: true,
  },
  tags: {
    custom: (value: string[]) => {
      if (value && value.length > 20) {
        return "Maximum 20 tags allowed";
      }
      if (value && value.some((tag: string) => tag.length > 50)) {
        return "Tag names must be 50 characters or less";
      }
      return null;
    },
  },
  category: {
    maxLength: 50,
  },
  prefix: {
    maxLength: 20,
    custom: (value: string) => {
      if (value && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(value)) {
        return "Prefix must start with a letter and contain only letters, numbers, hyphens, and underscores";
      }
      return null;
    },
  },
};
