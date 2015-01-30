
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
Components.utils.import("resource://gre/modules/Promise.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");

try {

  AnkBase = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    DB_DEF: {
      VERSION: 7,

      TABLES: {
        histories: {
          illust_id: { type:"string" },
          member_id: { type:"string" },
          local_path: { type:"string" },
          title: { type:"string" },
          tags: { type:"string" },
          server: { type:"string" },
          datetime: { type:"datetime" },
          saved: { type:"boolean" },
          filename: { type:"string" },
          version: { type:"integer" },
          comment: { type:"string" },
          service_id: { type:"string" },
        },
        members: {
          id: { type:"string" },
          name: { type:"string" },
          pixiv_id: { type:"string" },
          version: { type:"integer" },
          service_id: { type:"string" },
        }
      },

      OPTIONS: {
        index: {
          histories: [
            ['illust_id','service_id'],
            ['filename']
          ],
          members: [
            ['id','service_id']
          ],
        }
      }
    },

    DEFAULT_STYLE: (function () {/*
      .ank-pixiv-tool-downloaded {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAABGdBTUEAALGPC/xhBQAAABVJREFUGFdj/M+ABIAcOEKwQEqQZQAoTgz1O3uPKAAAAABJRU5ErkJggg==") !important;
        background-repeat: repeat-x !important;
        background-position: bottom !important;
        background-color: pink !important;
      }
      .ank-pixiv-tool-downloaded-overlay {
        background-image: url("chrome://ankpixiv/content/downloaded.png");
        background-color: transparent !important;
        border-radius: 4px 4px 4px 4px !important;
        box-shadow: 2px 2px 2px #000 !important;
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
      }
      .ank-pixiv-tool-downloading {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAEklEQVR42mNkaGCAAyYGBmI4ABoEAIiZRp63AAAAAElFTkSuQmCC") !important;
        background-repeat: repeat-x !important;
        background-position: bottom !important;
        background-color: lime !important;
      }
      .ank-pixiv-tool-downloading-overlay {
        background-image: url("chrome://ankpixiv/content/downloading.png");
        background-color: transparent !important;
        border-radius: 4px 4px 4px 4px !important;
        box-shadow: 2px 2px 2px #000 !important;
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
      }
      #ankpixiv-downloaded-display.R18 {
        animation-timing-function: ease;
        animation-duration: 10s;
        animation-name: slidein;
        animation-iteration-count: infinite !important;
        animation-direction: alternate;
      }
      #ankpixiv-downloaded-display.R18-shake {
        animation-timing-function: linear;
        animation-duration: 5s;
        animation-name: shake;
        animation-iteration-count: infinite !important;
        animation-direction: normal;
      }
      @keyframes slidein {
        from {
          transform: rotateY(0deg);
        }
        to {
          transform: rotateY(360deg);
        }
      }
      @keyframes shake {
        0%, 10.0%, 14.5%, 100% {
          transform: translateX(0);
        }
        10.5%, 11.5%, 12.5%, 13.5% {
          transform: translateX(-10px);
        }
        11.0%, 12.0%, 13.0%, 14.0% {
          transform: translateX(10px);
        }
      }
    */}).toString().replace(/^[\s\S]*?\/\*([\s\S]+)\*\/[\s\S]*$/, '$1'),

    DOWNLOAD_DISPLAY: {
      ID:           'ankpixiv-downloaded-display',

      DOWNLOADED:   'downloaded',
      USED:         'used',
      INITIALIZE:   'initialize',
      DOWNLOADING:  'downloading',
      FAILED:       'downloadFailed',
      TIMEOUT:      'downloadTimeout',
    },

    DOWNLOAD_MARK: {
      DOWNLOADED:          'ank-pixiv-tool-downloaded',
      DOWNLOADED_OVERLAY:  'ank-pixiv-tool-downloaded-overlay',
      DOWNLOADING:         'ank-pixiv-tool-downloading',
      DOWNLOADING_OVERLAY: 'ank-pixiv-tool-downloading-overlay',
    },

    TOOLBAR_BUTTON: {
      ID:       'ankpixiv-toolbar-button',
      IMAGE_ID: 'ankpixiv-toolbar-button-image',
      TEXT_ID:  'ankpixiv-toolbar-button-text',
    },

    MENU_ITEM: {
      ID:       'ankpixiv-menu-download',
    },

    DOWNLOAD_RETRY: {
      INTERVAL: 10*1000,
      MAX_TIMES: 3,
    },

    DOWNLOAD_THREAD: {
      MAXRUNS: 1,
      CLEANUP_INTERVAL: 30*1000,
    },

    FILENAME_KEY: {
      PAGE_NUMBER: "#page-number#",
    },

    FIT: {
      NONE:             0,
      IN_WINDOW_SIZE:   1,
      IN_WINDOW_HEIGHT: 2,
      IN_WINDOW_WIDTH:  3
    },

    Prefs: new AnkPref('extensions.ankpixiv'),

    AllPrefs: new AnkPref(),

    Locale: AnkUtils.getLocale('chrome://ankpixiv/locale/ankpixiv.properties'),

    Storage: null,

    downloading: {
      pages:  [],     // ダウンロード情報のリスト（__download）
      images: 0,      // キューに載ったダウンロード対象の画像の合計枚数
    }, 


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    get currentDoc ()
      window.gBrowser.selectedBrowser.contentDocument,

    get currentModule () {
      let curdoc = AnkBase.currentDoc;
      return curdoc && curdoc.AnkPixivModule;
    },

    /********************************************************************************
    * モジュール関連
    ********************************************************************************/

    siteModules: [],

    /**
     * サイトモジュールのコンストラクタを追加する
     */
    addModule: function (module) {
      if (!AnkBase.Prefs.get('useExperimentalModules', false) && module.prototype.EXPERIMENTAL) {
        AnkUtils.dump('skip experimental module: '+module.prototype.SITE_NAME+', '+module.prototype.SERVICE_ID);
      } else {
        AnkUtils.dump('installed module: '+module.prototype.SITE_NAME+', '+module.prototype.SERVICE_ID);
        AnkBase.siteModules.push(module);
      }
    },

    /**
     * サイトモジュールのインスタンスをカレントドキュメントにインストールする
     */
    installSupportedModule: function (doc) { // {{{
      let disabledModules = AnkBase.Prefs.get('disabledSiteModules', '').split(',').map(function (v) AnkUtils.trim(v.toLowerCase()));
      for (let i=0; i<AnkBase.siteModules.length; i++) {
        let module = AnkBase.siteModules[i];
        if (disabledModules.indexOf(module.prototype.SITE_NAME.toLowerCase()) == -1) {
          if (module.prototype.isSupported(doc)) {
            AnkUtils.dump('SUPPORTED: '+doc.location.href+",\n"+Error().stack);
            doc.AnkPixivModule = new module(doc);
            return doc.AnkPixivModule;
          }
        }
      }
    }, // }}}

    /**
     * ページの読み込み遅延を待ってから機能をインストールする
     */
    delayFunctionInstaller: function (proc, interval, counter, siteid, funcid) {
      try {
        if (!proc()) {
          if (counter > 0) {
            AnkUtils.dump('delay installation '+funcid+': '+siteid+' remains '+counter);
            setTimeout(function() AnkBase.delayFunctionInstaller(proc, interval, counter-1, siteid, funcid), interval);
          }
          else {
            AnkUtils.dump('installation failed '+funcid+': '+siteid);
          }
        }
        else {
          AnkUtils.dump('installed '+funcid+': '+siteid);
          return true;
        }
      } catch (e) {
        AnkUtils.dumpError(e);
      } // }}}
    },

    /********************************************************************************
     * ダイアログ関連
     ********************************************************************************/

    /**
     * 設定ウィンドウ
     */
    openPrefWindow: function () { // {{{
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog",
                        "centerscreen,chrome,modal", arguments);
    }, // }}}

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
        filePicker.displayDirectory = AnkBase.newLocalFile(prefInitDir);
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
      const PGNM_KEY = AnkUtils.SYS_SLASH+AnkBase.FILENAME_KEY.PAGE_NUMBER;
      let defaultFilename;
      let index = basename.indexOf(PGNM_KEY);
      if (!isFile && basename.length == index + PGNM_KEY.length) {
        defaultFilename = basename.substr(0, index);
      }
      else {
        defaultFilename = basename + ext;
        ext = null;
      }
      let image = AnkBase.showFilePicker(prefInitDir, defaultFilename);
      if (!image)
        return;

      if (isFile) {
        return  {
          image: image,
          meta: AnkBase.newLocalFile(image.path.replace(/\.\w+$/,'.txt'))
        };
      }

      let mangaPath = ext ? image.path+PGNM_KEY+ext : image.path;
      let mangaLeafName = ext ? AnkBase.FILENAME_KEY.PAGE_NUMBER+ext : image.leafName; 
      return {
        image: AnkBase.newLocalFile(mangaPath.replace(/\.\w+$/,'')),
        meta: AnkBase.newLocalFile(
                mangaLeafName.match(/^#page-number#\.\w+$/) ?
                    mangaPath.replace(/#page-number#\.\w+$/,'meta.txt') :
                    mangaPath.replace(/\s*#page-number#/,'').replace(/\.\w+$/,'.txt')
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
    filenameExists: function (filename) { // {{{
      return Task.spawn(function* () {
        return yield AnkBase.Storage.exists(AnkBase.getFileExistsQuery(filename));
      });
    },

    /*
     * newLocalFile
     *    url:      String パス
     *    return:   nsIFile
     * nsILocalFileを作成
     */
    newLocalFile: function (path) { // {{{
      return new FileUtils.File(AnkUtils.replaceFileSeparatorToSYS(path));
    }, // }}}

    /*
     * newFileURI
     *    url:      String パス
     *    return:   nsIURI
     * nsILocalFileを作成
     */
    newFileURI: function (path) { // {{{
      return Services.io.newFileURI(AnkBase.newLocalFile(path));
    }, // }}}

    /*
     * setMangaPageNumber
     *    path:               ファイル名のテンプレート
     *    ext:                拡張子
     *    imgno:              ファイル通番
     *    pageno:             ページ番号
     *    return:             {path: パス（ファイル名は含まない）, name: ファイル名}
     * マンガ形式の保存のためにパス指定中の　#page-number#　をページ番号に置換して返す
     */
    setMangaPageNumber: function (path, ext, imgno, pageno) {
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
      return { path: ps.join(AnkUtils.SYS_SLASH), name: name+ext };
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
      return Task.spawn(function* () {
        function _file (initDir, basename, ext, isMeta) {
          // TODO File#join
          let filename = (function () {
            if (isFile) {
              return basename + ext;
            } else {
              let p = isMeta ? AnkBase.setMangaPageNumber(basename, ext) :
                               AnkBase.setMangaPageNumber(basename, ext, lastImgno, lastPageno);
              return OS.Path.join(p.path, p.name);
            }
          })();
          let filepath = OS.Path.join(initDir, filename);
          let url = (isFile || isMeta) ? filepath :
                                         OS.Path.join(initDir, basename);

          return {
            filename: filename,
            filepath: filepath,   // マンガ形式の場合、１ページ目の画像のパス
            url: url,             // マンガ形式の場合、初期パス＋ファイル名テンプレート
            file: AnkBase.newLocalFile(url)
          };
        }

        function _exists (file) {
          return Task.spawn(function* () {
            let f = isFile ? file.file : AnkBase.newLocalFile(file.filepath);
            if (f.exists())
              return true;
            return yield AnkBase.filenameExists(AnkUtils.getRelativePath(f.path, prefInitDir));
          });
        }

        let initDir = AnkBase.newLocalFile(prefInitDir);

        if (!initDir.exists())
          return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[0], ext, isFile);

        for (let i in filenames) {
          let image = _file(prefInitDir, filenames[i], ext);
          let meta = _file(prefInitDir, filenames[i], '.txt', true);

          let b = yield _exists(image);
          if (b)
            continue;

          b = yield _exists(meta);
          if (b)
            continue;

          if (useDialog) {
            return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[i], ext, isFile);
          } else {
            return {image: image.file, meta: meta.file};
          }
        }

        return AnkBase.showFilePickerWithMeta(prefInitDir, filenames[0], ext, isFile);
      });
    }, // }}}

    /*
     * downloadTo
     *    file:           nsIFile
     *    url:            URL
     *    referer:        リファラ
     * ファイルをダウンロードする
     */
    // TODO Download.jsmで置き換えたいが、404とかをトラップする方法がわかるまで保留
    downloadTo: function (file, url, referer) {
      let self = this; 
      return new Promise(function (resolve, reject) {

        // 各種オブジェクトの生成
        let sourceURI = NetUtil.newURI(url);
        let refererURI = NetUtil.newURI(referer);

        let channel = Services.io.newChannelFromURI(sourceURI).QueryInterface(Ci.nsIHttpChannel);
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
                resolve(-1);
              }

              // FIXME 分割(206)で返ってきても１回で全部揃ってるならよし、揃ってなければエラー
              if (responseStatus == 206) {
                let m = channel.getResponseHeader('Content-Range').match(/bytes\s+(\d+)-(\d+)\/(\d+)/);
                let content_size = parseInt(m[3],10);
                let downloaded = parseInt(m[2],10) - parseInt(m[1],10) + 1;
                if (downloaded >= content_size)
                  resolve(200);
                else
                  resolve(responseStatus);
              }
              else {
                resolve(responseStatus); // 200でも404でも
              }
            }
          },
          onProgressChange: function (_webProgress, _request, _curSelfProgress, _maxSelfProgress, _curTotalProgress, _maxTotalProgress) {},
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
      });
    },

    /*
     * downloadToRetryable
     *    file:           nsIFile
     *    url:            URL
     *    referer:        リファラ
     *    maxTimes:       リトライ最大回数
     * ファイルをダウンロードする
     */
    downloadToRetryable: function (file, url, referer, maxTimes) { // {{{
      return Task.spawn(function* () {
        let status;
        for (let times=1; times<=maxTimes; times++ ) {
          AnkUtils.dump('DL => ' + file.path);
          AnkUtils.dump('downloadTo: ' + url + ', ' + referer);

          yield OS.File.makeDir(file.parent.path, { ignoreExisting:true, unixMode:0755 });

          status = yield AnkBase.downloadTo(file, url, referer);
          if (status == 200)
            return status;

          if (times < maxTimes) {
            yield new Promise(function (resolve, reject) {
              setTimeout(function () resolve(), times * AnkBase.DOWNLOAD_RETRY.INTERVAL);
            });
          }
        }
        return status;
      })
    }, // }}}

    /*
     * downloadFiles
     *    localdir:       出力先ディレクトリ nsilocalFile
     *    urls:           URLリスト
     *    referer:        リファラ
     *    fp:             見開きページ情報
     *    download:       ダウンロードキューエントリー
     *    onComplete      終了時のアラート
     *    onError         終了時のアラート
     * 複数のファイルをダウンロードする
     */
    downloadFiles: function (localdir, urls, fp, referer, download, onComplete, onError) { // {{{
      Task.spawn(function* () {
        const MAX_FILE = 1000;

        // XXX ディレクトリは勝手にできるっぽい
        //localdir.exists() || localdir.create(localdir.DIRECTORY_TYPE, 0755);

        for (let index=0; index<urls.length && index<MAX_FILE ; index++) {
          let ref = referer.replace(/(mode=manga_big)(&page=)\d+(.*)$/,"$1$3$2"+index);  // Pixivマンガオリジナルサイズの場合は画像ごとにrefererが異なる
          let url = urls[index];
          let file = localdir.clone();
          let m = url.match(/(\.\w+)(?:$|\?)/);
          let fileExt = (m && m[1]) || '.jpg';

          let p = AnkBase.setMangaPageNumber(file.path, fileExt, index+1, fp ? fp[index] : undefined);
          file.initWithPath(p.path);
          file.append(p.name);

          let status = yield AnkBase.downloadToRetryable(file, url, referer, AnkBase.DOWNLOAD_RETRY.MAX_TIMES);
          if (status != 200) {
            AnkUtils.dump('Delete invalid file. => ' + file.path);
            yield OS.File.remove(file.path).then(null, function (e) AnkUtils.dump('Failed to delete invalid file. => ' + e));
            return onError(status);
          }

          ++download.downloaded;
          AnkBase.updateToolbarText();

          // ファイルの拡張子の修正
          yield AnkBase.fixFileExt(file);
        }

        return onComplete(localdir.path);
      }).then(null, function (e) AnkUtils.dumpError(e, true));
    }, // }}}

    /*
     * downloadIllust
     *    file:           nsIFile
     *    url:            URL
     *    referer:        リファラ
     *    download:       ダウンロードキューエントリー
     *    onComplete      終了時のアラート
     *    onError         終了時のアラート
     * 一枚絵のファイルをダウンロードする
     */
    downloadIllust: function (file, url, referer, download, onComplete, onError) { // {{{
      Task.spawn(function* () {
        let status = yield AnkBase.downloadToRetryable(file, url, referer, AnkBase.DOWNLOAD_RETRY.MAX_TIMES);
        if (status != 200) {
          AnkUtils.dump('Delete invalid file. => ' + file.path);
          yield OS.File.remove(file.path).then(null, function (e) AnkUtils.dump('Failed to delete invalid file. => ' + e));
          return onError(status);
        }

        ++download.downloaded;
        AnkBase.updateToolbarText();

        // ファイルの拡張子の修正
        yield AnkBase.fixFileExt(file);

        return onComplete(file.path);
      }).then(null, function (e) AnkUtils.dumpError(e, true));
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

      let encoder = new TextEncoder();
      let array = encoder.encode(text);
      OS.File.writeAtomic(file.path, array, { encoding:"utf-8", tmpPath:file.path+".tmp" }).then(null, function (e) AnkUtils.dumpError(e));
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
      Task.spawn(function () {
        // 同一ページでも、表示中の状態によってダウンロードの可否が異なる場合がある
        if (!module.isDownloadable())
          return;

        if (typeof useDialog === 'undefined')
          useDialog = AnkBase.Prefs.get('showSaveDialog', true);

        if (typeof confirmDownloaded === 'undefined')
          confirmDownloaded = AnkBase.Prefs.get('confirmExistingDownload');

        // ダウンロード中だったらやめようぜ！
        if (AnkBase.isDownloading(module.getIllustId(), module.SERVICE_ID)) {
          //window.alert(AnkBase.Locale('alreadyDownloading'));
          return;
        }

        // ダウンロード済みかの確認
        let row = yield AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(module.getIllustId(), module.SERVICE_ID));
        if (row) {
          if (confirmDownloaded) {
            if (!window.confirm(AnkBase.Locale('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        // ダウンロード用のコンテキストの収集(contextの取得に時間がかかる場合があるのでダウンロードマークを表示しておく)
        AnkBase.insertDownloadedDisplay(module.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.INITIALIZE);
        module.downloadCurrentImage(useDialog, debug);
      }).then(null, function (e) AnkUtils.dumpError(e, true));
    },

    /*
     * isDownloading
     *    illust_id:     イラストID
     *    service_id:    サイト識別子
     *    return:        ダウンロード中？
     */
    isDownloading: function (illust_id, service_id) {
      function find (v) {
        return (v.context.SERVICE_ID === service_id) && (v.context.info.illust.id == illust_id); // illust_idは === ではなく == で比較する
      }

      return AnkBase.downloading.pages.some(find);
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
      let ev = document.createEvent('Event');
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
    },

    removeDownload: function (download, result) {
      let ev = document.createEvent('Event');
      ev.initEvent('ankDownload', true, false);
      ev.__download = download;
      ev.__download.result = result;
      window.dispatchEvent(ev);
    },

    cleanupDownload: function () {
      let ev = document.createEvent('Event');
      ev.initEvent('ankDownload', true, false);
      ev.__download = undefined;
      window.dispatchEvent(ev);
    },

    get livingDownloads () {
      return AnkBase.downloading.pages.filter(function (d) (typeof d.result === 'undefined') && d);
    },

    get zombieDownloads () {
      let curtime = new Date().getTime();
      return AnkBase.downloading.pages.filter(function (d) (typeof d.start !== 'undefined' && d.limit < curtime) && d);
    },

    downloadHandler: function (ev) {
      try {
        let d = ev.__download;
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
              AnkBase.updateToolbarText();

              let title         = c.info.illust.title;
              let member_id     = c.info.member.id;
              let member_name   = c.info.member.name || member_id;
              let pageUrl       = c.info.illust.pageUrl;
              let desc = '\n' + title + ' / ' + member_name + '\n' + pageUrl + '\n';
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
          AnkBase.updateToolbarText();

          // たまたま開いているタブがダウンロードを始めるのと同じサイトだったならマーキング処理
          let curmod = AnkBase.currentModule;
          if (curmod && curmod.SERVICE_ID === d.context.SERVICE_ID)
            curmod.markDownloaded(d.context.info.illust.id,true);
        } else {
          // remove download
          if (AnkBase.findDownload(d, true)) {
            // タイムアウト関連ですでにキューから刈り取られている場合はここに入らない
            AnkBase.downloading.images -= d.context.info.path.image.images.length;
            AnkBase.updateToolbarText();
          }

          let c = d.context;
          let r = d.result;
          let r18 = (r === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED) ? c.info.illust.R18 : false;
          AnkBase.insertDownloadedDisplay(c.elements.illust.downloadedDisplayParent, r18, r);

          // 動作確認用
          if (AnkBase.Prefs.get('showDownloadedFilename', false)) {
            try {
              let e = c.elements.illust.downloadedFilenameArea;
              if (e)
                e.innerHTML = '['+c.info.path.image.images.length+'] ' + c.info.path.image.images[0];
            }
            catch (e) {}
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
        if (runs >= AnkBase.DOWNLOAD_THREAD.MAXRUNS) {
          AnkUtils.dump('no slot: queued='+queued.length+' runs='+runs);
          return;  // スロットが埋まっているので終了
        }

        let download = waited[0];
        download.start = new Date().getTime();
        download.limit = download.start + AnkBase.DOWNLOAD_RETRY.INTERVAL * download.context.info.path.image.images.length;
        AnkBase.updateToolbarText();
        AnkBase.insertDownloadedDisplay(download.context.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADING);

        AnkBase.downloadExecuter(download);

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    },

    downloadExecuter: function (download) {
      Task.spawn(function () {

        function getSiteName (context) {
          if (context.info.path.initDir) 
            return null;                // サイト別初期ディレクトリが設定されていればそちらを優先

          let v = AnkBase.Prefs.get('siteName.'+context.SITE_NAME);
          if (v)
            return v;                   // サイトの別名定義がされていればそちらを優先

          return context.SITE_NAME;     // デフォルトサイト名を利用
        }

        let context   = download.context;
        let useDialog = download.useDialog;
        let debug     = download.debug;
        let start     = download.start;

        let destFiles;
        let illust_id     = context.info.illust.id;
        let ext           = context.info.path.ext;
        let ref           = context.info.illust.referer;
        let member_id     = context.info.member.id;
        let member_name   = context.info.member.name || member_id;
        let pixiv_id      = context.info.member.pixivId;
        let memoized_name = member_name;
        let tags          = context.info.illust.tags;
        let title         = context.info.illust.title;
        let comment       = context.info.illust.comment;
        let metaText      = context.metaText;
        let filenames     = [];
        let shortTags     = context.info.illust.shortTags;
        let service_id    = context.SERVICE_ID;
        let site_name     = getSiteName(context);
        let images        = context.info.path.image.images;
        let facing        = context.info.path.image.facing;
        let pageUrl       = context.info.illust.pageUrl;
        let prefInitDir   = context.info.path.initDir || AnkBase.Prefs.get('initialDirectory') || AnkUtils.findHomeDir();

        let savedDateTime = new Date();

        // FIXME memoized_nameの取得をここに移したため、meta.txtにmemoized_nameが記録されないようになってしまった
        // FIXME membersに重複エントリができる可能性がある。(重複削除してから)unique制約をつけるか、１トランザクション中にselect→insertするか等
        let row = yield AnkBase.Storage.exists(AnkBase.getMemberExistsQuery(download.context.info.member.id,download.context.SERVICE_ID));
        if (row) {
          download.context.info.member.memoizedName = row.getResultByName('name');
        }
        else {
          if (AnkBase.Prefs.get('saveHistory', true)) {
            let record = { id:member_id, name: member_name, pixiv_id:pixiv_id, version:AnkBase.DB_DEF.VERSION, service_id:service_id };
            let qa = [];
            qa.push({ type:'insert', table:'members', set:record });
            yield AnkBase.Storage.update(AnkBase.Storage.getUpdateSQLs(qa));
          }
        }

        function fixPageNumberToken (path) {

          let f = path.replace(/\/\s*$/, '');       // 終端はファイル名

          if (f.match(/#page-number#.*?\//))
            return;                                 // ファイル名以外でのページ番号指定は不可

          if (!context.in.manga) {
            f = f.replace(/\s*#page-number#/, '');  // イラスト形式ならページ番号は不要
            f = f.replace(/\/\s*$/, '');            // 終端はファイル名
          }
          else {
            if (f.indexOf('#page-number#') == -1)
              f += '/#page-number#';                // ページ番号指定がないものには強制
          }

          return f;
        }

        let defaultFilename = AnkBase.Prefs.get('defaultFilename', '').trim() || '?member-name? - ?title?/#page-number#';
        let alternateFilename = AnkBase.Prefs.get('alternateFilename', '').trim() || '?member-name? - ?title? - (?illust-id?)/#page-number#';

        // パスの区切り文字をいったん'/'に統一
        defaultFilename = fixPageNumberToken(AnkUtils.replaceFileSeparatorToDEFAULT(defaultFilename));
        alternateFilename = fixPageNumberToken(AnkUtils.replaceFileSeparatorToDEFAULT(alternateFilename));

        if (!defaultFilename || !alternateFilename) {
          window.alert(AnkBase.Locale('invalidPageNumberToken'));
          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
          return;
        }

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
            return s.replace(/\s+(\/[^/]+)$/, '$1');
          }

          // Windowsの場合は区切り文字を'\'にする
          filenames.push(AnkUtils.replaceFileSeparatorToSYS(repl(defaultFilename)));
          filenames.push(AnkUtils.replaceFileSeparatorToSYS(repl(alternateFilename)));
        })();

        let record = {
          member_id:  member_id,
          illust_id:  illust_id,
          title:      title,
          tags:       AnkUtils.join(tags, ' '),
          server:     context.info.illust.server,
          saved:      true,
          datetime:   AnkUtils.toSQLDateTimeString(savedDateTime),
          comment:    comment,
          version:    AnkBase.DB_DEF.VERSION,
          service_id: service_id,
        };

        let onComplete = function (local_path) {
          Task.spawn(function () {
            let caption = AnkBase.Locale('finishedDownload');
            let text = filenames[0];
            let relPath = prefInitDir ? AnkUtils.getRelativePath(local_path, prefInitDir)
                                      : AnkUtils.extractFilename(local_path);

            if (AnkBase.Prefs.get('saveHistory', true)) {
              Task.spawn(function () {
                record['local_path'] = local_path;
                record['filename'] = relPath;
                let qa = [];
                qa.push({ type:'insert', table:'histories', set:record });
                yield AnkBase.Storage.update(AnkBase.Storage.getUpdateSQLs(qa));
              }).then(null, function (e) {
                AnkUtils.dumpError(e, true);
                caption = 'Error - onComplete';
                text = e;
              });
            }

            if (AnkBase.Prefs.get('saveMeta', true))
              AnkBase.saveTextFile(destFiles.meta, metaText);

            if (AnkBase.Prefs.get('showCompletePopup', true))
              AnkBase.popupAlert(caption, text);

            AnkUtils.dump('download completed: '+images.length+' pics in '+(new Date().getTime() - start)+' msec');

            AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED);

            // たまたま開いているタブがダウンロードが完了したのと同じサイトだったならマーキング処理
            let curmod = AnkBase.currentModule;
            if (curmod && curmod.SERVICE_ID === service_id)
              curmod.markDownloaded(illust_id,true);

//            return true;

          }).then(null, function (e) {
            let s = '';
            for (let n in e) {
              s += n + ': ' + e[n] + '\n';
            }
            window.alert(s);
          });
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

        // XXX 前方で宣言済み
        destFiles = yield AnkBase.getSaveFilePath(prefInitDir, filenames, ext, useDialog, !context.in.manga, images.length, facing ? facing[facing.length-1] : undefined);
        if (!destFiles) {
          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
          return;
        }

        if (context.in.manga && !destFiles.image.path.match(/#page-number#/)) {
          // マンガ形式のダウンロード時に #page-number# の指定がない場合はエラーに
          window.alert(AnkBase.Locale('invalidPageNumberToken'));
          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
          return;
        }

        AnkBase.clearMarkedFlags();

        if (context.in.manga) {
          AnkBase.downloadFiles(destFiles.image, images, facing, ref, download, onComplete, onError);
        }
        else {
          AnkBase.downloadIllust(destFiles.image, images[0], ref, download, onComplete, onError);
        }

      }).then(null, function (e) AnkUtils.dumpError(e, true));
    }, // }}}

    /*
     * downloadCurrentImageAuto
     * 自動的にダウンロードする場合はこっちを使う
     */
    downloadCurrentImageAuto: function (module) { // {{{
      AnkBase.downloadCurrentImage(module, undefined, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
    }, // }}}

    /*
     * ダウンロード済みの表示をページに挿入する
     *    appendTo:     追加先の要素
     *    R18:          イラストはR18か？
     *    mode:         メッセージ本文　※nullの場合は削除
     */
    insertDownloadedDisplay: function (appendTo, R18, mode) { // {{{
      if (!AnkBase.Prefs.get('displayDownloaded', true))
        return;

      let doc;

      try {
        // XXX for "can't access dead object".
        doc = appendTo && appendTo.ownerDocument;
      } catch (e) {
        return;
      }

      if (!doc)
        return;

      var elm = doc.getElementById(AnkBase.DOWNLOAD_DISPLAY.ID);
      if (elm)
        elm.parentNode.removeChild(elm);

      if (!mode)
        return; // 表示削除

      let div = doc.createElement('div');
      let textNode = doc.createElement(R18 ? 'blink' : 'textnode');
      textNode.textContent = AnkBase.Locale((mode === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED && R18) ? AnkBase.DOWNLOAD_DISPLAY.USED : mode);
      div.setAttribute('style', AnkBase.Prefs.get('downloadedDisplayStyle', ''));
      div.setAttribute('id', AnkBase.DOWNLOAD_DISPLAY.ID);
      if (R18) {
        let v = AnkBase.Prefs.get('downloadedAnimationStyle', 1);
        if (v > 0)
          div.setAttribute('class', v == 1 ? 'R18' : 'R18-shake');
      }
      div.appendChild(textNode);
      if (appendTo)
        appendTo.appendChild(div);
    }, // }}}

    insertDownloadedDisplayById: function (appendTo, R18, illust_id, service_id) { // {{{
      if (!appendTo)
        return;

      Task.spawn(function () {
        let row = yield AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(illust_id, service_id));
        if (row) {
          AnkBase.insertDownloadedDisplay(
            appendTo,
            R18,
            AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED
          );
        } else if (AnkBase.isDownloading(illust_id, service_id)) { // {{{
          AnkBase.insertDownloadedDisplay(
            appendTo,
            false,
            AnkBase.DOWNLOAD_DISPLAY.DOWNLOADING
          );
        } else {
          AnkBase.insertDownloadedDisplay(
            appendTo,
            R18,
            null
          );
        } // }}}
      }).then(null, function (e) AnkUtils.dumpError(e));
    }, // }}}

    /*
     * fixFileExt
     *    file:     nsILocalFile
     *    return:   修正した時は真、変更不要な場合は偽、形式不明・例外発生の場合はnull
     * 正しい拡張子に修正する。
     */
    fixFileExt: function (file) { // {{{
      return Task.spawn(function* () {
        const reExt = /\.[^\.]+$/;
        let m = file.path.match(reExt);
        let originalExt = m && m.toString().toLowerCase();
  
        let u8header = yield OS.File.read(file.path, 10);
        let header = String.fromCharCode.apply(null, new Uint16Array(u8header));;
        let ext = (function() {
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
        })();
        if (!ext)
          throw new Error('fixFileExt: failed for unknown file type.');
  
        if (ext == originalExt)
          return false;

        yield OS.File.move(file.path, file.path.replace(reExt, ext));
  
        AnkUtils.dump('Fix file ext: ' + file.path+' -> '+ext);
        return true;
      });
    }, // }}}

    getIllustExistsQuery: function (illust_id, service_id, id) {
      const cond = 'illust_id = :illust_id and service_id = :service_id';
      return [ { id:(typeof id !== 'undefined' ? id:-1), table:'histories', cond:cond, values:{ illust_id:illust_id, service_id:service_id } } ];
    },

    getMemberExistsQuery: function (member_id, service_id, id) {
      const cond = 'id = :id and service_id = :service_id';
      return [ { id:(typeof id !== 'undefined' ? id:-1), table:'members', cond:cond, values:{ id:member_id, service_id:service_id } } ];
    },

    getFileExistsQuery: function (filename, id) {
      const cond = 'filename = :filename';
      return [ { id:(typeof id !== 'undefined' ? id:-1), table:'histories', cond:cond, values:{ filename:filename } } ];
    },

    /********************************************************************************
    * データベース統計
    ********************************************************************************/

    // FIXME 件数が多い場合、selectを分割しないとfirefoxがフリーズする
    getYourFantasy: function (top3) { // {{{
      return Task.spawn(function* () {
        function R18 (s)
          (s == 'R-18');

        function ignore (s)
          (!s || re.exec(s));

        function inc (name)
          (name && !ignore(name) && (typeof stat[name] === 'number' ? stat[name]++ : stat[name] = 1));

        const re = /^(R-18|\u30AA\u30EA\u30B8\u30CA\u30EB|c)$/i;

        top3 = top3 || 3;

        let stat = {};
        let qa = [];
        qa.push({ table:'histories', cond:'service_id = :service_id', values:{ service_id:'PXV'} });
        yield AnkBase.Storage.select(qa, null, function (row) {
          let tags = row.getResultByName('tags');
          if (tags) {
            tags = tags.split(/\s+/);
            if (tags.some(R18)) {
              tags.forEach(inc);
            }
          }
        });

        let nums = [];
        for (let [n, v] in Iterator(stat))
          if (v > 2)
            nums.push(v);

        nums.sort(function (a, b) (b - a));
        let low = nums[nums.length < top3 ? nums.length - 1 : top3 - 1];

        let table = {}, sum = 0;
        for (let [n, v] in Iterator(stat)) {
          if (v >= low) {
            table[n] = v;
            sum += v;
          }
        }

        return { table: table, sum: sum };
      }).then(null, function (e) AnkUtils.dumpError(e));
    }, // }}}

    displayYourFantasy: function (module) { // {{{
      return;

      let doc = module.curdoc;

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

    updateDatabaseVersion: function () { // {{{
      return Task.spawn(function* () {
        // version 6->7
        let ver = parseInt(AnkBase.DB_DEF.VERSION,10);
        let uver = yield AnkBase.Storage.getDatabaseVersion();
        if (uver >= ver) {
          AnkUtils.dump("database is up to date. version "+uver);
          return;
        }

        AnkUtils.dump('update database. version '+uver+' -> '+ver);

        let cond = 'service_id is null';
        let set = { service_id:'PXV', version:ver };

        let qa = [];
        qa.push({ type:'dropIndex', table:'histories', columns:['illust_id'] });
        qa.push({ type:'dropIndex', table:'members',   columns:['id'] });
        qa.push({ type:'update', table:'histories', set:set, cond:cond, values:null });
        qa.push({ type:'update', table:'members',   set:set, cond:cond, values:null });
        qa.push({ type:'SchemaVersion', SchemaVersion:ver });

        yield AnkBase.Storage.update(AnkBase.Storage.getUpdateSQLs(qa));
      });

    }, // }}}

    /********************************************************************************
    * ステータスバー
    ********************************************************************************/

    addToolbarIcon: function () {
      try {
        var firefoxnav = document.getElementById("nav-bar");
        var curSet = firefoxnav.currentSet;
        if (curSet.indexOf(AnkBase.TOOLBAR_BUTTON.ID) == -1) {
          var set = [firefoxnav.currentSet, AnkBase.TOOLBAR_BUTTON.ID].join();
          firefoxnav.setAttribute("currentset", set);
          firefoxnav.currentSet = set;
          document.persist("nav-bar", "currentset");
          try {
            BrowserToolboxCustomizeDone(true);
          }
          catch (e) { }
        }
      }
      catch (e) {
        AnkUtils.dumpError(e, true);
      }
    },

    set toolbarText (text) { // {{{
      let e = document.getElementById(AnkBase.TOOLBAR_BUTTON.TEXT_ID);
      if (e) {
        e.value = text;
        e.collapsed = text.length == 0;
      }
      return text;
    }, // }}}

    updateToolbarText: function () { // {{{
      let queued = AnkBase.livingDownloads;
      let dp = queued.length;
      let remainImages = AnkBase.downloading.images;
      queued.forEach(function (d) remainImages -= d.downloaded);
      AnkBase.toolbarText = dp ? dp+'('+remainImages+'/'+AnkBase.downloading.images+')' : '';
    }, // }}}

    changeToolbarIconEnabled: function (module, id) {
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

    changeToolbarIconReady: function (ready, id) {
      let elem = document.getElementById(id);
      if (!elem)
        return;
      elem.setAttribute('notready', !ready);
    },

    /********************************************************************************
    * スタイル
    ********************************************************************************/

    registerSheet: function (style) { // {{{
      const domains = AnkBase.siteModules.map(function (v) v.prototype.DOMAIN);

      AnkUtils.registerSheet(style || AnkBase.DEFAULT_STYLE, domains);

      // FIXME consoleに'syntax error: defaultstyle.css'が出るのを解消できたら外部ファイルにする
      /*
      AnkUtils.httpGETAsync('chrome://ankpixiv/content/defaultstyle.css').then(
        function (result) {
          AnkUtils.registerSheet(result, domains);
        },
        function (e) AnkUtils.dumpError(e,true)
      );
      */
    }, // }}}


    /********************************************************************************
    * マーキング
    ********************************************************************************/

    markDownloaded: function(IsIllust, Targets, overlay, module, node, force, ignorePref) { // {{{

      if (!AnkBase.Prefs.get('markDownloaded', false) && !ignorePref)
        return null;

      if (!force && module.marked)
        return null;

      let target = (function () {
        if (typeof node === 'string' || typeof node === 'number')
          return { node: module.curdoc, illust_id: node};

        return { node: (node ? node : module.curdoc), illust_id: undefined };
      })();

      module.marked = true;

      let boxies = [];
      let checked = [];
      Targets.forEach(function ([selector, nTrackback, targetClass]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (elm) {
            // 一度チェックしたエレメントは二度チェックしない（異なるTarget指定で同じエレメントが重複してマッチする場合があるので、先にマッチしたものを優先）
            if (checked.indexOf(elm) != -1)
              return false;

            checked.push(elm);

            let href = (elm.tagName.toLowerCase() === 'a')   ? elm.href :
                       (elm.tagName.toLowerCase() === 'img') ? elm.src :
                                                               false;
            if (href) {
              let m = IsIllust.exec(href);
              if (m)
                return [elm, m[1]];
            }
          }).
          filter(function (m) m) .
          forEach(function ([elm, id]) {
            if (!(target.illust_id && target.illust_id != id)) {
              let box = AnkUtils.trackbackParentNode(elm, nTrackback, targetClass);
              if (box && !box.classList.contains(AnkBase.DOWNLOAD_MARK.DOWNLOADED)) {
                AnkBase.markBoxNode(box, id, module, overlay);
              }
            }
          });
      });
    }, // }}}

    /*
     *    overlay:    false  従来型のダウンロードマーキング
     *                true   ダウンロード済みアイコンのオーバーレイ表示（縦座標自動設定）
     *                number ダウンロード済みアイコンのオーバーレイ表示（縦座標=top: *number*px !important）
     */
    markBoxNode: function (box, illust_id, module, overlay) { // {{{

      Task.spawn(function () {
        let row = yield AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(illust_id, module.SERVICE_ID, -1));

        AnkUtils.dump('markBoxNode: '+illust_id+', '+!!row);

        if (overlay === false) {
          // 従来形式
          let cnDownloaded  = AnkBase.DOWNLOAD_MARK.DOWNLOADED;
          let cnDownloading = AnkBase.DOWNLOAD_MARK.DOWNLOADING;

          // XXX for "can't access dead object".
          if (typeof box === 'undefined')
            return;

          if (box.classList.contains(cnDownloaded))
            return;

          if (!!row) {
            if (box.classList.contains(cnDownloading))
              box.classList.remove(cnDownloading);
            box.classList.add(cnDownloaded);
          }
          else if (AnkBase.isDownloading(illust_id, module.SERVICE_ID)) {
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
                let m = st.height.match(/(\d+(?:\.\d+)?)px/);
                if (m)
                  div.style.setProperty('top', (2-parseFloat(m[1]))+'px', 'important');
              }
            }
            box.appendChild(div);
          }

          let cnDownloaded  = AnkBase.DOWNLOAD_MARK.DOWNLOADED_OVERLAY;
          let cnDownloading = AnkBase.DOWNLOAD_MARK.DOWNLOADING_OVERLAY;

          if (box.querySelector('.'+cnDownloaded))
            return;

          if (!!row) {
            let div = box.querySelector('.'+cnDownloading);
            if (div) {
              div.classList.remove(cnDownloading);
            } else {
              div = module.curdoc.createElement('div');
              appendIcon(div);
            }
            div.classList.add(cnDownloaded);
          }
          else if (AnkBase.isDownloading(illust_id, module.SERVICE_ID)) {
            if (!box.querySelector('.'+cnDownloading)) {
              let div = module.curdoc.createElement('div');
              appendIcon(div);
              div.classList.add(cnDownloading);
            }
          }
        }
      }).then(null, function (e) AnkUtils.dumpError(e));
    }, // }}}

    clearMarkedFlags: function () {
      AnkUtils.A(window.gBrowser.mTabs).forEach(function (it) {
        let module = it.linkedBrowser.contentDocument.AnkPixivModule;
        if (module)
          module.marked = false;
      });
    },

    /********************************************************************************
    * イベント
    ********************************************************************************/

    /**
     * 起動時の初期化
     */
    onInit: function () { // {{{
      function firstRun () {
        if (AnkBase.Prefs.get('firstRun', true)) {
          AnkBase.Prefs.set('firstRun', false, 'boolean');
          return true;
        }
      }

      Task.spawn(function () {
        AnkBase.Storage = new AnkStorage(AnkBase.Prefs.get('storageFilepath', 'ankpixiv.sqlite'), AnkBase.DB_DEF.TABLES, AnkBase.DB_DEF.OPTIONS);
        // TODO Firefox35だとyieldが正しい値を返してこない
        let isOpened = yield AnkBase.Storage.openDatabase(function () {
          window.addEventListener('unload', function (e) AnkBase.Storage.closeDatabase(), false);
        });
        if (isOpened) {
          AnkBase.registerSheet();
          if (firstRun()) {
            window.addEventListener("load",  function() AnkBase.addToolbarIcon(), false);
          }
          yield AnkBase.Storage.createDatabase()
          yield AnkBase.updateDatabaseVersion();
          window.addEventListener('ankDownload', AnkBase.downloadHandler, true);
          window.addEventListener('pageshow', AnkBase.onFocus, true);
          window.addEventListener('focus', AnkBase.onFocus, true);
          setInterval(function (e) AnkBase.cleanupDownload(), AnkBase.DOWNLOAD_THREAD.CLEANUP_INTERVAL);
          AnkBase.changeToolbarIconReady.call(AnkBase, true, AnkBase.TOOLBAR_BUTTON.IMAGE_ID);
        }
      }).then(null, function (e) AnkUtils.dumpError(e, true));

    }, // }}}

    /**
     * ページを移動した・タブを開いた等のイベントハンドラ
     */
    onFocus: function (ev) { // {{{
      if (ev.type !== 'focus' && ev.type !== 'pageshow')
        return;

      let location = null;

      try {
        let doc = (function () {
          let win = ev.currentTarget;
          if (win.toString().match(/\[Object ChromeWindow\]/,'i'))
            return win.content.document;
          let doc = AnkBase.currentDoc;
          if (typeof doc !== 'undefined' && doc && doc === ev.target)
            return doc;
        })();

        if (!doc)
          return;

        location = 'location: '+doc.location;
        let curmod = (function () {
          if (doc.AnkPixivModule) {
            AnkUtils.dump('already installed: '+ev.type+', '+location);
            return doc.AnkPixivModule;
          }

          AnkUtils.dump('triggered: '+ev.type+', '+location);
          return AnkBase.installSupportedModule(doc);
        })();

        if (!curmod) {
          AnkBase.changeToolbarIconEnabled.call(AnkBase, null, AnkBase.TOOLBAR_BUTTON.IMAGE_ID);//
          AnkBase.changeToolbarIconEnabled.call(AnkBase, null, AnkBase.MENU_ITEM.ID);
          return;       // 対象外のサイト
        }
        AnkBase.changeToolbarIconEnabled.call(AnkBase, curmod, AnkBase.TOOLBAR_BUTTON.IMAGE_ID);
        AnkBase.changeToolbarIconEnabled.call(AnkBase, curmod, AnkBase.MENU_ITEM.ID);

        if (ev.type === 'focus')
          curmod.markDownloaded(); // focus当たる度にDB検索されると困るので引数なし
        else
          curmod.markDownloaded(null, ev.persisted);

        curmod.initFunctions();
      }
      catch (e) {
        AnkUtils.dumpError(e,false,location);
      }
    }, // }}}

    /**
     * ツール―バーボタンクリックのイベントハンドラ
     */
    onDownloadButtonClick: function (event) { // {{{
      event.stopPropagation();
      event.preventDefault();

      let button = (typeof event.button == 'undefined') ? 0 : event.button;
      if (button == 2) {
        AnkBase.openPrefWindow();
        return;
      }

      let curmod = AnkBase.currentModule;
      if (!curmod)
        return;

      let useDialog = AnkBase.Prefs.get('showSaveDialog', true);
      if (curmod.isDownloadable()) {
        switch(button) {
          case 0: AnkBase.downloadCurrentImage(curmod, useDialog); break;
          case 1: AnkBase.downloadCurrentImage(curmod, !useDialog); break;
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
        let curmod = AnkBase.currentModule;
        if (curmod)
          return AnkBase.downloadCurrentImage(curmod, useDialog, confirmDownloaded, debug);
      }, // }}}

      /*
       * 他拡張からAnkPixiv.rateが呼び出された時に実行する
       */
      rate: function (pt) { // {{{
        let curmod = AnkBase.currentModule;
        if (curmod)
          return curmod.setRating(pt);
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
