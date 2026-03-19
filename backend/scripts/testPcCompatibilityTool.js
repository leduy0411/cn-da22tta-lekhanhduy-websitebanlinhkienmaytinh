/**
 * testPcCompatibilityTool.js
 * Lightweight deterministic checks for pcCompatibilityCheck tool.
 *
 * Usage:
 *   node scripts/testPcCompatibilityTool.js
 */

const assert = require('assert');
const ToolSystem = require('../services/ai/core/ToolSystem');

async function run() {
  const schema = ToolSystem.getPCToolSchema();
  assert.strictEqual(schema.name, 'pcCompatibilityCheck', 'Schema name mismatch');

  const compatible = await ToolSystem.execute('pcCompatibilityCheck', {
    cpu: { name: 'Intel Core i5-13600K', socket: 'LGA1700' },
    mainboard: { name: 'MSI B760', socket: 'LGA 1700', supportedRamBus: [4800, 5600, 6000] },
    ram: { name: 'Corsair DDR5', bus: 5600 }
  });

  assert.strictEqual(compatible.success, true, 'Compatible case should execute successfully');
  assert.strictEqual(compatible.data.compatible, true, 'Compatible case should return compatible=true');

  const incompatibleSocket = await ToolSystem.execute('pcCompatibilityCheck', {
    cpu: { name: 'AMD Ryzen 5 7600', socket: 'AM5' },
    mainboard: { name: 'ASUS Z790', socket: 'LGA1700', supportedRamBus: [5600] },
    ram: { name: 'Kingston DDR5', bus: 5600 }
  });

  assert.strictEqual(incompatibleSocket.success, true, 'Incompatible socket case should execute successfully');
  assert.strictEqual(incompatibleSocket.data.compatible, false, 'Socket mismatch should be incompatible');
  assert.ok(
    incompatibleSocket.data.reasons.some((r) => r.includes('Socket không tương thích')),
    'Socket mismatch reason should be present'
  );

  const incompatibleBus = await ToolSystem.execute('pcCompatibilityCheck', {
    cpu: { name: 'Intel Core i7', socket: 'LGA1700' },
    mainboard: { name: 'Gigabyte B760', socket: 'LGA1700', supportedRamBus: ['4800', '5600'] },
    ram: { name: 'G.Skill DDR5', bus: 6400 }
  });

  assert.strictEqual(incompatibleBus.success, true, 'Incompatible bus case should execute successfully');
  assert.strictEqual(incompatibleBus.data.compatible, false, 'Bus mismatch should be incompatible');
  assert.ok(
    incompatibleBus.data.reasons.some((r) => r.includes('Bus RAM không tương thích')),
    'Bus mismatch reason should be present'
  );

  console.log('pcCompatibilityCheck tests passed');
}

run().catch((error) => {
  console.error('pcCompatibilityCheck tests failed:', error.message);
  process.exit(1);
});
