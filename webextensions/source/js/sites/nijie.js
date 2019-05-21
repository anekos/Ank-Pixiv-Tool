"use strict";

class AnkNijie extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'NJE';

    this.SELECTORS = {
      'illust': {
        'imgOvr': '#gallery, #dojin_left .left',
        'med': {
          'img': '#gallery  > #gallery_open > #img_filter > a > img, #gallery  > #gallery_open > #img_filter > a > video',
          'imgs': '#gallery  > #gallery_open > #img_diff > a > img'
        },
        'djn': {
          'imgLink': '#dojin_left .left .image a img',
          'imgLinks': '#gallery_new #thumbnail a img'
        }
      },
      'info': {
        'illust': {
          'datetime': 'div#view-honbun > p, div#created > p',
          'title': '#view-header > #view-left > .illust_title, #dojin_header .title',
          'caption': '#view-honbun > p+p, #dojin_text > p+p',
          'nuita': '#nuita',
          'good': '#good',
          'tags': '#view-tag .tag .tag_name'

        },
        'member': {
          'memberLink': 'a.name, div#dojin_left > div.right > p.text > a'
        }
      },
      'misc': {
        'nextLink': 'a#nextIllust',
        'prevLink': 'a#backIllust'
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
     * @returns {{thumbnail, original}}
     */
    let getPathContext = () => {
      let getMedPath = (img) => {
        let m = [{'src': img.src}];
        Array.prototype.forEach.call(document.querySelectorAll(this.SELECTORS.illust.med.imgs), (e) => {
          m.push({'src': e.src.replace(/(\.nijie\.info\/).+?\/(nijie_picture\/)/, "$1$2")});
        });

        return {
          'thumbnail': m,
          'original': m
        }
      };

      let getDjnPath = (imgLink) => {
        let m = [{'src': imgLink.src}];
        Array.prototype.forEach.call(document.querySelectorAll(this.SELECTORS.illust.djn.imgLinks), (e) => {
          m.push({'src': e.src.replace(/(\.nijie\.info\/).+?\/(dojin_main\/)/, "$1$2")});
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

      let imgLink = document.querySelector(this.SELECTORS.illust.djn.imgLink);
      if (imgLink) {
        return getDjnPath(imgLink);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @returns {{url: string, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: *, caption: (Element|*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = () => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(document.querySelector(this.SELECTORS.info.illust.datetime).textContent));

        let caption  = document.querySelector(this.SELECTORS.info.illust.caption);

        let info = {
          'url': document.location.href,
          'id': this.getIllustId(),
          'title': AnkUtils.trim(document.querySelector(this.SELECTORS.info.illust.title).textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': Array.prototype.map.call(document.querySelectorAll(this.SELECTORS.info.illust.tags), (e) => AnkUtils.trim(e.textContent)),
          'caption': caption && AnkUtils.trim(caption.textContent),
          'R18': true
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
          'id': /\/members\.php\?id=(.+?)(?:&|$)/.exec(memberLink.href)[1],
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

    context.path = getPathContext();
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
    let m = /^https?:\/\/nijie\.info\/view\.php\?id=(\d+)/.exec(url);
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
      { 'q':'.nijie > .picture > .nijiedao > a', 'n':3 },         // 通常の一覧
      { 'q':'.nijie > .nijiedao > a', 'n':2 },                    // "同人"の一覧
      { 'q':'.nijie-bookmark > .picture> .nijiedao > a', 'n':3 }, // "ブックマーク"の一覧
      { 'q':'#okazu_list > a', 'n':-1},                           // おかず
      { 'q':'#carouselInner-view > ul > li > a', 'n':1 }          // "あなたにオススメのイラスト"
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
   * いいね！する
   */
  setNice () {
    let good = document.querySelector(this.SELECTORS.info.illust.good);
    if (!good) {
      return;
    }

    good.click();
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
        let img = document.querySelector(this.SELECTORS.illust.med.img) || document.querySelector(this.SELECTORS.illust.djn.imgLink);
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

    // 抜いた・いいねしたら自動ダウンロード
    let niceEventFunc = () => {
      if (!this.prefs.site.downloadWhenNice) {
        return true;
      }

      let btns = ['nuita', 'good'].map((e) => document.querySelector(this.SELECTORS.info.illust[e]));
      if (!btns[0] || !btns[1]) {
        return;
      }

      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.downloadCurrentImage({'autoDownload': true});
        }, false);
      });

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
      .catch((e) => logger.warn(e));
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

new AnkNijie().start()
  .catch((e) => {
    console.error(e);
  });
