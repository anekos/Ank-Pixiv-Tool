
XPI=ank_pixiv_tool.xpi
XPI_MS=ank_pixiv_tool-mutlisite.xpi

.PHONY: all clean

all:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale

all-ms:
	zip -r $(XPI_MS) chrome.manifest defaults install.rdf chrome/content chrome/locale

locale:
	zip -r $(XPI) chrome.manifest defaults install.rdf chrome/content chrome/locale/en-US chrome/locale/ja-JP

apply: all
	firefox ank_pixiv_tool.xpi

clean:
	rm -f $(XPI)

publish: all
	scp $(XPI) snca.net:/srv/www/www.snca.net/public/blogfiles/$(FILENAME)
	echo "http://www.kurinton.net/~snca/blogfiles/${XPI}"
	echo "http://www.kurinton.net/~snca/blogfiles/${XPI}" | xclip -i

publish-ms: all-ms
	scp $(XPI_MS) snca.net:/srv/www/www.snca.net/public/blogfiles/$(FILENAME)
	echo 'http://www.kurinton.net/~snca/blogfiles/'$(XPI_MS)
	echo 'http://www.kurinton.net/~snca/blogfiles/'$(XPI_MS) | xclip -i
