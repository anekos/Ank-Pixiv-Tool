"use strict";

{

  let prefs = null;

  let downloadQueue = null;
  let historyCache = null;
  let download = null;
  let db = null;

  let start = async () => {
    prefs = await AnkPrefs.restore(OPTION_DEFAULT);
    logger.setLevel(prefs.logLevel);

    logger.info('START: ANK PIXIV TOOL');

    AnkPrefs.setAutoApply(() => applyPrefsChange());

    downloadQueue = new DownloadQueue();
    historyCache = new HistoryCache();
    download = new Download();

    db = await initDatabase();
    initBrowserAction();
    initMessageListener();
  };

  /*
   *
   */

  /**
   * ダウンロードキュークラス
   * - 複数のダウンロードが同時に動いてサーバに負荷をかけるのを防ぐため順序制御を行う
   * @returns {{push: (function(*=, *=, *=)), first: (function()), shift: (function(*)), drop: (function(*=)), find: (function(*, *)), getSiteChanged: (function(*)), size: (function()), sizeImages: (function()), remainImages: (function())}}
   * @constructor
   */
  let DownloadQueue = function () {

    let queue = [];
    let changed = {};
    let szImages = 0;

    // キューイン
    let push = (service_id, illust_id, data) => {
      queue.push({
        'service_id': service_id,
        'illust_id': illust_id,
        'start': 0,
        'expired': false,
        'data': data
      });
      changed[service_id] = new Date().getTime();
      szImages += data.targets.length;
    };

    // 先頭の要素を参照する
    let first = () => {
      return queue[0];
    };

    // 先頭の要素を取り出す ※引数 f があるのは非同期実行順序に確信が持てない不安の表れ
    let shift = (f) => {
      if (first() === f) {
        queue.shift();
        changed[f.service_id] = new Date().getTime();
        szImages -= f.data.targets.length;
      }
      return f;
    };

    // 先頭の要素を捨てる
    let drop = (f) => {
      shift(f);

      f.expired = true;

      let remains = f.data.targets.length - (1 + f.data.targets.findIndex((e) => !e.done));

      setTimeout(() => {
        // FIXME 単に捨てるのではなく、保存しておいてある程度時間が経ったらrevokeするべき（リーク対策）
      }, prefs.xhrTimeout * remains);
    };

    // 検索
    let find = (service_id, illust_id) => {
      return queue.find((e) => {
        return e.service_id == service_id && e.illust_id == illust_id;
      });
    };

    // サイトの最終更新時刻の取得
    let getSiteChanged = (service_id) => {
      // 最後のダウンロード実行時刻より後にマーキングを行っているなら、再度マーキングチェックを行う必要がない
      return changed[service_id] || 0;
    };

    // キューサイズ
    let size = () => {
      return queue.length;
    };

    // キュー中の画像の総数(meta.jsonの数も含む)
    let sizeImages = () => {
      return szImages;
    };

    // 未ダウンロード画像の総数
    let remainImages = () => {
      let f = first();
      if (!f || !f.start) {
        return szImages;
      }

      let completed = 0;
      f.data.targets.some((e) => {
        if (e.done) {
          completed++;
          return;
        }
        return true;
      });
      return szImages - completed;
    };

    return {
      'push': push,
      'first': first,
      'shift': shift,
      'drop': drop,
      'find': find,
      'getSiteChanged': getSiteChanged,
      'size': size,
      'sizeImages': sizeImages,
      'remainImages': remainImages
    };
  };

  /**
   * ダウンロード履歴クラス
   * - DBアクセス削減のためのキャッシュだが、実際にどれだけのコストを削減できるかは測定していない
   * @returns {{get: (function(*=, *=)), setInfo: (function(*=, *=, *=)), setFailed: (function(*=, *=))}}
   * @constructor
   */
  let HistoryCache = function () {

    const CACHE_DROP_MARGIN = 40;

    let cache = new Map(); // LRUにするため順序付き

    // キャッシュのキー
    let getKey = (service_id, illust_id) => {
      return service_id + illust_id; // service_id は英大文字3と決めてるのでくっ付けるだけでいい
    };

    // ゲット
    let get = (service_id, illust_id) => {
      let k = getKey(service_id, illust_id);
      let v = cache.get(k);
      if (v !== undefined) {
        logger.debug('HIST CACHE HIT:', k);
        cache.delete(k); // LRU
        cache.set(k, v)
      }
      return v;
    };

    // セット
    let set = (service_id, illust_id, v)=> {
      let k = getKey(service_id, illust_id);
      cache.delete(k); // LRU
      cache.set(k, v);

      // keys()のコスト高そうな気がするので（未計測）、満杯になるごとに１個ずつ開けるのではなく CACHE_DROP_MARGIN 個分の空きを一気つくる
      if (cache.size >= prefs.historyCacheSize + CACHE_DROP_MARGIN) {
        let ks = Array.from(cache.keys()).slice(0, cache.size - prefs.historyCacheSize);
        logger.debug('HIST CACHE DROPPED:', ks);
        for (let i=0; i<ks.length; i++) {
          cache.delete(ks[i]);
        }
      }

      return v;
    };

    // 通常セット
    let setInfo = (service_id, illust_id, info) => {
      let v = {
        'service_id': service_id,
        'illust_id': illust_id
      };

      if (info) {
        v.member_id = info.member_id;
        v.last_saved = info.last_saved;
        v.age = isNaN(info.age) ? 1 : info.age;
      }
      else {
        v.empty = true; // 履歴DB上に存在しないことを表す
      }

      return set(service_id, illust_id, v);
    };

    // エラーセット
    let setFailed = (service_id, illust_id) => {
      let v  = get(service_id, illust_id) || {
        'service_id': service_id,
        'illust_id': illust_id,
        'empty': true
      };

      v.failed = true;

      return set(service_id, illust_id, v);
    };

    return {
      'get': get,
      'setInfo': setInfo,
      'setFailed': setFailed
    };
  };

  /**
   * ダウンロードクラス
   * @returns {{saveAs: (function(*=)), cleanup: (function())}}
   * @constructor
   */
  let Download = function () {

    const CLEANUP_DELAY = 5*60*1000;

    // content scriptとの接続が切れるまで落ちないそうなので、状態をストレージに保存しなくてもよいと思う
    let state = {};

    /**
     * いつまで経っても終了しないダウンロードを監視から外す
     * - downloadAPIにはオンメモリのオブジェクトのみを渡すようにしたので、リモートアクセスのタイムアウトを考慮したクリーンアップ処理は不要となった
     */
    let cleanupExpires = () => {
      let t = new Date().getTime();
      Object.keys(state)
        .filter((id) => {
          return state[id].start + CLEANUP_DELAY < t;
        })
        .forEach((id) => {
          let s = eraseDownloadItem(id);
          if (s) {
            s.onError(new Error('download timeout: '+s.filename));
          }
        });
    };

    /**
     * ダウンロードバーからアイテムを消す
     * - chromeではアイテムがどんどん増えていくので終了したら正常・異常関係なく消すこと
     * @param id
     */
    let eraseDownloadItem = (id) => {
      let s = state[id];
      if (s.cleanDownloadBar) {
        chrome.downloads.erase({'id': id}, () => {});
      }
      delete state[id];
      return s;
    };

    /**
     * ダウンロードの実行
     * @param opts
     * @returns {Promise}
     */
    let saveAs = (opts) => {
      return new Promise((resolve, reject) => {
        chrome.downloads.download({
          'url': opts.url,
          'filename': opts.filename,
          'saveAs': false,
          'conflictAction': prefs.overwriteExistingDownload ? 'overwrite' : 'uniquify'
        }, (id) => {
          if (id === undefined) {
            return reject(chrome.runtime.lastError);
          }

          return state[id] = {
            'id': id,
            'onSuccess': resolve,
            'onError': reject,
            'cleanDownloadBar': opts.cleanDownloadBar,
            'start': new Date().getTime()
          };
        });
      });
    };

    /**
     * ダウンロードの完了を監視する
     */
    let initOnDownloadCompletedListener = () => {
      chrome.downloads.onChanged.addListener((delta) => {
        if (!state.hasOwnProperty(delta.id)) {
          return;
        }

        //if (delta.error && delta.error.current !== 'USER_CANCELED') {
        if (delta.error) {
          logger.debug('download failed:', delta.id, delta.error);
          let s = eraseDownloadItem(delta.id);
          return s.onError(new Error(delta.error));
        }

        if (delta.state && delta.state.current === 'complete') {
          logger.debug('download completed:', delta.id);
          let s = eraseDownloadItem(delta.id);
          return s.onSuccess();
        }
      });
    };

    //

    // ダウンロードの終了待ち
    initOnDownloadCompletedListener();

    return {
      'saveAs': saveAs,
      'cleanup': cleanupExpires
    };
  };

  /**
   * DBの初期化
   */
  let initDatabase = async () => {
    let db = new Dexie('AnkPixiv');

    // 「〇〇日以前の履歴を削除」を実装する予定がなくなったので last_saved にインデックスを張るのを止める
    await db.version(3)
      .stores({
        'histories': '&[service_id+illust_id]',
        'members': '&[service_id+member_id]'
      });

    await db.open();

    return db;
  };

  /**
   * ツールバーボタンをクリックした際のイベントのハンドリング
   */
  let initBrowserAction = () => {
    chrome.browserAction.onClicked.addListener(() => {
      chrome.tabs.query(
        {
          'currentWindow': true,
          'active': true
        },
        (tab) => {
          if (tab && tab[0]) {
            chrome.tabs.sendMessage(tab[0].id, {'type': 'AnkPixiv.Download'}, () => {});
          }
          else {
            logger.warn('no active tab identified');
          }
        }
      );
    });
  };

  /**
   * メッセージを受けたときのハンドリング
   */
  let initMessageListener = () => {

    /**
     * ファイルに保存する（即時／単ファイル）
     * @param data
     * @param sender
     * @param sendResponse
     * @returns {boolean}
     */
    let saveTargetsAll = (data, sender, sendResponse) => {
      let sv = (t) => {
        return download.saveAs({
          'url': t.objurl || t.url,
          'filename': t.filename,
          'cleanDownloadBar': prefs.cleanDownloadBar
        })
          .then(() => {
            if (t.ownResource) {
              logger.debug('revoke', t.objurl);
              try {
                URL.revokeObjectURL(t.objurl);
                t.objurl = null;
              }
              catch (e) {
                logger.error(e);
              }
            }

            t.done = true;

            if (isMultiTargets) {
              setButtonText();
            }
          });
      };

      let us = (h) => {
        return new Promise((resolve) => {
          if (!h) {
            return resolve();
          }

          queryUpdateDownloadHistory({'hist_data': h}, null, resolve);
        });
      };

      let isMultiTargets = data.hasOwnProperty('targets');
      let targets = isMultiTargets && data.targets || [data.info];
      let hist_data = isMultiTargets && prefs.saveHistory && data.hist_data;

      // chromeの場合はcontents script側のObjectURLにアクセス可能なので、自分で作ったものかcontents scriptから渡されたものか判定しておく
      targets.forEach((t) => t.ownResource = !t.objurl);

      AnkUtils.downloadTargets(targets, sv, prefs.xhrTimeout)
        .then(() => {
          return us(hist_data);
        })
        .catch((e) => {
          return {'error': e};
        })
        .then((r) => {
          // finally
          sendResponse(r);
        });

      return true;
    };

    /**
     * ファイルに保存する（遅延実行／複数ファイル）
     * - ダウンロードが並行して動かないように順序制御を行うためのもの。XHRはbackground scriptで実行
     * @param data
     * @param sender
     * @param sendResponse
     * @returns {boolean}
     */
    let opDownloadQueue = (data, sender, sendResponse) => {

      const WAIT_FOR_NEXT = 200; // 次のダウンロード開始までの猶予

      if (data) {
        // ダウンロード情報の追加を要求された場合
        let q = downloadQueue.find(data.hist_data.service_id, data.hist_data.illust_id);
        if (q) {
          // すでにキューに居る
          return false;
        }

        downloadQueue.push(data.hist_data.service_id, data.hist_data.illust_id, data);
        sendDisplayMessage();
        setButtonText();
      }

      let f = downloadQueue.first();
      if (!f) {
        // キューが空
        return false;
      }

      let now = new Date().getTime();
      if (f.start) {
        // ダウンロード中のエントリがある
        if ((f.start + prefs.downloadTimeout) < now) {
          // タイムアウトしたものは管理外にして次に進む
          downloadQueue.drop(f);
          historyCache.setFailed(f.service_id, f.illust_id);
          sendDisplayMessage();
          setButtonText();

          opDownloadQueue(null, null, null);
        }

        return false;
      }

      // ダウンロード処理が長時間続いた場合に刈り取ってもらうための監視
      f.timerId = setTimeout(() => {
          f.timerId = 0;
          logger.debug('download timeout has occurred', f.service_id, f.illust_id);
          opDownloadQueue(null, null, null);
        },
        prefs.downloadTimeout + WAIT_FOR_NEXT
      );

      f.start = now;
      logger.debug('que sz', downloadQueue.size());

      new Promise((resolve) => {
        setShelfEnabled(false);
        saveTargetsAll(f.data, null, resolve);
      })
        .then((r) => {
          if (r && r.hasOwnProperty('error')) {
            return Promise.reject(r.error);
          }
          logger.debug('dwdn', r);
        })
        .catch((e) => {
          logger.error('dwer', e);
          historyCache.setFailed(f.service_id, f.illust_id);
        })
        .then(() => {
          // finally

          // タイムアウト後はバーが表示されてしまうことになるが仕方がない
          setShelfEnabled(true);

          if (f.expired) {
            // 時間切れで捨てられていれば、すでに次の処理が走っているはず
            return;
          }

          if (f.timerId) {
            // 刈り取り監視はキャンセル
            clearTimeout(f.timerId);
            f.timerId = 0;
          }

          // 次に進む
          downloadQueue.shift(f);
          sendDisplayMessage();
          setButtonText();

          setTimeout(() => opDownloadQueue(null, null, null), WAIT_FOR_NEXT);
        });

      return false;
    };

    /**
     * メンバー情報の検索
     * @param data
     * @param sender
     * @param sendResponse
     * @returns {boolean}
     */
    let queryGetMemberInfo = (data, sender, sendResponse) => {
      (async () => {
        let member = await db.members.get([data.service_id, data.member_id]);
        if (!member) {
          member = {
            'service_id': data.service_id,
            'member_id': data.member_id,
            'name': data.member_name
          };

          // エントリが存在しない場合は追加してしまう
          await db.members.add(member);
        }

        sendResponse(member);
      })()
        .catch((e) => {
          logger.error(e);
          sendResponse({'error': e});
        });

      return true;
    };

    /**
     * ダウンロード履歴を検索する
     */
    let queryGetDownloadStatus = (data, sender, sendResponse) => {

      let multi_target = Array.isArray(data.illust_id);

      let targets = multi_target ? data.illust_id : [data.illust_id];

      let results = [];
      let fetch_keys = [];

      if (data.ignore_cache) {
        // ダウンロード時の確認なのでキャッシュを見てはいけない
        fetch_keys = targets.map((illust_id) => {
          return [data.service_id, illust_id];
        });
      }
      else {
        targets.forEach((illust_id) => {
          let d = downloadQueue.find(data.service_id, illust_id);
          if (d) {
            // 現在ダウンロード対象になっている
            results.push({
              'service_id': data.service_id,
              'illust_id': illust_id,
              'downloading': true,
              'running': !!d.start
            });
            return;
          }

          let h = historyCache.get(data.service_id, illust_id);
          if (h) {
            if (h.empty && !h.failed) {
              return;
            }

            // 履歴キャッシュにヒットした(履歴DBに記録がある or 直前の結果がダウンロード失敗)
            results.push(h);
            return;
          }

          // 履歴キャッシュにnullで仮登録（whereでヒットしないものはeachで拾えないため）
          historyCache.setInfo(data.service_id, illust_id, null);

          // 履歴DB検索対象に追加
          fetch_keys.push([data.service_id, illust_id]);
        });
      }

      (async () => {
        if (fetch_keys.length > 0) {
          await db.histories.where('[service_id+illust_id]')
            .anyOf(fetch_keys)
            .each((s) => {
              let h = historyCache.setInfo(s.service_id, s.illust_id, s);
              results.push(h);
            });
        }

        sendResponse(multi_target ? results : results[0]);
      })()
        .catch((e) => {
          logger.error(e);
          sendResponse({'error': e});
        });

      return true;
    };

    /**
     * ダウンロード履歴を更新する
     */
    let queryUpdateDownloadHistory = (data, sender, sendResponse) => {
      historyCache.setInfo(data.hist_data.service_id, data.hist_data.illust_id, data.hist_data);
      db.histories.put(data.hist_data)
        .then(() => {
          sendResponse();
        })
        .catch((e) => {
          logger.error(e);
          sendResponse({'error': e});
        });

      return true;
    };

    /**
     * ダウンロード履歴をインポートする
     */
    let queryImportDownloadHistory = (data, sender, sendResponse) => {
      let imp = (t) => {
        return data[t].reduce((p, c) => p.then(() => db[t].put(c)), Promise.resolve())
          .then(() => {
            logger.debug(t, 'imported:', data[t].length);
          });
      };

      db.transaction('rw', db.histories, db.members, () => {
        if (data.hasOwnProperty('histories')) {
          imp('histories');
        }
        if (data.hasOwnProperty('members')) {
          imp('members');
        }
      })
        .then(() => {
          sendResponse();
        })
        .catch((e) => {
          logger.error(e);
          sendResponse({'error': e.toString()});
        });

      return true;
    };

    /**
     * ダウンロード履歴を初期化する
     */
    let queryClearDownloadHistory = (data, sender, sendResponse) => {
      db.histories.clear()
        .then(() => {
          return db.members.clear();
        })
        .then(() => {
          sendResponse();
        })
        .catch((e) => {
          logger.error(e);
          sendResponse({'error': e.toString()});
        });

      return true;
    };

    /**
     * ダウンロード履歴をエクスポートする
     */
    let queryExportDownloadHistory = (data, sender, postMessage) => {
      let exp = (t) => {
        let a = [];
        return db[t].each((r) => {
          a.push(r);
          if (a.length >= EXPORT_UNITS) {
            logger.debug(t, 'exported:', a.length);
            postMessage({'table': t, 'response': a});
            a = [];
          }
        })
          .then(() => {
            if (a.length > 0) {
              logger.debug(t, 'exported:', a.length);
              postMessage({'table': t, 'response': a});
            }
          });
      };

      exp('histories')
        .then(() => exp('members'))
        .then(() => postMessage())
        .catch((e) => {
          logger.error(e);
          postMessage({'error': e.toString()});
        });

      return true;
    };

    /**
     * サイトの最終更新時刻を返す
     */
    let queryGetSiteChanged = (data, sender, sendResponse) => {
      sendResponse(downloadQueue.getSiteChanged(data.service_id));

      return false;
    };

    //

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.tab) {
        switch (message.type) {
          case 'AnkPixiv.Execute.saveObject':
            return saveTargetsAll(message.data, sender, sendResponse);
          case 'AnkPixiv.Execute.saveTargetsAll':
            return saveTargetsAll(message.data, sender, sendResponse);
          case 'AnkPixiv.Execute.addToDownloadQueue':
            return opDownloadQueue(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.getMemberInfo':
            return queryGetMemberInfo(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.getDownloadStatus':
            return queryGetDownloadStatus(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.updateDownloadHistory':
            return queryUpdateDownloadHistory(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.importDownloadHistory':
            return queryImportDownloadHistory(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.clearDownloadHistory':
            return queryClearDownloadHistory(message.data, sender, sendResponse);
          case 'AnkPixiv.Query.getSiteChanged':
            return queryGetSiteChanged(message.data, sender, sendResponse);
          default:
            break;
        }
      }
    });

    chrome.runtime.onConnect.addListener((port) => {
      let postMessage = (msg) => {
        port.postMessage(msg);
      };

      if (port.name == 'AnkPixivChannel') {
        port.onMessage.addListener((message) => {
          switch (message.type) {
            case 'AnkPixiv.Query.exportDownloadHistory':
              return queryExportDownloadHistory(message.data, null, postMessage);
          }
        });
      }
    });
  };

  /**
   * タブにダウンロード済み表示の再実行を依頼する
   */
  let sendDisplayMessage = () => {
    chrome.tabs.query(
      {
        'currentWindow': true,
        'active': true
      },
      (tab) => {
        if (tab && tab[0]) {
          chrome.tabs.sendMessage(tab[0].id, {'type':'AnkPixiv.Display'}, () => {});
        }
        else {
          logger.warn('no active tab identified');
        }
      }
    );
  };

  /**
   * ツールバーボタンにダウンロード数を表示する
   */
  let setButtonText = () => {
    let a = [];
    if (prefs.showIllustRemains) {
      let remain = downloadQueue.remainImages();
      if (remain) {
        a.push(remain);
      }
      if (downloadQueue.size() > 0) {
        a.push(downloadQueue.size());
      }
    }
    chrome.browserAction.setBadgeText({'text': a.join('/')});
  };

  /**
   *
   * @param enabled
   */
  let setShelfEnabled = (enabled) => {
    if (prefs.hideDownloadShelf) {
      try {
        chrome.downloads.setShelfEnabled(enabled);
      }
      catch (e) {}
    }
  };

  /**
   * 変更された設定を反映する
   */
  let applyPrefsChange = () => {
    logger.setLevel(prefs.logLevel);
  };

  /*
   *
   */

  start()
    .catch((e) => {
      console.error(e);
    });

}
