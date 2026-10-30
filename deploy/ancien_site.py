"""Ferme ou rouvre l'ancien site PHP (dossier grec-old/ sur le serveur) en échangeant deux fichiers .htaccess.
Usage : FTPU=... FTPPW=... python deploy/ancien_site.py fermer|ouvrir|etat
  fermer : .htaccess -> .htaccess.ouvert  et  .htaccess.bloque -> .htaccess   (accès interdit à tous)
  ouvrir : .htaccess -> .htaccess.bloque  et  .htaccess.ouvert -> .htaccess   (ancien site accessible)"""
import ftplib, os, sys

HOST = 'ftpcloud.cluster024.hosting.ovh.net'
D = 'grec-old'
action = sys.argv[1] if len(sys.argv) > 1 else 'etat'
if action not in ('fermer', 'ouvrir', 'etat'):
    sys.exit(__doc__)

ftp = ftplib.FTP(HOST, timeout=60)
ftp.login(os.environ['FTPU'], os.environ['FTPPW'])
ftp.set_pasv(True)
ftp.cwd(D)
rows = []
ftp.retrlines('LIST -a', rows.append)
names = set(r.split(None, 8)[-1] for r in rows)
ferme = '.htaccess.ouvert' in names and '.htaccess.bloque' not in names
ouvert = '.htaccess.bloque' in names and '.htaccess.ouvert' not in names
print('État actuel :', 'FERMÉ' if ferme else 'OUVERT' if ouvert else 'indéterminé (fichiers : %s)' % sorted(n for n in names if n.startswith('.htaccess')))
if action == 'fermer' and ouvert:
    ftp.rename('.htaccess', '.htaccess.ouvert')
    ftp.rename('.htaccess.bloque', '.htaccess')
    print('Ancien site FERMÉ.')
elif action == 'ouvrir' and ferme:
    ftp.rename('.htaccess', '.htaccess.bloque')
    ftp.rename('.htaccess.ouvert', '.htaccess')
    print('Ancien site OUVERT.')
elif action != 'etat':
    print('Rien à faire.')
ftp.quit()
