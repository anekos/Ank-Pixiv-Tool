
try {

  let AnkModule = null;

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

    CLASS_NAME: {
      DOWNLOADED: 'ank-pixiv-tool-downloaded'
    },

    Prefs: new AnkPref('extensions.ankpixiv'),

    AllPrefs: new AnkPref(),

    Store: (function () { // {{{
      function getDocStore (doc)
        (doc.__ank_pixiv_store || (doc.__ank_pixiv_store = {}));

      return {
        get document () getDocStore(AnkModule.elements.doc),
        get documents ()
          AnkUtils.A(window.gBrowser.mTabs).map(function (it) getDocStore(it.linkedBrowser.contentDocument))
      };
    })(), // }}}

    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),

    MODULES: [],


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get inSupportedSite () { // {{{
      AnkUtils.dump('inSupportedSite check: '+AnkBase.currentLocation+",\n"+Error().stack);
      return AnkBase.MODULES.some(function (v) (AnkModule = v.in.site ? v : null));
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

    get currentLocation () // {{{
      window.content.document.location.href, // }}}

    get infoText () { // {{{
      let ignore =
        let (pref = AnkBase.Prefs.get('infoText.ignore', 'illust.dateTime.'))
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
          if (name.match(/^path\.images/))
            return '';
          if ( value && ! AnkModule.in.manga && name == 'path.mangaIndexPage')
            value = value.replace(/mode=manga/,'mode=medium');
          return value ? name + "\n" + indent(value) + "\n" : '';
        }
      }

      return textize([], AnkModule.info);
    }, // }}}

    get memoizedName () {
      let result = AnkBase.Storage.select(
        'members',
        'id = ?1 and service_id = ?2',
        function (stmt){
          let result = [];
          stmt.bindUTF8StringParameter(0, AnkModule.info.member.id);
          stmt.bindUTF8StringParameter(1, AnkModule.SERVICE_ID);
          while (stmt.executeStep())
            result.push(AnkStorage.statementToObject(stmt));
          return result;
        }
      );
      return result && result.length && result[0].name;
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
    showFilePicker: function (defaultFilename) { // {{{
      const nsIFilePicker = Components.interfaces.nsIFilePicker;
      let filePicker = AnkUtils.ccci('@mozilla.org/filepicker;1', nsIFilePicker);

      filePicker.appendFilters(nsIFilePicker.filterAll);
      filePicker.init(window, "pixiviiiiieee", nsIFilePicker.modeSave);

      let pm = defaultFilename.split('/').filter(function (v) v);
      if (pm.length == 1)
        pm = defaultFilename.split('\\').filter(function (v) v);

      filePicker.defaultString = pm.pop();

      let prefInitDir = AnkBase.getInitDir();
      if (prefInitDir) {
        if (pm.length > 0 && AnkBase.newLocalFile(prefInitDir).exists()) {
          pm.unshift(prefInitDir);
          let (d = pm.join(AnkUtils.SYS_SLASH)) {
            if (AnkBase.newLocalFile(d).exists())
              prefInitDir = d;
          }
        }
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
      let image = AnkBase.showFilePicker(basename + ext);
      if (!image)
        return;

      let meta = isFile ? AnkBase.newLocalFile(image.path + '.txt') // XXX path or nativePath
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

    getInitDir: function () // {{{
      AnkModule.info.path.initDir || AnkBase.Prefs.get('initialDirectory'), // }}}

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
          file: AnkBase.newLocalFile(url)
        };
      };

      function _exists (file)
        (file.file.exists() || AnkBase.filenameExists(file.filename));

      try {
        let IOService = AnkUtils.ccgs('@mozilla.org/network/io-service;1', Components.interfaces.nsIIOService);
        let prefInitDir = AnkBase.getInitDir();
        let initDir = AnkBase.newLocalFile(prefInitDir);

        if (!initDir.exists())
          return AnkBase.showFilePickerWithMeta(filenames[0], ext, isFile);

        for (let i in filenames) {
          let image = _file(prefInitDir, filenames[i], ext);
          let meta = _file(prefInitDir, filenames[i], '.txt', true);

          if (_exists(image) || _exists(meta))
            continue;

          if (useDialog) {
            return AnkBase.showFilePickerWithMeta(filenames[i], ext, isFile);
          } else {
            return {image: image.file, meta: meta.file};
          }
        }
      } catch (e) {
        // FIXME ?
        AnkUtils.dump(e);
      }

      return AnkBase.showFilePickerWithMeta(filenames[0], ext, isFile);
    }, // }}}

    /*
     * isDownloaded
     *    illust_id:     イラストID
     *    return:        ダウンロード済み？
     */
    isDownloaded: function (illust_id,service_id) { // {{{
      return AnkBase.Storage.exists('histories', 'illust_id = \'' + illust_id + '\' and service_id = \'' + service_id + '\'');
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

      AnkUtils.dump('DL => ' + file.path);
      AnkUtils.dump('downloadTo: ' + url + ', ' + referer);

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
        AnkBase.downloadTo(
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
            if (AnkBase.fixFileExt(lastFile))
              AnkUtils.dump('Fix file ext: ' + lastFile.path);
          } catch (e) {
            AnkUtils.dump('Failed to fix file ext. => ' + e);
          }
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
        file.append(((fp!=null)?(AnkUtils.zeroPad(fp[index], 2) + '_'):'') + AnkUtils.zeroPad(index + 1, 2) + fileExt);

        lastFile = file;
        index++;

        return AnkBase.downloadToRetryable(url, 3, ref, file, downloadNext, _onError);
      }

      downloadNext();
    }, // }}}

    /*
     * 他拡張からAnkPixiv.downloadCurrentImageが呼び出された時に実行する
     */
    callDownloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
      if (AnkBase.inSupportedSite)
        return AnkBase.downloadCurrentImage(useDialog, confirmDownloaded, debug);
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
        if (AnkModule.in.myIllust)
          return false;

        if (typeof useDialog === 'undefined')
          useDialog = AnkBase.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = AnkBase.Prefs.get('confirmExistingDownload');

        if (!AnkModule.in.illustPage)
          return false;

        AnkModule.setCookies();

        let destFiles;
        let metaText      = AnkBase.infoText;
        let pageUrl       = AnkBase.currentLocation;
        let url           = AnkModule.info.path.largeStandardImage;
        let illust_id     = AnkModule.info.illust.id;
        let ext           = AnkModule.info.path.ext;
        let ref           = AnkModule.info.illust.referer;
        let member_id     = AnkModule.info.member.id;
        let member_name   = AnkModule.info.member.name || member_id;
        let pixiv_id      = AnkModule.info.member.pixivId;
        let memoized_name = AnkModule.info.member.memoizedName || member_name;
        let tags          = AnkModule.info.illust.tags;
        let title         = AnkModule.info.illust.title;
        let comment       = AnkModule.info.illust.comment;
        let R18           = AnkModule.info.illust.R18;
        let doc           = AnkModule.elements.doc;
        let dlDispPoint   = AnkModule.elements.illust.downloadedDisplayParent;
        let filenames     = [];
        let shortTags     = AnkModule.info.illust.shortTags;
        let service_id    = AnkModule.SERVICE_ID;
        let site_name     = AnkModule.info.path.initDir ? null : AnkBase.Prefs.get('siteName.'+AnkModule.SITE_NAME, AnkModule.SITE_NAME);

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

        /* ダウンロード済みかの確認 */
        if (AnkBase.isDownloaded(illust_id,service_id)) {
          if (confirmDownloaded) {
            if (!window.confirm(AnkBase.Locale('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        let savedDateTime = new Date();
        let defaultFilename = AnkBase.Prefs.get('defaultFilename', '?member-name? - ?title?');
        let alternateFilename = AnkBase.Prefs.get('alternateFilename', '?member-name? - ?title? - (?illust-id?)');
        (function () {
          let i = AnkModule.info;
          let ii = i.illust;
          let im = i.member;
          let ps = [
            [/\?site-name\?/g, site_name, true],
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
          ].map(function ([re, val, allowempty]) {
            try {
              return [re, AnkUtils.fixFilename((val || (allowempty ? '' : '-')).toString())];
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
          server: AnkModule.info.illust.server,
          saved: true,
          datetime: AnkUtils.toSQLDateTimeString(savedDateTime),
          comment: comment,
          version: AnkBase.DB_VERSION,
          service_id: service_id,
        };

        let removeDownloading = function () {
          delete AnkBase.downloadings[pageUrl];
          AnkBase.updateStatusBarText();
        };

        let addDownloading = function () {
          AnkBase.downloadings[pageUrl] = new Date();
          AnkBase.updateStatusBarText();
        };

        let onComplete = function (local_path) {
          try {
            removeDownloading();

            let caption = AnkBase.Locale('finishedDownload');
            let text = filenames[0];
            let prefInitDir = AnkBase.getInitDir();
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

            AnkBase.insertDownloadedDisplay(dlDispPoint, R18);

            AnkBase.Store.documents.forEach(function(it) (it.marked = false));
            AnkModule.markDownloaded();

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
        };

        // ダウンロード中だったらやめようぜ！
        if (AnkBase.downloadings[pageUrl]) {
          return window.alert(AnkBase.Locale('alreadyDownloading'));
        }

        // XXX 前方で宣言済み
        destFiles = AnkBase.getSaveFilePath(filenames, AnkModule.in.manga ? '' : ext, useDialog, !AnkModule.in.manga);
        if (!destFiles)
          return;

        if (!AnkModule.in.pixiv) {
          if (AnkModule.in.manga) {
            AnkBase.downloadFiles(AnkModule.info.path.images, ref, destFiles.image, null, onComplete, onError);
            addDownloading();
          }
          else {
            AnkBase.downloadToRetryable(AnkModule.info.path.images[0], 3, ref, destFiles.image, onComplete, onError);
            addDownloading();
          }
          return;
        }

        if (AnkModule.in.manga) {
          AnkModule.getLastMangaPage(function (v, fp, ext) {
            function _download (originalSize) {
              if (v) {
                let urls = [];
                for (let i = 0; i < v; i++)
                  urls.push(AnkModule.info.path.getLargeMangaImage(i, url, ext, originalSize));
                AnkBase.downloadFiles(urls, ref, destFiles.image, fp, onComplete, onError);
                addDownloading();
              }
            }

            if (AnkBase.Prefs.get('downloadOriginalSize', false)) {
              AnkUtils.remoteFileExistsRetryable(
                AnkModule.info.path.getLargeMangaImage(0, url, ext, true),
                6,
                _download
              );
            } else {
              _download(false);
            }
          });
        } else {
          AnkBase.downloadToRetryable(url, 3, ref, destFiles.image, onComplete, onError);
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
      AnkBase.downloadCurrentImage(undefined, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
    }, // }}}

    /*
     * ページ毎の関数をインストール
     */
    installFunctions: function () { // {{{
      try {
        if (AnkBase.Store.document.functionsInstalled)
          return;
        AnkBase.Store.document.functionsInstalled = true;
        if (AnkModule.in.medium) {
          AnkModule.installMediumPageFunctions();
        } else {
          AnkModule.installListPageFunctions();
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

      if (!doc || doc.getElementById(ElementID))
        return;

      let div = doc.createElement('div');
      let textNode = doc.createElement(R18 ? 'blink' : 'textnode');
      textNode.textContent = AnkBase.Locale(R18 ? 'used' : 'downloaded');
      div.setAttribute('style', AnkBase.Prefs.get('downloadedDisplayStyle', ''));
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
      let ext = AnkBase.getValidFileExt(file);
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

    displayYourFantasy: function () { // {{{
      return;

      let doc = AnkModule.elements.doc;

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

      let nextElem = AnkModule.elements.mypage.fantasyDisplayNext;

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
        AnkBase.Storage.dropIndexes('histories',['illust_id']);
        AnkBase.Storage.dropIndexes('members',['id']);

        let set = 'service_id = \'' + AnkBase.SERVICE_ID + '\', version = '+ver;
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
      let text = [k for (k in AnkBase.downloadings)].length;
      AnkBase.statusbarText = text ? text : '';
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

      let domainlist = AnkBase.MODULES.map(function (v) 'domain("'+v.DOMAIN+'")').join(',');
      AnkUtils.dump('supported: '+domainlist);

      let CSS = [
        '@namespace url(http://www.w3.org/1999/xhtml);',
        '@-moz-document '+domainlist+' {',
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
              histories: ['illust_id,service_id'],
              members: ['id,service_id']
            }
          }
        );
      } // }}}

      window.addEventListener('focus', AnkBase.onFocus, true);
      initStorage();
      AnkBase.updateDatabase();
      AnkBase.registerSheet();
    }, // }}}

    onFocus: function (ev) { // {{{
      try {
        let changeEnabled = function (id) {
          let elem = document.getElementById(id);
          if (!elem)
            return;
          elem.setAttribute('dark', !AnkModule.in.illustPage);
        };

        if (!ev.target.toString().match(/\[object Window\]/,'i'))
          return;

        if (!AnkBase.inSupportedSite)
          return;

        changeEnabled.call(AnkBase, 'ankpixiv-toolbar-button-image');
        changeEnabled.call(AnkBase, 'ankpixiv-menu-download');

        AnkModule.markDownloaded();

        if (!AnkBase.Store.document.onFocusDone) {
          AnkBase.Store.document.onFocusDone = true;

          AnkBase.installFunctions();

          if (AnkModule.in.myPage && !AnkModule.elements.mypage.fantasyDisplay)
            AnkBase.displayYourFantasy();
        }

      } catch (e) {
        AnkUtils.dumpError(e);
      }
    }, // }}}

    onDownloadButtonClick: function (event) { // {{{
      event.stopPropagation();
      event.preventDefault();
      let useDialog = AnkBase.Prefs.get('showSaveDialog', true);
      let button = (typeof event.button == 'undefined') ? 0 : event.button;
      if (AnkModule.in.illustPage) {
        switch(button) {
          case 0: AnkBase.downloadCurrentImage(useDialog); break;
          case 1: AnkBase.downloadCurrentImage(!useDialog); break;
          case 2: AnkBase.openPrefWindow(); break;
        }
      } else {
        let open = function (left) {
          let tab = AnkBase.AllPrefs.get('extensions.tabmix.opentabfor.bookmarks', false);
          if (!!left ^ !!tab)
            AnkUtils.loadURI(AnkModule.URL);
          else
            AnkUtils.openTab(AnkModule.URL);
        };
        switch(button) {
          case 0: open(true); break;
          case 1: open(false); break;
          case 2: AnkBase.openPrefWindow(); break;
        }
      }
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
