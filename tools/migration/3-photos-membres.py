"""Récupère (lecture seule sur le serveur) les photos des membres à migrer et les envoie sur Cloudinary (preset non signé).
Sortie : photos.json {id_membre: url}. Les photos sont gardées localement hors dépôt (dossier de sauvegarde)."""
import ftplib, json, os, re, sys, urllib.request, mimetypes, uuid

BASE = 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees/'
PHOTOS_DIR = BASE + 'photos-membres/'
os.makedirs(PHOTOS_DIR, exist_ok=True)
data = json.load(open(BASE + 'donnees.json', encoding='utf-8'))
EMAIL_OK = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
selected = [m for m in data['g_membre'] if m['statut'] == '1' and EMAIL_OK.match((m['email'] or '').strip())]
if '--pending2021' in sys.argv:
    selected += [m for m in data['g_membre'] if m['statut'] == '0' and (m['datecreated'] or '').startswith('2021') and EMAIL_OK.match((m['email'] or '').strip())]
with_photo = [m for m in selected if (m['photo'] or '').strip()]
print('Membres sélectionnés :', len(selected), '| avec photo renseignée :', len(with_photo))

ftp = ftplib.FTP(timeout=60)
ftp.encoding = 'latin-1'
ftp.connect('ftpcloud.cluster024.hosting.ovh.net')
ftp.login(os.environ['FTPU'], os.environ['FTPPW'])
ftp.set_pasv(True)
lines = []
ftp.retrlines('LIST /grec-old/images', lines.append)
remote = {}
for l in lines:
    p = l.split(None, 8)
    if len(p) == 9 and not p[0].startswith('d'):
        remote[p[8]] = int(p[4])
print('Fichiers dans grec-old/images :', len(remote))

result, missing, bad = {}, [], []
CLOUD = 'ezloqmpj'
PRESET = 'grec-upload'
for m in with_photo:
    name = m['photo'].strip()
    if name not in remote:
        missing.append(m['id_membre'])
        continue
    local = PHOTOS_DIR + name
    if not os.path.exists(local):
        with open(local, 'wb') as fh:
            ftp.retrbinary('RETR /grec-old/images/' + name, fh.write)
    if '--upload' in sys.argv:
        boundary = uuid.uuid4().hex
        body = b''
        for k, v in (('upload_preset', PRESET), ('folder', 'grec')):
            pass
        fields = [('upload_preset', PRESET)]
        for k, v in fields:
            body += ('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (boundary, k, v)).encode()
        ctype = mimetypes.guess_type(name)[0] or 'application/octet-stream'
        body += ('--%s\r\nContent-Disposition: form-data; name="file"; filename="%s"\r\nContent-Type: %s\r\n\r\n' % (boundary, name.encode('ascii', 'replace').decode(), ctype)).encode()
        body += open(local, 'rb').read() + ('\r\n--%s--\r\n' % boundary).encode()
        req = urllib.request.Request('https://api.cloudinary.com/v1_1/%s/image/upload' % CLOUD, data=body, headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=90))
            result[m['id_membre']] = resp['secure_url']
        except Exception as e:  # noqa
            bad.append((m['id_membre'], name, str(e)[:80]))
ftp.quit()
print('Photos introuvables sur le serveur :', len(missing))
print('Photos téléchargées en local        :', len([f for f in os.listdir(PHOTOS_DIR)]))
if '--upload' in sys.argv:
    json.dump(result, open(BASE + 'photos.json', 'w', encoding='utf-8'))
    print('Envoyées sur Cloudinary :', len(result), '| échecs :', len(bad))
    for b in bad: print('  échec', b)
