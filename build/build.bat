set name=ank_pixiv_tool-1.0.x

7z a -tzip "%name%.xpi" ..\source\* -x!*.svn -r -mx=9
PAUSE
