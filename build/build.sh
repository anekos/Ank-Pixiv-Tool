#!/usr/bin/zsh

xpi=ank_pixiv_tool.xpi

cd ../source
rm ../build/$xpi
zip -r ../build/$xpi *

cd ../build

# cd ../build
# hash=`sha1sum $relxpi | sed "s/ .*//" | perl -i -pe 's/[\r\n]//g' `
# 
# echo $hash
# echo -n $hash | putclip
# 
# vi $reldir/original_update.rdf

