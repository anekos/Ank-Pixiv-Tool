# coding: utf-8

import os
import os.path
import sys
import sqlite3
from optparse import OptionParser
import time
from datetime import datetime
import codecs
import json

def main():
    parser = OptionParser()
    parser.add_option('-i', '--input', dest='src', help='ankpixiv.sqlite')
    parser.add_option('-o', '--output', dest='dst', help='output file (json)')
    (opts, args) = parser.parse_args(sys.argv[1:])

    if opts.src is None:
        parser.print_help()
        sys.exit()

    try:
        f = sys.stdout if opts.dst is None else codecs.open(opts.dst, 'w', 'utf-8')
        conn = sqlite3.connect(opts.src, isolation_level='DEFERRED')
        cursor = conn.cursor()
        print('{"h":[', file=f)
        for row in cursor.execute("SELECT service_id,illust_id,member_id,datetime FROM histories WHERE service_id IS NOT NULL"):
            d = ['' if n is None else n for n in row]
            ts = str(int(time.mktime(datetime.strptime(d[3][0:19], '%Y-%m-%d %H:%M:%S').timetuple()))) + d[3][20:23]
            print(json.dumps([d[0], str(d[1]), str(d[2]), ts]) + ',', file=f)
        print('[]],"m":[', file=f)
        for row in cursor.execute("SELECT service_id,id,name FROM members WHERE service_id IS NOT NULL"):
            d = ['' if n is None else n for n in row]
            print(json.dumps([d[0], str(d[1]), d[2]]) + ',', file=f)
        print('[]]}', file=f)
    except Exception as e:
        print (e)
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.commit()

    if conn:
        cursor.close()


if __name__ == '__main__':
    main()
