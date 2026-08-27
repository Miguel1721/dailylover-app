import zipfile
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

repo_root = r"C:\Users\jeloz\Documents\antigravity\zealous-fermi"
zip_path = r"C:\Users\jeloz\Documents\antigravity\zealous-fermi\scratch\dailylover-app-code.zip"

files_to_include = [
    os.path.join(repo_root, "scratch", "GoogleAppsScript_Matchmaking_v2.js"),
    os.path.join(repo_root, "scratch", "GoogleAppsScript_TestRunner.js"),
    os.path.join(repo_root, "backend", "app", "routers", "matchmaking.py"),
    os.path.join(repo_root, "backend", "app", "routers", "webhooks.py"),
    os.path.join(repo_root, "backend", "app", "routers", "admin.py"),
    os.path.join(repo_root, "backend", "app", "services", "google_sheets.py"),
    os.path.join(repo_root, "backend", "app", "config.py"),
    os.path.join(repo_root, "backend", "scripts", "sync_sheets_incremental.py"),
    os.path.join(repo_root, "frontend", "admin", "src", "pages", "Matching.jsx"),
    os.path.join(repo_root, "README.md"),
    os.path.join(repo_root, "LEEME_PRIMERO.md")
]

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for file_path in files_to_include:
        if os.path.exists(file_path):
            rel_p = os.path.relpath(file_path, repo_root)
            zipf.write(file_path, rel_p)
            print(f"Added: {rel_p}")

print(f"\n🎉 Successfully created ZIP at: {zip_path} ({os.path.getsize(zip_path) / 1024:.1f} KB)")
