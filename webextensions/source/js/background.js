"use strict";

{

  (() => {

    /**
     * DBの初期化
     */
    let initDatabase = async () => {
      let db = new Dexie('AnkPixiv');

      // 履歴削除用のキー追加
      await db.version(2)
        .stores({
          'histories': '&[service_id+illust_id], last_saved',
          'members': '&[service_id+member_id]'
        });

      await db.version(1)
        .stores({
          'histories': '&[service_id+illust_id]',
          'members': '&[service_id+member_id]'
        });

      await db.open();

      return db;
    };

    /**
     * ダウンロードクラスの初期化
     * @returns {*}
     */
    let initDownload = () => {

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
            logger.log('download failed:', delta.id, delta.error);
            let s = eraseDownloadItem(delta.id);
            return s.onError(new Error(delta.error));
          }

          if (delta.state && delta.state.current === 'complete') {
            logger.log('download completed:', delta.id);
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
            chrome.tabs.sendMessage(tab[0].id, {'type': 'AnkPixiv.Download'}, () => {});
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
            .then((r) => {
              if (isMultiTargets) {
                setButtonText();
              }
              return r;
            });
        };

        let us = (h) => {
          return new Promise((resolve) => {
            if (!h) {
              return resolve();
            }

            queryUpdateDownloadStatus({'info': h}, null, resolve);
          });
        };

        let isMultiTargets = data.hasOwnProperty('targets');
        let targets = isMultiTargets && data.targets || [data.info];
        let hist_data = isMultiTargets && prefs.saveHistory && data.hist_data;

        let isOwnResource = targets.length > 0 && !targets[0].objurl;

        AnkUtils.downloadTargets(targets, sv, prefs.xhrTimeout)
          .then((r) => {
            return us(hist_data)
              .then((u) => {
                if (u && u.hasOwnProperty('error')) {
                  return u;
                }
                return {'result': r};
              });
          })
          .catch((e) => {
            return {'error': e};
          })
          .then((r) => {
            // finally
            if (isOwnResource) {
              targets.forEach((t) => {
                let objURL = t.objurl;
                if (objURL) {
                  t.objurl = null;
                  logger.log('revoke', objURL);
                  try {
                    URL.revokeObjectURL(objURL);
                  }
                  catch (e) {}
                }
              });
            }

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

        const WAITS_FOR_NEXT = 200;

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
            logger.log('download timeout has occurred', f.service_id, f.illust_id);
            opDownloadQueue(null, null, null);
          },
          prefs.downloadTimeout + WAITS_FOR_NEXT
        );

        f.start = now;
        logger.log('que sz', downloadQueue.size());

        new Promise((resolve) => {
          saveTargetsAll(f.data, null, resolve);
        })
          .then((r) => {
            logger.log('dwdn', r);
          })
          .catch((e) => {
            logger.error('dwer', e);
            historyCache.setFailed(f.service_id, f.illust_id);
          })
          .then(() => {
            // finally
            if (f.expired) {
              // 時間切れで捨てられていれば、すでに次の処理が走っているはず
              return;
            }

            if (f.timerId) {
              clearTimeout(f.timerId);
              f.timerId = 0;
            }

            // 次に進む
            downloadQueue.shift(f);
            sendDisplayMessage();
            setButtonText();

            setTimeout(() => opDownloadQueue(null, null, null), WAITS_FOR_NEXT);
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
        })();

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
        })();

        return true;
      };

      /**
       * ダウンロード履歴を更新する
       */
      let queryUpdateDownloadStatus = (data, sender, sendResponse) => {
        historyCache.setInfo(data.info.service_id, data.info.illust_id, data.info);
        db.histories.put(data.info)
          .catch((e) => {
            logger.error(e);
            return {'error': e};
          })
          .then((r) => {
            // finally
            sendResponse(r);
          });

        return true;
      };

      /**
       * ダウンロード履歴をインポートする
       */
      let queryImportDownloadHistory = (data, sender, sendResponse) => {
        db.transaction('rw', db.histories, db.members, async () => {
          if (data.hasOwnProperty('histories')) {
            let len = data.histories.length;
            for (let i=0; i < len; i++) {
              await db.histories.put(data.histories[i]);
            }
            logger.log('histories imported:', len);
          }
          if (data.hasOwnProperty('members')) {
            let len = data.members.length;
            for (let i=0; i < len; i++) {
              await db.members.put(data.members[i]);
            }
            logger.log('members imported:', len);
          }
        })
          .catch((e) => {
            logger.error(e);
            return {'error': e};
          })
          .then((r) => {
            // finally
            sendResponse(r);
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
            case 'AnkPixiv.Query.updateDownloadStatus':
              return queryUpdateDownloadStatus(message.data, sender, sendResponse);
            case 'AnkPixiv.Query.importDownloadHistory':
              return queryImportDownloadHistory(message.data, sender, sendResponse);
            case 'AnkPixiv.Query.getSiteChanged':
              return queryGetSiteChanged(message.data, sender, sendResponse);
            default:
              break;
          }
        }
      });
    };

    /**
     * タブにダウンロード済み表示の再実行を依頼する
     */
    let sendDisplayMessage = () => {
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
     * ツールバーボタンにダウンロード数を表示する
     */
    let setButtonText = () => {
      let text = (() => {
        let a = [];
        if (prefs.showImageRemains) {
          let remain = downloadQueue.remainImages();
          if (remain) {
            a.push(remain);
          }
        }
        if (prefs.showIllustRemains && downloadQueue.size() > 0) {
          a.push(downloadQueue.size());
        }

        return a.join('/');
      })();
      chrome.browserAction.setBadgeText({'text': text});
    };

    //

    // 複数のダウンロードが同時に動いてサーバに負荷をかけるのを防ぐため順序制御を行う
    let downloadQueue = (() => {

      let queue = [];
      let changed = {};
      let szImages = 0;

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

      let first = () => {
        return queue[0];
      };

      let shift = (f) => {
        if (queue[0] === f) {
          queue.shift();
          changed[f.service_id] = new Date().getTime();
          szImages -= f.data.targets.length;
        }
        return f;
      };

      let drop = (f) => {
        shift(f);
        f.expired = true;

        let remains = f.data.targets.length - (1 + f.data.targets.findIndex((e) => !e.objurl));
        setTimeout(() => {
          // FIXME 単に捨てるのではなく、保存しておいてある程度時間が経ったらrevokeするべき（リーク対策）
        }, prefs.xhrTimeout * remains);
      };

      let find = (service_id, illust_id) => {
        return queue.find((e) => {
          return e.service_id == service_id && e.illust_id == illust_id;
        });
      };

      let getSiteChanged = (service_id) => {
        // 最後のダウンロード実行時刻より後にマーキングを行っているなら、再度マーキングチェックを行う必要がない
        return changed[service_id] || 0;
      };

      let size = () => {
        return queue.length;
      };

      let sizeImages = () => {
        return szImages;
      };

      let remainImages = () => {
        let f = first();
        if (!f || !f.start) {
          return szImages;
        }

        let completed = 1 + f.data.targets.findIndex((e) => !e.objurl);

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
    })();

    // DBアクセス削減のためのキャッシュだが、実際にどれだけのコストを削減できるかは測定していない
    let historyCache = (() => {

      const CACHE_DROP_MARGIN = 20;

      let cache = new Map();

      let getKey = (service_id, illust_id) => {
        return service_id + illust_id;
      };

      let get = (service_id, illust_id) => {
        let k = getKey(service_id, illust_id);
        let v = cache.get(k);
        if (v !== undefined) {
          // LRU
          logger.log('HIST CACHE HIT:', k);
          cache.delete(k);
          cache.set(k, v)
        }
        return v;
      };

      let set = (service_id, illust_id, v)=> {
        // LRU
        let k = getKey(service_id, illust_id);
        cache.delete(k);
        cache.set(k, v);

        // FIXME keys()のコスト高そうな気がする
        if (cache.size > prefs.historyCacheSize + CACHE_DROP_MARGIN) {
          let it = cache.keys();
          for (let wk = it.next(); wk && cache.size > prefs.historyCacheSize; wk = it.next()) {
            logger.log('HIST CACHE DROPPED:', wk.value);
            cache.delete(wk.value);
          }
        }

        return v;
      };

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
          v.empty = true;
        }

        return set(service_id, illust_id, v);
      };

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
    })();

    let prefs = null;
    let db = null;
    let download = null;

    (async () => {
      prefs = await AnkPrefs.restore(OPTION_DEFAULT);
      logger.setLevel(prefs.logLevel);

      logger.info('START: ANK PIXIV TOOL');

      db = await initDatabase();
      download = initDownload();
      initBrowserAction();
      initMessageListener();
    })()
      .catch((e) => {
        console.error(e);
      });

  })();

}
