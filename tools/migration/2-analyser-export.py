"""Analyse de l'export SQL de l'ancienne base. N'affiche AUCUNE donnée personnelle : structure, comptages, qualité."""
import re, json, sys, collections

SRC = 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees/hconsuqgrec.sql'
OUT = 'C:/Users/HP/Documents/SAUVEGARDE-OVH-ancien-site-2026-10-28/base-de-donnees/donnees.json'
sql = open(SRC, encoding='utf-8', errors='replace').read()

# --- structure
tables = {}
for m in re.finditer(r'CREATE TABLE `?(\w+)`? \((.*?)\)\s*ENGINE', sql, re.S):
    cols = []
    for line in m.group(2).split('\n'):
        line = line.strip().rstrip(',')
        cm = re.match(r'`(\w+)`\s+([a-zA-Z]+(?:\([^)]*\))?)(.*)', line)
        if cm:
            cols.append((cm.group(1), cm.group(2), 'NOT NULL' in cm.group(3)))
    tables[m.group(1)] = cols


def parse_values(s):
    """Découpe '(v1,v2),(v3,v4)' en lignes, en gérant les chaînes SQL ('..\\'..' / '..''..')."""
    rows, row, i, n = [], None, 0, len(s)
    while i < n:
        c = s[i]
        if row is None:
            if c == '(':
                row = []
                i += 1
                continue
            i += 1
            continue
        if c in ' \n\r\t':
            i += 1
            continue
        if c == ')':
            rows.append(row)
            row = None
            i += 1
            continue
        if c == ',':
            i += 1
            continue
        if c == "'":
            j, buf = i + 1, []
            while j < n:
                if s[j] == '\\' and j + 1 < n:
                    nxt = s[j + 1]
                    buf.append({'n': '\n', 'r': '\r', 't': '\t', '0': '\0'}.get(nxt, nxt))
                    j += 2
                    continue
                if s[j] == "'":
                    if j + 1 < n and s[j + 1] == "'":
                        buf.append("'")
                        j += 2
                        continue
                    break
                buf.append(s[j])
                j += 1
            row.append(''.join(buf))
            i = j + 1
            continue
        j = i
        while j < n and s[j] not in ',)':
            j += 1
        tok = s[i:j].strip()
        row.append(None if tok.upper() == 'NULL' else tok)
        i = j
    return rows


data = {t: [] for t in tables}
for m in re.finditer(r'INSERT INTO `?(\w+)`?\s*(?:\(([^)]*)\))?\s*VALUES\s*(.*?);\s*(?=\n(?:--|INSERT|/\*|COMMIT|ALTER|CREATE|DROP|SET|$)|\Z)', sql, re.S):
    t = m.group(1)
    cols = [c.strip().strip('`') for c in m.group(2).split(',')] if m.group(2) else [c[0] for c in tables.get(t, [])]
    for r in parse_values(m.group(3)):
        data.setdefault(t, []).append(dict(zip(cols, r)))

json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
print('=== STRUCTURE ET VOLUME')
for t, cols in tables.items():
    print(f'\n{t}  —  {len(data.get(t, []))} ligne(s)')
    for c, typ, nn in cols:
        print(f'    {c:22s} {typ}')
