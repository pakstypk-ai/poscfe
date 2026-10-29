CAFE POS - Offline Restaurant / Cafe POS (Electron + SQLite)
=============================================================

EXE BANANE KE 2 TAREEQAY
-------------------------
OPTION A - Apne Windows PC par (sab se asaan):
 1. https://nodejs.org se Node.js LTS install karein.
 2. Is zip ko Extract karein (Desktop par folder bana lein).
 3. build-exe.bat par double-click karein (pehli dafa 3-6 minute, internet chahiye).
 4. Folder "dist" mein "Cafe POS Setup 1.0.0.exe" milegi.
 5. Ye ek exe kisi bhi Windows 10/11 PC par copy karke install karein.
    Client PC par internet, Node ya koi aur cheez nahi chahiye.

OPTION B - Bina kuch install kiye (GitHub se):
 1. github.com par free account banayein, New Repository banayein.
 2. Is folder ki saari files upload karein (.github folder samet).
 3. Actions tab > "Build Windows EXE" > Run workflow.
 4. 5-8 minute baad run khol kar neeche "Artifacts" se Cafe-POS-Installer download karein.

TEST (bina exe banaye): run-dev.bat double-click.

PEHLA LOGIN
-----------
 PIN: 1234 (Admin). Staff tab mein foran change karein.
 Pehli dafa login par Settings khulti hai: restaurant ka naam, logo, address, tax, tables bhar dein.

DATA
----
 %APPDATA%\Cafe POS\pos.db
 Settings > Backup se regular backup lein (USB/Drive).
