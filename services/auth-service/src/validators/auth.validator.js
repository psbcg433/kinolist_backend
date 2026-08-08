import { validate, isEmail, requiredString, passwordRule, optionalString, totpCode } from './validate.js';

export const registerSchema = {
  email: isEmail,
  password: passwordRule,
  name: (v) => optionalString(v, 100, 'Name'),
};

export const loginSchema = {
  email: isEmail,
  password: (v) => requiredString(v, 'Password'),
};

export const twoFactorLoginSchema = {
  challengeId: (v) => requiredString(v, 'challengeId'),
  code: totpCode,
};

export const twoFactorSetupVerifySchema = {
  challengeId: (v) => requiredString(v, 'challengeId'),
  code: totpCode,
};

export const twoFactorSetupSchema = {
  password: (v) => requiredString(v, 'Password'),
};

export const twoFactorResetSchema = {
  password: (v) => requiredString(v, 'Password'),
};

export const deleteAccountSchema = {
  password: (v) => requiredString(v, 'Password'),
};

export function validateRegister(body) {
  return validate(registerSchema, body);
}

export function validateLogin(body) {
  return validate(loginSchema, body);
}

export function validateTwoFactorLogin(body) {
  return validate(twoFactorLoginSchema, body);
}

export function validateTwoFactorSetupVerify(body) {
  return validate(twoFactorSetupVerifySchema, body);
}

export function validateTwoFactorSetup(body) {
  return validate(twoFactorSetupSchema, body);
}

export function validateTwoFactorReset(body) {
  return validate(twoFactorResetSchema, body);
}

export function validateDeleteAccount(body) {
  return validate(deleteAccountSchema, body);
}
