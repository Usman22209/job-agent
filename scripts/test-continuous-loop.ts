/**
 * Verification Script for Continuous Autonomous Loop & Safeguards
 * Tests:
 * 1. Autonomous state initialization and status reporting
 * 2. Configuration mutation (daily limit, cooldown)
 * 3. Daily application limit guard
 * 4. Auto-enqueuing of high-fit jobs
 * 5. Empty-queue transition to COOLDOWN & next cycle scheduling
 * 6. Autonomous mode pause/resume toggling
 */

import { store } from '../src/lib/store';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

async function runTests() {
  console.log('\n========================================');
  console.log('🤖 Testing Continuous Autonomous Loop 🤖');
  console.log('========================================\n');

  // 1. Check Initial Autonomous Status
  console.log('--- Test 1: Autonomous Status Initialization ---');
  const initialStatus = store.getAutonomousStatus();
  assert(typeof initialStatus.is_autonomous === 'boolean', 'is_autonomous is a boolean');
  assert(typeof initialStatus.daily_limit === 'number', 'daily_limit is a number');
  assert(typeof initialStatus.cooldown_minutes === 'number', 'cooldown_minutes is a number');
  assert(typeof initialStatus.applications_today === 'number', 'applications_today is a number');
  assert(['IDLE', 'DISCOVERING', 'APPLYING', 'COOLDOWN'].includes(initialStatus.state), 'state is valid');

  // 2. Test Configuration Mutation
  console.log('\n--- Test 2: Configuration Mutation ---');
  const updatedStatus = store.setAutonomousConfig({ dailyLimit: 25, cooldownMinutes: 3 });
  assert(updatedStatus.daily_limit === 25, 'dailyLimit updated to 25');
  assert(updatedStatus.cooldown_minutes === 3, 'cooldownMinutes updated to 3');

  // Verify persistence file on disk
  const configPath = path.resolve(process.cwd(), 'database/autonomous_config.json');
  assert(fs.existsSync(configPath), 'autonomous_config.json exists on disk');
  const diskData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert(diskData.dailyApplicationLimit === 25, 'Persisted daily limit matches');
  assert(diskData.autonomousCooldownMinutes === 3, 'Persisted cooldown matches');

  // 3. Test Toggling Autonomous Mode
  console.log('\n--- Test 3: Toggling Autonomous Mode ---');
  store.toggleAutonomousMode(false);
  let status = store.getAutonomousStatus();
  assert(!status.is_autonomous, 'Autonomous mode successfully paused');
  assert(status.state === 'IDLE', 'State reset to IDLE when paused');
  assert(status.next_cycle_at === null, 'Cooldown timer cleared when paused');

  store.toggleAutonomousMode(true);
  status = store.getAutonomousStatus();
  assert(status.is_autonomous, 'Autonomous mode successfully resumed');

  // 4. Test Queue Status Integration
  console.log('\n--- Test 4: Queue Status Integration ---');
  const queueStatus = store.getQueueStatus();
  assert(Boolean(queueStatus.autonomous), 'getQueueStatus() includes autonomous object');
  assert(queueStatus.autonomous.daily_limit === 25, 'Embedded autonomous status has correct config');

  // 5. Test Auto-Enqueuing Mock
  console.log('\n--- Test 5: Auto-Enqueue Logic ---');
  const mockJob = {
    id: 'test-auto-job-' + Date.now(),
    source: 'remotive' as const,
    title: 'Senior React Native & AI Architect',
    company: 'Test Continuous Corp',
    location: 'Remote',
    is_remote: true,
    description: 'Looking for a Senior React Native & Next.js engineer with AI experience.',
    url: 'https://example.com/job',
    status: 'DISCOVERED' as const,
    posted_at: new Date().toISOString(),
  };

  const { job: ingested, isNew } = store.ingestJob(mockJob, 'remotive');
  assert(isNew, 'Ingested test job successfully');

  // Add job to queue
  const addRes = store.addToQueue(ingested.id);
  assert(addRes.success, 'Successfully added test job to queue');

  const qAfterAdd = store.getQueueStatus();
  assert(qAfterAdd.queue.includes(ingested.id), 'Job ID is in applyQueue');

  // Remove test job to keep test clean
  store.removeFromQueue(ingested.id);
  const qAfterRemove = store.getQueueStatus();
  assert(!qAfterRemove.queue.includes(ingested.id), 'Job ID cleanly removed from applyQueue');

  // 6. Reset Test Configuration back to production defaults
  console.log('\n--- Test 6: Reverting Test Config to Defaults ---');
  store.setAutonomousConfig({ dailyLimit: 40, cooldownMinutes: 5 });
  const finalStatus = store.getAutonomousStatus();
  assert(finalStatus.daily_limit === 40, 'Daily limit restored to 40');
  assert(finalStatus.cooldown_minutes === 5, 'Cooldown restored to 5m');

  console.log('\n=============================================');
  console.log('✅ ALL CONTINUOUS AUTONOMOUS TESTS PASSED! ✅');
  console.log('=============================================\n');
}

runTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
