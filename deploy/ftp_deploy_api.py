"""Publie l'API (dossier api/) sur l'hébergement OVH par FTP, avec le fichier de configuration de production.
Usage : FTPU=... FTPPW=... API_CONFIG=chemin/vers/config-production.php python deploy/ftp_deploy_api.py [dossier-distant-de-l-api]
Le fichier de configuration (identifiants de la base) n'est JAMAIS dans le dépôt. Les dossiers tests/ et tools/ ne sont pas envoyés."""
import ftplib, os, sys

HOST = 'ftpcloud.cluster024.hosting.ovh.net'
SRC = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'api'))
REMOTE = (sys.argv[1] if len(sys.argv) > 1 else 'api').strip('/')
EXCLUDE_DIRS = {'tests', 'tools'}
EXCLUDE_FILES = {'config.php', 'config.sample.php', 'mail.log'}

ftp = ftplib.FTP(HOST, timeout=60)
ftp.login(os.environ['FTPU'], os.environ['FTPPW'])
ftp.set_pasv(True)


def mkd(path):
    cur = ''
    for p in path.split('/'):
        cur = cur + '/' + p if cur else p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass


mkd(REMOTE)
items = []
for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for f in files:
        if f in EXCLUDE_FILES:
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, SRC).replace(os.sep, '/')
        items.append((full, rel))
cfg = os.environ.get('API_CONFIG')
if cfg:
    items.append((cfg, 'config.php'))
ok = 0
for full, rel in items:
    d = REMOTE + '/' + '/'.join(rel.split('/')[:-1]) if '/' in rel else REMOTE
    mkd(d.rstrip('/'))
    with open(full, 'rb') as fh:
        ftp.storbinary('STOR ' + REMOTE + '/' + rel, fh)
    ok += 1
print('API envoyée : %d fichiers vers /%s/ (config de production : %s)' % (ok, REMOTE, 'oui' if cfg else 'non'))
ftp.quit()
