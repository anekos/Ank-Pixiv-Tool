
var AnkPixiv = {

  /********************************************************************************
  * 定数
  ********************************************************************************/

  VERSION: (function () {
    const id = 'ankpixiv@snca.net';
    const ext = Components.classes["@mozilla.org/extensions/manager;1"]
                  .getService(Components.interfaces.nsIExtensionManager)
                  .getItemForID(id);
    return ext.version;
  })(),


  SYS_SLASH: (function () {
    try {
      var props = Components.classes["@mozilla.org/file/directory_service;1"].
                    getService(Components.interfaces.nsIProperties);
      var file = props.get("ProfD", Components.interfaces.nsIFile);
      file.append('dummy');
      return (file.path.indexOf('/') != -1) ? '/' : '\\';
    } catch (e) {
      return '/';
    }
  })(),


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


  Tables: {
    histories: {
      illust_id: "integer",
      member_id: "integer",
      local_path: "string",
      tags: "string",
      server: "string"
    }
  },


  //TODO
  Storage: (function () {
    try {
      var file = Components.classes["@mozilla.org/file/directory_service;1"].
                  getService(Components.interfaces.nsIProperties).
                  get("ProfD", Components.interfaces.nsIFile);
      file.append("ankpixiv.sqlite");
      var storageService = Components.classes["@mozilla.org/storage/service;1"].
                             getService(Components.interfaces.mozIStorageService);
      var db = storageService.openDatabase(file);
      return db;
    } catch (e) {
      dump(e);
    }
  })(),


  /********************************************************************************
  * 文字列関数
  ********************************************************************************/

  /*
   * fixFilename
   *    filename: ファイル名
   *    return:   ファイル名
   * ファイル名として使えない文字を除去する。
   */
  fixFilename: function (filename) {
    return filename.replace(/[\\\/:,;\*\?\"<>\|]/g, '_');
  },


  /*
   * trim
   * 文字列の前後の空白系を取り除く
   */
  trim: function (str) {
    return str.replace(/^\s*|\s*$/g, '');
  },


  /*
   * join
   *    list:   リスト
   *    deli:   区切り文字
   */
  join: function (list, deli) {
    if (!deli)
      deli = ',';
    var result = "";
    for (var i = 0; i < list.length; i++) {
      result += list[i].toString();
      if (i < (list.length - 1))
        result += deli;
    }
    return result;
  },



  /********************************************************************************
  * 手抜き用関数
  ********************************************************************************/

  /*
   * ccgs
   *    klass:
   *    service:
   * Components.classes[klass].getService(service)
   */
  ccgs: function (klass, service) {
    return Components.classes[klass].getService(service);
  },


  /*
   * ccci 
   *    klass:
   *    _interface:
   * Components.classes[klass].createInstance(interface)
   */
  ccci: function (klass, _interface) {
    return Components.classes[klass].createInstance(_interface);
  },



  /********************************************************************************
  * 設定関数
  ********************************************************************************/

  /*
   * prefs
   *    nsIPrefBranch
   */
  prefs: Components.classes["@mozilla.org/preferences-service;1"].
           getService(Components.interfaces.nsIPrefBranch),


  /* 
   * getPref
   *    name:   項目名
   *    def:    デフォルト値
   *    return: 項目の値
   * 設定値を取得
   */
  getPref: function (name, def) {
    var name = this.PREF_PREFIX + name;
    var type = this.prefs.getPrefType(name);
    const nsIPrefBranch = Components.interfaces.nsIPrefBranch;
    try {
      switch (type) {
        case nsIPrefBranch.PREF_STRING:
          try {
            return this.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
          }
          catch (e) {
            this.prefs.getCharPref(name);
          }
          break;
        case nsIPrefBranch.PREF_INT:
          return this.prefs.getIntPref(name);
          break;
        case nsIPrefBranch.PREF_BOOL:
          return this.prefs.getBoolPref(name);
        default:
          return def;
      }
    } catch (e) {
      return def;
    }
  },


  /*
   * setPref
   *    name:   項目名
   *    value:  設定する値
   *    type:   型(省略可)
   *    return: ?
   */
  setPref: function (name, value, type) {
    var name = this.PREF_PREFIX + name;
    switch (type || typeof value) {
      case 'string':
        var str = this.ccci('@mozilla.org/supports-string;1', Components.interfaces.nsISupportsString);
        str.data = value;
        return this.prefs.setComplexValue(name, Components.interfaces.nsISupportsString, str);
      case 'boolean':
        return this.prefs.setBoolPref(name, value);
      case 'number':
        return this.prefs.setIntPref(name, value);
      default:
        alert('unknown pref type');
    }
  },



  /********************************************************************************
  * DOM関数
  ********************************************************************************/

  /*
   * findNodeByXPath
   *    xpath:
   *    return: node
   */
  findNodeByXPath: function (xpath) {
    var doc = this.currentDocument;
    return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  },


  /*
   * findNodesByXPath
   *    xpath:
   *    return: nodes
   */
  findNodesByXPath: function (xpath) {
    var doc = this.currentDocument;
    return doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
  },



  /********************************************************************************
  * プロパティ
  ********************************************************************************/

  get currentLocation function () {
    return window.content.document.location.href;
  },


  get currentImagePath function () {
    if (this.currentLocation.match(/mode=medium/)) {
      var elem = this.findNodeByXPath(this.XPath.mediumImage);
    } else {
      var elem = this.findNodeByXPath(this.XPath.bigImage);
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
      return this.findNodeByXPath(this.XPath.authorIconLink).getAttribute('href').replace(/^.*id=/, '');
    } catch (e) { }
  },


  get currentImageId function () {
    try {
      return this.currentImagePath.match(/\/(\d+)(_m)?\.\w{2,4}$/)[1];
    } catch (e) { }
  },

  get currentImageAuthor function () {
    return this.trim(this.currentImageTitleAndAuthor.replace(/^.+\/\s*([^\/]+?)\s*$/, '$1'));
  },


  get currentImageTitle function () {
    return this.trim(this.currentImageTitleAndAuthor.replace(/^\s*(.+?)\s*\/[^\/]+$/, '$1'));
  },


  get currentImageTags function () {
    var as = this.findNodesByXPath(this.XPath.tags);
    var node, res = [];
    while (node = as.iterateNext()) {
      res.push(this.trim(node.textContent));
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
    var filePicker = this.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

    filePicker.appendFilters(nsIFilePicker.filterAll);
    filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
    filePicker.defaultString = defaultFilename;

    var prefInitDir = this.getPref('initialDirectory');
    if (prefInitDir) {
      var initdir = Components.classes["@mozilla.org/file/local;1"].
                      createInstance(Components.interfaces.nsILocalFile);
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
      var filePicker = this.ccci('@mozilla.org/filepicker;1', nsIFilePicker);
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
    var dir = this.showDirectoryPicker(this.getPref('initialDirectory'));
    if (dir) {
      this.setPref('initialDirectory', dir.filePath, 'string');
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
    var IOService = this.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
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
        temp = this.ccci('@mozilla.org/file/local;1', Components.interfaces.nsILocalFile);
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
    var IOService = this.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
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
      var IOService = this.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      var prefInitDir = this.getPref('initialDirectory');

      for (var i in titles) {
        var title = this.fixFilename(titles[i]);
        var filename = title + ' - ' + author + ext;
        var url = 'file://' + prefInitDir + this.SYS_SLASH + filename;
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
    } catch (e) { }

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
    var sourceURI = this.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                      newURI(url, null, null);
    var dlmanager = this.ccgs('@mozilla.org/download-manager;1', Components.interfaces.nsIDownloadManager);
    var wbpersist = this.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                              Components.interfaces.nsIWebBrowserPersist);
    var refererURI = this.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
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

    var url = this.currentImagePath;
    var ref = this.currentLocation.replace(/mode=medium/, 'mode=big');
    var author = this.currentImageAuthor || this.currentImageAuthorId;
    var titles = this.currentImageTags;
    var title = this.currentImageTitle;

    if (title)
      titles.unshift(title);
    else
      titles.push(this.currentImageId);

    var result = this.downloadFile(url, ref, author, titles, this.currentImageExt, useDialog);

    dump(result);

    if (!result)
      return;

    this.Tables.histories.add({
      member_id: this.currentImageAuthorId,
      illust_id: this.currentImageId,
      tags: this.join(this.currentImageTags, ' '),
      server: this.currentImagePath.match(/^http:\/\/([^\/\.]+)\./i)[1],
      local_path: result,
    });

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
    var useDialog = this.getPref('showSaveDialog', true);
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


(function () {
  try {

    //データベースのテーブルを作成
    for (var tableName in this.Tables) {
      if (this.Storage.tableExists(tableName))
        continue;
      var cs = this.Tables[tableName];
      var q = "";
      for (var c in cs) {
        q += c + " " + cs[c] + ",";
      }      
      this.Storage.createTable(tableName, q.replace(/,$/, ''));
    }

    //テーブルにメソッド追加
    var storage = this.Storage;
    for (var tableName in this.Tables) {
      var table = this.Tables[tableName];
      //add
      (function (table, tableName) {
        table.add = function (values) {
          var ns = [], vs = [], ps = [], vi = 0;
          for (var fieldName in values) {
            ns.push(fieldName);
            (function (idx, type, value) {
              vs.push(function (stmt) {
                switch (type) {
                  case 'string':  return stmt.bindUTF8StringParameter(idx, value);
                  case 'integer': return stmt.bindInt32Parameter(idx, value);
                }
              });
            })(vi, table[fieldName], values[fieldName]);
            ps.push('?' + (++vi));
          }
          var q = 'insert into ' + tableName + ' (' + AnkPixiv.join(ns) + ') values(' + AnkPixiv.join(ps) + ')'
          var stmt = storage.createStatement(q);
          for (var i in vs)
            (vs[i])(stmt);
          return stmt.executeStep();
        }
      })(table, tableName);
    }

  } catch (e) {
    dump(e);
  }
}).apply(AnkPixiv);

window.addEventListener("focus", function() { AnkPixiv.onFocus(); }, true);
