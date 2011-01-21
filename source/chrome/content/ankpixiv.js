
try {

  AnkPixiv = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_VERSION: 5,

    PREF_PREFIX: 'extensions.ankpixiv.',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',

    Storage: new AnkStorage("ankpixiv.sqlite", // {{{
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
    ), // }}}

    FULL_WIDTH_CHARS: { // {{{
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
    }, // }}}

    Prefs: new AnkPref('extensions.ankpixiv'),

    AllPrefs: new AnkPref(),

    Store: (function () { // {{{
      function getDocStore (doc)
        (doc.__ank_pixiv_store || (doc.__ank_pixiv_store = {}));

      return {
        get document () getDocStore(AnkPixiv.elements.doc),
        get documents ()
          AnkUtils.A(window.gBrowser.mTabs).map(function (it) getDocStore(it.linkedBrowser.contentDocument))
      };
    })(), // }}}

    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),

    URL: { // {{{
      Pixiv: 'http://www.pixiv.net/',
    }, // }}}

    MAX_ILLUST_ID: 12000000,


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get current () { // {{{
      function clone (obj) {
        if (obj && typeof obj === 'object' && !(obj instanceof HTMLElement)) {
          let res = {};
          for (let [n, v] in Iterator(obj))
            res[n] = clone(v);
          return res;
        }
        return obj;
      }

      return 'in info elements'.split(/\s+/).reduce(
        function (r, name) (r[name] = clone(AnkPixiv[name]), r),
        {}
      );
    }, // }}}

    get currentLocation () // {{{
      window.content.document.location.href, // }}}

    in: { // {{{
      get manga () { // {{{
        let node = AnkPixiv.elements.illust.largeLink;
        return node && ~node.href.indexOf('?mode=manga&');
      }, // }}}

      get pixiv () { // {{{
        try {
          return AnkPixiv.elements.doc.location.hostname === 'www.pixiv.net';
        } catch (e) {
          return false;
        }
      }, // }}}

      get medium () // {{{
        AnkPixiv.in.pixiv && AnkPixiv.currentLocation.match(/member_illust\.php\?mode=medium&illust_id=\d+/), // }}}

      get illustPage () // {{{
        AnkPixiv.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/), // }}}

      get myPage () // {{{
        (AnkPixiv.currentLocation == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !AnkPixiv.elements.illust.avatar, // }}}
    }, // }}}

    elements: (function () { // {{{
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
    })(), // }}}

    info: (function () { // {{{
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

        get shortTags ()
          AnkPixiv.info.illust.tags.filter(function (it) (it.length <= 8)),

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
            } else if (m = item.match(/(\d+)\xD7(\d+)/)) {
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
            AnkPixiv.in.manga ? i.getLargeMangaImage() : i.largeStandardImage,

        get largeStandardImage ()
          AnkPixiv.info.path.mediumImage.replace(/_m\./, '.'),

        getLargeMangaImage: function (n, base, ext, originalSize) {
          let url =
            (base || AnkPixiv.info.path.largeStandardImage).replace(
              /\.[^\.]+$/,
              function (m) (('_p' + (n || 0)) + (ext || m))
            );
          return originalSize ? url.replace(/_p(\d+)\./, '_big_p$1.') : url;
        },

        get mediumImage ()
          AnkPixiv.elements.illust.mediumImage.src.replace(/\?.*$/, ''),
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}

    get infoText () { // {{{
      let ignore =
        let (pref = AnkPixiv.Prefs.get('infoText.ignore', 'illust.dateTime.'))
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

      return textize([], AnkPixiv.info);
    }, // }}}


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
    showFilePicker: function (defaultFilename) { // {{{
      const nsIFilePicker = Components.interfaces.nsIFilePicker;
      let filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

      filePicker.appendFilters(nsIFilePicker.filterAll);
      filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
      filePicker.defaultString = defaultFilename;

      let prefInitDir = AnkPixiv.Prefs.get('initialDirectory');
      if (prefInitDir) {
        let initdir = AnkUtils.ccci("@mozilla.org/file/local;1", Components.interfaces.nsILocalFile);
        initdir.initWithPath(prefInitDir);
        filePicker.displayDirectory = initdir;
      }

      return (filePicker.show() == nsIFilePicker.returnOK) && filePicker && filePicker.file;
    }, // }}}

    /*
     * showFilePickerWithMeta
     *    basename:        初期ファイル名
     *    ext:             拡張子
     *    return:          {image: nsILocalFile, meta: nsILocalFile}
     * ファイル保存ダイアログを開く
     */
    showFilePickerWithMeta: function (basename, ext, isFile) { // {{{
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
    }, // }}}

    /*
     * showDirectoryPicker
     *    defaultPath: 初期表示ディレクトリ
     *    return:      選択されたディレクトリ(nsIFilePicker)
     * ディレクトリ選択ダイアログを表示
     */
    showDirectoryPicker: function (defaultPath) { // {{{
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
    }, // }}}

    /*
     * TODO
     * queryInitialDirectory
     * ユーザに初期ディレクトリの場所を尋ねる
     */
    queryInitialDirectory: function () { // {{{
      let dir = AnkPixiv.showDirectoryPicker(AnkPixiv.Prefs.get('initialDirectory'));
      if (dir) {
        AnkPixiv.Prefs.set('initialDirectory', dir.filePath, 'string');
      }
      return dir;
    }, // }}}

    /*
     * 右下にでるポップアップメッセージ
     *    title:    タイトル
     *    text:     メッセージ内容 */
    popupAlert: function (title, text) { // {{{
      return AnkUtils.popupAlert("chrome://ankpixiv/content/statusbar-button.ico",
                                 title, text, false, "", null);
    }, // }}}


    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    /*
     * filenameExists
     *    filename:      String パスfilename
     *    return:   boolean
     * 同じファイル名が存在するか？
     */
    filenameExists: function (filename) // {{{
      AnkPixiv.Storage.exists('histories',
                              'filename = ?',
                              function (stmt) stmt.bindUTF8StringParameter(0, filename)), // }}}

    /*
     * newLocalFile
     *    url:      String パス
     *    return:   nsILocalFile
     * nsILocalFileを作成
     */
    newLocalFile: function (path) { // {{{
      let temp = AnkUtils.ccci('@mozilla.org/file/local;1', Components.interfaces.nsILocalFile);
      if (AnkUtils.platform === 'Win32')
        path = path.replace(/\//g, '\\');
      temp.initWithPath(path);
      return temp;
    }, // }}}

    /*
     * newFileURI
     *    url:      String パス
     *    return:   nsILocalFile
     * nsILocalFileを作成
     */
    newFileURI: function (path) { // {{{
      let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
      return IOService.newFileURI(AnkPixiv.newLocalFile(path));
    }, // }}}

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
    getSaveFilePath: function (filenames, ext, useDialog, isFile) { // {{{
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
        let prefInitDir = AnkPixiv.Prefs.get('initialDirectory');
        let initDir = AnkPixiv.newLocalFile(prefInitDir);

        if (!initDir.exists())
          return AnkPixiv.showFilePickerWithMeta(filenames[0], ext, isFile);

        for (let i in filenames) {
          let image = _file(prefInitDir, filenames[i], ext);
          let meta = _file(prefInitDir, filenames[i], '.txt', true);

          if (_exists(image) || _exists(meta))
            continue;

          if (useDialog) {
            return AnkPixiv.showFilePickerWithMeta(filenames[i], ext, isFile);
          } else {
            return {image: image.file, meta: meta.file};
          }
        }
      } catch (e) {
        // FIXME ?
        AnkUtils.dump(e);
      }

      return AnkPixiv.showFilePickerWithMeta(filenames[0], ext, isFile);
    }, // }}}

    /*
     * isDownloaded
     *    illust_id:     イラストID
     *    return:        ダウンロード済み？
     */
    isDownloaded: function (illust_id) { // {{{
      if (!/^\d+$/.test(illust_id))
        throw "Invalid illust_id";
      return AnkPixiv.Storage.exists('histories', 'illust_id = ' + illust_id);
    }, // }}}

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
    downloadTo: function (url, referer, file, onComplete, onError) { // {{{ // {{{
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
              return onError(orig_args, file.path, 0);
            }

            if (responseStatus != 200)
              return onError(orig_args, file.path, responseStatus);

            if (onComplete)
              return onComplete(orig_args, file.path, responseStatus);
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
    }, // }}} // }}}

    /*
     * saveTextFile
     *    file:           nsILocalFile
     *    text:           String
     * テキストをローカルに保存します。
     */
    saveTextFile: function (file, text) { // {{{
      let dir = file.parent;
      dir.exists() || dir.create(dir.DIRECTORY_TYPE, 0755);

      let out = AnkUtils.ccci('@mozilla.org/network/file-output-stream;1', Ci.nsIFileOutputStream);
      let conv = AnkUtils.ccci('@mozilla.org/intl/converter-output-stream;1', Ci.nsIConverterOutputStream);
      out.init(file, 0x02 | 0x10 | 0x08, 0664, 0);
      conv.init(out, 'UTF-8', text.length, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
      conv.writeString(text);
      conv.close();
      out.close();
    }, // }}}

    /*
     * downloadFile
     *    url:            URL
     *    referer:        リファラ
     *    localfile:      出力先ファイル nsILocalFile
     *    onComplete      終了時のアラート
     *    return:         キャンセルなどがされなければ、true
     * ファイルをダウンロードする
     */
    downloadFile: function (url, referer, localfile, onComplete, onError) { // {{{
      AnkPixiv.downloadTo(url, referer, localfile, onComplete, onError);
      return true;
    }, // }}}

    /*
     * downloadFiles
     *    urls:           URL
     *    referer:        リファラ
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    onComplete      終了時のアラート
     *    return:         キャンセルなどがされなければ、true
     * 複数のファイルをダウンロードする
     */
    downloadFiles: function (urls, referer, localdir, onComplete, onError) { // {{{
      const MAX_FILE = 1000;

      let index = 0;
      let lastFile = null;

      // XXX ディレクトリは勝手にできるっぽい
      //localdir.exists() || localdir.create(localdir.DIRECTORY_TYPE, 0755);

      function _onComplete () {
        arguments[1] = localdir.path;
        return onComplete.apply(null, arguments);
      }

      function downloadNext (_orignalArgs, _filePath, status) {

        // 前ファイルの処理
        if (lastFile) {
          // ダウンロードに失敗していたら、そこで終了さ！
          if (!lastFile.exists) {
            AnkUtils.dump('Strange error! file not found!');
            return _onComplete.apply(null, arguments);
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
            return _onComplete.apply(null, arguments);
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
          return _onComplete.apply(null, arguments);

        let url = urls[index];
        let file = localdir.clone();
        let fileExt = url.match(/\.\w+$/)[0] || '.jpg';
        file.append(AnkUtils.zeroPad(index + 1, 2) + fileExt);

        lastFile = file;
        index++;

        AnkUtils.dump('DL => ' + file.path);
        return AnkPixiv.downloadTo(url, referer, file, downloadNext, onError);
      }

      downloadNext();
      return true;
    }, // }}}

    /*
     * downloadCurrentImage
     *    useDialog:            保存ダイアログを使うか？
     *    confirmDownloaded:    ダウンロード済みの場合の確認を行うか？
     *    debug:                トークンのテストを行う
     *    return:               成功？
     * 現在表示されている画像を保存する
     */
    downloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
      try {

        // 自分のページのは構成が違い、問題となるのでダウンロードしないようにする。
        if (AnkPixiv.in.myIllust)
          return false;

        if (typeof useDialog === 'undefined')
          useDialog = AnkPixiv.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = AnkPixiv.Prefs.get('confirmExistingDownload');

        if (!AnkPixiv.in.illustPage)
          return false;

        let destFiles;
        let metaText      = AnkPixiv.infoText;
        let pageUrl       = AnkPixiv.currentLocation;
        let url           = AnkPixiv.info.path.largeStandardImage;
        let illust_id     = AnkPixiv.info.illust.id;
        let ext           = AnkPixiv.info.path.ext;
        let ref           = AnkPixiv.currentLocation.replace(/mode=medium/, 'mode=big');
        let member_id     = AnkPixiv.info.member.id;
        let member_name   = AnkPixiv.info.member.name || member_id;
        let pixiv_id      = AnkPixiv.info.member.pixivId;
        let memoized_name = AnkPixiv.info.member.memoizedName || member_name;
        let tags          = AnkPixiv.info.illust.tags;
        let title         = AnkPixiv.info.illust.title;
        let comment       = AnkPixiv.info.illust.comment;
        let R18           = AnkPixiv.info.illust.R18;
        let doc           = AnkPixiv.elements.doc;
        let dlDispPoint   = AnkPixiv.elements.illust.downloadedDisplayParent;
        let filenames     = [];
        let shortTags     = AnkPixiv.info.illust.shortTags;

        if (AnkPixiv.Prefs.get('saveHistory', true)) {
          try {
            if (AnkPixiv.Storage.exists('members', 'id = ' + parseInt(member_id))) {
              // 古いデータには pixiv_id がついていなかったら付加する
              // (DB_VERSION = 5 で pixiv_id がついた
              AnkPixiv.Storage.createStatement(
                'update members set pixiv_id = ?1, version = ?2 where (id = ?3) and (pixiv_id is null)',
                function (stmt) {
                  stmt.bindUTF8StringParameter(0, pixiv_id);
                  stmt.bindInt32Parameter(1, AnkPixiv.DB_VERSION);
                  stmt.bindInt32Parameter(2, member_id);
                  stmt.executeStep();
                }
              );
            } else {
              AnkPixiv.Storage.insert(
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
        if (AnkPixiv.isDownloaded(illust_id)) {
          if (confirmDownloaded) {
            if (!window.confirm(AnkPixiv.Locale('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        let savedDateTime = new Date();
        let defaultFilename = AnkPixiv.Prefs.get('defaultFilename', '?member-name? - ?title?');
        let alternateFilename = AnkPixiv.Prefs.get('alternateFilename', '?member-name? - ?title? - (?illust-id?)');
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
            [/\?illust-year2\?/g, ii.year.toString().slice(2, 4)],
            [/\?illust-month\?/g, ii.month],
            [/\?illust-day\?/g, ii.day],
            [/\?illust-hour\?/g, ii.hour],
            [/\?illust-minute\?/g, ii.minute],
            [/\?saved-year\?/g, savedDateTime.getFullYear()],
            [/\?saved-year2\?/g, savedDateTime.getFullYear().toString().slice(2, 4)],
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
illust-year2  = ?illust-year2?
illust-month  = ?illust-month?
illust-day    = ?illust-day?
illust-hour   = ?illust-hour?
illust-minute = ?illust-minute?
saved-year    = ?saved-year?
saved-year2   = ?saved-year2?
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
          server: AnkPixiv.info.illust.server,
          saved: true,
          datetime: AnkUtils.toSQLDateTimeString(savedDateTime),
          comment: comment,
          version: AnkPixiv.DB_VERSION,
        };

        let removeDownloading = function () {
          delete AnkPixiv.downloadings[pageUrl];
          AnkPixiv.updateStatusBarText();
        };

        let addDownloading = function () {
          AnkPixiv.downloadings[pageUrl] = new Date();
          AnkPixiv.updateStatusBarText();
        };

        let onComplete = function (orig_args, local_path) {
          try {
            removeDownloading();

            let caption = AnkPixiv.Locale('finishedDownload');
            let text = filenames[0];
            let prefInitDir = AnkPixiv.Prefs.get('initialDirectory');
            let relPath = prefInitDir ? AnkUtils.getRelativePath(local_path, prefInitDir)
                                      : AnkUtils.extractFilename(local_path);

            if (AnkPixiv.Prefs.get('saveHistory', true)) {
              try {
                record['local_path'] = local_path;
                record['filename'] = relPath;
                AnkPixiv.Storage.insert('histories', record);
              } catch (e) {
                AnkUtils.dumpError(e, true);
                caption = 'Error - onComplete';
                text = e;
              }
            }

            if (AnkPixiv.Prefs.get('saveMeta', true))
              AnkPixiv.saveTextFile(destFiles.meta, metaText);

            if (AnkPixiv.Prefs.get('showCompletePopup', true))
              AnkPixiv.popupAlert(caption, text);

            AnkPixiv.insertDownloadedDisplay(dlDispPoint, R18);

            AnkPixiv.Store.documents.forEach(function(it) (it.marked = false));
            AnkPixiv.markDownloaded();

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
            AnkPixiv.Locale('downloadFailed') + '\n' +
            (responseStatus ? 'Status: ' + responseStatus + '\n' : '') +
            desc;

          window.alert(msg);
          AnkUtils.dump(msg);

          let confirmMsg =
            AnkPixiv.Locale('confirmOpenIllustrationPage') + '\n' +
            desc;

          if (window.confirm(confirmMsg))
            AnkUtils.openTab(pageUrl);
        };

        // ダウンロード中だったらやめようぜ！
        if (AnkPixiv.downloadings[pageUrl]) {
          return window.alert(AnkPixiv.Locale('alreadyDownloading'));
        }

        // XXX 前方で宣言済み
        destFiles = AnkPixiv.getSaveFilePath(filenames, AnkPixiv.in.manga ? '' : ext, useDialog, !AnkPixiv.in.manga);
        if (!destFiles)
          return;

        if (AnkPixiv.in.manga) {
          AnkPixiv.getLastMangaPage(function (v, ext) {
            function _download (originalSize) {
              let urls = [];
                for (let i = 0; i < v; i++)
                  urls.push(AnkPixiv.info.path.getLargeMangaImage(i, url, ext, originalSize));
                if (AnkPixiv.downloadFiles(urls, ref, destFiles.image, onComplete, onError))
                  addDownloading();
            }

            if (AnkPixiv.Prefs.get('downloadOriginalSize', false)) {
              AnkUtils.remoteFileExists(
                AnkPixiv.info.path.getLargeMangaImage(0, url, ext, true),
                _download
              );
            } else {
              _download(false);
            }
          });
        } else {
          if (AnkPixiv.downloadFile(url, ref, destFiles.image, onComplete, onError))
            addDownloading();
        }

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    }, // }}}

    /*
     * downloadCurrentImageAuto
     * 自動的にダウンロードする場合はこっちを使う
     */
    downloadCurrentImageAuto: function () { // {{{
      AnkPixiv.downloadCurrentImage(undefined, AnkPixiv.Prefs.get('confirmExistingDownloadWhenAuto'));
    }, // }}}

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{
      function delay (msg, e) { // {{{
        if (installTryed == 20) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkPixiv.Prefs.get('showErrorDialog'));
        }
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      // closure {{{
      let ut = AnkUtils;
      let installInterval = 500;
      let installTryed = 0;
      let con = content;
      let doc = AnkPixiv.elements.doc;
      let lastMangaPage = undefined;
      let currentMangaPage = 0;
      // }}}

      let installer = function () {
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var wrapper = doc.getElementById('wrapper');
            var medImg = AnkPixiv.elements.illust.mediumImage;
            var bigImgPath = AnkPixiv.info.path.largeImage;
            var openComment = function () content.wrappedJSObject.one_comment_view();
            var worksData = AnkPixiv.elements.illust.worksData;
            var bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれて以内っぽいときは、遅延する
          if (!(body && medImg && bigImgPath && wrapper && openComment && worksData)) // {{{
            return delay("delay installation by null");
          // }}}

          // 中画像クリック時に保存する
          if (AnkPixiv.Prefs.get('downloadWhenClickMiddle')) { // {{{
            medImg.addEventListener(
              'click',
              function (e) {
                AnkPixiv.downloadCurrentImageAuto();
              },
              true
            );
          } // }}}

          // 大画像関係
          if (AnkPixiv.Prefs.get('largeOnMiddle', true)) { // {{{
            let IDPrefix =
              function (id)
                ('ank-pixiv-large-viewer-' + id);

            let createElement =
              function (tagName, id)
                let (elem = doc.createElement(tagName))
                  (id && elem.setAttribute('id', IDPrefix(id)), elem);

            let viewer = createElement('div', 'panel');
            let bigImg = createElement('img', 'image');
            let imgPanel = createElement('div', 'image-panel');
            let buttonPanel = createElement('div', 'button-panel');
            let prevButton = createElement('button', 'previous-button');
            let nextButton = createElement('button', 'next-button');
            let pageSelector = createElement('select', 'page-selector');

            let updateButtons = function (v) {
              nextButton.innerHTML =
                (lastMangaPage === undefined || (currentMangaPage < lastMangaPage - 1)) ? '>>' : '\xD7';
              prevButton.innerHTML =
                (currentMangaPage > 0) ? '<<' : '\xD7';
              pageSelector.value = currentMangaPage;
            };

            viewer.setAttribute('style', 'position: absolute; top: 0px; left: 0px; width:100%; height: auto; background: white; text-align: center; padding-top: 10px; padding-bottom: 100px; display: none; -moz-opacity: 1;');
            prevButton.innerHTML = '<<';
            nextButton.innerHTML = '>>';
            buttonPanel.setAttribute('style', 'display: block; margin: 0 auto; text-align: center; ');

            [prevButton, nextButton].forEach(function (button) {
              button.setAttribute('class', 'submit_btn');
              button.setAttribute('style', 'width: 100px !important');
            });

            /*
             * viewer
             *    - imgPanel
             *      - bigImg
             *    - buttonPanel
             *      - prevButton
             *      - pageSelector
             *      - nextButton
             */
            viewer.appendChild(imgPanel);
            imgPanel.appendChild(bigImg);
            if (AnkPixiv.in.manga) {
              viewer.appendChild(buttonPanel);
              buttonPanel.appendChild(prevButton);
              buttonPanel.appendChild(nextButton);
            }
            body.appendChild(viewer);

            let bigMode = false;

            let changeImageSize = function () {
              let ads = AnkPixiv.elements.illust.ads;
              if (bigMode) {
                body.style.backgroundImage = bgImage;
                viewer.style.display = 'none';
                wrapper.setAttribute('style', 'opacity: 1;');
                ads.forEach(function (ad) (ad.style.display = ad.__ank_pixiv__style_display));
              } else {
                currentMangaPage = 0;
                if (lastMangaPage === undefined) {
                  AnkPixiv.getLastMangaPage(function (v) {
                    lastMangaPage = v;
                    if (v) {
                      buttonPanel.insertBefore(pageSelector, nextButton);
                      for (let i = 0; i < v; i++) {
                        let option = doc.createElement('option');
                        option.textContent = (i + 1) + '/' + v;
                        option.value = i;
                        pageSelector.appendChild(option);
                      }
                    }
                  });
                }
                body.style.backgroundImage = 'none';
                bigImg.setAttribute('src', bigImgPath);
                window.content.scrollTo(0, 0);
                viewer.style.display = '';
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
                  if (bigImg instanceof Ci.nsIImageLoadingContent && bigImg.currentURI) {
                    let req = bigImg.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
                    AnkUtils.dump('AnkPixiv: imageStatus = ' + req.imageStatus.toString(2));
                    if (confirm(AnkPixiv.Locale('confirmForReloadBigImage'))) {
                      bigImg.forceReload();
                      return;
                    }
                  }
                  changeImageSize();
                },
                true
              );
            }

            let goPage = function (num) {
              currentMangaPage = num;
              if (lastMangaPage !== undefined && ((num >= lastMangaPage) || (num < 0)))
                return changeImageSize();
              updateButtons();
              AnkUtils.dump('goto ' + num + ' page');
              bigImg.setAttribute('src', AnkPixiv.info.path.getLargeMangaImage(num));
            };

            let goNextPage = function (d, doLoop) {
              if (!bigMode)
                changeImageSize();
              let page = currentMangaPage + (d || 1);
              goPage(
                lastMangaPage === undefined ? page :
                !doLoop                     ? page :
                page >= lastMangaPage       ? 0 :
                page < 0                    ? lastMangaPage :
                page
              );
            };

            doc.changeImageSize = changeImageSize;
            doc.goNextMangaPage = goNextPage;

            pageSelector.addEventListener('change', function (e) {
              return goPage(parseInt(pageSelector.value, 10));
            }, true);

            doc.addEventListener('click', function (e) {
              function preventCall (f) {
                e.preventDefault();
                f();
              }

              if (e.button)
                return;

              if (bigMode) {
                if (e.target == bigImg) {
                  if (AnkPixiv.in.manga && (currentMangaPage < lastMangaPage || lastMangaPage === undefined))
                    return preventCall(function () goNextPage(1, false));
                  else
                    return preventCall(changeImageSize);
                }
                if (AnkPixiv.in.manga && e.target == prevButton)
                  return preventCall(function () goNextPage(-1, false));
                if (AnkPixiv.in.manga && e.target == nextButton)
                  return preventCall(function () goNextPage(1, false));
                if (AnkPixiv.in.manga && e.target == pageSelector)
                  return;
                if (AnkPixiv.in.manga && e.target.parentNode == pageSelector) {
                  return;
                }
                return preventCall(changeImageSize);
              } else {
                if (e.target.src == medImg.src)
                  return preventCall(changeImageSize);
              }
            }, true);
          } // }}}

          // レイティングによるダウンロード
          (function () { // {{{
            if (!AnkPixiv.Prefs.get('downloadWhenRate', false))
              return;
            let point = AnkPixiv.Prefs.get('downloadRate', 10);
            let elem, iter = AnkUtils.findNodesByXPath("//ul[@class='unit-rating']/li/a");
            while (elem = iter.iterateNext()) {
              let m = elem.className.match(/r(\d{1,2})-unit/);
              if (m && (point <= parseInt(m[1]))) {
                elem.addEventListener('click', function() AnkPixiv.downloadCurrentImageAuto(), true);
              }
            }
          })(); // }}}

          // 保存済み表示
          if (AnkPixiv.isDownloaded(AnkPixiv.info.illust.id)) { // {{{
            AnkPixiv.insertDownloadedDisplay(
                AnkPixiv.elements.illust.downloadedDisplayParent,
                AnkPixiv.info.illust.R18
            );
          } // }}}

          // コメント欄を開く
          if (AnkPixiv.Prefs.get('openComment', false)) // {{{
            setTimeout(openComment, 1000);
          // }}}

          // 最大イラストIDの変更
          let (illust_id = AnkPixiv.info.illust.id) { // {{{
            if (AnkPixiv.Prefs.get('maxIllustId', AnkPixiv.MAX_ILLUST_ID) < illust_id) {
              AnkPixiv.Prefs.set('maxIllustId', illust_id);
            }
          } // }}}

          AnkUtils.dump('installed');

        } catch (e) {
          AnkUtils.dumpError(e);
        }
      };

      return installer();
    }, // }}}

    /*
     * マンガの最終ページを取得する。
     * この関数は、非同期に呼び出してはいけない。
     * (pagesFromIllustPage のため)
     *
     *    result:     コールバック関数 function (ページ数)
     */
    getLastMangaPage: function (result) { // {{{
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
    }, // }}}

    /*
     * ページ毎の関数をインストール
     */
    installFunctions: function () { // {{{
      try {
        if (AnkPixiv.Store.document.functionsInstalled)
          return;
        AnkPixiv.Store.document.functionsInstalled = true;
        if (AnkPixiv.in.pixiv) {
          if (AnkPixiv.in.medium) {
            AnkPixiv.installMediumPageFunctions();
          } else {
            // AutoPagerize 専用コードだよ
            if (AnkPixiv.Prefs.get('markDownloaded', false)) {
              AnkPixiv.elements.doc.addEventListener(
                'AutoPagerize_DOMNodeInserted',
                function (e) AnkPixiv.markDownloaded(e.target, true),
                false
              );
            }
          }
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    }, // }}}

    /*
     * ダウンロード済みの表示をページに挿入する
     *    appendTo:     追加先の要素
     *    R18:          イラストはR18か？
     */
    insertDownloadedDisplay: function (appendTo, R18) { // {{{
      if (!AnkPixiv.Prefs.get('displayDownloaded', true))
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
    }, // }}}

    /*
     * getValidFileExt
     *    file:       nsILocalFile
     *    return:     拡張子
     * ファイルタイプを検出して、正当な拡張子を返す。
     */
    getValidFileExt: function (file) { // {{{
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
    }, // }}}

    /*
     * fixFileExt
     *    file:     nsILocalFile
     *    return:   修正した時は真
     * 正しい拡張子に修正する。
     */
    fixFileExt:  function (file) { // {{{
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
    }, // }}}


    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const BoxTag = /^(li|div)$/i;

      function findBox (e, limit) {
        if (limit <= 0)
          return null;
        if (BoxTag(e.tagName))
          return e;
        return findBox(e.parentNode, limit - 1);
      }

      if (AnkPixiv.in.medium || !AnkPixiv.in.pixiv)
        return;

      if (!(
        force
        ||
        (
          AnkPixiv.Prefs.get('markDownloaded', false) &&
          !AnkPixiv.Store.document.marked
        )
      ))
        return;

      AnkPixiv.Store.document.marked = true;

      if (!node)
        node = AnkPixiv.elements.doc;

      AnkUtils.A(node.querySelectorAll('a > img')) .
        map(function (img) img.parentNode) .
        map(function (link) link.href && let (m = IsIllust(link.href)) m && [link, m]) .
        filter(function (m) m) .
        map(function ([link, m]) [link, parseInt(m[1], 10)]) .
        forEach(function ([link, id]) {
          if (!AnkPixiv.isDownloaded(id))
            return;
          let box = findBox(link, 3);
          if (box) {
            box.style.borderBottom = '4px solid red';
            //box.style.margin = '-2px';
            //box.style.opacity = '0.2';
          }
        });
    }, // }}}


    /********************************************************************************
    * データベース統計
    ********************************************************************************/

    getYourFantasy: function () { // {{{
      try {
        function R18 (s)
          (s == 'R-18');

        function ignore (s)
          (!s || (/^(R-18|\u30AA\u30EA\u30B8\u30CA\u30EB)$/i(s)));

        function inc (name)
          (name && !ignore(name) && (typeof stat[name] === 'number' ? stat[name]++ : stat[name] = 1));

        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = AnkPixiv.Storage.database;

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

    }, // }}}

    displayYourFantasy: function () { // {{{
      return;

      let doc = AnkPixiv.elements.doc;

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

    }, // }}}


    /********************************************************************************
    * データベース関連
    ********************************************************************************/

    updateDatabase: function () { // {{{
      // version 1
      let olds = AnkPixiv.Storage.oselect('histories', '(version is null) or (version < 1)');
      for each (let old in olds) {
        try {
          let dt = AnkUtils.toSQLDateTimeString(new Date(old.datetime));
          AnkPixiv.Storage.update('histories',
                              "`datetime` = datetime('" + dt + "', '1 months'), version = 2",
                              'rowid = ' + old.rowid);
        } catch (e) {
          AnkUtils.dump(e);
        }
      }

      // version 2
      // TODO
    }, // }}}

    fixStorageEncode: function () { // {{{
      try {
        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = AnkPixiv.Storage.database;
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
    }, // }}}

    exchangeFilename: function () { // {{{
      try {
        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = AnkPixiv.Storage.database;
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
    }, // }}}


    /********************************************************************************
    * ステータスバー
    ********************************************************************************/

    set statusbarText (text) { // {{{
      let elem = document.getElementById('ankpixiv-statusbar-text');
      elem.textContent = text;
      elem.collapsed = text.length == 0;
      return text;
    }, // }}}

    updateStatusBarText: function () { // {{{
      let text = [k for (k in AnkPixiv.downloadings)].length;
      AnkPixiv.statusbarText = text ? text : '';
    }, // }}}


    /********************************************************************************
    * イベント
    ********************************************************************************/

    openPrefWindow: function () { // {{{
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                        "centerscreen,chrome,modal", arguments);
    }, // }}}

    onInit: function () { // {{{
      window.addEventListener('focus', AnkPixiv.onFocus, true);
      let appcontent = document.getElementById('appcontent');
      appcontent.addEventListener('DOMContentLoaded', AnkPixiv.onDOMContentLoaded, false);
    }, // }}}

    onDOMContentLoaded: function (event) { // {{{
      function body (doc) {
        if (doc.readyState == 'complete') {
          AnkPixiv.installFunctions();
          AnkPixiv.markDownloaded(doc, true);
        } else {
          setTimeout(function () body(doc), 250);
        }
      }

      let doc = event.target;
      if (doc && doc.domain == 'www.pixiv.net')
        body(event.target);
    }, // }}}

    onFocus: function (ev) { // {{{
      try {
        let changeEnabled = function (id) {
          let elem = document.getElementById(id);
          if (!elem)
            return;
          elem.setAttribute('dark', !AnkPixiv.in.illustPage);
        };

        changeEnabled.call(AnkPixiv, 'ankpixiv-toolbar-button');
        changeEnabled.call(AnkPixiv, 'ankpixiv-statusbarpanel');
        changeEnabled.call(AnkPixiv, 'ankpixiv-menu-download');

        AnkPixiv.markDownloaded();

        if (AnkPixiv.in.pixiv && !AnkPixiv.Store.document.onFocusDone) {
          AnkPixiv.Store.document.onFocusDone = true;

          if (AnkPixiv.in.illustPage) {
            AnkPixiv.installFunctions();
          }

          if (AnkPixiv.in.myPage && !AnkPixiv.elements.mypage.fantasyDisplay)
            AnkPixiv.displayYourFantasy();
        }

      } catch (e) {
        AnkUtils.dumpError(e);
      }
    }, // }}}

    onDownloadButtonClick: function (event) { // {{{
      event.stopPropagation();
      event.preventDefault();
      let useDialog = AnkPixiv.Prefs.get('showSaveDialog', true);
      let button = (typeof event.button == 'undefined') ? 0 : event.button;
      if (AnkPixiv.in.illustPage) {
        switch(button) {
          case 0: AnkPixiv.downloadCurrentImage(useDialog); break;
          case 1: AnkPixiv.downloadCurrentImage(!useDialog); break;
          case 2: AnkPixiv.openPrefWindow(); break;
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
          case 2: AnkPixiv.openPrefWindow(); break;
        }
      }
    }, // }}}


    /********************************************************************************
    * 外部向け
    ********************************************************************************/

    rate: function (pt) { // {{{
      if (!(AnkPixiv.in.pixiv && AnkPixiv.in.medium))
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
    }, // }}}


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
