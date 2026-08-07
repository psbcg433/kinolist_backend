import assert from 'node:assert/strict';
import { validateProfileUpdate } from '../src/validators/profile.validator.js';
import { ApiError } from '../src/utils/ApiError.js';
import { sniffImage } from '../src/validators/upload.validator.js';

function assertValidation(fn, message) {
  try {
    fn();
    assert.fail(`expected ApiError: ${message}`);
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${err.name}: ${err.message}`);
    assert.equal(err.status, 400);
  }
}

const tests = {
  'accepts only name and bio': () => {
    const payload = validateProfileUpdate({
      name: '  Alice  ',
      bio: 'Film lover',
      email: 'hacker@example.com',
      password: 'should-not-be-stored',
      role: 'ADMIN',
      tokenVersion: 99,
      userId: 'someone-elses-id',
      profilePicUrl: 'https://evil.example/x.png',
    });
    assert.deepEqual(payload, { name: 'Alice', bio: 'Film lover' });
  },

  'trims name and bio': () => {
    const payload = validateProfileUpdate({ name: '   ', bio: '' });
    assert.deepEqual(payload, { name: '', bio: '' });
  },

  'rejects over-long name': () => {
    assertValidation(
      () => validateProfileUpdate({ name: 'x'.repeat(101) }),
      'name over 100 chars'
    );
  },

  'rejects over-long bio': () => {
    assertValidation(
      () => validateProfileUpdate({ bio: 'x'.repeat(501) }),
      'bio over 500 chars'
    );
  },

  'rejects non-string values': () => {
    assertValidation(
      () => validateProfileUpdate({ name: 123 }),
      'non-string name'
    );
  },

  'empty body returns empty payload': () => {
    assert.deepEqual(validateProfileUpdate({}), {});
    assert.deepEqual(validateProfileUpdate(undefined), {});
  },

  'sniffImage detects JPEG/PNG/GIF/WEBP': () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0, 0, 0, 0, 0]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    const text = Buffer.from('not-an-image-at-all!!');
    assert.ok(sniffImage(jpeg));
    assert.ok(sniffImage(png));
    assert.ok(sniffImage(gif));
    assert.ok(sniffImage(webp));
    assert.ok(!sniffImage(text));
    assert.ok(!sniffImage(Buffer.alloc(4)));
  },
};

for (const [name, fn] of Object.entries(tests)) {
  await fn();
  console.log(`PASS ${name}`);
}
console.log(`OK ${Object.keys(tests).length} tests passed`);
