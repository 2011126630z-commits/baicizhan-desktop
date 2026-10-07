@echo off
set HTTP_PROXY=http://127.0.0.1:10090
set HTTPS_PROXY=http://127.0.0.1:10090
cd /d D:\Baicizhan-PC
echo. | "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web --skip-ssh-key > D:\Baicizhan-PC\logs\gh-auth.log 2>&1
echo GH_AUTH_EXIT_%ERRORLEVEL% >> D:\Baicizhan-PC\logs\gh-auth.log
