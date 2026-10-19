#!/usr/bin/env python3
"""Build public/monster-manual-compendium.json from hand-transcribed 2014 Monster Manual
stat blocks (source-transcription/mm2014/*.txt) and validate them against their own numbers."""
import re, json, sys, glob, math, os
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
CR_XP = {'0':10,'1/8':25,'1/4':50,'1/2':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,'17':18000,'18':20000,'19':22000,'20':25000,'21':33000,'22':41000,'23':50000,'24':62000,'25':75000,'26':90000,'27':105000,'28':120000,'29':135000,'30':155000}
def prof(cr):
    v = eval(cr) if '/' in cr else int(cr)
    return 2 + max(0, math.ceil(v/4)-1) if v >= 1 else 2
ABIL = ['str','dex','con','int','wis','cha']
SKILL_ABIL = {'acrobatics':'dex','animal handling':'wis','arcana':'int','athletics':'str','deception':'cha','history':'int','insight':'wis','intimidation':'cha','investigation':'int','medicine':'wis','nature':'int','perception':'wis','performance':'cha','persuasion':'cha','religion':'int','sleight of hand':'dex','stealth':'dex','survival':'wis'}
LABELS = ['Armor Class','Hit Points','Speed','STR','Saving Throws','Skills','Damage Vulnerabilities','Damage Resistances','Damage Immunities','Condition Immunities','Senses','Languages','Challenge']
SECTIONS = {'ACTIONS':'actions','BONUS ACTIONS':'bonusActions','REACTIONS':'reactions','LEGENDARY ACTIONS':'legendaryActions'}
def mod(s): return (s-10)//2
def num(s): return int(s.replace('−','-'))

def parse_block(head, lines):
    name, pages = [x.strip() for x in head.split('|')]
    pages = [int(p) for p in pages.split(',')]
    m = {'name': name}
    warn = []
    sm = re.match(r'^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.*)$', lines[0])
    if not sm: raise ValueError(f'bad size line {lines[0]!r}')
    rest = sm.group(2); depth = 0; cut = None
    for i, ch in enumerate(rest):
        if ch == '(': depth += 1
        elif ch == ')': depth -= 1
        elif ch == ',' and depth == 0: cut = i; break
    typ, ali = (rest[:cut], rest[cut+1:]) if cut is not None else (rest, '')
    m['size'] = sm.group(1); m['type'] = typ.strip(); m['alignment'] = ali.strip()
    fields = {}
    entries = {'traits': [], 'actions': [], 'bonusActions': [], 'reactions': [], 'legendaryActions': []}
    section = 'traits'; in_header = True
    for ln in lines[1:]:
        if in_header:
            lab = next((l for l in LABELS if ln.startswith(l)), None)
            if lab is None: raise ValueError(f'unexpected header line {ln!r}')
            fields[lab] = ln[len(lab):].strip()
            if lab == 'Challenge': in_header = False
            continue
        h = re.match(r'^##\s*([A-Z ]+?)\s*$', ln)
        if h:
            section = SECTIONS[h.group(1)]; continue
        entries[section].append(ln.replace(' ¶ ', '\n'))
    for need in ('Armor Class', 'Hit Points', 'Speed', 'STR', 'Challenge'):
        if need not in fields: raise ValueError(f'missing {need}')
    a = re.match(r'^(\d+)\s*(.*)$', fields['Armor Class'])
    if not a: raise ValueError(f'bad AC {fields["Armor Class"]!r}')
    m['ac'] = int(a.group(1))
    if a.group(2).strip(): m['acNote'] = a.group(2).strip()
    h = re.match(r'^(\d+)\s*(?:\((\d+d\d+(?:\s*[+\-−]\s*\d+)?)\))?$', fields['Hit Points'])
    if not h: raise ValueError(f'bad HP {fields["Hit Points"]!r}')
    m['hp'] = int(h.group(1))
    if h.group(2):
        m['hpFormula'] = h.group(2).replace('−', '-')
        g = re.match(r'(\d+)d(\d+)\s*(?:([+\-])\s*(\d+))?', m['hpFormula'])
        n, s = int(g.group(1)), int(g.group(2)); bonus = int(g.group(4) or 0) * (-1 if g.group(3) == '-' else 1)
        avg = int(n * (s + 1) / 2) + bonus
        if avg != m['hp']: warn.append(f'HP {m["hp"]} != avg of {m["hpFormula"]} ({avg})')
    m['speed'] = fields['Speed']
    sc = [int(x) for x in re.findall(r'\d+', fields['STR'])]
    if len(sc) != 6: raise ValueError(f'bad ability line {fields["STR"]!r}')
    m['abilityScores'] = dict(zip(ABIL, sc))
    mods = {k: mod(v) for k, v in m['abilityScores'].items()}
    m['dexMod'] = mods['dex']; m['conMod'] = mods['con']; m['initiativeBonus'] = mods['dex']
    c = re.match(r'^([\d/]+)\s*\(([\d,]+)\s*XP\)(.*)$', fields['Challenge'])
    if not c: raise ValueError(f'bad CR {fields["Challenge"]!r}')
    cr, xp = c.group(1), int(c.group(2).replace(',', ''))
    m['challenge'] = cr; m['xp'] = f'{xp:,}' + c.group(3); pb = prof(cr); m['proficiencyBonus'] = pb
    if CR_XP.get(cr) != xp: warn.append(f'CR {cr} XP {xp} != {CR_XP.get(cr)}')
    for key, lab in (('savingThrows', 'Saving Throws'), ('skills', 'Skills'), ('damageVulnerabilities', 'Damage Vulnerabilities'), ('damageResistances', 'Damage Resistances'), ('damageImmunities', 'Damage Immunities'), ('conditionImmunities', 'Condition Immunities'), ('senses', 'Senses'), ('languages', 'Languages')):
        if lab in fields and fields[lab] not in ('', '-'): m[key] = [fields[lab]]
    if 'savingThrows' in m:
        for ab, v in re.findall(r'(Str|Dex|Con|Int|Wis|Cha)\s*([+\-−]\d+)', m['savingThrows'][0]):
            exp = mods[ab.lower()] + pb
            if num(v) != exp: warn.append(f'save {ab} {v} expected {exp:+d}')
    if 'skills' in m:
        for sk, v in re.findall(r'([A-Z][A-Za-z ]+?)\s*([+\-−]\d+)', m['skills'][0]):
            ab = SKILL_ABIL.get(sk.strip().lower())
            if ab is None: warn.append(f'unknown skill {sk}'); continue
            if num(v) not in (mods[ab] + pb, mods[ab] + 2 * pb, mods[ab]): warn.append(f'skill {sk} {v} vs mod {mods[ab]:+d} pb {pb}')
    if 'senses' in m:
        pp = re.search(r'passive Perception (\d+)', m['senses'][0])
        w = mods['wis']
        if not pp: warn.append('no passive Perception')
        elif int(pp.group(1)) not in (10 + w, 10 + w + pb, 10 + w + 2 * pb, 10 + w + 5, 10 + w - 5) and not any(int(pp.group(1)) == 10 + num(v) for sk, v in re.findall(r'(Perception)\s*([+\-−]\d+)', ' '.join(m.get('skills', [])))): warn.append(f'passive Perception {pp.group(1)} vs wis {w:+d}')
    for key, arr in entries.items():
        if arr: m[key] = arr
    if entries['legendaryActions']: m['legendary'] = True
    blob = '\n'.join(sum(entries.values(), []))
    for dm in re.finditer(r'(\d+)\s*\((\d+)d(\d+)\s*(?:([+\-−])\s*(\d+))?\)', blob):
        tot, n, s = int(dm.group(1)), int(dm.group(2)), int(dm.group(3)); b = int(dm.group(5) or 0) * (-1 if dm.group(4) in ('-', '−') else 1)
        if int(n * (s + 1) / 2) + b != tot: warn.append(f'dice {dm.group(0)}')
    for th in re.finditer(r'([+\-−]\d+) to hit', blob):
        if num(th.group(1)) - pb not in mods.values(): warn.append(f'to hit {th.group(1)} (pb {pb})')
    m['bookPage'] = pages[0]; m['imagePage'] = pages[0] + 1; m['imagePages'] = [p + 1 for p in pages]
    m['imageUrls'] = [f'/monster-manual-2014/page-{p + 1:03d}.jpg' for p in pages]; m['imageUrl'] = m['imageUrls'][0]; m['imageEdition'] = '2014 Monster Manual'
    m['source'] = 'Monster Manual (2014)'
    return m, warn

def load():
    monsters = []; warns = []
    for f in sorted(glob.glob(os.path.join(HERE, 'mm2014', '*.txt'))):
        txt = open(f, encoding='utf-8').read()
        for chunk in re.split(r'^@@\s*', txt, flags=re.M)[1:]:
            ls = [l.rstrip() for l in chunk.strip().split('\n') if l.strip()]
            try:
                m, w = parse_block(ls[0], ls[1:])
            except Exception as e:
                print('ERROR', os.path.basename(f), ls[0], '-', e); continue
            monsters.append(m)
            for x in w: warns.append(f'{m["name"]} (p{m["bookPage"]}): {x}')
    return monsters, warns

if __name__ == '__main__':
    mons, warns = load()
    print(len(mons), 'monsters;', len(warns), 'warnings')
    for w in warns: print(' !', w)
    if '--write' in sys.argv:
        out = {'name': 'Monster Manual (2014)', 'source': 'D&D 5e Monster Manual (2014), transcribed page by page from the PDF',
               'notice': 'Stat blocks are transcribed from the 2014 Monster Manual PDF you supplied. For personal use only; do not redistribute.',
               'monsters': mons, 'options': []}
        json.dump(out, open(os.path.join(HERE, '..', 'public', 'monster-manual-compendium.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
