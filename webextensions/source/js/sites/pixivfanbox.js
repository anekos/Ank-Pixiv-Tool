"use strict";

class AnkPixivFanbox extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor() {
    super();

    this.SITE_ID = 'PFB';

    this.USE_CONTEXT_CACHE = false;

    this._illust_data_cache = {
      'id': null,
      'data': null
    };
  }

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  getElements (doc) {

    const SELECTOR_ITEMS = {
      //
    };

    let selectors = this.attachSelectorOverride({}, SELECTOR_ITEMS);

    let gElms = this.initSelectors({'doc': doc}, selectors, doc);

    return gElms;
  }

  /**
   *
   * @param doc
   * @returns {boolean}
   */
  inIllustPage (doc) {
    doc = doc || document;
    return /^https?:\/\/www\.pixiv\.net\/fanbox\//.test(doc.location.href);
  }

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @param mode
   * @returns {Promise.<*>}
   */
  async getAnyContext (elm, mode) {
    /**
     *
     * @param elm
     * @returns {Promise.<void>}
     */
    let getPostData = async (elm) => {
      try {
        let loc = elm.doc.location.href;
        let illustId = this.getIllustId(loc);

        let post_resp = await remote.get({
          'url': 'https://www.pixiv.net/ajax/fanbox/post?postId='+illustId,
          'responseType': 'json',
          'timeout': this.prefs.xhrTimeout
        });

        if (post_resp.error) {
          logger.error(new Error(post_resp.message));
          return null;
        }

        let post_json = post_resp.json.body;

        return post_json;
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     *
     * @param post_data
     * @returns {{original: Array}}
     */
    let getPathContext = (post_data) => {
      try {
        if (post_data.type == 'image') {
          return {
            'original': post_data.body.images.map((e) => {return {'src': e.originalUrl, 'referrer': elm.doc.location.href}})
          };
        }
        else if (post_data.type == 'file') {
          return {
            'original': post_data.body.files.map((e) => {return {'src': e.url, 'referrer': elm.doc.location.href}})
          };
        }
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     *
     * @param post_data
     * @returns {{url: string, id: *, title: (*|string|XML|void|string|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|*|string|XML|void|string|string), R18: boolean}}
     */
    let getIllustContext = (post_data) => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(post_data.publishedDatetime));
        let updated = this.getPosted(() => AnkUtils.decodeTextToDateData(post_data.updatedDatetime));

        let info = {
          'url': elm.doc.location.href,
          'id': this.getIllustId(elm.doc.location.href),
          'title': post_data.title && AnkUtils.trim(post_data.title) || '',
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': [],
          'caption': post_data.body.text && AnkUtils.trim(post_data.body.text) || '',
          'R18': false
        };

        if (updated.timestamp > posted.timestamp) {
          // 更新があった場合
          info.updated = updated.timestamp;
          info.updatedYMD = updated.ymd;
        }

        return info;
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     *
     * @param post_data
     * @returns {{id: *, pixiv_id: null, name: (*|string|XML|void|string), memoized_name: null}}
     */
    let getMemberContext = (post_data) => {
      try {
        return {
          'id': post_data.user.userId,
          'pixiv_id': null,
          'name': AnkUtils.trim(post_data.user.name),
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }

    };

    //

    let illustId = this.getIllustId(elm.doc.location.href);

    let illust_data = this._illust_data_cache.id === illustId && this._illust_data_cache.data;
    if (!illust_data) {
      illust_data = await getPostData(elm);
      if (!illust_data) {
        return null;
      }

      this._illust_data_cache.id = illustId;
      this._illust_data_cache.data = illust_data;
    }

    let context = {};

    context.path = getPathContext(illust_data);
    context.illust = getIllustContext(illust_data);
    context.member = getMemberContext(illust_data);

    return context;
  }

  /**
   * イラストIDの取得
   * @param loc
   * @returns {*}
   */
  getIllustId (loc) {
    return (/\/creator\/\d+\/post\/(\d+)$/.exec(loc) || [])[1];
  }

  /**
   * 機能のインストール（イラストページ用）
   */
  installIllustPageFunction (RETRY_VALUE) {
    // no proc.
  }

  /**
   * 機能のインストールのまとめ
   */
  installFunctions () {
    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }
  }

}

// 開始

new AnkPixivFanbox().start()
  .catch((e) => {
    console.error(e);
  });
