import { ApiError } from '../utils/ApiError.js';

export function validate(schema, obj) {
  const details = [];
  for (const [field, fn] of Object.entries(schema)) {
    const error = fn(obj[field], obj);
    if (error) details.push({ field, code: error.code, message: error.message });
  }
  if (details.length > 0) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Request validation failed', details);
  }
}

export function isEmail(value) {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return { code: 'INVALID_EMAIL', message: 'A valid email is required' };
  }
  return null;
}

export function requiredString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { code: 'REQUIRED', message: `${label} is required` };
  }
  return null;
}

export function passwordRule(value) {
  if (typeof value !== 'string') {
    return { code: 'REQUIRED', message: 'Password is required' };
  }
  if (value.length < 8 || value.length > 72) {
    return { code: 'INVALID_PASSWORD', message: 'Password must be between 8 and 72 characters' };
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return { code: 'INVALID_PASSWORD', message: 'Password must contain at least one letter and one number' };
  }
  return null;
}

export function optionalString(value, maxLength, label) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    return { code: 'INVALID_TYPE', message: `${label} must be a string` };
  }
  if (value.length > maxLength) {
    return { code: 'TOO_LONG', message: `${label} must be at most ${maxLength} characters` };
  }
  return null;
}

export function totpCode(value) {
  if (typeof value !== 'string') {
    return { code: 'REQUIRED', message: 'Verification code is required' };
  }
  const cleaned = value.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) {
    return { code: 'INVALID_CODE', message: 'Verification code must be 6 digits' };
  }
  return null;
}
