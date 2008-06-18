set name=ank_pixiv_tool-1.0.x

cd C:\root\project\FirefoxAddons\ank_pixiv\trunk\build\

copy %1 ..\source\
7z a -tzip "%name%.xpi" ..\source\* -x!*.svn -r -mx=9
sha1sum "%name%.xpi"

PAUSE
