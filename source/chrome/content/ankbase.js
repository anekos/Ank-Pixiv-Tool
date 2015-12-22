
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/Preferences.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");
Components.utils.import("resource://gre/modules/FileUtils.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");
Components.utils.import("resource:///modules/CustomizableUI.jsm");
Components.utils.import("resource://gre/modules/Promise.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");

(function (global) {

  let AnkBase = {

    /********************************************************************************
     * モジュールのロード＆初期化
     ********************************************************************************/

    Prefs: (function () {
      AnkUtils.Prefs.prefix = 'extensions.ankpixiv';
      return AnkUtils.Prefs;
    })(),

    Locale: (function () {
      AnkUtils.Locale.properties = 'chrome://ankpixiv/locale/ankpixiv.properties';
      return AnkUtils.Locale;
    })(),

    Modules: (function () {
      const LOAD_MODULES = {
        STORAGE: 'ankstorage.js',
        VIEWER: 'ankviewer.js',
        CONTEXT: 'ankcontext.js',
        SITELIST: 'anksitelist.js'
      };

      function loadScript(m, obj) {
        try {
          AnkUtils.logStringMessage('MODULE LOAD: ' + m);
          let scope = obj || {};
          Services.scriptloader.loadSubScript('chrome://ankpixiv/content/' + m, scope, 'UTF-8');
          return scope;
        }
        catch (e) {
          Components.utils.reportError(e);
        }
      }

      return {
        Storage: (function () {
          if (LOAD_MODULES.STORAGE) {
            let m = loadScript(LOAD_MODULES.STORAGE);
            if (m && m.StorageModule)
              return m.StorageModule;
          }
        })(),

        Viewer : (function () {
          if (LOAD_MODULES.VIEWER) {
            let m = loadScript(LOAD_MODULES.VIEWER);
            if (m && m.AnkViewer)
              return m.AnkViewer;
          }
        })(),

        Context : (function () {
          if (LOAD_MODULES.CONTEXT) {
            let m = loadScript(LOAD_MODULES.CONTEXT);
            if (m && m.AnkContext)
              return m.AnkContext;
          }
        })(),

        Sites: (function () {
          var sites = [];
          if (LOAD_MODULES.SITELIST) {
            let m = loadScript(LOAD_MODULES.SITELIST);
            if (m && m.SiteModuleList) {
              m.SiteModuleList.SITES.forEach(function (smn) {
                let sm = loadScript(smn);
                if (sm && sm.SiteModule) {
                  sites.push(sm.SiteModule);
                }
              });
            }
          }
          return sites;
        })()
      }
    })(),

    /********************************************************************************
     * 定数
     ********************************************************************************/

    DB_DEF: {
      // TODO 8は欠番、7の次は9で
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
          service_id: { type:"string" }
        },
        members: {
          id: { type:"string" },
          name: { type:"string" },
          pixiv_id: { type:"string" },
          version: { type:"integer" },
          service_id: { type:"string" }
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
          ]
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
      .ank-pixiv-tool-updated {
        background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR42mNkYPjPAANMDEgANwcAMdMBB4vf9eEAAAAASUVORK5CYII=") !important;
        background-repeat: repeat-x !important;
        background-position: bottom !important;
        background-color: paleturquoise !important;
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
      UPDATED:      'updated',
      INITIALIZE:   'initialize',
      DOWNLOADING:  'downloading',
      FAILED:       'downloadFailed',
      TIMEOUT:      'downloadTimeout'
    },

    DOWNLOAD_MARK: {
      DOWNLOADED:          'ank-pixiv-tool-downloaded',
      UPDATED:             'ank-pixiv-tool-updated',
      DOWNLOADED_OVERLAY:  'ank-pixiv-tool-downloaded-overlay',
      DOWNLOADING:         'ank-pixiv-tool-downloading',
      DOWNLOADING_OVERLAY: 'ank-pixiv-tool-downloading-overlay'
    },

    TOOLBAR_BUTTON: {
      ID:    'ankpixiv-toolbar-button',
      IMAGE: 'ankpixiv-toolbar-button-image',
      TEXT:  'ankpixiv-toolbar-button-text'
    },

    MENU_ITEM: {
      ID:       'ankpixiv-menu-download'
    },

    DOWNLOAD_RETRY: {
      INTERVAL: 10*1000,
      MAX_TIMES: 3
    },

    DOWNLOAD_THREAD: {
      MAXRUNS: 1,
      CLEANUP_INTERVAL: 30*1000
    },

    FILENAME_KEY: {
      PAGE_NUMBER: "#page-number#"
    },

    FIT: {
      NONE:             0,
      IN_WINDOW_SIZE:   1,
      IN_WINDOW_HEIGHT: 2,
      IN_WINDOW_WIDTH:  3
    },

    downloading: {
      pages:  [],     // ダウンロード情報のリスト（__download）
      images: 0      // キューに載ったダウンロード対象の画像の合計枚数
    },

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    SiteModuleInstances: {},

    get currentDoc () {
      return window.gBrowser.selectedBrowser.contentDocument;
    },

    currentModule: function (doc) {
      let curdoc = doc || AnkBase.currentDoc;

      if (AnkBase.Prefs.get('installSiteModuleToDocument')) {
        try {
          return curdoc.AnkPixivModule;
        }
        catch (e) {
          Components.utils.reportError(e);
        }
        return;
      }

      AnkUtils.dump('MODULE INSTANCES: num=' + Object.keys(AnkBase.SiteModuleInstances).length);

      let curmod = null;
      let ankpixivid = (function () {
        try {
          return curdoc._ankpixivid;
        }
        catch (e) {
          //
        }
      })();
      for (let p in AnkBase.SiteModuleInstances) {
        try {
          if (AnkBase.SiteModuleInstances[p].curdoc._ankpixivid === ankpixivid)
            curmod = AnkBase.SiteModuleInstances[ankpixivid];
        }
        catch (e) {
          delete AnkBase.SiteModuleInstances[p];
        }
      }
      return curmod;
    },

    /********************************************************************************
    * モジュール関連
    ********************************************************************************/

    ankpixivid: 0,

    /**
     * サイトモジュールのインスタンスをカレントドキュメントにインストールする
     */
    installSupportedModule: function (doc) { // {{{
      for (let i=0; i<AnkBase.Modules.Sites.length; i++) {
        let module = AnkBase.Modules.Sites[i];
        if (AnkBase.isModuleEnabled(module.prototype.SERVICE_ID)) {
          if (module.prototype.isSupported(doc)) {
            AnkUtils.dump('SUPPORTED: '+doc.location.href+",\n"+Error().stack);

            // サイトモジュールが外から見えるパターン
            if (AnkBase.Prefs.get('installSiteModuleToDocument')) {
              doc.AnkPixivModule = new module(doc);
              return doc.AnkPixivModule;
            }

            // 外から見えないパターン
            ++AnkBase.ankpixivid;
            doc._ankpixivid = AnkBase.ankpixivid.toString();
            let m = new module(doc);
            AnkBase.SiteModuleInstances[doc._ankpixivid] = m;
            return m;
          }
        }
      }
    }, // }}}

    /**
     * オプションダイアログにサイトモジュールのリストを渡す
     */
    getModuleSettings: function () {
      let sets = [];
      for (let i=0; i<AnkBase.Modules.Sites.length; i++) {
        let module = AnkBase.Modules.Sites[i];
        if (!AnkBase.Prefs.get('useExperimentalModules', false) && module.prototype.EXPERIMENTAL) {
          // skip experimental module
          continue;
        }

        sets.push({
          name:         module.prototype.SITE_NAME,
          id:           module.prototype.SERVICE_ID,
          enabled:      AnkBase.isModuleEnabled(module.prototype.SERVICE_ID),
          experimental: module.prototype.EXPERIMENTAL
        });
      }
      return sets;
    },

    /**
     * サイトモジュールが有効設定になっているかどうか
     */
    isModuleEnabled: function (modid) {
      return AnkBase.Prefs.get('useSiteModule.'+modid, true);
    },

    /**
     * ページの読み込み遅延を待ってから機能をインストールする
     */
    delayFunctionInstaller: function (proc, interval, counter, siteid, funcid) {
      try {
        if (!proc()) {
          if (counter > 0) {
            AnkUtils.dump('delay installation '+funcid+': '+siteid+' remains '+counter);
            setTimeout(e => AnkBase.delayFunctionInstaller(proc, interval, counter-1, siteid, funcid), interval);
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
      window.openDialog("chrome://ankpixiv/content/options.xul", "Pref Dialog", "centerscreen,chrome,modal");
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
            let path = isFile ? file.file.path : file.filepath;
            if (yield OS.File.exists(path))
              return true;
            return yield AnkBase.filenameExists(AnkUtils.getRelativePath(path, prefInitDir));
          });
        }

        let initDirExists = yield OS.File.exists(prefInitDir);
        if (!initDirExists)
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
          onSecurityChange: function (_webProgress, _request, _state) {}
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

          yield AnkBase.makeDir(file.parent.path, { ignoreExisting:true, unixMode:0o755 });

          status = yield AnkBase.downloadTo(file, url, referer);
          if (status == 200)
            return status;

          if (times < maxTimes) {
            yield new Promise(function (resolve, reject) {
              setTimeout(() => resolve(), times * AnkBase.DOWNLOAD_RETRY.INTERVAL);
            });
          }
        }
        return status;
      });
    }, // }}}

    /*
     * downloadMultipleFiles
     *    localdir:       出力先ディレクトリ(マンガ) or ファイル(イラスト) nsilocalFile
     *    urls:           URLリスト
     *    referer:        リファラ
     *    fp:             見開きページ情報
     *    download:       ダウンロードキューエントリー
     * 複数のファイルをダウンロードする
     */
    downloadImages: function (localdir, urls, fp, referer, download) { // {{{
      return Task.spawn(function* () {

        const MAX_FILE = 1000;

        for (let index=0; index<urls.length && index<MAX_FILE ; index++) {
          let url = urls[index];
          let file = (function () {
            if (urls.length == 1)
              return localdir;

            let file = localdir.clone();
            let m = url.match(/(\.\w+)(?:$|\?)/);
            let fileExt = (m && m[1]) || '.jpg';

            let p = AnkBase.setMangaPageNumber(file.path, fileExt, index + 1, fp ? fp[index] : undefined);
            file.initWithPath(p.path);
            file.append(p.name);

            return file;
          })();

          let ref = referer && Array.isArray(referer) && referer.length > index ? referer[index] : referer;

          let status = yield AnkBase.downloadToRetryable(file, url, ref, AnkBase.DOWNLOAD_RETRY.MAX_TIMES);
          if (status != 200) {
            AnkUtils.dump('Delete invalid file. => ' + file.path);
            yield OS.File.remove(file.path).then(null).catch(e => AnkUtils.dump('Failed to delete invalid file. => ' + e));
            return status;
          }

          ++download.downloaded;
          AnkBase.updateToolbarText();

          // ファイルの拡張子の修正
          yield AnkBase.fixFileExt(file);
        }

        return 200;
      });
    }, // }}}

    /*
     * saveTextFile
     *    file:           nsILocalFile
     *    text:           String
     * テキストをローカルに保存します。
     */
    saveTextFile: function (file, text) { // {{{
      Task.spawn(function () {
        AnkUtils.dump('SAVE => ' + file.path);

        yield AnkBase.makeDir(file.parent.path, { ignoreExisting:true, unixMode:0o755 });

        let encoder = new TextEncoder();
        let array = encoder.encode(text);
        yield OS.File.writeAtomic(file.path, array, { encoding:"utf-8", tmpPath:file.path+".tmp" });
      }).then(null).catch(e => AnkUtils.dumpError(e));
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
      // 同一ページでも、表示中の状態によってダウンロードの可否が異なる場合がある
      let dw = module.isDownloadable();
      if (!dw)
        return;

      if (typeof useDialog === 'undefined')
        useDialog = AnkBase.Prefs.get('showSaveDialog', true);

      if (typeof confirmDownloaded === 'undefined')
        confirmDownloaded = AnkBase.Prefs.get('confirmExistingDownload');

      // ダウンロード中だったらやめようぜ！
      if (AnkBase.isDownloading(dw.illust_id, dw.service_id)) {
        //window.alert(AnkBase.Locale.get('alreadyDownloading'));
        return;
      }

      Task.spawn(function () {
        // ダウンロード済みかの確認
        let row = yield AnkBase.isDownloaded(dw.illust_id, dw.service_id);
        if (row) {
          if (confirmDownloaded) {
            if (!window.confirm(AnkBase.Locale.get('downloadExistingImage')))
              return;
          } else {
            return;
          }
        }

        // ダウンロード用のコンテキストの収集(contextの取得に時間がかかる場合があるのでダウンロードマークを表示しておく)
        AnkBase.insertOrMarkToAllTabs(dw.service_id, dw.illust_id, function (curmod, dw) {
          // 「情報取得中」
          if (dw)
            AnkBase.insertDownloadedDisplay(curmod.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.INITIALIZE);
        });

        module.downloadCurrentImage(useDialog, debug);
      }).then(null).catch(e => AnkUtils.dumpError(e, true));
    },

    isDownloaded: function (illust_id, service_id) {
      return AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(illust_id, service_id));
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

    createDownloadEvent: function (context, useDialog, debug) {
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
        result: undefined               // ダウンロード結果
      };
      return ev;
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
      return AnkBase.downloading.pages.filter(d => (typeof d.result === 'undefined') && d);
    },

    get zombieDownloads () {
      let curtime = new Date().getTime();
      return AnkBase.downloading.pages.filter(d => (typeof d.start !== 'undefined' && d.limit < curtime) && d);
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

              AnkBase.downloading.images -= c.info.path.image.images.length;
              AnkBase.updateToolbarText();

              let title         = c.info.illust.title;
              let member_id     = c.info.member.id;
              let member_name   = c.info.member.name || member_id;
              let pageUrl       = c.info.illust.pageUrl;
              let desc = '\n' + title + ' / ' + member_name + '\n' + pageUrl + '\n';
              let msg =
                AnkBase.Locale.get('downloadTimeout') + '\n' +
                desc;

              AnkUtils.dump(msg);

              AnkBase.insertOrMarkToAllTabs(c.SERVICE_ID, c.info.illust.id, function (curmod, dw) {
                // 「ダウンロードタイムアウト」
                if (dw)
                  AnkBase.insertDownloadedDisplay(curmod.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.TIMEOUT);
              });
            }
          });
        } else if (typeof d.start === 'undefined') {
          // add download
          let c = d.context;

          AnkBase.downloading.pages.push(d);
          AnkBase.downloading.images += c.info.path.image.images.length;
          AnkBase.updateToolbarText();

          AnkBase.insertOrMarkToAllTabs(c.SERVICE_ID, c.info.illust.id, function (curmod, dw) {
            curmod.markDownloaded(c.info.illust.id, true);
          });
        } else {
          // remove download
          if (AnkBase.findDownload(d, true)) {
            // タイムアウト関連ですでにキューから刈り取られている場合はここに入らない
            AnkBase.downloading.images -= d.context.info.path.image.images.length;
            AnkBase.updateToolbarText();
          }

          let h = d.history;
          let c = d.context;
          let rdisp = d.result;
          let r18 = (rdisp === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED) ? c.info.illust.R18 : false;
          AnkBase.insertOrMarkToAllTabs(c.SERVICE_ID, c.info.illust.id, function (curmod, dw) {
            if (dw) {
              // 「ダウンロード済み」
              AnkBase.insertDownloadedDisplay(curmod.elements.illust.downloadedDisplayParent, r18, rdisp);
              // 動作確認用
              if (AnkBase.Prefs.get('showDownloadedFilename', false)) {
                let e = curmod.elements.illust.downloadedFilenameArea;
                if (e)
                  e.textContent = '['+ c.info.path.image.images.length + ' pic]\n' + c.info.path.image.images[0] +'\n' + h.local_path;
              }
            }
          });
        }

        let queued = AnkBase.livingDownloads;
        if (queued.length == 0)
          return;   // キューが空なので終了

        let waited = queued.filter(d => (typeof d.start === 'undefined') && d);
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

        AnkBase.insertOrMarkToAllTabs(download.context.SERVICE_ID, download.context.info.illust.id, function (curmod, dw) {
          // 「ダウンロード中」
          if (dw)
            AnkBase.insertDownloadedDisplay(curmod.elements.illust.downloadedDisplayParent, false, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADING);
        });

        AnkBase.downloadExecuter(download);

      } catch (e) {
        AnkUtils.dumpError(e, true);
      }
    },

    downloadExecuter: function (download) {
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
      let member_id     = context.info.member.id;
      let member_name   = context.info.member.name || member_id;
      let pixiv_id      = context.info.member.pixivId;
      let memoized_name = null;
      let tags          = context.info.illust.tags;
      let title         = context.info.illust.title;
      let comment       = context.info.illust.comment;
      let updated       = context.info.illust.updated;
      let metaText      = context.metaText;
      let filenames     = [];
      let shortTags     = context.info.illust.shortTags;
      let service_id    = context.SERVICE_ID;
      let site_name     = getSiteName(context);
      let images        = context.info.path.image.images;
      let isFile        = images.length == 1;
      let facing        = context.info.path.image.facing;
      let ref           = context.info.path.image.referer || context.info.illust.referer;
      let pageUrl       = context.info.illust.pageUrl;
      let prefInitDir   = context.info.path.initDir || AnkBase.Prefs.get('initialDirectory') || AnkUtils.findHomeDir();

      let savedDateTime = new Date();

      function onError (responseStatus) {
        responseStatus = AnkUtils.getErrorMessage(responseStatus);
        let desc = '\n' + title + ' / ' + memoized_name + '\n' + pageUrl + '\n';
        let msg =
          AnkBase.Locale.get('downloadFailed') + '\n' +
          (responseStatus ? 'Status: ' + responseStatus + '\n' : '') +
          desc;

        window.alert(msg);
        AnkUtils.dump(msg);

        let confirmMsg =
          AnkBase.Locale.get('confirmOpenIllustrationPage') + '\n' +
          desc;

        if (window.confirm(confirmMsg))
          AnkUtils.openTab(pageUrl);

        AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
      }

      Task.spawn(function () {
        // FIXME memoized_nameの取得をここに移したため、meta.txtにmemoized_nameが記録されないようになってしまった
        // FIXME membersに重複エントリができる可能性がある。(重複削除してから)unique制約をつけるか、１トランザクション中にselect→insertするか等
        let row = yield AnkBase.Storage.exists(AnkBase.getMemberExistsQuery(download.context.info.member.id,download.context.SERVICE_ID));
        if (row) {
          memoized_name = download.context.info.member.memoizedName = row.getResultByName('name');
        }
        else {
          memoized_name = download.context.info.member.memoizedName = member_name;
          if (AnkBase.Prefs.get('saveHistory', true)) {
            let set = { id:member_id, name: member_name, pixiv_id:pixiv_id, version:AnkBase.DB_DEF.VERSION, service_id:service_id };
            let qa = [];
            qa.push({ type:'insert', table:'members', set:set });
            yield AnkBase.Storage.update(AnkBase.Storage.getUpdateSQLs(qa));
          }
        }

        function fixPageNumberToken (path) {

          let f = path.replace(/\/\s*$/, '');       // 終端はファイル名

          if (f.match(/#page-number#.*?\//))
            return;                                 // ファイル名以外でのページ番号指定は不可

          if (isFile) {
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
          window.alert(AnkBase.Locale.get('invalidPageNumberToken'));
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
            ps.forEach(([re, val]) => (s = s.replace(re, val).trim()));
            return s.replace(/\s+(\/[^/]+)$/, '$1');
          }

          // Windowsの場合は区切り文字を'\'にする
          filenames.push(AnkUtils.replaceFileSeparatorToSYS(repl(defaultFilename)));
          filenames.push(AnkUtils.replaceFileSeparatorToSYS(repl(alternateFilename)));
        })();

        // XXX 前方で宣言済み
        destFiles = yield AnkBase.getSaveFilePath(prefInitDir, filenames, ext, useDialog, isFile, images.length, facing ? facing[facing.length-1] : undefined);
        if (!destFiles) {
          AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.FAILED);
          return;
        }

        AnkBase.clearMarkedFlags();

        // ダウンロード実行
        let statusResult = yield AnkBase.downloadImages(destFiles.image, images, facing, ref, download);
        if (statusResult != 200) {
          // ダウンロード失敗
          onError(statusResult);
          return;
        }

        // ダウンロード成功
        let caption = AnkBase.Locale.get('finishedDownload');
        let text = filenames[0];
        let local_path = destFiles.image.path;
        let relPath = prefInitDir ? AnkUtils.getRelativePath(local_path, prefInitDir)
                                  : AnkUtils.extractFilename(local_path);

        if (AnkBase.Prefs.get('saveHistory', true)) {
          download.history = {
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
            local_path: local_path,
            filename:   relPath
          };
          yield Task.spawn(function () {
            let qa = [];
            qa.push({ type:'insert', table:'histories', set:download.history });
            yield AnkBase.Storage.update(AnkBase.Storage.getUpdateSQLs(qa));
          }).then(null).catch(e => AnkUtils.dumpError(e,true));
        }

        if (AnkBase.Prefs.get('saveMeta', true))
          AnkBase.saveTextFile(destFiles.meta, metaText);

        if (AnkBase.Prefs.get('showCompletePopup', true))
          AnkBase.popupAlert(caption, text);

        AnkUtils.dump('download completed: '+images.length+' pics in '+(new Date().getTime() - start)+' msec');

        AnkBase.removeDownload(download, AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED);

        // たまたま開いているタブがダウンロードが完了したのと同じサイトだったならマーキング処理
        AnkBase.insertOrMarkToAllTabs(service_id, illust_id, function (curmod) {
          curmod.markDownloaded(illust_id, true);
        });
      }).then(null).catch(function (e) { AnkUtils.dumpError(e); onError(e); });
    }, // }}}

    /*
     * downloadCurrentImageAuto
     * 自動的にダウンロードする場合はこっちを使う
     */
    downloadCurrentImageAuto: function (module) { // {{{
      AnkBase.downloadCurrentImage(module, undefined, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
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
          if (header.match(/^\x00\x00/) && header.match(/ftyp/))
            return '.mp4';
          if (header.match(/\x1A\x45\xDF\xA3/))
            return '.webm';
          if (header.match(/^PK\x03\x04/))
            return '.zip';
          if (header.match(/JFIF|^\xFF\xD8/))
            return '.jpg';
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

    makeDir: function (path, options) {
      return Task.spawn(function () {
        let file = AnkBase.newLocalFile(path);
        if (!file)
          return;

        if (file.parent) {
          if (yield OS.File.exists(file.parent.path)) {
            yield OS.File.makeDir(path, options);
            return;
          }
        }

        while (!!(file = file.parent)) {
          if (file.parent && file.exists()) {
            let opts = {};
            for (let p in options)
              opts[p] = options[p];
            opts.from = file.path;
            yield OS.File.makeDir(path, opts);
            return;
          }
        }

        throw new Error('makeDir: wrong path = '+path);
      });
    },

    getIllustExistsQuery: function (illust_id, service_id, id) {
      const cond = 'illust_id = :illust_id and service_id = :service_id';
      const opts = 'order by datetime desc';
      return [ { id:(typeof id !== 'undefined' ? id:-1), table:'histories', cond:cond, values:{ illust_id:illust_id, service_id:service_id }, opts:opts } ];
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
        function R18 (s) {
          return (s == 'R-18');
        }

        function ignore (s) {
          return (!s || re.exec(s));
        }

        function inc (name) {
          return (name && !ignore(name) && (typeof stat[name] === 'number' ? stat[name]++ : stat[name] = 1));
        }

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

        nums.sort((a, b) => (b - a));
        let low = nums[nums.length < top3 ? nums.length - 1 : top3 - 1];

        let table = {}, sum = 0;
        for (let [n, v] in Iterator(stat)) {
          if (v >= low) {
            table[n] = v;
            sum += v;
          }
        }

        return { table: table, sum: sum };
      });
    }, // }}}

    displayYourFantasy: function (module) { // {{{
      // NOT IMPLEMENTED
    }, // }}}


    /********************************************************************************
    * データベース関連
    ********************************************************************************/

    updateDatabaseVersion: function () { // {{{
      return Task.spawn(function* () {
        // version 6->7->8
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
      let e = document.getElementById(AnkBase.TOOLBAR_BUTTON.TEXT);
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
      queued.forEach(d => remainImages -= d.downloaded);
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
      const domains = AnkBase.Modules.Sites.map(v => v.prototype.DOMAIN);

      AnkUtils.registerSheet(style || AnkBase.DEFAULT_STYLE, domains);

      // FIXME consoleに'syntax error: defaultstyle.css'が出るのを解消できたら外部ファイルにする
      /*
      AnkUtils.httpGETAsync('chrome://ankpixiv/content/defaultstyle.css').then(
        function (result) {
          AnkUtils.registerSheet(result, domains);
        }
      ).catch(
        function (e) AnkUtils.dumpError(e,true)
      );
      */
    }, // }}}


    /********************************************************************************
    * マーキング
    ********************************************************************************/

    /**
     * マーキングが必要そうなタブに対してcallbackを実行する
     */
    insertOrMarkToAllTabs: function (service_id, illust_id, callback) {
      var num = window.gBrowser.browsers.length;
      for (var i = 0; i < num; i++) {
        var b = window.gBrowser.getBrowserAtIndex(i);
        try {
          let curmod = AnkBase.currentModule(b.contentDocument);
          if (curmod && curmod.SERVICE_ID === service_id) {
            let dw = curmod.isDownloadable();
            if (callback)
              callback(curmod, dw && dw.illust_id === illust_id);
          }
        } catch (e) {
          AnkUtils.dumpError(e);
        }
      }
    },

    /**
     *
     */
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
          filter(m => m) .
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
        let row = yield AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(illust_id, module.SERVICE_ID));

        //AnkUtils.dump('markBoxNode: '+illust_id+', '+!!row);

        if (overlay === false) {
          // 従来形式
          let cnDownloaded  = (function () {
            if (module.getUpdated !== undefined) {
              if (AnkBase.isUpdated(row, module.getUpdated(box)))
                return AnkBase.DOWNLOAD_MARK.UPDATED;
            }
            return AnkBase.DOWNLOAD_MARK.DOWNLOADED;
          })();
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
      }).then(null).catch(e => AnkUtils.dumpError(e));
    }, // }}}

    clearMarkedFlags: function () {
      AnkUtils.A(window.gBrowser.mTabs).forEach(function (it) {
        let module = AnkBase.currentModule(it.linkedBrowser.contentDocument);
        if (module)
          module.marked = false;
      });
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
      textNode.textContent = AnkBase.Locale.get((mode === AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED && R18) ? AnkBase.DOWNLOAD_DISPLAY.USED : mode);
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

    insertDownloadedDisplayById: function (appendTo, R18, illust_id, service_id, updated) { // {{{
      if (!appendTo)
        return;

      Task.spawn(function () {
        let row = yield AnkBase.Storage.exists(AnkBase.getIllustExistsQuery(illust_id, service_id));
        if (row) {
          AnkBase.insertDownloadedDisplay(
            appendTo,
            R18,
            AnkBase.isUpdated(row, updated) ? AnkBase.DOWNLOAD_DISPLAY.UPDATED : AnkBase.DOWNLOAD_DISPLAY.DOWNLOADED
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
      }).then(null).catch(e => AnkUtils.dumpError(e));
    }, // }}}

    isUpdated: function (row, updated) {
      if (!row || !updated)
        return;

      if (!AnkBase.Prefs.get('useDatetimeForUpdatedCheck',false) && updated.match(/^20\d{10}$/))
        return;

      // FIXME localtime->JST変換を入れる
      let datetime = row.getResultByName('datetime');
      let m = datetime && datetime.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
      let saved = m && m[1]+m[2]+m[3]+m[4]+m[5];
      return saved && saved < updated;
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

      if (AnkBase.Storage) {
        // 初期化済み
        return;
      }

      // 試験的モジュールは捨てる
      AnkBase.Modules.Sites = AnkBase.Modules.Sites.filter(function (m) {
        if (!AnkBase.Prefs.get('useExperimentalModules', false) && m.prototype.EXPERIMENTAL) {
          AnkUtils.dump('skip experimental module: '+m.prototype.SITE_NAME+', '+m.prototype.SERVICE_ID);
        } else {
          AnkUtils.dump('installed module: ' + m.prototype.SITE_NAME + ', ' + m.prototype.SERVICE_ID);
          if (AnkBase.Prefs.get('useSiteModule.' + m.prototype.SERVICE_ID) === undefined)
            AnkBase.Prefs.set('useSiteModule.' + m.prototype.SERVICE_ID, true);
          return true;
        }
      });

      let dbfile = AnkBase.Prefs.get('storageFilepath', 'ankpixiv.sqlite');

      Task.spawn(function () {
        AnkBase.Storage = new AnkBase.Modules.Storage(dbfile, AnkBase.DB_DEF.TABLES, AnkBase.DB_DEF.OPTIONS, AnkBase.Prefs.get('debugStorage', false));
        // TODO Firefox35だとyieldが正しい値を返してこない
        let isOpened = yield AnkBase.Storage.openDatabase(function () {
          window.addEventListener('unload', e => AnkBase.Storage.closeDatabase(), false);
        });
        if (isOpened) {
          AnkBase.registerSheet();
          if (firstRun()) {
            window.addEventListener("load", () => AnkBase.addToolbarIcon(), false);
          }
          yield AnkBase.Storage.createDatabase()
          yield AnkBase.updateDatabaseVersion();
          window.addEventListener('ankDownload', AnkBase.downloadHandler, true);
          window.addEventListener('pageshow', AnkBase.onFocus, true);
          window.addEventListener('focus', AnkBase.onFocus, true);
          setInterval(e => AnkBase.cleanupDownload(), AnkBase.DOWNLOAD_THREAD.CLEANUP_INTERVAL);
        }
      }).then(null).catch(function (e)  {
        AnkUtils.dumpError(e, true);
        AnkBase.changeToolbarIconReady.call(AnkBase, false, AnkBase.TOOLBAR_BUTTON.IMAGE);
      });

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
          let mod = AnkBase.currentModule(doc)
          if (mod) {
            AnkUtils.dump('already installed: '+ev.type+', '+location);
            return mod;
          }

          AnkUtils.dump('triggered: '+ev.type+', '+location);
          return AnkBase.installSupportedModule(doc);
        })();

        if (!curmod) {
          AnkBase.changeToolbarIconEnabled.call(AnkBase, null, AnkBase.TOOLBAR_BUTTON.IMAGE);//
          AnkBase.changeToolbarIconEnabled.call(AnkBase, null, AnkBase.MENU_ITEM.ID);
          return;       // 対象外のサイト
        }
        AnkBase.changeToolbarIconEnabled.call(AnkBase, curmod, AnkBase.TOOLBAR_BUTTON.IMAGE);
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

      let curmod = AnkBase.currentModule();
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
          let tab = Preferences.get('extensions.tabmix.opentabfor.bookmarks', false);
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

    onContextMenu: function (ev) {
      let curmod = AnkBase.currentModule();
      if (!curmod)
        return;

      let useDialog = AnkBase.Prefs.get('showSaveDialog', true);
      let confirmDownloaded = AnkBase.Prefs.get('confirmExistingDownload');
      return AnkBase.downloadCurrentImage(curmod, useDialog, confirmDownloaded);
    },

    /********************************************************************************
    * 外部向け
    ********************************************************************************/

    expose: {
      /*
       * 他拡張からAnkPixiv.downloadCurrentImageが呼び出された時に実行する
       */
      downloadCurrentImage: function (useDialog, confirmDownloaded, debug) { // {{{
        let curmod = AnkBase.currentModule();
        if (curmod)
          return AnkBase.downloadCurrentImage(curmod, useDialog, confirmDownloaded, debug);
      }, // }}}

      /*
       * 他拡張からAnkPixiv.rateが呼び出された時に実行する
       */
      rate: function (pt) { // {{{
        let curmod = AnkBase.currentModule();
        if (curmod)
          return curmod.setRating(pt);
      } // }}}
    }
  };

  // --------
  global["AnkBase"] = {
    Prefs: AnkBase.Prefs,
    Locale: AnkBase.Locale,
    FIT: AnkBase.FIT,

    Viewer: AnkBase.Modules.Viewer,
    Context: AnkBase.Modules.Context,

    onInit: AnkBase.onInit,
    onDownloadButtonClick: AnkBase.onDownloadButtonClick,
    onContextMenu: AnkBase.onContextMenu,
    getModuleSettings: AnkBase.getModuleSettings,

    delayFunctionInstaller: AnkBase.delayFunctionInstaller,
    markDownloaded: AnkBase.markDownloaded,
    insertDownloadedDisplayById: AnkBase.insertDownloadedDisplayById,
    downloadCurrentImageAuto: AnkBase.downloadCurrentImageAuto,
    createDownloadEvent: AnkBase.createDownloadEvent,

    expose: AnkBase.expose
  };

})(this);
