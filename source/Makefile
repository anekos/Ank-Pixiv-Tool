
XPI=ank_pixiv_tool.xpi

.PHONY: all clean

all:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale

locale:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale/en-US chrome/locale/ja-JP

apply: all
	firefox ank_pixiv_tool.xpi

clean:
	rm -f $(XPI)

publish: all
	scp ank_pixiv_tool.xpi snca.net:/srv/www/www.snca.net/public/blogfiles/$(FILENAME)
