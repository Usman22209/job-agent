const fs = require('fs');

try {
  const jobs = JSON.parse(fs.readFileSync('./database/jobs.json', 'utf8'));
  const queue = JSON.parse(fs.readFileSync('./database/queue.json', 'utf8'));
  const apps = JSON.parse(fs.readFileSync('./database/applications.json', 'utf8'));
  
  console.log('=== JOB DATABASE SUMMARY ===');
  console.log('Total jobs:', jobs.length);
  console.log('Jobs with contact_email:', jobs.filter(j => j.contact_email).length);
  console.log('Jobs without contact_email:', jobs.filter(j => !j.contact_email).length);
  console.log('Applied jobs:', jobs.filter(j => j.status === 'APPLIED').length);
  console.log('Matched jobs:', jobs.filter(j => j.status === 'MATCHED').length);
  console.log('Discovered jobs:', jobs.filter(j => j.status === 'DISCOVERED').length);
  console.log('Queue size:', queue.length);
  console.log('Total applications:', apps.length);
} catch (err) {
  console.error('Error:', err.message);
}
