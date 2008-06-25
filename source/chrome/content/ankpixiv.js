
try {

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
      mediumImageLink: '//div[@id="content2"]/div/a',
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
          title: "string",
          tags: "string",
          server: "string",
          datetime: "datetime",
          saved: "boolean",
          filename: "string",
        },
        members: {
          id: "integer",
          name: "string",
        }
      }
    ),

    
    Prefs: new AnkPref('extensions.ankpixiv'),


    AllPrefs: new AnkPref(),


    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),


    URL: {
      Pixiv: 'http://www.pixiv.net/',
    },


    MAX_ILLUST_ID: 960000,


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get currentLocation function () {
      return window.content.document.location.href;
    },


    get inPixiv function () {
      return this.currentLocation.match(/^http:\/\/[^\.\/]+\.pixiv\.net\//i);
    },


    get inMedium function () {
      return this.inPixiv && this.currentLocation.match(/member_illust\.php\?mode=medium&illust_id=\d+/);
    },


    get randomImagePageURL function () {
      var id = parseInt(Math.random() * this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID));
      return 'http://www.pixiv.net/member_illust.php?mode=medium&illust_id=' + id;
    },


    get currentImagePath function () {
      if (this.currentLocation.match(/mode=medium/)) {
        var elem = AnkUtils.findNodeByXPath(this.XPath.mediumImage);
      } else {
        var elem = AnkUtils.findNodeByXPath(this.XPath.bigImage);
      }
      return elem && elem.src.replace(/_m\./, '.');
    },


    get currentBigImagePath function () {
      return this.currentImagePath.replace(/_m\./, '.');
    },


    get currentImageExt function () {
      return this.currentImagePath.match(/\.\w+$/)[0] || '.jpg';
    },


    // CHECK - Pixiv のバグに対応するためのコード
    get currentDocumentTitle function () {
      var res = this.currentDocument.getElementsByTagName('title')[0].textContent;
      return AnkUtils.decodeHtmlSpChars(res);
    },


    get currentImageTitleAndAuthor function () {
      return this.currentDocumentTitle.replace(' [pixiv]', '');
    },


    get currentImageAuthorId function () {
      try {
        return AnkUtils.findNodeByXPath(this.XPath.authorIconLink).getAttribute('href').replace(/^.*id=/, '');
      } catch (e) { }
    },


    get currentImageId function () {
      try {
        return parseInt(this.currentImagePath.match(/\/(\d+)(_m)?\.\w{2,4}$/)[1]);
      } catch (e) { return 0; }
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
      return this.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/);
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


    popupAlert: function (title, text) {
      return AnkUtils.popupAlert("chrome://ankpixiv/content/statusbar-button.ico", 
                                 title, text, false, "", null);
    },

    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    /*
     * filenameExists
     *    filename:      String パスfilename
     *    return:   boolean
     * 同じファイル名が存在するか？
     */
    filenameExists: function (filename) {
      var se = function () {
        return AnkPixiv.Storage.exists('histories', 
                                   'filename like ?', 
                                   function (stmt) {
                                     stmt.bindUTF8StringParameter(0, filename);
                                   });
      };
      return se();
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
          var filename = author + ' - ' + title + ext;
          var url = 'file://' + prefInitDir + AnkUtils.SYS_SLASH + filename;
          var localfile = this.newLocalFile(url);

          if (localfile.exists() || this.filenameExists(filename))
            continue;

          if (useDialog) {
            return this.showFilePicker(filename);
          } else {
            var res = IOService.newFileURI(localfile);
            return {fileURL: res, file: res};
          }
        }
      } catch (e) { dump(e); }

      return this.showFilePicker(author + ' - ' + titles[0] + ext);
    },


    /*
     * downloadFile
     *    url:            URL
     *    referer:        リファラ
     *    author:         作者名
     *    filenames:      ファイル名の候補リスト
     *    ext:            拡張子
     *    useDialog:      保存ダイアログを使うか？
     *    return:         成功?
     *    onComplete      終了時のアラート
     * ファイルをダウンロードする
     */ 
    downloadFile: function (url, referer, author, filenames, ext, useDialog, onComplete) {
      // 保存ダイアログ
      var filePicker = this.getSaveFilePath(author, filenames, ext, useDialog);
      if (!filePicker)
        return;

      // 各種オブジェクトの生成
      var sourceURI = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                        newURI(url, null, null);
      var wbpersist = AnkUtils.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                                Components.interfaces.nsIWebBrowserPersist);
      var refererURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
      refererURI.spec = referer;

      // ダウンロードマネジャに追加
      var label = author + ' - ' + filenames[0];

      // キャッシュ
      var cache = null;
      try {
        with (getWebNavigation().sessionHistory) 
          cache = getEntryAtIndex(index, false).QueryInterface(Components.interfaces.nsISHEntry).postData;
      } catch (e) { }


      // ダウンロード通知
      var $ = this;
      var progressListener = {
        onStateChange: function (_webProgress, _request, _stateFlags, _status) {
          if (_stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
            if (onComplete) {
              var orig_args = arguments;
              onComplete.call($, orig_args, filePicker.fileURL.path);
            }
          }
        },
        onProgressChange: function (_webProgress, _request, _curSelfProgress, _maxSelfProgress, 
                                    _curTotalProgress, _maxTotalProgress) { },
        onLocationChange: function (_webProgress, _request, _location) {},
        onStatusChange  : function (_webProgress, _request, _status, _message) {},
        onSecurityChange: function (_webProgress, _request, _state) {},
      }

        
      // 保存開始
      wbpersist.progressListener = progressListener;
      wbpersist.persistFlags = Components.interfaces.nsIWebBrowserPersist.
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
      try {

        if (!this.enabled)
          return false;

        var url = this.currentImagePath;
        var illust_id = this.currentImageId;
        var ref = this.currentLocation.replace(/mode=medium/, 'mode=big');
        var author = this.currentImageAuthor || this.currentImageAuthorId;
        var titles = this.currentImageTags;
        var title = this.currentImageTitle;

        if (this.Prefs.get('checkExistingDownload') &&
        this.Storage.exists('histories', 'illust_id = ' + illust_id)) {
          if (!confirm(this.Locale('downloadExistingImage')))
            return;
        }

        if (title) {
          titles.unshift(title);
        } else {
          titles.push(this.currentImageId);
        }

        var record = {
          member_id: this.currentImageAuthorId,
          illust_id: this.currentImageId,
          title: this.currentImageTitle,
          tags: AnkUtils.join(this.currentImageTags, ' '),
          server: this.currentImagePath.match(/^http:\/\/([^\/\.]+)\./i)[1],
          saved: true,
          datetime: AnkUtils.toSQLDateTimeString(),
        };

        var onComplete = function (orig_args, local_path) {
          var caption = this.Locale('finishedDownload');
          var text = title + ' / ' + author;
          var local_path = decodeURIComponent(local_path);

          if (this.Prefs.get('saveHistory', true)) {
            try {
              record['local_path'] = local_path;
              record['filename'] = AnkUtils.extractFilename(local_path);
              this.Storage.insert('histories', record);
            } catch (e) {
              AnkUtils.dumpError(e);
              caption = 'Error - onComplete';
              text = e;
            }
          }

          this.popupAlert(caption, text);
          return true;
        };

        var result = this.downloadFile(url, ref, author, titles, this.currentImageExt, useDialog, onComplete);

        return result;

      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    get functionsInstaller function () {
      var $ = this;
      var ut = AnkUtils;
      var installInterval = 500;
      var installer = null;
      var doc = this.currentDocument;

      var delay = function (msg) {
        AnkUtils.dump(msg);
        setTimeout(installer, installInterval);
        installInterval += 500;
      };

      installer = function () {

        // 完全に読み込まれて以内っぽいときは、遅延する
        try {
          var body = doc.getElementsByTagName('body')[0];
          var wrapper = doc.getElementById('wrapper');
          var medImg = AnkUtils.findNodeByXPath($.XPath.mediumImage);
          var bigImgPath = $.currentBigImagePath;
        } catch (e) {
          AnkUtils.dumpError(e);
          return delay("delay installation by error");
        }

        // 完全に読み込まれて以内っぽいときは、遅延する
        if (!(body && medImg && bigImgPath && wrapper))
          return delay("delay installation by null");

        // 大画像関係
        (function () {
          var div = doc.createElement('div');
          div.setAttribute('style', 'position: absolute; top: 0px; left: 0px; width:100%; height: auto; background: white; text-align: center; padding-top: 10px; padding-bottom: 100px; display: none; -moz-opacity: 1;');

          var bigImg = doc.createElement('img');

          div.appendChild(bigImg);
          body.appendChild(div);
          var bigMode = false;

          doc.addEventListener('click', function (e) { 
            if (bigMode && (e.button == 0)) {
              div.style.display = 'none'; 
              wrapper.setAttribute('style', '-moz-opacity: 1;');
              bigMode = false;
              return;
            }
            if ((e.target.src == medImg.src) && (e.button == 0)) {
              bigMode = true;
              e.preventDefault();
              bigImg.setAttribute('src', bigImgPath);
              window.content.scrollTo(0, 0);
              div.style.display = ''; 
              wrapper.setAttribute('style', '-moz-opacity: 0.1;');
              bigImg.style['-moz-opacity'] = '1 !important;';
              return;
            }
          }, true);

        })();

        // レイティングによるダウンロード
        (function () {
          if (!$.Prefs.get('downloadWhenRate', false))
            return;
          var point = $.Prefs.get('downloadRate', 10);
          var elem, iter = AnkUtils.findNodesByXPath("//ul[@class='unit-rating']/li/a");
          while (elem = iter.iterateNext()) {
            var m = elem.className.match(/r(\d{1,2})-unit/);
            if (m && (point <= parseInt(m[1]))) {
              elem.addEventListener('click', function(){$.downloadCurrentImage();}, true);
            }
          }
        })();


        AnkUtils.dump('installed');
      };

      return installer;
    },


    installFunctions: function () {
      var doc = this.currentDocument;
      if (doc.ankpixivFunctionsIntalled)
        return;
      doc.ankpixivFunctionsIntalled = true;
      if (this.inMedium)
        this.functionsInstaller();
    },


    /********************************************************************************
    * データ修正など
    ********************************************************************************/

    fixStorageEncode: function () {
      try {
        var storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        var db = this.Storage.database;
        var updates = [];

        var update = function (columnName, value, rowid) {
          updates.push(function () {
            var stmt = db.createStatement('update histories set ' + columnName + ' =  ?1 where rowid = ?2');
            try {
              stmt.bindUTF8StringParameter(0, value); 
              stmt.bindInt32Parameter(1, rowid); 
              stmt.execute();
            } finally {
              stmt.reset();
            }
          });
        };

        var stmt = db.createStatement('select rowid, * from histories');
        stmt.reset();
        storageWrapper.initialize(stmt);
        while (storageWrapper.step()) {
          var rowid = storageWrapper.row["rowid"];
          var filename = storageWrapper.row["filename"];
          var local_path = storageWrapper.row["local_path"];
          if (local_path) update('local_path', decodeURIComponent(local_path), rowid);
          if (filename)
            update('filename', decodeURIComponent(filename), rowid);
          else 
            update('filename', decodeURIComponent(AnkUtils.extractFilename(local_path)), rowid);
        }
        for (var i in updates) {
          (updates[i])();
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    exchangeFilename: function () {
      try {
        var storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        var db = this.Storage.database;
        var updates = [];

        var update = function (columnName, value, rowid) {
          updates.push(function () {
            var stmt = db.createStatement('update histories set ' + columnName + ' =  ?1 where rowid = ?2');
            try {
              stmt.bindUTF8StringParameter(0, value); 
              stmt.bindInt32Parameter(1, rowid); 
              stmt.execute();
            } finally {
              stmt.reset();
            }
          });
        };

        var stmt = db.createStatement('select rowid, * from histories where rowid >= 180');
        stmt.reset();
        storageWrapper.initialize(stmt);
        while (storageWrapper.step()) {
          var rowid = storageWrapper.row["rowid"];
          var filename = storageWrapper.row["filename"];
          if (filename) {
            update('filename', filename.replace(/^([^\-]+) - ([^\.]+)(\.\w{2,4})$/, '$2 - $1$3'), rowid);
          }
        }
        for (var i in updates) {
          (updates[i])();
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    /********************************************************************************
    * イベント
    ********************************************************************************/

    openPrefWindow: function () {
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                        "centerscreen,chrome,modal", arguments);
    },


    onLoad: function (event) {
      if (!(this.inPixiv && this.inMedium))
        return;
      try {
        var doc = event.originalTarget;
        if (!doc || doc.nodeName != "#document")
            return;
        window.removeEventListener("load", AnkPixiv.onLoad, false);
        window.addEventListener("DOMContentLoaded", function(){ AnkPixiv.installFunctions(); }, false);
      } catch (e) {
        //AnkUtils.dumpError(e);
      }
    },


    onFocus: function (ev) {

      var changeEnabled = function (id) {
        var elem = document.getElementById(id);
        if (!elem)
          return;
        elem.setAttribute('dark', !this.enabled);
      };

      changeEnabled.call(this, 'ankpixiv-toolbar-button');
      changeEnabled.call(this, 'ankpixiv-statusbarpanel');
      changeEnabled.call(this, 'ankpixiv-menu-download');

      if (this.enabled) {
        this.installFunctions();
        var illust_id = this.currentImageId;
        if (this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID) < illust_id) {
          this.Prefs.set('maxIllustId', illust_id);
        }
      }
    },


    onDownloadButtonClick: function (event) {
      var useDialog = this.Prefs.get('showSaveDialog', true);
      if (this.enabled) {
        switch(event.button) {
          case 0: this.downloadCurrentImage(useDialog); break;
          case 1: this.downloadCurrentImage(!useDialog); break;
          case 2: this.openPrefWindow(); break;
        }
      } else {
        var open = function (left) {
          var tab = AnkPixiv.AllPrefs.get('extensions.tabmix.opentabfor.bookmarks', false);
          if (!!left ^ !!tab)
            AnkUtils.loadURI(AnkPixiv.URL.Pixiv);
          else
            AnkUtils.openTab(AnkPixiv.URL.Pixiv);
        };
        switch(event.button) {
          case 0: open(true); break;
          case 1: open(false); break;
          case 2: this.openPrefWindow(); break;
        }
      }
      event.preventDefault();
    },
  };


  /********************************************************************************
  * イベント設定
  ********************************************************************************/

  //AnkPixiv.fixStorageEncode();
  //AnkPixiv.exchangeFilename();
  window.addEventListener("focus", function() { AnkPixiv.onFocus(); }, true);
  window.addEventListener("load", function() { AnkPixiv.onLoad(); }, true);


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
