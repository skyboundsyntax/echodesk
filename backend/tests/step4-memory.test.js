/**
 * ECHODESK Backend — Stage 4: Echo Memory Test Suite
 * Validates backend EchoMemoryEngine:
 * - Structured persistence (CRUD)
 * - Dynamic context resumption greeting
 * - Privacy Policy Gate enforcement against raw sensor storage
 */

const { EchoMemoryEngine } = require('../engines/memory-engine');
const { PrivacyPolicyGate } = require('../core/privacy-gate');

async function runStep4Tests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  console.log('==================================================');
  console.log(' ECHODESK Step 4: Echo Memory Verification        ');
  console.log('==================================================\n');

  const gate = new PrivacyPolicyGate();
  const memory = new EchoMemoryEngine({ privacyGate: gate });

  // 1. Save structured memory record
  console.log('1. Testing Save structured memory record...');
  const rec1 = memory.save({
    contextName: 'DBMS',
    topic: 'Normalization',
    lastStep: 'Q5',
    nextAction: 'Continue Q5',
    status: 'paused',
    activeDurationMs: 47 * 60 * 1000,
    formattedDuration: '47:00',
    source: 'user_declared',
    confidence: 0.98,
  });

  assert(rec1.contextName === 'DBMS', 'Saved contextName is DBMS');
  assert(rec1.lastStep === 'Q5', 'Saved lastStep is Q5');
  assert(rec1.topic === 'Normalization', 'Saved topic is Normalization');

  // 2. Retrieve by context name
  console.log('\n2. Testing Retrieve memory by context...');
  const retrieved = memory.get('DBMS');
  assert(retrieved !== null, 'Memory retrieved successfully');
  assert(retrieved.contextName === 'DBMS', 'Retrieved context is DBMS');
  assert(retrieved.lastStep === 'Q5', 'Retrieved lastStep is Q5');

  // 3. Update memory record
  console.log('\n3. Testing Update existing memory...');
  const updated = memory.update('DBMS', {
    lastStep: 'Q6',
    nextAction: 'Review 3NF vs BCNF',
  });
  assert(updated !== null, 'Update succeeded');
  assert(updated.lastStep === 'Q6', 'lastStep updated to Q6');
  assert(updated.nextAction === 'Review 3NF vs BCNF', 'nextAction updated');
  assert(memory.get('DBMS').lastStep === 'Q6', 'Retrieved memory reflects update');

  // 4. Resumption greeting formatting
  console.log('\n4. Testing Structured Resumption Greeting...');
  const greeting = memory.formatResumeGreeting('DBMS');
  assert(greeting === 'Welcome back. You were working on Q6 — Normalization.', 'Greeting dynamically formats: "Welcome back. You were working on Q6 — Normalization."');

  // 5. Delete individual memory
  console.log('\n5. Testing Delete individual memory...');
  memory.save({ contextName: 'Computer Networks', lastStep: 'Subnetting' });
  assert(memory.getAll().length === 2, 'Total memories is 2');
  const deleted = memory.delete('Computer Networks');
  assert(deleted === true, 'Delete returned true');
  assert(memory.get('Computer Networks') === null, 'Computer Networks memory is gone');
  assert(memory.get('DBMS') !== null, 'DBMS memory is retained');

  // 6. Clear all memories
  console.log('\n6. Testing Clear all memories...');
  const clearedCount = memory.clearAll();
  assert(clearedCount === 1, '1 memory cleared');
  assert(memory.getAll().length === 0, 'Memory store is completely empty');

  // 7. Privacy Policy Gate: Reject raw sensor data
  console.log('\n7. Testing Privacy Gate: Raw sensor data rejection...');
  let rawAudioBlocked = false;
  try {
    memory.save({ contextName: 'DBMS', rawAudio: 'blob:bytes' });
  } catch (err) {
    rawAudioBlocked = true;
  }
  assert(rawAudioBlocked === true, 'Privacy Gate blocked saving raw audio in memory');

  let rawVideoBlocked = false;
  try {
    memory.save({ contextName: 'DBMS', rawVideo: 'blob:frames' });
  } catch (err) {
    rawVideoBlocked = true;
  }
  assert(rawVideoBlocked === true, 'Privacy Gate blocked saving raw video frames in memory');

  console.log('\n==================================================');
  console.log(` Step 4 Results: ${passed} PASSED, ${failed} FAILED `);
  console.log('==================================================');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runStep4Tests();
}

module.exports = { runStep4Tests };
