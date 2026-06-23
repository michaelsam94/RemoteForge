module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.test.json'],
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
  env: {
    es2022: true,
    node: true,
    jest: true
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage']
};
