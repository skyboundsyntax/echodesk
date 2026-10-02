/**
 * ECHODESK — Zero-Dependency Test Runner
 * Provides describe, it, expect, and assertion helpers for browser and headless testing.
 */

class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      passed: 0,
      failed: 0,
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    try {
      fn();
    } catch (err) {
      console.error(`Error executing suite "${name}":`, err);
    }
    this.currentSuite = null;
  }

  it(name, testFn) {
    if (!this.currentSuite) {
      throw new Error(`"it" must be called inside a "describe" block.`);
    }
    this.currentSuite.tests.push({ name, testFn });
  }

  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} (${typeof expected}), but got ${JSON.stringify(actual)} (${typeof actual})`);
        }
      },
      toEqual: (expected) => {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
          throw new Error(`Expected deep equality:\nExpected: ${expectedStr}\nActual:   ${actualStr}`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (!(actual > expected)) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual: (expected) => {
        if (!(actual >= expected)) {
          throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
        }
      },
      toBeCloseTo: (expected, delta = 50) => {
        if (Math.abs(actual - expected) > delta) {
          throw new Error(`Expected ${actual} to be close to ${expected} within delta ±${delta}`);
        }
      },
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected truthy value, but received ${actual}`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value, but received ${actual}`);
        }
      },
      toThrow: (expectedMsgSubstring = '') => {
        if (typeof actual !== 'function') {
          throw new Error(`Expected a function to test for exceptions, received ${typeof actual}`);
        }
        let threw = false;
        let thrownError = null;
        try {
          actual();
        } catch (err) {
          threw = true;
          thrownError = err;
        }
        if (!threw) {
          throw new Error(`Expected function to throw an error, but it did not throw.`);
        }
        if (expectedMsgSubstring && !thrownError.message.includes(expectedMsgSubstring)) {
          throw new Error(`Expected error message to include "${expectedMsgSubstring}", but caught: "${thrownError.message}"`);
        }
      },
      toBeNull: () => {
        if (actual !== null) {
          throw new Error(`Expected null, but received ${actual}`);
        }
      },
    };
  }

  async run() {
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;

    const results = [];

    for (const suite of this.suites) {
      const suiteResult = {
        name: suite.name,
        tests: [],
        passed: 0,
        failed: 0,
      };

      for (const test of suite.tests) {
        this.totalTests++;
        const testResult = {
          name: test.name,
          passed: false,
          error: null,
          durationMs: 0,
        };

        const startTime = performance.now();
        try {
          await test.testFn();
          testResult.passed = true;
          suiteResult.passed++;
          this.passedTests++;
        } catch (err) {
          testResult.passed = false;
          testResult.error = err.message || String(err);
          suiteResult.failed++;
          this.failedTests++;
        }
        testResult.durationMs = Math.round(performance.now() - startTime);
        suiteResult.tests.push(testResult);
      }

      results.push(suiteResult);
    }

    return {
      total: this.totalTests,
      passed: this.passedTests,
      failed: this.failedTests,
      suites: results,
    };
  }
}

if (typeof window !== 'undefined') {
  window.testRunner = new TestRunner();
  window.describe = window.testRunner.describe.bind(window.testRunner);
  window.it = window.testRunner.it.bind(window.testRunner);
  window.expect = window.testRunner.expect.bind(window.testRunner);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestRunner };
}
