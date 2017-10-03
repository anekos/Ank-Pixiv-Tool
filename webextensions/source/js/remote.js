"use strict";

{

  const WEBREQUEST_FILTER = [
    "<all_urls>"
    //"https://*.pximg.net/*"
  ];

  const EXCHANGE_TARGETS = ['Referer'];
  const EXCHANGE_PREFIX = 'X-XXX-';

  //　ヘッダ改変対象のoriginを保存する
  let intercept_origins = {};

  /**
   *
   * @param opts
   * @param isPost
   * @returns {Promise}
   */
  let request = (opts, isPost) => {
    return new Promise((resolve, reject) => {

      // TODO FFだと302がうまく処理できない？mozSystem = trueで動くが問題がないか要確認
      let xhr = new XMLHttpRequest({'mozSystem': true});

      xhr.open((isPost ? 'POST' : 'GET'), opts.url, true);

      //xhr.withCredentials = true;

      if (opts.responseType) {
        xhr.responseType = opts.responseType;
      }

      xhr.onload = () => {
        // TODO 206 は発生するか？
        if (xhr.status == 200) {
          if (opts.responseType) {
            let r = {
              'responseURL': xhr.responseURL
            };
            r[opts.responseType] = opts.responseType == 'text' ? xhr.responseText : xhr.response;
            return resolve(r);
          }
          resolve({'response': xhr.response, 'responseURL': xhr.responseURL});
        } else {
          reject(new Error(xhr.statusText+" ("+xhr.status+") : "+opts.url));
        }
      };

      xhr.error = () => {
        reject(new Error(xhr.statusText+" ("+xhr.status+") : "+opts.url));
      };

      if (opts.timeout !== undefined) {
        xhr.timeout = opts.timeout;
        xhr.ontimeout = () => {
          reject(new Error(xhr.statusText+" ("+xhr.status+") : "+opts.url));
        };
      }

      if (isPost) {
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      }

      if (opts.headers) {
        // ヘッダの書き換え
        opts.headers.forEach((h) => {
          if (EXCHANGE_TARGETS.indexOf(h.name) == -1) {
            xhr.setRequestHeader(h.name, h.value);
            return;
          }

          // TODO contents script側でのreferer変更に対応していない
          intercept_origins[new URL(opts.url).origin] = true;
          xhr.setRequestHeader(EXCHANGE_PREFIX+h.name, h.value);
        });
      }

      xhr.send(isPost ? opts.body : null);
    });
  };

  /**
   *
   */
  let intercept = () => {
    if (!chrome.runtime.getBackgroundPage) {
      // background scriptのみで利用する
      return;
    }

    chrome.runtime.getBackgroundPage((background) => {
      if (background !== window) {
        return;
      }

      chrome.webRequest.onBeforeSendHeaders.addListener((details) => {

        if (!intercept_origins.hasOwnProperty(new URL(details.url).origin)) {
          // 改変対象のoriginではない
          return {};
        }

        // 置き換え対象のヘッダを探す
        let reps = details.requestHeaders.filter((h) => {
          if (h.name.startsWith(EXCHANGE_PREFIX)) {
            h.name = h.name.slice(EXCHANGE_PREFIX.length);
            return h;
          }
        });

        if (reps.length == 0) {
          return {};
        }

        // 置き換え対象のヘッダと重複するヘッダを排除する
        details.requestHeaders = details.requestHeaders.filter((h) => {
          return !reps.find((r) => r.name == h.name && r !== h);
        });

        return {'requestHeaders': details.requestHeaders};
      }, {
        // FIXME URLフィルタが <all_urls> なのはちょっと難がある
        "urls": WEBREQUEST_FILTER,
        "types": [
          "xmlhttprequest"
        ]
      }, [
        "requestHeaders",
        "blocking"
      ]);
    });
  };

  let get = (opts) => {
    return request(opts, false);
  };

  let post = (opt) => {
    return request(opt, true);
  };

  //

  intercept();

  var remote = {
    'get': get,
    'post': post
  };

}
