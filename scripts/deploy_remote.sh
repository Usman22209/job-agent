#!/bin/bash
set -e

echo "=== 1. PRESERVING AGHA PROFILE ==="
if [ -f /home/ubuntu/agha_master_profile_backup.json ]; then
  cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/master_profile.json
  cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/seeds/master_profile.json
  echo "Restored Agha profile from golden backup."
fi

echo "=== 2. UPDATING TALHA INSTANCE (~/job-agent on port 3000) ==="
cd /home/ubuntu/job-agent
git checkout -- package-lock.json yarn.lock || true
git pull origin main
npm run build
pm2 restart job-agent --update-env
echo "Talha instance updated and restarted."

echo "=== 3. UPDATING AGHA INSTANCE (~/job-agent-agha on port 3003) ==="
cd /home/ubuntu/job-agent-agha
git checkout -- package-lock.json yarn.lock || true
git pull origin main
if [ -f /home/ubuntu/agha_master_profile_backup.json ]; then
  cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/master_profile.json
  cp /home/ubuntu/agha_master_profile_backup.json /home/ubuntu/job-agent-agha/database/seeds/master_profile.json
fi
npm run build
pm2 restart job-agent-agha --update-env
echo "Agha instance updated and restarted."

echo "=== 4. STATUS SUMMARY ==="
pm2 status
