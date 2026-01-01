const DEFAULT_EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

/**
 * Validates and sanitizes a payload against a simple schema definition.
 * Returns the cleaned values plus an array of error strings.
 */
export const validatePayload = (payload, schema) => {
  const errors = [];
  const cleaned = {};

  Object.entries(schema).forEach(([key, rules]) => {
    let value = payload[key];

    if (rules.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
      return;
    }

    if (value === undefined || value === null) return;

    if (rules.type === "string") {
      if (typeof value !== "string") {
        errors.push(`${key} must be a string`);
        return;
      }
      const raw = rules.trim === false ? value : value.trim();
      if (rules.notEmpty && !raw) {
        errors.push(`${key} cannot be empty`);
        return;
      }
      if (rules.minLength && raw.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && raw.length > rules.maxLength) {
        errors.push(`${key} must be at most ${rules.maxLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(raw)) {
        errors.push(`${key} has an invalid format`);
      }
      value = raw;
    }

    if (rules.oneOf && !rules.oneOf.includes(value)) {
      errors.push(`${key} must be one of: ${rules.oneOf.join(", ")}`);
    }

    if (typeof rules.custom === "function") {
      const customError = rules.custom(value);
      if (customError) errors.push(customError);
    }

    cleaned[key] = value;
  });

  return { errors, cleaned };
};

export const emailRule = {
  type: "string",
  notEmpty: true,
  maxLength: 254,
  pattern: DEFAULT_EMAIL_REGEX,
};

export const passwordRule = {
  type: "string",
  notEmpty: true,
  minLength: 8,
  maxLength: 128,
  trim: false,
  custom: (value) =>
    value.trim().length < 8
      ? "password must be at least 8 non-space characters"
      : null,
};

export const otpRule = {
  type: "string",
  notEmpty: true,
  minLength: 4,
  maxLength: 12,
  pattern: /^[0-9]+$/,
};

export const usnRule = {
  type: "string",
  notEmpty: true,
  minLength: 3,
  maxLength: 32,
};
