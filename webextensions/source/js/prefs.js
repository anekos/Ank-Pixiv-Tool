"use strict";

{

  var AnkPrefs = (() => {

    const STORAGE_AREA = 'local';

    let prefs = null;

    /**
     * 階層の深い情報を平らにする
     * - chrome.storage.onChanged が最上位のメンバ単位で動くので、ネストしている情報も最上位のレベルのメンバになるように加工したオブジェクトを作る
     * @param items
     */
    let enc = (items) => {
      let f = (o, item, ka, depth) => {
        let typ = typeof item;
        if (item === null || item === undefined || typ == 'boolean' || typ == 'number' || typ == 'string') {
          o[ka.join('-')] = item;
        }
        else {
          Object.keys(item).forEach((k) => {
            if (k.startsWith('_')) {
              // 先頭が _ で始まっているものはそれ以上分解しない
              o[ka.concat(k).join('-')] = item[k];
            }
            else {
              f(o, item[k], ka.concat(k), depth+1)
            }
          });
        }
        return o;
      };

      return f({}, items, [], 0);
    };

    /**
     * encで平らにされた情報をもとの状態に戻す
     * @param items
     * @param oldPrefs
     */
    let dec = (items, oldPrefs) => {
      return ((o) => {
        Object.keys(items).forEach((k) => {
          let ka = k.split('-');
          let kk = ka.pop();
          let oo = ka.reduce((p, c) => {
            return p[c] = p[c] || {};
          }, o);
          oo[kk] = items[k];
        });
        return o;
      })(oldPrefs || {});
    };

    /**
     * 設定値を復元する
     * @param options_default
     * @returns {Promise}
     */
    let restore = (options_default) => {
      return new Promise((resolve) => {
        chrome.storage[STORAGE_AREA].get(enc(options_default), (items) => {
          resolve(prefs = dec(items));
        });
      });
    };

    /**
     * 設定値を保存する
     * @param options
     * @returns {Promise}
     */
    let save = (options) => {
      return new Promise((resolve) => {
        chrome.storage[STORAGE_AREA].set(enc(options), () => {
          resolve();
        });
      });
    };

    /**
     * 設定値が変更された際に、取得済みの情報にも自動で適用する
     * @param callback
     */
    let setAutoApply = (callback) => {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName != STORAGE_AREA) {
          return;
        }

        let items = {};
        Object.keys(changes).forEach((key) => {
          items[key] = changes[key].newValue;
        });

        dec(items, prefs);

        if (callback) {
          callback(prefs);
        }
      });
    };

    //
    return {
      'dec': dec,
      'enc': enc,
      'restore': restore,
      'save': save,
      'setAutoApply': setAutoApply
    };
  })();
}
