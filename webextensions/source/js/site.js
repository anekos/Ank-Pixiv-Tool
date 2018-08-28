"use strict";

class AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    this.SITE_ID = null;
    this.ALT_SITE_ID = null;

    this.USE_CONTEXT_CACHE = true;

    this.prefs = null;

    this.elements = null;
    this.contextCache = null;

    this.executed = {
      'displayDownloaded': 0,
      'markDownloaded': 0     // markingを行った最終時刻（キューインや保存完了の時刻と比較する）
    };

    this.FUNC_INST_RETRY_VALUE = {
      'max': 30,
      'wait': 1000
    };

    this.GET_CONTEXT = {
      'PATH': 0x01,
      'ILLUST': 0x02,
      'MEMBER': 0x04,
      'ALL': 0x07
    }
  }

  /**
   * 初期化
   * @returns {Promise}
   */
  start () {

    let applyPrefsChange = () => {
      let applySitePrefs = (global, local) => {
        this.prefs.site[global] = this.prefs[global] && this.prefs.site[local];
      };

      logger.setLevel(this.prefs.logLevel);

      applySitePrefs('largeOnMiddle', 'useViewer');
      applySitePrefs('downloadWhenClickMiddle', 'useAutoDownload');
      applySitePrefs('downloadWhenNice', 'useAutoDownload');
      applySitePrefs('displayDownloaded', 'useDisplayDownloaded');
      applySitePrefs('markDownloaded', 'useMarkDownloaded');

      this.prefs.useImagePrefetch = this.prefs.useImagePrefetch && ! IS_FIREFOX;
    };

    return (async () => {
      this.prefs = await AnkPrefs.restore(OPTION_DEFAULT);

      logger.setLevel(this.prefs.logLevel);

      this.prefs.site = this.prefs.siteModules[this.SITE_ID];
      if (!this.prefs.site) {
        logger.error('INVALID SITE MODULE:', this.SITE_ID);
        return Promise.reject(new Error('INVALID SITE MODULE'));
      }
      if (!this.prefs.site.enabled) {
        logger.info('DISABLED SITE MODULE:', this.SITE_ID);
        return;
      }
      if (!this.prefs.useExperimentalModule && this.prefs.site.experimental) {
        logger.info('DISABLED EXPERIMENTAL MODULE:', this.SITE_ID);
        return;
      }

      if (Object.keys(this.prefs.site._mod_selector).length) {
        let selector_overrode = this.prefs.selector_overrode || "3.0.0";
        if (AnkUtils.compareVersion(this.prefs.version, selector_overrode) > 0) {
          // 過去のバージョンでインポートしたセレクタ上書き設定は無視する
          logger.info("IGNORE override_selector:", selector_overrode);
          this.prefs.site._mod_selector = {};
        }
        else {
          logger.info("USE override_selector:", selector_overrode);
        }
      }

      logger.info('SITE MODULE INSTALLED:', this.SITE_ID, document.location.href);

      AnkPrefs.setAutoApply(() => applyPrefsChange());
      applyPrefsChange();

      this.elements = this.getElements(document);

      this.initMessageListener();
      this.initFocusListener();
      this.installFunctions();
    })();
  }

  /**
   * AJAX等でコンテンツが入れ替わった時に情報をリセットする (DOM情報)
   */
  resetElements () {
    logger.info('RESET ELEMENTS:', this.SITE_ID, document.location.href);

    AnkViewer.reset();

    this.elements = this.getElements(document);
  }

  /**
   * AJAX等でコンテンツが入れ替わった時に情報をリセットする (内部状態)
   */
  resetCondition () {
    logger.info('RESET CONDITION:', this.SITE_ID, document.location.href);

    this.contextCache = null;

    this.executed = {
      'displayDownloaded': 0,
      'markDownloaded': 0
    };
  }

  /**
   * focusイベントリスナーの定義
   */
  initFocusListener () {
    window.addEventListener('focus', () => this.onFocusHandler())
  }

  /**
   * メッセージリスナーの定義
   */
  initMessageListener () {
    let execMessage = (message, sender) => {
      switch (message.type) {
        case 'AnkPixiv.Download':
          return this.downloadCurrentImage();
        case 'AnkPixiv.Viewer':
          return this.openViewer(message.data);
        case 'AnkPixiv.Nice!':
          return this.setNice();
      }

      if (!sender) {
        return;
      }

      switch (message.type) {
        case 'AnkPixiv.Display':
          return this.forceDisplayAndMarkDownloaded();
      }
    };

    // web page から
    window.addEventListener('message', (e) => {
      if (e.source != window) {
        return;
      }

      let message = e.data;
      if (/^AnkPixiv\./.test(message.type)) {
        execMessage(message);
      }
    });

    // background から
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (/^AnkPixiv\./.test(message.type)) {
        execMessage(message, sender);
      }

      sendResponse();
      return false;
    });
  }

  /**
   * ダウンロードの実行
   * @param dw
   */
  executeDownload (dw) {

    // ファイル名定義を実際のファイル名に変換する
    let getFileName = (info) => {
      let name = ((c) => {
        let ii = c.info.illust;
        let im = c.info.member;
        let pos = AnkUtils.getDateData(new Date(ii.posted || ii.saved));
        let sav = AnkUtils.getDateData(new Date(ii.saved));
        return [
          {'re': /\?site-name\?/g, 'val': c.siteName},
          {'re': /\?illust-id\?/g, 'val': ii.id},
          {'re': /\?title\?/g, 'val': ii.title.substring(0, 50)},
          {'re': /\?tags\?/g, 'val': ii.tags.join(' ')},
          {'re': /\?short-tags\?/g, 'val': ii.tags.filter((v) => v.length <= this.prefs.shortTagsMaxLength).join(' ')},
          {'re': /\?tools\?/g, 'val': ii.tools},
          {'re': /\?illust-year\?/g, 'val': pos.year},
          {'re': /\?illust-year2\?/g, 'val': pos.year.slice(2, 4)},
          {'re': /\?illust-month\?/g, 'val': pos.month},
          {'re': /\?illust-day\?/g, 'val': pos.day},
          {'re': /\?illust-hour\?/g, 'val': pos.hour},
          {'re': /\?illust-minute\?/g, 'val': pos.minute},
          {'re': /\?saved-year\?/g, 'val': sav.year},
          {'re': /\?saved-year2\?/g, 'val': sav.year.slice(2, 4)},
          {'re': /\?saved-month\?/g, 'val': sav.month},
          {'re': /\?saved-day\?/g, 'val': sav.day},
          {'re': /\?saved-hour\?/g, 'val': sav.hour},
          {'re': /\?saved-minute\?/g, 'val': sav.minute},
          {'re': /\?member-id\?/g, 'val': im.id},
          {'re': /\?pixiv-id\?/g, 'val': im.pixiv_id},
          {'re': /\?member-name\?/g, 'val': im.name},
          {'re': /\?memor?ized-name\?/g, 'val': im.memoized_name}
        ].reduce((s, v) => {
          try {
            // TODO dir//file みたいな感じで File Separator が複数連続していると FILE_NAME_TOO_LONG 例外が発生するので注意。あと .. もNG
            return s.replace(v.re, AnkUtils.fixFilename((v.val && v.val.toString() || '-')).toString());
          }
          catch (e) {
            logger.warn(v.re.toString(), 'is not found:', e.toString());
          }
          return s;
        }, this.prefs.defaultFilename);
      })(info.context);

      //  . で始まるファイル名 or フォルダ名が含まれていると invalid filename になる (#160)
      name = name.replace(/^\./, '_');
      name = name.replace(/([/\\])\./g, '$1_');

      // ファイル名の長さの調整 (#165)
      if (IS_FIREFOX && IS_WINDOWS) {
        let basename = name.replace(/^.*[\\\/]/, '');
        name = name.slice(0, -basename.length) + basename.slice(0, this.prefs.maxFilenameLength);
      }

      if (!this.prefs.overwriteExistingDownload && info.age > 1) {
        // ２回目の保存からは世代情報を付加（windows風に(1)から）
        name += ' (' + (info.age-1) + ')';
      }

      let p = (() => {
        if (info.pages == 1) {
          // 一枚絵（マンガ形式でも一枚ならこちら）
          return name;
        }

        // 複数画像
        if (info.meta) {
          // 場合のメタデータファイル名は 'meta.json' 固定
          return [name, 'meta'].join(this.prefs.mangaImagesSaveToFolder ? '/' : ' - ');
        }

        let pageNo = (info.facingNo ? AnkUtils.zeroPad(info.facingNo, info.pageDigits) + '_' : '') + AnkUtils.zeroPad(info.pageNo, info.pageDigits);
        return [name, pageNo].join(this.prefs.mangaImagesSaveToFolder ? '/' : ' - ');
      })();

      return [p, info.ext].join('.');
    };

    // 画像URLと保存するファイル名の対を作る
    let getImgData = (context, path, age) => {
      let data = path.map((p, i) => {
        let filename = getFileName({
          'context': context,
          'pages': path.length,
          'pageDigits': Math.floor(Math.log10(path.length)) + 1,
          'pageNo': i + 1,
          'facingNo': p.facingNo,
          'age': age,
          'ext': AnkUtils.getFileExt(p.src) || 'jpg'
        });

        return {
          'filename': filename,
          'url': p.src,
          'headers': p.referrer && [{'name': 'Referer', 'value': p.referrer}] || []
        };
      });

      return data;
    };

    // メタデータの作成
    let getMetaData = (context, path, age) => {
      let filename = getFileName({
        'context': context,
        'pages': path.length,
        'age': age,
        'ext': 'json',
        'meta': true
      });

      let text = (() => {
        let meta = {
          'info': context.info,
        };
        if (this.prefs.saveMetaWithPath) {
          meta.info.path = path;
        }
        return JSON.stringify(meta, null, ' ');
      })();

      return {
        'filename': filename,
        'data': text
      };
    };

    // 履歴のデータの作成
    let getHistData = (context, filename, age) => {
      let data = {
        'service_id': context.service_id,
        'illust_id': context.info.illust.id,
        'member_id': context.info.member.id,
        'last_saved': context.info.illust.saved,
        'age': age
      };

      if (this.prefs.saveHistoryWithDetails) {
        // 履歴に作品の詳細情報を含める
        data.detail = {
          'title': context.info.illust.title,
          'R18': context.info.illust.R18,
          'tags': context.info.illust.tags,
          'filename': filename
        };
      }

      return data;
    };

    //
    let saveAll = (targets, hist_data) => {
      if (this.prefs.xhrFromBackgroundPage) {
        // background script側で XHR を使う場合
        return this.requestExecuteAddToDownloadQueue(targets, hist_data);
      }
      else {
        // contents script側で XHR を使う場合
        // FIXME objurlのcleanupが必要
        return AnkUtils.downloadTargets(targets, this.requestExecuteSaveObject, this.prefs.xhrTimeout)
          .then(() => {
            return this.requestUpdateDownloadHistory(hist_data);
          });
      }
    };

    if (dw.status) {
      if (dw.autoDownload && (dw.status.last_saved || dw.status.downloading)) {
        // 中画像クリックなどの自動ダウンロードの場合、ダウンロード済み or ダウンロード中なら無視する
        return;
      }

      if (this.prefs.confirmExistingDownload && dw.status.age >= 1) {
        let msg = chrome.i18n.getMessage('msg_downloadExistingImage');
        let result = confirm(msg);
        if (!result) {
          this.displayDownloaded({'inProgress': false}).then();
          return;
        }
      }
    }

    // サムネ画像かオリジナル画像かの選択
    let path = this.prefs.downloadOriginalSize && dw.context.path.original || dw.context.path.thumbnail;

    // 保存世代
    let age = dw.status ? dw.status.age+1 : 1;

    // 保存時刻
    let saved = AnkUtils.getDateData(new Date());
    dw.start = saved.timestamp;
    dw.context.info.illust.saved = saved.timestamp;
    dw.context.info.illust.savedYMD = saved.ymd;

    let targets = getImgData(dw.context, path, age);
    if (this.prefs.saveMeta) {
      let meta_data = getMetaData(dw.context, path, age);
      targets.push(meta_data);
    }

    let hist_data = getHistData(dw.context, targets[0].filename, age);

    // FIXME 戻り値が滅茶苦茶な状態なので直して！！

    saveAll(targets, hist_data)
      .catch((e) => {
        logger.error('download error:', e);
      });
  }

  /**
   * backgroundにサイトの最終更新時刻を問い合わせる
   * @returns {Promise}
   */
  requestGetSiteChanged () {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getSiteChanged',
          'data':{
            'service_id': this.ALT_SITE_ID || this.SITE_ID
          }
        },
        (result) => resolve(result)
      );
    });
  }

  /**
   * backgroundにユーザ情報を問い合わせる
   * - 存在しない場合は追加する
   * @param member_id
   * @param member_name
   * @returns {Promise}
   */
  requestGetMemberInfo (member_id, member_name) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getMemberInfo',
          'data':{
            'service_id': this.ALT_SITE_ID || this.SITE_ID,
            'member_id': member_id,
            'member_name': member_name
          }
        },
        (result) => resolve(result)
      );
    });
  }

  /**
   * backgroundに作品のダウンロード状態を問い合わせる
   * @param illust_id
   * @param ignore_cache
   * @returns {Promise}
   */
  requestGetDownloadStatus (illust_id, ignore_cache) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getDownloadStatus',
          'data':{
            'service_id': this.ALT_SITE_ID || this.SITE_ID,
            'illust_id': illust_id,
            'ignore_cache': ignore_cache
          }
        },
        (result) => resolve(result)
      );
    });
  }

  /**
   *
   * @param hist_data
   * @returns {Promise}
   */
  requestUpdateDownloadHistory (hist_data) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.updateDownloadHistory',
          'data':{
            'hist_data': hist_data
          }
        },
        (result) => resolve(result)
      );
    });
  }

  /**
   * backgroundにデータのファイルへの保存を依頼する
   * @param info
   * @returns {Promise}
   */
  requestExecuteSaveObject (info) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Execute.saveObject',
          'data': {
            'info': info
          }
        },
        (result) => {
          if (result.hasOwnProperty('error')) {
            return reject(result.error);
          }

          resolve(result.result);
        }
      );
    });
  }

  /**
   *
   * @param targets
   * @param hist_data
   * @returns {Promise}
   */
  requestExecuteAddToDownloadQueue (targets, hist_data) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Execute.addToDownloadQueue',
          'data': {
            'targets': targets,
            'hist_data': hist_data
          }
        },
        (result) => {
          if (result && result.hasOwnProperty('error')) {
            return reject(result.error);
          }

          resolve(result && result.result);
        }
      );
    });
  }

  /**
   * 投稿日時の解析の共通部分
   * @param callback
   * @returns {*}
   */
  getPosted (callback) {
    let posted = callback();
    if (posted.fault) {
      if (!this.prefs.ignoreWrongDatetimeFormat) {
        // 解析に失敗したので終了
        let msg = chrome.i18n.getMessage('msg_cannotDecodeDatetime');
        alert(msg);
        throw new Error(msg);
      }
      if (this.prefs.warnWrongDatetimeFormat) {
        // 解析失敗の警告
        alert(chrome.i18n.getMessage('msg_warnWrongDatetime'));
      }
    }
    return posted;
  }

  /**
   * ダウンロード情報をまとめる
   * @param elm
   * @param mode
   * @returns {Promise.<*>}
   */
  async getDownloadContext (elm, mode) {

    // 取得がpath/illust/memberで分かれているのは、path@pixivやpath@nicoが要XHRだが、pathが不要な場合(displayDownloaded)に無駄なXHRを行わないようにするため
    // しかしillust@pixivも要XHRになったので再検討が必要

    mode = mode || this.GET_CONTEXT.ALL;

    if (this.contextCache) {
      if ((this.contextCache.status & mode) == mode) {
        // 必要な情報がそろっているなら取得済みの情報を返す
        return this.contextCache;
      }

      // 取得済みの情報は再度指定しない
      mode = ((0xff ^ this.contextCache.status) & 0xff) & mode;
    }

    return this.getAnyContext(elm, mode).then((result) => {
      let context = this.contextCache || {
        'status': 0,
        'downloadable': false,
        'service_id': this.ALT_SITE_ID || this.SITE_ID,
        'siteName': this.prefs.site.folder,
        'path': undefined,
        'info': {
          'illust': undefined,
          'member': undefined
        }
      };

      context.path = context.path || result.path;
      context.info.illust = context.info.illust || result.illust;
      context.info.member = context.info.member || result.member;

      context.status = (context.path ? this.GET_CONTEXT.PATH : 0) +
        (context.info.illust ? this.GET_CONTEXT.ILLUST : 0) +
        (context.info.member ? this.GET_CONTEXT.MEMBER : 0);

      context.downloadable =  (context.status & this.GET_CONTEXT.ALL) == this.GET_CONTEXT.ALL;

      logger.info('CONTEXT: ', context);

      if (this.USE_CONTEXT_CACHE) {
        this.contextCache = context;
      }

      return context;
    });
  }

  /**
   * ダウンロードの実行
   * @param opts
   */
  downloadCurrentImage (opts) {
    if (!this.inIllustPage()) {
      return;
    }

    (async () => {

      await this.displayDownloaded({'inProgress': true});

      opts = opts || {};

      let context = await this.getDownloadContext(this.elements, this.GET_CONTEXT.ALL);
      if (!context) {
        // コンテキストが集まらない（ダウンロード可能な状態になっていない）
        let msg = chrome.i18n.getMessage('msg_notReady');
        logger.warn(new Error(msg));
        await this.displayDownloaded({'inProgress': false});
        return false;
      }

      if (!context.downloadable) {
        // 作品情報が見つからない
        let msg = chrome.i18n.getMessage('msg_cannotFindImages');
        logger.error(new Error(msg));
        alert(msg);
        await this.displayDownloaded({'inProgress': false});
        return false;
      }

      let status = await this.requestGetDownloadStatus(context.info.illust.id, true);

      let member = await this.requestGetMemberInfo(context.info.member.id, context.info.member.name);
      context.info.member.memoized_name = member.name;

      this.executeDownload({'status': status, 'context': context, 'autoDownload': opts.autoDownload});

    })().catch((e) => logger.error(e));
  }

  /**
   * focusイベントのハンドラ
   */
  onFocusHandler () {
    if (document.readyState !== "complete") {
      return;
    }
    this.forceDisplayAndMarkDownloaded();
  }

  /**
   * 保存済み表示の強制実行
   */
  forceDisplayAndMarkDownloaded () {
    if (this.inIllustPage()) {
      this.displayDownloaded({'force': true}).then();
    }
    this.markDownloaded({'force': true}).then();
  }

  /**
   * 作品ページに「保存済み」メッセージを表示する（DOM操作部）
   * @param appendTo
   * @param opts
   * @private
   */
  _insertDownloadedDisplay (appendTo, opts) {

    let display = appendTo.querySelector('#ank-pixiv-downloaded-display');
    if (!display) {
      display = appendTo.ownerDocument.createElement('div');
      display.setAttribute('id', 'ank-pixiv-downloaded-display');
      [
        'downloaded',
        'downloaded_used',
        'downloaded_updated',
        'download_inprogress',
        'download_wait',
        'download_run',
        'download_failed',
        'download_timeout'
      ].forEach((k) => {
        display.setAttribute('data-text-'+k, chrome.i18n.getMessage('msg_'+k));
      });
      appendTo.appendChild(display);
    }

    if (opts.illustId) {
      let displayedId = display.getAttribute('data-illust-id');
      if (displayedId != opts.illustId) {
        display.className = '';
        display.setAttribute('data-illust-id', opts.illustId)
      }
    }

    if (opts.inProgress) {
      display.classList.add('inprogress');
    }
    else {
      display.classList.remove('inprogress');
    }
    if (opts.hasOwnProperty('inProgress')) {
      return;
    }

    let cls = (() => {
      if (!opts.status) {
        // 状態なし
        return;
      }

      if (opts.status.failed) {
        // 最近失敗したようだ
        return ['failed'];
      }

      if (opts.status.downloading) {
        // ダウンロード中
        return opts.status.running ? ['run'] : ['wait'];
      }

      if (opts.status.last_saved) {
        // 履歴に存在する
        if (opts.updated) {
          return ['updated']
        }

        if (!opts.R18) {
          return ['done'];
        }

        if (!this.prefs.downloadedAnimationStyle) {
          return ['R18'];
        }

        return ['R18', this.prefs.downloadedAnimationStyle == 1 ? 'shake' : 'slidein'];
      }
    })();

    if (!cls) {
      return;
    }

    if (!display.classList.contains(cls[0])) {
      display.setAttribute('class', '');
      display.classList.add.apply(display.classList, cls);
    }
  }

  /**
   * 作品ページに「保存済み」メッセージを表示する
   * @param opts
   * @returns {Promise.<boolean>}
   */
  async displayDownloaded (opts) {
    if (!this.prefs.site.displayDownloaded) {
      return true;
    }

    opts = opts || {};

    let elm = opts.getElms && opts.getElms() || this.elements;

    let appendTo = elm.misc.downloadedDisplayParent;
    if (!appendTo) {
      return false;
    }

    if (opts.hasOwnProperty('inProgress')) {
      // ダウンロードイベントトリガー時に強制表示
      this._insertDownloadedDisplay(appendTo, opts);
      return true;
    }

    if (this.executed.displayDownloaded && !opts.force) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    let changed = await this.requestGetSiteChanged().then((siteChanged) => {
      if (this.executed.displayDownloaded > siteChanged) {
        logger.debug('skip display downloaded');
        return;
      }

      return true;
    });
    if (!changed) {
      // 前回実行時から変化なし
      return true;
    }

    this.executed.displayDownloaded = new Date().getTime();

    logger.debug('exec display downloaded');

    let context = await this.getDownloadContext(elm, this.GET_CONTEXT.ILLUST);
    if (!context) {
      return false;
    }

    let illustContext = context.info.illust;

    this.requestGetDownloadStatus(illustContext.id).then((status) => {
      this._insertDownloadedDisplay(appendTo, {
        'illustId': illustContext.id,
        'status': status,
        'R18': illustContext.R18,
        'updated': (() => {
          if (status) {
            if (status.last_saved && illustContext.updated &&  (illustContext.updated > status.last_saved)) {
              logger.debug('updated:', new Date(illustContext.updated), '>', new Date(status.last_saved));
              return true;
            }
          }
        })()
      });
    });

    return true;
  }

  /**
   * サムネイルにダウンロード済みマークを付ける（DOM操作部）
   * @param node
   * @param opts
   * @private
   */
  _insertDownloadedMark (node, opts) {
    (async () => {

      let boxes = {};

      // チェック対象のサムネイルを抽出する
      opts.queries.forEach((t) => {
        Array.prototype.map.call(node.querySelectorAll(t.q), (e) => {
          let url = ((tagName) => {
            if (tagName === 'a') {
              return e.href;
            }
            if (tagName === 'img') {
              return e.src;
            }
          })(e.tagName.toLowerCase());

          let illust_id = opts.getId(url);
          if (!illust_id || (opts.illust_id && opts.illust_id != illust_id)) {
            // IDが見つからないか、ID指定があって一致しない場合
            return;
          }

          let box = (() => {
            if (t.n < 0) {
              // 子にくだりおりる
              if (t.r) {
                // クエリ指定
                let box = e.querySelector(t.r);
                if (box) {
                  return box;
                }
              }
              else if (t.c) {
                // クラス名指定
                let box = e.getElementsByClassName(t.c)[0];
                if (box) {
                  return box;
                }
              }
              // 指定なし or 見つからなければ最初の子
              return e.firstChild
            }
            else {
              // 親にさかのぼる
              return AnkUtils.trackbackParentNode(e, t.n, t.c);
            }
          })();

          if (!box) {
            return;
          }

          boxes[illust_id] = boxes[illust_id] || [];

          // クエリの結果が重複する場合があるので排除する
          if (!boxes[illust_id].find((b) => b.box === box)) {
            boxes[illust_id].push({
              'box': box,
              'datetime': opts.getLastUpdate && opts.getLastUpdate(box),
              'method': t.m || opts.method
            });
          }
        });
      });

      // ダウンロード状態を調べて反映する（リソースを占有しないよう、一定数ごとにsleepする）
      let statuses = await this.requestGetDownloadStatus(Object.keys(boxes));
      if (statuses) {
        const S_STEP = 10;
        let slen = statuses.length;
        for (let sa=0; sa < slen; sa+=S_STEP) {
          statuses.slice(sa, sa+S_STEP).forEach((s) => {
            boxes[s.illust_id].forEach((e) => {
              let cls = (() => {
                // s.failed は見る必要がない
                if (s.downloading) {
                  return 'ank-pixiv-downloading';
                }
                if (s.downloading) {
                  return 'ank-pixiv-downloading';
                }
                if (s.last_saved) {
                  if (e.datetime > s.last_saved) {
                    return 'ank-pixiv-updated';
                  }

                  return 'ank-pixiv-downloaded';
                }
              })();
              if (cls && !e.box.classList.contains(cls)) {
                e.box.classList.remove('ank-pixiv-downloading', 'ank-pixiv-updated', 'ank-pixiv-downloaded');
                e.box.classList.add(cls);
                if (e.method === 'overlay') {
                  e.box.classList.add('ank-pixiv-mark-overlay');
                }
                else if (e.method === 'border') {
                  e.box.classList.add('ank-pixiv-mark-border');
                }
                else {
                  e.box.classList.add('ank-pixiv-mark-background');
                }
              }
            });
          });

          if (sa+S_STEP < slen) {
            await AnkUtils.sleep(100);
          }
        }
      }
    })();
  }

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @param opts
   * @param siteSpecs
   * @returns {Promise.<boolean>}
   */
  async markDownloaded (opts) {
    if (!this.prefs.site.markDownloaded) {
      return true;
    }

    let markRule = this.getMarkingRules();
    if (!markRule) {
      return true;
    }

    opts = opts || {};

    if (this.executed.markDownloaded && !opts.force) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    if (!opts.node) {
      // ページ単位のチェック（＝node決め打ちでないチェック）の場合は前回チェック時刻と比較を行い、前回以降にサイトの更新が発生していなければ再度のチェックはしない
      let changed = await this.requestGetSiteChanged().then((siteChanged) => {
        if (this.executed.markDownloaded > siteChanged) {
          logger.debug('skip mark downloaded');
          return;
        }

        return true;
      });
      if (!changed) {
        // 前回実行時から変化なし
        return true;
      }

      /*
      if (!opts.force) {
        // 強制時は実行時刻を更新しない
        this.executed.markDownloaded = new Date().getTime();
      }
      */
      this.executed.markDownloaded = new Date().getTime();
    }

    logger.debug('exec mark downloaded');

    let node = markRule.node || this.elements.doc;

    this._insertDownloadedMark(node, {
      'illust_id': opts.illust_id,
      'queries': markRule.queries,
      'getId': markRule.getId,
      'getLastUpdate': markRule.getLastUpdate,
      'method': markRule.method,
      'ignorePref': false
    });

    return true;
  }

  /**
   * ビューアを開く
   * @param opts
   */
  openViewer (opts) {
    if (!this.prefs.site.largeOnMiddle) {
      return;
    }

    let cmd = opts && opts.cmd || 'open';
    switch (cmd) {
      case 'open':
        this.getDownloadContext(this.elements, this.GET_CONTEXT.PATH).then((context) => {
          if (!context) {
            logger.error(new Error('viewer not ready'));
            return;
          }
          AnkViewer.open({'prefs': this.prefs, 'path': context.path});
        }).catch((e) => logger.error(e));
        break;
      case 'close':
        AnkViewer.close();
        break;
      case 'fit':
        try {
          AnkViewer.fit(parseInt(opts.mode, 10));
        }
        catch (e) {}
        break;
      case 'prev':
        AnkViewer.setPage({'prevPage': true});
        break;
      case 'next':
        AnkViewer.setPage({'nextPage': true});
        break;
    }
  };

  /**
   * セレクタ定義を上書きする
   * @param selector_items
   * @param mod_selector
   * @returns {{}}
   */
  attachSelectorOverride (o, selector_items, mod_selector) {

    const S_OR_ALL = ['s', 'ALL'];

    let dig = (o, selector_items, mod_selector) => {
      Object.keys(selector_items).forEach((k) => {
        let item = selector_items[k];
        if (item === undefined) {
          throw new Error('invalid selector format');
        }

        if (item === null) {
          // パターンA （セレクタの書き換えだけでは対処できないパターン）
          o[k] = null;
          return;
        }

        o[k] = o[k] || {};

        let mods = mod_selector && mod_selector[k] || {};

        let typ = S_OR_ALL.find((p) => item.hasOwnProperty(p));
        if (typ) {
          // パターンB
          if (!Array.isArray(mods[typ]) || typ == 's') {
            // 's'&'ALL'で値が文字列 or 's'で値が配列
            o[k][typ] = mods[typ] || item[typ];
          }
          else {
            // 上記以外は mods は使わない
            o[k][typ] = item[typ];
          }
        }
        else {
          // パターンC
          this.attachSelectorOverride(o[k], item, mods);
        }
      });

      return o;
    };

    return dig(o || {}, selector_items, mod_selector || this.prefs.site._mod_selector);
  }

  /**
   * セレクタ定義を展開する
   * @param o
   * @param items
   * @param doc
   * @returns {*}
   */
  initSelectors (o, items, doc) {

    const S_OR_ALL = ['s', 'ALL'];

    Object.keys(items).forEach((k) => {
      let item = items[k];
      if (item === undefined) {
        throw new Error('invalid selector format');
      }

      if (item === null) {
        // パターンA （セレクタの書き換えだけでは対処できないパターン）
        o[k] = null;
        return;
      }

      o[k] = o[k] || {};

      let typ = S_OR_ALL.find((p) => item.hasOwnProperty(p));
      if (typ) {
        // パターンB
        let s = item[typ];
        if (typ == 's') {
          if (!Array.isArray(s)) {
            // 決め打ち
            Object.defineProperty(o, k, {
              'get': function () {
                return doc.querySelector(s)
              }
            });
            return;
          }
          else {
            // 複数候補
            Object.defineProperty(o, k, {
              'get': function () {
                for (let i = 0; i < s.length; i++) {
                  let o = doc.querySelector(s[i]);
                  if (o) {
                    return o;
                  }
                }
              }
            });
            return;
          }
        }
        else {
          if (!Array.isArray(s)) {
            // ALLの場合は決め打ちのみ
            Object.defineProperty(o, k, {
              'get': function () {
                return doc.querySelectorAll(s)
              }
            });
            return;
          }
        }

        throw new Error('invalid selector format');
      }

      // パターンC
      this.initSelectors(o[k], item, doc);
    });

    return o;
  }

  /*
   * 以下はサイト別スクリプトの中で実装が必要なもの
   */

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  getElements (doc) {}

  /**
   * 画像ダウンロード可能なページに居るか？
   */
  inIllustPage () {}

  /**
   * ダウンロード情報（メンバー情報）の取得
   * @param elm
   * @param mode : mode指定で最低限欲しい情報を指定するが、低コストで返せる場合は指定されていない情報も返却してよい
   * @returns {Promise.<void>}
   */
  async getAnyContext (elm, mode) {}

  /**
   * サムネイルにダウンロード済みマークを付けるサイト別のルールを取得する
   */
  getMarkingRules () {}

  /**
   * いいね！する
   */
  setNice () {}

  /**
   * ページに機能をインストールする
   */
  installFunctions () {}
}
