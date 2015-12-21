
Components.utils.import("resource://gre/modules/Preferences.jsm");
Components.utils.import("resource://gre/modules/Promise.jsm");
Components.utils.import("resource://gre/modules/Task.jsm");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

(function(global) {

  var AnkUtils = {

    SYS_SLASH: (function () { // {{{
      try {
        let props = Components.classes["@mozilla.org/file/directory_service;1"]
                      .getService(Components.interfaces.nsIProperties);
        let file = props.get("ProfD", Components.interfaces.nsIFile);
        file.append('dummy');
        return (file.path.indexOf('/') != -1) ? '/' : '\\';
      } catch (e) {
        return '/';
      }
    })(), // }}}

    get currentDocument () { // {{{
      window.content.document;
    }, // }}}

    /********************************************************************************
    * 文字列関数
    ********************************************************************************/

    /*
     * HTMLの実体参照を修正 TODO
     */
    decodeHtmlSpChars: function (s) { // {{{
      return s.replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(parseInt(n, 10)) });
    }, // }}}

    /*
     * fixFilename
     *    filename: ファイル名
     *    opts:     オプション
     *    return:   ファイル名
     * ファイル名として使えない文字を除去する。
     */
    fixFilename: function (filename, opts) { // {{{
      opts = opts || {};
      if (!opts.file)
        filename = filename.replace(/[\\\/]/g, '_');
      if (!opts.token)
        filename = filename.replace(/[\?]/g, '_');
      filename = filename.replace(/\.+$/, '');
      return filename.replace(/[:;\*\"\<\>\|\#]/g, '_').replace(/[\n\r\t\xa0]/g, ' ').trim();
    }, // }}}

    /*
     * extractFilename
     *    filepath
     */
    extractFilename: function (filepath) { // {{{
      let self = this;
      try {
        return self.makeLocalFile(filepath).leafName;
      } catch (e) {
        self.dumpError(e, true);
        try {
          return filepath.match(/[\\\/]([^\\\/]+)$/)[1] || filepath;
        } catch (e) {
          self.dumpError(e, true);
          return filepath;
        }
      }
    }, // }}}

    /*
     * replaceFileSeparatorToSYS
     * ファイル区切り文字をシステムに合わせる
     */
    replaceFileSeparatorToSYS: function (f) {
      let self = this;
      return f.replace(/[\\\/]+/g, self.SYS_SLASH);
    },

    /*
     * replaceFileSeparatorToDEFAULT
     * ファイル区切り文字を'/'にする
     */
    replaceFileSeparatorToDEFAULT: function (f) {
      return f.replace(/[\\\/]+/g, '/');
    },

    /*
     * URLから画像の拡張子を取得する
     */
    getFileExtension: function (s) {
      return s && s.match(/(\.\w+)(?:$|\?)/) && RegExp.$1.toLowerCase() || '.jpg';
    },

    /*
     * trim
     * 文字列の前後の空白系を取り除く
     */
    trim: function (str) { // {{{
      return str.replace(/^\s*|\s*$/g, '');
    }, // }}}

    /*
     * join
     *    list:   リスト
     *    deli:   区切り文字
     */
    join: function (list, deli) { // {{{
      if (!deli)
        deli = ',';
      let result = "";
      for (let i = 0; i < list.length; i++) {
        result += list[i].toString();
        if (i < (list.length - 1))
          result += deli;
      }
      return result;
    }, // }}}

    padCharToLeft: function (str, len, c) { // {{{
      str = str.toString();
      if (str.length >= len)
        return str;
      for (let i = str.length; i < len; i++)
        str = c + str;
      return str;
    }, // }}}

    zeroPad: function(s, n) { // {{{
      let self = this;
      return s.toString().replace(new RegExp('^(.{0,'+(n-1)+'})$'),
                                  function(s) { return self.zeroPad('0'+s, n); });
    }, // }}}

    toSQLDateTimeString: function (datetime) { // {{{
      let self = this;
      if (!datetime)
        datetime = new Date();
      let dy = self.zeroPad(datetime.getFullYear(),      4);
      let dm = self.zeroPad(datetime.getMonth() + 1,     2);
      let dd = self.zeroPad(datetime.getDate(),          2);
      let th = self.zeroPad(datetime.getHours(),         2);
      let tm = self.zeroPad(datetime.getMinutes(),       2);
      let ts = self.zeroPad(datetime.getSeconds(),       2);
      let ms = self.zeroPad(datetime.getMilliseconds(),  3);
      return dy + '-' + dm + '-' + dd + ' ' + th + ':' + tm + ':' + ts + '.' + ms;
    }, // }}}

    getLocale: function (path) { // {{{
      let self = this;
      const STR_BUNDLE_SVC = self.ccgs('@mozilla.org/intl/stringbundle;1',
                                           Components.interfaces.nsIStringBundleService);
      let stringBundle = STR_BUNDLE_SVC.createBundle(path);
      return function (key, replacements) {
        try {
          if (!replacements) {
            return stringBundle.GetStringFromName(key);
          } else {
            return stringBundle.formatStringFromName(key, replacements, replacements.length);
          }
        } catch (e) {
          return key;
        }
      };
    }, // }}}

    fromUTF8Octets: function (s) { // {{{
      let self = this;
      let conv = self.ccgs(
        '@mozilla.org/intl/scriptableunicodeconverter',
        Components.interfaces.nsIScriptableUnicodeConverter
      );
      conv.charset = 'UTF-8';
      return conv.ConvertToUnicode(s);
    }, // }}}

    dumpObject: function (obj) {
      if (obj)
        for (let p in obj)
          console.log('* '+p+' = '+obj[p]);
   },

    errorToString: function (error) { // {{{
      try {
       return "[" + error.name + "]\n" +
              "  message: " + error.message + "\n" +
              "  filename: " + error.fileName + "\n" +
              "  linenumber: " + error.lineNumber + "\n" +
              "  stack: " + error.stack + "\n";
      } catch (e) {
        return e.toString();
      }
    }, // }}}

    dumpError: function (error, doAlert, added) { // {{{
      let self = this;
      let msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
      msg += self.errorToString(error) ;
      msg += (added ? added+"\n" : '');
      msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";

      dump(msg);
      Services.console.logStringMessage(msg);

      try {
        if (doAlert)
          window.alert(msg);
      }
      catch (e) {
        Components.utils.reportError(e);
      }

      return msg;
    }, // }}}

    dump: function () { // {{{
      let self = this;
      if (!self.Prefs.get('debugMode'))
        return;

      let msg = "";
      if (arguments.length <= 1) {
        msg = "\n<<ANK " + arguments[0] + " >>\n";
      } else {
        msg = "\n<<ANK<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n";
        for (let i = 0; i < arguments.length; i++) {
          msg += "  " + arguments[i] + "\n";
        }
        msg += ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n";
      }
      dump(msg);
      Services.console.logStringMessage(msg);
      return msg;
    }, // }}}

    time:  function (func, self, args) { // {{{
      let [a, r, b] = [new Date(), func.apply(self, args || []), new Date()];
      let msg = 'time: ' + ((b.getTime() - a.getTime()) / 1000) + 'msec';
      Services.console.logStringMessage(msg);
      return msg;
    }, // }}}

    decodeDateTimeText: function (datetime) { // {{{
      let self = this;
      let d;
      let dtext;
      if ( Array.isArray(datetime) ) {
        datetime.some(function (v) {
          dtext = v;
          d = self._decodeDateTimeText(dtext);
          return d;
        });
      }
      else {
        dtext = datetime;
        d = self._decodeDateTimeText(dtext);
      }

      if (d) {
        return d;
      }

      // TODO 日時解析失敗時に、自動で現在日時で代替するのか、それとも他の処理を行うのかは、要検討課題
      let msg = 'unsupported datetime format = \''+dtext+'\'';
      if (!self.Prefs.get('ignoreWrongDatetimeFormat', false)) {
        throw new Error(msg);
      }

      if (self.Prefs.get('warnWrongDatetimeFormat', true))
        window.alert(msg);

      return self.getDecodedDateTime(new Date(), true);
    }, // }}}

    _decodeDateTimeText: function (dtext) { // {{{
      let self = this;
      // 時分 - 年月日
      function calc0 () {
        let m = dtext.match(/^(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*)(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})/);
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
        let m = dtext.match(/(\d{4})\s*[\u5E74/\-]\s*(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:\s*\D{1,2}\s*(\d{1,2})\s*[\u6642:\-]\s*(\d{1,2}))?/);
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
        let m = dtext.match(/(\d{1,2})\s*[\u6708/\-]\s*(\d{1,2})(?:st|nd|rd|th)?\s*,\s*(\d{4})/)
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
        let m = dtext.match(/(an?|\d+) (min|hour|day|month|year)/)
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
        if (diff)
          d.setTime(d.getTime() - diff);

        return d;
      }

      // 洋式
      function calcx () {
        let d = new Date(dtext.replace(/(\s\d+)(?:st|nd|rd|th),/, "$1,"));
        return isNaN(d.getFullYear()) ? null : d;
      }

      // まずは明らかなゴミを排除 && 連続の空白をまとめる
      dtext = dtext.replace(/[^-,0-9a-zA-Z:\/\u5E74\u6708\u6642\s]/g, '').replace(/\s+/g, ' ').trim();
      let fault = false;
      let dd = calc0() || calc1() || calc2() || calc3() || calcx();   // 0は1と一部被るので0を前に
      if (!dd) {
        return;
      }

      return self.getDecodedDateTime(dd, false);
    }, // }}}

    getDecodedDateTime: function (dd, fault) { // {{{
      let self = this;
      return {
        year: self.zeroPad(dd.getFullYear(), 4),
        month: self.zeroPad(dd.getMonth()+1, 2),
        day: self.zeroPad(dd.getDate(), 2),
        hour: self.zeroPad(dd.getHours(), 2),
        minute: self.zeroPad(dd.getMinutes(), 2),
        fault: fault
      };
    }, // }}}

    /********************************************************************************
    * 配列
    ********************************************************************************/

    A: function (v) {
      return Array.slice(v);
    },

    IA: function (v) {
      return Iterator(Array.slice(v));
    },

    /********************************************************************************
    * 色々
    ********************************************************************************/

    popupAlert: function (iconPath, title, text, buttonEnabled, a, b) { // {{{
      let self = this;
      try {
        if (navigator.platform.toLowerCase().indexOf('win') < 0)
          iconPath = '';

        const ALERT_SVC = self.ccgs("@mozilla.org/alerts-service;1",
                                        Components.interfaces.nsIAlertsService);
        return ALERT_SVC.showAlertNotification.apply(ALERT_SVC, arguments);
      } catch (e) {
        return;
      }
    }, // }}}

    simplePopupAlert: function (title, text) { // {{{
      let self = this;
      return self.popupAlert("", title, text, false, null, null);
    }, // }}}

    openTab: function (url, ref) { // {{{
      if ('delayedOpenTab' in window) {
        window.delayedOpenTab(url, ref);
      } else {
        window.getBrowser().addTab(url, ref);
      }
    }, // }}}

    loadURI: function (url) { // {{{
      if (window.loadURI)
        window.loadURI(url);
    }, // }}}

    loadStyleSheet: function (doc, path) { // {{{
      let elem = doc.createElement('link');
      elem.setAttribute('type', 'text/css');
      elem.setAttribute('rel', 'stylesheet');
      elem.setAttribute('media', 'screen');
      elem.setAttribute('href', path);
      let head = doc.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(elem);
        return elem;
      }
    }, // }}}

    registeredDomains: {},

    registerSheet:  function (style, domains) { // {{{
      let self = this;
      const IOS = self.ccgs('@mozilla.org/network/io-service;1', Ci.nsIIOService);
      const StyleSheetService = self.ccgs('@mozilla.org/content/style-sheet-service;1', Ci.nsIStyleSheetService);

      let domainlist = domains.map(function (v) { return 'domain("'+v+'")';}).join(',');

      let CSS = [
        '@namespace url(http://www.w3.org/1999/xhtml);',
        '@-moz-document '+domainlist+' {',
        style,
        '}'
      ].join("\n");

      let uri = IOS.newURI('data:text/css,' + window.encodeURIComponent(CSS), null, null);

      if (self.registeredDomains[domainlist])
        StyleSheetService.unregisterSheet(self.registeredDomains[domainlist], StyleSheetService.USER_SHEET);

      self.registeredDomains[domainlist] = uri;
      StyleSheetService.loadAndRegisterSheet(uri, StyleSheetService.USER_SHEET);
    }, // }}}

    // teramako Thanks! http://twitter.com/teramako/status/6926877707
    getRelativePath: function (target, base) { // {{{
      let self = this;
      return self.fromUTF8Octets(self.makeLocalFile(target).getRelativeDescriptor(self.makeLocalFile(base)));
    }, // }}}

    get scrollbarSize () { // {{{
      let self = this;
      let doc = content.document;
      let div = doc.createElement('div');
      let s = div.style;
      s.position = 'fixed';
      s.left = s.top = '-200px';
      s.height = s.width = '100px';
      s.overflowX = s.overflowY = 'scroll';
      doc.body.appendChild(div);
      let result = {
          width: 100 - div.clientWidth,
          height: 100 - div.clientHeight
      };
      doc.body.removeChild(div);
      self.__defineGetter__('scrollbarSize', function () { return result });
      return result;
    }, // }}}

    /********************************************************************************
    * ネットワーク
    ********************************************************************************/

    // FIXME forceAllowThirdPartyCookie does not work in remoteFileExists()

    /*
     * remoteFileExists
     *    url:          チェックする
     *    callback:     function (exists) 存在していれば exists が真
     */
   remoteFileExistsAsync: function (url,referer) { // {{{
     let self = this;
     function promise (url) {
       return new Promise(function (resolve, reject) {
         let ios = self.ccgs("@mozilla.org/network/io-service;1", Components.interfaces.nsIIOService);
         let ch = ios.newChannel(url, null, null).QueryInterface(Components.interfaces.nsIHttpChannel);;
         ch.requestMethod = "HEAD";
         ch.redirectionLimit = 0;
         if (referer)
           ch.referrer = NetUtil.newURI(referer);
         ch.asyncOpen({
           onStartRequest: function(aRequest,aContext) { },
           onDataAvailable: function (aRequest,aContext,aInputStream,aOffset,aCount) { },
           onStopRequest: function(aRequest,aContext,aStatusCode) {
             if (ch.responseStatus == 200) {
               resolve({ status:ch.responseStatus, url:url, referer:referer, type:ch.contentType });
             }
             else if (ch.responseStatus == 302) {
               let redirect_to = ch.getResponseHeader('Location');
               self.dump('redirect: from='+url+' to='+redirect_to);
               resolve({ status:ch.responseStatus, url:redirect_to });
             }
             else {
               reject();
             }
           }
         }, null);
       });
     }

     const REDIRECT_LOOP_MAX = 2;

     return Task.spawn(function* () {
       for (let redirect_loop=0; redirect_loop < REDIRECT_LOOP_MAX; redirect_loop++) {
         let status = yield promise(url,referer);
         if (status.status == 302) {
           referer = url;
           url = status.url;
         }
         else
           return status;
       }
     });
   }, // }}}

   remoteFileExists: function (url, callback, redirect_loop) { // {{{
     let self = this;

     const REDIRECT_LOOP_MAX = 2;

     let ios = self.ccgs("@mozilla.org/network/io-service;1", Components.interfaces.nsIIOService);
     let ch = ios.newChannel(url, null, null).QueryInterface(Components.interfaces.nsIHttpChannel);;
     ch.requestMethod = "HEAD";
     ch.redirectionLimit = 0;
     ch.open();

     // TODO 利用されていないのでcallbackの処理は未実装

     if (ch.responseStatus == 302) {
       let redirect_to = ch.getResponseHeader('Location');
       self.dump('redirect: from='+url+' to='+redirect_to);
       return redirect_loop > REDIRECT_LOOP_MAX ? null : self.remoteFileExists(redirect_to, callback, ++redirect_loop);
     }

     return ch.requestSucceeded && [ch.responseStatus, url, ch.getResponseHeader('Content-Type')];
   }, // }}}


    /*
     * remoteFileExistsRetryable
     *    url:          チェックする
     *    maxTimes:     最大チェック回数
     *    callback:     function (exists) 存在していれば exists が真
     */
   remoteFileExistsRetryable: function (url, maxTimes, callback) { // {{{
     let self = this;
     function rfe (callback) {
        let xhr = new XMLHttpRequest();
        xhr.open('HEAD', url, true);
        try {
          xhr.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = self.Prefs.get('allowThirdPartyCookie', true);
        } catch(ex) {
          /* unsupported by this version of FF */
        }
        xhr.onreadystatechange = function (e) {
          if (xhr.readyState == 4)
            callback(xhr.status);
        };
        xhr.send(null);
      }

      function call () {
        rfe(function (statusCode) {
          self.dump(statusCode);
          if (statusCode == 200) {
            return callback(true);
          }
          if (statusCode == 404) {
            return callback(false);
          }
          ++times;
          if (times < maxTimes)
            return setTimeout(call, times * 10 * 1000);
          return callback(false);
        });
      }

      let times = 0;
      call();
   }, // }}}

   httpGET: function (url,referer,params) { // {{{
     let self = this;
     let post = !!params;
     let text = null;
     let xhr = new XMLHttpRequest();
     xhr.open((post ? 'POST' : 'GET'), url, false);
     try {
       xhr.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = self.Prefs.get('allowThirdPartyCookie', true);
     } catch(ex) {
       /* unsupported by this version of FF */
     }
     xhr.onreadystatechange = function () {
       if (xhr.readyState == 4 && xhr.status == 200) {
         text = xhr.responseText;
       }
     };
     if (post)
       xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
     if (referer)
       xhr.setRequestHeader('Referer', referer);
     xhr.send(post ? params : null);

     return text;
   }, // }}}

   httpGETAsync: function (url,referer,params) { // {{{
     let self = this;
     return new Promise(function (resolve, reject) {
       let post = !!params;
       let text = null;
       let xhr = new XMLHttpRequest();
       xhr.open((post ? 'POST' : 'GET'), url, true);
       try {
          xhr.channel.QueryInterface(Ci.nsIHttpChannelInternal).forceAllowThirdPartyCookie = self.Prefs.get('allowThirdPartyCookie');
       } catch(ex) {
         /* unsupported by this version of FF */
       }
       xhr.onload = function () {
         if (xhr.status == 200) {
           resolve(xhr.responseText);
         } else {
           reject(new Error(xhr.statusText));
         }
       };
       xhr.error = function () {
         reject(new Error(xhr.statusText));
       };
       if (post)
         xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
       if (referer)
         xhr.setRequestHeader('Referer', referer);
       xhr.send(post ? params : null);
     });
   }, // }}}

    /********************************************************************************
    * 手抜き用関数
    ********************************************************************************/

    /*
     * ccgs
     *    klass:
     *    service:
     * Components.classes[klass].getService(service)
     */
     ccgs: function (klass, service) { // {{{
       let cc = Components.classes[klass];
       return cc && cc.getService(service);
     }, // }}}

    /*
     * ccci
     *    klass:
     *    _interface:
     * Components.classes[klass].createInstance(interface)
     */
    ccci: function (klass, _interface) {
      let cc = Components.classes[klass];
      return cc && cc.createInstance(_interface);
    }, // {{{

    /*
     * makeLocalFile
     *    path:   プラットフォームに依ったパス
     *    return: nsILocalFile
     */
    makeLocalFile: function (path) { // {{{
      let file = Components.classes['@mozilla.org/file/local;1']
                           .createInstance(Components.interfaces.nsILocalFile);
      file.initWithPath(path);
      return file;
    }, // }}}

    getErrorMessage: function (e) {
      if (e) {
        if (e instanceof OS.File.Error)
          return e.operation;
        if (e instanceof Error)
          return e.message;
      }
      return e;
    },

    /********************************************************************************
    * DOM関数
    ********************************************************************************/

    createHTMLDocument: function (source) { // {{{
      var parser = new DOMParser();
      var doc = parser.parseFromString(source , "text/html");
      if(doc.getElementsByTagName("parsererror").length == 0)
        return doc;
    }, // }}}

    /*
     * findNodeByXPath
     *    xpath:
     *    return: node
     */
    findNodeByXPath: function (xpath, _doc) { // {{{
      let self = this;
      let doc = _doc || self.currentDocument;
      return doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }, // }}}

    /*
     * findNodesByXPath
     *    xpath:
     *    return: nodes
     */
    findNodesByXPath: function (xpath, array, _doc) { // {{{
      let self = this;
      let doc = _doc || self.currentDocument;
      let nodes = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      if (!array)
        return nodes;
      let elem, result = [];
      while (elem = nodes.iterateNext())
        result.push(elem);
      return result;
    }, // }}}

    createTempFile: function (name) { // {{{
      let self = this;
      let ds = self.ccgs("@mozilla.org/file/directory_service;1", Ci.nsIProperties);
      let file = ds.get("TmpD", Ci.nsIFile);
      file.append('ankpixivtool-' + name);
      file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
      return file;
    }, // }}}

    findHomeDir: function () { // {{{
      let self = this;
      let ds = self.ccgs("@mozilla.org/file/directory_service;1", Ci.nsIProperties);
      let file;
      [ 'Pict',     // Windows
        'XDGPict',  // Un*x
        'Pct',      // Mach
        'Home' ] .
        some(function (k) {
          try {
            return !!(file = ds.get(k, Ci.nsIFile));
          } catch (e) {
            self.dump('unsupported name of directory: '+k);
          }
        });
      return file ? file.path : null;
    }, // }}}

    // Vim 風に返す
    platform: (function () { // {{{
      if (navigator.platform.match(/^win\d+$/i))
        return 'Win32';
      return 'other';
    })(), // }}}

    /*
     * br を改行として認識する textContent
     *    elem:     要素
     *    return:   String;
     */
    textContent: function (elem) { // {{{
      let doc = elem.ownerDocument;
      let temp = doc.createElement('div');
      temp.innerHTML = elem.innerHTML.replace(/<br[\s\/]*>/g, '\n');
      return temp.textContent;
    }, // }}}

    /*
     * 指定の階層分上にあるノードを返す
     *    node:        元ノード
     *    n:           何階層上まであがるか
     *    targetClass: n未満でもtargetClassを持つノードがみつかったらそこで終了
     *    return:   element;
     */
    trackbackParentNode: function (node, n, targetClass) { // {{{
      if (n < 0)
        return node.firstChild;

      for (let i = 0; node && i < n; i++) {
        node = node.parentNode;
        if (targetClass && node.classList.contains(targetClass))
          break;
      }
      return node;
    }, // }}}

    /*
     * urlをパースしたいのでAnchorElementを生成する
     */
    getAnchor: function (url) { // {{{
      let doc = content.document;
      let anchor = doc.createElement('a');
      anchor.href = url;
      return anchor;
    }, // }}}

    /**
     *
     */
    Prefs: (function () {

      let prefix = '';

      return {
        set prefix (p) {
          if (p) {
            prefix = p + (p.match(/\.$/) ? '' : '.');
          } else {
            prefix = '';
          }
        },

        get: function (name, def) {
          return Preferences.get(prefix + name, def);
        },

        set: function (name, value) {
          Preferences.set(prefix + name, value);
        }
      };
    })(),

    /**
     *
     */
    Locale: (function () {
      let strings;

      return {
        set properties (s) {
          strings = Services.strings.createBundle(s);
        },

        get: function (key, replacements) {
          try {
            if (!replacements) {
              return strings.GetStringFromName(key);
            } else {
              return strings.formatStringFromName(key, replacements, replacements.length);
            }
          }
          catch (e) {
            return key;
          }
        }
      };
    })()
  };

  // --------
  global["AnkUtils"] = AnkUtils;

})(this);