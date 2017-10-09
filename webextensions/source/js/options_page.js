"use strict";

{

  const SITE_MODULE_VALKEYS = ["enabled", "name", "folder", "useAutoDownload", "useDisplayDownloaded", "useMarkDownloaded", "useViewer"];

  //
  let setSiteList = () => {
    let createLabelBox = (text) => {
      let label = document.createElement('td');
      label.innerText = text;
      return label;
    };

    let createCheckBox = (member, siteId, checked) => {
      let id = ['siteModules', siteId , member].join('-');
      let chk_td = document.createElement('td');
      let chk_box = document.createElement('div');
      chk_box.classList.add('cbInTbl');
      chk_td.appendChild(chk_box);
      let chk = document.createElement('input');
      chk.setAttribute('type', 'checkbox');
      chk.setAttribute('id', id);
      chk.checked = checked;
      chk_box.appendChild(chk);
      return chk_td;
    };

    let createTextBox = (member, siteId, text) => {
      let id = ['siteModules', siteId , member].join('-');
      let txt_td = document.createElement('td');
      let txt_box = document.createElement('div');
      txt_box.classList.add('tbInTbl');
      txt_td.appendChild(txt_box);
      let txt = document.createElement('input');
      txt.setAttribute('type', 'text');
      txt.setAttribute('id', id);
      txt.value = text;
      txt_box.appendChild(txt);
      return txt_td;
    };

    let header = document.querySelector('#siteListContainer > thead');

    (() => {
      let box = document.createElement('tr');
      header.appendChild(box);
      SITE_MODULE_VALKEYS.forEach((value_key) => {
        let th = document.createElement('th');
        th.setAttribute('data-i18n', ['siteList', value_key].join('_'));
        box.appendChild(th);
      });
    })();

    let container = document.querySelector('#siteListContainer > tbody');

    let sms = OPTION_DEFAULT.siteModules;
    Object.keys(sms).sort().forEach((site_key) => {
      let box = document.createElement('tr');
      container.appendChild(box);
      SITE_MODULE_VALKEYS.forEach((value_key) => {
        let value = sms[site_key][value_key];
        let td = ((t) => {
          if (value !== undefined) {
            if (t == 'boolean') {
              return createCheckBox(value_key, site_key, false);
            }
            if (t == 'string') {
              if (value_key == 'name') {
                return createLabelBox(value);
              }
              return createTextBox(value_key, site_key, '');
            }
          }

          // 無効なアイテム
          return createLabelBox('');
        })(typeof value);
        box.appendChild(td);
      });
    });
  };

  // 表示テキストの変更
  let setLabels = () => {
    Array.prototype.forEach.call(document.querySelectorAll('*[data-i18n]'), (e) => {
      let key = e.getAttribute('data-i18n');
      e.textContent = chrome.i18n.getMessage('options_'+key) || '# UNDEFINED : '+key+' #';
    });
  };

  // ファイル名タグをファイル名ボックスにプッシュする
  let addFilenameTagPushEvent = () => {
    let pushToken = (e) => {
      if (e.target.tagName.toLowerCase() !== 'option') {
        return;
      }

      let token = e.target.value;
      let box = currentFilenameElement;
      let now = box.value;
      let [xp, yp] = [box.selectionStart, box.selectionEnd];
      let [xs, ys] = [now.slice(0, xp), now.slice(yp, now.length)];
      box.value = xs + token + ys;
      let zp = xp + token.length;
      box.setSelectionRange(zp, zp);
      box.focus();
    };

    let currentFilenameElement = document.getElementById('defaultFilename');

    Array.prototype.forEach.call(document.querySelectorAll('#filenameTags select'), (e) => {
      e.addEventListener('click', (e) => pushToken(e));
    });
  };

  // 初期値の設定
  let setOptionValues = (opts) => {
    let obj = AnkPrefs.enc(opts);
    Object.keys(obj).forEach((key) => {
      let e = document.getElementById(key);
      if (!e) {
        return;
      }

      let v = obj[key];
      let tagName = e.tagName.toLowerCase();
      if (tagName === 'input') {
        if (e.type === 'checkbox') {
          e.checked = v;
        }
        else {
          e.value = v;
        }
      }
      else if (tagName === 'select') {
        let eo = e.querySelector('option[value="' + v + '"]');
        if (eo) {
          eo.selected = true;
        }
      }
    });
  };

  // デフォルトに戻す
  let addResetEvent = () => {
    let apply = document.querySelector('#reset');
    apply.addEventListener('click', () => {
      setOptionValues(OPTION_DEFAULT);
    });
  };

  // 保存
  let addSaveEvent = () => {
    let apply = document.querySelector('#apply');
    apply.addEventListener('click', () => {

      let obj = {};

      Array.prototype.forEach.call(document.querySelectorAll('input, select'), (e) => {
        if (e.id) {
          let tagName = e.tagName.toLowerCase();
          if (tagName === 'input' && e.type === 'checkbox') {
            obj[e.id] = e.checked;
          }
          else if (tagName === 'input' && e.type === 'number') {
            try {
              obj[e.id] = parseInt(e.value, 10);
            }
            catch (e) {
              logger.error(e);
            }
          }
          else {
            obj[e.id] = ((v) => {
              try {
                if (/^-?(?:\d+|\d+\.\d+|\.\d+)$/.test(v)) {
                  return parseInt(v, 10);
                }
              }
              catch (e) {
                logger.error(e);
              }
              return v;
            })(e.value);
          }
        }
      });

      let opts = AnkPrefs.dec(obj);
      AnkPrefs.save(opts);
    });
  };

  // ダウンロード履歴インポートボタンのイベント
  let addImportHistoryEvent = () => {

    const IMPORT_UNITS = 1000;

    let requestImportHistory = async (target, src, getVal) => {
      let i = 0;
      let len = src.length;
      for (;;) {
        let data = {};
        let info = data[target] = [];
        for (; i < len && info.length < IMPORT_UNITS; i++) {
          let v = getVal(src[i]);
          if (v) {
            info.push(v);
          }
        }

        if (info.length == 0) {
          break;
        }

        await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
              'type': 'AnkPixiv.Query.importDownloadHistory',
              'data': data
            },
            (result) => {
              if (result && result.hasOwnProperty('error')) {
                reject(result.error);
              }
              resolve(result);
            }
          );
        });

        label.textContent = [target, 'imported', i, '/', len].join(' ');
        logger.debug(target, 'imported:', i);

        await AnkUtils.sleep(200);
      }
    };

    let button = document.querySelector('#importHistoryButton');
    let chooser = document.querySelector('#importHistory');
    let label = document.querySelector('#importHistoryLabel');

    // ファイルが選択されたら
    chooser.addEventListener('change', () => {
      let file = chooser.files[0];
      chooser.value = '';
      if (!file) {
        return;
      }

      label.textContent = 'now loading ...';

      AnkUtils.blobToJSON(file)
        .then(async (r) => {
          if (r && Array.isArray(r.h)) {
            await requestImportHistory('histories',
              r.h,
              (v) => {
                if (!v[0] || !v[1]) {
                  return;
                }

                return {
                  'service_id': v[0],
                  'illust_id': v[1],
                  'member_id': v[2],
                  'last_saved': parseInt(v[3], 10),
                  'age': /^\d+$/.test(v[4]) ? parseInt(v[4], 10) : 1
                };
            });
          }
          if (r && Array.isArray(r.m)) {
            await requestImportHistory('members',
              r.m,
              (v) => {
                if (!v[0] || !v[1]) {
                  return;
                }

                return {
                  'service_id': v[0],
                  'member_id': v[1],
                  'name': v[2]
                };
              })
          }

          label.textContent = 'completed';

          alert(chrome.i18n.getMessage('msg_importHistoryCompleted'));
        })
        .catch((e) => {
          logger.error(e);
          alert(chrome.i18n.getMessage('msg_importHistoryError'));
        });
    });

    // ボタンクリックで chooser を開く
    button.addEventListener('click', () => {
      chooser.click();
    });
  };

  //

  (async () => {
    let prefs = await AnkPrefs.restore(OPTION_DEFAULT);
    logger.setLevel(prefs.logLevel);

    setSiteList(prefs);
    setLabels();
    setOptionValues(prefs);
    addResetEvent();
    addSaveEvent();
    addFilenameTagPushEvent();
    addImportHistoryEvent();
  })();

}
