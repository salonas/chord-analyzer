import base64, io, zipfile, struct, sys
z = base64.b64decode(open("zip.b64").read())
zf = zipfile.ZipFile(io.BytesIO(z)); print("zip ok:", zf.testzip() is None, zf.namelist())
d = zf.read("test.mid")
assert d[:4]==b"MThd"; fmt,ntr,div = struct.unpack(">HHH", d[8:14]); print("fmt",fmt,"tracks",ntr,"ppq",div)
assert d[14:18]==b"MTrk"; L=struct.unpack(">I",d[18:22])[0]; tr=d[22:22+L]; print("track len",L,"remaining",len(d)-22-L)
i=0; t=0; on={}; notes=[]
def vlq():
    global i; v=0
    while True:
        b=tr[i]; i+=1; v=(v<<7)|(b&0x7f)
        if not b&0x80: return v
while i<len(tr):
    t+=vlq(); st=tr[i]; i+=1
    if st==0xFF:
        ty=tr[i]; i+=1; ln=vlq(); data=tr[i:i+ln]; i+=ln
        if ty==0x51: print("tempo bpm", round(60e6/int.from_bytes(data,'big'),2))
        elif ty==0x58: print("timesig", data[0], 2**data[1])
        elif ty in (3,6): print("meta",hex(ty),"@",t/div, data.decode())
        elif ty==0x2F: print("end @", t/div)
    elif st&0xF0==0x90: m,v=tr[i],tr[i+1]; i+=2; on[m]=(t,v)
    elif st&0xF0==0x80: m=tr[i]; i+=2; s,v=on.pop(m); notes.append((s/div,(t-s)/div,m,v))
print(len(notes),"notes; hanging",len(on)); print(notes[:5])
