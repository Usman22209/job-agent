const http = require('http');

const payload = JSON.stringify({
  title: "Senior Full-Stack Engineer",
  company: "Nordic AI Tech",
  recipientEmail: "test-hiring@nordicaitech.io",
  location: "Helsinki, Finland",
  description: "Seeking a Senior Full-Stack Engineer with React, Node.js, Next.js, and AI automation expertise.",
  autoSend: false
});

const req = http.request({
  hostname: 'localhost',
  port: 3003,
  path: '/api/custom-apply',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log("Status:", res.statusCode);
      console.log("Success:", parsed.success);
      const app = parsed.application || {};
      console.log("Application ID:", app.id);
      console.log("PDF URL:", app.tailored_resume_pdf_url);
      const resData = app.tailored_resume_json || {};
      console.log("Candidate Name:", resData.full_name);
      console.log("Contact Line:", resData.contact_line);
      console.log("Headline:", resData.headline);
      console.log("Summary:", resData.summary);
      console.log("Ordered Skills:", resData.ordered_skills ? resData.ordered_skills.slice(0, 6) : []);
      console.log("Skills Categories:", JSON.stringify(resData.skills_categories, null, 2));
      console.log("\n--- COVER LETTER ---");
      console.log(app.cover_letter);
      console.log("\n--- EMAIL DRAFT BODY ---");
      console.log(parsed.emailDraft ? parsed.emailDraft.body : app.email_body);
    } catch (e) {
      console.error("Parse Error:", e.message, "\nRaw Body:", data);
    }
  });
});

req.on('error', (e) => {
  console.error("Request Error:", e.message);
});

req.write(payload);
req.end();
