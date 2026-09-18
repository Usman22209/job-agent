#!/bin/bash
set -e

echo "=== 1. PRESERVING AGHA PROFILE ==="
cp /home/ubuntu/job-agent-agha/database/seeds/master_profile.json /home/ubuntu/agha_master_profile_backup.json
echo "Backed up Agha profile."

echo "=== 2. UPDATING TALHA INSTANCE (~/job-agent on port 3000) ==="
cd /home/ubuntu/job-agent
git checkout -- package-lock.json yarn.lock || true
git pull origin main
node scripts/migrate_clean_job_titles.js /home/ubuntu/job-agent
npm run build
pm2 restart job-agent --update-env
echo "Talha instance updated and restarted."

echo "=== 3. UPDATING AGHA INSTANCE (~/job-agent-agha on port 3003) ==="
cd /home/ubuntu/job-agent-agha
# Reset working directory and pull latest code
git checkout -- package-lock.json yarn.lock database/seeds/master_profile.json || true
git pull origin main
# Restore Agha's master profile
cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/seeds/master_profile.json
node scripts/migrate_clean_job_titles.js /home/ubuntu/job-agent-agha
npm run build
pm2 restart job-agent-agha --update-env
echo "Agha instance updated and restarted."

echo "=== 4. STATUS SUMMARY ==="
pm2 status
