#!/usr/bin/env bash
# Chạy trong terminal của GitHub Codespaces:
#   bash setup_project.sh
# Sau đó:
#   git add . && git commit -m "init" && git push
set -e
echo "Đang giải nén project..."
base64 -d project_b64.txt > project.tar.gz
tar xzf project.tar.gz
rm project.tar.gz
echo "Xong! Xem thư mục FamilyConnect-android/ và dashboard/"
