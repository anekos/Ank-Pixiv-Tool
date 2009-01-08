#!/usr/bin/zsh

version=$1
xpi=ank_pixiv_tool-$version.xpi
reldir=release/$version
relxpi=$reldir/$xpi

cd /root/project/AnkPixivTools/build

cp -r "release/$version/install.rdf" ../source/

cd ../source
rm ../build/$relxpi
zip -r ../build/$relxpi *

cd ../build

# cd ../build
# hash=`sha1sum $relxpi | sed "s/ .*//" | perl -i -pe 's/[\r\n]//g' `
# 
# echo $hash
# echo -n $hash | putclip
# 
# vi $reldir/original_update.rdf

