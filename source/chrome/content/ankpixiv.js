
try {

  AnkPixiv = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_VERSION: 5,

    VERSION: AnkUtils.getVersion('ankpixiv@snca.net'),

    PREF_PREFIX: 'extensions.ankpixiv.',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',

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
          pixiv_id: "string",
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


    Store: (function () {
      return {
        get document ()
          (AnkPixiv.elements.doc.__ank_pixiv_store || (AnkPixiv.elements.doc.__ank_pixiv_store = {}))
      };
    })(),


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

    get manga () {
      let node = AnkPixiv.elements.illust.largeLink;
      return node && ~node.href.indexOf('?mode=manga&');
    },

    get inPixiv ()
      this.currentLocation.match(/^http:\/\/[^\.\/]+\.pixiv\.net\//i),

    get inMedium ()
      this.inPixiv && this.currentLocation.match(/member_illust\.php\?mode=medium&illust_id=\d+/),

    get randomImagePageURL ()
      let (id = parseInt(Math.random() * this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID)))
        ('http://www.pixiv.net/member_illust.php?mode=medium&illust_id=' + id),

    get currentDocument ()
      window.content.document,

    get inIllustPage ()
      this.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/),

    get inMyIllust ()
      !AnkPixiv.elements.illust.avatar,

    get inMyPage ()
      (this.currentLocation == 'http://www.pixiv.net/mypage.php'),

    elements: (function () {
      let illust =  {
        get mediumImage ()
          AnkPixiv.elements.doc.querySelector('.works_display > a > img'),

        get largeLink ()
          AnkPixiv.elements.doc.querySelector('.works_display > a'),

        get worksData ()
          AnkPixiv.elements.doc.querySelector('.works_data > p'),

        get title ()
          AnkPixiv.elements.doc.querySelector('.works_data > h3'),

        get comment ()
          AnkPixiv.elements.doc.querySelector('.works_area > p'),

        get avatar ()
          AnkPixiv.elements.doc.querySelector('.avatar_m > img'),

        get memberLink ()
          AnkPixiv.elements.doc.querySelector('a.avatar_m'),

        get tags ()
          AnkPixiv.elements.doc.querySelector('#tags'),

        get downloadedDisplayParent ()
          AnkPixiv.elements.doc.querySelector('.works_data'),

        get ads () {
          let obj = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('object'));
          let iframe = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('iframe'));
          let search = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.pixivSearch'));
          // searchSub は現時点で存在しないが search がリネームされそうなので書いておく
          let searchSub = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.pixiv-search'));
          // 検索欄も広告扱いしちゃうぞ
          let findbox = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('form.search.head'));
          // ldrize
          let ldrize = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#gm_ldrize'));

          return ([]).concat(obj, iframe, search, searchSub, findbox, ldrize);
        }
      };

      let mypage = {
        get fantasyDisplay ()
          AnkPixiv.elements.doc.querySelector('#' + AnkPixiv.ID_FANTASY_DISPLAY),

        get fantasyDisplayNext ()
          AnkPixiv.elements.doc.querySelector('#contents > div > div.area_pixivmobile'),
      };

      return {
        illust: illust,
        mypage: mypage,
        get doc () window.content.document
      };
    })(),

    info: (function () {
      let illust = {
        get id ()
          parseInt(AnkPixiv.elements.doc.querySelector('#rpc_i_id').textContent, 10),

        get dateTime ()
          AnkPixiv.info.illust.worksData.dateTime,

        get size ()
          AnkPixiv.info.illust.worksData.size,

        get tags ()
          AnkUtils.A(AnkPixiv.elements.illust.tags.querySelectorAll('a'))
            .map(function (e) AnkUtils.trim(e.textContent))
            .filter(function (s) s && s.length),

        get tools ()
          AnkPixiv.info.illust.worksData.tools,

        get width ()
          let (sz = illust.size) (sz && sz.width),

        get height ()
          let (sz = illust.size) (sz && sz.height),

        get server ()
          AnkPixiv.info.path.largeStandardImage.match(/^http:\/\/([^\/\.]+)\./i)[1],

        get title ()
          AnkUtils.trim(AnkPixiv.elements.illust.title.textContent),

        get comment ()
          let (node = AnkPixiv.elements.doc.querySelector('.works_area > p'))
            (node && AnkUtils.textContent(node)),

        get R18 ()
          AnkPixiv.info.illust.tags.some(function (v) 'R-18' == v),

        get mangaPages ()
          AnkPixiv.info.illust.worksData.mangaPages,

        get worksData () {
          let items = AnkPixiv.elements.illust.worksData.textContent.split(/\uFF5C/).map(String.trim);
          let result = {};
          items.forEach(function (item) {
            item = item.replace(/\[ \u30DE\u30A4\u30D4\u30AF\u9650\u5B9A \]/, '').trim();
            let m;
            if (m = item.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: m[1],
                month: m[2],
                day: m[3],
                hour: m[4],
                minute: m[5],
              };
            } else if (m = item.match(/\u6F2B\u753B\s*(\d+)P/)) {
              result.mangaPages = parseInt(m[1], 10);
            } else if (m = item.match(/(\d+)\uD7(\d+)/)) {
              result.size = {
                width: parseInt(m[1], 10),
                height: parseInt(m[2], 10),
              };
            } else {
              result.tools = item;
            }
          });
          return result;
        }
      };
      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      let member = {
        get id () {
          try {
            return AnkPixiv.elements.illust.memberLink.getAttribute('href').replace(/^.*id=/, '');
          } catch (e) {
            return 0;
          }
        },

        get pixivId ()
          (AnkPixiv.elements.illust.avatar.src.match(/\/profile\/([^\/]+)\//)
           ||
           AnkPixiv.info.path.largeImage.match(/^https?:\/\/[^\.]+\.pixiv\.net\/img\/([^\/]+)\//))[1],

        get name ()
          AnkUtils.trim(AnkPixiv.elements.illust.avatar.getAttribute('alt')),

        get memoizedName () {
          let result = AnkPixiv.Storage.select(
            'members',
            'id = ?1',
            function (stmt){
              let result = [];
              stmt.bindUTF8StringParameter(0, member.id);
              while (stmt.executeStep())
                result.push(AnkStorage.statementToObject(stmt));
              return result;
            }
          );
          return result && result.length && result[0].name;
        },
      };

      let path = {
        get ext ()
          (AnkPixiv.info.path.largeStandardImage.match(/\.\w+$/)[0] || '.jpg'),

        get mangaIndexPage ()
          AnkPixiv.currentLocation.replace(/\?mode=medium/, '?mode=manga'),

        get largeImage ()
          let (i = AnkPixiv.info.path)
            AnkPixiv.manga ? i.getLargeMangaImage() : i.largeStandardImage,

        get largeStandardImage ()
          AnkPixiv.info.path.mediumImage.replace(/_m\./, '.'),

        getLargeMangaImage: function (n, base, ext)
          (base || AnkPixiv.info.path.largeStandardImage).replace(/\.[^\.]+$/, function (m) (('_p' + (n || 0)) + (ext || m))),

        get mediumImage ()
          AnkPixiv.elements.illust.mediumImage.src.replace(/\?.*$/, ''),
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(),

    get infoText () {
      let ignore =
        let (pref = this.Prefs.get('infoText.ignore', 'illust.dateTime.'))
          (pref ? pref.split(/[,\s]+/) : []);

      ignore = [];
      function indent (s)
        (typeof s === 'undefined' ? '---' : s).toString().split(/\n/).map(function (v) "\t" + v).join("\n");

      function textize (names, value) {
        let name = names.join('.');

        if (ignore.some(function (v) name.indexOf(v) == 0))
          return '';

        if (typeof value === 'object') {
          let result = '';
          for (let [n, v] in Iterator(value)) {
            if (v && typeof v !== 'function')
              result += textize(names.concat([n]), v);
          }
          return result;
        } else {
          return value ? name + "\n" + indent(value) + "\n" : '';
        }
      }

      return textize([], this.info);
    },

    set statusbarText (text) {
      let elem = document.getElementById('ankpixiv-statusbar-text');
      elem.textContent = text;
      elem.collapsed = text.length == 0;
      return text;
    },

    /********************************************************************************
    * 状態
    ********************************************************************************/

    downloadings: {},

    /********************************************************************************
    * ダイアログ関連
    ********************************************************************************/

    /*
     * showFilePicker
     *    defaultFilename: 初期ファイル名
     *    return:          選択されたファイルのパス(nsILocalFile)
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

      return (filePicker.show() == nsIFilePicker.returnOK) && filePicker && filePicker.file;
    },


    /*
     * showFilePickerWithMeta
     *    basename:        初期ファイル名
     *    ext:             拡張子
     *    return:          {image: nsILocalFile, meta: nsILocalFile}
     * ファイル保存ダイアログを開く
     */
    showFilePickerWithMeta: function (basename, ext, isFile) {
      let image = AnkPixiv.showFilePicker(basename + ext);
      if (!image)
        return;

      let meta = isFile ? AnkPixiv.newLocalFile(image.path + '.txt') // XXX path or nativePath
                        : let (file = image.clone())
                            (file.append('meta.txt'), file);

      return {
        image: image,
        meta: meta
      };
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
        AnkUtils.dumpError(e, true);
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
     * filenameExists
     *    filename:      String パスfilename
     *    return:   boolean
     * 同じファイル名が存在するか？
     */
    filenameExists: function (filename)
      AnkPixiv.Storage.exists('histories',
                              'filename = ?',
                              function (stmt) stmt.bindUTF8StringParameter(0, filename)),


    /*
     * newLocalFile
     *    url:      String パス
     *    return:   nsILocalFile
     * nsILocalFileを作成
     */
    newLocalFile: function (path) {
      let temp = AnkUtils.ccci('@mozilla.org/file/local;1', Components.interfaces.nsILocalFile);
      if (AnkUtils.platform === 'Win32')
        path = path.replace(/\//g, '\\');
      temp.initWithPath(path);
      return temp;
    },


    /*
     * newFileURI
     *    url:      String パス
     *    return:   nsILocalFile
     * nsILocalFileを作成
     */
    newFileURI: function (path) {
      let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      return IOService.newFileURI(this.newLocalFile(path));
    },


    /*
     * getSaveFilePath
     *    filenames:          ファイル名の候補のリスト(一個以上必須)
     *    ext:                拡張子
     *    useDialog:          保存ダイアログを使うか？
     *    isFile:             ディレクトリの時は false
     *    return:             {image: nsILocalFile, meta: nsILocalFile}
     * ファイルを保存すべきパスを返す
     * 設定によっては、ダイアログを表示する
     */
    getSaveFilePath: function (filenames, ext, useDialog, isFile) {
      function _file (initDir, basename, ext, isMeta) {
        // TODO File#join
        let filename = (isMeta && !isFile) ? basename + AnkUtils.SYS_SLASH + 'meta.txt' : basename + ext;
        let url =   initDir + AnkUtils.SYS_SLASH + filename;
        return {
          filename: filename,
          url: url,
          file: AnkPixiv.newLocalFile(url)
        };
      };

      function _exists (file)
        (file.file.exists() || AnkPixiv.filenameExists(file.filename));

      try {
        let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
        let prefInitDir = this.Prefs.get('initialDirectory');
        let initDir = this.newLocalFile(prefInitDir);

        if (!initDir.exists())
          return this.showFilePickerWithMeta(filenames[0], ext, isFile);

        for (let i in filenames) {
          let image = _file(prefInitDir, filenames[i], ext);
          let meta = _file(prefInitDir, filenames[i], '.txt', true);

          if (_exists(image) || _exists(meta))
            continue;

          if (useDialog) {
            return this.showFilePickerWithMeta(filenames[i], ext, isFile);
          } else {
            return {image: image.file, meta: meta.file};
          }
        }
      } catch (e) {
        // FIXME ?
        AnkUtils.dump(e);
      }

      return this.showFilePickerWithMeta(filenames[0], ext, isFile);
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
     * downloadTo
     *    url:            URL
     *    referer:        リファラ
     *    file:           nsIFile
     *    onComplete      終了時に呼ばれる関数
     *    onError         エラー時に呼ばれる関数
     *    return:         成功?
     * ファイルをダウンロードする
     */
    downloadTo: function (url, referer, file, onComplete, onError) {
      // 何もしなーい
      if (!onError)
        onError = function () void 0;

      // ディレクトリ作成
      let (dir = file.parent)
        dir.exists() || dir.create(dir.DIRECTORY_TYPE, 0755);

      // 各種オブジェクトの生成
      let sourceURI = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                        newURI(url, null, null);
      let wbpersist = AnkUtils.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                                Components.interfaces.nsIWebBrowserPersist);
      let refererURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
      refererURI.spec = referer;

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
          _request.QueryInterface(Components.interfaces.nsIHttpChannel);
          // XXX pixiv のアホサーバは、PNG にも image/jpeg を返してくるぞ！！
          // AnkUtils.dump(_request.getResponseHeader('Content-Type'));
          if (_stateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
            let responseStatus, orig_args = arguments;

            try {
              responseStatus = _request.responseStatus
            } catch (e) {
              return onError.call($, orig_args, file.path, 0);
            }

            if (responseStatus != 200)
              return onError.call($, orig_args, file.path, responseStatus);

            if (onComplete)
              return onComplete.call($, orig_args, file.path, responseStatus);
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
      wbpersist.saveURI(sourceURI, cache, refererURI, null, null, file);


      // 成功
      return file;
    },


    /*
     * saveTextFile
     *    file:           nsILocalFile
     *    text:           String
     * テキストをローカルに保存します。
     */
    saveTextFile: function (file, text) {
      let dir = file.parent;
      dir.exists() || dir.create(dir.DIRECTORY_TYPE, 0755);

      let out = AnkUtils.ccci('@mozilla.org/network/file-output-stream;1', Ci.nsIFileOutputStream);
      let conv = AnkUtils.ccci('@mozilla.org/intl/converter-output-stream;1', Ci.nsIConverterOutputStream);
      out.init(file, 0x02 | 0x10 | 0x08, 0664, 0);
      conv.init(out, 'UTF-8', text.length, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      conv.writeString(text);
      conv.close();
      out.close();
    },


    /*
     * downloadFile
     *    url:            URL
     *    referer:        リファラ
     *    localfile:      出力先ファイル nsilocalFile
     *    onComplete      終了時のアラート
     *    return:         キャンセルなどがされなければ、true
     * ファイルをダウンロードする
     */
    downloadFile: function (url, referer, localfile, onComplete, onError) {
      this.downloadTo(url, referer, localfile, onComplete, onError);
      return true;
    },


    /*
     * downloadFiles
     *    urls:           URL
     *    referer:        リファラ
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    onComplete      終了時のアラート
     *    return:         キャンセルなどがされなければ、true
     * 複数のファイルをダウンロードする
     */
    downloadFiles: function (urls, referer, localdir, onComplete, onError) {
      const MAX_FILE = 1000;

      let $ = this;
      let index = 0;
      let lastFile = null;

      // XXX ディレクトリは勝手にできるっぽい
      //localdir.exists() || localdir.create(localdir.DIRECTORY_TYPE, 0755);

      function _onComplete () {
        arguments[1] = localdir.path;
        return onComplete.apply($, arguments);
      }

      function downloadNext (_orignalArgs, _filePath, status) {

        // 前ファイルの処理
        if (lastFile) {
          // ダウンロードに失敗していたら、そこで終了さ！
          if (!lastFile.exists) {
            AnkUtils.dump('Strange error! file not found!');
            return _onComplete.apply($, arguments);
          }

          // 404 の時も終了。ついでにゴミファイルを消す。
          if (status != 200) { // XXX || (lastFile.exists() && lastFile.fileSize < 1000)) {
            if (lastFile.exists()) {
              try {
                lastFile.remove(false);
                AnkUtils.dump('Delete invalid file. => ' + lastFile.path);
              } catch (e) {
                AnkUtils.dump('Failed to delete invalid file. => ' + e);
              }
            }
            return _onComplete.apply($, arguments);
          }

          // ファイル名の修正
          try {
            if (AnkPixiv.fixFileExt(lastFile))
              AnkUtils.dump('Fix file ext: ' + lastFile.path);
          } catch (e) {
            AnkUtils.dump('Failed to fix file ext. => ' + e);
          }
        }

        // 最後のファイル
        if (index >= Math.min(urls.length, MAX_FILE))
          return _onComplete.apply($, arguments);

        let url = urls[index];
        let file = localdir.clone();
        let fileExt = url.match(/\.\w+$/)[0] || '.jpg';
        file.append(AnkUtils.zeroPad(index + 1, 2) + fileExt);

        lastFile = file;
        index++;

        AnkUtils.dump('DL => ' + file.path);
        return $.downloadTo(url, referer, file, downloadNext, onError);
      }

      downloadNext();
      return true;
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
      let $ = this;

      try {

        // 自分のページのは構成が違い、問題となるのでダウンロードしないようにする。
        if (AnkPixiv.inMyIllust)
          return false;

        if (typeof useDialog === 'undefined')
          useDialog = this.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = this.Prefs.get('confirmExistingDownload');

        if (!this.inIllustPage)
          return false;

        let destFiles;
        let metaText      = this.infoText;
        let pageUrl       = this.currentLocation;
        let url           = this.info.path.largeStandardImage;
        let illust_id     = this.info.illust.id;
        let ext           = this.info.path.ext;
        let ref           = this.currentLocation.replace(/mode=medium/, 'mode=big');
        let member_id     = this.info.member.id;
        let member_name   = this.info.member.name || member_id;
        let pixiv_id      = this.info.member.pixivId;
        let memoized_name = this.info.member.memoizedName || member_name;
        let tags          = this.info.illust.tags;
        let title         = this.info.illust.title;
        let comment       = this.info.illust.comment;
        let R18           = this.info.illust.R18;
        let doc           = this.currentDocument;
        let dlDispPoint   = AnkPixiv.elements.illust.downloadedDisplayParent;
        let filenames     = [];
        let shortTags     = (function (len) {
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
              // 古いデータには pixiv_id がついていなかったら付加する
              // (DB_VERSION = 5 で pixiv_id がついた
              this.Storage.createStatement(
                'update members set pixiv_id = ?1, version = ?2 where (id = ?3) and (pixiv_id is null)',
                function (stmt) {
                  stmt.bindUTF8StringParameter(0, pixiv_id);
                  stmt.bindInt32Parameter(1, AnkPixiv.DB_VERSION);
                  stmt.bindInt32Parameter(2, member_id);
                  stmt.executeStep();
                }
              );
            } else {
              this.Storage.insert(
                'members', {
                  id: member_id,
                  name: member_name,
                  pixiv_id: pixiv_id,
                  version: AnkPixiv.DB_VERSION
                }
              );
            }
          } catch (e) {
            AnkUtils.dumpError(e, true);
          }
        }

        /* ダウンロード済みかの確認 */
        if (this.isDownloaded(illust_id)) {
          if (confirmDownloaded) {
            if (!window.confirm(this.Locale('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        let savedDateTime = new Date();
        let defaultFilename = this.Prefs.get('defaultFilename', '?member-name? - ?title?');
        let alternateFilename = this.Prefs.get('alternateFilename', '?member-name? - ?title? - (?illust-id?)');
        (function () {
          let i = AnkPixiv.info;
          let ii = i.illust;
          let im = i.member;
          let ps = [
            [/\?title\?/g, title],
            [/\?member-id\?/g, member_id],
            [/\?member-name\?/g, member_name],
            [/\?memoized-name\?/g, memoized_name],
            [/\?memorized-name\?/g, memoized_name],
            [/\?tags\?/g, AnkUtils.join(tags, ' ')],
            [/\?short-tags\?/g, AnkUtils.join(shortTags, ' ')],
            [/\?tools\?/g, ii.tools],
            [/\?pixiv-id\?/g, im.pixivId],
            [/\?illust-id\?/g, illust_id],
            [/\?illust-year\?/g, ii.year],
            [/\?illust-month\?/g, ii.month],
            [/\?illust-day\?/g, ii.day],
            [/\?illust-hour\?/g, ii.hour],
            [/\?illust-minute\?/g, ii.minute],
            [/\?saved-year\?/g, savedDateTime.getFullYear()],
            [/\?saved-month\?/g, AnkUtils.zeroPad(savedDateTime.getMonth() + 1, 2)],
            [/\?saved-day\?/g, AnkUtils.zeroPad(savedDateTime.getDate(), 2)],
            [/\?saved-hour\?/g, AnkUtils.zeroPad(savedDateTime.getHours(), 2)],
            [/\?saved-minute\?/g, AnkUtils.zeroPad(savedDateTime.getMinutes(), 2)]
          ].map(function ([re, val]) {
            try {
              return [re, AnkUtils.fixFilename((val || '-').toString())];
            } catch (e) {
              AnkUtils.dump(re + ' is not found');
              throw e;
            }
          });
          function repl (s) {
            ps.forEach(function ([re, val]) (s = s.replace(re, val).trim()))
            return s;
          }
          filenames.push(repl(defaultFilename));
          filenames.push(repl(alternateFilename));
          filenames = filenames.map(function (filename) filename.replace(/\s*\?page-number\?\s*/g, ''));
          if (debug) {
            let tokens = <><![CDATA[
title         = ?title?
member-id     = ?member-id?
member-name   = ?member-name?
memoized-name = ?memoized-name?
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
            window.alert(repl(tokens, title));
            window.alert(filenames);
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

        let removeDownloading = function () {
          delete $.downloadings[pageUrl];
          $.updateStatusBarText();
        };

        let addDownloading = function () {
          $.downloadings[pageUrl] = new Date();
          $.updateStatusBarText();
        };

        let onComplete = function (orig_args, local_path) {
          try {
            removeDownloading();

            let caption = $.Locale('finishedDownload');
            let text = filenames[0];
            let prefInitDir = $.Prefs.get('initialDirectory');
            let relPath = prefInitDir ? AnkUtils.getRelativePath(local_path, prefInitDir)
                                      : AnkUtils.extractFilename(local_path);

            if ($.Prefs.get('saveHistory', true)) {
              try {
                record['local_path'] = local_path;
                record['filename'] = relPath;
                $.Storage.insert('histories', record);
              } catch (e) {
                AnkUtils.dumpError(e, true);
                caption = 'Error - onComplete';
                text = e;
              }
            }

            if ($.Prefs.get('saveMeta', true))
              AnkPixiv.saveTextFile(destFiles.meta, metaText);

            if ($.Prefs.get('showCompletePopup', true))
              $.popupAlert(caption, text);

            $.insertDownloadedDisplay(dlDispPoint, R18);

            return true;

          } catch (e) {
            let s = '';
            for (let n in e) {
              s += n + ': ' + e[n] + '\n';
            }
            window.alert(s);
          }
        };

        let onError = function (origArgs, filepath, responseStatus) {
          removeDownloading();

          let desc = '\n' + title + ' / ' + memoized_name + '\n' + pageUrl + '\n';
          let msg =
            $.Locale('downloadFailed') + '\n' +
            (responseStatus ? 'Status: ' + responseStatus + '\n' : '') +
            desc;

          window.alert(msg);
          AnkUtils.dump(msg);

          let confirmMsg =
            $.Locale('confirmOpenIllustrationPage') + '\n' +
            desc;

          if (window.confirm(confirmMsg))
            AnkUtils.openTab(pageUrl);
        };

        // ダウンロード中だったらやめようぜ！
        if (this.downloadings[pageUrl]) {
          return window.alert(this.Locale('alreadyDownloading'));
        }

        // XXX 前方で宣言済み
        destFiles = AnkPixiv.getSaveFilePath(filenames, this.manga ? '' : ext, useDialog, !this.manga);
        if (!destFiles)
          return;

        if (this.manga) {
          this.getLastMangaPage(function (v, ext) {
            let urls = [];
            for (let i = 0; i < v; i++)
              urls.push(AnkPixiv.info.path.getLargeMangaImage(i, url, ext));
            if ($.downloadFiles(urls, ref, destFiles.image, onComplete, onError))
              addDownloading();
          });
        } else {
          if (this.downloadFile(url, ref, destFiles.image, onComplete, onError))
            addDownloading();
        }

      } catch (e) {
        AnkUtils.dumpError(e, true);
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
      let installTryed = 0;
      let installer = null;
      let con = content;
      let doc = this.currentDocument;
      let lastMangaPage = undefined;
      let currentMangaPage = 0;
      let doLoop = false;

      let delay = function (msg, e) {
        if (installTryed == 20) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkPixiv.Prefs.get('showErrorDialog'));
        }
        setTimeout(installer, installInterval);
        installTryed++;
      };

      installer = function () {

        try {
          // 完全に読み込まれて以内っぽいときは、遅延する
          try {
            var body = doc.getElementsByTagName('body')[0];
            var wrapper = doc.getElementById('wrapper');
            var medImg = AnkPixiv.elements.illust.mediumImage;
            var bigImgPath = AnkPixiv.info.path.largeImage;
            var openComment = function () content.wrappedJSObject.one_comment_view();
            var worksData = AnkPixiv.elements.illust.worksData;
            var bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
          } catch (e) {
            return delay("delay installation by error", e);
          }

          // 完全に読み込まれて以内っぽいときは、遅延する
          if (!(body && medImg && bigImgPath && wrapper && openComment && worksData))
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
            let bigImg = doc.createElement('img');
            let imgPanel = doc.createElement('div');
            let buttonPanel = doc.createElement('div');
            let prevButton = doc.createElement('button');
            let nextButton = doc.createElement('button');

            let updateButtons = function (v) {
              nextButton.innerHTML =
                (lastMangaPage === undefined || (currentMangaPage < lastMangaPage - 1)) ? '>>' : '\xD7';
              prevHTML =
                (lastMangaPage === undefined || currentMangaPage > 0) ? '<<' : '\xD7';
            };

            div.setAttribute('style', 'position: absolute; top: 0px; left: 0px; width:100%; height: auto; background: white; text-align: center; padding-top: 10px; padding-bottom: 100px; display: none; -moz-opacity: 1;');
            prevButton.innerHTML = '<<';
            nextButton.innerHTML = '>>';
            buttonPanel.setAttribute('style', 'display: block; margin: 0 auto; text-align: center; ');

            [prevButton, nextButton].forEach(function (button) {
              button.setAttribute('class', 'submit_btn');
              button.setAttribute('style', 'width: 100px !important');
            });

            /*
             * div
             *    - imgPanel
             *      - bigImg
             *    - buttonPanel
             *      - prevButton
             *      - nextButton
             */
            div.appendChild(imgPanel);
            imgPanel.appendChild(bigImg);
            if ($.manga) {
              div.appendChild(buttonPanel);
              buttonPanel.appendChild(prevButton);
              buttonPanel.appendChild(nextButton);
            }
            body.appendChild(div);

            let bigMode = false;

            let changeImageSize = function () {
              let ads = AnkPixiv.elements.illust.ads;
              if (bigMode) {
                body.style.backgroundImage = bgImage;
                div.style.display = 'none';
                wrapper.setAttribute('style', 'opacity: 1;');
                ads.forEach(function (ad) (ad.style.display = ad.__ank_pixiv__style_display));
              } else {
                currentMangaPage = 0;
                if (lastMangaPage === undefined) {
                  $.getLastMangaPage(function (v) {
                    lastMangaPage = v
                  });
                }
                body.style.backgroundImage = 'none';
                bigImg.setAttribute('src', bigImgPath);
                window.content.scrollTo(0, 0);
                div.style.display = '';
                wrapper.setAttribute('style', 'opacity: 0.1;');
                bigImg.style['opacity'] = '1 !important;';
                ads.forEach(
                  function (ad) {
                    ad.__ank_pixiv__style_display = ad.style.display;
                    ad.style.display = 'none';
                  }
                );
                updateButtons();
              }
              bigMode = !bigMode;
            };

            let (reloadLimit = 10, reloadInterval = 1000, prevTimeout) {
              bigImg.addEventListener('error',
                function () {
                  // XXX 画像はあるけど、サーバのエラーのときはどうなんの？
                  if (bigImg instanceof Ci.nsIImageLoadingContent && bigImg.currentURI) {
                    let req = bigImg.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
                    AnkUtils.dump('AnkPixiv: imageStatus = ' + req.imageStatus.toString(2));
                    //if(reloadLimit && req && !(req.imageStatus & req.STATUS_LOAD_COMPLETE)) {
                    //  if (prevTimeout) {
                    //    clearTimeout(prevTimeout);
                    //    prevTimeout = null;
                    //  }
                    //  setTimeout(function () bigImg.forceReload(), reloadInterval);
                    //  reloadInterval *= 2;
                    //  reloadLimit--;
                    //  return;
                    //}
                  }
                  changeImageSize(false);
                },
                true
              );
            }

            let goNextPage = function (d, _doLoop) {
              doLoop = _doLoop;
              currentMangaPage += (d || 1);
              if (lastMangaPage !== undefined) {
                if (doLoop) {
                  if (currentMangaPage >= lastMangaPage)
                    currentMangaPage = 0;
                  if (currentMangaPage < 0)
                    currentMangaPage = lastMangaPage;
                }
              }
              updateButtons();
              AnkUtils.dump('goto ' + currentMangaPage + ' page');
              bigImg.setAttribute('src', AnkPixiv.info.path.getLargeMangaImage(currentMangaPage));
            };

            doc.changeImageSize = changeImageSize;

            doc.addEventListener('click', function (e) {
              function preventCall (f) {
                e.preventDefault();
                f();
              }

              if (e.button)
                return;

              /* for debug
              AnkUtils.dump(
                (e.target == bigImg) ? 'bigImg' :
                (e.target == prevButton) ? 'prev' :
                (e.target == nextButton) ? 'next' :
                'other'
              );
              */

              if (bigMode) {
                if (e.target == bigImg) {
                  if ($.manga && (currentMangaPage < lastMangaPage || lastMangaPage === undefined))
                    return preventCall(function () goNextPage(1, true));
                  else
                    return preventCall(changeImageSize);
                }
                if ($.manga && e.target == prevButton)
                  return preventCall(function () goNextPage(-1, true));
                if ($.manga && e.target == nextButton)
                  return preventCall(function () goNextPage(1, false));
                return preventCall(changeImageSize);
              } else {
                if (e.target.src == medImg.src)
                  return preventCall(changeImageSize);
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

          // 保存済み表示
          if ($.isDownloaded($.info.illust.id))
            $.insertDownloadedDisplay(
                AnkPixiv.elements.illust.downloadedDisplayParent,
                AnkPixiv.info.illust.R18
            );

          // コメント欄を開く
          if ($.Prefs.get('openComment', false))
            setTimeout(openComment, 1000);

          AnkUtils.dump('installed');

        } catch (e) {
          AnkUtils.dumpError(e);
        }
      };

      return installer;
    },

    /*
     * マンガの最終ページを取得する。
     * この関数は、非同期に呼び出してはいけない。
     * (pagesFromIllustPage のため)
     *
     *    result:     コールバック関数 function (ページ数)
     */
    getLastMangaPage: function (result) {
      const PAGE_LIMIT = 50 - 5;

      let pagesFromIllustPage = AnkPixiv.info.illust.mangaPages;

      function get (source) {
        const MAX = 1000;
        let doc = AnkUtils.createHTMLDocument(source);
        for (let n = 0; n < MAX; n++) {
          if (!doc.getElementById('page' + n))
            return (n < PAGE_LIMIT) ? n : pagesFromIllustPage;
        }
        throw 'not found page elements';
      }

      let xhr = new XMLHttpRequest();
      xhr.open('GET', AnkPixiv.info.path.mangaIndexPage, true);
      xhr.onreadystatechange = function (e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
          result(get(xhr.responseText));
        }
      };
      xhr.send(null);
    },


    installFunctions: function () {
      try {
        let doc = this.currentDocument;
        if (doc.ankpixivFunctionsIntalled)
          return;
        doc.ankpixivFunctionsIntalled = true;
        if (this.inMedium)
          this.functionsInstaller();
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    // ダウンロード済みの表示
    insertDownloadedDisplay: function (appendTo, R18) {
      if (!this.Prefs.get('displayDownloaded', true))
        return;

      const ElementID = 'ankpixiv-downloaded-display';

      let doc = appendTo.ownerDocument;

      if (doc.getElementById(ElementID))
        return;

      let div = doc.createElement('div');
      let textNode = doc.createElement(R18 ? 'blink' : 'textnode');
      textNode.textContent = AnkPixiv.Locale(R18 ? 'used' : 'downloaded');
      div.setAttribute('style', AnkPixiv.Prefs.get('downloadedDisplayStyle', ''));
      div.setAttribute('id', ElementID);
      div.appendChild(textNode);
      if (appendTo)
        appendTo.appendChild(div);
    },


    /*
     * getValidFileExt
     *    file:       nsILocalFile
     *    return:     拡張子
     * ファイルタイプを検出して、正当な拡張子を返す。
     */
    getValidFileExt: function (file) {
      let fstream = AnkUtils.ccci("@mozilla.org/network/file-input-stream;1",
                                  Components.interfaces.nsIFileInputStream);
      let sstream = AnkUtils.ccci("@mozilla.org/scriptableinputstream;1",
                                  Components.interfaces.nsIScriptableInputStream);
      fstream.init(file, -1, 0, 0);
      sstream.init(fstream);
      let header = sstream.read(10);
      sstream.close();
      fstream.close();

      if (header.match(/^\x89PNG/))
        return '.png';

      if (header.match(/^GIF8/))
        return '.gif';

      if (header.match(/JFIF|^\xFF\xD8/))
        return '.jpg';

      return;
    },


    /*
     * fixFileExt
     *    file:     nsILocalFile
     *    return:   修正した時は真
     * 正しい拡張子に修正する。
     */
    fixFileExt:  function (file) {
      const reExt = /\.[^\.]+$/;
      let ext = AnkPixiv.getValidFileExt(file);
      let originalExt =
        let (m = file.path.match(reExt))
          (m && m.toString().toLowerCase());

      if (!ext) {
        AnkUtils.dump('fixFileExt: failed for unknown file type.');
        return false;
      }

      if (ext == originalExt)
        return false;

      let newFile = AnkUtils.makeLocalFile(file.path.replace(reExt, ext));
      file.moveTo(newFile.parent, newFile.leafName);
      return true;
    },


    /********************************************************************************
    * データベース統計
    ********************************************************************************/

    getYourFantasy: function () {
      try {
        function R18 (s)
          (s == 'R-18');

        function ignore (s)
          (!s || (/^(R-18|\u30AA\u30EA\u30B8\u30CA\u30EB)$/i(s)));

        function inc (name)
          (name && !ignore(name) && (typeof stat[name] === 'number' ? stat[name]++ : stat[name] = 1));

        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = this.Storage.database;

        let stat = {};
        let stmt = db.createStatement('select * from histories');
        stmt.reset();
        storageWrapper.initialize(stmt);
        while (storageWrapper.step()) {
          let tags = storageWrapper.row["tags"];
          if (!tags)
            continue;
          tags = tags.split(/\s+/);
          if (tags.some(R18))
            tags.forEach(inc);
        }

        let nums = [];
        for (let [n, v] in Iterator(stat))
          if (v > 2)
            nums.push(v);

        nums.sort(function (a, b) (a - b));
        let low = nums[nums.length - 3];

        let table = {}, sum = 0;
        for (let [n, v] in Iterator(stat)) {
          if (v >= low) {
            table[n] = v;
            sum += v;
          }
        }
        return {table: table, sum: sum};

      } catch (e) {
        AnkUtils.dumpError(e, false);
      }

    },

    displayYourFantasy: function () {
      let doc = AnkPixiv.currentDocument;

      function append ({parent, name, text, style, class}) {
        let elem = doc.createElement(name);
        if (text)
          elem.textContent = text;
        if (style)
          elem.setAttribute('style', style);
        if (class)
          elem.setAttribute('class', class);
        if (parent)
          parent.appendChild(elem);
        return elem;
      }

      let {sum, table} = AnkPixiv.getYourFantasy();
      if (sum < 100)
        return;

      let nextElem = AnkPixiv.elements.mypage.fantasyDisplayNext;

      let area = append({
        name: 'div',
        class: 'area'
      });

      let areaSpace = append({
        parent: area,
        name: 'div',
        class: 'area_space',
      });

      let header = append({
        parent: areaSpace,
        name: 'div',
        text: 'Your Fantasy'
      });

      let body = append({
        parent: areaSpace,
        name: 'table',
        style: 'margin-top: 10px; width: 90% !important'
      });

      for (let [n, v] in Iterator(table)) {
        let tr = append({parent: body, name: 'tr'});
        append({
          parent: tr,
          name: 'td',
          text: n,
          style: 'text-align: left;'
        });
        append({
          parent: tr,
          name: 'td',
          text: v + 'hp',
          style: 'text-align: right;'
        });
      }

      area.setAttribute('id', AnkPixiv.ID_FANTASY_DISPLAY);

      nextElem.parentNode.insertBefore(area, nextElem);
      ['areaBottom', 'area_bottom'].forEach(function (klass) {
        nextElem.parentNode.insertBefore(append({name: 'div', class: klass, text: ''}), nextElem);
      });

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
        AnkUtils.dumpError(e, true);
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
        AnkUtils.dumpError(e, true);
      }
    },


    /********************************************************************************
    * ステータスバー
    ********************************************************************************/

    updateStatusBarText: function () {
      let text = [k for (k in this.downloadings)].length;
      this.statusbarText = text ? text : '';
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
        AnkUtils.dumpError(e);
      }
    },


    onFocus: function (ev) {
      try {
        let changeEnabled = function (id) {
          let elem = document.getElementById(id);
          if (!elem)
            return;
          elem.setAttribute('dark', !this.inIllustPage);
        };

        changeEnabled.call(this, 'ankpixiv-toolbar-button');
        changeEnabled.call(this, 'ankpixiv-statusbarpanel');
        changeEnabled.call(this, 'ankpixiv-menu-download');

        if (AnkPixiv.inPixiv && !AnkPixiv.Store.document.onFocusDone) {
          AnkPixiv.Store.document.onFocusDone = true;

          if (this.inIllustPage) {
            this.installFunctions();
            let illust_id = this.info.illust.id;
            if (this.Prefs.get('maxIllustId', this.MAX_ILLUST_ID) < illust_id) {
              this.Prefs.set('maxIllustId', illust_id);
            }
          }

          if (AnkPixiv.inMyPage && !AnkPixiv.elements.mypage.fantasyDisplay)
            this.displayYourFantasy();
        }

      } catch (e) {
        AnkUtils.dumpError(e);
      }
    },


    onDownloadButtonClick: function (event) {
      event.stopPropagation();
      event.preventDefault();
      let useDialog = this.Prefs.get('showSaveDialog', true);
      let button = (typeof event.button == 'undefined') ? 0 : event.button;
      if (this.inIllustPage) {
        switch(button) {
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
        switch(button) {
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
                              "`datetime` = datetime('" + dt + "', '1 months'), version = 2",
                              'rowid = ' + old.rowid);
        } catch (e) {
          AnkUtils.dump(e);
        }
      }

      // version 2
      // TODO
    },

    /********************************************************************************
    * 外部向け
    ********************************************************************************/

    rate: function (pt) {
      if (!(this.inPixiv && this.inMedium))
        throw 'not in pixiv';
      if (pt < 1 || 10 < pt)
        throw 'out of range';
      let elem, iter = AnkUtils.findNodesByXPath("//ul[@class='unit-rating']/li/a");
      while (elem = iter.iterateNext()) {
        let m = elem.className.match(/r(\d{1,2})-unit/);
        if (m[1] == pt) {
          let evt = document.createEvent('MouseEvents');
          evt.initEvent('click', false, true);
          elem.dispatchEvent(evt);
          break;
        }
      }
      return true;
    },


    /********************************************************************************
    * テスト用
    ********************************************************************************/

  };

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
