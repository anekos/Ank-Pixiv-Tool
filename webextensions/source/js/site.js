"use strict";

{

  /**
   * コンストラクタ
   * @constructor
   */
  var AnkSite = function () {
    if (this.constructor === AnkSite) {
      throw new Error("Can't instantiate abstract class!");
    }

    this.SITE_ID = null;

    this.prefs = null;

    this.elements = null;
    this.collectedContext = null;

    this.executed = {
      'displayDownloaded': false,
      'markDownloaded': false
    };
    this.marked = 0;        // markingを行った最終時刻（キューインや保存完了の時刻と比較する）

  };

  /**
   * 初期化
   */
  AnkSite.prototype.start = function () {

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

      logger.info('SITE MODULE INSTALLED:', this.SITE_ID, document.location.href);

      AnkPrefs.setAutoApply(() => applyPrefsChange());
      applyPrefsChange();

      this.elements = this.getElements(document);

      this.initMessageListener();
      this.initFocusListener();
      this.installFunctions();
    })();
  };

  /**
   * focusイベントリスナーの定義
   */
  AnkSite.prototype.initFocusListener = function () {
    window.addEventListener('focus', () => this.onFocusHandler())
  };

  /**
   * メッセージリスナーの定義
   */
  AnkSite.prototype.initMessageListener = function () {

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
          return this.onFocusHandler();
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
  };

  /**
   * ダウンロードの実行
   */
  AnkSite.prototype.executeDownload = function (dw) {

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
            return s.replace(v.re, AnkUtils.fixFilename((v.val || '-')).toString());
          }
          catch (e) {
            logger.warn(v.re + ' is not found');
          }
          return s;
        }, this.prefs.defaultFilename);
      })(info.context);

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
          return;
        }
      }
    }

    // サムネ画像かオリジナル画像かの選択
    let path = this.prefs.downloadOriginalSize && dw.context.path.original || dw.context.path.thumbnail || dw.context.path.original;

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
  };

  /**
   * 作品ページに「保存済み」メッセージを表示する
   */
  AnkSite.prototype.insertDownloadedDisplay = function (appendTo, opts) {
    (async () => {
      let status = await this.requestGetDownloadStatus(opts.id);
      if (!status) {
        return;
      }

      let display = appendTo.querySelector('#ank-pixiv-downloaded-display');
      if (!display) {
        display = appendTo.ownerDocument.createElement('div');
        display.setAttribute('id', 'ank-pixiv-downloaded-display');
        [
          'downloaded',
          'downloaded_used',
          'downloaded_updated',
          'download_wait',
          'download_run',
          'download_failed',
          'download_timeout'
        ].forEach((k) => {
          display.setAttribute('data-text-'+k, chrome.i18n.getMessage('msg_'+k));
        });
        appendTo.appendChild(display);
      }

      let cls = (() => {
        if (status.failed) {
          return ['failed'];
        }
        if (status.last_saved) {
          if (opts.updated > status.last_saved) {
            logger.debug('updated:', new Date(opts.updated), '>', new Date(status.last_saved));
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
        else {
          return status.running ? ['run'] : ['wait'];
        }
      })();

      if (!display.classList.contains(cls[0])) {
        display.setAttribute('class', '');
        display.classList.add.apply(display.classList, cls);
      }
    })();
  };

  /**
   * サムネイルにダウンロード状態を表示する
   * @param node
   * @param opts
   */
  AnkSite.prototype.insertDownloadedMark = function (node, opts) {
    (async () => {
      let siteChanged = await this.requestGetSiteChanged();
      if (!opts.pinpoint) {
        // 決め打ちのチェックなら前回チェック時刻は確認しない

        if (this.marked > siteChanged) {
          // 前回チェック時刻より後にサイトの更新が発生していなければ再度のチェックはしない
          logger.debug('skip mark downloaded');
          return;
        }

        this.marked = new Date().getTime();
      }

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

          let box = AnkUtils.trackbackParentNode(e, t.n, t.c);
          if (!box) {
            return;
          }

          boxes[illust_id] = boxes[illust_id] || [];

          // クエリの結果が重複する場合があるので排除する
          if (!boxes[illust_id].find((b) => b.box === box)) {
            boxes[illust_id].push({
              'box': box,
              'datetime': opts.getLastUpdate && opts.getLastUpdate(box)
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
                if (opts.overlay) {
                  e.box.classList.add('ank-pixiv-mark-overlay');
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
  };

  /**
   * backgroundにサイトの最終更新時刻を問い合わせる
   * @returns {Promise}
   */
  AnkSite.prototype.requestGetSiteChanged = function () {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getSiteChanged',
          'data':{
            'service_id': this.SITE_ID
          }
        },
        (result) => resolve(result)
      );
    });
  };

  /**
   * backgroundにユーザ情報を問い合わせる
   * - 存在しない場合は追加する
   * @param member_id
   * @param member_name
   * @returns {Promise}
   */
  AnkSite.prototype.requestGetMemberInfo = function (member_id, member_name) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getMemberInfo',
          'data':{
            'service_id': this.SITE_ID,
            'member_id': member_id,
            'member_name': member_name
          }
        },
        (result) => resolve(result)
      );
    });
  };

  /**
   * backgroundに作品のダウンロード状態を問い合わせる
   * @param illust_id
   * @returns {Promise}
   */
  AnkSite.prototype.requestGetDownloadStatus = function (illust_id, ignore_cache) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.getDownloadStatus',
          'data':{
            'service_id': this.SITE_ID,
            'illust_id': illust_id,
            'ignore_cache': ignore_cache
          }
        },
        (result) => resolve(result)
      );
    });
  };

  /**
   *
   * @param info
   * @returns {Promise}
   */
  AnkSite.prototype.requestUpdateDownloadHistory = function (hist_data) {
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
  };

  /**
   * backgroundにデータのファイルへの保存を依頼する
   * @param info
   * @returns {Promise}
   */
  AnkSite.prototype.requestExecuteSaveObject = function (info) {
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
  };

  /**
   *
   * @param info
   * @returns {Promise}
   */
  AnkSite.prototype.requestExecuteAddToDownloadQueue = function (targets, hist_data) {
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
  };

  /**
   * 投稿日時の解析の共通部分
   * @param callback
   * @returns {*}
   */
  AnkSite.prototype.getPosted = function (callback) {
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
  };

  /**
   * 機能の遅延インストール
   * @param opts
   * @returns {Promise}
   */
  AnkSite.prototype.delayFunctionInstaller = async function (opts) {
    for (let retry=1; retry <= opts.retry.max; retry++) {
      let installed = await opts.func();
      if (installed) {
        logger.info('installed:', (opts.label || ''));
        return;
      }

      if (retry <= opts.retry.max) {
        logger.info('wait for retry:', retry, '/', opts.retry.max ,':', opts.label);
        await AnkUtils.sleep(opts.retry.wait);
      }
    }

    return Promise.reject(new Error('retry over:', opts.label));
  };

  /**
   * ダウンロード情報をまとめる
   * @param elm
   * @param force
   * @returns {Promise.<*>}
   */
  AnkSite.prototype.getContext = async function (elm, force) {

    if (!force) {
      if (this.collectedContext && this.collectedContext.downloadable) {
        // 既にダウンロード可能な情報を取得済みならそのまま返す
        return this.collectedContext;
      }
    }

    return Promise.all([
      this.getPathContext(elm),
      this.getIllustContext(elm),
      this.getMemberContext(elm)
    ]).then((result) => {
      let context = {
        'downloadable': !!result[0] && !!result[1] && !!result[2],
        'service_id': this.SITE_ID,
        'siteName': this.prefs.site.folder,
        'path': result[0],
        'info': {
          'illust': result[1],
          'member': result[2]
        }
      };

      logger.info('CONTEXT: ', context);

      return this.collectedContext = context;
    });
  };

  /**
   * ダウンロードの実行
   * @param opts
   */
  AnkSite.prototype.downloadCurrentImage = function (opts) {
    if (!this.inIllustPage()) {
      return;
    }

    (async () => {

      opts = opts || {};

      let context = await this.getContext(this.elements);
      if (!context) {
        // コンテキストが集まらない（ダウンロード可能な状態になっていない）
        let msg = chrome.i18n.getMessage('msg_notReady');
        logger.warn(new Error(msg));
        return;
      }

      if (!context.downloadable) {
        // 作品情報が見つからない
        let msg = chrome.i18n.getMessage('msg_cannotFindImages');
        logger.error(new Error(msg));
        alert(msg);
        return;
      }

      let status = await this.requestGetDownloadStatus(context.info.illust.id, true);

      let member = await this.requestGetMemberInfo(context.info.member.id, context.info.member.name);
      context.info.member.memoized_name = member.name;

      this.executeDownload({'status': status, 'context': context, 'autoDownload': opts.autoDownload});
    })().catch((e) => logger.error(e));
  };

  /**
   * focusイベントのハンドラ
   */
  AnkSite.prototype.onFocusHandler = function () {
    if (this.inIllustPage()) {
      this.displayDownloaded({'force': true});
    }
    this.markDownloaded({'force': true});
  };

  /**
   *　イラストページにダウンロード済みの表示をする
   * @param opts
   * @returns {boolean}
   */
  AnkSite.prototype.displayDownloaded = function (opts) {
    if (!this.prefs.site.displayDownloaded) {
      return true;
    }

    if (this.executed.displayDownloaded && (opts && !opts.force)) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    let appendTo = this.elements.misc.downloadedDisplayParent;
    if (!appendTo) {
      return false;
    }

    let illustContext = this.getIllustContext(this.elements);
    if (!illustContext) {
      return false;
    }

    this.insertDownloadedDisplay(appendTo, {'id': illustContext.id, 'R18': illustContext.R18, 'updated': illustContext.updated});

    this.executed.displayDownloaded = true;

    return true;
  };

  /**
   * ビューアを開く
   * @param opts
   */
  AnkSite.prototype.openViewer = function (opts) {
    if (!this.prefs.site.largeOnMiddle) {
      return;
    }

    let cmd = opts && opts.cmd || 'open';
    switch (cmd) {
      case 'open':
        this.getContext(this.elements)
          .then((context) => {
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

  /*
   * 以下はサイト別スクリプトの中で実装が必要なもの
   */

  /**
   * サムネイルにダウンロード済みマークを付ける ※半完成品なのでサイト別スクリプト側で補完する必要がある（siteSpecsを与える）
   * @param opts
   * @param siteSpecs
   * @returns {boolean}
   */
  AnkSite.prototype.markDownloaded = function (opts, siteSpecs) {
    if (!this.prefs.site.markDownloaded) {
      return true;
    }

    if (!siteSpecs) {
      return true;
    }

    if (this.executed.markDownloaded && (opts && !opts.force)) {
      // 二度実行しない（強制時を除く）
      return true;
    }

    opts = opts || {};

    let node = siteSpecs.node || this.elements.doc;

    this.insertDownloadedMark(node, {
      'illust_id': opts.illust_id,
      'queries': siteSpecs.queries,
      'getId': siteSpecs.getId,
      'getLastUpdate': siteSpecs.getLastUpdate,
      'overlay': siteSpecs.overlay,
      'pinpoint': !!siteSpecs.node,
      'ignorePref': false
    });

    this.executed.markDownloaded = true;

    return true;
  };

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkSite.prototype.getElements = function (doc) {};

  /**
   * 画像ダウンロード可能なページに居るか？
   */
  AnkSite.prototype.inIllustPage = function () {};

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise.<void>}
   */
  AnkSite.prototype.getPathContext = async function (elm) {};

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   */
  AnkSite.prototype.getIllustContext = function (elm) {};

  /**
   * ダウンロード情報（メンバー情報）の取得
   * @param elm
   */
  AnkSite.prototype.getMemberContext = function (elm) {};

  /**
   * いいね！する
   */
  AnkSite.prototype.setNice = function () {};

  /**
   * ページに機能をインストールする
   */
  AnkSite.prototype.installFunctions = function () {};

}
