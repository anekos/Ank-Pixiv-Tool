"use strict";

{

  var AnkPrefs = (() => {

    let prefs = null;

    //
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

    //
    let enc = (items) => {
      let f = (o, item, ka, depth) => {
        let typ = typeof item;
        if (item === null || typ == 'boolean' || typ == 'number' || typ == 'string') {
          o[ka.join('-')] = item;
          return;
        }

        Object.keys(item).forEach((k) => f(o, item[k], ka.concat(k), depth+1));
      };

      return ((o) => {
        Object.keys(items).forEach((k) => f(o, items[k], [k], 0));
        return o;
      })({});
    };

    //
    let restore = (options_default) => {
      return new Promise((resolve) => {
        chrome.storage.local.get(enc(options_default), (items) => {
          resolve(prefs = dec(items));
        });
      });
    };

    //
    let save = (options) => {
      return new Promise((resolve) => {
        chrome.storage.local.set(enc(options), () => {
          resolve();
        });
      });
    };

    //
    let setAutoApply = (callback) => {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName != 'local') {
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
