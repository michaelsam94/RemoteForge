/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  testMatch: ['**/src/test/unit/**/*.test.ts'],
  collectCoverageFrom: ['src/core/**/*.ts', 'src/shared/**/*.ts']
};
