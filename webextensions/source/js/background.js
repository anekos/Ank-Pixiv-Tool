"use strict";

{

  /**
   * コンストラクタ
   * @constructor
   */
  let AnkBase = function () {
    let self = this;

    self.prefs = null;
    self.db = null;

    // ダウンロード状況の最終更新時刻（サイト別）
    self.lastUpdate = (function () {
      let lu = {};

      return {
        renew: function (id) {
          lu[id] = new Date().getTime();
        },
        get: function (id) {
          return lu[id];
        }
      };
    })();
  };

  /**
   * 初期化
   */
  AnkBase.prototype.start = function () {
    let self = this;

    (async () => {
      self.prefs = await AnkPrefs.get();
      AnkUtils.Logger.setLevel(self.prefs.logLevel);

      self.db = await self.initDatabase();
      self.download = self.initDownload();
      self.initBrowserAction();
      self.initMessagePassing();
    })().catch(function (e) {
      console.error(e);
    });
  };

  /**
   * DBの初期化
   */
  AnkBase.prototype.initDatabase = function () {
    return (async () => {
      let db = new Dexie('AnkPixiv');

      await db.version(1)
        .stores({
          histories: '&[service_id+illust_id]',
          members: '&[service_id+member_id]'
        });

      await db.open()
        .catch(function (e) {
          AnkUtils.Logger.debug(e);
        });

      return db;
    })();
  };

  /**
   * ダウンロードクラスの初期化
   * @returns {*}
   */
  AnkBase.prototype.initDownload = function () {

    const CLEANUP_DELAY = 5*60*1000;

    // contents scriptとの接続が切れるまで落ちないそうなので状態は維持しなくてもよいと思う
    let state = {};

    let erase = function (id) {
      if (state[id].cleanDownloadBar) {
        // 終了したら(正常・異常関係なく)ダウンロードバーから消す
        chrome.downloads.erase({'id': id}, () => {});
      }
    };

    //

    // FIXME タイムアウト処理を入れるかどうか
    let cleanup = function () {
      let t = new Date().getTime();
      let keys = Object.keys(state).map((k) => {
        return state[k].start+CLEANUP_DELAY < t;
      })
        .filter((v) => !!v);

      keys.forEach((k) => {
        let s = state[k];
        erase(s.id);
        delete state[k];
        s.onError(new Error('download timeout: '+s.filename));
      });
    };

    let saveAs = function (options) {
      let _saveAs = function (opts) {

        // FIXME 設定＞ダウンロード前に各ファイルの保存場所を確認する が有効だと saveAs:false でもダイアログが出てしまう > https://code.google.com/p/chromium/issues/detail?id=417112
        chrome.downloads.download({
          url: opts.url,
          filename: opts.filename,
          saveAs: false,
          conflictAction: 'overwrite'
        }, (id) => {
          if (id === undefined) {
            return opts.onError(chrome.runtime.lastError);
          }
          else {
            return state[id] = {
              id: id,
              onSuccess: opts.onSuccess,
              onError: opts.onError,
              cleanDownloadBar: opts.cleanDownloadBar,
              start: new Date().getTime()
            };
          }
        });
      };

      return new Promise((resolve, reject) => {
        _saveAs({
          url: options.url,
          filename: options.filename,
          cleanDownloadBar: options.cleanDownloadBar,
          onSuccess: (v) => {resolve(v)},
          onError: (e) => {reject(e)}
        });
      });
    };

    //

    // ダウンロードの終了待ち
    chrome.downloads.onChanged.addListener((delta) => {

      if (!state.hasOwnProperty(delta.id)) {
        return;
      }

      let s = state[delta.id];


      //if (delta.error && delta.error.current !== 'USER_CANCELED') {
      if (delta.error) {
        erase(s.id);
        delete state[s.id];
        return s.onError(new Error(delta.error));
      }

      if (delta.state && delta.state.current === 'complete') {
        erase(s.id);
        delete state[s.id];
        return s.onSuccess();
      }
    });

    return {
      saveAs: saveAs,
      cleanup: cleanup
    };
  };

  /**
   * ツールバーボタンをクリックした際のイベントのハンドリング
   */
  AnkBase.prototype.initBrowserAction = function () {
    chrome.browserAction.onClicked.addListener(() => {
      chrome.tabs.query(
        {
          currentWindow: true,
          active: true
        },
        (tab) => {
          chrome.tabs.sendMessage(tab[0].id, {'type':'AnkPixiv.Download'}, () => {});
        }
      );
    });
  };

  /**
   *
   */
  let sendDisplayMessage = function () {
    chrome.tabs.query(
      {
        currentWindow: true,
        active: true
      },
      (tab) => {
        chrome.tabs.sendMessage(tab[0].id, {'type':'AnkPixiv.Display'}, () => {});
      }
    );
  };

  /**
   * メッセージを受けたときのハンドリング
   */
  AnkBase.prototype.initMessagePassing = function () {

    /**
     * ファイルに保存する
     */
    function saveAs (data, sender, sendResponse) {
      self.download.saveAs({
        url: data.info.url,
        filename: data.info.filename,
        cleanDownloadBar: self.prefs.cleanDownloadBar
      })
        .then((v) => {
          sendResponse({result: v});
        })
        .catch((e) => {
          sendResponse({error: e});
        });

      return true;
    }

    /**
     * メンバー情報の検索
     */
    function queryMemberInfo (data, sender, sendResponse) {
      (async () => {
        let member = await self.db.members.get([data.serviceId, data.memberId]);
        if (!member) {
          member = {
            service_id: data.serviceId,
            member_id: data.memberId,
            name: data.memberName
          };

          await self.db.members.add(member);
        }
        
        sendResponse(member);
      })();

      return true;
    }

    /**
     * ダウンロード履歴を検索する
     */
    function queryDownloadStatus (data, sender, sendResponse) {
      function isFailed (serviceId, illustId) {
        /*
         *
         */
      }

      function isDownloading (serviceId, illustId) {
        /*
         *
         */
      }

      let idList = Array.isArray(data.illustId) ? data.illustId : [data.illustId];

      let keys = [];
      let results = [];
      idList.forEach(id => {
        let r = isFailed(data.serviceId, id) || isDownloading(data.serviceId, id);
        if (r) {
          results.push(r);
        }
        else {
          keys.push([data.serviceId, id]);
        }
      });

      if (keys.length == 0) {
        sendResponse(results);
      }

      self.db.histories.where('[service_id+illust_id]')
        .anyOf(keys)
        .toArray((r) => {
          r.forEach((info) => results.push({illust_id:info.illust_id, last_saved:info.last_saved}));

          sendResponse(results);
        });

      return true;
    }

    /**
     * ダウンロード履歴を更新する
     */
    function updateDownloadStatus (data, sender, sendResponse) {
      (async () => {
        await self.db.histories.put(data.info);
        sendResponse();
      })();

      return true;
    }

    /**
     * サイトの最終更新時刻を返す
     */
    function queryLastUpdate (data, sender, sendResponse) {
      sendResponse(self.lastUpdate.get(data.serviceId) || 0);

      return false;
    }

    //

    let self = this;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.tab) {
        switch (message.type) {
          case 'AnkPixiv.Download.saveAs':
            return saveAs(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.memberInfo':
            return queryMemberInfo(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.downloadStatus':
            return queryDownloadStatus(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.updateDownloadStatus':
            return updateDownloadStatus(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.lastUpdate':
            return queryLastUpdate(message.data, sender, sendResponse);
          default:
            break;
        }
      }
    });
  };

  /**
   * ツールバーボタンにダウンロード数を表示する
   */
  AnkBase.prototype.setButtonText = function () {
    let self = this;
    let text = (function () {
      let a = [];
      if (self.prefs.showIllustRemains && self.downloadQueue.length > 0) {
        a.push(self.downloadQueue.length.toString());
      }
      if (self.prefs.showImageRemains) {
        let remain = self.downloadQueue.reduce((p,o) => p+(o.count.images - o.count.downloaded), 0);
        if (!remain) {
          return '';
        }
        a.push(remain);
      }

      return a.join('/');
    })();
    chrome.browserAction.setBadgeText({text:text});
  };

  // 実行

  new AnkBase().start();

}
