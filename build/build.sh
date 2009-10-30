#!/usr/bin/zsh

xpi=ank_pixiv_tool.xpi

cd ../source
rm ../build/$xpi

case $1 in
  locale)
    zip -r ../build/$xpi chrome.manifest defaults document install.rdf chrome/content chrome/locale/en-US chrome/locale/ja-JP
  ;;

  all)
    zip -r ../build/$xpi chrome.manifest defaults document install.rdf chrome/content chrome/locale
  ;;
  *)
    echo "all or locale?"
esac

cd ../build

# cd ../build
# hash=`sha1sum $relxpi | sed "s/ .*//" | perl -i -pe 's/[\r\n]//g' `
# 
# echo $hash
# echo -n $hash | putclip
# 
# vi $reldir/original_update.rdf

