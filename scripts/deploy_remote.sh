#!/bin/bash
set -e

echo "=== 1. PRESERVING AGHA PROFILE ==="
cp /home/ubuntu/job-agent-agha/database/seeds/master_profile.json /home/ubuntu/agha_master_profile_backup.json
echo "Backed up Agha profile."

echo "=== 2. UPDATING TALHA INSTANCE (~/job-agent on port 3000) ==="
cd /home/ubuntu/job-agent
git checkout -- package-lock.json yarn.lock || true
git pull origin main
npm run build
pm2 restart job-agent --update-env
echo "Talha instance updated and restarted."

echo "=== 3. UPDATING AGHA INSTANCE (~/job-agent-agha on port 3003) ==="
cd /home/ubuntu/job-agent-agha
# Clean old PDF resumes that had Talha's links
rm -f public/resumes/*.pdf
touch public/resumes/.gitkeep
# Reset applications.json to empty list so old records with Talha's links don't linger
echo "[]" > database/applications.json
# Reset working directory and pull latest code
git checkout -- package-lock.json yarn.lock database/seeds/master_profile.json || true
git pull origin main
# Restore Agha's master profile
cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/seeds/master_profile.json
npm run build
pm2 restart job-agent-agha --update-env
echo "Agha instance updated and restarted."

echo "=== 4. STATUS SUMMARY ==="
pm2 status
