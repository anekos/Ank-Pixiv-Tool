"use strict";

//

{

  // すぽーん
  var spawn = spawn || function (generatorFunc) {
      function continuer(verb, arg) {
        var result;
        try {
          result = generator[verb](arg);
        } catch (err) {
          return Promise.reject(err);
        }
        if (result.done) {
          // chainでつなげたーい
          return Promise.resolve(result.value);
          //return result.value;
        } else {
          return Promise.resolve(result.value).then(onFulfilled, onRejected);
        }
      }
      var generator = generatorFunc();
      var onFulfilled = continuer.bind(continuer, "next");
      var onRejected = continuer.bind(continuer, "throw");
      return onFulfilled();
    };

  //

  var AnkUtils = {};

  //

  AnkUtils.sleep = function (msec) {
    return new Promise(function (resolve) {
      setTimeout(() => resolve(), msec);
    });
  };

  //

  AnkUtils.delayFunctionInstaller = function (options) {
    return spawn(function* () {
      for (let retry=1; retry<=options.retry.max; retry++) {
        let r = options.prom ? yield options.prom() : options.func();
        if (r) {
          AnkUtils.Logger.debug('installed: '+(options.label || ''));
          return;
        }

        if (retry <= options.retry.max) {
          AnkUtils.Logger.debug('wait for retry: '+retry+'/'+options.retry.max+' : '+options.label);
          yield AnkUtils.sleep(options.retry.wait);
        }
      }

      return Promise.reject(new Error('retry over: '+options.label));
    });
  };

  //

  AnkUtils.createHTMLDocument = function (source) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(source , "text/html");
    if(!doc.getElementsByTagName("parsererror").length) {
      return doc;
    }
  };

  //

  AnkUtils.createElement = function (tagName, id, text, attr) {
    return AnkUtils._createElement(document.createElement(tagName), id, text, attr);
  };

  //
  AnkUtils.createElementNS = function (ns, tagName, id, text, attr) {
    return AnkUtils._createElement(document.createElementNS(ns, tagName), id, text, attr);
  };

  AnkUtils._createElement = function (e, id, text, attr) {
    if (id) {
      e.id = id;
    }
    if (text) {
      e.textContent = text;
    }
    if (attr) {
      for (let k in attr) {
        if (attr.hasOwnProperty(k) && attr[k] !== undefined) {
          e.setAttribute(k, attr[k]);
        }
      }
    }
    return e;
  };

  //

  AnkUtils.trackbackParentNode = function (node, n, targetClass) {
    if (n < 0) {
      return node.firstChild;
    }

    for (let i=0; node && i<n; i++) {
      node = node.parentNode;
      if (targetClass && node.classList.contains(targetClass)) {
        break;
      }
    }
    return node;
  };

  //

  AnkUtils.trim = function (str) {
    return str && str.replace(/^\s*|\s*$/g, '');
  };

  //

  AnkUtils.zeroPad = function(s, n) {
    let self = this;
    return s.toString().replace(new RegExp('^(.{0,'+(n-1)+'})$'), s => self.zeroPad('0'+s, n));
  };

  //

  AnkUtils.decodeDateTimeText = function (datetime) {
    if (!Array.isArray(datetime)) {
      datetime = [datetime];
    }

    for (let i=0; i<datetime.length; i++) {
      let d = this._decodeDateTimeText(datetime[i]);
      if (d) {
        return d;
      }
    }

    // 日時解析失敗時に、失敗フラグ＋現在日時を返す
    return this.getDecodedDateTime(new Date(), true);
  };

  AnkUtils._decodeDateTimeText = function (dText) {
    let self = this;
    // 時分 - 年月日
    function calc0 () {
      let m = dText.match(/^(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*)(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})/);
      if (!m)
        return;

      return new Date(
        parseInt(m[3]),
        parseInt(m[4])-1,
        parseInt(m[5]),
        parseInt(m[1]),
        parseInt(m[2]),
        0,
        0
      );
    }

    // 年/月/日 時:分
    function calc1 () {
      let m = dText.match(/(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2}))?/);
      if (!m)
        return;

      return new Date(
        parseInt(m[1]),
        parseInt(m[2])-1,
        parseInt(m[3]),
        m[4] ? parseInt(m[4]) : 0,
        m[5] ? parseInt(m[5]) : 0,
        0,
        0
      );
    }

    // 月日,年
    function calc2 () {
      let m = dText.match(/(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:st|nd|rd|th)?\s*,\s*(\d{4})/)
      if (!m)
        return;

      return new Date(
        parseInt(m[3]),
        parseInt(m[1])-1,
        parseInt(m[2]),
        0,
        0,
        0,
        0
      );
    }

    // 相対表記
    function calc3 () {
      let m = dText.match(/(an?|\d+) (min|hour|day|month|year)/)
      if (!m)
        return;

      // 'less than a minute ago', etc.
      let d = m[1].match(/an?/) ? 1 : m[1];
      let diff = 60 * 1000 * (
          m[2] === 'year'  ? d*1440*365 :
            m[2] === 'month' ? d*1440*31 :
              m[2] === 'day'   ? d*1440 :
                m[2] === 'hour'  ? d*60 :
                  d);

      d = new Date();
      if (diff) {
        d.setTime(d.getTime() - diff);
      }

      return d;
    }

    // 洋式
    function calcx () {
      let d = new Date(dText.replace(/(\s\d+)(?:st|nd|rd|th),/, "$1,"));
      return isNaN(d.getFullYear()) ? null : d;
    }

    // まずは明らかなゴミを排除 && 連続の空白をまとめる
    dText = dText.replace(/[^-,0-9a-zA-Z:\/\u5E74\u6708\u6642\s]/g, '').replace(/\s+/g, ' ').trim();
    let dd = calc0() || calc1() || calc2() || calc3() || calcx();   // 0は1と一部被るので0を前に
    if (!dd) {
      return;
    }

    return self.getDecodedDateTime(dd, false);
  };

  AnkUtils.getDecodedDateTime = function (dd, fault) {
    let o = {
      year: this.zeroPad(dd.getFullYear(), 4),
      month: this.zeroPad(dd.getMonth()+1, 2),
      day: this.zeroPad(dd.getDate(), 2),
      hour: this.zeroPad(dd.getHours(), 2),
      minute: this.zeroPad(dd.getMinutes(), 2),
      timestamp: dd.getTime(),
      fault: fault
    };
    o.ymd = o.year+'/'+o.month+'/'+o.day+' '+o.hour+':'+o.minute;
    return o;
  };

  //

  AnkUtils.createUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });
  };

  //

  AnkUtils.blobToArrayBuffer = function (blob) {
    return new Promise(function (resolve) {
      let reader = new FileReader();

      reader.onload = function () {
        resolve(this.result);
      };

      reader.readAsArrayBuffer(blob);
    });
  };

  //

  AnkUtils.PageScript = (function () {
    let TEMPLATE = `
      (function () {
        var t = (function () {
          try {
            return JSON.stringify(#GENOBJ#);
          } catch (e) {
            console.error(e);
          }
          return {};
        })();
        var e = new MessageEvent('#EVENTNAME#', {
          data: t,
          origin: location.protocol+'//'+location.host,
          source: window
        });
        document.dispatchEvent(e);
      })();`;

    function exec (doc, id, name, genObj, callback) {
      if (!callback) {
        return new Promise(function (resolve) {
          exec(doc, id, name, genObj, e => resolve(e));
        });
      }

      if (doc.querySelector('#'+id)) {
        return;
      }

      function handler (e) {
        e.target.removeEventListener(name, handler);
        e.target.body.removeChild(elm);
        callback(JSON.parse(e.data));
      }

      doc.addEventListener(name, handler);

      let elm = doc.createElement('script');
      elm.setAttribute('id', id);
      elm.textContent = TEMPLATE.replace(/#GENOBJ#/, genObj).replace(/#EVENTNAME#/, name);
      doc.body.appendChild(elm);
    }

    function insert (doc, id, script) {
      let elm = doc.createElement('script');
      elm.setAttribute('id', id);
      elm.textContent = script;
      doc.body.appendChild(elm);
    }

    function remove (doc, id) {
      let elm = doc.querySelector('#'+id);
      if (elm) {
        doc.body.removeChild(elm);
      }
    }

    return {
      exec: exec,
      insert: insert,
      remove: remove
    };
  })();

  //

  /**
   * XHR
   * @type {{get, post}}
   */
  AnkUtils.Remote = (function () {

    function get (options) {
      return request(options, false);
    }

    function post (options) {
      return request(options, true);
    }

    function request (options, post) {
      return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();
        xhr.open((post ? 'POST' : 'GET'), options.url, true);

        try {
          //xhr.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = false;
        } catch(ex) {
          /* unsupported by this version of FF */
        }

        if (options.responseType) {
          xhr.responseType = options.responseType;
        }

        xhr.onload = function () {
          // TODO 206 は発生するか？
          if (xhr.status == 200) {
            resolve(options.responseType && options.responseType !== 'text' ? xhr.response : xhr.responseText);
          } else {
            reject(new Error(xhr.statusText));
          }
        };

        xhr.error = function () {
          reject(new Error(xhr.statusText));
        };

        if (options.timeout !== undefined) {
          xhr.timeout = options.timeout;
          xhr.ontimeout = function () {
            reject(new Error(xhr.statusText));
          };
        }

        if (post) {
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        }

        if (options.headers) {
          options.headers.forEach(function (h) {
            let name = EXCHANGE_TARGETS.indexOf(h.name) != -1 ? EXCHANGE_PREFIX+h.name : h.name;
            xhr.setRequestHeader(name, h.value);
          });
        }

        xhr.send(post ? options.body : null);
      });
    }

    const EXCHANGE_TARGETS = ['Referer', 'Cookie'];
    const EXCHANGE_PREFIX = 'X-XXX-';

    // backgroundでリクエストヘッダの書き換え
    if (chrome.runtime.getBackgroundPage) {
      chrome.runtime.getBackgroundPage(function(background) {
        if (background !== window) {
          return;
        }

        chrome.webRequest.onBeforeSendHeaders.addListener(function (details) {
          let xIdx = null;
          details.requestHeaders.forEach(function (h, i) {
            if (h.name.startsWith(EXCHANGE_PREFIX)) {
              h.name = h.name.slice(EXCHANGE_PREFIX.length);
              xIdx = xIdx || {};
              xIdx[h.name] = i;
            }
          });

          if (!xIdx) {
            return {requestHeaders: details.requestHeaders};
          }

          let headers = details.requestHeaders.filter(function (h, i) {
            return !(xIdx.hasOwnProperty(h.name) && xIdx[h.name] != i);
          });

          return {requestHeaders: headers};
        }, {
          "urls": [
            "<all_urls>"
          ],
          "types": [
            "xmlhttprequest"
          ]
        }, [
          "requestHeaders",
          "blocking"
        ]);
      });
    }

    return {
      get: get,
      post: post
    };
  })();

  /**
   * ファイル名として使えない文字を除去する
   * @param filename ファイル名
   * @param opts オプション
   * @returns {string} ファイル名
   */
  AnkUtils.fixFilename = function (filename, opts) {
    opts = opts || {};
    if (!opts.file) {
      filename = filename.replace(/[\\\/]/g, '_');
    }
    if (!opts.token) {
      filename = filename.replace(/[\?]/g, '_');
    }
    filename = filename.replace(/\.+$/, '');
    return filename.replace(/[:;\*"<>\|#]/g, '_').replace(/[\n\r\t\xa0]/g, ' ').trim();
  };


  /**
   * ファイルの正しい拡張子を調べる
   * @param filename
   * @param data
   */
  AnkUtils.fixFileExt = function (filename, data) {
    let m = /(\.\w+)$/.exec(filename);
    let origExt = m && m[1].toString().toLowerCase();

    let header = String.fromCharCode.apply(null, new Uint8Array(data.slice(0, 10)));
    return (function() {
      if (/^\x89PNG/.test(header))
        return '.png';
      if (/^GIF8/.test(header))
        return '.gif';
      if (/^\x00\x00/.test(header) && /ftyp/.test(header))
        return '.mp4';
      if (/\x1A\x45\xDF\xA3/.test(header))
        return '.webm';
      if (/^PK\x03\x04/.test(header))
        return '.zip';
      if (/JFIF|^\xFF\xD8/.test(header))
        return '.jpg';

      AnkUtils.Logger.debug('fixFileExt: failed for unknown file type: '+filename);

      return origExt;
    })();
  };

  /**
   * URLからファイルの拡張子を取得する
   * @param filename
   * @returns {*|string}
   */
  AnkUtils.getFileExt = function (filename) {
    return (/\.(\w+?)(?:\?|$)/.exec(filename) || [])[1];
  };

  /**
   * ダウンロードを実行するクラス
   */
  AnkUtils.Download = (function () {
    let Download = function () {
      let self = this;

      self.ids = {};
      self.opts = {
        cleanDownloadBar: false
      };

      // ダウンロードの終了待ち
      chrome.downloads.onChanged.addListener(function (delta) {
        if (!self.ids.hasOwnProperty(delta.id)) {
          return;
        }

        let obj = self.ids[delta.id];
        let callback = obj.callback;

        let id = (function () {
          if (delta.error && delta.error.current !== 'USER_CANCELED') {
            callback({filename: obj.filename || delta.filename, error: new Error(delta.error.current)});
            return delta.id;
          }
          if (delta.state && delta.state.current === 'complete') {
            callback({filename: obj.filename || delta.filename});
            return delta.id;
          }
          if (delta.hasOwnProperty('filename')) {
            obj.filename = delta.filename.current;
          }
        })();

        if (self.ids.hasOwnProperty(id)) {
          delete self.ids[id];
          if (self.opts.cleanDownloadBar) {
            // 終了したら(正常・異常関係なく)ダウンロードバーから消す
            chrome.downloads.erase({'id': id}, function () {});
          }
        }
      });
    };

    Download.prototype.saveAs = function (blob, filename, options) {
      function _saveAs (data, filename, callback) {
        let objUrl = null;
        return new Promise(function (resolve, reject) {
          objUrl = typeof blob !== 'string' && URL.createObjectURL(blob);
          // FIXME 設定＞ダウンロード前に各ファイルの保存場所を確認する が有効だと saveAs:false でもダイアログが出てしまう > https://code.google.com/p/chromium/issues/detail?id=417112
          chrome.downloads.download({
            url: objUrl || blob,
            filename: filename,
            saveAs: false,
            conflictAction: 'overwrite'
          }, function (id) {
            if (id === undefined) {
              return reject(chrome.runtime.lastError);
            }

            self.ids[id] = {
              filename: filename,
              callback: callback
            };
            return resolve();
          });
        }).catch(function (e) {
          callback({filename: filename, error: e});
        }).then(function () {
          if (objUrl) {
            URL.revokeObjectURL(objUrl);
          }
        });
      }

      let self = this;

      if (options && options.hasOwnProperty('cleanDownloadBar')) {
        self.opts.cleanDownloadBar = options.cleanDownloadBar;
      }

      return new Promise(function (resolve) {
        _saveAs(blob, filename, o => resolve(o));
      });
    };

    //

    return Download;
  })();

  /**
   * 環境設定を操作するクラス
   */
  AnkUtils.Preference = (function () {
    let Preference = function (defaults) {
      let self = this;

      self.DEFAULTS = defaults || {};
      self.DEFAULT_KEYS = Object.keys(self.DEFAULTS);

      self.prefs = {};

      chrome.storage.onChanged.addListener(function (changes) {
        for (let k in changes) {
          if (changes.hasOwnProperty(k)) {
            self.prefs[k] = changes[k].newValue;
          }
        }
      });
    };

    Preference.prototype.put = function (obj) {
      return new Promise(function (resolve) {
        chrome.storage.local.set(obj, function () {
          resolve();
        });
      });
    };

    Preference.prototype.get = function () {
      let self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.get(self.DEFAULT_KEYS, function (result) {
          self.DEFAULT_KEYS.forEach(function (k) {
            let v = result[k];
            self.prefs[k] = v !== undefined ? v : self.DEFAULTS[k];
          });
          resolve(self.prefs);
        });
      });
    };

    Preference.prototype.remove = function (key) {
      let self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.remove(key, function () {
          if (self.prefs.hasOwnProperty(key)) {
            delete self.prefs[key];
          }
          resolve();
        });
      });
    };

    Preference.prototype.clear = function () {
      let self = this;
      return new Promise(function (resolve) {
        chrome.storage.local.clear(function () {
          self.prefs = {};
          resolve();
        });
      });
    };

    Preference.prototype.getKeys = function () {
      return this.DEFAULT_KEYS;
    };

    //

    return Preference;
  })();

  /**
   * 多言語対応メッセージの取得
   * @type {{getMessage}}
   */
  AnkUtils.Locale = (function () {
    function getMessage (key) {
      return chrome.i18n.getMessage(key);
    }

    return {
      getMessage: getMessage
    };
  })();


  /**
   * ログ出力
   * @type {{Level, setLevel, info, error, debug}}
   */
  AnkUtils.Logger = (function () {

    let Level = {
      ALL: 0,
      DEBUG: 1,
      INFO: 2,
      ERROR: 3,
      OFF: 4
    };

    let lv = Level.ALL;

    function debug () {
      if (lv <= Level.DEBUG) {
        console.debug.apply(console, arguments);
      }
    }

    function info () {
      if (lv <= Level.INFO) {
        console.log.apply(console, arguments);
      }
    }

    function error () {
      if (lv <= Level.ERROR) {
        console.error.apply(console, arguments);
      }
    }

    function setLevel (n) {
      lv = n;
    }

    return {
      Level: Level,
      setLevel: setLevel,
      info: info,
      error: error,
      debug: debug
    };
  })();

}
