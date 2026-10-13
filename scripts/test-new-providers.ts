import { searchJoobleJobs } from '../src/lib/providers/jooble';
import { searchHimalayasJobs } from '../src/lib/providers/himalayas';
import { searchGreenhouseJobs } from '../src/lib/providers/greenhouse';
import { normalizeJob } from '../src/lib/normalizer';
import { IJob } from '../src/types';

async function verifyAll() {
  console.log('🚀 Starting verification of newly added job providers...');

  console.log('\n--- 1. Testing Jooble API ---');
  const joobleRaw = await searchJoobleJobs('react developer', 'Remote', 2);
  console.log(`Fetched ${joobleRaw.length} raw jobs from Jooble`);
  if (joobleRaw.length > 0) {
    const norm = normalizeJob(joobleRaw[0], 'jooble');
    validateJob('Jooble', norm);
  } else {
    console.error('❌ Jooble returned 0 jobs');
  }

  console.log('\n--- 2. Testing Himalayas API ---');
  const himalayasRaw = await searchHimalayasJobs('react', 2);
  console.log(`Fetched ${himalayasRaw.length} raw jobs from Himalayas`);
  if (himalayasRaw.length > 0) {
    const norm = normalizeJob(himalayasRaw[0], 'himalayas');
    validateJob('Himalayas', norm);
  } else {
    console.error('❌ Himalayas returned 0 jobs');
  }

  console.log('\n--- 3. Testing Greenhouse ATS Provider ---');
  const greenhouseRaw = await searchGreenhouseJobs('engineer', 2);
  console.log(`Fetched ${greenhouseRaw.length} raw jobs from Greenhouse`);
  if (greenhouseRaw.length > 0) {
    const norm = normalizeJob(greenhouseRaw[0], 'greenhouse');
    validateJob('Greenhouse', norm);
  } else {
    console.error('❌ Greenhouse returned 0 jobs');
  }

  console.log('\n✅ Verification complete!');
}

function validateJob(providerName: string, job: IJob) {
  const issues: string[] = [];

  if (!job.id) issues.push('Missing id');
  if (!job.source) issues.push('Missing source');
  if (!job.title) issues.push('Missing title');
  if (!job.company) issues.push('Missing company');
  if (typeof job.location !== 'string') issues.push('Invalid location');
  if (typeof job.is_remote !== 'boolean') issues.push('Invalid is_remote');
  if (!job.description || job.description.length < 10) issues.push('Missing or too short description');
  if (!job.url || !job.url.startsWith('http')) issues.push('Invalid url');
  if (!job.application_url || !job.application_url.startsWith('http')) issues.push('Invalid application_url');
  if (!job.dedup_hash || job.dedup_hash.length !== 64) issues.push('Invalid dedup_hash');
  if (job.status !== 'DISCOVERED') issues.push('Status not DISCOVERED');
  if (!job.created_at || isNaN(Date.parse(job.created_at))) issues.push('Invalid created_at');

  console.log(`\n[${providerName} Sample Job Validated]`);
  console.log(`  ID: ${job.id}`);
  console.log(`  Source: ${job.source}`);
  console.log(`  Title: ${job.title}`);
  console.log(`  Company: ${job.company}`);
  console.log(`  Location: ${job.location}`);
  console.log(`  Is Remote: ${job.is_remote}`);
  console.log(`  Salary: ${job.salary_min ?? 'N/A'} - ${job.salary_max ?? 'N/A'} ${job.currency}`);
  console.log(`  App Type: ${job.application_type}`);
  console.log(`  ATS Platform: ${job.ats_platform}`);
  console.log(`  Apply URL: ${job.application_url}`);
  console.log(`  Description (${job.description.length} chars): ${job.description.slice(0, 120).replace(/\n/g, ' ')}...`);

  if (issues.length > 0) {
    console.error(`❌ Validation ISSUES for ${providerName}:`, issues);
  } else {
    console.log(`✅ All ${providerName} schema checks PASSED!`);
  }
}

verifyAll().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
