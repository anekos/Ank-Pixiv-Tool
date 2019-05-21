"use strict";

{
  class Remote {
    /**
     *
     */
    constructor () {
      this.EXCHANGE_TARGETS = ['Referer'];
      this.EXCHANGE_PREFIX = 'X-XXX-';

      this.USE_INTERCEPT_ORIGINS = false;

      this.WEBREQUEST_FILTER = (() => {
        if (this.USE_INTERCEPT_ORIGINS) {
          // URLフィルタが <all_urls> だとちょっと難があるか
          return ["<all_urls>"];
        }

        return [
          "https://*.pximg.net/*"
        ];
      })();

      this.intercept_origins = {};

      this._request = this._request_fetch;
      //this._request = this._request_xhr;

      this.initIntercept();
    }

    /**
     *
     * @param opts
     * @param isPost
     * @returns {Promise}
     * @private
     */
    async _request_xhr (opts, isPost) {
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

        xhr.onerror = xhr.abort = xhr.ontimeout = () => {
          reject(new Error(xhr.statusText+" ("+xhr.status+") : "+opts.url));
        };

        if (opts.timeout !== undefined) {
          xhr.timeout = opts.timeout;
        }

        if (isPost) {
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        }

        if (opts.headers) {
          // ヘッダの書き換え
          opts.headers.forEach((h) => {
            if (this.EXCHANGE_TARGETS.indexOf(h.name) == -1) {
              xhr.setRequestHeader(h.name, h.value);
              return;
            }

            // TODO contents script側でのreferer変更に対応していない
            if (this.USE_INTERCEPT_ORIGINS) {
              this.intercept_origins[new URL(opts.url).origin] = true;
            }
            xhr.setRequestHeader(this.EXCHANGE_PREFIX+h.name, h.value);
          });
        }

        xhr.send(isPost ? opts.body : null);
      });
    }

    /**
     *
     * @param opts
     * @param isPost
     * @returns {Promise}
     * @private
     */
    async _request_fetch (opts, isPost) {
      return new Promise((resolve, reject) => {

        let fetch_opts = {
          'method': isPost ? 'POST' : 'GET',
          'credentials': 'same-origin',
          'headers': {}
        };

        if (isPost) {
          if (opts.json) {
            fetch_opts.headers['Content-Type'] = 'application/json';
            fetch_opts.body = opts.json;
          }
          else {
            fetch_opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            fetch_opts.body = opts.body;
          }
        }

        if (opts.headers) {
          opts.headers.forEach((h) => {
            if (this.EXCHANGE_TARGETS.indexOf(h.name) == -1) {
              fetch_opts.headers[h.name] = h.value;
            }
            else {
              // ヘッダの書き換え
              fetch_opts.headers[this.EXCHANGE_PREFIX+h.name] = h.value;

              // TODO contents script側でのreferer変更に対応していない
              if (this.USE_INTERCEPT_ORIGINS) {
                this.intercept_origins[new URL(opts.url).origin] = true;
              }
            }
          });
        }

        let timeout = setTimeout(() => {
          timeout = undefined;
          reject(new Error('Request timed out'));
        }, opts.timeout || 60000);

        fetch(opts.url, fetch_opts)
          .then((response) => {
            let resp = {
              'responseURL': response.url
            };
            if (timeout !== undefined) {
              clearTimeout(timeout);
              timeout = undefined;
            }
            if (response.ok) {
              if (opts.responseType == 'json') {
                return response.json().then((data) => {
                  resp['json'] = data;
                  resolve(resp);
                });
              }
              else if (opts.responseType == 'blob') {
                return response.blob().then((data) => {
                  resp['blob'] = data;
                  resolve(resp);
                });
              }
              else if (opts.responseType == 'document') {
                return response.text().then((data) => {
                  try {
                    let data_doc = new DOMParser().parseFromString(data, 'text/html');
                    resp['document'] = data_doc;
                    resolve(resp);
                  }
                  catch (e) {
                    reject(e);
                  }
                });
              }
              else {
                return response.text().then((data) => {
                  resp['text'] = data;
                  resolve(resp);
                });
              }
            }
            else {
              reject(new Error(response.statusText + " (" + response.status + ") : " + opts.url));
            }
          });
      });
    }

    /**
     *
     */
    initIntercept () {
      if (!chrome.runtime.getBackgroundPage) {
        // background scriptのみで利用する
        return;
      }

      chrome.runtime.getBackgroundPage((background) => {
        if (background !== window) {
          return;
        }

        chrome.webRequest.onBeforeSendHeaders.addListener((details) => {

          if (this.USE_INTERCEPT_ORIGINS && !this.intercept_origins.hasOwnProperty(new URL(details.url).origin)) {
            // 改変対象のoriginではない
            return {};
          }

          // 置き換え対象のヘッダを探す
          let reps = details.requestHeaders.filter((h) => {
            if (h.name.toUpperCase().startsWith(this.EXCHANGE_PREFIX)) {
              h.name = h.name.slice(this.EXCHANGE_PREFIX.length);
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

          return { 'requestHeaders': details.requestHeaders };
        }, {
          "urls": this.WEBREQUEST_FILTER,
          "types": [
            "xmlhttprequest"
          ]
        }, [
          "requestHeaders",
          "extraHeaders",
          "blocking"
        ]);
      });
    }

    /**
     *
     * @param opts
     * @returns {Promise}
     */
    async get (opts) {
      return this._request(opts, false);
    }

    /**
     *
     * @param opt
     * @returns {Promise}
     */
    async post (opts) {
      return this._request(opts, true);
    }
  }

  //

  var remote = new Remote();
}
