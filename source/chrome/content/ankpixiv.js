
try{

AnkPixiv = {

  /********************************************************************************
  * 定数
  ********************************************************************************/

  VERSION: AnkUtils.getVersion('ankpixiv@snca.net'),

  PREF_PREFIX: 'extensions.ankpixiv.',

  XPath: {
    // xpathFavLink = '//div[@id="pixiv"]/div/div/a/img/parent::*/parent::*/preceding-sibling::div[1]';
    // xpathImgAnchor = '//div[@id="pixiv"]/div/div/a/img/parent::*/self::*';
    // xpathImg = '//div[@id="pixiv"]/div/div/a/img';
    mediumImage: '//div[@id="content2"]/div/a/img',
    bigImage: '//div[@id="illust_contents"]/a/img',
    authorIconLink: '//div[@id="profile"]/div/a',
    tags: '//span[@id="tags"]/a',
  },


  Storage: new AnkStorage("ankpixiv.sqlite", 
    {
      histories: {
        illust_id: "integer",
        member_id: "integer",
        local_path: "string",
        tags: "string",
        server: "string"
      },
    }
  ),

  
  Prefs: new AnkPref('extensions.ankpixiv'),



  /********************************************************************************
  * プロパティ
  ********************************************************************************/

  get currentLocation function () {
    return window.content.document.location.href;
  },


  get currentImagePath function () {
    if (this.currentLocation.match(/mode=medium/)) {
      var elem = AnkUtils.findNodeByXPath(this.XPath.mediumImage);
    } else {
      var elem = AnkUtils.findNodeByXPath(this.XPath.bigImage);
    }
    return elem && elem.src.replace(/_m\./, '.');
  },


  get currentImageExt function () {
    return this.currentImagePath.match(/\.\w+$/)[0] || '.jpg';
  },


  get currentImageTitleAndAuthor function () {
    return this.currentDocument.title.replace(' [pixiv]', '');
  },


  get currentImageAuthorId function () {
    try {
      return AnkUtils.findNodeByXPath(this.XPath.authorIconLink).getAttribute('href').replace(/^.*id=/, '');
    } catch (e) { }
  },


  get currentImageId function () {
    try {
      return this.currentImagePath.match(/\/(\d+)(_m)?\.\w{2,4}$/)[1];
    } catch (e) { }
  },

  get currentImageAuthor function () {
    return AnkUtils.trim(this.currentImageTitleAndAuthor.replace(/^.+\/\s*([^\/]+?)\s*$/, '$1'));
  },


  get currentImageTitle function () {
    return AnkUtils.trim(this.currentImageTitleAndAuthor.replace(/^\s*(.+?)\s*\/[^\/]+$/, '$1'));
  },


  get currentImageTags function () {
    var as = AnkUtils.findNodesByXPath(this.XPath.tags);
    var node, res = [];
    while (node = as.iterateNext()) {
      res.push(AnkUtils.trim(node.textContent));
    }
    return res;
  },


  get currentDocument function () {
    return window.content.document;
  },


  get enabled function () {
    return this.currentLocation.match(/\.pixiv\.net\/member_illust.php\?/);
  },



  /********************************************************************************
  * ダイアログ関連
  ********************************************************************************/

  /*
   * showFilePicker
   *    defaultFilename: 初期ファイル名
   *    return:          選択されたファイルのパス(nsIFilePicker)
   * ファイル保存ダイアログを開く
   */
  showFilePicker: function (defaultFilename) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

    filePicker.appendFilters(nsIFilePicker.filterAll);
    filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
    filePicker.defaultString = defaultFilename;

    var prefInitDir = this.Prefs.get('initialDirectory');
    if (prefInitDir) {
      var initdir = AnkUtils.ccci("@mozilla.org/file/local;1", Components.interfaces.nsILocalFile);
      initdir.initWithPath(prefInitDir);
      filePicker.displayDirectory = initdir;
    }
    
    return (filePicker.show() == nsIFilePicker.returnOK) && filePicker;
  },


  /*
   * showDirectoryPicker
   *    defaultPath: 初期表示ディレクトリ
   *    return:      選択されたディレクトリ(nsIFilePicker)
   * ディレクトリ選択ダイアログを表示
   */
  showDirectoryPicker: function (defaultPath) {
    try {
      var nsIFilePicker = Components.interfaces.nsIFilePicker;
      var filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);
      filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeGetFolder);
      filePicker.appendFilters(nsIFilePicker.filterAll);
    
      if (filePicker.show() == nsIFilePicker.returnOK) {
        return filePicker;
      }
    }
    catch (e) {
      alert(e);
    }
  },


  /*
   * TODO
   * queryInitialDirectory 
   * ユーザに初期ディレクトリの場所を尋ねる
   */
  queryInitialDirectory: function () {
    var dir = this.showDirectoryPicker(this.Prefs.get('initialDirectory'));
    if (dir) {
      this.Prefs.set('initialDirectory', dir.filePath, 'string');
    }
    return dir;
  },



  /********************************************************************************
  * ダウンロード＆ファイル関連
  ********************************************************************************/

  /*
   * fileExists
   *    url:      String パスURL
   *    return:   boolean
   * ファイルが存在するか？
   */
  fileExists: function (url) {
    return this.newLocalFile(url).exists();
  },


  /*
   * newLocalFile
   *    url:      String パスURL
   *    return:   nsILocalFile
   * nsILocalFileを作成
   */
  newLocalFile: function (url) {
    var IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
    // バージョン毎に場合分け(いらないかも)
    try { 
      var fileHandler = IOService.getProtocolHandler('file').
                          QueryInterface(Components.interfaces.nsIFileProtocolHandler);
      temp = fileHandler.getFileFromURLSpec(url);
    }
    catch(ex) {
      try {
        temp = IOService.getFileFromURLSpec(url);
      }
      catch(ex) { 
        temp = AnkUtils.ccci('@mozilla.org/file/local;1', Components.interfaces.nsILocalFile);
        IOService.initFileFromURLSpec(temp, url);
      }
    }
    return temp;
  },


  /*
   * newFileURI
   *    url:      String パスURL
   *    return:   nsILocalFile
   * nsILocalFileを作成
   */
  newFileURI: function (url) {
    var IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
    return IOService.newFileURI(this.newLocalFile(url));
  },


  /*
   * getSaveFilePath 
   *    author:             作者名
   *    titles:             タイトルの候補のリスト(一個以上必須)
   *    ext:                拡張子
   *    useDialog:          保存ダイアログを使うか？
   *    return:             nsIFilePickerかそれもどき
   * ファイルを保存すべきパスを返す
   * 設定によっては、ダイアログを表示する
   */
  getSaveFilePath: function (author, titles, ext, useDialog) {
    try {
      var IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      var prefInitDir = this.Prefs.get('initialDirectory');

      for (var i in titles) {
        var title = AnkUtils.fixFilename(titles[i]);
        var filename = title + ' - ' + author + ext;
        var url = 'file://' + prefInitDir + AnkUtils.SYS_SLASH + filename;
        var localfile = this.newLocalFile(url);

        if (localfile.exists())
          continue;

        if (useDialog) {
          return this.showFilePicker(filename);
        } else {
          var res = IOService.newFileURI(localfile);
          return {fileURL: res, file: res};
        }
      }
    } catch (e) { dump(e); }

    return this.showFilePicker(titles[0] + ' - ' + author + ext);
  },


  /*
   * downloadFile
   *    url:        URL
   *    referer:    リファラ
   *    author:     作者名
   *    filenames:  ファイル名の候補リスト
   *    ext:        拡張子
   *    useDialog:  保存ダイアログを使うか？
   *    return:     成功?
   * ファイルをダウンロードする
   */ 
  downloadFile: function (url, referer, author, filenames, ext, useDialog) {
    // 保存ダイアログ
    var filePicker = this.getSaveFilePath(author, filenames, ext, useDialog);
    if (!filePicker)
      return;

    // 各種オブジェクトの生成
    var sourceURI = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                      newURI(url, null, null);
    var dlmanager = AnkUtils.ccgs('@mozilla.org/download-manager;1', Components.interfaces.nsIDownloadManager);
    var wbpersist = AnkUtils.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                              Components.interfaces.nsIWebBrowserPersist);
    var refererURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
    refererURI.spec = referer;

    // ダウンロードマネジャに追加
    var label = filenames[0] + ' - ' + author;
    var download = dlmanager.addDownload(0, sourceURI, filePicker.fileURL, label, null, null, null, null, wbpersist);

    // キャッシュ
    var cache = null;
    try {
      with (getWebNavigation().sessionHistory) 
        cache = getEntryAtIndex(index, false).QueryInterface(Components.interfaces.nsISHEntry).postData;
    } catch (e) { }


    /* for Firefox3
    // 進行状況リスナ
    var dlplistener = {
      onDownloadStateChange: function (state, donwload) {
        dump(state);
      },
      onStateChange: function () {
      },
      onProgressChange: function () {
      },
      onStatusChange: function () {
      },
      onLocationChange: function () {
      },
      onSecurityChange: function () {
      },
    };
    dlmanager.addListener(dlplistener);
    */
      
    // 保存開始
    wbpersist.progressListener = download;
    wbpersist.persistFlags |= Components.interfaces.nsIWebBrowserPersist.
                                PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
    wbpersist.saveURI(sourceURI, cache, refererURI, null, null, filePicker.file);

    // 成功
    return filePicker.fileURL.path;
  },


  /*
   * downloadCurrentImage
   *    useDialog:  保存ダイアログを使うか？
   *    return:     成功？
   * 現在表示されている画像を保存する
   */
  downloadCurrentImage: function (useDialog) {
    if (!this.enabled)
      return false;

    if (this.Prefs.get('checkExistingDownload') &&
    this.Storage.exists('histories', 'illust_id = ' + this.currentImageId)) {
      if (!confirm('すでにダウンロードされた画像ですが、再度ダウンロードしますか？'))
        return;
    }

    var url = this.currentImagePath;
    var ref = this.currentLocation.replace(/mode=medium/, 'mode=big');
    var author = this.currentImageAuthor || this.currentImageAuthorId;
    var titles = this.currentImageTags;
    var title = this.currentImageTitle;

    if (title) {
      titles.unshift(title);
    } else {
      titles.push(this.currentImageId);
    }

    var result = this.downloadFile(url, ref, author, titles, this.currentImageExt, useDialog);

    try {
      dump('result: ' + result + "\n");
      this.Storage.insert('histories', {
        member_id: this.currentImageAuthorId,
        illust_id: this.currentImageId,
        tags: AnkUtils.join(this.currentImageTags, ' '),
        server: this.currentImagePath.match(/^http:\/\/([^\/\.]+)\./i)[1],
        local_path: result,
      });
    } catch (e) {dump(e); }

    return result;
  },



  /********************************************************************************
  * イベント
  ********************************************************************************/

  openPrefWindow: function () {
    window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                      "centerscreen,chrome,modal", arguments);
  },


  onFocus: function (ev) {
    var f = function (id) {
      var elem = document.getElementById(id);
      if (!elem)
        return;
      elem.setAttribute('disabled', !this.enabled);
    };
    f.call(this, 'ankpixiv-toolbar-button');
    f.call(this, 'ankpixiv-statusbarpanel');
    f.call(this, 'ankpixiv-menu-download');
  },


  onDownloadButtonClick: function (event) {
    var useDialog = this.Prefs.get('showSaveDialog', true);
    switch(event.button) {
      case 0:
        this.downloadCurrentImage(useDialog);
        break;
      case 1:
        this.downloadCurrentImage(!useDialog);
        break;
      case 2:
        this.openPrefWindow();
        break;
    }
  },
};


/********************************************************************************
* イベント設定
********************************************************************************/


window.addEventListener("focus", function() { AnkPixiv.onFocus(); }, true);


} catch (e) {
  dump(e + "\n");
}
