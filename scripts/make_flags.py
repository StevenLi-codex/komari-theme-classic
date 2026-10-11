"""Generate a small, locally bundled SVG flag set for the classic node window.
All SVG shapes are written locally. Unknown countries render an ISO label, never a broken image.
"""
from pathlib import Path
from math import cos, sin, pi
root=Path(__file__).resolve().parent.parent/'public'/'flags'
root.mkdir(parents=True, exist_ok=True)
def svg(code, shapes, width=72, height=48):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">{shapes}</svg>'
    (root/f'{code}.svg').write_text(s,encoding='utf8')
def rect(x,y,w,h,c):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>'
def circle(x,y,r,c):return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
def star(x,y,r,c,ratio=.39,rot=-90):
    pts=' '.join(f'{x+(r if i%2==0 else r*ratio)*cos((rot+i*36)*pi/180):.3f},{y+(r if i%2==0 else r*ratio)*sin((rot+i*36)*pi/180):.3f}' for i in range(10))
    return f'<polygon points="{pts}" fill="{c}"/>'
def tricolor(code,colors,vertical=False):
    shape=''.join(rect(i*24 if vertical else 0,0 if vertical else i*16,24 if vertical else 72,48 if vertical else 16,c) for i,c in enumerate(colors));svg(code,shape)
svg('jp',rect(0,0,72,48,'#fff')+circle(36,24,14,'#bc002d'))
tricolor('de',['#000','#dd0000','#ffce00'])
tricolor('fr',['#0055a4','#fff','#ef4135'],True)
tricolor('it',['#009246','#fff','#ce2b37'],True)
tricolor('ie',['#169b62','#fff','#ff883e'],True)
tricolor('be',['#000','#fdda24','#ef3340'],True)
tricolor('nl',['#ae1c28','#fff','#21468b'])
tricolor('ru',['#fff','#0039a6','#d52b1e'])
tricolor('at',['#ed2939','#fff','#ed2939'])
tricolor('pl',['#fff','#dc143c']) if False else svg('pl',rect(0,0,72,24,'#fff')+rect(0,24,72,24,'#dc143c'))
svg('ua',rect(0,0,72,24,'#0057b7')+rect(0,24,72,24,'#ffd700'))
svg('id',rect(0,0,72,24,'#ef3340')+rect(0,24,72,24,'#fff'))
svg('sg',rect(0,0,72,24,'#ef3340')+rect(0,24,72,24,'#fff')+circle(18,12,9,'#fff')+circle(21,10,8,'#ef3340')+''.join(star(x,y,2,'#fff') for x,y in [(30,5),(35,10),(33,17),(25,17),(23,8)]))
svg('vn',rect(0,0,72,48,'#da251d')+star(36,24,15,'#ffff00'))
svg('ch',rect(0,0,72,48,'#da291c')+rect(31,10,10,28,'#fff')+rect(22,19,28,10,'#fff'))
svg('cn',rect(0,0,72,48,'#de2910')+star(14,12,8,'#ffde00')+''.join(star(x,y,3,'#ffde00') for x,y in [(28,6),(33,12),(31,20),(25,25)]))
svg('hk',rect(0,0,72,48,'#de2910')+''.join(f'<ellipse cx="36" cy="15" rx="5" ry="10" fill="white" transform="rotate({i*72} 36 24)"/>' for i in range(5))+circle(36,24,3,'#de2910'))
svg('tw',rect(0,0,72,48,'#fe0000')+rect(0,0,36,24,'#000095')+circle(18,12,9,'#fff')+circle(18,12,6,'#000095')+circle(18,12,4,'#fff'))
svg('kr',rect(0,0,72,48,'#fff')+f'<path d="M26 24a10 10 0 0 1 20 0a5 5 0 0 1 -10 0a5 5 0 0 0 -10 0" fill="#cd2e3a"/><path d="M46 24a10 10 0 0 1 -20 0a5 5 0 0 1 10 0a5 5 0 0 0 10 0" fill="#0047a0"/>' + ''.join(rect(x,y,13,2,'#000') for x,y in [(6,7),(6,11),(6,15),(53,30),(53,34),(53,38)]))
svg('us', ''.join(rect(0,i*48/13,72,48/13,'#b22234' if i%2==0 else '#fff') for i in range(13))+rect(0,0,29,48*7/13,'#3c3b6e')+''.join(star(2.7+col*4.65+(0 if row%2==0 else 2.2),2.1+row*2.3,.91,'white',.43) for row in range(9) for col in range(6 if row%2==0 else 5)))
# UK flag: diagonal saltire and centered cross, clipping keeps strokes within the canton.
svg('gb', '<defs><clipPath id="b"><rect width="72" height="48"/></clipPath></defs>'+rect(0,0,72,48,'#012169')+'<g clip-path="url(#b)"><path d="M-7 -5 L79 53 M79 -5 L-7 53" stroke="#fff" stroke-width="12"/><path d="M-7 -5 L79 53 M79 -5 L-7 53" stroke="#c8102e" stroke-width="4"/></g>'+rect(0,19,72,10,'#fff')+rect(31,0,10,48,'#fff')+rect(0,21,72,6,'#c8102e')+rect(33,0,6,48,'#c8102e'))
svg('ca',rect(0,0,72,48,'#fff')+rect(0,0,18,48,'#d80621')+rect(54,0,18,48,'#d80621')+'<path d="M36 9l3 8 6-3 -2 6 6 4 -9 3 1 8 -5 -3 -5 3 1 -8 -9 -3 6 -4 -2 -6 6 3z" fill="#d80621"/>')
svg('se',rect(0,0,72,48,'#006aa7')+rect(22,0,9,48,'#fecc00')+rect(0,20,72,9,'#fecc00'))
svg('fi',rect(0,0,72,48,'#fff')+rect(21,0,9,48,'#003580')+rect(0,19,72,9,'#003580'))
svg('no',rect(0,0,72,48,'#ba0c2f')+rect(20,0,12,48,'#fff')+rect(0,18,72,12,'#fff')+rect(23,0,6,48,'#00205b')+rect(0,21,72,6,'#00205b'))
svg('dk',rect(0,0,72,48,'#c60c30')+rect(21,0,8,48,'#fff')+rect(0,20,72,8,'#fff'))
svg('ae',rect(0,0,72,48,'#ff0000')+rect(18,0,54,16,'#00732f')+rect(18,16,54,16,'white')+rect(18,32,54,16,'#000'))
svg('th',rect(0,0,72,48,'#a51931')+rect(0,8,72,32,'#fff')+rect(0,16,72,16,'#2d2a4a'))
svg('es',rect(0,0,72,48,'#aa151b')+rect(0,12,72,24,'#f1bf00')+rect(21,19,8,11,'#aa151b'))
svg('in',rect(0,0,72,16,'#ff9933')+rect(0,16,72,16,'#fff')+rect(0,32,72,16,'#138808')+circle(36,24,7,'#000080')+circle(36,24,5.8,'#fff')+''.join(f'<path d="M36 24 L{36+5.3*cos(i*pi/12):.2f} {24+5.3*sin(i*pi/12):.2f}" stroke="#000080" stroke-width=".55"/>' for i in range(24)))
svg('tr',rect(0,0,72,48,'#e30a17')+circle(30,24,12,'#fff')+circle(34,24,9,'#e30a17')+star(47,24,8,'#fff'))
# Additional locations used on real multi-VPS Monitor sites.
svg('il',rect(0,0,72,48,'#fff')+rect(0,7,72,5,'#0038b8')+rect(0,36,72,5,'#0038b8')+
    '<polygon points="36,16 28,30 44,30" fill="none" stroke="#0038b8" stroke-width="2.3"/>'+
    '<polygon points="36,33 28,19 44,19" fill="none" stroke="#0038b8" stroke-width="2.3"/>')
# Antarctica does not have an official national flag. Use a recognizable
# blue/white Antarctic silhouette, as commonly used for region code AQ.
svg('aq',rect(0,0,72,48,'#1763a6')+
    '<path d="M34 5 41 9 43 14 50 16 55 22 47 25 49 32 43 35 40 43 35 38 32 43 28 33 22 33 21 27 14 25 21 20 23 14 29 13Z" fill="#fff"/>'+
    '<path d="M23 16 17 11 12 13 20 19 M45 21 62 13 58 22 49 25" fill="#fff"/>')
print('Generated',len(list(root.glob('*.svg'))),'flag assets')
