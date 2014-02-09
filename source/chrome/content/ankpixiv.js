
try {

  AnkPixiv = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_VERSION: 5,

    PREF_PREFIX: 'extensions.ankpixiv.',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',

    Storage: null,

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

    FIT: {
      NONE: 0,
      IN_WINDOW_SIZE: 1,
      IN_WINDOW_HEIGHT: 2,
      IN_WINDOW_WIDTH: 3
    },

    CLASS_NAME: {
      DOWNLOADED: 'ank-pixiv-tool-downloaded'
    },

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
        return node && node.href.match(/(?:&|\?)mode=manga(?:&|$)/);
      }, // }}}

      get pixiv () { // {{{
        try {
          return AnkPixiv.elements.doc.location.hostname === 'www.pixiv.net';
        } catch (e) {
          return false;
        }
      }, // }}}

      get medium () { // {{{
        let loc = AnkPixiv.currentLocation;
        return (
          AnkPixiv.in.pixiv &&
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        AnkPixiv.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/), // }}}

      get myPage () // {{{
        (AnkPixiv.currentLocation == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !AnkPixiv.elements.illust.avatar, // }}}
    }, // }}}

    elements: (function () { // {{{
      let illust =  {
        get mediumImage () {
          return (
            AnkPixiv.elements.doc.querySelector('.works_display > a > img')
            ||
            AnkPixiv.elements.doc.querySelector('.works_display > * > a > img')
          );
        },

        get largeLink () {
          return (
            AnkPixiv.elements.doc.querySelector('.works_display > a')
            ||
            AnkPixiv.elements.doc.querySelector('.works_display > * > a')
          );
        },

        get worksData ()
          AnkPixiv.elements.doc.querySelector('.work-info'),

        get title ()
          illust.worksData.querySelector('.title'),

        get comment ()
          illust.worksData.querySelector('.caption'),


        get avatar ()
          AnkPixiv.elements.doc.querySelector('.profile-unit > a > img.user-image'),

        get userName ()
          AnkPixiv.elements.doc.querySelector('.profile-unit > a > .user'),

        get memberLink ()
          AnkPixiv.elements.doc.querySelector('a.avatar_m'),

        get tags ()
          AnkPixiv.elements.doc.querySelector('.tags'),

        get downloadedDisplayParent ()
          illust.worksData.querySelector('.meta'),

        get ads () {
          let obj = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('object'));
          let iframe = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('iframe'));
          let search = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.ui-search'));
          // 検索欄も広告扱いしちゃうぞ
          let findbox = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('form.search2'));
          // ldrize
          let ldrize = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#gm_ldrize'));
          // ヘッダ
          let header1 = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#global-header'));
          let header2 = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('.header'));
          let header3 = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('._header'));

          let toolbarItems = AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('#toolbar-items'));

          return ([]).concat(obj, iframe, search, findbox, ldrize, header1, header2, header3, toolbarItems);
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
          let (e = AnkPixiv.elements.illust.largeLink)
            e && e.href.match(/illust_id=(\d+)/) && parseInt(RegExp.$1, 10),

        get dateTime ()
          AnkPixiv.info.illust.worksData.dateTime,

        get size ()
          AnkPixiv.info.illust.worksData.size,

        get tags () {
          let elem = AnkPixiv.elements.illust.tags;
          if (!elem)
            return [];
          return AnkUtils.A(elem.querySelectorAll('.tag > .text'))
                  .map(function (e) AnkUtils.trim(e.textContent))
                  .filter(function (s) s && s.length);
        },

        get shortTags () {
          let limit = AnkPixiv.Prefs.get('shortTagsMaxLength', 8);
          return AnkPixiv.info.illust.tags.filter(function (it) (it.length <= limit));
        },

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
          let (e = AnkPixiv.elements.illust.comment)
            (e ? AnkUtils.textContent(e) : ''),

        get R18 ()
          AnkPixiv.info.illust.tags.some(function (v) 'R-18' == v),

        get mangaPages ()
          AnkPixiv.info.illust.worksData.mangaPages,

        get worksData () {
          let zp = AnkUtils.zeroPad;
          let items = AnkUtils.A(AnkPixiv.elements.illust.worksData.querySelectorAll('.meta > li'));
          let result = {};
          items.forEach(function (item) {
            item = item.textContent.replace(/\[ \u30DE\u30A4\u30D4\u30AF\u9650\u5B9A \]/, '').trim();
            let m;
            if (m = item.match(/(\d+)\/(\d+)\/(\d{4})[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[3], 4),
                month: zp(m[1], 2),
                day: zp(m[2], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
              };
            } else if (m = item.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[1], 4),
                month: zp(m[2], 2),
                day: zp(m[3], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
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
        get id ()
          AnkUtils.A(AnkPixiv.elements.doc.querySelectorAll('script'))
            .map(function(it) it.textContent.match(/pixiv.context.userId = '(\d+)';/))
            .filter(function(it) it)[0][1],

        get pixivId ()
          (AnkPixiv.elements.illust.avatar.src.match(/\/profile\/([^\/]+)\//)
           ||
           AnkPixiv.info.path.largeImage.match(/^https?:\/\/[^\.]+\.pixiv\.net\/(?:img\d+\/)?img\/([^\/]+)\//))[1],

        get name ()
          AnkUtils.trim(AnkPixiv.elements.illust.userName.textContent),

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
          (AnkPixiv.info.path.largeStandardImage.match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          AnkPixiv.currentLocation.replace(/(\?|&)mode=medium(&|$)/, "$1mode=manga$2"),

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

        get mediumImage () {
          // XXX 再投稿された、イラストのパスの末尾には、"?28737478..." のように数値がつく模様
          // 数値を除去してしまうと、再投稿前の画像が保存されてしまう。
          let result = AnkPixiv.elements.illust.mediumImage.src;//.replace(/\?.*$/, '');
          // for pixiv_expand_thumbnail
          //  http://userscripts.org/scripts/show/82175
          result = result.replace(/_big_p0/, '');
          return result;
        }
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
          if ( value && ! AnkPixiv.in.manga && name == 'path.mangaIndexPage')
            value = value.replace(/mode=manga/,'mode=medium');
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

      let ret = filePicker.show();
      let ok = (ret == nsIFilePicker.returnOK) || (ret == nsIFilePicker.returnReplace);
      return ok && filePicker && filePicker.file;
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
     * ファイルをダウンロードする
     */
    downloadTo: function (url, referer, file, onComplete, onError) { // {{{
      // 何もしなーい
      if (!onError)
        onError = function () void 0;

      AnkUtils.dump('downloadTo: ' + url);

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
              return onError(void 0);
            }

            if (responseStatus != 200)
              return onError(responseStatus);

            if (onComplete)
              return onComplete(file.path);
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
      wbpersist.saveURI(sourceURI, cache, refererURI, null, null, file, null);
    }, // }}}


    /*
     * downloadToRetryable
     *    url:            URL
     *    maxTimes:       リトライ最大回数
     *    referer:        リファラ
     *    file:           nsIFile
     *    onComplete      終了時に呼ばれる関数
     *    onError         エラー時に呼ばれる関数
     * ファイルをダウンロードする
     */
    downloadToRetryable: function (url, maxTimes, referer, file, onComplete, onError) { // {{{
      function call () {
        AnkPixiv.downloadTo(
          url,
          referer,
          file,
          onComplete,
          function (statusCode) {
            if (statusCode == 404)
              return onError(statusCode);
            ++times;
            if (times < maxTimes)
              return setTimeout(call, times * 10 * 1000);
            return onError(statusCode);
          }
        );
      }

      let times = 0;
      call();
    }, // }}}

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
     * downloadFiles
     *    urls:           URL
     *    referer:        リファラ
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    onComplete      終了時のアラート
     * 複数のファイルをダウンロードする
     */
    downloadFiles: function (urls, referer, localdir, fp, onComplete, onError) { // {{{
      const MAX_FILE = 1000;

      let index = 0;
      let lastFile = null;

      // XXX ディレクトリは勝手にできるっぽい
      //localdir.exists() || localdir.create(localdir.DIRECTORY_TYPE, 0755);

      function _onComplete () {
        arguments[0] = localdir.path;
        return onComplete.apply(null, arguments);
      }

      function _onError (statusCode) {
        // エラーファイルが保存されていたら削除する
        if (lastFile && lastFile.exists()) {
          try {
            lastFile.remove(false);
            AnkUtils.dump('Delete invalid file. => ' + lastFile.path);
          } catch (e) {
            AnkUtils.dump('Failed to delete invalid file. => ' + e);
          }
        }
        return onError.apply(null, arguments);
      }

      function downloadNext (localpath) {

        // 前ファイルの処理
        if (lastFile) {
          // ダウンロードに失敗していたら、そこで終了さ！
          if (!lastFile.exists) {
            AnkUtils.dump('Strange error! file not found!');
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
        let fileExt =
          let (m = url.match(/(\.\w+)(?:$|\?)/))
            ((m && m[1]) || '.jpg');
        file.append(((fp!=null)?(AnkUtils.zeroPad(fp[index], 2) + '_'):'') + AnkUtils.zeroPad(index + 1, 2) + fileExt);

        lastFile = file;
        index++;

        AnkUtils.dump('DL => ' + file.path);
        return AnkPixiv.downloadToRetryable(url, 3, referer, file, downloadNext, _onError);
      }

      downloadNext();
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

        AnkPixiv.setCookies();

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
            let tokens = [
              'title         = ?title?',
              'member-id     = ?member-id?',
              'member-name   = ?member-name?',
              'memoized-name = ?memoized-name?',
              'tags          = ?tags?',
              'short-tags    = ?short-tags?',
              'tools         = ?tools?',
              'pixiv-id      = ?pixiv-id?',
              'illust-id     = ?illust-id?',
              'illust-year   = ?illust-year?',
              'illust-year2  = ?illust-year2?',
              'illust-month  = ?illust-month?',
              'illust-day    = ?illust-day?',
              'illust-hour   = ?illust-hour?',
              'illust-minute = ?illust-minute?',
              'saved-year    = ?saved-year?',
              'saved-year2   = ?saved-year2?',
              'saved-month   = ?saved-month?',
              'saved-day     = ?saved-day?',
              'saved-hour    = ?saved-hour?',
              'saved-minute  = ?saved-minute?'
            ].join("\n");
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

        let onComplete = function (local_path) {
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

        let onError = function (responseStatus) {
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
          AnkPixiv.getLastMangaPage(function (v, fp, ext) {
            function _download (originalSize) {
              if (v) {
                let urls = [];
                for (let i = 0; i < v; i++)
                  urls.push(AnkPixiv.info.path.getLargeMangaImage(i, url, ext, originalSize));
                AnkPixiv.downloadFiles(urls, ref, destFiles.image, fp, onComplete, onError);
                addDownloading();
              }
            }

            if (AnkPixiv.Prefs.get('downloadOriginalSize', false)) {
              AnkUtils.remoteFileExistsRetryable(
                AnkPixiv.info.path.getLargeMangaImage(0, url, ext, true),
                6,
                _download
              );
            } else {
              _download(false);
            }
          });
        } else {
          AnkPixiv.downloadToRetryable(url, 3, ref, destFiles.image, onComplete, onError);
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
        if (installTryed > 100)
          return;
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      function noMoreEvent (func) { // {{{
        return function (e) {
          e.preventDefault();
          e.stopPropagation();
          return func.apply(this, arguments);
        };
      } // }}}

      // closure {{{
      let ut = AnkUtils;
      let installInterval = 500;
      let installTryed = 0;
      let con = content;
      let doc = AnkPixiv.elements.doc;
      let win = window.content.window;
      let lastMangaPage = undefined;
      let currentMangaPage = 0;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var wrapper = doc.getElementById('wrapper');
            var medImg = AnkPixiv.elements.illust.mediumImage;
            var bigImgPath = AnkPixiv.info.path.largeImage;
            var worksData = AnkPixiv.elements.illust.worksData;
            var bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
            var fitMode = AnkPixiv.Prefs.get('largeImageSize', AnkPixiv.FIT.NONE);
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれて以内っぽいときは、遅延する
          if (!(body && medImg && bigImgPath && wrapper && worksData)) // {{{
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
            let resizeButton = createElement('button', 'resize-button');
            let closeButton = createElement('button', 'close-button');
            let pageSelector = createElement('select', 'page-selector');

            let updateButtons = function (v) (pageSelector.value = currentMangaPage);

            viewer.setAttribute('style', 'top: 0px; left: 0px; width:100%; height: 100%; text-align: center; display: none; -moz-opacity: 1; padding: 0px; bottom: 0px');
            prevButton.innerHTML = '<<';
            nextButton.innerHTML = '>>';
            resizeButton.innerHTML = 'RESIZE';
            closeButton.innerHTML = '\xD7';
            buttonPanel.setAttribute('style', 'position: fixed !important; bottom: 0px; width: 100%; opacity: 0; z-index: 666');
            bigImg.setAttribute('style', 'margin: 0px; background: #FFFFFF');
            imgPanel.setAttribute('style', 'margin: 0px');

            [prevButton, nextButton, resizeButton, closeButton].forEach(function (button) {
              button.setAttribute('class', 'submit_btn');
              button.setAttribute('style', 'width: 100px !important');
            });

            if (MutationObserver) {
              // 画像ロード中は半透明にする
              new MutationObserver(function (o) {
                o.forEach(function (e) {
                  e.target.style.setProperty('opacity', '0.5', 'important');
                });
              }).observe(bigImg, {attributes: true, attributeFilter: ['src']});

              // 画像ロード完了後に半透明を解除
              bigImg.addEventListener('load', function (e) {
                e.target.style.setProperty('opacity', '1', 'important');
              }, false);
            }

            /*
             * viewer
             *    - imgPanel
             *      - bigImg
             *    - buttonPanel
             *      - prevButton
             *      - pageSelector
             *      - nextButton
             *      - resizeButton
             *      - closeButton
             */
            viewer.appendChild(imgPanel);
            imgPanel.appendChild(bigImg);
            if (AnkPixiv.in.manga) {
              viewer.appendChild(buttonPanel);
              buttonPanel.appendChild(pageSelector);
              buttonPanel.appendChild(prevButton);
              buttonPanel.appendChild(nextButton);
              buttonPanel.appendChild(resizeButton);
              buttonPanel.appendChild(closeButton);
            }
            else {
              viewer.appendChild(buttonPanel);
              buttonPanel.appendChild(resizeButton);
              buttonPanel.appendChild(closeButton);
            }
            body.insertBefore(viewer, body.firstChild);

            let bigMode = false;

            let fadeOutTimer
            let showButtons = function () {
              if (fadeOutTimer)
                clearInterval(fadeOutTimer);
              buttonPanel.style.opacity = 1;
            };
            let hideButtons = function () {
              function clearFadeOutTimer () {
                clearInterval(fadeOutTimer);
                fadeOutTimer = void 0;
                buttonOpacity = 0;
              }

              let buttonOpacity = 100;
              fadeOutTimer = setInterval(function () {
                try {
                  if (buttonOpacity <= 0)
                    return clearFadeOutTimer();
                  buttonOpacity -= 10;
                  buttonPanel.style.opacity = buttonOpacity / 100.0;
                } catch (e if e instanceof TypeError) {
                  // XXX for "can't access dead object"
                  clearFadeOutTimer();
                }
              }, 100);
            };

            let loadBigImage = function (bigImgPath) {
              bigImg.style.display = 'none';
              bigImg.setAttribute('src', bigImgPath);
            };

            let autoResize = function () {
              function resize (w, h) {
                bigImg.style.width = w + 'px';
                bigImg.style.height = h + 'px';
                if (ch > h) {
                  bigImg.style.marginTop = parseInt(ch / 2 - h / 2) + 'px';
                } else {
                  bigImg.style.marginTop = '0px';
                }
              }

              let cw = doc.documentElement.clientWidth, ch = doc.documentElement.clientHeight;
              let iw = bigImg.naturalWidth, ih = bigImg.naturalHeight;
              let pw = cw / iw, ph = ch / ih;
              if (AnkPixiv.Prefs.get('dontResizeIfSmall')) {
                pw = pw>1 ? 1 : pw;
                ph = ph>1 ? 1 : ph;
              }
              let pp = Math.min(pw, ph);

              switch (fitMode) {
              case AnkPixiv.FIT.IN_WINDOW_SIZE:
                resize(parseInt(iw * pp), parseInt(ih * pp));
                resizeButton.innerHTML = 'FIT in Window';
                break;
              case AnkPixiv.FIT.IN_WINDOW_WIDTH:
                resize(parseInt(iw * pw), parseInt(ih * pw));
                resizeButton.innerHTML = 'FIT in Width';
                break;
              case AnkPixiv.FIT.IN_WINDOW_HEIGHT:
                resize(parseInt(iw * ph), parseInt(ih * ph));
                resizeButton.innerHTML = 'FIT in Height';
                break;
              default:
                resize(iw, ih);
                resizeButton.innerHTML = 'No FIT';
                break;
              }

              bigImg.style.display = '';
              window.content.scrollTo(0, 0);
            };

            bigImg.addEventListener('load', autoResize, true);

            let qresize = null;
            let delayResize = function () {
              if (!bigMode)
                return;
              if (qresize)
                clearTimeout(qresize);
              qresize = setTimeout(function(e) {
                qresize = null;
                autoResize();
              },200)
            };

            win.addEventListener('resize', delayResize, false);

            let changeImageSize = function () {
              let ads = AnkPixiv.elements.illust.ads;
              let wrapperTopMargin;

              if (bigMode) {
                doc.querySelector('html').style.overflowX = '';
                doc.querySelector('html').style.overflowY = '';

                body.style.backgroundImage = bgImage;
                viewer.style.display = 'none';
                bigImg.setAttribute('src', '');
                wrapper.setAttribute('style', 'opacity: 1;');
                if (wrapperTopMargin)
                  wrapper.style.marginTop = wrapperTopMargin;
                ads.forEach(function (ad) (ad.style.display = ad.__ank_pixiv__style_display));
              } else {
                hideButtons();
                currentMangaPage = 0;
                if (AnkPixiv.in.manga && typeof lastMangaPage == 'undefined') {
                  AnkPixiv.getLastMangaPage(function (v) {
                    if (v) {
                      lastMangaPage = v;
                      for (let i = 0; i < v; i++) {
                        let option = doc.createElement('option');
                        option.textContent = (i + 1) + '/' + v;
                        option.value = i;
                        pageSelector.appendChild(option);
                      }
                    }
                    else {
                      changeImageSize();
                    }
                  });
                }
                body.style.backgroundImage = 'none';
                loadBigImage(bigImgPath);
                viewer.style.display = '';
                wrapper.setAttribute('style', 'opacity: 0.1;');
                wrapperTopMargin = wrapper.style.marginTop;
                wrapper.style.marginTop = '0px';
                bigImg.style.setProperty('opacity', '1', 'important');
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
              if (bigMode) {
                let page = currentMangaPage + (d || 1);
                goPage(
                  lastMangaPage === undefined ? page :
                  !doLoop                     ? page :
                  page >= lastMangaPage       ? 0 :
                  page < 0                    ? lastMangaPage :
                  page
                );
              } else {
                changeImageSize();
              }
            };

            doc.changeImageSize = changeImageSize;
            doc.goNextMangaPage = goNextPage;

            buttonPanel.addEventListener('mouseover', showButtons, false);
            buttonPanel.addEventListener('mouseout', hideButtons, false);
            prevButton.addEventListener('click', noMoreEvent(function () goNextPage(-1, true)), false);
            nextButton.addEventListener('click', noMoreEvent(function () goNextPage(1, true)), false);
            resizeButton.addEventListener(
              'click',
              noMoreEvent(function() {
                function rotateFitMode (fit) {
                  switch (fit) {
                  case AnkPixiv.FIT.IN_WINDOW_SIZE:
                    return AnkPixiv.FIT.IN_WINDOW_HEIGHT;
                  case AnkPixiv.FIT.IN_WINDOW_HEIGHT:
                    return AnkPixiv.FIT.IN_WINDOW_WIDTH;
                  case AnkPixiv.FIT.IN_WINDOW_WIDTH:
                    return AnkPixiv.FIT.IN_WINDOW_NONE;
                  default:
                    return AnkPixiv.FIT.IN_WINDOW_SIZE;
                  }
                }

                fitMode = rotateFitMode(fitMode);
                autoResize();
              }),
              false
            );
            closeButton.addEventListener('click', noMoreEvent(changeImageSize), false);
            bigImg.addEventListener(
              'click',
              noMoreEvent(function (e) {
                if (AnkPixiv.in.manga && (currentMangaPage < lastMangaPage || lastMangaPage === undefined))
                  goNextPage(1, false)
                else
                  changeImageSize();
              }),
              false
            );
            medImg.addEventListener('click', noMoreEvent(changeImageSize), false);
            pageSelector.addEventListener(
              'change',
              noMoreEvent(function () goPage(parseInt(pageSelector.value, 10))),
              true
            );
            pageSelector.addEventListener('click', noMoreEvent(function () void 0), false);
            doc.addEventListener(
              'click',
              function (e) {
                if (e.button === 0 && bigMode)
                  noMoreEvent(changeImageSize)(e);
              },
              false
            );
          } // }}}

          // レイティングによるダウンロード
          (function () { // {{{
            if (!AnkPixiv.Prefs.get('downloadWhenRate', false))
              return;
            let point = AnkPixiv.Prefs.get('downloadRate', 10);
            AnkUtils.A(doc.querySelectorAll('.rating')).forEach(function (e) {
              e.addEventListener(
                'click',
                function () {
                  let klass = e.getAttribute('class', '');
                  let m = klass.match(/rate-(\d+)/);
                  if (m && (point <= parseInt(m[1], 10)))
                    AnkPixiv.downloadCurrentImageAuto();
                },
                true
              );
            });
          })(); // }}}

          // 保存済み表示
          if (AnkPixiv.isDownloaded(AnkPixiv.info.illust.id)) { // {{{
            AnkPixiv.insertDownloadedDisplay(
                AnkPixiv.elements.illust.downloadedDisplayParent,
                AnkPixiv.info.illust.R18
            );
          } // }}}

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
      }; // }}}

      return installer();
    }, // }}}

    /*
     * マンガの最終ページを取得する。
     * この関数は、非同期に呼び出してはいけない。
     * (pagesFromIllustPage のため)
     *
     *    result:     コールバック関数 function (ページ数, 見開きか否か)
     */
    getLastMangaPage: function (result) { // {{{
      const PAGE_LIMIT = 50 - 5;

      let pagesFromIllustPage = AnkPixiv.info.illust.mangaPages;

      function get (source) {
        const MAX = 1000;
        let doc = AnkUtils.createHTMLDocument(source);
        if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
          window.alert(AnkPixiv.Locale('serverError'));
          return [0, null];
        }
        let scripts = AnkUtils.A(doc.querySelectorAll('script'));
        let sm = scripts.filter(function (e) ~e.textContent.indexOf('pixiv.context.pages['));
        let fp = new Array(sm.length);
        sm.forEach(function (v, i, a) {
          if (v.textContent.match(/pixiv\.context\.pages\[(\d+)\]/)) {
            fp[i] = 1 + parseInt(RegExp.$1);
          }
        });
        if (fp[fp.length - 1] < fp.length) {
          // 見開きがある場合
          AnkUtils.dump("*** MOD *** Facing Page Check: " + fp.length + " pics in " + fp[fp.length - 1] + " pages");
        }
        else {
          // 見開きがない場合
          fp = null;
        }
        return [Math.min(MAX,sm.length), fp];
      }

      let xhr = new XMLHttpRequest();
      xhr.open('GET', AnkPixiv.info.path.mangaIndexPage, true);
      try {
        xhr.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = true;
      }
      catch (ex) {
        /* unsupported by this version of FF */
      }
      xhr.onreadystatechange = function (e) {
        if (xhr.readyState == 4 && xhr.status == 200) {
          let arr = get(xhr.responseText);
          result(arr[0], arr[1]);
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

      let doc;

      try {
        // XXX for "can't access dead object".
        doc = appendTo && appendTo.ownerDocument;
      } catch (e) {
        return;
      }

      if (!doc || doc.getElementById(ElementID))
        return;

      let div = doc.createElement('div');
      let textNode = doc.createElement(R18 ? 'blink' : 'textnode');
      textNode.textContent = AnkPixiv.Locale(R18 ? 'used' : 'downloaded');
      div.setAttribute('style', AnkPixiv.Prefs.get('downloadedDisplayStyle', ''));
      div.setAttribute('id', ElementID);
      div.setAttribute('class', R18 ? 'R18' : '');
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
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const BoxTag = /^(li|div|article)$/i;

      function findBox (e, limit) {
        if (limit <= 0)
          return null;
        if (BoxTag.test(e.tagName))
          return e;
        return findBox(e.parentNode, limit - 1);
      }

      function trackbackParentNode (node, n) {
        for (let i = 0; i< n; i++)
          node = node.parentNode;
        return node;
      }

      if (AnkPixiv.in.medium || !AnkPixiv.in.pixiv)
        return;

      if (!AnkPixiv.Prefs.get('markDownloaded', false) && !ignorePref)
        return;

      if (!force && AnkPixiv.Store.document.marked)
        return;

      AnkPixiv.Store.document.marked = true;

      if (!node)
        node = AnkPixiv.elements.doc;

      [
        ['a > img', 1],
        ['a > p > img', 2],
        ['a > div > img', 2],
        ['a > p > div > img', 3]
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(node.querySelectorAll(selector)) .
          map(function (img) trackbackParentNode(img, nTrackback)) .
          map(function (link) link.href && let (m = IsIllust.exec(link.href)) m && [link, m]) .
          filter(function (m) m) .
          map(function ([link, m]) [link, parseInt(m[1], 10)]) .
          forEach(function ([link, id]) {
            if (!AnkPixiv.isDownloaded(id))
              return;
            let box = findBox(link, 3);
            if (box)
              box.className += ' ' + AnkPixiv.CLASS_NAME.DOWNLOADED;
          });
      });
    }, // }}}

    /*
     * remoteFileExists 用のクッキーをセットする
     */
    setCookies: function () { // {{{
      const cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
      cookieManager.add(
        '.pixiv.net',
        '/',
        'pixiv_embed',
        'pix',
        false,
        false,
        false,
        new Date().getTime() + (1000 * 60 * 60 * 24 * 365)
      );
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

      function append ({parent, name, text, style, klass}) {
        let elem = doc.createElement(name);
        if (text)
          elem.textContent = text;
        if (style)
          elem.setAttribute('style', style);
        if (klass)
          elem.setAttribute('class', klass);
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
      let es = document.querySelectorAll('#ankpixiv-toolbar-button-text');
      for (let [, e] in AnkUtils.IA(es)) {
        e.value = text;
        e.collapsed = text.length == 0;
      }
      return text;
    }, // }}}

    updateStatusBarText: function () { // {{{
      let text = [k for (k in AnkPixiv.downloadings)].length;
      AnkPixiv.statusbarText = text ? text : '';
    }, // }}}


    /********************************************************************************
    * スタイル
    ********************************************************************************/

    registerSheet: let (registered) function (style) { // {{{
      const IOS = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Ci.nsIIOService);
      const StyleSheetService = Cc['@mozilla.org/content/style-sheet-service;1'].getService(Ci.nsIStyleSheetService);
      const DefaultStyle = [
        '.ank-pixiv-tool-downloaded {',
        '  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAABGdBTUEAALGPC/xhBQAAABVJREFUGFdj/M+ABIAcOEKwQEqQZQAoTgz1O3uPKAAAAABJRU5ErkJggg==) !important;',
        '  background-repeat: repeat-x !important;',
        '  background-position: bottom !important;',
        '  background-color: pink !important;',
        '}',
        '#ankpixiv-downloaded-display.R18 {',
        '  animation-duration: 10s;',
        '  animation-name: slidein;',
        '  animation-iteration-count: infinite !important;',
        '  animation-direction: alternate;',
        '}',
        '@keyframes slidein {',
        '  from {',
        '    transform: rotateY(0deg);',
        '  }',
        '  to {',
        '    transform: rotateY(360deg);',
        '  }',
        '}'
      ].join("\n");

      let CSS = [
        '@namespace url(http://www.w3.org/1999/xhtml);',
        '@-moz-document domain("www.pixiv.net") {',
        style || DefaultStyle,
        '}'
      ].join("\n");

      let uri = IOS.newURI('data:text/css,' + window.encodeURIComponent(CSS), null, null);

      if (registered)
        StyleSheetService.unregisterSheet(registered, StyleSheetService.USER_SHEET);

      registered = uri;
      StyleSheetService.loadAndRegisterSheet(uri, StyleSheetService.USER_SHEET);
    }, // }}}


    /********************************************************************************
    * イベント
    ********************************************************************************/

    openPrefWindow: function () { // {{{
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                        "centerscreen,chrome,modal", arguments);
    }, // }}}

    onInit: function () { // {{{
      function initStorage () { // {{{
        AnkPixiv.Storage = new AnkStorage(
          AnkPixiv.Prefs.get('storageFilepath', 'ankpixiv.sqlite'),
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
          },
          {
            index: {
              histories: ['illust_id'],
              members: ['id']
            }
          }
        );
      } // }}}

      window.addEventListener('focus', AnkPixiv.onFocus, true);
      let appcontent = document.getElementById('appcontent');
      initStorage();
      AnkPixiv.registerSheet();
      appcontent.addEventListener('DOMContentLoaded', AnkPixiv.onDOMContentLoaded, false);
    }, // }}}

    onDOMContentLoaded: function (event) { // {{{
      function body (docRef) {
        let doc = docRef.get();

        if (!doc)
          return;

        if (doc.readyState == 'complete') {
          AnkPixiv.installFunctions();
          AnkPixiv.markDownloaded(doc, true);
        } else {
          setTimeout(function () body(docRef), 250);
        }
      }

      let doc = event.target;
      if (doc && doc.domain == 'www.pixiv.net')
        body(Cu.getWeakReference(event.target));
    }, // }}}

    onFocus: function (ev) { // {{{
      try {
        let changeEnabled = function (id) {
          let elem = document.getElementById(id);
          if (!elem)
            return;
          elem.setAttribute('dark', !AnkPixiv.in.illustPage);
        };

        changeEnabled.call(AnkPixiv, 'ankpixiv-toolbar-button-image');
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
      let rating = window.content.window.wrappedJSObject.pixiv.rating;
      if (typeof rating.rate === 'number') {
        rating.rate = pt;
        rating.apply.call(rating, {});
        if (!AnkPixiv.Prefs.get('downloadWhenRate', false))
          return true;
        let point = AnkPixiv.Prefs.get('downloadRate', 10);
        if (point <= pt)
          AnkPixiv.downloadCurrentImageAuto();
      } else {
        return false;
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
