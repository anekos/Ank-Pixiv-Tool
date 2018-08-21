"use strict";

class AnkPixivFanbox extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor() {
    super();

    this.SITE_ID = 'PFB';

    this.USE_CONTEXT_CACHE = false;
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
     * @returns {Promise.<{original: Array}>}
     */
    let getPathContext = async (post_data) => {
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
     * @returns {Promise.<{url: string, id: *, title: (string|*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|string|*|string|XML|void|string), R18: boolean}>}
     */
    let getIllustContext = async (post_data) => {
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
     * @returns {Promise.<{id: *, pixiv_id: null, name: (string|*|string|XML|void), memoized_name: null}>}
     */
    let getMemberContext = async (post_data) => {
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

    /**
     * ダミー
     * @param post_data
     * @returns {Promise.<void>}
     */
    let getDummyContext = async (post_data) => {};

    //

    mode = mode || this.GET_CONTEXT.ALL;

    let post_data = await getPostData(elm);

    if (post_data) {
      let path_func = mode & this.GET_CONTEXT.PATH ? getPathContext : getDummyContext;
      let illust_func = mode & this.GET_CONTEXT.ILLUST ? getIllustContext : getDummyContext;
      let member_func = mode & this.GET_CONTEXT.MEMBER ? getMemberContext : getDummyContext;

      return Promise.all([
        path_func(post_data),
        illust_func(post_data),
        member_func(post_data)
      ]);
    }

    return null;
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
