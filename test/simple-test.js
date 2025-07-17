// Minimal test without DOM dependencies
async function runTests() {
  console.log('🧪 Running Fez tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`✅ ${message}`);
    } else {
      failed++;
      console.log(`❌ ${message}`);
    }
  }

  // Test 1: Check if Fez source file exists
  try {
    const fs = await import('fs');
    const fezExists = fs.existsSync('./src/fez.js');
    assert(fezExists, 'Fez source file exists');
  } catch (e) {
    assert(false, 'Fez source file exists - ' + e.message);
  }

  // Test 2: Check if Fez can be imported
  try {
    // Set up minimal globals for Fez
    globalThis.window = {
      customElements: {
        define: () => {},
        get: () => null
      },
      document: {
        createElement: () => ({}),
        querySelector: () => null,
        addEventListener: () => {},
        documentElement: { matches: () => false }
      },
      requestAnimationFrame: (callback) => setTimeout(callback, 16)
    };
    globalThis.document = globalThis.window.document;
    globalThis.HTMLElement = function() {};
    globalThis.CustomEvent = function() {};
    globalThis.MutationObserver = function() {
      this.observe = () => {};
      this.disconnect = () => {};
    };
    
    // Import Fez
    try {
      await import('../src/fez.js');
      const Fez = globalThis.Fez;
      
      console.log('Fez after import:', typeof Fez, Fez);
      console.log('window.Fez:', typeof globalThis.window.Fez);
      
      assert(typeof Fez === 'function', 'Fez is a function');
      assert(typeof Fez._components === 'object', 'Fez has _components registry');
    } catch (importError) {
      console.log('Import error:', importError.message);
      throw importError;
    }
  } catch (e) {
    assert(false, 'Fez can be imported - ' + e.message);
  }

  // Test 3: Check if components can be defined
  try {
    const Fez = globalThis.Fez;
    Fez('test-component', class {
      init() {
        this.state = { value: 'test' };
      }
    });
    
    assert(Fez._components['test-component'] !== undefined, 'Components can be defined');
  } catch (e) {
    assert(false, 'Components can be defined - ' + e.message);
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();