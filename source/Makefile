
XPI=ank_pixiv_tool.xpi

.PHONY: all clean

all:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale

locale:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale/en-US chrome/locale/ja-JP

clean:
	rm -f $(XPI)

publish: all
	scp ank_pixiv_tool.xpi linode:/srv/www/www.snca.net/public/blogfiles/$(FILENAME)
