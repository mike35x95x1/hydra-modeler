// jest.config.cjs
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  // optional: pick up both .spec.ts and .test.ts anywhere under src
  testMatch: ['**/?(*.)+(spec|test).ts'],
};
