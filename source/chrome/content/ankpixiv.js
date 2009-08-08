
try {

  AnkPixiv = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_VERSION: 2,

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
      authorIconImage:'//div[@id="profile"]/div/a/img',
      tags: '//span[@id="tags"]/a',
      ad: '//*[@id="header"]/div[2]',
      comment: 'id("illust_comment")',
      dateTime: 'id("content2")/div[1]/table/tbody/tr/td[1]/div[1]',
      title: 'id("content2")/div[1]/table/tbody/tr/td[1]/div[2]',
      // openComment: '//*[@id="one_comment_view"]/a',
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
          version: "integer",
          comment: "string",
        },
        members: {
          id: "integer",
          name: "string",
          version: "integer",
        }
      }
    ),


    FULL_WIDTH_CHARS: {
      "\\": "￥",
      "\/": "／",
      ":":  "：",
      ";":  "；",
      "*":  "＊",
      "?":  "？",
      "\"": "”",
      "<":  "＜",
      ">":  "＞",
      "|":  "｜"
    },

    Prefs: new AnkPref('extensions.ankpixiv'),


    AllPrefs: new AnkPref(),


    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),


    URL: {
      Pixiv: 'http://www.pixiv.net/',
    },


    MAX_ILLUST_ID: 3110000,


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get currentLocation ()
      window.content.document.location.href,


    get inPixiv ()
      this.currentLocation.match(/^http:\/\/[^\.\/]+\.pixiv\.net\//i),


    get inMedium ()
      this.inPixiv && this.currentLocation.match(/member_illust\.php\?mode=medium&illust_id=\d+/),


    get randomImagePageURL ()
      let (id = parseInt(Math.random() * this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID)))
        ('http://www.pixiv.net/member_illust.php?mode=medium&illust_id=' + id),


    get currentImagePath () {
      let elem = /mode=medium/.test(this.currentLocation) ? AnkUtils.findNodeByXPath(this.XPath.mediumImage)
                                                          : AnkUtils.findNodeByXPath(this.XPath.bigImage);
      return elem && elem.src.replace(/_m\./, '.');
    },


    get currentBigImagePath ()
      this.currentImagePath.replace(/_m\./, '.'),


    get currentImageExt ()
      (this.currentImagePath.match(/\.\w+$/)[0] || '.jpg'),


    // XXX Pixiv のバグに対応するためのコード
    get currentDocumentTitle ()
      AnkUtils.decodeHtmlSpChars(this.currentDocument.getElementsByTagName('title')[0].textContent),


    get currentImageTitleAndAuthor ()
      this.currentDocumentTitle.replace(' [pixiv]', ''),


    get currentImageAuthorId () {
      try {
        return AnkUtils.findNodeByXPath(this.XPath.authorIconLink).getAttribute('href').replace(/^.*id=/, '');
      } catch (e) {
        return 0;
      }
    },


    get currentImageId () {
      try {
        return parseInt(this.currentImagePath.match(/\/(\d+)(_m)?\.\w{2,4}$/)[1]);
      } catch (e) {
        return 0;
      }
    },


    get currentImageTags () {
      let as = AnkUtils.findNodesByXPath(this.XPath.tags);
      let node, res = [];
      while (node = as.iterateNext()) {
        res.push(AnkUtils.trim(node.textContent));
      }
      return res;
    },


    get currentDocument ()
      window.content.document,


    get enabled ()
      this.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/),


    info: (function () {
      let illust = {
        get dateTime () {
          let node = AnkUtils.findNodeByXPath(AnkPixiv.XPath.dateTime);
          let m = node.textContent.match(/(\d+)年(\d+)月(\d+)日 (\d+):(\d+)/);
          return {
            year: m[1],
            month: m[2],
            day: m[3],
            hour: m[4],
            minute: m[5],
          };
        },

        get size () {
          let node = AnkUtils.findNodeByXPath('//*[@id="content2"]/div[6]/span');
          let m = node.textContent.match(/(\d+)×(\d+)/);
          if (!m)
            return;
          return {
            width: parseInt(m[1], 10),
            height: parseInt(m[1], 10),
          };
        },

        get tools () {
          let node = AnkUtils.findNodeByXPath('//*[@id="content2"]/div[6]/span');
          let m = node.textContent.match(/\|\s*(.+)/);
          if (!m)
            return [];
          return m[1].split(/[\s　]+/);
        },

        get width ()
          let (sz = illust.size) (sz && sz.width),

        get height ()
          let (sz = illust.size) (sz && sz.height),

        get server ()
          AnkPixiv.currentImagePath.match(/^http:\/\/([^\/\.]+)\./i)[1],

        get title () {
          let node = AnkUtils.findNodeByXPath(AnkPixiv.XPath.title);
          return AnkUtils.trim(node.textContent);
        },

        get comment () {
          let node = AnkUtils.findNodeByXPath(AnkPixiv.XPath.comment);
          return node ? AnkUtils.trim(node.textContent) :  '';
        },
      };
      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      return {
        illust: illust,
        get pixivId () {
          let node = AnkUtils.findNodeByXPath('//*[@id="profile"]/div/a/img');
          let m = node.src.match(/\/profile\/([^\/]+)\//);
          return m && m[1];
        },
        get memberName () {
          let node = AnkUtils.findNodeByXPath(AnkPixiv.XPath.authorIconImage);
          return AnkUtils.trim(node.getAttribute('alt'));
        },
      };
    })(),


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
      let filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

      filePicker.appendFilters(nsIFilePicker.filterAll);
      filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
      filePicker.defaultString = defaultFilename;

      let prefInitDir = this.Prefs.get('initialDirectory');
      if (prefInitDir) {
        let initdir = AnkUtils.ccci("@mozilla.org/file/local;1", Components.interfaces.nsILocalFile);
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
        let nsIFilePicker = Components.interfaces.nsIFilePicker;
        let filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);
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
      let dir = this.showDirectoryPicker(this.Prefs.get('initialDirectory'));
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
     * fixFilename
     *    filename:   String ファイル名
     * 設定を考慮して、ファイル名を修正する
     */
    fixFilename: function (filename) {
      return AnkUtils.fixFilename(filename);
    },

    /*
     * filenameExists
     *    filename:      String パスfilename
     *    return:   boolean
     * 同じファイル名が存在するか？
     */
    // FIXME
    filenameExists: function (filename)
      AnkPixiv.Storage.exists('histories',
                              'filename like ?',
                              function (stmt) stmt.bindUTF8StringParameter(0, filename)),


    /*
     * newLocalFile
     *    url:      String パスURL
     *    return:   nsILocalFile
     * nsILocalFileを作成
     */
    newLocalFile: function (url) {
      let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      // バージョン毎に場合分け(いらないかも)
      let temp;
      try {
        let fileHandler = IOService.getProtocolHandler('file').
                            QueryInterface(Components.interfaces.nsIFileProtocolHandler);
        temp = fileHandler.getFileFromURLSpec(url);
      } catch (ex) {
        try {
          temp = IOService.getFileFromURLSpec(url);
        } catch(ex) {
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
      let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      return IOService.newFileURI(this.newLocalFile(url));
    },


    /*
     * getSaveFilePath
     *    filenames:          ファイル名の候補のリスト(一個以上必須)
     *    ext:                拡張子
     *    useDialog:          保存ダイアログを使うか？
     *    return:             nsIFilePickerかそれもどき
     * ファイルを保存すべきパスを返す
     * 設定によっては、ダイアログを表示する
     */
    getSaveFilePath: function (filenames, ext, useDialog) {
      try {
        let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
        let prefInitDir = this.Prefs.get('initialDirectory');
        let initDir = this.newLocalFile('file://' + prefInitDir);

        if (!initDir.exists())
          return this.showFilePicker(this.fixFilename(filenames[0]) + ext);

        for (let i in filenames) {
          let filename = this.fixFilename(filenames[i]) + ext;
          let url = 'file://' + prefInitDir + AnkUtils.SYS_SLASH + filename;
          let localfile = this.newLocalFile(url);

          if (localfile.exists() || this.filenameExists(filename))
            continue;

          if (useDialog) {
            return this.showFilePicker(filename);
          } else {
            let res = IOService.newFileURI(localfile);
            return {fileURL: res, file: res};
          }
        }
      } catch (e) {
        // FIXME ?
        dump(e);
      }

      return this.showFilePicker(this.fixFilename(filenames[0]) + ext);
    },

    /*
     * isDownloaded
     *    illust_id:     イラストID
     *    return:        ダウンロード済み？
     */
    isDownloaded: function (illust_id) {
      if (!/^\d+$/.test(illust_id))
        throw "Invalid illust_id";
      return this.Storage.exists('histories', 'illust_id = ' + illust_id);
    },

    /*
     * downloadFile
     *    url:            URL
     *    referer:        リファラ
     *    filenames:      ファイル名の候補リスト
     *    ext:            拡張子
     *    useDialog:      保存ダイアログを使うか？
     *    onComplete      終了時のアラート
     *    return:         成功?
     * ファイルをダウンロードする
     */
    downloadFile: function (url, referer, filenames, ext, useDialog, onComplete) {
      // 保存ダイアログ
      let filePicker = this.getSaveFilePath(filenames, ext, useDialog);
      if (!filePicker)
        return;

      // 各種オブジェクトの生成
      let sourceURI = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                        newURI(url, null, null);
      let wbpersist = AnkUtils.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                                Components.interfaces.nsIWebBrowserPersist);
      let refererURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
      refererURI.spec = referer;

      // ダウンロードマネジャに追加
      let label = filenames[0];

      // キャッシュ
      let cache = null;
      try {
        with (getWebNavigation().sessionHistory)
          cache = getEntryAtIndex(index, false).QueryInterface(Components.interfaces.nsISHEntry).postData;
      } catch (e) {
        /* DO NOTHING */
      }

      // ダウンロード通知
      let $ = this;
      let progressListener = {
        onStateChange: function (_webProgress, _request, _stateFlags, _status) {
          if (_stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
            if (onComplete) {
              let orig_args = arguments;
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
     *    useDialog:            保存ダイアログを使うか？
     *    confirmDownloaded:    ダウンロード済みの場合の確認を行うか？
     *    debug:                トークンのテストを行う
     *    return:               成功？
     * 現在表示されている画像を保存する
     */
    downloadCurrentImage: function (useDialog, confirmDownloaded, debug) {
      try {

        if (typeof useDialog === 'undefined')
          useDialog = this.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = this.Prefs.get('confirmExistingDownload');

        if (!this.enabled)
          return false;

        let url         = this.currentImagePath;
        let illust_id   = this.currentImageId;
        let ref         = this.currentLocation.replace(/mode=medium/, 'mode=big');
        let member_id   = this.currentImageAuthorId;
        let member_name = this.info.memberName || member_id;
        let tags        = this.currentImageTags;
        let title       = this.info.illust.title;
        let comment     = this.info.illust.comment;
        let filenames   = [];
        let shortTags   = (function (len) {
                            let result = [];
                            for (let i in tags) {
                              if (tags[i].length <= len)
                                result.push(tags[i]);
                            }
                            return result;
                          })(8);

        if (this.Prefs.get('saveHistory', true)) {
          try {
            if (this.Storage.exists('members', 'id = ' + parseInt(member_id))) {
            } else {
              this.Storage.insert('members', {id: member_id, name: member_name, version: AnkPixiv.DB_VERSION});
            }
          } catch (e) {
            AnkUtils.dumpError(e);
          }
        }

        /* ダウンロード済みかの確認 */
        if (this.isDownloaded(illust_id)) {
          if (confirmDownloaded) {
            if (!confirm(this.Locale('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        let savedDateTime = new Date();
        let defaultFilename = this.Prefs.get('defaultFilename', '?member-name? - ?title?');
        let alternateFilename = this.Prefs.get('alternateFilename', '?member-name? - ?title? - (?illust-id?)');
        (function () {
          function repl (s) {
            let i = AnkPixiv.info;
            let ii = i.illust;
            return s.replace('?title?', title).
                     replace('?member-id?', member_id).
                     replace('?member-name?', member_name).
                     replace('?tags?', AnkUtils.join(tags, ' ')).
                     replace('?short-tags?', AnkUtils.join(shortTags, ' ')).
                     replace('?tools?', ii.tools).
                     replace('?pixiv-id?', i.pixivId).
                     replace('?illust-id?', illust_id).
                     replace('?illust-year?', ii.year).
                     replace('?illust-month?', ii.month).
                     replace('?illust-day?', ii.day).
                     replace('?illust-hour?', ii.hour).
                     replace('?illust-minute?', ii.minute).
                     replace('?saved-year?', savedDateTime.getFullYear()).
                     replace('?saved-month?', AnkUtils.zeroPad(savedDateTime.getMonth() + 1, 2)).
                     replace('?saved-day?', AnkUtils.zeroPad(savedDateTime.getDate(), 2)).
                     replace('?saved-hour?', AnkUtils.zeroPad(savedDateTime.getHours(), 2)).
                     replace('?saved-minute?', AnkUtils.zeroPad(savedDateTime.getMinutes(), 2)).
                     toString();
          }
          filenames.push(repl(defaultFilename));
          filenames.push(repl(alternateFilename));
          if (debug) {
            let tokens = <><![CDATA[
title         = ?title?
member-id     = ?member-id?
member-name   = ?member-name?
tags          = ?tags?
short-tags    = ?short-tags?
tools         = ?tools?
pixiv-id      = ?pixiv-id?
illust-id     = ?illust-id?
illust-year   = ?illust-year?
illust-month  = ?illust-month?
illust-day    = ?illust-day?
illust-hour   = ?illust-hour?
illust-minute = ?illust-minute?
saved-year    = ?saved-year?
saved-month   = ?saved-month?
saved-day     = ?saved-day?
saved-hour    = ?saved-hour?
saved-minute  = ?saved-minute?
                ]]></>.toString();
            alert(repl(tokens, title));
          }
        })();

        if (debug)
          return;

        let record = {
          member_id: member_id,
          illust_id: illust_id,
          title: title,
          tags: AnkUtils.join(tags, ' '),
          server: this.info.illust.server,
          saved: true,
          datetime: AnkUtils.toSQLDateTimeString(savedDateTime),
          comment: comment,
          version: AnkPixiv.DB_VERSION,
        };

        let onComplete = function (orig_args, local_path) {
          try {
            let caption = this.Locale('finishedDownload');
            let text = filenames[0];
            local_path = decodeURIComponent(local_path);

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
          } catch (e) {
            let s = '';
            for (let n in e) {
              s += n + ': ' + e[n] + '\n';
            }
            alert(s);
          }
        };

        let result = this.downloadFile(url, ref, filenames, this.currentImageExt, useDialog, onComplete);

        return result;

      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },

    /*
     * downloadCurrentImageAuto
     * 自動的にダウンロードする場合はこっちを使う
     */
    downloadCurrentImageAuto: function () {
      this.downloadCurrentImage(undefined, this.Prefs.get('confirmExistingDownloadWhenAuto'));
    },

    get functionsInstaller function () {
      let $ = this;
      let ut = AnkUtils;
      let installInterval = 500;
      let installer = null;
      let con = content;
      let doc = this.currentDocument;

      let delay = function (msg) {
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
          var openComment = function () content.wrappedJSObject.one_comment_view();
        } catch (e) {
          AnkUtils.dumpError(e);
          return delay("delay installation by error");
        }

        // 完全に読み込まれて以内っぽいときは、遅延する
        if (!(body && medImg && bigImgPath && wrapper && openComment))
          return delay("delay installation by null");

        // 中画像クリック時に保存する
        if ($.Prefs.get('downloadWhenClickMiddle')) {
          medImg.addEventListener(
            'click',
            function (e) {
              $.downloadCurrentImageAuto();
            },
            true
          );
        }

        // 大画像関係
        if ($.Prefs.get('largeOnMiddle', true)) {
          let div = doc.createElement('div');
          div.setAttribute('style', 'position: absolute; top: 0px; left: 0px; width:100%; height: auto; background: white; text-align: center; padding-top: 10px; padding-bottom: 100px; display: none; -moz-opacity: 1;');

          let bigImg = doc.createElement('img');

          div.appendChild(bigImg);
          body.appendChild(div);
          let bigMode = false;

          let changeImageSize = function () {
            let ad = AnkUtils.findNodeByXPath($.XPath.ad);
            if (bigMode) {
              div.style.display = 'none';
              wrapper.setAttribute('style', 'opacity: 1;');
              ad.style.display = ad.__ank_pixiv__style_display;
            } else {
              bigImg.setAttribute('src', bigImgPath);
              window.content.scrollTo(0, 0);
              div.style.display = '';
              wrapper.setAttribute('style', 'opacity: 0.1;');
              bigImg.style['opacity'] = '1 !important;';
              ad.__ank_pixiv__style_display = ad.style.display;
              ad.style.display = 'none';
            }
            bigMode = !bigMode;
          };

          doc.changeImageSize = changeImageSize;

          doc.addEventListener('click', function (e) {
            if (e.button)
              return;
            if (bigMode || (e.target.src == medImg.src)) {
              e.preventDefault();
              changeImageSize();
            }
          }, true);
        }

        // レイティングによるダウンロード
        (function () {
          if (!$.Prefs.get('downloadWhenRate', false))
            return;
          let point = $.Prefs.get('downloadRate', 10);
          let elem, iter = AnkUtils.findNodesByXPath("//ul[@class='unit-rating']/li/a");
          while (elem = iter.iterateNext()) {
            let m = elem.className.match(/r(\d{1,2})-unit/);
            if (m && (point <= parseInt(m[1]))) {
              elem.addEventListener('click', function() $.downloadCurrentImageAuto(), true);
            }
          }
        })();

        // コメント欄を開く
        if ($.Prefs.get('openComment', false))
          setTimeout(openComment, 1000);

        AnkUtils.dump('installed');
      };

      return installer;
    },


    installFunctions: function () {
      let doc = this.currentDocument;
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
        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = this.Storage.database;
        let updates = [];

        let update = function (columnName, value, rowid) {
          updates.push(function () {
            let stmt = db.createStatement('update histories set ' + columnName + ' =  ?1 where rowid = ?2');
            try {
              stmt.bindUTF8StringParameter(0, value);
              stmt.bindInt32Parameter(1, rowid);
              stmt.execute();
            } finally {
              stmt.reset();
            }
          });
        };

        let stmt = db.createStatement('select rowid, * from histories');
        stmt.reset();
        storageWrapper.initialize(stmt);
        while (storageWrapper.step()) {
          let rowid = storageWrapper.row["rowid"];
          let filename = storageWrapper.row["filename"];
          let local_path = storageWrapper.row["local_path"];
          if (local_path) update('local_path', decodeURIComponent(local_path), rowid);
          if (filename)
            update('filename', decodeURIComponent(filename), rowid);
          else
            update('filename', decodeURIComponent(AnkUtils.extractFilename(local_path)), rowid);
        }
        for (let i in updates) {
          (updates[i])();
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    exchangeFilename: function () {
      try {
        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = this.Storage.database;
        let updates = [];

        let update = function (columnName, value, rowid) {
          updates.push(function () {
            let stmt = db.createStatement('update histories set ' + columnName + ' =  ?1 where rowid = ?2');
            try {
              stmt.bindUTF8StringParameter(0, value);
              stmt.bindInt32Parameter(1, rowid);
              stmt.execute();
            } finally {
              stmt.reset();
            }
          });
        };

        let stmt = db.createStatement('select rowid, * from histories where rowid >= 180');
        stmt.reset();
        storageWrapper.initialize(stmt);
        while (storageWrapper.step()) {
          let rowid = storageWrapper.row["rowid"];
          let filename = storageWrapper.row["filename"];
          if (filename) {
            update('filename', filename.replace(/^([^\-]+) - ([^\.]+)(\.\w{2,4})$/, '$2 - $1$3'), rowid);
          }
        }
        for (let i in updates) {
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
      try {
        if (!(this.inPixiv && this.inMedium))
          return;
        let doc = event.originalTarget;
        if (!doc || doc.nodeName != "#document")
            return;
        window.removeEventListener("load", AnkPixiv.onLoad, false);
        //window.addEventListener("DOMContentLoaded", function(){ AnkPixiv.installFunctions(); }, false);
        window.addEventListener("domready", function(){ AnkPixiv.installFunctions(); }, false);
      } catch (e) {
        //AnkUtils.dumpError(e);
      }
    },


    onFocus: function (ev) {
      try {
        let changeEnabled = function (id) {
          let elem = document.getElementById(id);
          if (!elem)
            return;
          elem.setAttribute('dark', !this.enabled);
        };

        changeEnabled.call(this, 'ankpixiv-toolbar-button');
        changeEnabled.call(this, 'ankpixiv-statusbarpanel');
        changeEnabled.call(this, 'ankpixiv-menu-download');

        if (this.enabled) {
          this.installFunctions();
          let illust_id = this.currentImageId;
          if (this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID) < illust_id) {
            this.Prefs.set('maxIllustId', illust_id);
          }
        }
      } catch (e) {
        //AnkUtils.dumpError(e);
      }
    },


    onDownloadButtonClick: function (event) {
      event.stopPropagation();
      event.preventDefault();
      let useDialog = this.Prefs.get('showSaveDialog', true);
      if (this.enabled) {
        switch(event.button) {
          case 0: this.downloadCurrentImage(useDialog); break;
          case 1: this.downloadCurrentImage(!useDialog); break;
          case 2: this.openPrefWindow(); break;
        }
      } else {
        let open = function (left) {
          let tab = AnkPixiv.AllPrefs.get('extensions.tabmix.opentabfor.bookmarks', false);
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
    },


    updateDatabase: function () {
      // version 1
      let olds = this.Storage.oselect('histories', '(version is null) or (version < 1)');
      for each (let old in olds) {
        try {
          let dt = AnkUtils.toSQLDateTimeString(new Date(old.datetime));
          this.Storage.update('histories',
                              "`datetime` = datetime('" + dt + "', '1 months'), version = " + AnkPixiv.DB_VERSION,
                              'rowid = ' + old.rowid);
        } catch (e) {
          //liberator.log(e);
        }
      }
    },
  };


  /********************************************************************************
  * イベント設定
  ********************************************************************************/

  //AnkPixiv.fixStorageEncode();
  //AnkPixiv.exchangeFilename();
  window.addEventListener("focus", function() AnkPixiv.onFocus(), true);
  window.addEventListener("load", function() AnkPixiv.onLoad(), true);


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
