"use strict";

{
  // 表示テキストの変更
  let setLabels = function () {
    Array.prototype.forEach.call(document.querySelectorAll('*[data-i18n]'), function (e) {
      var key = e.getAttribute('data-i18n');

      e.textContent = AnkUtils.Locale.getMessage('options_'+key) || '# UNDEFINED : '+key+' #';
    });
  };

  //
  let setList = function () {
    function createCheckbox (member, siteId, checked) {
      var id = 'siteModule_'+siteId+'_'+member;
      var chk_td = document.createElement('td');
      var chk_box = document.createElement('div');
      chk_box.classList.add('cbInTbl');
      chk_td.appendChild(chk_box);
      var chk = document.createElement('input');
      chk.setAttribute('type', 'checkbox');
      chk.setAttribute('id', id);
      chk.checked = checked;
      chk_box.appendChild(chk);
      return chk_td;
    }

    function createTextBox (member, siteId, text) {
      var id = 'siteModule_'+siteId+'_'+member;
      var txt_td = document.createElement('td');
      var txt_box = document.createElement('div');
      txt_box.classList.add('tbInTbl');
      txt_td.appendChild(txt_box);
      var txt = document.createElement('input');
      txt.setAttribute('type', 'text');
      txt.setAttribute('id', id);
      txt.value = text;
      txt_box.appendChild(txt);
      return txt_td;
    }

    var container = document.querySelector('#siteListContainer > tbody');

    var opts = {};
    AnkPrefs.getKeys().forEach(function (key) {
      var m = /^siteModule_([A-Z]+)_(.+)$/.exec(key);
      if (m) {
        opts[m[1]] = opts[m[1]] || {};
        opts[m[1]][m[2]] = prefs[key];
      }
    });

    prefs.siteModules.forEach(function (siteId) {
      var value = opts[siteId];
      if (!value) {
        return;
      }

      var box = document.createElement('tr');

      var chk_en_box = createCheckbox('enabled', siteId, value.enabled);
      box.appendChild(chk_en_box);

      var name = document.createElement('td');
      box.appendChild(name);

      var txt_sn_box = createTextBox('folder', siteId, value.folder);
      box.appendChild(txt_sn_box);

      var chk_ad_box = createCheckbox('useAutoDownload', siteId, value.useAutoDownload);
      box.appendChild(chk_ad_box);

      var chk_vw_box = createCheckbox('useViewer', siteId, value.useViewer);
      box.appendChild(chk_vw_box);

      name.innerText = value.name;
      container.appendChild(box);
    });
  };

  // 初期値の設定
  let setOptionValues = function () {
    spawn(function* () {
      AnkPrefs.getKeys().forEach(function (key) {
        var e = document.querySelector('#'+key);
        if (!e) {
          return;
        }

        var v = prefs[key];
        var tagName = e.tagName.toLowerCase();
        if (tagName === 'input') {
          if (e.type === 'checkbox') {
            e.checked = v;
          }
          else {
            e.value = v;
          }
        }
        else if (tagName === 'select') {
          var eo = e.querySelector('option[value="'+v+'"]');
          if (eo) {
            eo.selected = true;
          }
        }
      });
    });
  };

  // 保存
  let addSaveEvent = function () {
    var apply = document.querySelector('#apply');
    apply.addEventListener('click', function () {

      var obj = {};

      Array.prototype.forEach.call(document.querySelectorAll('input, select'), function (e) {
        if (e.id) {
          var tagName = e.tagName.toLowerCase();
          if (tagName === 'input' && e.type === 'checkbox') {
            obj[e.id] = e.checked;
          }
          else {
            obj[e.id] = (function (v) {
              try {
                if (/^-?(?:\d+|\d+\.\d+|\.\d+)$/.test(v)) {
                  return parseInt(v, 10);
                }
              }
              catch (e) {}
              return v;
            })(e.value);
          }
        }
      });

      AnkPrefs.put(obj);
    });
  };

  //

  let prefs = null;

  spawn(function* () {
    prefs = yield AnkPrefs.get();

    setLabels();
    setList();
    setOptionValues();
    addSaveEvent();
  });

}
