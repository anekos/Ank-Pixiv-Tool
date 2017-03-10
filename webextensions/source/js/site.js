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

    let self = this;

    self.SITE_ID = null;
    self.prefs = null;

    self.sitePrefs = {
      get enabled () {
        return self.prefs['siteModule_'+self.SITE_ID+'_enabled'];
      },
      get folder () {
        return self.prefs['siteModule_'+self.SITE_ID+'_folder'];
      },
      get useAutoDownload () {
        return self.prefs['siteModule_'+self.SITE_ID+'_useAutoDownload'];
      },
      get useViewer () {
        return self.prefs['siteModule_'+self.SITE_ID+'_useViewer'];
      }
    };

    self.elements = null;
    self.download = null;
    self.viewer = null;

    // markingを行った最終時刻（キューインや保存完了の時刻と比較する）
    self.marked = 0;
  };

  /**
   * 初期化
   */
  AnkSite.prototype.start = function () {
    let self = this;

    (async () => {
      self.prefs = await AnkPrefs.get();
      AnkUtils.Logger.setLevel(self.prefs.logLevel);

      if (!self.sitePrefs.enabled) {
        AnkUtils.Logger.debug('DISABLED SITE MODULE: '+self.SITE_ID);
        return Promise.resolve();
      }

      self.elements = self.getElements(document);
      self.viewer = new AnkViewer(document, self.prefs);

      self.addMessageListener();
      self.addFocusListener();
      self.installFunctions();
    })();
  };

  /**
   * focusイベントリスナーの定義
   */
  AnkSite.prototype.addFocusListener = function () {
    window.addEventListener('focus', () => this.onFocusHandler())
  };

  /**
   * メッセージリスナーの定義
   */
  AnkSite.prototype.addMessageListener = function () {

    let self = this;

    function execMessage (message, sender) {
      let args = message.type.split('.', 3);
      if (args[1] === 'Download') {
        return self.downloadCurrentImage(args[2]);
      }
      if (args[1] === 'Viewer') {
        return self.openViewer(args[2]);
      }
      if (args[1] === 'Rate') {
        return self.setRate(args[2]);
      }
      if (args[1] === 'Display') {
        return self.delayDisplaying();
      }


      if (!sender) {
        return;
      }

      return;
    }

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

    /**
     * ファイル名定義を実際のファイル名に変換する
     */
    function getFileName(info) {
      let name = (function (c) {
        let i = c.info;
        let ii = i.illust;
        let im = i.member;
        let dt = AnkUtils.getDecodedDateTime(new Date(ii.posted || ii.saved));
        let sv = AnkUtils.getDecodedDateTime(new Date(ii.saved));
        return [
          {re: /\?site-name\?/g, val: c.siteName},
          {re: /\?illust-id\?/g, val: ii.id},
          {re: /\?title\?/g, val: ii.title.substring(0, 50)},
          {re: /\?tags\?/g, val: ii.tags.join(' ')},
          {re: /\?short-tags\?/g, val: ii.tags.filter(v => v.length <= self.prefs.shortTagsMaxLength).join(' ')},
          {re: /\?tools\?/g, val: ii.tools},
          {re: /\?illust-year\?/g, val: dt.year},
          {re: /\?illust-year2\?/g, val: dt.year.slice(2, 4)},
          {re: /\?illust-month\?/g, val: dt.month},
          {re: /\?illust-day\?/g, val: dt.day},
          {re: /\?illust-hour\?/g, val: dt.hour},
          {re: /\?illust-minute\?/g, val: dt.minute},
          {re: /\?saved-year\?/g, val: sv.year},
          {re: /\?saved-year2\?/g, val: sv.year.slice(2, 4)},
          {re: /\?saved-month\?/g, val: sv.month},
          {re: /\?saved-day\?/g, val: sv.day},
          {re: /\?saved-hour\?/g, val: sv.hour},
          {re: /\?saved-minute\?/g, val: sv.minute},
          {re: /\?member-id\?/g, val: im.id},
          {re: /\?pixiv-id\?/g, val: im.pixivId},
          {re: /\?member-name\?/g, val: im.name},
          {re: /\?memor?ized-name\?/g, val: im.memoizedName}
        ].reduce((s, v) => {
          try {
            // TODO dir//file みたいな感じで File Separator が複数連続していると FILE_NAME_TOO_LONG 例外が発生するので注意。あと .. もNG
            return s.replace(v.re, AnkUtils.fixFilename((v.val || '-')).toString());
          }
          catch (e) {
            AnkUtils.Logger.debug(v.re + ' is not found');
          }
          return s;
        }, self.prefs.defaultFilename);
      })(info.context);

      // 世代情報
      let age = !self.prefs.overwriteExistingDownload && info.age > 1 ? ' (' + info.age + ')' : '';

      if (info.filename) {
        return [name + age, info.filename].join(self.prefs.mangaImagesSaveToFolder ? '/' : ' ');
      }

      if (info.pages == 1) {
        // 一枚絵（マンガ形式でも一枚ならこちら）
        return name + age + info.ext;
      }
      else {
        // 複数画像
        let pn = info.meta ? 'meta' : (info.facingNo ? AnkUtils.zeroPad(info.facingNo, 2) + '_' : '') + AnkUtils.zeroPad(info.pageNo, 2);
        return [name + age, pn + info.ext].join(self.prefs.mangaImagesSaveToFolder ? '/' : ' ');
      }
    }

    //

    let self = this;

    // 「ダウンロード中」表示
    self.delayDisplaying();

    dw.start = new Date().getTime();

    (async () => {

      //
      let context = dw.context;

      let saved = AnkUtils.getDecodedDateTime(new Date());
      context.info.illust.saved = saved.timestamp;
      context.info.illust.savedYMD = saved.ymd;

      //
      let info = (function () {
        if (dw.record) {
          dw.record.saved.push(dw.record.last_saved);
          return dw.record;
        }

        return {
          service_id: context.serviceId,
          illust_id: context.info.illust.id,
          member_id: context.info.member.id,
          saved: []
        };
      })();

      info.last_saved = context.info.illust.saved;

      // サムネ画像かオリジナル画像かの選択
      let path = !self.prefs.downloadOriginalSize && context.path.thumbnail ? context.path.thumbnail : context.path.original;

      // ボタンテキスト初期化
      // FIXME xxx
      //self.setButtonText();

      // 何回目の保存？
      let age = 1 + info.saved.length;

      // 既存のユーザか？
      let member = await self.queryMemberInfo(context.info.member.id, context.info.member.name);
      context.info.member.memoizedName = member.name;

      // メタテキストの生成
      let metaText = (function () {
        let meta = {info: context.info};
        if (self.prefs.saveMetaWithPath) {
          meta.path = path;
        }
        return JSON.stringify(meta, null, ' ');
      })();

      // 画像ダウンロード　※XHRのエラーに対するリトライは実装しない予定
      let downloadedFilename = null;
      for (let i = 0; i < path.length; i++) {
        let p = path[i];

        // FIXME Firefoxではcontents scriptからbackground scriptへObjectURLを渡せない
        // TODO 拡張子判定を行わないなら、XHR を使わず直接 download api に投げてしまっても良さそう (Refererの書き換えは必要)
        let blob = await AnkUtils.Remote.get({
          url: p.src,
          headers: [{name: 'Referer', value: p.referrer}],
          timeout: self.prefs.xhrTimeout,
          responseType: 'blob'
        });

        let aBuffer = await AnkUtils.blobToArrayBuffer(blob.slice(0, 64));

        let ext = AnkUtils.fixFileExt(p.src, aBuffer) || '.jpg';

        let filename = getFileName({
          context: context,
          ext: ext,
          pages: path.length,
          pageNo: i + 1,
          facingNo: p.facing,
          age: age
        });
        let objURL = URL.createObjectURL(blob);
        let result = await self.executeSaveAs({
          url: objURL,
          filename: filename
        });

        downloadedFilename = downloadedFilename || result && result.filename;

        // ボタンテキスト更新
        // FIXME xxx
        //self.setButtonText();
      }

      // メタテキスト保存
      if (self.prefs.saveMeta) {
        let filename = getFileName({context: context, ext: '.json', pages: path.length, age: age, meta: true});
        let objURL = URL.createObjectURL(new Blob([metaText]));
        await self.executeSaveAs({
          url: objURL,
          filename: filename
        });
      }

      if (self.prefs.saveHistory) {
        // 履歴に作品の詳細情報を含めるか？
        if (self.prefs.saveIllustInfo) {
          info.title = context.info.illust.title;
          info.R18 = context.info.illust.R18;
          info.tags = context.info.illust.tags;
          info.filename = downloadedFilename;
        }

        // 履歴保存
        await self.updateDownloadStatus(info);
      }

      // サイト状況の最終更新時刻（保存完了時）
      /*
      self.lastUpdate.renew(context.serviceId);
      */

      AnkUtils.Logger.debug('COMPLETE: ' + context.info.illust.url + ' ' + path.length + 'pics ' + (new Date().getTime() - dw.start) + 'ms');

    })()
      .then(() => {
        // 「ダウンロード済」等表示
        self.delayDisplaying();
      })
      .catch((e) => {
        dw.failed = true;  // エラー時にwaitさせる
        AnkUtils.Logger.error(e);
        alert(e);
      });
  };

  /**
   * 作品ページに「保存済み」メッセージを表示する
   */
  AnkSite.prototype.insertDownloadedDisplay = function (appendTo, opt) {
    let self = this;

    (async () => {
      let r = await self.queryDownloadStatus(opt.id);
      if (!r || !r[0]) {
        return Promise.resolve();
      }

      let info = r[0];

      let display = appendTo.querySelector('#ank-pixiv-downloaded-display');
      if (!display) {
        display = appendTo.ownerDocument.createElement('div');
        display.setAttribute('id', 'ank-pixiv-downloaded-display');
        appendTo.appendChild(display);
      }

      let c = (() => {
        if (info.failed) {
          return ['failed'];
        }
        else if (info.last_saved) {
          if (self.prefs.markUpdated && opt.update > info.last_saved) {
            return ['updated']
          }

          return opt.R18 ? ['R18', self.prefs.downloadedAnimationStyle == 1 ? 'shake' : 'slidein'] : ['done'];
        }
        else {
          return info.running ? ['run'] : ['wait'];
        }
      })();

      if (!display.classList.contains(c[0])) {
        display.setAttribute('class', '');
        display.classList.add.apply(display.classList, c);
      }
    })();
  };

  /**
   * サムネイルにダウンロード状態を表示する
   */
  AnkSite.prototype.insertDownloadedMark = function (node, opt) {
    let self = this;

    (async () => {
      let lu = await self.queryLastUpdate();
      if (!opt.force && self.marked > lu) {
        // 前回チェック時刻より後にサイトの更新が発生していなければ再度のチェックはしない
        return Promise.resolve();
      }

      if (!opt.force) {
        // 強制チェックならチェック時刻は更新しない
        self.marked = new Date().getTime();
      }

      let boxes = {};

      // チェック対象のサムネイルを抽出する
      opt.targets.forEach((t) => {
        Array.prototype.map.call(node.querySelectorAll(t.q), (elm) => {
          let href = ((tagName) => {
            if (tagName === 'a') {
              return elm.href;
            }
            if (tagName === 'img') {
              return elm.src;
            }
          })(elm.tagName.toLowerCase());

          let id = opt.getId(href);
          if (!id || (opt.illust_id && opt.illust_id != id)) {
            // IDが見つからないか、ID指定があって一致しない場合
            return;
          }

          let box = AnkUtils.trackbackParentNode(elm, t.n, t.c);
          if (!box) {
            return;
          }

          boxes[id] = boxes[id] || [];
          boxes[id].push({
            box: box,
            datetime: self.prefs.markUpdated && opt.getLastUpdate && opt.getLastUpdate(box)
          });
        });
      });

      // ダウンロード状態を調べて反映する
      // FIXME BOXが多すぎるとブラウザが固まる
      let r = await self.queryDownloadStatus(Object.keys(boxes));
      if (r) {
        r.forEach((info) => {
          boxes[info.illust_id].forEach((e) => {
            if (info.failed) {
              return;
            }
            if (info.last_saved) {
              if (self.prefs.markUpdated && e.datetime > info.last_saved) {
                e.box.classList.add('ank-pixiv-updated' + (opt.overlay ? '-overlay' : ''));
              }
              else {
                e.box.classList.add('ank-pixiv-downloaded' + (opt.overlay ? '-overlay' : ''));
              }
            }
            else {
              e.box.classList.add('ank-pixiv-downloading' + (opt.overlay ? '-overlay' : ''));
            }
          });
        });
      }
    })();
  };

  /**
   * backgroundにユーザ情報を問い合わせる
   */
  AnkSite.prototype.queryMemberInfo = function (memberId, memberName) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          type: 'AnkPixiv.Query.memberInfo',
          data:{
            serviceId: this.SITE_ID,
            memberId: memberId,
            memberName: memberName
          }
        },
        (info) => resolve(info)
      );
    });
  };

  /**
   * backgroundに作品のダウンロード状態を問い合わせる
   */
  AnkSite.prototype.queryDownloadStatus = function (illustId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          type: 'AnkPixiv.Query.downloadStatus',
          data:{
            serviceId: this.SITE_ID,
            illustId: illustId
          }
        },
        (info) => resolve(info)
      );
    });
  };

  /**
   * backgroundに作品のダウンロード状態の更新を依頼する
   */
  AnkSite.prototype.updateDownloadStatus = function (info) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          type: 'AnkPixiv.Query.updateDownloadStatus',
          data: {
            info: info
          }
        },
        (info) => resolve(info)
      );
    });
  };

  /**
   * backgroundに作品のダウンロード状態の更新を依頼する
   */
  AnkSite.prototype.executeSaveAs = function (info) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
          type: 'AnkPixiv.Download.saveAs',
          data: {
            info: info
          }
        },
        (info) => {
          if (info.hasOwnProperty('error')) {
            return reject(info.error);
          }

          resolve(info.result)
        }
      );
    });
  };

  /**
   * backgroundにサイトの最終更新時刻を問い合わせる
   */
  AnkSite.prototype.queryLastUpdate = function () {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
          type: 'AnkPixiv.Query.lastUpdate',
          data:{
            serviceId: this.SITE_ID
          }
        },
        (info) => resolve(info)
      );
    });
  };

  /**
   * 投稿日時の解析の共通部分
   * @param callback
   * @returns {*}
   */
  AnkSite.prototype.getPosted = function (callback) {
    let self = this;
    let posted = callback();
    if (posted.fault) {
      if (!self.prefs.ignoreWrongDatetimeFormat) {
        // 解析に失敗したので終了
        let msg = AnkUtils.Locale.getMessage('msg_cannotDecodeDatetime');
        alert(msg);
        throw new Error(msg);
      }
      if (self.prefs.warnWrongDatetimeFormat) {
        // 解析失敗の警告
        alert(AnkUtils.Locale.getMessage('msg_warnWrongDatetime'));
      }
    }
    return posted;
  };

  // 抽象メソッドのようなもの

  AnkSite.prototype.getElements = function (doc) {};
  AnkSite.prototype.downloadCurrentImage = function (opt) {};
  AnkSite.prototype.openViewer = function (opt) {};
  AnkSite.prototype.setRate = function (pt) {};
  AnkSite.prototype.onFocusHandler = function () {};
  AnkSite.prototype.installFunctions = function () {};
  AnkSite.prototype.delayDisplaying = function () {};

}

