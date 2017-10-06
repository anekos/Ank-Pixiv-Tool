"use strict";

{

  var AnkUtils = (() => {

    //
    let sleep = (msec) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(), msec);
      });
    };

    //
    let _createElement = (e, id, text, attr) => {
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

    let createElement = (tagName, id, text, attr) => {
      return _createElement(document.createElement(tagName), id, text, attr);
    };

    let createElementNS = (ns, tagName, id, text, attr) => {
      return _createElement(document.createElementNS(ns, tagName), id, text, attr);
    };

    //
    let trackbackParentNode = (node, n, targetClass) => {
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

    let getScrollbarSize = () => {
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
    };

    //
    let trim = (str) => {
      return str && str.replace(/^\s*|\s*$/g, '');
    };

    //
    let zeroPad = (s, n) => {
      return s.toString().replace(new RegExp('^(.{0,'+(n-1)+'})$'), (s) => zeroPad('0'+s, n));
    };

    //
    let getDecodedDateTime = (dd, fault) => {
      let o = {
        year: zeroPad(dd.getFullYear(), 4),
        month: zeroPad(dd.getMonth()+1, 2),
        day: zeroPad(dd.getDate(), 2),
        hour: zeroPad(dd.getHours(), 2),
        minute: zeroPad(dd.getMinutes(), 2),
        timestamp: dd.getTime(),
        fault: fault
      };
      o.ymd = o.year+'/'+o.month+'/'+o.day+' '+o.hour+':'+o.minute;
      return o;
    };

    //
    let decodeDateTimeText = function (datetime) {
      if (!Array.isArray(datetime)) {
        datetime = [datetime];
      }

      for (let i=0; i<datetime.length; i++) {
        let d = _decodeDateTimeText(datetime[i]);
        if (d) {
          return d;
        }
      }

      // 日時解析失敗時に、失敗フラグ＋現在日時を返す
      return getDecodedDateTime(new Date(), true);
    };

    let _decodeDateTimeText = (dText) => {
      // 時分 - 年月日
      let calc0 = () => {
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
      };

      // 年/月/日 時:分
      let calc1 = () => {
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
      };

      // 月日,年
      let calc2 = () => {
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
      };

      // 相対表記
      let calc3 = () => {
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
      };

      // 洋式
      let calcx = () => {
        let d = new Date(dText.replace(/(\s\d+)(?:st|nd|rd|th),/, "$1,"));
        return isNaN(d.getFullYear()) ? null : d;
      };

      // まずは明らかなゴミを排除 && 連続の空白をまとめる
      dText = dText.replace(/[^-,0-9a-zA-Z:\/\u5E74\u6708\u6642\s]/g, '').replace(/\s+/g, ' ').trim();
      let dd = calc0() || calc1() || calc2() || calc3() || calcx();   // 0は1と一部被るので0を前に
      if (!dd) {
        return;
      }

      return getDecodedDateTime(dd, false);
    };

    //
    let createUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    };

    //
    let blobToArrayBuffer = (blob) => {
      return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result);
        };

        reader.readAsArrayBuffer(blob);
      });
    };

    //
    let blobToDataURL = (blob) => {
      return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = () =>{
          resolve(reader.result);
        };

        reader.readAsDataURL(blob);
      });
    };

    //
    let blobToJSON = (blob) => {
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
          URL.revokeObjectURL(objurl);

          if (error) {
            return Promise.reject(error);
          }
          return json;
        });
    };

    /**
     * ファイル名として使えない文字を除去する
     * @param filename ファイル名
     * @param opts オプション
     * @returns {string} ファイル名
     */
    let fixFilename = (filename, opts) => {
      opts = opts || {};
      if (!opts.file) {
        filename = filename.replace(/[\\\/]/g, '_');
      }
      if (!opts.token) {
        filename = filename.replace(/[\?]/g, '_');
      }
      filename = filename.replace(/\.+$/, '');
      return filename.replace(/[:;\*"<>\|#~]/g, '_').replace(/[\n\r\t\xa0]/g, ' ').trim();
    };

    /**
     * URLからファイルの拡張子を取得する
     * @param filename
     * @returns {*|string}
     */
    let getFileExt = (filename) => {
      return (/\.(\w+?)(?:\?|$)/.exec(filename) || [])[1];
    };

    /**
     * ファイルの拡張子を正しいものに置換する
     * @param filename
     * @param aBuffer
     */
    let fixFileExt = (filename, aBuffer) => {
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
    };

    /**
     * ターゲットを順次ダウンロードする
     * @param targets
     * @param saveAs
     * @param timeout
     * @returns {Promise.<void>}
     */
    let downloadTargets = async (targets, saveAs, timeout) => {
      for (let i=0; i < targets.length; i++) {
        let t = targets[i];
        if (t.data) {
          // テキストデータ等、直接データを渡された場合
          t.objurl = URL.createObjectURL(new Blob([t.data]));
        }
        else if (t.url) {
          // urlを渡された場合
          let resp = await remote.get({
            'url': t.url,
            'headers': t.headers || [],
            'timeout': timeout,
            'responseType': 'blob'
          });

          let aBuffer = await AnkUtils.blobToArrayBuffer(resp.blob.slice(0, 16));
          t.filename = AnkUtils.fixFileExt( t.filename, aBuffer);

          t.objurl = URL.createObjectURL(resp.blob);
        }
        else {
          logger.warn('invalid download target:', t);
          continue;
        }

        await saveAs(t);
      }
    };

    //
    let siteScript = (() =>{
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

      let exec = (doc, id, name, genObj, callback) => {
        if (!callback) {
          return new Promise((resolve) => {
            exec(doc, id, name, genObj, e => resolve(e));
          });
        }

        if (doc.querySelector('#'+id)) {
          return;
        }

        let handler = (e) => {
          e.target.removeEventListener(name, handler);
          e.target.body.removeChild(elm);
          callback(JSON.parse(e.data));
        };

        doc.addEventListener(name, handler);

        let elm = doc.createElement('script');
        elm.setAttribute('id', id);
        elm.textContent = TEMPLATE.replace(/#GENOBJ#/, genObj).replace(/#EVENTNAME#/, name);
        doc.body.appendChild(elm);
      };

      let insert = (doc, id, script) => {
        let elm = doc.createElement('script');
        elm.setAttribute('id', id);
        elm.textContent = script;
        doc.body.appendChild(elm);
      };

      let remove = (doc, id) => {
        let elm = doc.querySelector('#'+id);
        if (elm) {
          doc.body.removeChild(elm);
        }
      };

      return {
        'exec': exec,
        'insert': insert,
        'remove': remove
      };
    })();

    return {
      'sleep': sleep,
      'createElement': createElement,
      'createElementNS': createElementNS,
      'trackbackParentNode': trackbackParentNode,
      'getScrollbarSize': getScrollbarSize,
      'trim': trim,
      'zeroPad': zeroPad,
      'getDecodedDateTime': getDecodedDateTime,
      'decodeDateTimeText': decodeDateTimeText,
      '_decodeDateTimeText': _decodeDateTimeText,
      'createUUID': createUUID,
      'blobToArrayBuffer': blobToArrayBuffer,
      'blobToDataURL': blobToDataURL,
      'blobToJSON': blobToJSON,
      'fixFilename': fixFilename,
      'fixFileExt': fixFileExt,
      'getFileExt': getFileExt,
      'downloadTargets': downloadTargets,
      'siteScript': siteScript
    };

  })();

}
