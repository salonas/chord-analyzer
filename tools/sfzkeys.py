import sys,os,re,collections
NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
def note(k):
    try: k=int(k)
    except: 
        m=re.match(r'([a-gA-G])(#|b)?(-?\d)',k); 
        if not m: return None
        k=12*(int(m.group(3))+1)+'cdefgab'.index(m.group(1).lower())*0+[0,2,4,5,7,9,11]['cdefgab'.index(m.group(1).lower())]+({'#':1,'b':-1}.get(m.group(2),0))
    return k
def load(path,defs,seen):
    txt=open(path,encoding='latin-1').read()
    for k,v in defs.items(): txt=txt.replace(k,v)
    out=''
    for line in txt.split('\n'):
        m=re.match(r'\s*#define\s+(\$\w+)\s+(\S+)',line)
        if m: defs[m.group(1)]=m.group(2); continue
        m=re.match(r'\s*#include\s+"([^"]+)"',line)
        if m:
            for k,v in defs.items(): line=line.replace(k,v)
            inc=re.match(r'\s*#include\s+"([^"]+)"',line).group(1)
            p=os.path.normpath(os.path.join(os.path.dirname(path),inc))
            if not os.path.exists(p): p=os.path.normpath(os.path.join(os.path.dirname(path),'..',inc))
            if os.path.exists(p) and p not in seen: seen.add(p); out+=load(p,defs,seen)+'\n'
            continue
        out+=re.sub(r'//.*','',line)+'\n'
    return out
f=sys.argv[1]; txt=load(f,{},set())
toks=re.findall(r'<(\w+)>|(\w+)=("[^"]*"|[^\s<]+(?:\s(?![\w$]+=|<)[^\s<]+)*)',txt)
ctx={'global':{}, 'master':{}, 'group':{}, 'region':{}}; order=['global','control','master','group','region']
keys=collections.defaultdict(set); labels={}
cur=None
def emit():
    m={}
    for h in ['global','master','group','region']: m.update(ctx.get(h,{}))
    lo=m.get('lokey',m.get('key')); hi=m.get('hikey',m.get('key'))
    if lo is None: return
    lo=note(lo); hi=note(hi)
    if lo is None or hi is None: return
    smp=os.path.basename(m.get('sample','')).replace('.flac','').replace('.wav','')
    for k in range(lo,hi+1): keys[k].add(re.sub(r'_?(rr|vl|v)\d+.*$','',smp)[:40])
for h,k,v in toks:
    if h:
        if cur=='region': emit()
        cur=h
        if h in ctx: 
            ctx[h]={}
            for lower in order[order.index(h)+1:] if h in order else []: 
                if lower in ctx: ctx[lower]={}
        continue
    if k.startswith('label_key'): labels[int(k[9:])]=v
    if cur in ctx: ctx[cur][k]=v.strip()
if cur=='region': emit()
print('==',os.path.basename(f))
for k in sorted(keys):
    print(f'  {k:3d} {NAMES[k%12]}{k//12-1:<3} {labels.get(k,"")!s:28} {", ".join(sorted(keys[k]))[:110]}')
