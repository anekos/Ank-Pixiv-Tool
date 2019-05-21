"use strict";

class AnkDeviantart extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'dART';

    this.USE_CONTEXT_CACHE = false;

    this.SELECTORS = {
      'illust': {
        'med': {
          'img': '.dev-view-deviation .dev-content-normal',
          'bigImg': '.dev-view-deviation .dev-content-full'
        },
      },
      'info': {
        'illust': {
          'datetime': '.dev-metainfo-content.dev-metainfo-details > dl > dd > span',
          'title': '.dev-title-container h1 > a',
          'caption': '.dev-description .text.block',
          'tags': '.dev-title-container .dev-about-breadcrumb a'
        },
        'member': {
          'memberLink': '.dev-title-container .author .username'
        },
        'misc': {
          'content': 'body',
        }
      },
      'miniBrowse': '.minibrowse-container.dev-page-container'
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
     * @param container
     * @returns {{thumbnail, original}}
     */
    let getPathContext = (container) => {
      let getMedPath = (img) => {
        return {
          'thumbnail': [{'src': img.src}],
          'original': [{'src': container.querySelector(this.SELECTORS.illust.med.bigImg).src}]
        }
      };

      let img = container.querySelector(this.SELECTORS.illust.med.img);
      if (img) {
        return getMedPath(img);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param container
     * @returns {{url: string, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: *, caption: (Element|*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = (container) => {
      try {
        let dd = new Date(parseInt(container.querySelector(this.SELECTORS.info.illust.datetime).getAttribute('ts'),10) * 1000);
        let posted = this.getPosted(() => AnkUtils.getDateData(dd));

        let caption = container.querySelector(this.SELECTORS.info.illust.caption);

        let info = {
          'url': document.location.href,
          'id': this.getIllustId(),
          'title': AnkUtils.trim(container.querySelector(this.SELECTORS.info.illust.title).textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': Array.prototype.map.call(container.querySelectorAll(this.SELECTORS.info.illust.tags), (e) => AnkUtils.trim(e.textContent).replace(/^#/, '')),
          'caption': caption && AnkUtils.trim(caption.textContent),
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
     * @param container
     * @returns {{id: *, name: (*|string|XML|void|string), pixiv_id: null, memoized_name: null}}
     */
    let getMemberContext = (container) => {
      try {
        let memberLink = container.querySelector(this.SELECTORS.info.member.memberLink);
        return {
          'id': /^https?:\/\/www\.deviantart\.com\/([^/]+?)(?:\?|$)/.exec(memberLink.href)[1],
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

    let container = this._getOpenedContainer();
    if (!container) {
      // miniBrowseの中身が書き換わっていない
      return null;
    }

    let context = {};

    context.path = getPathContext(container);
    context.illust = getIllustContext(container);
    context.member = getMemberContext(container);

    return context;
  }

  /**
   * イラストIDの取得
   * @param url
   * @returns {*}
   */
  getIllustId (url) {
    url = url || document.location.href;
    let m = /^https?:\/\/www\.deviantart\.com\/[^/]+?\/art\/(.+?)(?:\?|$)/.exec(url);
    if (m) {
      return m[1];
    }
  }

  /**
   * 開いているコンテナを探す
   * @returns {Element|HTMLDocument}
   * @private
   */
  _getOpenedContainer () {
    let illustId = this.getIllustId();
    if (illustId) {
      let container = document.querySelector(this.SELECTORS.miniBrowse) || document;
      let title = container.querySelector(this.SELECTORS.info.illust.title);
      if (title && illustId === this.getIllustId(title.href)) {
        // miniBrowseの中身がURLに一致している場合のみ
        return container;
      }
    }
  }

  /**
   * サムネイルにダウンロード済みマークを付ける
   * @returns {{node: *, queries: [*,*,*], getId: (function(*=)), getLastUpdate: undefined, method: string}}
   */
  getMarkingRules () {

    const MARKING_TARGETS = [
      /*
      { 'q':'.dev-page-container .thumb > a', 'n':1 },
      { 'q':'.feed-action-content a.thumb', 'n':1 },
      { 'q':'#gmi-GZone .gr-body a', 'n':2 },
      { 'q':'#gmi- span.thumb > a', 'n':1 },
      { 'q':'.grid-thumb a.thumb', 'n':2 }
      */
      { 'q': '.torpedo-thumb-link', 'n': 1 },
      { 'q': 'a.thumb', 'n': 1 },
      { 'q': '.thumb > a', 'n': 1 }
    ];

    return {
      'node': this._getOpenedContainer(),
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return this.getIllustId(href);
      },
      'getLastUpdate': undefined,
      'method': 'border'
    };
  }

  /**
   *
   * @param data
   */
  onHistoryChanged (data) {

    logger.debug('on history changed.');

    this.resetMarkAndDisplay();
    this.resetElements();
    this.resetCondition();

    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
    }
  }

  /**
   * 機能のインストール（イラストページ用）
   * @param RETRY_VALUE
   */
  installIllustPageFunction (RETRY_VALUE) {

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      if (document.readyState !== "complete") {
        return false;
      }

      if (!this._getOpenedContainer()) {
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

      if (!this._getOpenedContainer()) {
        return false;
      }

      this.markDownloaded().then();
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      //AnkUtils.delayFunctionInstaller({'func': detectContentChange, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'detectContentChange'})
    ])
      .catch((e) => logger.warn(e));
  }

  /**
   * 機能のインストール
   */
  installFunctions () {

    // window.history.pushState に割り込む
    AnkUtils.overridePushState();

    this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
  }

}

// 開始

new AnkDeviantart().start()
  .catch((e) => {
    console.error(e);
  });
