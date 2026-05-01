/** @type {import('jest').Config} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/e2e"],
    testMatch: ["**/*.e2e.test.ts"],
    modulePathIgnorePatterns: ["<rootDir>/dist/"],
};
