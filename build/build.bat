set name=ank_pixiv

7z a -tzip "%name%.xpi" ..\source\* -x!*.svn -r -mx=9
PAUSE
