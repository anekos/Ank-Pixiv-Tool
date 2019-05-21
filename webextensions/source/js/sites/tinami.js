"use strict";

class AnkTinami extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'TNM';

    this.SELECTORS = {
      'illust': {
        'imgOvr': '.viewbody',
        'med': {
          'img': '.viewbody .captify'
        },
        'mng': {
          'imgs': '.viewbody img'
        }
      },
      'info': {
        'illust': {
          'datetime': '.view_info',
          'title': '.viewdata > h1 > span',

          'captions': '.description',
          'tags': '.tag > span'
        },
        'member': {
          'memberLink': '.prof > p > a'
        }
      },
      'misc': {
        'openCantion': '#show_all',

        'postParams': '#open_original_content > input'
      }
    };
  }

  /**
   * イラストページに居るかどうか
   * @returns {boolean}
   */
  inIllustPage () {
    return !!this.getIllustId();
  }

  /**
   * ダウンロード情報の取得
   * @param mode
   * @returns {Promise.<{}>}
   */
  async getAnyContext (mode) {

    /**
     * ダウンロード情報（画像パス）の取得
     * @returns {Promise}
     */
    let getPathContext = async () => {
      let getMedPath = async (img) => {
        let postParams = document.querySelectorAll(this.SELECTORS.misc.postParams);
        let params = Array.prototype.map.call(postParams, (e) => {
          return [e.getAttribute('name'), e.getAttribute('value')].join('=');
        }).join('&');
        let respMed = await remote.post({
          'url': document.location.href,
          'body': params,
          'timeout': this.prefs.xhrTimeout,
          'responseType': 'document'
        });

        let m = Array.prototype.filter.call(respMed.document.querySelectorAll('img'),
          (e) => /^https?:\/\/img\.tinami\.com\/illust\d*\/img\//.test(e.src)
        ).map((e) => {
          return {'src': e.src};
        });

        return {
          'thumbnail': m,
          'original': m
        }
      };

      let getMngPath = async (imgs) => {
        let m = Array.prototype.map.call(imgs, (e) => {
          return {'src': e.src};
        });

        return {
          'thumbnail': m,
          'original': m
        }
      };

      let img = document.querySelector(this.SELECTORS.illust.med.img);
      if (img) {
        return getMedPath(img);
      }

      let imgs = document.querySelectorAll(this.SELECTORS.illust.mng.imgs);
      if (imgs) {
        return getMngPath(imgs);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @returns {{url: string, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: *, caption: string, R18: boolean}}
     */
    let getIllustContext = () => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(document.querySelector(this.SELECTORS.info.illust.datetime).textContent));

        let captions = document.querySelectorAll(this.SELECTORS.info.illust.captions);

        let info = {
          'url': document.location.href,
          'id': this.getIllustId(),
          'title': AnkUtils.trim(document.querySelector(this.SELECTORS.info.illust.title).textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': Array.prototype.map.call(document.querySelectorAll(this.SELECTORS.info.illust.tags), (e) => AnkUtils.trim(e.textContent)),
          'caption': Array.prototype.map.call(captions, (e) =>AnkUtils.trim(e.textContent)).join('\n'),
          'R18': false
        };

        return info;
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     * ダウンロード情報（メンバー情報）の取得
     * @returns {{id: *, name: (*|string|XML|void|string), pixiv_id: null, memoized_name: null}}
     */
    let getMemberContext = () => {
      try {
        let memberLink = document.querySelector(this.SELECTORS.info.member.memberLink);

        return {
          'id': /\/profile\/(.+)(?:\?|$)/.exec(memberLink.href)[1],
          'name': AnkUtils.trim(memberLink.textContent),
          'pixiv_id': null,
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    //

    let context = {};

    if (mode & this.GET_CONTEXT.PATH) {
      context.path = await getPathContext();
    }
    context.illust = getIllustContext();
    context.member = getMemberContext();

    return context;
  }


  /**
   * イラストIDの取得
   * @param url
   * @returns {*}
   */
  getIllustId (url) {
    url = url || document.location.href;
    let m = /www\.tinami\.com\/view\/([^/]+?)(?:\?|$)/.exec(url);
    if (m) {
      return m[1];
    }
  }

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @returns {{queries: [*,*,*], getId: (function(*=)), getLastUpdate: undefined, method: undefined}}
   */
  getMarkingRules () {

    const MARKING_TARGETS = [
      { 'q':'td > p.capt + a', 'n':1},                              // 一覧
      { 'q':'td > .title > .collection_form_checkbox + a', 'n':2},  // コレクション
      { 'q':'.thumbs > li > ul > li > a', 'n':1}                    // 最近の投稿作品
    ];

    return {
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return this.getIllustId(href);
      },
      'getLastUpdate': undefined,
      'method': undefined
    };
  }

  /**
   * 機能のインストール（イラストページ用）
   */
  installIllustPageFunction (RETRY_VALUE) {
    // 中画像クリック関連
    let middleClickEventFunc = () => {
      let addMiddleClickEventListener = (imgOvr) => {
        let mcHandler = (e) => {
          let useEvent = this.prefs.site.largeOnMiddle || this.prefs.site.downloadWhenClickMiddle;
          let useCapture = this.prefs.site.largeOnMiddle;
          if (!useEvent) {
            return;
          }

          if (this.prefs.site.largeOnMiddle) {
            this.openViewer();
          }

          if (this.prefs.site.downloadWhenClickMiddle) {
            // 自動ダウンロード（中画像クリック時）
            this.downloadCurrentImage({'autoDownload': true});
          }

          if (useCapture) {
            e.preventDefault();
            e.stopPropagation();
          }
        };

        imgOvr.addEventListener('click', mcHandler, true);
      };

      //

      // オーバーレイ
      let imgOvr = document.querySelector(this.SELECTORS.illust.imgOvr);
      if (!imgOvr) {
        return;
      }

      let result = (() => {
        // イラスト
        let img = document.querySelector(this.SELECTORS.illust.med.img) || document.querySelector(this.SELECTORS.illust.mng.imgs);
        if (img) {
          addMiddleClickEventListener(imgOvr);
          return true;
        }
      })();

      return result;
    };

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      if (document.readyState !== "complete") {
        return false;
      }

      this.displayDownloaded().then();
      return true;
    };

    // イメレスのサムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (document.readyState !== "complete") {
        return false;
      }

      this.markDownloaded().then();
      return true;
    };

    // キャプションを自動で開く
    let openCaption = () => {
      if (!this.prefs.openCaption) {
        return true;
      }

      let button = document.querySelector(this.SELECTORS.misc.openCantion);
      if (!button) {
        return;
      }

      setTimeout(() => {
        if (getComputedStyle(button).getPropertyValue('display') === 'block') {
          button.click();
        }
      }, this.prefs.openCaptionDelay);

      return true;
    };

    //

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': openCaption, 'retry': RETRY_VALUE, 'label': 'openCaption'})
    ])
      .catch((e) => logger.warn(e));
  }

  /**
   * 機能のインストール（リストページ用）
   */
  installListPageFunction (RETRY_VALUE) {

    // サムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (document.readyState !== "complete") {
        return false;
      }

      this.markDownloaded().then();
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'})
    ])
      .catch((e) => logger.error(e));
  }

  /**
   * 機能のインストールのまとめ
   */
  installFunctions () {
    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }

    this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
  }

}

// 開始

new AnkTinami().start()
  .catch((e) => {
    console.error(e);
  });
