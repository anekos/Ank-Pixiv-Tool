"use strict";

class _AnkUtilsClass {

  constructor () {
    this.DT_DECODE_FUNCS = this._getDateTextDecodeFuncs();
  }

  /**
   * ミリ秒スリープ
   * @param mSec
   * @returns {Promise}
   */
  sleep (mSec) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(), mSec);
    });
  }

  /**
   * 指定階層上の先祖エレメントまで遡る
   * @param node
   * @param n
   * @param target 指定がある場合は n まで遡っていなくても見つかり次第返却
   * @returns {*}
   */
  trackbackParentNode (node, n, target) {
    let targetClass = target && target.cls;
    let targetTagName = target && target.tag;
    for (let i=0; i<n && node; i++, node = node.parentNode) {
      if (targetClass && node.classList.contains(targetClass) || targetTagName && node.tagName.toLowerCase() === targetTagName) {
        break;
      }
    }
    return node;
  }

  /**
   * スクロールバーの幅を返す
   * @returns {{width, height}}
   */
  getScrollbarSize () {
    let f = (wh) => {
      let outer = document.createElement('div');
      let inner = document.createElement('div');

      outer.style.visibility = 'hidden';
      outer.style[wh] = '100px';
      inner.style[wh] = '100%';

      outer.appendChild(inner);
      document.body.appendChild(outer);

      let owh = 'offset' + wh.charAt(0).toUpperCase() + wh.slice(1).toLowerCase();
      let withoutScrollbar = outer[owh];
      outer.style.overflow = 'scroll';
      let withScrollbar = inner[owh];

      document.body.removeChild(outer);

      return (withoutScrollbar - withScrollbar);
    };

    return {
      'width': f('width'),
      'height': f('height')
    };
  }

  /**
   * trimする
   * @param str
   * @returns {*|string|XML|void}
   */
  trim (str) {
    return str && str.replace(/^\s*|\s*$/g, '');
  }

  /**
   * innerHTML的なデータからテキストを抽出する(brは改行に変換)
   * @param t
   * @returns {string}
   */
  decodeTextContent (t) {
    // <br> -> \n
    t = t.replace(/<br\s*\/?>/ig, '\n');

    try {
      return new DOMParser().parseFromString(t, 'text/html').body.textContent;
    }
    catch (e) {}

    // DOMParser非対応の場合
    let f = (t) => {
      while (true) {
        let s = t.replace(/<([a-z]+?)[^>]*?>(.+?)<\/(\1)>/i, '$2');
        if (s.length == t.length) {
          return t;
        }
        t = s;
      }
    };

    return f(t);
  }

  /**
   * br を改行として認識する textContent
   *    elem:     要素
   *    return:   String;
   */
   getTextContent (e) {
     return this.decodeTextContent(e.innerHTML);
  }

  /**
   * ゼロパディングする
   * @param s
   * @param n
   * @returns {string}
   */
   zeroPad (s, n) {
    return s.toString().replace(new RegExp('^(.{0,'+(n-1)+'})$'), (s) => this.zeroPad('0'+s, n));
  }

  /**
   * decodeTextToDate が扱う各種日時形式に対応する変換処理
   * @returns {[*,*,*,*,*]}
   * @private
   */
  _getDateTextDecodeFuncs () {
    return [
      // A. 時分 - 年月日 (A.とB.は一部被るのでA.を優先する)
      (dText) => {
        let m = /^(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*)(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})/.exec(dText);
        if (m) {
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
      },

      // B. 年/月/日 時:分
      (dText) => {
        let m = /(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2}))?/.exec(dText);
        if (m) {
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
      },

      // C. 月日,年
      (dText) => {
        let m = /(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:st|nd|rd|th)?\s*,\s*(\d{4})/.exec(dText);
        if (m) {
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
      },

      // D. 相対表記('less than a minute ago', etc.) ※元々大雑把な値しかとれないので、年・月の計算は輪をかけて大雑把に
      (dText) => {
        let m = /(an?|\d+) (min|hour|day|month|year)/.exec(dText);
        if (m) {
          let d = /an?/.test(m[1]) ? 1 : m[1];
          let diff = 60 * 1000 * (
              m[2] === 'year'  ? d * 1440 * 365 :
              m[2] === 'month' ? d * 1440 * 31 :
              m[2] === 'day'   ? d * 1440 :
              m[2] === 'hour'  ? d * 60 :
              d
            );

          d = new Date();
          if (diff) {
            d.setTime(d.getTime() - diff);
          }

          return d;
        }
      },

      // E. 洋式
      (dText) => {
        let d = new Date(dText.replace(/(\s\d+)(?:st|nd|rd|th),/, "$1,"));
        if (!isNaN(d.getFullYear())) {
          return d;
        }
      }
    ];
  }

  /**
   * 日時表現テキストからDateに変換する
   * @param dText
   * @returns {*}
   */
   decodeTextToDate (dText) {
    // まずは明らかなゴミを排除 && 連続の空白をまとめる
    dText = dText.replace(/[^-+,0-9a-zA-Z:\/\u5E74\u6708\u6642\s]/g, '').replace(/\s+/g, ' ').trim();

    for (let i=0; i<this.DT_DECODE_FUNCS.length; i++) {
      let d = this.DT_DECODE_FUNCS[i](dText);
      if (d) {
        return d;
      }
    }
  }

  /**
   * 日時表現テキストからDateDataに変換する
   * @param dText
   * @returns {{year: string, month: string, day: string, hour: string, minute: string, timestamp: number, ymd: string, fault: boolean}}
   */
   decodeTextToDateData (dText) {
    if (!Array.isArray(dText)) {
      dText = [dText];
    }

    for (let i=0; i<dText.length; i++) {
      let d = this.decodeTextToDate(dText[i]);
      if (d) {
        return this.getDateData(d, false);
      }
    }

    // 日時解析失敗時に、失敗フラグ＋現在日時を返す
    return this.getDateData(new Date(), true);
  }

  /**
   * Dateを使いやすい形(DateData)に整形する
   * @param d
   * @param fault
   * @returns {{year: string, month: string, day: string, hour: string, minute: string, timestamp: number, ymd: string, fault: boolean}}
   */
   getDateData (d, fault) {
    let o = {
      'year': this.zeroPad(d.getFullYear(), 4),
      'month': this.zeroPad(d.getMonth()+1, 2),
      'day': this.zeroPad(d.getDate(), 2),
      'hour': this.zeroPad(d.getHours(), 2),
      'minute': this.zeroPad(d.getMinutes(), 2),
      'timestamp': d.getTime(),
      'ymd': '',
      'fault': !!fault
    };

    o.ymd = o.year+'/'+o.month+'/'+o.day+' '+o.hour+':'+o.minute;

    return o;
  }

  /**
   * "x.x.x" 形式のバージョン番号文字列の比較
   * @param a
   * @param b
   * @returns {number}
   */
   compareVersion (a, b) {
    a = a && a.split('.') || [];
    b = b && b.split('.') || [];

    while (a.length || b.length) {
      let ia = parseInt(a.shift() || 0);
      let ib = parseInt(b.shift() || 0);
      let d = ia - ib;
      if (d) {
        return d;
      }
    }

    return 0;
  }

  /**
   * blob -> ArrayBuffer
   * @param blob
   * @returns {Promise}
   */
   blobToArrayBuffer (blob) {
    return new Promise((resolve) => {
      let reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result);
      };

      reader.readAsArrayBuffer(blob);
    });
  }

  /**
   * blob -> DataURL
   * @param blob
   * @returns {Promise}
   */
   blobToDataURL (blob) {
    return new Promise((resolve) => {
      let reader = new FileReader();
      reader.onload = () =>{
        resolve(reader.result);
      };

      reader.readAsDataURL(blob);
    });
  }

  /**
   * blob -> JSON
   * @param blob
   * @returns {Promise.<TResult>}
   */
   blobToJSON (blob) {
    let objurl = URL.createObjectURL(blob);
    let json = null;
    let error = null;
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();

      xhr.open('GET', objurl, true);
      xhr.responseType = 'json';

      xhr.onload = () => {
        resolve(xhr.response);
      };

      xhr.error = (e) => {
        reject(e);
      };

      xhr.send();
    })
      .then((r) => {
        json = r;
      })
      .catch((e) => {
        error = e;
      })
      .then(() => {
        // finally
        URL.revokeObjectURL(objurl);

        if (error) {
          return Promise.reject(error);
        }

        return json;
      });
  }

  /**
   * ファイル名として使えない文字を除去する
   * @param filename ファイル名
   * @param opts オプション
   * @returns {string} ファイル名
   */
   fixFilename (filename, opts) {
    opts = opts || {};
    if (!opts.file) {
      filename = filename.replace(/[\\\/]/g, '_');
    }
    if (!opts.token) {
      filename = filename.replace(/[\?]/g, '_');
    }
    filename = filename.replace(/\.+$/, '');
    // \u061c\u200e-\u200f\u2028-\u202e\u2066-\u2069 : Bidi_Control characters, LS, PS
    return filename.replace(/[:;*"<>|#~]/g, '_').replace(/[\n\r\t\xa0\u061c\u200e-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').trim();
  }

  /**
   * URLからファイルの拡張子を取得する
   * @param filename
   * @returns {*|string}
   */
   getFileExt (filename) {
    return (/\.(\w+?)(?:\?|$)/.exec(filename) || [])[1];
  }

  /**
   * ファイルの拡張子を正しいものに置換する
   * @param filename
   * @param aBuffer
   */
   fixFileExt (filename, aBuffer) {
    let newExt = ((header) => {
      if (/^\x89PNG/.test(header))
        return 'png';
      if (/^GIF8/.test(header))
        return 'gif';
      if (/^\x00\x00/.test(header) && /ftyp/.test(header))
        return 'mp4';
      if (/\x1A\x45\xDF\xA3/.test(header))
        return 'webm';
      if (/^PK\x03\x04/.test(header))
        return 'zip';
      if (/JFIF|^\xFF\xD8/.test(header))
        return 'jpg';
    })(String.fromCharCode.apply(null, new Uint8Array(aBuffer)));

    if (!newExt) {
      logger.warn('fixFileExt: failed for unknown file type: '+filename);
      return filename;
    }

    return filename.replace(/\.(?:\w+?)(\?|$)/, (m,a) => ['.',newExt,a].join(''));
  }

  /**
   * ターゲットを順次ダウンロードする（objurlは呼び出し側でrevokeしてね）
   * @param targets
   * @param saveAs
   * @param timeout
   * @returns {Promise.<*>}
   */
  async downloadTargets (targets, saveAs, timeout) {
    try {
      for (let i=0; i < targets.length; i++) {
        let t = targets[i];
        if (t.data) {
          // データを渡された場合
          t.objurl = URL.createObjectURL(new Blob([t.data], {'type': 'application/octet-binary'}));
        }
        else if (t.url) {
          // urlを渡された場合
          let resp = await remote.get({
            'url': t.url,
            'headers': t.headers || [],
            'timeout': timeout,
            'responseType': 'arrayBuffer'
          });

          t.filename = this.fixFileExt(t.filename, resp.arrayBuffer.slice(0, 16));

          t.objurl = URL.createObjectURL(new Blob([new Uint8Array(resp.arrayBuffer)], {'type': 'application/octet-binary'}));
        }
        else {
          logger.warn('invalid download target:', t);
          continue;
        }

        await saveAs(t);
      }
    }
    catch (e) {
      logger.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * executeSiteScript の戻り値を受け取るハンドラ
   * @param ev
   * @param elmScript
   * @param evName
   * @param callback
   */
   siteScriptReceiver (ev, elmScript, evName, callback) {
    ev.target.removeEventListener(evName, this.siteScriptReceiver);
    if (ev.target.parentNode) {
      ev.target.parentNode.removeChild(elmScript);
    }
    callback(JSON.parse(ev.data));
  }

  /**
   * サイトにスクリプトを埋め込んで情報を得る
   * @param id
   * @param evName
   * @param genObj
   * @param callback
   * @returns {Promise|undefined}
   */
   executeSiteScript (id, evName, genObj, callback) {
    if (!callback) {
      return new Promise((resolve) => {
        this.executeSiteScript(id, evName, genObj, (r) => resolve(r));
      });
    }

    const SCRIPT_TEMPLATE = `
      (function () {
        let t = (function () {
          try {
            return JSON.stringify(#GENOBJ#);
          } catch (e) {
            console.error(e);
          }
          return {};
        })();
        let e = new MessageEvent('#EVENTNAME#', {
          'data': t,
          'origin': location.protocol+'//'+location.host,
          'source': window
        });
        document.dispatchEvent(e);
      })();`;

    if (!document.getElementById(id)) {
      let elmScript = document.createElement('script');
      elmScript.id = id;
      elmScript.textContent = SCRIPT_TEMPLATE.replace(/#GENOBJ#/, genObj).replace(/#EVENTNAME#/, evName);

      document.addEventListener(evName, (ev) => this.siteScriptReceiver(ev, elmScript, evName, callback));

      document.body.appendChild(elmScript);

      elmScript = null;
    }
  }

  /**
   *
   * @param doc
   * @param evName
   * @param script
   * @returns {Promise}
   */
  executeScript (doc, evName, genObj) {
    return new Promise((resolve, reject) => {
      const INSERT_SCRIPT = `
        (#GENOBJ#)().then((e) => {
          try {
            let ev = new MessageEvent('#EVENTNAME#', {
              'data': JSON.stringify(e),
              'origin': location.protocol+'//'+location.host,
              'source': window
            });
            document.dispatchEvent(ev);
          }
          catch (e) {
            return Promise.reject(e);
          }
        }).catch((e) => {
          let ev = new MessageEvent('#EVENTNAME#', {
            'data': null,
            'error': JSON.stringify(e),
            'origin': location.protocol+'//'+location.host,
            'source': window
          });
          document.dispatchEvent(ev);
        });`;

      let handler = (e) => {
        if (e.error) {
          reject(JSON.parse(e.error));
        }
        else {
          resolve(JSON.parse(e.data));
        }
        doc.removeEventListener(evName, handler);
      };

      doc.addEventListener(evName, handler);

      let e = doc.createElement('script');
      e.textContent = INSERT_SCRIPT.replace(/#GENOBJ#/, genObj).replace(/#EVENTNAME#/, evName);
      (doc.head||doc.documentElement).appendChild(e);
      e.remove();
    })
  }

  /**
   *
   * @param doc
   */
  overridePushState (doc) {
    // ページに埋め込むスクリプト
    const INSERT_FUNC = function () {
      if (window.__ankpixiv_pushstate_override) {
        return;
      }

      window.__ankpixiv_pushstate_override = true;

      if (typeof window.history.pushState !== 'object') {
        console.log('override pushState');
        let NativePushState = window.history.pushState;
        window.history.pushState = function () {
          let r = NativePushState.apply(window.history, arguments);
          window.postMessage({
            'data': JSON.parse(JSON.stringify(arguments)),
            'type': 'AnkPixiv.onPushState'
          });
          return r;
        };
      }

      if (typeof window.history.replaceState !== 'object') {
        console.log('override replaceState');
        let NativeReplaceState = window.history.replaceState;
        window.history.replaceState = function () {
          let r = NativeReplaceState.apply(window.history, arguments);
          window.postMessage({
            'data': JSON.parse(JSON.stringify(arguments)),
            'type': 'AnkPixiv.onReplaceState'
          });
          return r;
        };
      }
    };

    doc = doc || document;

    let e = doc.createElement('script');
    e.textContent = '('+ INSERT_FUNC.toString() + ')();';
    (doc.head||doc.documentElement).appendChild(e);
    e.remove();
  }

  /**
   * 機能の遅延インストール
   * @param opts
   * @returns {Promise}
   */
  async delayFunctionInstaller (opts) {
    let loc = document.location.href;
    for (let retry=1; retry <= opts.retry.max; retry++) {
      let installed = await opts.func();
      if (installed) {
        logger.info('installed:', (opts.label || ''));
        return;
      }

      if (retry <= opts.retry.max) {
        logger.info('wait for retry:', retry, '/', opts.retry.max ,':', opts.label);
        await this.sleep(opts.retry.wait);
      }

      if (loc != document.location.href) {
        // コンテンツの入れ替えがあったら終了
        return Promise.reject(new Error('quit: '+ opts.label));
      }
    }

    return Promise.reject(new Error('retry over:', opts.label));
  }

}

var AnkUtils = new _AnkUtilsClass();
