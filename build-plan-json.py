from pathlib import Path
from collections import defaultdict
import json

plans = Path('./plans')
out = defaultdict(list)

for plan in plans.glob('**/*.txt'):
  with open(plan, 'r', encoding="ISO-8859-1") as f:
    by = plan.parts[1]
    out[by].append({
      'by': by,
      'time': plan.stem,
      'contents': f.read()
    })
    
    continue

with open('./src/public/plans.json', 'w') as f:
  json.dump(out, f)