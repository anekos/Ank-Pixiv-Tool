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
    self.download = null;

    self.downloadQueue = [];

    // ダウンロード失敗の情報をしばらくの間保持しておく（イラストページへの「失敗」表示のため）
    self.downloadFailure = (function () {
      const CLEANUP_DELAY = 10*60*1000;

      let df = {};

      function k (s, i) {
        return [s, i].join('\0');
      }

      return {
        add: function (s, i) {
          df[k(s, i)] = new Date().getTime();
        },
        get: function (s, i) {
          return df[k(s, i)];
        },
        remove: function (s, i) {
          delete df[k(s, i)];
        },
        cleanup: function () {
          let t = new Date().getTime();
          Object.keys(df).forEach(k => {
            if (df[k]+CLEANUP_DELAY < t) {
              delete df[k];
            }
          });
        }
      };
    })();

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
    return new AnkUtils.Download();
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
     * ダウンロードキューにコンテキストを追加する
     */
    function addDownloadContext (context, sender, sendResponse) {
      (async () => {
        // ダウンロード中か？
        if (self.downloadQueue.some(v =>  v.info.service_id == context.serviceId && v.info.illust_id == context.info.illust.id)) {
          AnkUtils.Logger.debug('still running', context.serviceId, context.info.illust.id);
          return {status:'STILL'};
        }

        // ダウンロード済みか？
        let record = await self.db.histories.get([context.serviceId, context.info.illust.id]);
        if (record) {
          // FIXME 非同期じゃないのと extension の URL が表示されるのが嫌なのとで confirm の代替手段を探すこと
          let c = confirm(AnkUtils.Locale.getMessage('msg_downloadExistingImage'));
          if (!c) {
            return {status:'CANCEL'};
          }
        }

        // 保存日時
        let saved = AnkUtils.getDecodedDateTime(new Date());
        context.info.illust.saved = saved.timestamp;
        context.info.illust.savedYMD = saved.ymd;

        // DBに入れる情報の生成or更新
        record = (function () {
          if (record) {
            record.saved.push(record.last_saved);
            return record;
          }

          return {
            service_id: context.serviceId,
            illust_id: context.info.illust.id,
            member_id: context.info.member.id,
            saved: []
          };
        })();

        record.last_saved = context.info.illust.saved;

        // ダウンロードキューに追加
        self.downloadQueue.push({
          start: 0,
          info: record,
          context: context,
          count: {
            images: context.path.original.length,
            downloaded: 0
          }
        });

        // 失敗リストにあれば削除
        self.downloadFailure.remove(context.serviceId, context.info.illust.id);

        // サイト状況の最終更新時刻（キューイン時）
        self.lastUpdate.renew(context.serviceId);

        // 実行予約
        setTimeout(() => self.executeDownload(), 0);

        return {done: true};
      })()
        .then(function (r) {
          sendResponse(r);

          // 「ダウンロード済」等表示
          sendDisplayMessage();
        })
        .catch(function (e) {
          AnkUtils.Logger.error(e);
          sendResponse({error: e});
        });

      return true;
    }

    /**
     * ダウンロード履歴を検索する
     */
    function queryDownloadStatus (data, sender, sendResponse) {
      function isFailed (serviceId, illustId) {
        let o = self.downloadFailure.get(serviceId, illustId);
        if (o) {
          return {illust_id:illustId, failed:true};
        }
      }

      function isDownloading (serviceId, illustId) {
        for (let i=0; i<self.downloadQueue.length; i++) {
          let o = self.downloadQueue[i];
          if (o.context.serviceId == serviceId && o.context.info.illust.id == illustId) {
            return {illust_id:illustId, running:i==0};
          }
        }
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
     * サイトの最終更新時刻を返す
     */
    function queryLastUpdate (data, sender, sendResponse) {
      sendResponse(self.lastUpdate.get(data.serviceId) || 0);

      return false;
    }

    //

    let self = this;

    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (sender.tab) {
        switch (message.type) {
          case 'AnkPixiv.Download.addContext':
            return addDownloadContext(message.context, sender, sendResponse);
          case 'AnkPixiv.Query.downloadStatus':
            return queryDownloadStatus(message.data, sender, sendResponse);
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

  /**
   * ダウンロードの実行
   */
  AnkBase.prototype.executeDownload = function () {

    // FIXME ダウンロード処理はコンテンツスクリプト側に移動して、バックグラウンドでは順序管理だけにする予定

    /**
     * ファイル名定義を実際のファイル名に変換する
     */
    function getFileName (opt) {
      let name = (function (c) {
        let i = c.info;
        let ii = i.illust;
        let im = i.member;
        let dt = AnkUtils.getDecodedDateTime(new Date(ii.posted || ii.saved));
        let sv = AnkUtils.getDecodedDateTime(new Date(ii.saved));
        return [
          { re:/\?site-name\?/g, val:c.siteName },
          { re:/\?illust-id\?/g, val:ii.id },
          { re:/\?title\?/g, val:ii.title.substring(0,50) },
          { re:/\?tags\?/g, val:ii.tags.join(' ') },
          { re:/\?short-tags\?/g, val:ii.tags.filter(v => v.length<=self.prefs.shortTagsMaxLength).join(' ') },
          { re:/\?tools\?/g, val:ii.tools },
          { re:/\?illust-year\?/g, val:dt.year },
          { re:/\?illust-year2\?/g, val:dt.year.slice(2, 4) },
          { re:/\?illust-month\?/g, val:dt.month },
          { re:/\?illust-day\?/g, val:dt.day },
          { re:/\?illust-hour\?/g, val:dt.hour },
          { re:/\?illust-minute\?/g, val:dt.minute },
          { re:/\?saved-year\?/g, val:sv.year },
          { re:/\?saved-year2\?/g, val:sv.year.slice(2, 4) },
          { re:/\?saved-month\?/g, val:sv.month },
          { re:/\?saved-day\?/g, val:sv.day },
          { re:/\?saved-hour\?/g, val:sv.hour },
          { re:/\?saved-minute\?/g, val:sv.minute },
          { re:/\?member-id\?/g, val:im.id },
          { re:/\?pixiv-id\?/g, val:im.pixivId },
          { re:/\?member-name\?/g, val:im.name },
          { re:/\?memor?ized-name\?/g, val:im.memoizedName }
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
      })(opt.context);

      // 世代情報
      let age = !self.prefs.overwriteExistingDownload && opt.age > 1 ? ' ('+opt.age+')' : '';

      if (opt.filename) {
        return [name+age, opt.filename].join(self.prefs.mangaImagesSaveToFolder ? '/' : ' ');
      }

      if (opt.pages == 1) {
        // 一枚絵（マンガ形式でも一枚ならこちら）
        return name+age + opt.ext;
      }
      else {
        // 複数画像
        let pn = opt.meta ? 'meta' : (opt.facingNo ? AnkUtils.zeroPad(opt.facingNo, 2)+'_' : '') + AnkUtils.zeroPad(opt.pageNo, 2);
        return [name+age, pn+opt.ext].join(self.prefs.mangaImagesSaveToFolder ? '/' : ' ');
      }
    }

    //

    let self = this;

    let dw = self.downloadQueue[0];
    if (!dw || dw.start) {
      // キューが空か、なにがしかのダウンロード中
      return;
    }

    // 「ダウンロード中」表示
    sendDisplayMessage();

    dw.start = new Date().getTime();

    (async () => {

      let info = dw.info;
      let context = dw.context;
      let count = dw.count;

      // サムネ画像かオリジナル画像かの選択
      let path = !self.prefs.downloadOriginalSize && context.path.thumbnail ? context.path.thumbnail : context.path.original;

      // ボタンテキスト初期化
      self.setButtonText();

      // 何回目の保存？
      let age = 1 + info.saved.length;

      // 既存のユーザか？
      let member = await self.db.members.get([context.serviceId, context.info.member.id]);
      if (!member) {
        await self.db.members.add({service_id: context.serviceId, member_id: context.info.member.id, name: context.info.member.name});
        context.info.member.memoizedName = context.info.member.name;
      }
      else {
        context.info.member.memoizedName = member.name;
      }

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
      for (let i=0; i<path.length; i++) {
        let p = path[i];

        // TODO 拡張子判定を行わないなら、XHR を使わず直接 download api に投げてしまっても良さそう (Refererの書き換えは必要)
        let blob = await AnkUtils.Remote.get({
          url: p.src,
          headers: [{name:'Referer', value:p.referrer}],
          timeout: self.prefs.xhrTimeout,
          responseType:'blob'
        });

        let aBuffer = await AnkUtils.blobToArrayBuffer(blob.slice(0, 64));

        let ext = AnkUtils.fixFileExt(p.src, aBuffer) || '.jpg';

        let filename = getFileName({context:context, ext:ext, pages:path.length, pageNo:i+1, facingNo:p.facing, age:age});
        let result = await self.download.saveAs(blob, filename, {cleanDownloadBar: self.prefs.cleanDownloadBar});
        downloadedFilename = downloadedFilename || result && result.filename;

        ++count.downloaded;

        // ボタンテキスト更新
        self.setButtonText();
      }

      // メタテキスト保存
      if (self.prefs.saveMeta) {
        let filename = getFileName({context:context, ext:'.json', pages:path.length, age:age, meta:true});
        await self.download.saveAs(new Blob([metaText]), filename, {cleanDownloadBar: self.prefs.cleanDownloadBar});
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
        await self.db.histories.put(info);
      }

      // サイト状況の最終更新時刻（保存完了時）
      self.lastUpdate.renew(context.serviceId);

      AnkUtils.Logger.debug('COMPLETE: '+context.info.illust.url+' '+count.images+'pics '+(new Date().getTime() - dw.start)+'ms');

    })()
      .catch((e) => {
        dw.failed = true;  // エラー時にwaitさせる
        AnkUtils.Logger.error(e);
        alert(e);
      })
      .then(() => {
        // 失敗しても成功してもキューから削除
        let dz = self.downloadQueue.shift();

        if (dz.objectUrls) {
          // オブジェクトの開放
          dz.objectUrls.forEach(o => URL.revokeObjectURL(o));
        }

        if (dz.failed) {
          // 失敗リストに追加
          self.downloadFailure.cleanup();
          self.downloadFailure.add(dz.context.serviceId, dz.context.info.illust.id);
        }

        // 「ダウンロード済」等表示
        sendDisplayMessage();

        // 実行予約
        setTimeout(() => self.executeDownload(), dz.failed ? self.prefs.recoverTimer : 0);
      });
  };

  // 実行

  new AnkBase().start();

}
