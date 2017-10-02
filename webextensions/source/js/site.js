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
    this.sitePrefs = null;
    this.elements = null;
    this.download = null;
    this.marked = 0;        // markingを行った最終時刻（キューインや保存完了の時刻と比較する）
  };

  /**
   * 初期化
   */
  AnkSite.prototype.start = function () {

    return (async () => {
      this.prefs = await AnkPrefs.restore(OPTION_DEFAULT);

      logger.setLevel(this.prefs.logLevel);

      this.sitePrefs = this.prefs.siteModules[this.SITE_ID];
      if (!this.sitePrefs) {
        logger.info('INVALID SITE MODULE:', this.SITE_ID);
        return Promise.reject(new Error('INVALID SITE MODULE'));
      }
      if (!this.sitePrefs.enabled) {
        logger.info('DISABLED SITE MODULE:', this.SITE_ID);
        return;
      }
      if (this.sitePrefs.experimental && !this.prefs.useExperimentalModule) {
        logger.info('DISABLED EXPERIMENTAL MODULE:', this.SITE_ID);
        return;
      }

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
      let args = message.type.split('.', 3);
      if (args[1] === 'Download') {
        return this.downloadCurrentImage();
      }
      if (args[1] === 'Viewer') {
        return this.openViewer(args[2] && {'command': args[2]});
      }
      if (args[1] === 'Rate') {
        return this.setRate(args[2]);
      }

      if (!sender) {
        return;
      }

      if (args[1] === 'Display') {
        this.onFocusHandler();
        return
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
        let pos = AnkUtils.getDecodedDateTime(new Date(ii.posted || ii.saved));
        let sav = AnkUtils.getDecodedDateTime(new Date(ii.saved));
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
            return this.requestUpdateDownloadStatus(hist_data);
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
    let saved = AnkUtils.getDecodedDateTime(new Date());
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
        appendTo.appendChild(display);
      }

      let cls = (() => {
        if (status.failed) {
          return ['failed'];
        }
        if (status.last_saved) {
          if (this.prefs.markUpdated && opts.updated > status.last_saved) {
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

      // FIXME Unicode characters broken when __MSG_... in css file (https://bugzilla.mozilla.org/show_bug.cgi?id=1389099)
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
      if (this.marked > siteChanged) {
        // 前回チェック時刻より後にサイトの更新が発生していなければ再度のチェックはしない
        logger.log('skip mark downloaded');
        return;
      }

      if (!opts.pinpoint) {
        // 決め打ちのチェックならチェック時刻は更新しない
        this.marked = new Date().getTime();
      }

      let boxes = {};

      // チェック対象のサムネイルを抽出する
      opts.targets.forEach((t) => {
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
              'datetime': this.prefs.markUpdated && (opts.getLastUpdate && opts.getLastUpdate(box))
            });
          }
        });
      });

      // FIXME BOXが多すぎるとブラウザが固まる
      // ダウンロード状態を調べて反映する
      let statuses = await this.requestGetDownloadStatus(Object.keys(boxes));
      if (!statuses) {
        return;
      }
      statuses.forEach((s) => {
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
              if (this.prefs.markUpdated && e.datetime > s.last_saved) {
                return 'ank-pixiv-updated';
              }

              return 'ank-pixiv-downloaded';
            }
          })();
          if (cls && !e.box.classList.contains(cls)) {
            e.box.classList.remove('ank-pixiv-downloading', 'ank-pixiv-updated', 'ank-pixiv-downloaded');
            e.box.classList.add(cls);
            if (!opts.overlay) {
              e.box.classList.add('ank-pixiv-mark-background');
            }
            else {
              e.box.classList.add('ank-pixiv-mark-overlay');
            }
          }
        });
      });
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
  AnkSite.prototype.requestUpdateDownloadStatus = function (info) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          'type': 'AnkPixiv.Query.updateDownloadStatus',
          'data':{
            'info': info
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
  AnkSite.prototype.delayFunctionInstaller = function (opts) {
    return (async () => {
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
    })();
  };

  // 抽象メソッドのようなもの

  AnkSite.prototype.getElements = function (doc) {};
  AnkSite.prototype.downloadCurrentImage = function (opts) {};
  AnkSite.prototype.openViewer = function (opts) {};
  AnkSite.prototype.setRate = function (pt) {};
  AnkSite.prototype.onFocusHandler = function () {};
  AnkSite.prototype.installFunctions = function () {};
  AnkSite.prototype.displayDownloaded = function () {};
  AnkSite.prototype.markDownloaded = function () {};

}

