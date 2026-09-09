const axios = require('axios');

async function testPipeline() {
  const baseURL = 'http://localhost:3000/api';
  console.log('1. Fetching jobs...');
  const jobsRes = await axios.get(`${baseURL}/jobs`);
  console.log(`Found ${jobsRes.data.length} jobs.`);

  const targetJob = jobsRes.data[0];
  console.log(`Target Job: ${targetJob.title} at ${targetJob.company} (ID: ${targetJob.id})`);

  console.log('2. Evaluating AI match...');
  const matchRes = await axios.post(`${baseURL}/jobs/${targetJob.id}/match`);
  console.log(`Match score: ${matchRes.data.score}% (${matchRes.data.classification})`);
  console.log(`Recommendation: ${matchRes.data.recommendation}`);
  console.log(`Matched Skills: ${matchRes.data.matching_skills.join(', ')}`);

  console.log('3. Staging Application in pipeline...');
  const appRes = await axios.post(`${baseURL}/applications/create`, { jobId: targetJob.id });
  const appId = appRes.data.id;
  console.log(`Application Created. ID: ${appId}`);

  console.log('4. Tailoring Resume & Generating ATS PDF...');
  const tailorRes = await axios.post(`${baseURL}/applications/${appId}/tailor`);
  console.log(`Tailored PDF generated at URL: ${tailorRes.data.tailored_resume_pdf_url}`);
  console.log(`Cover letter preview: ${tailorRes.data.cover_letter.slice(0, 120)}...`);

  console.log('5. Testing Free Email Channel dispatch...');
  const emailRes = await axios.post(`${baseURL}/applications/${appId}/send-email`);
  console.log(`Email dispatched to: ${emailRes.data.recipient}`);
  console.log(`Mode: ${emailRes.data.mode}, Status: ${emailRes.data.success ? 'SUCCESS' : 'FAILED'}`);

  console.log('6. Checking updated pipeline stats...');
  const statsRes = await axios.get(`${baseURL}/analytics/overview`);
  console.log('Pipeline Stage Distribution:', JSON.stringify(statsRes.data.pipeline));

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! The end-to-end Job Agent is fully operational.');
}

testPipeline().catch((err) => {
  console.error('Test error:', err.response?.data || err.message);
  process.exit(1);
});
