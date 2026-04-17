const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: ["src/lib/**/*.ts"],
  coveragePathIgnorePatterns: ["<rootDir>/src/lib/utils.ts"],
};

module.exports = createJestConfig(customJestConfig);
