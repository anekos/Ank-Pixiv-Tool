# coding: utf-8

import sys
import os
import os.path
import shutil
import json

def main():
  orig = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../source/manifest_orig.json'))
  path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../source/manifest.json'))

  if not os.path.exists(path):
    print(path, 'not found')
    sys.exit()
  if not os.path.exists(orig):
    shutil.copyfile(path, orig)
  f = open(orig, 'r')
  json_man = json.load(f)
  f.close()
  json_man['applications'] = {
    "gecko": {
      "id": "loot@vixip.kna",
      "strict_min_version": "55.0"
    }
  }
  f = open(path, 'w')
  print(json.dumps(json_man, indent=2),file=f)
  f.close()


if __name__ == '__main__':
  main()
