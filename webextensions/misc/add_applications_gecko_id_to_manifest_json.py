# coding: utf-8

import sys
import os
import os.path
import json
from optparse import OptionParser

def main():
  parser = OptionParser()
  parser.add_option('-i', '--input', dest='input_folder', help='input folder', default='./source')
  parser.add_option('-o', '--output', dest='output_folder', help='output folder')
  (opts, args) = parser.parse_args(sys.argv[1:])

  orig = os.path.abspath(os.path.join(opts.input_folder, 'manifest.json'))
  if opts.output_folder:
    path = os.path.abspath(os.path.join(opts.output_folder, 'manifest.json'))
  else:
    path = None

  if not os.path.exists(orig) or orig == path:
    print("invalid arguments", file=sys.stderr)
    sys.exit(1)

  fin = open(orig, 'r')
  json_man = json.load(fin)
  fin.close()

  json_man['permissions'] = [x for x in json_man['permissions'] if x != "downloads.shelf"]
  json_man['applications'] = {
    "gecko": {
      "id": "ankpixiv@snca.net",
      "strict_min_version": "56.0"
    }
  }

  if path:
    fout = open(path, 'w')
  else:
    fout = sys.stdout
  print(json.dumps(json_man, indent=2),file=fout)

if __name__ == '__main__':
  main()
