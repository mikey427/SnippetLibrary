import {
  validateField,
  validateForm,
  snippetValidationRules,
  ValidationRule,
} from "../validation";

describe("validation utilities", () => {
  describe("validateField", () => {
    it("validates required fields", () => {
      const rule: ValidationRule = { required: true };

      expect(validateField("", rule)).toBe("This field is required");
      expect(validateField("  ", rule)).toBe("This field is required");
      expect(validateField(null, rule)).toBe("This field is required");
      expect(validateField(undefined, rule)).toBe("This field is required");
      expect(validateField("value", rule)).toBeNull();
    });

    it("validates minimum length", () => {
      const rule: ValidationRule = { minLength: 5 };

      expect(validateField("abc", rule)).toBe("Must be at least 5 characters");
      expect(validateField("abcde", rule)).toBeNull();
      expect(validateField("abcdef", rule)).toBeNull();
    });

    it("validates maximum length", () => {
      const rule: ValidationRule = { maxLength: 5 };

      expect(validateField("abcdef", rule)).toBe(
        "Must be no more than 5 characters"
      );
      expect(validateField("abcde", rule)).toBeNull();
      expect(validateField("abc", rule)).toBeNull();
    });

    it("validates pattern", () => {
      const rule: ValidationRule = { pattern: /^[a-zA-Z]+$/ };

      expect(validateField("abc123", rule)).toBe("Invalid format");
      expect(validateField("abc", rule)).toBeNull();
      expect(validateField("ABC", rule)).toBeNull();
    });

    it("validates custom rules", () => {
      const rule: ValidationRule = {
        custom: (value: string) => {
          if (value === "forbidden") {
            return "This value is not allowed";
          }
          return null;
        },
      };

      expect(validateField("forbidden", rule)).toBe(
        "This value is not allowed"
      );
      expect(validateField("allowed", rule)).toBeNull();
    });

    it("combines multiple validation rules", () => {
      const rule: ValidationRule = {
        required: true,
        minLength: 3,
        maxLength: 10,
        pattern: /^[a-zA-Z]+$/,
      };

      expect(validateField("", rule)).toBe("This field is required");
      expect(validateField("ab", rule)).toBe("Must be at least 3 characters");
      expect(validateField("abcdefghijk", rule)).toBe(
        "Must be no more than 10 characters"
      );
      expect(validateField("abc123", rule)).toBe("Invalid format");
      expect(validateField("abc", rule)).toBeNull();
    });

    it("skips validation for non-required empty fields", () => {
      const rule: ValidationRule = {
        minLength: 5,
        pattern: /^[a-zA-Z]+$/,
      };

      expect(validateField("", rule)).toBeNull();
      expect(validateField(null, rule)).toBeNull();
      expect(validateField(undefined, rule)).toBeNull();
    });
  });

  describe("validateForm", () => {
    it("validates multiple fields", () => {
      const data = {
        title: "",
        description: "Valid description",
        code: "abc",
      };

      const rules = {
        title: { required: true },
        description: { maxLength: 20 }, // Make this longer so it passes
        code: { minLength: 5 },
      };

      const errors = validateForm(data, rules);

      expect(errors.title).toBe("This field is required");
      expect(errors.description).toBeUndefined();
      expect(errors.code).toBe("Must be at least 5 characters");
    });

    it("returns empty object for valid form", () => {
      const data = {
        title: "Valid title",
        description: "Valid description",
      };

      const rules = {
        title: { required: true, maxLength: 50 },
        description: { maxLength: 100 },
      };

      const errors = validateForm(data, rules);

      expect(Object.keys(errors)).toHaveLength(0);
    });
  });

  describe("snippetValidationRules", () => {
    it("validates snippet title", () => {
      const titleRule = snippetValidationRules.title;

      expect(validateField("", titleRule)).toBe("This field is required");
      expect(validateField("a".repeat(101), titleRule)).toBe(
        "Must be no more than 100 characters"
      );
      expect(validateField("Valid title", titleRule)).toBeNull();
    });

    it("validates snippet description", () => {
      const descriptionRule = snippetValidationRules.description;

      expect(validateField("a".repeat(501), descriptionRule)).toBe(
        "Must be no more than 500 characters"
      );
      expect(validateField("Valid description", descriptionRule)).toBeNull();
      expect(validateField("", descriptionRule)).toBeNull(); // Not required
    });

    it("validates snippet code", () => {
      const codeRule = snippetValidationRules.code;

      expect(validateField("", codeRule)).toBe("This field is required");
      expect(validateField("   ", codeRule)).toBe(
        "Code cannot be empty or only whitespace"
      );
      expect(validateField("console.log('test');", codeRule)).toBeNull();
    });

    it("validates snippet language", () => {
      const languageRule = snippetValidationRules.language;

      expect(validateField("", languageRule)).toBe("This field is required");
      expect(validateField("javascript", languageRule)).toBeNull();
    });

    it("validates snippet tags", () => {
      const tagsRule = snippetValidationRules.tags;

      const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
      expect(validateField(tooManyTags, tagsRule)).toBe(
        "Maximum 20 tags allowed"
      );

      const longTagName = ["a".repeat(51)];
      expect(validateField(longTagName, tagsRule)).toBe(
        "Tag names must be 50 characters or less"
      );

      const validTags = ["react", "javascript", "frontend"];
      expect(validateField(validTags, tagsRule)).toBeNull();

      expect(validateField([], tagsRule)).toBeNull();
    });

    it("validates snippet category", () => {
      const categoryRule = snippetValidationRules.category;

      expect(validateField("a".repeat(51), categoryRule)).toBe(
        "Must be no more than 50 characters"
      );
      expect(validateField("utilities", categoryRule)).toBeNull();
      expect(validateField("", categoryRule)).toBeNull(); // Not required
    });

    it("validates snippet prefix", () => {
      const prefixRule = snippetValidationRules.prefix;

      expect(validateField("123invalid", prefixRule)).toBe(
        "Prefix must start with a letter and contain only letters, numbers, hyphens, and underscores"
      );
      expect(validateField("invalid-char$", prefixRule)).toBe(
        "Prefix must start with a letter and contain only letters, numbers, hyphens, and underscores"
      );
      expect(validateField("a".repeat(21), prefixRule)).toBe(
        "Must be no more than 20 characters"
      );

      expect(validateField("validPrefix", prefixRule)).toBeNull();
      expect(validateField("valid_prefix", prefixRule)).toBeNull();
      expect(validateField("valid-prefix", prefixRule)).toBeNull();
      expect(validateField("valid123", prefixRule)).toBeNull();
      expect(validateField("", prefixRule)).toBeNull(); // Not required
    });
  });

  describe("edge cases", () => {
    it("handles non-string values gracefully", () => {
      const rule: ValidationRule = { minLength: 5 };

      expect(validateField(123, rule)).toBeNull();
      expect(validateField([], rule)).toBeNull();
      expect(validateField({}, rule)).toBeNull();
    });

    it("handles undefined rules", () => {
      expect(validateField("test", {})).toBeNull();
    });

    it("handles empty validation rules object", () => {
      const errors = validateForm({ field: "value" }, {});
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
