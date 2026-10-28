"""Publication du site sur OVH par FTP (racine du domaine ; variable FTPDIR pour un sous-dossier de test).

Usage (PowerShell) :
    $env:FTPU = "identifiant-ftp"; $env:FTPPW = "mot-de-passe"; python deploy/ftp_deploy.py
Usage (Git Bash) :
    FTPU=identifiant FTPPW=motdepasse python deploy/ftp_deploy.py

N'envoie que : index.html, 404.html, robots.txt, sitemap.xml, admin/, pages/, css/, js/, Assets/
et deploy/ovh.htaccess (renommé .htaccess). Ne touche à rien d'autre sur le serveur.
Rappel : lancer d'abord « npm run build:css » si des classes Tailwind ont changé.
"""
import ftplib, os, sys

HOST = 'ftpcloud.cluster024.hosting.ovh.net'
USER = os.environ['FTPU']      # identifiant FTP OVH
PWD = os.environ['FTPPW']      # mot de passe FTP OVH (jamais écrit dans le dépôt)
REMOTE_DIR = os.environ.get('FTPDIR', '')   # dossier distant : vide = racine du domaine (site en production)
SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))   # racine du dépôt

TOP_FILES = ['index.html', '404.html', 'robots.txt', 'sitemap.xml']
TOP_DIRS = ['admin', 'pages', 'css', 'js', 'Assets']
EXCLUDE_NAMES = ('API USEFULL',)     # ne jamais publier


def collect():
    items = []
    for f in TOP_FILES:
        items.append((os.path.join(SRC, f), f))
    for d in TOP_DIRS:
        for root, _dirs, files in os.walk(os.path.join(SRC, d)):
            for f in files:
                if any(x in f for x in EXCLUDE_NAMES):
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, SRC).replace('\\', '/')
                items.append((full, rel))
    items.append((os.path.join(SRC, 'deploy', 'ovh.htaccess'), '.htaccess'))
    return items


def ensure_dirs(ftp, rel):
    parts = rel.split('/')[:-1]
    cur = ''
    for p in parts:
        cur = cur + '/' + p if cur else p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass  # existe déjà


ftp = ftplib.FTP(HOST, timeout=60)
ftp.login(USER, PWD)
ftp.set_pasv(True)
if REMOTE_DIR:
    ftp.cwd(REMOTE_DIR)
print('Dossier distant :', ftp.pwd())

items = collect()
print(len(items), 'fichiers à envoyer')
ok = 0
errors = []
for full, rel in items:
    try:
        ensure_dirs(ftp, rel)
        with open(full, 'rb') as fh:
            ftp.storbinary('STOR ' + rel, fh)
        ok += 1
    except Exception as e:  # noqa
        errors.append((rel, str(e)))
        try:
            ftp.voidcmd('NOOP')
        except Exception:
            ftp = ftplib.FTP(HOST, timeout=60)
            ftp.login(USER, PWD)
            ftp.set_pasv(True)
            if REMOTE_DIR:
                ftp.cwd(REMOTE_DIR)
print('Envoyés :', ok, '| erreurs :', len(errors))
for rel, e in errors[:10]:
    print('  ERREUR', rel, e)
ftp.quit()
