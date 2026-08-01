import json, re
from pathlib import Path

rows=[]

def add(brand, family, model, y1, y2, engine=None, aliases=None, series=None, fuel=None, cooling=None, cylinders=None, hp=None, abs=False, status='partial'):
    aliases=list(aliases or [])
    # Common spelling variants. These are aliases, not claims of separate models.
    compact=re.sub(r'[^A-Za-z0-9]+','',model)
    spaced=re.sub(r'([A-Za-z])(?=\d)',r'\1 ',model)
    hyphen=re.sub(r'([A-Za-z])(?=\d)',r'\1-',model)
    for a in [model, compact, spaced, hyphen, f'{brand} {model}', f'{brand} {compact}', f'{brand} {spaced}']:
        a=' '.join(a.split())
        if a and a.lower() not in {x.lower() for x in aliases}: aliases.append(a)
    rows.append({
        'brand':brand,'family':family,'model':model,'displayName':model,
        'aliases':aliases,'production':{'from':y1,'to':y2},
        'engine':engine,'cylinders':cylinders,'hp':hp,'cooling':cooling,'fuel':fuel,'abs':abs,
        'series':series or [{'from':y1,'to':y2}], 'dataStatus':status,
        'notes':['Modellfamilie für Erkennung und Marktsuche; regionale Ausführungen können abweichen.']
    })

def bulk(brand, family, data):
    for item in data:
        model,y1,y2,*rest=item
        engine=rest[0] if rest else None
        add(brand,family,model,y1,y2,engine)

# HONDA
bulk('Honda','CB',[
('CB125',1970,1985,125),('CB200',1973,1976,198),('CB250',1970,2008,249),('CB350',1970,1973,325),('CB360',1974,1976,356),('CB400F',1975,1977,408),('CB400N',1978,1985,395),('CB450',1970,1974,444),('CB500 Four',1971,1978,498),('CB550 Four',1974,1978,544),('CB650',1979,1985,627),('CB750 Four',1970,1978,736),('CB750F',1979,2003,747),('CB900F Bol d’Or',1979,1984,901),('CB1000R',2008,2010,998),('CB1000 Big One',1993,1996,998),('CB1100F',1983,1984,1062),('CB1300',1998,2010,1284),('CB-1',1989,1990,399),('CB500',1993,2003,499),('CBF500',2004,2008,499),('CBF600',2004,2010,599),('CBF1000',2006,2010,998),('CB600F Hornet',1998,2010,599),('CB900F Hornet',2002,2007,919),('CB900F X Eleven',1999,2003,1137)
])
bulk('Honda','CBX', [('CBX550F',1982,1986,572),('CBX650E',1983,1986,655),('CBX750F',1984,1988,747),('CBX1000',1978,1982,1047)])
bulk('Honda','CBR', [('CBR125R',2004,2010,125),('CBR250R',1986,1996,249),('CBR400RR',1987,1999,399),('CBR500F',1986,1993,498),('CBR600F',1987,2010,599),('CBR600RR',2003,2010,599),('CBR900RR Fireblade',1992,2003,893),('CBR929RR Fireblade',2000,2001,929),('CBR954RR Fireblade',2002,2003,954),('CBR1000F',1987,1999,998),('CBR1000RR Fireblade',2004,2010,998),('CBR1100XX Blackbird',1996,2007,1137)])
# key Honda type codes
for r in rows:
    if r['brand']=='Honda' and r['model']=='CBR600F':
        r['series']=[{'code':'PC19','from':1987,'to':1988},{'code':'PC23','from':1989,'to':1990},{'code':'PC25','from':1991,'to':1994},{'code':'PC31','from':1995,'to':1998},{'code':'PC35','from':1999,'to':2006},{'from':2007,'to':2010,'variant':'CBR600F / regional'}]
        r['aliases'] += ['PC19','PC23','PC25','PC31','PC35']
    if r['brand']=='Honda' and r['model']=='CBR1000RR Fireblade':
        r['series']=[
            {'code':'SC57','variant':'SC57 2004-2005','from':2004,'to':2005},
            {'code':'SC57','variant':'SC57 Facelift 2006-2007','from':2006,'to':2007},
            {'code':'SC59','variant':'SC59 2008-2010','from':2008,'to':2010},
        ]
        r['aliases'] += ['CBR 1000 Fireblade','CBR 1000 RR','CBR1000RR','SC57','SC 57','SC59','SC 59','Fireblade SC57','Fireblade SC59']
bulk('Honda','VF/VFR', [('VF500F',1984,1986,498),('VF750F',1983,1986,748),('VF1000F',1984,1987,998),('VFR400R',1986,1993,399),('VFR750F',1986,1997,748),('VFR750R RC30',1987,1990,748),('VFR800',1998,2010,782),('VFR800 VTEC',2002,2010,782),('VTR1000F Firestorm',1997,2006,996),('VTR1000 SP-1',2000,2001,999),('VTR1000 SP-2',2002,2006,999)])
bulk('Honda','Touring', [('CX500',1978,1983,497),('CX650',1983,1986,674),('GL1000 Gold Wing',1975,1979,999),('GL1100 Gold Wing',1980,1983,1085),('GL1200 Gold Wing',1984,1987,1182),('GL1500 Gold Wing',1988,2000,1520),('GL1800 Gold Wing',2001,2010,1832),('ST1100 Pan European',1990,2002,1085),('ST1300 Pan European',2002,2010,1261),('NTV650 Revere',1988,1997,647),('NT650V Deauville',1998,2005,647),('NT700V Deauville',2006,2010,680),('DN-01',2008,2010,680)])
bulk('Honda','Adventure/Enduro', [('XL125',1974,1988,124),('XL250',1972,1987,248),('XL350',1974,1985,339),('XL500',1979,1982,497),('XL600R',1983,1987,591),('XL600V Transalp',1987,2000,583),('XL650V Transalp',2000,2007,647),('XL700V Transalp',2008,2010,680),('XLV750R',1983,1986,749),('XRV650 Africa Twin',1988,1990,647),('XRV750 Africa Twin',1990,2003,742),('NX250',1988,1995,249),('NX650 Dominator',1988,2003,644),('XR250R',1979,2007,249),('XR400R',1996,2004,397),('XR600R',1985,2000,591),('XR650R',2000,2007,649),('XR650L',1993,2010,644),('Varadero 125',2001,2010,125),('Varadero 1000',1999,2010,996),('FMX650',2005,2008,644)])
for r in rows:
    if r['brand']=='Honda' and r['model']=='XL600V Transalp':
        r['series']=[{'code':'PD06','from':1987,'to':1996},{'code':'PD10','from':1997,'to':2000}];r['aliases']+=['PD06','PD10']
    if r['brand']=='Honda' and r['model']=='XRV650 Africa Twin':
        r['series']=[{'code':'RD03','from':1988,'to':1990}];r['aliases']+=['RD03']
    if r['brand']=='Honda' and r['model']=='XRV750 Africa Twin':
        r['series']=[{'code':'RD04','from':1990,'to':1992},{'code':'RD07','from':1993,'to':2003}];r['aliases']+=['RD04','RD07']
bulk('Honda','Cruiser', [('VT500C Shadow',1983,1988,491),('VT600C Shadow',1988,2007,583),('VT750C Shadow',1983,2010,745),('VT1100C Shadow',1985,2007,1099),('VTX1300',2003,2009,1312),('VTX1800',2001,2008,1795),('CMX250 Rebel',1985,2010,234)])

# YAMAHA
bulk('Yamaha','XS', [('XS1',1970,1971,653),('XS250',1977,1982,248),('XS360',1976,1977,358),('XS400',1977,1984,399),('XS500',1975,1978,498),('XS650',1970,1985,653),('XS650 Special',1978,1985,653),('XS750',1976,1979,747),('XS850',1980,1981,826),('XS1100',1978,1981,1101)])
for r in rows:
    if r['brand']=='Yamaha' and r['model']=='XS400':
        r['series']=[{'code':'2A2','from':1977,'to':1982},{'code':'4G5','from':1980,'to':1982},{'code':'12E','from':1982,'to':1984}];r['aliases']+=['2A2','4G5','12E','XS400 2A2','XS400 4G5','XS400 12E']
bulk('Yamaha','RD/RZ/TZR', [('RD125',1973,1987,123),('RD200',1973,1976,195),('RD250',1970,1980,247),('RD350',1970,1975,347),('RD400',1976,1979,398),('RD250LC',1980,1984,247),('RD350LC',1980,1986,347),('RD500LC',1984,1986,499),('RZ250',1980,1988,247),('RZ350',1983,1995,347),('TZR125',1987,2003,124),('TZR250',1986,1996,249),('TDR125',1993,2003,124),('TDR250',1988,1993,249)])
bulk('Yamaha','SR/XT/TT', [('SR125',1982,2003,124),('SR250',1980,1996,239),('SR500',1978,1999,499),('XT125',1982,2010,124),('XT250',1980,2010,249),('XT350',1985,2000,346),('XT500',1976,1989,499),('XT550',1982,1983,558),('XT600',1984,2003,595),('XT600Z Ténéré',1983,1990,595),('XT660R',2004,2010,660),('XT660X',2004,2010,660),('XT660Z Ténéré',2008,2010,660),('TT350',1985,1996,346),('TT600',1983,2004,595)])
bulk('Yamaha','DT', [('DT125',1974,2010,123),('DT175',1974,2006,171),('DT250',1971,1982,246),('DT400',1975,1979,397)])
bulk('Yamaha','XJ/FJ', [('XJ400',1980,1993,399),('XJ550',1981,1984,528),('XJ600',1984,2003,598),('XJ650',1980,1984,653),('XJ750',1981,1985,749),('XJ900',1983,2003,891),('XJ900 Diversion',1994,2003,892),('XJ6',2009,2010,600),('FJ600',1984,1985,598),('FJ1100',1984,1985,1097),('FJ1200',1986,1996,1188)])
bulk('Yamaha','FZR/YZF', [('FZR400',1986,1994,399),('FZR600',1989,1999,599),('FZR750',1987,1992,749),('FZR1000',1987,1995,1002),('YZF600R Thundercat',1996,2007,599),('YZF750R',1993,1998,749),('YZF1000R Thunderace',1996,2002,1002),('YZF-R1',1998,2010,998),('YZF-R6',1999,2010,599),('YZF-R7 OW02',1999,2000,749)])
for r in rows:
    if r['brand']=='Yamaha' and r['model']=='YZF-R1':
        r['series']=[{'code':'RN01','from':1998,'to':1999},{'code':'RN04','from':2000,'to':2001},{'code':'RN09','from':2002,'to':2003},{'code':'RN12','from':2004,'to':2006},{'code':'RN19','from':2007,'to':2008},{'code':'RN22','from':2009,'to':2010}];r['aliases'] += ['R1','RN01','RN04','RN09','RN12','RN19','RN22']
    if r['brand']=='Yamaha' and r['model']=='YZF-R6':
        r['series']=[{'code':'RJ03','from':1999,'to':2002},{'code':'RJ05','from':2003,'to':2004},{'code':'RJ09','from':2005,'to':2005},{'code':'RJ11','from':2006,'to':2007},{'code':'RJ15','from':2008,'to':2010}];r['aliases'] += ['R6','RJ03','RJ05','RJ09','RJ11','RJ15']
bulk('Yamaha','Sport/Touring', [('TDM850',1991,2001,849),('TDM900',2002,2010,897),('TRX850',1995,1999,849),('FZS600 Fazer',1998,2003,599),('FZS1000 Fazer',2001,2005,998),('FZ6',2004,2010,600),('FZ1',2006,2010,998),('GTS1000',1993,1999,1002),('BT1100 Bulldog',2002,2006,1063),('MT-01',2005,2010,1670),('MT-03',2006,2010,660),('V-Max 1200',1985,2007,1198),('VMAX 1700',2009,2010,1679)])
bulk('Yamaha','Adventure', [('XTZ660 Ténéré',1991,1999,660),('XTZ750 Super Ténéré',1989,1996,749)])
bulk('Yamaha','Cruiser', [('XV535 Virago',1987,2003,535),('XV750 Virago',1981,1998,748),('XV920 Virago',1981,1983,920),('XV1000 Virago',1984,1985,981),('XV1100 Virago',1986,1999,1063),('XVS650 Drag Star',1997,2010,649),('XVS1100 Drag Star',1999,2009,1063),('XV1600 Wild Star',1999,2004,1602),('XV1700 Warrior',2002,2010,1670),('XVZ1300 Royal Star',1996,2010,1294)])

# SUZUKI
bulk('Suzuki','GT/RG', [('GT250',1971,1977,247),('GT380',1972,1977,371),('GT550',1972,1977,543),('GT750',1971,1977,738),('RG125 Gamma',1985,1996,124),('RG250 Gamma',1983,1987,247),('RG500 Gamma',1985,1987,498),('RGV250',1988,1998,249)])
bulk('Suzuki','GS', [('GS400',1976,1981,398),('GS425',1979,1980,423),('GS450',1980,1988,448),('GS500',1989,2010,487),('GS550',1977,1986,549),('GS650',1981,1984,673),('GS750',1977,1983,748),('GS850',1979,1986,843),('GS1000',1978,1982,997),('GS1100',1980,1983,1074)])
bulk('Suzuki','GSX/Katana', [('GSX400',1980,1999,398),('GSX550',1983,1987,572),('GSX750',1980,2006,747),('GSX1100',1980,1998,1074),('GSX750S Katana',1982,1985,747),('GSX1100S Katana',1981,2006,1074),('GSX1200 Inazuma',1998,2001,1157),('GSX1400',2001,2008,1402),('B-King',2008,2010,1340)])
bulk('Suzuki','GSX-R', [('GSX-R400',1984,1999,398),('GSX-R600',1992,2010,599),('GSX-R750',1985,2010,750),('GSX-R1000',2001,2010,999),('GSX-R1100',1986,1998,1127),('GSX1300R Hayabusa',1999,2010,1340)])
for r in rows:
    if r['brand']=='Suzuki' and r['model']=='GSX-R750':
        r['series']=[
            {'code':'GR75A','variant':'1985-1987','from':1985,'to':1987},
            {'code':'GR77B','variant':'Slingshot 1988-1989','from':1988,'to':1989},
            {'code':'GR7AB','variant':'1990-1991','from':1990,'to':1991},
            {'code':'GR7BB','variant':'W 1992-1995','from':1992,'to':1995},
            {'code':'GR7DB','variant':'SRAD 1996-1997','from':1996,'to':1997},
            {'code':'GR7DB','variant':'SRAD 1998-1999','from':1998,'to':1999},
            {'code':'WVBD','variant':'K1/K2/K3 2000-2003','from':2000,'to':2003},
            {'code':'WVB3','variant':'K4/K5 2004-2005','from':2004,'to':2005},
            {'code':'WVCF','variant':'K6/K7 2006-2007','from':2006,'to':2007},
            {'code':'WVCW','variant':'K8/K9/L0 2008-2010','from':2008,'to':2010},
        ]
        r['aliases'] += ['GSXR750','GR75A','GR77B','GR7AB','GR7BB','GR7DB','WVBD','WVB3','WVCF','WVCW','GSXR 750 SRAD','GSX-R 750 SRAD']
    if r['brand']=='Suzuki' and r['model']=='GSX-R1000':
        r['series']=[{'variant':'K1/K2','from':2001,'to':2002},{'variant':'K3/K4','from':2003,'to':2004},{'variant':'K5/K6','from':2005,'to':2006},{'variant':'K7/K8','from':2007,'to':2008},{'variant':'K9/L0','from':2009,'to':2010}];r['aliases'] += ['GSXR1000','K1','K2','K3','K4','K5','K6','K7','K8','K9','L0']
bulk('Suzuki','Bandit', [('GSF400 Bandit',1989,1997,398),('GSF600 Bandit',1995,2004,599),('GSF650 Bandit',2005,2010,656),('GSF1200 Bandit',1996,2006,1157),('GSF1250 Bandit',2007,2010,1255)])
for r in rows:
    if r['brand']=='Suzuki' and r['model']=='GSF1200 Bandit':
        r['series']=[{'code':'GV75A','from':1996,'to':2000},{'code':'WVA9','from':2001,'to':2006}];r['aliases'] += ['Bandit 1200','GV75A','WVA9']
    if r['brand']=='Suzuki' and r['model']=='GSF1250 Bandit':
        r['series']=[{'code':'WVCH','from':2007,'to':2010}];r['aliases'] += ['Bandit 1250','WVCH']
bulk('Suzuki','V-Twin', [('SV400',1998,2006,399),('SV650',1999,2010,645),('SV1000',2003,2007,996),('TL1000S',1997,2001,996),('TL1000R',1998,2003,996),('Gladius SFV650',2009,2010,645)])
for r in rows:
    if r['brand']=='Suzuki' and r['model']=='SV650':
        r['series']=[{'code':'AV','from':1999,'to':2002},{'code':'WVBY','from':2003,'to':2010}];r['aliases'] += ['SV650 Knubbel','SV650 Kante','AV','WVBY']
    if r['brand']=='Suzuki' and r['model']=='SV1000':
        r['series']=[
            {'code':'WVBX','variant':'SV1000S','from':2003,'to':2007},
            {'code':'WVBX','variant':'SV1000N','from':2003,'to':2007},
        ]
        r['aliases'] += ['SV1000S','SV 1000 S','SV-1000-S','SV1000N','SV 1000 N','SV-1000-N','WVBX']
bulk('Suzuki','Sport/Touring', [('RF600R',1993,1997,599),('RF900R',1994,1999,937),('GSX600F',1988,2006,599),('GSX750F',1989,2006,750),('GSX1250FA',2010,2010,1255)])
bulk('Suzuki','Enduro/Adventure', [('DR125',1982,2010,124),('DR200',1986,2010,199),('DR350',1990,1999,349),('DR400',1980,1981,396),('DR500',1981,1984,498),('DR600',1985,1989,589),('DR650',1990,2010,644),('DR750 Big',1988,1989,727),('DR800 Big',1990,1999,779),('DR-Z400',2000,2010,398),('XF650 Freewind',1997,2003,644),('DL650 V-Strom',2004,2010,645),('DL1000 V-Strom',2002,2010,996)])
bulk('Suzuki','Cruiser', [('LS650 Savage',1986,2010,652),('VS600 Intruder',1995,1997,599),('VS750 Intruder',1985,1991,747),('VS800 Intruder',1992,2005,805),('VS1400 Intruder',1987,2003,1360),('VL800 Volusia',2001,2004,805),('VZ800 Marauder',1997,2004,805),('M800 Intruder',2005,2010,805),('M1800R Intruder',2006,2010,1783)])

# KAWASAKI
bulk('Kawasaki','Two-stroke', [('H1 500 Mach III',1970,1976,498),('H2 750 Mach IV',1972,1975,748),('KH250',1976,1980,249),('KH400',1976,1980,400),('KH500',1976,1977,498)])
bulk('Kawasaki','Z', [('Z200',1977,1984,198),('Z250',1979,2010,249),('Z400',1974,1983,398),('Z440',1980,1984,443),('Z500',1979,1980,498),('Z550',1980,1989,553),('Z650',1976,1983,652),('Z750',1976,2010,748),('Z900',1972,1976,903),('Z1000',1977,2010,1015),('Z1100',1981,1985,1089),('Z1300',1979,1989,1286),('ZRX1100',1997,2000,1052),('ZRX1200',2001,2008,1164)])
bulk('Kawasaki','GPZ/GPX', [('GPZ305',1983,1994,306),('GPZ500S',1987,2009,498),('GPZ550',1981,1989,553),('GPZ600R',1985,1990,592),('GPZ750',1982,1987,738),('GPZ900R',1984,2003,908),('GPZ1000RX',1986,1988,997),('GPZ1100',1981,1998,1052),('GPX600R',1988,1997,592),('GPX750R',1987,1990,748)])
bulk('Kawasaki','Ninja/ZX', [('Ninja 250R',1988,2010,249),('Ninja 500R',1987,2009,498),('ZXR400',1989,2003,398),('ZXR750',1989,1995,749),('ZX-6R',1995,2010,599),('ZX-7R',1996,2003,748),('ZX-9R',1994,2003,899),('ZX-10R',2004,2010,998),('ZX-12R',2000,2006,1199),('ZX-14 / ZZR1400',2006,2010,1352)])
bulk('Kawasaki','ZZR/GTR', [('ZZR250',1990,2007,248),('ZZR400',1990,2006,399),('ZZR600',1990,2008,599),('ZZR1100',1990,2001,1052),('ZZR1200',2002,2005,1164),('GTR1000',1986,2006,997),('GTR1400',2007,2010,1352)])
bulk('Kawasaki','Middleweight', [('ER-5',1997,2006,498),('ER-6n',2005,2010,649),('ER-6f',2006,2010,649),('Versys 650',2007,2010,649),('W650',1999,2006,676),('Zephyr 550',1990,1999,553),('Zephyr 750',1991,1999,738),('Zephyr 1100',1992,1997,1062)])
bulk('Kawasaki','Enduro', [('KLR250',1984,2005,249),('KLR600',1984,1986,564),('KLR650',1987,2010,651),('KLE500',1991,2007,498),('KLX250',1993,2010,249),('KLX650',1993,1996,651)])
bulk('Kawasaki','Cruiser', [('EN500',1990,2009,498),('VN750 Vulcan',1985,2006,749),('VN800 Vulcan',1995,2006,805),('VN900 Vulcan',2006,2010,903),('VN1500 Vulcan',1987,2008,1470),('VN1600 Vulcan',2002,2008,1552),('VN1700 Vulcan',2009,2010,1700),('VN2000 Vulcan',2004,2010,2053),('ZL600 Eliminator',1986,1997,592),('ZL900 Eliminator',1985,1986,908),('ZL1000 Eliminator',1987,1988,997)])

# BMW
bulk('BMW','Airhead', [('R50/5',1970,1973,498),('R60/5',1970,1973,599),('R75/5',1970,1973,745),('R60/6',1973,1976,599),('R75/6',1973,1976,745),('R90/6',1973,1976,898),('R90S',1973,1976,898),('R60/7',1976,1980,599),('R75/7',1976,1977,745),('R80/7',1977,1984,797),('R100/7',1976,1984,980),('R45',1978,1985,473),('R65',1978,1993,649),('R80',1984,1995,797),('R80 G/S',1980,1987,797),('R80 GS',1987,1996,797),('R100RS',1976,1992,980),('R100RT',1978,1996,980),('R100GS',1987,1996,980),('R100R',1991,1996,980)])
bulk('BMW','K', [('K75',1985,1996,740),('K75C',1985,1990,740),('K75S',1986,1995,740),('K75RT',1989,1996,740),('K100',1983,1992,987),('K100RS',1983,1992,987),('K100RT',1984,1989,987),('K100LT',1986,1991,987),('K1',1988,1993,987),('K1100RS',1992,1996,1092),('K1100LT',1992,1999,1092),('K1200RS',1997,2005,1171),('K1200LT',1999,2009,1171),('K1200GT',2003,2008,1157),('K1200R',2005,2008,1157),('K1200S',2005,2008,1157),('K1300R',2009,2010,1293),('K1300S',2009,2010,1293),('K1300GT',2009,2010,1293)])
bulk('BMW','Oilhead/Hexhead', [('R850R',1994,2007,848),('R850RT',1996,2006,848),('R1100R',1994,2001,1085),('R1100RS',1993,2001,1085),('R1100RT',1996,2001,1085),('R1100GS',1994,1999,1085),('R1100S',1998,2005,1085),('R1150R',2001,2006,1130),('R1150RS',2001,2005,1130),('R1150RT',2001,2004,1130),('R1150GS',1999,2004,1130),('R1150GS Adventure',2002,2005,1130),('R1200R',2006,2010,1170),('R1200RT',2005,2010,1170),('R1200GS',2004,2010,1170),('R1200GS Adventure',2006,2010,1170),('R1200S',2006,2008,1170),('HP2 Enduro',2005,2008,1170),('HP2 Megamoto',2007,2009,1170),('HP2 Sport',2008,2010,1170)])
bulk('BMW','F/G/S', [('F650 Funduro',1993,2000,652),('F650ST',1997,2000,652),('F650GS',2000,2007,652),('F650CS Scarver',2002,2005,652),('F650GS Twin',2008,2010,798),('F800S',2006,2010,798),('F800ST',2006,2010,798),('F800GS',2008,2010,798),('G650 Xcountry',2007,2009,652),('G650 Xchallenge',2007,2009,652),('G650 Xmoto',2007,2009,652),('G650GS',2009,2010,652),('S1000RR',2009,2010,999)])

# DUCATI
bulk('Ducati','Classic/Pantah', [('750 GT',1971,1974,748),('750 Sport',1972,1974,748),('900 Super Sport',1975,1982,864),('500 Pantah',1979,1983,499),('600 Pantah',1981,1984,583),('650 Pantah',1983,1986,649),('Indiana 650',1986,1990,649),('Paso 750',1986,1990,748),('Paso 906',1989,1990,904),('907 i.e.',1990,1993,904)])
bulk('Ducati','Superbike', [('851',1987,1992,851),('888',1991,1994,888),('916',1994,1998,916),('996',1999,2001,996),('998',2002,2004,998),('748',1994,2002,748),('749',2003,2006,749),('999',2003,2006,999),('848',2008,2010,849),('1098',2007,2009,1099),('1198',2009,2010,1198),('Desmosedici RR',2007,2008,989)])
bulk('Ducati','Monster', [('Monster 600',1994,2001,583),('Monster 620',2002,2006,618),('Monster 695',2007,2008,695),('Monster 696',2008,2010,696),('Monster 750',1996,2002,748),('Monster 800',2003,2005,803),('Monster 900',1993,2002,904),('Monster 1000',2003,2005,992),('Monster S2R 800',2005,2007,803),('Monster S2R 1000',2006,2008,992),('Monster S4',2001,2003,916),('Monster S4R',2003,2008,996),('Monster 1100',2009,2010,1078)])
bulk('Ducati','Sport Touring', [('600SS',1994,1998,583),('750SS',1991,2002,748),('900SS',1989,2002,904),('1000SS',2003,2006,992),('ST2',1997,2003,944),('ST3',2004,2007,992),('ST4',1999,2005,916),('Multistrada 620',2005,2006,618),('Multistrada 1000',2003,2006,992),('Multistrada 1100',2007,2009,1078),('Multistrada 1200',2010,2010,1198),('Sport 1000',2006,2009,992),('GT1000',2007,2010,992),('Paul Smart 1000 LE',2006,2006,992),('Hypermotard 1100',2007,2010,1078),('Hypermotard 796',2010,2010,803)])

# TRIUMPH
bulk('Triumph','Classic', [('Bonneville T120',1970,1975,649),('Bonneville T140',1973,1988,744),('Trident T150',1970,1975,740),('Trident T160',1975,1976,740),('Tiger TR7',1973,1983,744)])
bulk('Triumph','Hinckley', [('Trident 750',1991,1998,749),('Trident 900',1991,1998,885),('Trophy 900',1991,2001,885),('Trophy 1200',1991,2003,1180),('Daytona 750',1991,1993,749),('Daytona 900',1993,1996,885),('Daytona T595 / 955i',1997,2006,955),('Daytona 600',2003,2004,599),('Daytona 650',2005,2005,646),('Daytona 675',2006,2010,675),('Speed Triple 750',1994,1996,749),('Speed Triple 900',1994,1996,885),('Speed Triple 955i',1997,2004,955),('Speed Triple 1050',2005,2010,1050),('Sprint 900',1993,1998,885),('Sprint ST 955i',1999,2004,955),('Sprint ST 1050',2005,2010,1050),('Tiger 900',1993,1998,885),('Tiger 955i',1999,2006,955),('Tiger 1050',2007,2010,1050),('Thunderbird 900',1995,2004,885),('Legend TT',1998,2001,885),('Adventurer 900',1996,2001,885),('Rocket III',2004,2010,2294),('Bonneville 790',2001,2006,790),('Bonneville 865',2007,2010,865),('Thruxton 900',2004,2010,865),('Scrambler 900',2006,2010,865),('Street Triple 675',2007,2010,675)])

# KTM
bulk('KTM','LC4/Duke', [('400 LC4',1993,2001,398),('620 LC4',1994,1998,609),('640 LC4',1998,2007,625),('660 SMC',2003,2006,654),('690 Enduro',2008,2010,654),('620 Duke',1994,1998,609),('640 Duke II',1999,2006,625),('690 Duke',2008,2010,654)])
bulk('KTM','Adventure/Road', [('640 Adventure',1998,2007,625),('950 Adventure',2003,2005,942),('990 Adventure',2006,2010,999),('950 Super Enduro',2006,2009,942),('950 Supermoto',2005,2008,942),('990 Supermoto',2008,2010,999),('990 Super Duke',2005,2010,999),('1190 RC8',2008,2010,1148)])
bulk('KTM','EXC/SX', [('125 EXC',1990,2010,125),('200 EXC',1998,2010,193),('250 EXC',1990,2010,249),('300 EXC',1990,2010,293),('400 EXC',2000,2010,398),('450 EXC',2003,2010,449),('520 EXC',2000,2002,510),('525 EXC',2003,2007,510),('530 EXC',2008,2010,510),('125 SX',1990,2010,125),('250 SX',1990,2010,249),('450 SX-F',2003,2010,449),('525 SX',2003,2007,510)])

# APRILIA
bulk('Aprilia','Two-stroke', [('AF1 125',1987,1992,124),('RS50',1992,2010,49),('RS125',1992,2010,124),('RS250',1995,2002,249),('RX125',1985,2010,124),('MX125',2004,2006,124),('Classic 125',1995,1999,124)])
bulk('Aprilia','Adventure/Road', [('Tuareg 125',1985,1994,124),('Tuareg 350',1986,1990,349),('Tuareg 600',1988,1994,562),('Pegaso 600',1990,1993,562),('Pegaso 650',1992,2010,652),('Moto 6.5',1995,2002,649),('RSV Mille',1998,2003,998),('RSV 1000 R',2004,2010,998),('Tuono 1000',2002,2010,998),('SL1000 Falco',1999,2005,998),('RST1000 Futura',2001,2004,998),('ETV1000 Caponord',2001,2007,998),('Shiver 750',2007,2010,750),('Dorsoduro 750',2008,2010,750),('Mana 850',2007,2010,839),('SXV 450',2006,2010,449),('SXV 550',2006,2010,549),('RXV 450',2006,2010,449),('RXV 550',2006,2010,549)])

# MOTO GUZZI
bulk('Moto Guzzi','Classic', [('V7 Special',1970,1972,757),('V7 Sport',1971,1974,748),('850 T',1973,1975,844),('850 T3',1975,1981,844),('850 T4',1980,1982,844),('850 T5',1983,1988,844),('1000 SP',1978,1994,949),('V1000 G5',1978,1985,949),('Le Mans 850',1976,1984,844),('Le Mans 1000',1984,1993,949),('California 850',1972,1982,844),('California 1000',1982,1994,949),('California 1100',1994,2010,1064)])
bulk('Moto Guzzi','Small block', [('V35',1977,1992,346),('V50',1977,1986,490),('V65',1982,1994,643),('V75',1985,1996,744),('Nevada 750',1991,2010,744)])
bulk('Moto Guzzi','Modern', [('Daytona 1000',1992,1999,992),('Centauro 1000',1996,2000,992),('Sport 1100',1994,2000,1064),('V11 Sport',1999,2006,1064),('Breva 750',2003,2010,744),('Breva 850',2006,2008,877),('Breva 1100',2005,2008,1064),('Breva 1200',2008,2010,1151),('Griso 850',2006,2008,877),('Griso 1100',2005,2008,1064),('Griso 1200 8V',2007,2010,1151),('Norge 850',2007,2008,877),('Norge 1200',2006,2010,1151),('Stelvio 1200',2008,2010,1151),('Bellagio 940',2007,2010,936)])

# HARLEY-DAVIDSON
bulk('Harley-Davidson','Sportster', [('XLH 1000 Sportster',1970,1985,997),('XLH 883 Sportster',1986,2010,883),('XLH 1200 Sportster',1988,2010,1202),('XL 883 Iron',2009,2010,883),('XL 1200N Nightster',2007,2010,1202),('XR1000',1983,1984,997),('XR1200',2008,2010,1202),('XL1200X Forty-Eight',2010,2010,1202)])
bulk('Harley-Davidson','Big Twin', [('FX Super Glide',1971,1984,1207),('FXE Super Glide',1974,1984,1207),('FXS Low Rider',1977,1985,1340),('FXWG Wide Glide',1980,1986,1340),('FXR Super Glide',1982,1994,1340),('FXDL Dyna Low Rider',1993,2010,1584),('FXD Dyna Super Glide',1995,2010,1584),('FXDWG Dyna Wide Glide',1993,2010,1584),('FXDF Dyna Fat Bob',2008,2010,1584),('FXST Softail Standard',1984,2010,1584),('FXSTC Softail Custom',1986,2010,1584),('FLSTC Heritage Softail Classic',1986,2010,1584),('FLSTF Fat Boy',1990,2010,1584),('FLSTS Heritage Springer',1997,2003,1450),('FLHR Road King',1994,2010,1584),('FLHT Electra Glide',1983,2010,1584),('FLHX Street Glide',2006,2010,1584),('FLTR Road Glide',1998,2010,1584)])
bulk('Harley-Davidson','V-Rod', [('VRSCA V-Rod',2002,2006,1131),('VRSCD Night Rod',2006,2008,1131),('VRSCDX Night Rod Special',2007,2010,1247),('VRSCF V-Rod Muscle',2009,2010,1247)])

# HUSQVARNA
bulk('Husqvarna','Two-stroke', [('WR125',1985,2010,125),('WR250',1985,2010,249),('WR300',2009,2010,293),('WR360',1992,2002,349),('CR125',1970,2010,125),('CR250',1970,2005,249),('CR500',1983,1988,488),('WRE125',1998,2010,125),('SMS125',1998,2010,125)])
bulk('Husqvarna','Four-stroke', [('TE250',2002,2010,249),('TE310',2009,2010,302),('TE350',1990,1995,348),('TE400',1990,2001,399),('TE410',1995,2001,399),('TE450',2003,2010,449),('TE510',2004,2010,501),('TE610',1991,2010,576),('SM400R',2002,2004,399),('SM450R',2003,2010,449),('SM510R',2005,2010,501),('SM570R',2001,2004,576),('SM610',1998,2010,576)])

# Additional established manufacturers that already appeared in the project brand detector
bulk('Benelli','Road', [('750 Sei',1974,1977,747),('900 Sei',1978,1989,906),('Tornado 900 Tre',2002,2006,898),('TNT 1130',2004,2010,1130),('Tre-K 1130',2006,2010,1130)])
bulk('MV Agusta','Road', [('750 S',1970,1975,743),('F4 750',1999,2004,749),('F4 1000',2005,2010,998),('Brutale 750',2001,2005,749),('Brutale 910',2005,2008,909),('Brutale 1078',2008,2009,1078),('Brutale 990R',2010,2010,998)])
bulk('Royal Enfield','Bullet', [('Bullet 350',1970,2010,346),('Bullet 500',1989,2010,499),('Electra 500',2002,2009,499),('Classic 500',2009,2010,499)])

# Normalize and validate
seen=set(); out=[]
for r in rows:
    if r['production']['from']<1970: r['production']['from']=1970
    if r['production']['to']>2010: r['production']['to']=2010
    key=(r['brand'].lower(),r['model'].lower())
    if key in seen:
        raise SystemExit(f'duplicate {key}')
    seen.add(key)
    # unique aliases, longest first improves matching
    uniq=[]; ss=set()
    for a in r['aliases']:
        k=re.sub(r'\s+',' ',a.strip()).lower()
        if k and k not in ss: ss.add(k);uniq.append(a.strip())
    r['aliases']=sorted(uniq,key=len,reverse=True)
    out.append(r)

out=sorted(out,key=lambda x:(x['brand'],x['family'],x['production']['from'],x['model']))
path=Path(__file__).resolve().parents[1]/'data/motorcycle-catalog.json'
path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('wrote',len(out),'models', 'brands',len(set(x['brand'] for x in out)))
for b in sorted(set(x['brand'] for x in out)):
    print(b,sum(1 for x in out if x['brand']==b))
