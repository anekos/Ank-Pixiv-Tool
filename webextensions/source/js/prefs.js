"use strict";

{

  var AnkPrefs = (() => {

    //
    let dec = (items) => {
      return ((o) => {
        Object.keys(items).forEach((k) => {
          if (!k.startsWith('siteModules')) {
            o[k] = items[k];
            return;
          }

          let ka = k.split('-');
          if (ka.length != 3) {
            return;
          }

          o.siteModules = o.siteModules || {};
          o.siteModules[ka[1]] = o.siteModules[ka[1]] || {};
          o.siteModules[ka[1]][ka[2]] = items[k];
        });
        return o;
      })({});
    };

    //
    let enc = (items) => {
      return ((o) => {
        Object.keys(items).forEach((k) => {
          if (k != 'siteModules') {
            o[k] = items[k];
            return;
          }

          Object.keys(items[k]).forEach((siteId) => {
            Object.keys(items[k][siteId]).forEach((key) => {
              o[['siteModules', siteId, key].join('-')] = items[k][siteId][key];
            });
          });
        });
        return o;
      })({});
    };

    //
    let restore = (options_default) => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(enc(options_default), (items) => {
          resolve(dec(items));
        });
      });
    };

    let save = (options) => {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set(enc(options), () => {
          resolve();
        });
      });
    };

    //
    return {
      restore: restore,
      save: save,
      dec: dec,
      enc: enc
    };

  })();

}
