"use strict";

class AnkNicosei extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'NCS';

    this.SELECTORS = {
      'illust': {
        'imgOvr': '.illust_wrapper',
        'med': {
          'imgLink': '#illust_link'
        },
        'orig': {
          'img': '.illust_view_big'
        }
      },
      'info': {
        'illust': {
          'datetime': '#content #detail .created',
          'title': '#content #detail .title',
          'R18': '#content #detail .kind a[href="/shunga/"]',
          'caption': '#content #detail .discription',
          'clip': '.add_clip_button',

          'tags': '#content #detail .illust_tag.static .tag .text'
        },
        'member': {
          'memberLink': '#content #detail .user_link > a',
          'memberName': '#content #detail .user_name strong',
        }
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
      let getMedPath = async (imgLink) => {
        logger.info('ORIGINAL IMAGE PAGE:', imgLink.href);
        let resp = await remote.get({
          'url': imgLink.href,
          'responseType': 'document',
          'timeout': this.prefs.xhrTimeout
        });

        let img = resp.document.querySelector(this.SELECTORS.illust.orig.img);
        if (img) {
          let m = [{'src': [new URL(resp.responseURL).origin, img.getAttribute('data-src')].join('')}];
          return {
            'thumbnail': m,
            'original': m
          };
        }
        else {
          // FIXME ↑のレスポンスが空になるので応急処置としてresponseURLを加工する。httpでのリクエストがhttpsにリダイレクトするのが問題か？
          let m = [{'src': [resp.responseURL.replace(/\/o\//, '/priv/')]}];
          return {
            'thumbnail': m,
            'original': m
          };
        }
      };

      let imgLink = document.querySelector(this.SELECTORS.illust.med.imgLink);
      if (imgLink) {
        return getMedPath(imgLink);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @returns {{url: string, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: *, caption: (Element|*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = () => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(document.querySelector(this.SELECTORS.info.illust.datetime).textContent));

        let caption = document.querySelector(this.SELECTORS.info.illust.caption);

        let info = {
          'url': document.location.href,
          'id': this.getIllustId(),
          'title': AnkUtils.trim(document.querySelector(this.SELECTORS.info.illust.title).textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': Array.prototype.map.call(document.querySelectorAll(this.SELECTORS.info.illust.tags), (e) => AnkUtils.trim(e.textContent)),
          'caption': caption && AnkUtils.trim(caption.textContent),
          'R18': !!document.querySelector(this.SELECTORS.info.illust.R18)
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
        return {
          'id': /\/user\/illust\/(.+?)(?:$|\?)/.exec(document.querySelector(this.SELECTORS.info.member.memberLink).href)[1],
          'name': AnkUtils.trim(document.querySelector(this.SELECTORS.info.member.memberName).textContent),
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
    let m = /^https?:\/\/seiga\.nicovideo\.jp\/seiga\/(im\d+)/.exec(url);
    if (m) {
      return m[1];
    }
  }

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @returns {{queries: [*,*,*,*,*], getId: (function(*=)), getLastUpdate: undefined, method: undefined}}
   */
  getMarkingRules () {

    const MARKING_TARGETS = [
      { 'q':'.list_item > a', 'n':0 },                         // ○○さんのイラスト
      { 'q':'.illust_thumb > div > a', 'n':2 },                // マイページ
      { 'q':'.list_item_cutout > a', 'n':-1, 'r': '.thum > img', 'm': 'border'},    // イラストページ（他のイラスト・関連イラストなど）
      { 'q':'.ranking_image > div > a', 'n':2 },               // イラストランキング
      { 'q':'.center_img > a', 'n':1 }                         // 検索結果・春画ページ（他のイラスト・関連イラストなど）
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
   * クリップする
   */
  setNice () {
    let clip = document.querySelector(this.SELECTORS.info.illust.clip);
    if (!clip) {
      return;
    }

    clip.click();
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
        let img = document.querySelector(this.SELECTORS.illust.med.imgLink);
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

    // クリップしたら自動ダウンロード
    let niceEventFunc = () => {
      if (!this.prefs.site.downloadWhenNice) {
        return true;
      }

      let clip = document.querySelector(this.SELECTORS.info.illust.clip);
      if (!clip) {
        return;
      }

      clip.addEventListener('click', () => {
        this.downloadCurrentImage({'autoDownload': true});
      }, false);

      return true;
    };

    //

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': niceEventFunc, 'retry': RETRY_VALUE, 'label': 'niceEventFunc'})
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

new AnkNicosei().start()
  .catch((e) => {
    console.error(e);
  });
