"use strict";

class AnkPixivFanbox extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor() {
    super();

    this.SITE_ID = 'PFB';

    this.USE_CONTEXT_CACHE = false;

    this._illustDataCache = {
      'id': null,
      'data': null
    };
  }

  /**
   *
   * @returns {boolean}
   */
  inIllustPage () {
    return !!this.getIllustId();
  }

  /**
   * ダウンロード情報（画像パス）の取得
   * @param mode
   * @returns {Promise.<*>}
   */
  async getAnyContext (mode) {
    /**
     * 作品情報を要求する
     * @param illustId
     * @returns {Promise.<*>}
     */
    let reqPostData = async (illustId) => {
      // content script からの fecth では origin header を送れなかったのでページにスクリプトを挿入して実行させる
      let f = function () {
        return fetch("https://api.fanbox.cc/post.info?postId=#ILLUST_ID#", {"credentials": "include"}).then(e=>e.json());
      };
      let a = await AnkUtils.executeScript(document, 'ANKPIXPV_GET_POST_INFO', f.toString().replace(/#ILLUST_ID#/g, illustId));
      return a && a.body;
    };

    /**
     * ダウンロード情報（画像パス）の取得
     * @param post_data
     * @returns {{original: Array}}
     */
    let getPathContext = (post_data) => {
      try {
        if (post_data.type === 'image') {
          return {
            'original': post_data.body.images.map((e) => {return {'src': e.originalUrl, 'referrer': document.location.href}})
          };
        }
        else if (post_data.type == 'article') {
          return {
            'original': post_data.body.blocks.map((e) => {
              if (e.type ==='image') {
                return {
                  'src': post_data.body.imageMap[e.imageId].originalUrl,
                  'referrer': document.location.href
                };
              }
              else if (e.type ==='file') {
                return {
                  'src': post_data.body.fileMap[e.fileId].url,
                  'referrer': document.location.href
                };
              }
            }).filter(e=>!!e)
          };
        }
        else if (post_data.type == 'file') {
          return {
            'original': post_data.body.files.map((e) => {return {'src': e.url, 'referrer': document.location.href}})
          };
        }
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param post_data
     * @returns {{url: string, id: *, title: (*|string|XML|void|string|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|*|string|XML|void|string|string), R18: boolean}}
     */
    let getIllustContext = (post_data) => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(post_data.publishedDatetime));
        let updated = this.getPosted(() => AnkUtils.decodeTextToDateData(post_data.updatedDatetime));

        let info = {
          'url': document.location.href,
          'id': post_data.id,
          'title': post_data.title && AnkUtils.trim(post_data.title) || '',
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': post_data.tags && post_data.tags,
          'caption': post_data.body.text && AnkUtils.trim(post_data.body.text) || post_data.excerpt && AnkUtils.trim(post_data.excerpt) || '',
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
     * ダウンロード情報（メンバー情報）の取得
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

    let illustId = this.getIllustId();

    let illust_data = this._illustDataCache.id === illustId && this._illustDataCache.data;
    if (!illust_data) {
      illust_data = await reqPostData(illustId);
      if (!illust_data) {
        return null;
      }

      this._illustDataCache.id = illustId;
      this._illustDataCache.data = illust_data;
    }

    let context = {};

    context.path = getPathContext(illust_data);
    context.illust = getIllustContext(illust_data);
    context.member = getMemberContext(illust_data);

    return context;
  }

  /**
   * イラストIDの取得
   * @param url
   * @returns {*}
   */
  getIllustId (url) {
    url = url || document.location.href;
    let m = /\.fanbox\.cc\/(?:[^/]+?\/)?posts\/(\d+)(?:\?|$)/.exec(url);
    if (m) {
      return m[1];
    }
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
   */
  installIllustPageFunction (RETRY_VALUE) {
    // 「保存済み」を表示する
    let delayDisplaying = () => {
      if (document.readyState !== "complete") {
        return false;
      }

      this.displayDownloaded().then();
      return true;
    };

    //

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'})
    ])
      .catch((e) => logger.warn(e));
  }

  /**
   * 機能のインストールのまとめ
   */
  installFunctions () {
    // window.history.pushState に割り込む
    AnkUtils.overridePushState();

    this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
  }

}

// 開始

new AnkPixivFanbox().start()
  .catch((e) => {
    console.error(e);
  });
