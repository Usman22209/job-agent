#!/bin/bash

echo "Testing Custom Application Generation on Port 3003 (Agha)..."
RESP=$(curl -s -X POST http://localhost:3003/api/custom-apply \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Senior Full-Stack Engineer",
    "company": "Nordic AI Tech",
    "recipient_email": "test-hiring@nordicaitech.io",
    "location": "Helsinki, Finland",
    "description": "Looking for a Senior Full-Stack Engineer with React, Node.js, Next.js, and AI automation expertise.",
    "auto_send": false
  }')

echo "$RESP" | python3 -c '
import sys, json
data = json.load(sys.stdin)
app = data.get("application", {})
print("--- APPLICATION RESULT ---")
print("Status:", data.get("success"))
print("App ID:", app.get("id"))
print("Resume PDF URL:", app.get("tailored_resume_pdf_url"))
res = app.get("tailored_resume_json", {})
print("Full Name:", res.get("full_name"))
print("Contact Line:", res.get("contact_line"))
print("Headline:", res.get("headline"))
print("Summary:", res.get("summary"))
print("Ordered Skills:", res.get("ordered_skills")[:5])
print("Skills Categories:", res.get("skills_categories"))
print("--- EMAIL DRAFT ---")
print("Subject:", data.get("emailDraft", {}).get("subject"))
print("Body:\n", data.get("emailDraft", {}).get("body"))
print("--- COVER LETTER ---")
print("Cover Letter:\n", app.get("cover_letter"))
'
