"use strict";

{

  /**
   * コンストラクタ
   * @constructor
   */
  var AbsSite = function () {
    if (this.constructor === AbsSite) {
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
  AbsSite.prototype.start = function () {
    let self = this;

    spawn(function* () {
      // FIXME Firefoxではcontent_scriptからchrome.storageにアクセスできない
      self.prefs = yield AnkPrefs.get();
      AnkUtils.Logger.setLevel(self.prefs.logLevel);

      if (!self.sitePrefs.enabled) {
        AnkUtils.Logger.debug('DISABLED SITE MODULE: '+self.SITE_ID);
        return;
      }

      self.elements = self.getElements(document);
      self.viewer = new AnkViewer(document, self.prefs);

      self.addMessageListener();
      self.addFocusListener();
      self.installFunctions();
    });
  };

  /**
   * focusイベントリスナーの定義
   */
  AbsSite.prototype.addFocusListener = function () {
    let self = this;
    window.addEventListener('focus', () => self.onFocusHandler())
  };

  /**
   * メッセージリスナーの定義
   */
  AbsSite.prototype.addMessageListener = function () {

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

      if (!sender) {
        return;
      }

      return;
    }

    // web page から
    window.addEventListener('message', function(e) {
      if (event.source != window) {
        return;
      }

      let message = e.data;
      if (/^AnkPixiv\./.test(message.type)) {
        execMessage(message);
      }
    });

    // background から
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
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
  AbsSite.prototype.insertDownloadedDisplay = function (appendTo, opt) {
    let self = this;

    self.queryDownloadStatus(opt.id, r => {
      if (!r || !r[0]) {
        return;
      }

      let info = r[0];

      let display = appendTo.querySelector('#ank-pixiv-downloaded-display');
      if (!display) {
        display = appendTo.ownerDocument.createElement('div');
        display.setAttribute('id', 'ank-pixiv-downloaded-display');
        appendTo.appendChild(display);
      }

      let c = (function () {
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
    });
  };

  /**
   * サムネイルにダウンロード状態を表示する
   */
  AbsSite.prototype.insertDownloadedMark = function (node, opt) {
    let self = this;

    spawn(function* () {
      let lu = yield self.queryLastUpdate();
      if (!opt.force && self.marked > lu) {
        return;
      }

      if (!opt.force) {
        // 自動伸長の場合は一部分しかチェックしないのでチェック時刻を更新しないでおく
        self.marked = new Date().getTime();
      }

      let boxes = {};

      // チェック対象のサムネイルを抽出する
      opt.targets.forEach(function (t) {
        Array.prototype.map.call(node.querySelectorAll(t.q), function (elm) {
          let href = (function (tagName) {
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
      let r = yield self.queryDownloadStatus(Object.keys(boxes));
      r.forEach(function (info) {
        boxes[info.illust_id].forEach(function (e) {
          if (info.failed) {
            return;
          }
          if (info.last_saved) {
            if (self.prefs.markUpdated && e.datetime > info.last_saved) {
              e.box.classList.add('ank-pixiv-updated');
            }
            else {
              e.box.classList.add('ank-pixiv-downloaded');
            }
          }
          else {
            e.box.classList.add('ank-pixiv-downloading');
          }
        });
      });
    });
  };

  /**
   * backgroundに作品のダウンロード状態を問い合わせる
   */
  AbsSite.prototype.queryDownloadStatus = function (illustId, callback) {
    let self = this;
    if (callback) {
      return chrome.runtime.sendMessage({type:'AnkPixiv.Query.downloadStatus', data:{serviceId:self.SITE_ID, illustId:illustId}}, (info) => callback(info));
    }

    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({type:'AnkPixiv.Query.downloadStatus', data:{serviceId:self.SITE_ID, illustId:illustId}}, (info) => resolve(info));
    });
  };

  /**
   * backgroundにサイトの最終更新時刻を問い合わせる
   */
  AbsSite.prototype.queryLastUpdate = function (callback) {
    let self = this;
    if (callback) {
      return chrome.runtime.sendMessage({type:'AnkPixiv.Query.lastUpdate', data:{serviceId:self.SITE_ID}}, (info) => callback(info));
    }

    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({type:'AnkPixiv.Query.lastUpdate', data:{serviceId:self.SITE_ID}}, (info) => resolve(info));
    });
  };

  /*
  AbsSite.prototype.markBoxNode = function (box, illust_id, module, overlay) {
    spawn(function* () {
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
  }
  */
  /**
   * 投稿日時の解析の共通部分
   * @param callback
   * @returns {*}
   */
  AbsSite.prototype.getPosted = function (callback) {
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

  AbsSite.prototype.getElements = function (doc) {};
  AbsSite.prototype.downloadCurrentImage = function (opt) {};
  AbsSite.prototype.openViewer = function (opt) {};
  AbsSite.prototype.setRate = function (pt) {};
  AbsSite.prototype.onFocusHandler = function () {};
  AbsSite.prototype.installFunctions = function () {};

}

