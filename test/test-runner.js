import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  runScripts: 'dangerously',
  resources: 'usable'
});

// Make DOM globals available
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.CustomEvent = dom.window.CustomEvent;
global.MutationObserver = dom.window.MutationObserver;

// Helper to wait for async operations
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test suite class
class FezTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running Fez tests...\n');
    
    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   ${error.message}`);
      }
    }

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}

// Assertion helpers
const assert = {
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },
  
  ok(value, message = '') {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },
  
  includes(str, substring, message = '') {
    if (!str.includes(substring)) {
      throw new Error(message || `Expected "${str}" to include "${substring}"`);
    }
  },
  
  exists(element, message = '') {
    if (!element) {
      throw new Error(message || 'Expected element to exist');
    }
  }
};

export { FezTestRunner, assert, wait, dom };