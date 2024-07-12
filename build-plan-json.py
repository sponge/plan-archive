from pathlib import Path
import json

plans = Path('./plans')
out = []

for plan in plans.glob('**/*.txt'):
  with open(plan, 'r', encoding="ISO-8859-1") as f:
    out.append({
      'by': plan.parts[1],
      'time': int(plan.stem),
      'contents': f.read()
    })

with open('./public/plans.json', 'w') as f:
  json.dump(out, f)