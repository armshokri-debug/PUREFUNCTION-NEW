"""
One-off converter: old Pure Function exercise library (1,222 entries) ->
src/data/exerciseCatalog.json in the Pure Function 2 Exercise shape.

Usage: python3 scripts/build-exercise-catalog.py <old trueCoachExerciseLibrary.ts>
"""
import json, re, sys
from urllib.parse import urlparse, parse_qs

src = open(sys.argv[1]).read()
rows = json.loads(src[src.index('= [') + 2: src.rindex(']') + 1])

PATTERN = {'Squat': 'Squat', 'Bend': 'Hinge', 'Single Leg': 'Lunge / Single Leg', 'Push': 'Push',
           'Pull': 'Pull', 'Core': 'Core', 'Mobility': 'Mobility', 'Locomotion': 'Locomotion',
           'Complex': 'Complex', 'Cyclical': 'Conditioning'}
PLANE = {'Sagittal': 'Sagittal', 'Saggital': 'Sagittal', 'Frontal': 'Frontal',
         'Transverse': 'Transverse', 'Multiple': 'Multiplanar', 'Multiplane': 'Multiplanar'}
EQUIP = [
    (r'\b(barbell|bb|trap bar|hex bar|landmine|ez bar)\b', 'Barbell'),
    (r'\b(kettlebell|kb|kbs)\b', 'Kettlebell'),
    (r'\b(dumbbell|db|dbs)\b', 'Dumbbell'),
    (r'\b(cable|band|banded|mini band|tube|resistance)\b', 'Cable / Band'),
    (r'\b(machine|sled|rower|row erg|bike|smith|ski ?erg|leg press|lat pulldown)\b', 'Machine'),
    (r'\b(foam roll\w*|roller|lacrosse ball|peanut)\b', 'Foam Roller'),
]

def video(url):
    u = urlparse(url.strip())
    host = u.netloc.replace('www.', '').replace('m.', '')
    if host in ('youtube.com', 'youtu.be'):
        vid = u.path[1:].split('/')[0] if host == 'youtu.be' else (parse_qs(u.query).get('v') or [None])[0]
        if not vid:
            m = re.match(r'^/(?:shorts|embed|live)/([^/?#]+)', u.path)
            vid = m.group(1) if m else None
        if vid and re.fullmatch(r'[A-Za-z0-9_-]{11}', vid):
            return {'kind': 'youtube', 'src': vid}
    if host in ('vimeo.com', 'player.vimeo.com'):
        m = re.search(r'(?:^|/video)/(\d{6,})(?:/([0-9a-f]{6,}))?', u.path)
        if m:
            return {'kind': 'vimeo', 'src': m.group(1) + (f'?h={m.group(2)}' if m.group(2) else '')}
    return None

def cues(text):
    t = (text or '').strip()
    if not t or 'with controlled posture and active core bracing' in t:
        return []  # generated filler in the old data, not real coaching cues
    parts = re.split(r'\s*\b\d{1,2}\.\s+', t)
    parts = [p.strip(' .') for p in parts if p.strip(' .')]
    if len(parts) <= 1:
        parts = [p.strip(' .') for p in re.split(r'(?<=[.!?])\s+(?=[A-Z])', t) if p.strip(' .')]
    return [p + '.' for p in parts][:10]

def body_part(pattern, muscles):
    m = muscles.lower()
    if pattern in ('Squat', 'Hinge', 'Lunge / Single Leg'):
        return 'Lower'
    if pattern in ('Push', 'Pull'):
        return 'Upper'
    if pattern == 'Core':
        return 'Core'
    if pattern == 'Mobility':
        if 'hip' in m or 'adductor' in m:
            return 'Hips'
        if any(k in m for k in ('rotator', 'shoulder', 'deltoid', 'scap')):
            return 'Upper'
        if 'thoracic' in m or 'oblique' in m:
            return 'Core'
        if any(k in m for k in ('ankle', 'calves', 'foot', 'quadriceps', 'hamstring')):
            return 'Lower'
    return None

def body_part_from_name(name):
    n = name.lower()
    for words, part in (
        (('hip', 'glute', 'adductor', '90/90', 'pelvi'), 'Hips'),
        (('squat', 'lunge', 'deadlift', 'rdl', 'step up', 'calf', 'ankle', 'hamstring', 'quad', 'knee', 'leg'), 'Lower'),
        (('press', 'row', 'pull', 'push', 'shoulder', 'scap', 'chest', 'bicep', 'tricep', 'lat ', 'wrist', 'arm'), 'Upper'),
        (('plank', 'dead bug', 'core', 'ab ', 'abs', 'oblique', 'thoracic', 'spine', 'rotation', 'breath', 'carry'), 'Core'),
    ):
        if any(w in n for w in words):
            return part
    return 'Full Body'

out, seen = [], set()
for r in rows:
    name = re.sub(r'\s+', ' ', r['name']).strip()
    key = name.lower()
    if not name or key in seen:
        continue
    seen.add(key)
    muscles = [m.strip() for m in r['primaryMuscles'].split(',') if m.strip()]
    pattern = PATTERN.get(r['patterns'].strip())
    if 'Diaphragm' in r['primaryMuscles']:
        pattern = 'Breathing'
    equip = next((e for rx, e in EQUIP if re.search(rx, name, re.I)), None)
    if not equip:
        equip = 'Bodyweight' if r['types'] in ('Bodyweight', 'Mobility', 'Stability', 'Speed', '') else 'Other'
    ex = {
        'id': 'cat-' + re.sub(r'[^a-z0-9]+', '-', key).strip('-')[:60] + '-' + r['id'].split('-')[-1],
        'name': name,
        'bodyPart': body_part(pattern, r['primaryMuscles']) or body_part_from_name(name),
        'equipment': equip,
        'cues': cues(r['instructions']),
        'source': 'catalog',
    }
    if pattern: ex['pattern'] = pattern
    plane = PLANE.get(r['planes'].strip())
    if plane: ex['plane'] = plane
    if muscles: ex['muscles'] = muscles
    v = video(r['videoUrl'])
    if v: ex['video'] = {**v, 'addedAt': '2026-10-01T00:00:00.000Z'}
    out.append(ex)

out.sort(key=lambda e: e['name'].lower())
json.dump(out, open('src/data/exerciseCatalog.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'exercises,', sum(1 for e in out if 'video' in e), 'with video,', sum(1 for e in out if e['cues']), 'with cues')
