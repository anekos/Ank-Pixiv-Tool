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

