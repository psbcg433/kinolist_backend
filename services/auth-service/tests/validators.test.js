import test from 'node:test';
import assert from 'node:assert/strict';
import './env-setup.mjs';
import {
  validateRegister,
  validateLogin,
  validateTwoFactorLogin,
  validateTwoFactorSetup,
  validateTwoFactorSetupVerify,
  validateDeleteAccount,
} from '../src/validators/auth.validator.js';
import { ApiError } from '../src/utils/ApiError.js';

function expectValidationError(fn) {
  assert.throws(fn, (err) => err instanceof ApiError && err.code === 'VALIDATION_FAILED');
}

test('register accepts valid payload', () => {
  assert.doesNotThrow(() => validateRegister({ email: 'User@Example.com', password: 'password1' }));
  assert.doesNotThrow(() => validateRegister({ email: 'a@b.co', password: 'password1', name: 'A' }));
});

test('register rejects bad email', () => {
  expectValidationError(() => validateRegister({ email: 'not-an-email', password: 'password1' }));
});

test('register rejects weak password', () => {
  expectValidationError(() => validateRegister({ email: 'a@b.co', password: 'short' }));
  expectValidationError(() => validateRegister({ email: 'a@b.co', password: 'onlyletters' }));
});

test('login requires email and password', () => {
  assert.doesNotThrow(() => validateLogin({ email: 'a@b.co', password: 'whatever' }));
  expectValidationError(() => validateLogin({ email: 'a@b.co' }));
  expectValidationError(() => validateLogin({ password: 'whatever' }));
});

test('2fa login requires challengeId and 6-digit code', () => {
  assert.doesNotThrow(() => validateTwoFactorLogin({ challengeId: 'abc', code: '123456' }));
  expectValidationError(() => validateTwoFactorLogin({ challengeId: 'abc', code: '12345' }));
  expectValidationError(() => validateTwoFactorLogin({ code: '123456' }));
});

test('setup verify requires challengeId and 6-digit code', () => {
  assert.doesNotThrow(() => validateTwoFactorSetupVerify({ challengeId: 'abc', code: '123456' }));
  expectValidationError(() => validateTwoFactorSetupVerify({ challengeId: 'abc', code: '12a456' }));
  expectValidationError(() => validateTwoFactorSetupVerify({ code: '123456' }));
});

test('2fa setup requires current password reauthentication', () => {
  assert.doesNotThrow(() => validateTwoFactorSetup({ password: 'my-password' }));
  expectValidationError(() => validateTwoFactorSetup({}));
  expectValidationError(() => validateTwoFactorSetup({ password: '' }));
});

test('delete account requires a password', () => {
  assert.doesNotThrow(() => validateDeleteAccount({ password: 'my-password' }));
  expectValidationError(() => validateDeleteAccount({}));
  expectValidationError(() => validateDeleteAccount({ password: '' }));
});
