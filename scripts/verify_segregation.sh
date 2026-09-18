#!/bin/bash

echo "==================== CHECKING PORT 3000 (TALHA) ===================="
curl -s http://localhost:3000/api/profile | python3 -c '
import sys, json
data = json.load(sys.stdin)
print("Name:", data.get("full_name"))
print("Email:", data.get("email"))
print("Location:", data.get("location"))
print("LinkedIn:", data.get("qa_vault", {}).get("linkedin"))
print("GitHub:", data.get("qa_vault", {}).get("github"))
'

echo ""
echo "==================== CHECKING PORT 3003 (AGHA) ===================="
curl -s http://localhost:3003/api/profile | python3 -c '
import sys, json
data = json.load(sys.stdin)
print("Name:", data.get("full_name"))
print("Email:", data.get("email"))
print("Location:", data.get("location"))
print("LinkedIn:", data.get("qa_vault", {}).get("linkedin"))
print("GitHub:", data.get("qa_vault", {}).get("github"))
'
