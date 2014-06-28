
try {

  AnkBase = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_VERSION: 6,

    PREF_PREFIX: 'extensions.ankpixiv.',

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

    DOWNLOAD_DISPLAY: {
      DOWNLOADED:   'downloaded',
      USED:         'used',
      DOWNLOADING:  'downloading',
      FAILED:       'downloadFailed',
      TIMEOUT:      'downloadTimeout',
    },

    CLASS_NAME: {
      DOWNLOADED: 'ank-pixiv-tool-downloaded',
      DOWNLOADED_OVERLAY: 'ank-pixiv-tool-downloaded-overlay',
      DOWNLOADING: 'ank-pixiv-tool-downloading',
      DOWNLOADING_OVERLAY: 'ank-pixiv-tool-downloading-overlay',
    },

    Prefs: new AnkPref('extensions.ankpixiv'),

    AllPrefs: new AnkPref(),

    Store: (function () { // {{{
      let _get = function (doc)
        (doc.__ank_pixiv_store || (doc.__ank_pixiv_store = {}));

      let _getAll = function ()
        AnkUtils.A(window.gBrowser.mTabs).map(function (it) _get(it.linkedBrowser.contentDocument));

      return {
        get: _get,
        getAll: _getAll,
      };
    })(), // }}}

    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),

    RETRY: {
      INTERVAL: 10*1000,
      MAXTIMES: 3,
    },

    DOWNLOAD: {
      MAXRUNS: 1,
      CLEANUP_INTERVAL: 30*1000,
    },

    NULL_RET: { images: [], facing: null, },


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get SupportedModule () { // {{{
      let curmod;
      AnkBase.siteModules.some(function (v) (curmod = (v.in.site ? v.dup() : null)));
      if (curmod)
        AnkUtils.dump('SUPPORTED: '+curmod.info.illust.pageUrl+",\n"+Error().stack);
      else
        AnkUtils.dump('unsupported: '+window.content.document.location.href+",\n"+Error().stack);
      return curmod;
    }, // }}}

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
        function (r, name) (r[name] = clone(AnkBase[name]), r),
        {}
      );
    }, // }}}

    infoText: function (context) { // {{{
      let ignore =
        let (pref = AnkBase.Prefs.get('infoText.ignore', 'illust.dateTime.'))
          (pref ? pref.split(/[,\s]+/) : []);

      ignore = [];
      function indent (s)
        (typeof s === 'undefined' ? '---' : s).toString().split(/\n/).map(function (v) "\t" + v).join("\n")

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

      return textize([], context.info);
    }, // }}}

    memoizedName: function (member_id, service_id) {
      let result = AnkBase.Storage.select(
        'members',
        'id = ?1 and service_id = ?2',
        function (stmt){
          let result = [];
          stmt.bindUTF8StringParameter(0, member_id);
          stmt.bindUTF8StringParameter(1, service_id);
          while (stmt.executeStep())
            result.push(AnkStorage.statementToObject(stmt));
          return result;
        }
      );
      return result && result.length && result[0].name;
    },

    /********************************************************************************
    * モジュール関連
    ********************************************************************************/

    siteModules: [],

    addModule: function (module) {
      let (m = AnkBase.siteModules.filter(function (v) (module.SERVICE_ID === v.SERVICE_ID))) {
        if (m.length > 0) {
          AnkUtils.dump('error ! duplicated service id: '+m[0].SITE_NAME+' <=> '+module.SITE_NAME+', '+module.SERVICE_ID);
        } else {
          if (!AnkBase.Prefs.get('useExperimentalModules', false) && module.EXPERIMENTAL) {
            AnkUtils.dump('skip experimental module: '+module.SITE_NAME+', '+module.SERVICE_ID);
          } else {
            AnkUtils.dump('installed module: '+module.SITE_NAME+', '+module.SERVICE_ID);
            AnkBase.siteModules.push(module);
          }
        }
      }
    },


    /********************************************************************************
    * 状態
    ********************************************************************************/

    downloading: {
      pages:  [],     // ダウンロード情報のリスト（__download）
      images: 0,      // キューに載ったダウンロード対象の画像の合計枚数
    }, 

    /********************************************************************************
    * ダイアログ関連
    ********************************************************************************/

    /*
     * showFilePicker
     *    defaultFilename: 初期ファイル名
     *    return:          選択されたファイルのパス(nsILocalFile)
     * ファイル保存ダイアログを開く
     */
    showFilePicker: function (prefInitDir, defaultFilename) { // {{{
      const nsIFilePicker = Components.interfaces.nsIFilePicker;
      let filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

      filePicker.appendFilters(nsIFilePicker.filterAll);
      filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);
      filePicker.defaultString = defaultFilename;

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
    showFilePickerWithMeta: function (prefInitDir, basename, ext, isFile) { // {{{
      let image = AnkBase.showFilePicker(prefInitDir, basename + ext);
      if (!image)
        return;

      if (isFile) {
        return  {
          image: image,
          meta: AnkBase.newLocalFile(image.path.replace(/\.\w+$/,'.txt'))
        };
      }

      return {
        image: AnkBase.newLocalFile(image.path.replace(/\.\w+$/,'')),
        meta: AnkBase.newLocalFile(
                image.leafName.match(/^#page-number#\.\w+$/) ?
                  image.path.replace(/#page-number#\.\w+$/,'meta.txt') :
                  image.path.replace(/\s*#page-number#/,'').replace(/\.\w+$/,'.txt')
              )
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
      let dir = AnkBase.showDirectoryPicker(AnkBase.Prefs.get('initialDirectory'));
      if (dir) {
        AnkBase.Prefs.set('initialDirectory', dir.filePath, 'string');
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
      AnkBase.Storage.exists('histories',
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
      return IOService.newFileURI(AnkBase.newLocalFile(path));
    }, // }}}

    /*
     * invalidPageNumberToken
     *    filenames:          ファイル名テンプレートのリスト
     *    return:             不正なファイル名のテンプレート
     * ファイル名テンプレートに、パスの最後以外に #page-number# の指定のあるものが存在していたら、そのテンプレートの値を返す
     */
    invalidPageNumberToken: function(filenames) {
      let invalid = null;
      filenames.some(function (f)
        let (a = f.split(/[/\\]/))
          a.some(function (v,i) (i < a.length-1) && v.match(/#page-number#/)) && (invalid = f)
      );
      return invalid;
    },

    /*
     * fixPageNumberToken
     *    filenames:          ファイル名のテンプレートのリスト
     * 保存する対象にあわせてファイル名テンプレートを整形する
     */
    fixPageNumberToken: function (filenames, isFile) {
      return filenames.map(
        function (filename) {
          if (isFile) {
            let expr = /[/\\]\s*#page-number#\s*$/;
            if (filename.match(expr))
              filename = filename.replace(expr, '');                    // フォルダごとカット
            else
              filename = filename.replace(/\s*#page-number#\s*/, '');   // ページ番号だけカット
          }
          else if (!filename.match(/#page-number#/)) {
            filename += "/#page-number#";                               // ページ番号指定がない場合（前verまでの設定とか）
          }
          return filename;
        }
      );
    },

    /*
     * getSaveMangaPath
     *    path:               ファイル名のテンプレート
     *    ext:                拡張子
     *    imgno:              ファイル通番
     *    pageno:             ページ番号
     *    return:             {path: パス（ファイル名は含まない）, name: ファイル名}
     * マンガ形式の保存のためにパス指定中の　#page-number#　をページ番号に置換して返す
     */
    getSaveMangaPath: function (path, ext, imgno, pageno) {
      let ps = path.split(/[/\\]/);
      let name = ps.pop();
      if (imgno) {
        // images
        let imgNumber = AnkUtils.zeroPad(imgno, 2);
        let pageNumber = pageno ? (AnkUtils.zeroPad(pageno, 2) + '_') : '';
        name = name.replace(/#page-number#/,pageNumber+imgNumber);
      }
      else {
        // meta text
        name = name.replace(/\s*#page-number#/,'');
        if (name === '')
          name = 'meta';
      }
      return { path: ps.join(AnkUtils.SYS_SLASH), name: name+ext};
    },

    /*
     * getSaveFilePath
     *    prefInitDir:        出力先ベースディレクトリ
     *    filenames:          ファイル名の候補のリスト(一個以上必須)
     *    ext:                拡張子
     *    useDialog:          保存ダイアログを使うか？
     *    isFile:             ディレクトリの時は false
     *    return:             {image: nsILocalFile, meta: nsILocalFile}
     * ファイルを保存すべきパスを返す
     * 設定によっては、ダイアログを表示する
     */
    getSaveFilePath: function (prefInitDir, filenames, ext, useDialog, isFile, lastImgno, lastPageno) { // {{{
      function _file (initDir, basename, ext, isMeta) {
        // TODO File#join
        let filename = isFile ? basename + ext :
                                let (p = isMeta ? AnkBase.getSaveMangaPath(basename, ext) :
                                                  AnkBase.getSaveMangaPath(basename, ext, lastImgno, lastPageno))
                                  p.path + AnkUtils.SYS_SLASH + p.name;
        let filepath = initDir + AnkUtils.SYS_SLASH + filename;
        let url = (isFile || isMeta) ? filepath :
                                       initDir + AnkUtils.SYS_SLASH + basename;
        return {
          filename: filename,
          filepath: filepath,   // マンガ形式の場合、１ページ目の画像のパス
          url: url,             // マンガ形式の場合、初期パス＋ファイル名テンプレート
          file: AnkBase.newLocalFile(url)
        };
      }

      function _exists (file) {
        let f = isFile ? file.file : AnkBase.newLocalFile(file.filepath);
        return (f.exists() || AnkBase.filenameExists(AnkUtils.getRelativePath(f.path, prefInitDir)));
      }

      try {
        let initDir = AnkBase.newLocalFile(prefInitDir);

        if (!initDir.exists())
          return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[0], ext, isFile);

        for (let i in filenames) {
          let image = _file(prefInitDir, filenames[i], ext);
          let meta = _file(prefInitDir, filenames[i], '.txt', true);

          if (_exists(image) || _exists(meta))
            continue;

          if (useDialog) {
            return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[i], ext, isFile);
          } else {
            return {image: image.file, meta: meta.file};
          }
        }
      } catch (e) {
        // FIXME ?
        AnkUtils.dump(e);
      }

      return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[0], ext, isFile);
    }, // }}}

    /*
     * isDownloaded
     *    illust_id:     イラストID
     *    service_id:    サイト識別子
     *    return:        ダウンロード済み？
     */
    isDownloaded: function (illust_id,service_id) { // {{{
      return AnkBase.Storage.exists('histories', 'illust_id = \'' + illust_id + '\' and service_id = \'' + service_id + '\'');
    }, // }}}

    /*
     * isDownloading
     *    illust_id:     イラストID
     *    service_id:    サイト識別子
     *    return:        ダウンロード中？
     */
    isDownloading: function (illust_id, service_id) {
      function find (v) {
        // illust_idは === ではなく == で比較する
        return (v.context.SERVICE_ID === service_id) && (v.context.info.illust.id == illust_id);
      }

      return AnkBase.downloading.pages.some(find);
    },

    /*
     * downloadTo
     *    url:            URL
     *    referer:        リファラ
     *    file:           nsIFile
     *    onComplete      終了時に呼ばれる関数
     *    onError         エラー時に呼ばれる関数
     * ファイルをダウンロードする
     */
    downloadTo: function (url, referer, prefInitDir, file, download, onComplete, onError) { // {{{
      // 何もしなーい
      if (!onError)
        onError = function () void 0;

      AnkUtils.dump('DL => ' + file.path);
      AnkUtils.dump('downloadTo: ' + url + ', ' + referer);

      // ディレクトリ作成
      let (dir = file.parent)
        dir.exists() || dir.create(dir.DIRECTORY_TYPE, 0755);

      // 各種オブジェクトの生成
      let sourceURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
      sourceURI.spec = url;
      let refererURI = AnkUtils.ccci('@mozilla.org/network/standard-url;1', Components.interfaces.nsIURI);
      refererURI.spec = referer;

      let channel = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService).
                      newChannelFromURI(sourceURI).QueryInterface(Ci.nsIHttpChannel);
      let wbpersist = AnkUtils.ccci('@mozilla.org/embedding/browser/nsWebBrowserPersist;1',
                                Components.interfaces.nsIWebBrowserPersist);

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
              responseStatus = _request.responseStatus;
            } catch (e) {
              return onError(void 0);
            }

            // FIXME 分割(206)で返ってきても１回で全部揃ってるならよし、揃ってなければエラー
            if (responseStatus == 206) {
              let m = channel.getResponseHeader('Content-Range').match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
              let content_size = parseInt(m[3],10);
              let downloaded = parseInt(m[2],10) - parseInt(m[1],10) + 1;
              if (downloaded < content_size)
                return onError(responseStatus);
            }
            else if (responseStatus != 200)
              return onError(responseStatus);

            if (onComplete) {
              ++download.downloaded;
              AnkBase.updateStatusBarText();
              return onComplete(prefInitDir, file.path);
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

      channel.referrer = refererURI;
      channel.setRequestHeader("Range", null, false);
      wbpersist.saveChannel(channel, file);
}, // }}}


    /*
     * downloadToRetryable
     *    url:            URL
     *    maxTimes:       リトライ最大回数
     *    referer:        リファラ
     *    prefInitDir:    出力先ベースディレクトリ
     *    file:           nsIFile
     *    onComplete      終了時に呼ばれる関数
     *    onError         エラー時に呼ばれる関数
     * ファイルをダウンロードする
     */
    downloadToRetryable: function (url, maxTimes, referer, prefInitDir, file, download, onComplete, onError) { // {{{
      function call () {
        AnkBase.downloadTo(
          url,
          referer,
          prefInitDir,
          file,
          download,
          onComplete,
          function (statusCode) {
            if (statusCode == 404)
              return onError(statusCode);
            ++times;
            if (times < maxTimes)
              return setTimeout(call, times * AnkBase.RETRY.INTERVAL);
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

      AnkUtils.dump('SAVE => ' + file.path);

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
     *    urls:           URLリスト
     *    referer:        リファラ
     *    prefInitDir:    出力先ベースディレクトリ
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    fp:             見開きページ情報
     *    download:       ダウンロードキューエントリー
     *    onComplete      終了時のアラート
     * 複数のファイルをダウンロードする
     */
    downloadFiles: function (urls, referer, prefInitDir, localdir, fp, download, onComplete, onError) { // {{{
      const MAX_FILE = 1000;

      let index = 0;
      let lastFile = null;

      // XXX ディレクトリは勝手にできるっぽい
      //localdir.exists() || localdir.create(localdir.DIRECTORY_TYPE, 0755);

      function _onComplete () {
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

      function downloadNext () {

        // 前ファイルの処理
        if (lastFile) {
          // ダウンロードに失敗していたら、そこで終了さ！
          if (!lastFile.exists) {
            AnkUtils.dump('Strange error! file not found!');
            return _onComplete.apply(null, arguments);
          }

          // ファイルの拡張子の修正
          if (AnkBase.fixFileExt(lastFile) === null)
            return onError.apply(null, arguments);  // 何が起こるかわからないので_onError()ではなくonError()
        }

        // 最後のファイル
        if (index >= Math.min(urls.length, MAX_FILE))
          return _onComplete.apply(null, arguments);

        let ref = referer.replace(/(mode=manga_big)(&page=)\d+(.*)$/,"$1$3$2"+index);  // Pixivマンガオリジナルサイズの場合は画像ごとにrefererが異なる
        let url = urls[index];
        let file = localdir.clone();
        let fileExt =
          let (m = url.match(/(\.\w+)(?:$|\?)/))
            ((m && m[1]) || '.jpg');

        let (p = AnkBase.getSaveMangaPath(file.path, fileExt, index+1, fp ? fp[index] : undefined)) {
          file.initWithPath(p.path);
          file.append(p.name);
        }

        lastFile = file;
        index++;

        return AnkBase.downloadToRetryable(url, AnkBase.RETRY.MAXTIMES, ref, prefInitDir, file, download, downloadNext, _onError);
      }

      downloadNext();
    }, // }}}

    /*
     * downloadIllust
     *    url:            URL
     *    referer:        リファラ
     *    prefInitDir:    出力先ベースディレクトリ
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    download:       ダウンロードキューエントリー
     *    onComplete      終了時のアラート
     * 一枚絵のファイルをダウンロードする
     */
    downloadIllust: function (url, referer, prefInitDir, localdir, download, onComplete, onError) { // {{{
      function _onComplete () {
        // ファイルの拡張子の修正
        if (AnkBase.fixFileExt(localdir) === null)
          return onError.apply(null, arguments);

        return onComplete.apply(null, arguments);
      }

      return AnkBase.downloadToRetryable(url, AnkBase.RETRY.MAXTIMES, referer, prefInitDir, localdir, download, _onComplete, onError);
    }, // }}}

    /*
     * downloadCurrentImage
     *    useDialog:            保存ダイアログを使うか？
     *    confirmDownloaded:    ダウンロード済みの場合の確認を行うか？
     *    debug:                トークンのテストを行う
     *    return:               成功？
     * 現在表示されている画像を保存する
     */
    downloadCurrentImage: function (module, useDialog, confirmDownloaded, debug) { // {{{
      try {
        // ダウンロード用のコンテキストの収集
        let context = new AnkContext(module);
        if (!context)
          return false;

        // 自分のページは構成が違い、問題となるのでダウンロードしないようにする。
        if (context.in.myIllust)
          return false;

        // 同一ページでも、表示中の状態によってダウンロードの可否が異なる場合がある
        if (!context.downloadable)
          return false;

        // illust_idが見つからない
        if (!context.info.illust.id)
          return false;

        // 画像の情報がない
        if (context.info.path.image.images.length == 0)
          return false;

        if (typeof useDialog === 'undefined')
          useDialog = AnkBase.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = AnkBase.Prefs.get('confirmExistingDownload');

        if (!context.in.illustPage)
          return false;

        // ダウンロード中だったらやめようぜ！
        if (AnkBase.isDownloading(context.info.illust.id, context.SERVICE_ID)) {
          //window.alert(AnkBase.Locale('alreadyDownloading'));
          return false;
        }

        /* ダウンロード済みかの確認 */
        if (AnkBase.isDownloaded(context.info.illust.id, context.SERVICE_ID)) {
          if (confirmDownloaded) {
            if (!window.confirm(AnkBase.Locale('downloadExistingImage')))
              return false;
          } else {
            return false;
          }
        }

        AnkBase.addDownload(context, useDialog, debug);
        return true;

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    },

    findDownload: function (download, remove) {
      let index = AnkBase.downloading.pages.indexOf(download);
      if (index == -1)
        return null;

      if (remove)
        AnkBase.downloading.pages.splice(index, 1);

      return download;
    },

    addDownload: function (context, useDialog, debug) {
      let (ev = document.createEvent('Event')) {
        ev.initEvent('ankDownload', true, false);
        ev.__download = {
          context: context,
          useDialog: useDialog,
          debug: debug,
          downloaded: 0,                  // ダウンロードの完了した画像数
          queuein: new Date().getTime(),  // キューに入れた時刻
          start: undefined,               // ダウンロードを開始した時刻
          limit: undefined,               // キューから追い出される時刻
          result: undefined,              // ダウンロード結果
        };
        window.dispatchEvent(ev);
      }
    },

    removeDownload: function (download, result) {
      let (ev = document.createEvent('Event')) {
        ev.initEvent('ankDownload', true, false);
        ev.__download = download;
        ev.__download.result = result;
        window.dispatchEvent(ev);
      }
    },

    cleanupDownload: function () {
      let (ev = document.createEvent('Event')) {
        ev.initEvent('ankDownload', true, false);
        ev.__download = undefined;
        window.dispatchEvent(ev);
      }
    },

    get livingDownloads ()
      AnkBase.downloading.pages.filter(function (d) (typeof d.result === 'undefined') && d),

    get zombieDownloads ()
      let (curtime = new Date().getTime())
        AnkBase.downloading.pages.filter(function (d) (typeof d.start !== 'undefined' && d.limit < curtime) && d),

    downloadHandler: function (ev) {
      try {
        let (d = ev.__download) {
          if (typeof d === 'undefined') {
            // cleanup timer
            // a. ダウンロードが正常終了したあと時間が経ったらキューを刈り取る
            // b. あまりにダウンロードが遅い場合に、キューから切り離して次に進む
            let m = AnkBase.zombieDownloads;
            AnkUtils.dump('rise cleanup: queued='+AnkBase.downloading.pages.length+' zombie='+m.length);
            m.forEach(function (z) {
              let index = AnkBase.downloading.pages.indexOf(z);
              if (index != -1) {
                AnkBase.downloading.pages.splice(index, 1);

                let c = z.context;

                AnkBase.insertDownloadedDisplay(c.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.TIMEOUT);
                AnkBase.downloading.images -= c.info.path.image.images.length;
                AnkBase.updateStatusBarText();

                let title         = c.info.illust.title;
                let member_id     = c.info.member.id;
                let member_name   = c.info.member.name || member_id;
                let memoized_name = c.info.member.memoizedName || member_name;
                let pageUrl       = c.info.illust.pageUrl;
                let desc = '\n' + title + ' / ' + memoized_name + '\n' + pageUrl + '\n';
                let msg =
                  AnkBase.Locale('downloadTimeout') + '\n' +
                  desc;

                AnkUtils.dump(msg);
              }
            });
          } else if (typeof d.start === 'undefined') {
            // add download
            AnkBase.downloading.pages.push(d);
            AnkBase.downloading.images += d.context.info.path.image.images.length;
            AnkBase.updateStatusBarText();

            // たまたま開いているタブがダウンロードを始めるのと同じサイトだったならマーキング処理
            let (curmod = AnkBase.SupportedModule) {
              if (curmod && curmod.SERVICE_ID === d.context.SERVICE_ID)
                curmod.markDownloaded(d.context.info.illust.id,true);
            }
          } else {
            // remove download
            if (AnkBase.findDownload(d, true)) {
              // タイムアウト関連ですでにキューから刈り取られている場合はここに入らない
              AnkBase.downloading.images -= d.context.info.path.image.images.length;
              AnkBase.updateStatusBarText();
            }
  
            let c = d.context;
            let r = d.result;
            let r18 = (r === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED) ? c.info.illust.R18 : false;
            AnkBase.insertDownloadedDisplay(c.elements.illust.downloadedDisplayParent, r18, r);
          }
        }

        let queued = AnkBase.livingDownloads; 
        if (queued.length == 0)
          return;   // キューが空なので終了

        let waited = queued.filter(function (d) (typeof d.start === 'undefined') && d);
        if (waited.length == 0) {
          AnkUtils.dump('no runnable entry: queued='+queued.length);
          return;   // 実行待ちがないので終了
        }

        let runs = queued.length - waited.length;
        if (runs >= AnkBase.DOWNLOAD.MAXRUNS) {
          AnkUtils.dump('no slot: queued='+queued.length+' runs='+runs);
          return;  // スロットが埋まっているので終了
        }

        let download = waited[0];
        download.start = new Date().getTime();
        download.limit = download.start + AnkBase.RETRY.INTERVAL * download.context.info.path.image.images.length;
        AnkBase.updateStatusBarText();
        AnkBase.insertDownloadedDisplay(download.context.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADING);

        AnkBase.downloadExecuter(download);

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    },

    downloadExecuter: function (download) {
      try {
        function getSiteName (context) {
          if (context.info.path.initDir) 
            return null;                // サイト別初期ディレクトリが設定されていればそちらを優先

          let v = AnkBase.Prefs.get('siteName.'+context.SITE_NAME);
          if (v)
            return v;                   // サイトの別名定義がされていればそちらを優先

          return context.SITE_NAME;     // デフォルトサイト名を利用
        }

        let context = download.context;
        let useDialog = download.useDialog;
        let debug = download.debug;
        let start = download.start;

        let destFiles;
        let metaText      = AnkBase.infoText(context);
        let illust_id     = context.info.illust.id;
        let ext           = context.info.path.ext;
        let ref           = context.info.illust.referer;
        let member_id     = context.info.member.id;
        let member_name   = context.info.member.name || member_id;
        let pixiv_id      = context.info.member.pixivId;
        let memoized_name = context.info.member.memoizedName || member_name;
        let tags          = context.info.illust.tags;
        let title         = context.info.illust.title;
        let comment       = context.info.illust.comment;
        let filenames     = [];
        let shortTags     = context.info.illust.shortTags;
        let service_id    = context.SERVICE_ID;
        let site_name     = getSiteName(context);
        let images        = context.info.path.image.images;
        let facing        = context.info.path.image.facing;
        let pageUrl       = context.info.illust.pageUrl;
        let prefInitDir   = context.info.path.initDir || AnkBase.Prefs.get('initialDirectory') || AnkUtils.findHomeDir();

        if (AnkBase.Prefs.get('saveHistory', true)) {
          try {
            if (AnkBase.Storage.exists('members', 'id = \'' + member_id + '\' and service_id = \'' + service_id + '\'')) {
              // 古いデータには pixiv_id がついていなかったら付加する
              // (DB_VERSION = 5 で pixiv_id がついた
              AnkBase.Storage.createStatement(
                'update members set pixiv_id = ?1, version = ?2 where (id = ?3) and (pixiv_id is null)',
                function (stmt) {
                  stmt.bindUTF8StringParameter(0, pixiv_id);
                  stmt.bindInt32Parameter(1, AnkBase.DB_VERSION);
                  stmt.bindUTF8StringParameter(2, member_id);
                  stmt.executeStep();
                }
              );
            } else {
              AnkBase.Storage.insert(
                'members', {
                  id: member_id,
                  name: member_name,
                  pixiv_id: pixiv_id,
                  version: AnkBase.DB_VERSION,
                  service_id: service_id
                }
              );
            }
          } catch (e) {
            AnkUtils.dumpError(e, true);
          }
        }

        let savedDateTime = new Date();
        let defaultFilename = AnkBase.Prefs.get('defaultFilename', '?member-name? - ?title?/#page-number#');
        let alternateFilename = AnkBase.Prefs.get('alternateFilename', '?member-name? - ?title? - (?illust-id?)/#page-number#');
        (function () {
          let i = context.info;
          let ii = i.illust;
          let im = i.member;
          let ps = [
            [/\?site-name\?/g, site_name, true],
            [/\?title\?/g, title.substring(0,50)],
            [/\?member-id\?/g, member_id],
            [/\?member-name\?/g, member_name],
            [/\?memoized-name\?/g, memoized_name],
            [/\?memorized-name\?/g, memoized_name],
            [/\?tags\?/g, AnkUtils.join(tags, ' ')],
            [/\?short-tags\?/g, AnkUtils.join(shortTags, ' ')],
            [/\?tools\?/g, ii.tools],
            [/\?pixiv-id\?/g, im.pixivId],
            [/\?illust-id\?/g, illust_id],
            [/\?illust-year\?/g, ii.dateTime.year],
            [/\?illust-year2\?/g, ii.dateTime.year.toString().slice(2, 4)],
            [/\?illust-month\?/g, ii.dateTime.month],
            [/\?illust-day\?/g, ii.dateTime.day],
            [/\?illust-hour\?/g, ii.dateTime.hour],
            [/\?illust-minute\?/g, ii.dateTime.minute],
            [/\?saved-year\?/g, savedDateTime.getFullYear()],
            [/\?saved-year2\?/g, savedDateTime.getFullYear().toString().slice(2, 4)],
            [/\?saved-month\?/g, AnkUtils.zeroPad(savedDateTime.getMonth() + 1, 2)],
            [/\?saved-day\?/g, AnkUtils.zeroPad(savedDateTime.getDate(), 2)],
            [/\?saved-hour\?/g, AnkUtils.zeroPad(savedDateTime.getHours(), 2)],
            [/\?saved-minute\?/g, AnkUtils.zeroPad(savedDateTime.getMinutes(), 2)]
          ].map(function ([re, val, allowempty]) {
            try {
              return [re, AnkUtils.fixFilename((val || (allowempty ? '' : '-')).toString())];
            } catch (e) {
              AnkUtils.dump(re + ' is not found');
              throw e;
            }
          });
          function repl (s) {
            ps.forEach(function ([re, val]) (s = s.replace(re, val).trim()));
            return s;
          }
          filenames.push(repl(defaultFilename));
          filenames.push(repl(alternateFilename));

          if (debug) {
            let tokens = [
              'site-name     = ?site-name?',
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
          server: context.info.illust.server,
          saved: true,
          datetime: AnkUtils.toSQLDateTimeString(savedDateTime),
          comment: comment,
          version: AnkBase.DB_VERSION,
          service_id: service_id,
        };

        let onComplete = function (prefInitDir, local_path) {
          try {
            let caption = AnkBase.Locale('finishedDownload');
            let text = filenames[0];
            let relPath = prefInitDir ? AnkUtils.getRelativePath(local_path, prefInitDir)
                                      : AnkUtils.extractFilename(local_path);

            if (AnkBase.Prefs.get('saveHistory', true)) {
              try {
                record['local_path'] = local_path;
                record['filename'] = relPath;
                AnkBase.Storage.insert('histories', record);
              } catch (e) {
                AnkUtils.dumpError(e, true);
                caption = 'Error - onComplete';
                text = e;
              }
            }

            if (AnkBase.Prefs.get('saveMeta', true))
              AnkBase.saveTextFile(destFiles.meta, metaText);

            if (AnkBase.Prefs.get('showCompletePopup', true))
              AnkBase.popupAlert(caption, text);

            AnkUtils.dump('download completed: '+images.length+' pics in '+(new Date().getTime() - start)+' msec');

            AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED);

            // たまたま開いているタブがダウンロードが完了したのと同じサイトだったならマーキング処理
            let (curmod = AnkBase.SupportedModule) {
              if (curmod && curmod.SERVICE_ID === service_id)
                curmod.markDownloaded(illust_id,true);
            }

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
          let desc = '\n' + title + ' / ' + memoized_name + '\n' + pageUrl + '\n';
          let msg =
            AnkBase.Locale('downloadFailed') + '\n' +
            (responseStatus ? 'Status: ' + responseStatus + '\n' : '') +
            desc;

          window.alert(msg);
          AnkUtils.dump(msg);

          let confirmMsg =
            AnkBase.Locale('confirmOpenIllustrationPage') + '\n' +
            desc;

          if (window.confirm(confirmMsg))
            AnkUtils.openTab(pageUrl);

          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
        };

        let (invalid = AnkBase.invalidPageNumberToken(filenames)) {
          if (invalid) {
            window.alert(AnkBase.Locale('invalidPageNumberToken')+" : \n "+invalid);
            AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
            return;
          }
        }
        filenames = AnkBase.fixPageNumberToken(filenames, !context.in.manga);

        // XXX 前方で宣言済み
        destFiles = AnkBase.getSaveFilePath(prefInitDir, filenames, ext, useDialog, !context.in.manga, images.length, facing ? facing[facing.length-1] : undefined);
        if (!destFiles) {
          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
          return;
        }

        AnkBase.clearMarkedFlags();

        if (context.in.manga) {
          AnkBase.downloadFiles(images, ref, prefInitDir, destFiles.image, facing, download, onComplete, onError);
        }
        else {
          AnkBase.downloadIllust(images[0], ref, prefInitDir, destFiles.image, download, onComplete, onError);
        }

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    }, // }}}

    /*
     * downloadCurrentImageAuto
     * 自動的にダウンロードする場合はこっちを使う
     */
    downloadCurrentImageAuto: function (module) { // {{{
      AnkBase.downloadCurrentImage(module, undefined, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
    }, // }}}

    /*
     * ページ毎の関数をインストール
     */
    installFunctions: function (module) { // {{{
      try {
        if (AnkBase.Store.get(module.elements.doc).functionsInstalled)
          return;
        AnkBase.Store.get(module.elements.doc).functionsInstalled = true;
        if (module.in.medium) {
          module.installMediumPageFunctions();
        } else {
          module.installListPageFunctions();
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      }
    }, // }}}

    delayFunctionInstaller: function (mod, proc, interval, counter, funcid) {
      try {
        if (!proc(mod)) {
          if (counter > 0) {
            AnkUtils.dump('delay installation '+funcid+': '+mod.SITE_NAME+' remains '+counter);
            setTimeout(function() AnkBase.delayFunctionInstaller(mod, proc, interval, counter-1, funcid), interval);
          }
          else {
            AnkUtils.dump('installation failed '+funcid+': '+mod.SITE_NAME);
          }
        }
        else {
          AnkUtils.dump('installed '+funcid+': '+mod.SITE_NAME);
          return true;
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      } // }}}
    },

    /*
     * ダウンロード済みの表示をページに挿入する
     *    appendTo:     追加先の要素
     *    R18:          イラストはR18か？
     *    mode:         メッセージ本文　※nullの場合は削除
     */
    insertDownloadedDisplay: function (appendTo, R18, mode) { // {{{
      if (!AnkBase.Prefs.get('displayDownloaded', true))
        return;

      const ElementID = 'ankpixiv-downloaded-display';

      let doc;

      try {
        // XXX for "can't access dead object".
        doc = appendTo && appendTo.ownerDocument;
      } catch (e) {
        return;
      }

      if (!doc)
        return;

      var elm = doc.getElementById(ElementID);
      if (elm)
        elm.parentNode.removeChild(elm);

      if (!mode)
        return; // 表示削除

      let div = doc.createElement('div');
      let textNode = doc.createElement(R18 ? 'blink' : 'textnode');
      textNode.textContent = AnkBase.Locale((mode === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED && R18) ? AnkBase.DOWNLOAD_DISPLAY.USED : mode);
      div.setAttribute('style', AnkBase.Prefs.get('downloadedDisplayStyle', ''));
      div.setAttribute('id', ElementID);
      if (R18) {
        let v = AnkBase.Prefs.get('downloadedAnimationStyle', 1);
        if (v > 0)
          div.setAttribute('class', v == 1 ? 'R18' : 'R18-shake');
      }
      div.appendChild(textNode);
      if (appendTo)
        appendTo.appendChild(div);
    }, // }}}

    insertDownloadedDisplayById: function (appendTo, illust_id, service_id, R18) { // {{{
      if (!appendTo)
        return;

      if (AnkBase.isDownloading(illust_id, service_id)) { // {{{
        AnkBase.insertDownloadedDisplay(
          appendTo,
          false,
          AnkBase.DOWNLOAD_DISPLAY.DOWNLOADING
        );
      } else if (AnkBase.isDownloaded(illust_id, service_id)) {
        AnkBase.insertDownloadedDisplay(
          appendTo,
          R18,
          AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED
        );
      } else {
        AnkBase.insertDownloadedDisplay(
          appendTo,
          R18,
          null
        );
      } // }}}
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
      let bstream = AnkUtils.ccci("@mozilla.org/binaryinputstream;1",
                                  Components.interfaces.nsIBinaryInputStream);
      fstream.init(file, -1, 0, 0);
      bstream.setInputStream(fstream);
      let header = bstream.readBytes(10);
      fstream.close();

      if (header.match(/^\x89PNG/))
        return '.png';

      if (header.match(/^GIF8/))
        return '.gif';

      if (header.match(/^\x00\x00\x00\x1Cftyp/))
        return '.mp4';

      if (header.match(/^PK\x03\x04/))
        return '.zip';

      if (header.match(/JFIF|^\xFF\xD8/))
        return '.jpg';

      return;
    }, // }}}

    /*
     * fixFileExt
     *    file:     nsILocalFile
     *    return:   修正した時は真、変更不要な場合は偽、形式不明・例外発生の場合はnull
     * 正しい拡張子に修正する。
     */
    fixFileExt: function (file) { // {{{
      try {
        const reExt = /\.[^\.]+$/;
        let ext = AnkBase.getValidFileExt(file);
        let originalExt =
          let (m = file.path.match(reExt))
            (m && m.toString().toLowerCase());
  
        if (!ext) {
          AnkUtils.dump('fixFileExt: failed for unknown file type.');
          return null;
        }
  
        if (ext == originalExt)
          return false;
  
        let newFile = AnkUtils.makeLocalFile(file.path.replace(reExt, ext));
        file.moveTo(newFile.parent, newFile.leafName);
  
        AnkUtils.dump('Fix file ext: ' + file.path);
        return true;
      } catch (e) {
        AnkUtils.dump('Failed to fix file ext. => ' + e);
        return null;
      }
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
        let db = AnkBase.Storage.database;

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

    displayYourFantasy: function (module) { // {{{
      return;

      let doc = module.elements.doc;

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

      let {sum, table} = AnkBase.getYourFantasy();
      if (sum < 100)
        return;

      let nextElem = module.elements.mypage.fantasyDisplayNext;

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

      area.setAttribute('id', AnkBase.ID_FANTASY_DISPLAY);

      nextElem.parentNode.insertBefore(area, nextElem);
      ['areaBottom', 'area_bottom'].forEach(function (klass) {
        nextElem.parentNode.insertBefore(append({name: 'div', class: klass, text: ''}), nextElem);
      });

    }, // }}}


    /********************************************************************************
    * データベース関連
    ********************************************************************************/

    updateDatabase: function () { // {{{
      let ver = AnkBase.DB_VERSION;

      let (uver = AnkBase.Storage.getUserVersion()) {
        if (uver >= ver) {
          AnkUtils.dump("database is up to date. version "+uver);
          return;
        }

        AnkUtils.dump('update database. version '+uver+' -> '+ver);
      }

      // version 6
      try {
        let m = AnkBase.siteModules.filter(function (v) (typeof v.in.pixiv !== 'undefined') && v);
        if (m.length == 0) {
          AnkUtils.dump('unable to update db. pixiv module not installed.');
          return;
        }

        let srvid = m[0].SERVICE_ID;

        AnkBase.Storage.dropIndexes('histories',['illust_id']);
        AnkBase.Storage.dropIndexes('members',['id']);

        let set = 'service_id = \'' + srvid + '\', version = '+ver;
        let cond = 'service_id is null';
        AnkBase.Storage.update('histories', set, cond);
        AnkBase.Storage.update('members', set, cond);

        AnkBase.Storage.setUserVersion(ver);
      } catch (e) {
        AnkUtils.dump(e);
      }
    }, // }}}

    fixStorageEncode: function () { // {{{
      try {
        let storageWrapper = AnkUtils.ccci("@mozilla.org/storage/statement-wrapper;1",
                                           Components.interfaces.mozIStorageStatementWrapper);
        let db = AnkBase.Storage.database;
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
        let db = AnkBase.Storage.database;
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
      let queued = AnkBase.livingDownloads;
      let dp = queued.length;
      let remainImages = AnkBase.downloading.images;
      queued.forEach(function (d) remainImages -= d.downloaded);
      AnkBase.statusbarText = dp ? dp+'('+remainImages+'/'+AnkBase.downloading.images+')' : '';
    }, // }}}


    /********************************************************************************
    * スタイル
    ********************************************************************************/

    registerSheet: let (registered = {}) function (style) { // {{{
      const DefaultStyle = [
        '.ank-pixiv-tool-downloaded {',
        '  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAABGdBTUEAALGPC/xhBQAAABVJREFUGFdj/M+ABIAcOEKwQEqQZQAoTgz1O3uPKAAAAABJRU5ErkJggg==) !important;',
        '  background-repeat: repeat-x !important;',
        '  background-position: bottom !important;',
        '  background-color: pink !important;',
        '}',
        '.ank-pixiv-tool-downloaded-overlay {',
        '  background-image: url("chrome://ankpixiv/content/downloaded.png");',
        '  background-color: transparent !important;',
        '  border-radius: 4px 4px 4px 4px !important;',
        '  box-shadow: 2px 2px 2px #000 !important;',
        '  position: absolute;',
        '  top: 2px;',
        '  left: 2px;',
        '  width: 16px;',
        '  height: 16px;',
        '}',
        '.ank-pixiv-tool-downloading {',
        '  background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAEklEQVR42mNkaGCAAyYGBmI4ABoEAIiZRp63AAAAAElFTkSuQmCC) !important;',
        '  background-repeat: repeat-x !important;',
        '  background-position: bottom !important;',
        '  background-color: lime !important;',
        '}',
        '.ank-pixiv-tool-downloading-overlay {',
        '  background-image: url("chrome://ankpixiv/content/downloading.png");',
        '  background-color: transparent !important;',
        '  border-radius: 4px 4px 4px 4px !important;',
        '  box-shadow: 2px 2px 2px #000 !important;',
        '  position: absolute;',
        '  top: 2px;',
        '  left: 2px;',
        '  width: 16px;',
        '  height: 16px;',
        '}',
        '#ankpixiv-downloaded-display.R18 {',
        '  animation-timing-function: ease;',
        '  animation-duration: 10s;',
        '  animation-name: slidein;',
        '  animation-iteration-count: infinite !important;',
        '  animation-direction: alternate;',
        '}',
        '#ankpixiv-downloaded-display.R18-shake {',
        '  animation-timing-function: line;',
        '  animation-duration: 5s;',
        '  animation-name: shake;',
        '  animation-iteration-count: infinite !important;',
        '  animation-direction: normal;',
        '}',
        '@keyframes slidein {',
        '  from {',
        '    transform: rotateY(0deg);',
        '  }',
        '  to {',
        '    transform: rotateY(360deg);',
        '  }',
        '}',
        '@keyframes shake {',
        '  0%, 10.0%, 14.5%, 100% {',
        '    transform: translateX(0);',
        '  }',
        '  10.5%, 11.5%, 12.5%, 13.5% {',
        '    transform: translateX(-10px);',
        '  }',
        '  11.0%, 12.0%, 13.0%, 14.0% {',
        '    transform: translateX(10px);',
        '  }',
        '}'
      ].join("\n");

      const domains = AnkBase.siteModules.map(function (v) v.DOMAIN);

      AnkUtils.registerSheet(style || DefaultStyle, domains);
    }, // }}}


    /********************************************************************************
    * マーキング
    ********************************************************************************/

    markDownloaded: function(IsIllust, Targets, overlay, mod, node, force, ignorePref) { // {{{
      let target = AnkBase.getMarkTarget(mod, node, force, ignorePref);
      if (!target)
        return;

      let checked = [];
      Targets.forEach(function ([selector, nTrackback, targetClass]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (link) {
            // 一度チェックしたエレメントは二度チェックしない（異なるTarget指定で同じエレメントが重複してマッチする場合があるので、先にマッチしたものを優先）
            if (checked.indexOf(link) >= 0)
              return false;

            checked.push(link);

            let href = (link.tagName.toLowerCase() === 'a')   ? link.href :
                       (link.tagName.toLowerCase() === 'img') ? link.src :
                                                                false;
            return href && IsIllust.exec(href) && [link, RegExp.$1];
          }).
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback, targetClass), id, mod, overlay);
          });
      });
    }, // }}}

    getMarkTarget: function (module, node, force, ignorePref) { // {{{
      if (!module.in.site)
        return null;

      if (!AnkBase.Prefs.get('markDownloaded', false) && !ignorePref)
        return null;

      if (!force && AnkBase.Store.get(module.elements.doc).marked)
        return null;

      AnkBase.Store.get(module.elements.doc).marked = true;

      if (typeof node === 'string' || typeof node === 'number')
        return { node: module.elements.doc, illust_id: node};

      return { node: (node ? node : module.elements.doc), illust_id: undefined};
    }, // }}}

    /*
     *    overlay:    false  従来型のダウンロードマーキング
     *                true   ダウンロード済みアイコンのオーバーレイ表示（縦座標自動設定）
     *                number ダウンロード済みアイコンのオーバーレイ表示（縦座標=top: *number*px !important）
     */
    markBoxNode: function (box, illust_id, mod, overlay) { // {{{
      if (!box)
        return;

      if (overlay === false) {
        // 従来形式
        let cnDownloaded  = AnkBase.CLASS_NAME.DOWNLOADED;
        let cnDownloading = AnkBase.CLASS_NAME.DOWNLOADING;

        if (box.classList.contains(cnDownloaded))
          return;

        if (AnkBase.isDownloaded(illust_id, mod.SERVICE_ID)) {
          if (box.classList.contains(cnDownloading))
            box.classList.remove(cnDownloading);
          box.classList.add(cnDownloaded);
        }
        else if (AnkBase.isDownloading(illust_id, mod.SERVICE_ID)) {
          if (!box.classList.contains(cnDownloading))
            box.classList.add(cnDownloading);
        }
      }
      else {
        // DLアイコンのオーバーレイ形式
        function appendIcon (div) {
          let st = window.getComputedStyle(box, null);
          let pos = st.position;
          if (box.tagName.toLowerCase() === 'div') {
            // 親がボックス要素
            if (st.position === 'static') {
              box.style.setProperty('position', 'relative', 'important');
              box.style.removeProperty('top');
              box.style.removeProperty('bottom');
              box.style.removeProperty('left');
              box.style.removeProperty('right');
            }
            div.style.setProperty('position', 'absolute', 'important');
            div.style.setProperty('top', '2px', 'important');
            div.style.setProperty('left', '2px', 'important');
          }
          else {
            // 親がボックス要素以外
            div.style.setProperty('position', 'relative', 'important');
            if (typeof overlay == 'number') {
              div.style.setProperty('top', overlay+'px', 'important');
            }
            else {
              let (m = st.height.match(/(\d+(?:\.\d+)?)px/))
                m && div.style.setProperty('top', (2-parseFloat(m[1]))+'px', 'important');
            }
          }
          box.appendChild(div);
        }

        let cnDownloaded  = AnkBase.CLASS_NAME.DOWNLOADED_OVERLAY;
        let cnDownloading = AnkBase.CLASS_NAME.DOWNLOADING_OVERLAY;

        if (box.querySelector('.'+cnDownloaded))
          return;

        if (AnkBase.isDownloaded(illust_id, mod.SERVICE_ID)) {
          let div = box.querySelector('.'+cnDownloading);
          if (div) {
            div.classList.remove(cnDownloading);
          } else {
            div = mod.elements.doc.createElement('div');
            appendIcon(div);
          }
          div.classList.add(cnDownloaded);
        }
        else if (AnkBase.isDownloading(illust_id, mod.SERVICE_ID)) {
          if (!box.querySelector('.'+cnDownloading)) {
            let div = mod.elements.doc.createElement('div');
            appendIcon(div);
            div.classList.add(cnDownloading);
          }
        }
      }
    }, // }}}

    clearMarkedFlags: function () {
      AnkBase.Store.getAll().forEach(function(it) (it.marked = false));
    },

    /********************************************************************************
    * イベント
    ********************************************************************************/

    openPrefWindow: function () { // {{{
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                        "centerscreen,chrome,modal", arguments);
    }, // }}}

    onInit: function () { // {{{
      function initStorage () { // {{{
        AnkBase.Storage = new AnkStorage(
          AnkBase.Prefs.get('storageFilepath', 'ankpixiv.sqlite'),
          {
            histories: {
              illust_id: "string",
              member_id: "string",
              local_path: "string",
              title: "string",
              tags: "string",
              server: "string",
              datetime: "datetime",
              saved: "boolean",
              filename: "string",
              version: "integer",
              comment: "string",
              service_id: "string",
            },
            members: {
              id: "string",
              name: "string",
              pixiv_id: "string",
              version: "integer",
              service_id: "string",
            }
          },
          {
            index: {
              histories: ['illust_id,service_id','filename'],
              members: ['id,service_id']
            }
          }
        );
      } // }}}

      initStorage();
      AnkBase.updateDatabase();
      AnkBase.registerSheet();
      window.addEventListener('ankDownload', AnkBase.downloadHandler, true);
      window.addEventListener('pageshow', AnkBase.onPageshow, true);
      window.addEventListener('focus', AnkBase.onFocus, true);
      setInterval(function (e) AnkBase.cleanupDownload(), AnkBase.DOWNLOAD.CLEANUP_INTERVAL);
    }, // }}}

    onPageshow: function (ev) { // {{{

      let location = null;

      try {
        location = ev.target.location.href;

        let doc = window.gBrowser.selectedBrowser.contentDocument;
        if (typeof doc === 'undefined' || !doc || ev.target !== doc)
          return;       // documentがない、またはタブ内のトップ要素以外がターゲットなら無視する

        let curmod = AnkBase.SupportedModule;
        if (!curmod) {
          AnkBase.changeEnabled.call(AnkBase, null, 'ankpixiv-toolbar-button-image');
          AnkBase.changeEnabled.call(AnkBase, null, 'ankpixiv-menu-download');
          return;       // 対象外のサイト
        }

        AnkUtils.dump('triggered: pageshow, '+location);

        AnkBase.changeEnabled.call(AnkBase, curmod, 'ankpixiv-toolbar-button-image');
        AnkBase.changeEnabled.call(AnkBase, curmod, 'ankpixiv-menu-download');
        curmod.markDownloaded(null,ev.persisted);  // 戻るボタンなどで、キャッシュ上のページに遷移した場合は、マーキング強制
        AnkBase.installFunctions(curmod);

      } catch (e) {
        AnkUtils.dumpError(e,false,location);   // dead object対策
      }
    }, // }}}

    onFocus: function (ev) { // {{{

      let location = null;

      try {
        location = 'location: '+ev.target.location;

        if (!ev.target.toString().match(/\[object Window\]/,'i'))
          return;       // windowオブジェクト以外がターゲットなら無視する

        let curmod = AnkBase.SupportedModule;
        if (!curmod) {
          AnkBase.changeEnabled.call(AnkBase, null, 'ankpixiv-toolbar-button-image');
          AnkBase.changeEnabled.call(AnkBase, null, 'ankpixiv-menu-download');
          return;       // 対象外のサイト
        }

        AnkUtils.dump('triggered: focus, '+location);

        AnkBase.changeEnabled.call(AnkBase, curmod, 'ankpixiv-toolbar-button-image');
        AnkBase.changeEnabled.call(AnkBase, curmod, 'ankpixiv-menu-download');
        curmod.markDownloaded();                     // focus当たる度にDB検索されると困るので引数なし
        AnkBase.installFunctions(curmod);

        if (!AnkBase.Store.get(curmod.elements.doc).onFocusDone) {
          AnkBase.Store.get(curmod.elements.doc).onFocusDone = true;

          if (curmod.in.myPage && !curmod.elements.mypage.fantasyDisplay)
            AnkBase.displayYourFantasy(curmod);
        }

      } catch (e) {
        AnkUtils.dumpError(e,false,location);
      }
    }, // }}}

    changeEnabled: function (module, id) {
      let elem = document.getElementById(id);
      if (!elem)
        return;
      if (!module) {
        elem.setAttribute('lost', true);
        elem.setAttribute('dark', false);
      }
      else {
        elem.setAttribute('lost', false);
        elem.setAttribute('dark', !module.in.illustPage);
      }
    },

    onDownloadButtonClick: function (event) { // {{{
      event.stopPropagation();
      event.preventDefault();
      let curmod = AnkBase.SupportedModule;
      if (!curmod)
        return;
      if (!curmod.downloadable)
        return;
      let useDialog = AnkBase.Prefs.get('showSaveDialog', true);
      let button = (typeof event.button == 'undefined') ? 0 : event.button;
      if (curmod.in.illustPage) {
        switch(button) {
          case 0: AnkBase.downloadCurrentImage(curmod, useDialog); break;
          case 1: AnkBase.downloadCurrentImage(curmod, !useDialog); break;
          case 2: AnkBase.openPrefWindow(); break;
        }
      } else {
        let open = function (left) {
          let tab = AnkBase.AllPrefs.get('extensions.tabmix.opentabfor.bookmarks', false);
          if (!!left ^ !!tab)
            AnkUtils.loadURI(curmod.URL);
          else
            AnkUtils.openTab(curmod.URL);
        };
        switch(button) {
          case 0: open(true); break;
          case 1: open(false); break;
          case 2: AnkBase.openPrefWindow(); break;
        }
      }
    }, // }}}


    /********************************************************************************
    * 外部向け
    ********************************************************************************/

    expose: {
      /*
       * 他拡張からAnkPixiv.downloadCurrentImageが呼び出された時に実行する
       */
      downloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
        let curmod = AnkBase.SupportedModule;
        if (curmod)
          return AnkBase.downloadCurrentImage(curmod, useDialog, confirmDownloaded, debug);
      }, // }}}

      /*
       * 他拡張からAnkPixiv.rateが呼び出された時に実行する
       */
      rate: function (pt) { // {{{
        let curmod = AnkBase.SupportedModule;
        if (curmod)
          return curmod.rate(pt);
      }, // }}}
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
