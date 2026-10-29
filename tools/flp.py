import struct, sys, re, collections
data=open(sys.argv[1],'rb').read()
assert data[:4]==b'FLhd'
hl=struct.unpack('<I',data[4:8])[0]; fmt,nch,ppq=struct.unpack('<hHH',data[8:14])
print('format',fmt,'channels(hdr)',nch,'ppq',ppq)
i=8+hl; assert data[i:i+4]==b'FLdt'; i+=8
ev=[]
while i<len(data):
    e=data[i]; i+=1
    if e<64: v=data[i]; i+=1
    elif e<128: v=struct.unpack('<H',data[i:i+2])[0]; i+=2
    elif e<192: v=struct.unpack('<I',data[i:i+4])[0]; i+=4
    else:
        n=0; sh=0
        while True:
            b=data[i]; i+=1; n|=(b&0x7f)<<sh; sh+=7
            if not b&0x80: break
        v=data[i:i+n]; i+=n
    ev.append((e,v))
def txt(b):
    try:
        s=b.decode('utf-16-le') if len(b)>1 and b[1]==0 else b.decode('latin-1')
    except: s=b.decode('latin-1','replace')
    return s.rstrip('\x00')
cnt=collections.Counter(e for e,_ in ev); print('events',len(ev))
ch=-1; pat=-1; ins=-1
out=[]
for e,v in ev:
    if e==64: ch=v; out.append(f'\n[CANAL {v}]')
    elif e==65: pat=v
    elif e==156: out.append(f'TEMPO {v/1000}')
    elif e==199: out.append('FL version '+txt(v))
    elif e==194: out.append('Titulo '+txt(v))
    elif e in (192,203): out.append(f'  ch{ch} nombre: {txt(v)}')
    elif e==201: out.append(f'  ch{ch} plugin: {txt(v)}')
    elif e==196: out.append(f'  ch{ch} archivo: {txt(v)}')
    elif e==193: out.append(f'PATTERN {pat}: {txt(v)}')
    elif e==204: out.append(f'MIXER nombre: {txt(v)}')
    elif e==213:
        b=bytes(v)
        for m in set(re.findall(rb'[ -~]{4,}\.(?:sf2|SF2|sfz|wav|fst|dll)',b)): out.append(f'  ch{ch} ref: {m.decode()}')
        u=b.decode('utf-16-le','ignore')
        for m in set(re.findall(r'[\w :\/\-\.\(\)áéíóúñÁÉÍÓÚÑ\' ]{4,}\.(?:sf2|SF2|sfz|wav|fst|dll)',u)): out.append(f'  ch{ch} ref16: {m}')
print('\n'.join(out))
print('\nTOP event ids:',cnt.most_common(25))
