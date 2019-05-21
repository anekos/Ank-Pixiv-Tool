"use strict";

/**
 * - mobile UI(新UI)ではDOMから画像URLが拾えない場合があるのでtwitterAPIを叩しかないが、認証が必要になる (2019.05)
 */

class AnkTwitter extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'TWT';

    //this.USE_CONTEXT_CACHE = false;

    this.SELECTORS = {
      'illust': {
        'tweet_modal': {
          'ovr': '#permalink-overlay',
          'content': '.PermalinkOverlay-content',
          'tweet': '.PermalinkOverlay-content .permalink-tweet'
        },
        'gallery_modal': {
          'ovr': '.Gallery.with-tweet',
          'content': '.Gallery-content',
          'tweet': '.Gallery-content .tweet'
        },
        'video': '.AdaptiveMedia-container .AdaptiveMedia-videoContainer video',
        'photos': '.AdaptiveMedia-container .AdaptiveMedia-photoContainer img',
        'ownLink': '.time .tweet-timestamp',
        'datetime': '.time  .tweet-timestamp ._timestamp',
        'caption': '.tweet-text'
      }
    };
  }

  /**
   * イラストIDの取得
   * @param url
   * @returns {*}
   */
  getIllustId (url) {
    url = url || document.location.href;
    let m = /\/status\/(\d+)(?:\/|\?|$)/.exec(url);
    if (m) {
      return m[1];
    }

    // 旧UI
    let modal = this._getOpenedModal();
    if (modal && modal.ownLink) {
      return this.getIllustId(modal.ownLink.href);
    }
  }

  /**
   * 開いているツイートモーダルを探す (旧UI)
   * @returns {{ovr, content, tweet, ownLink: Element, datetime: Element, caption: Element}}
   * @private
   */
  _getOpenedModal () {
    const KS = ['gallery_modal', 'tweet_modal'];
    for (let i=0; i<KS.length; i++) {
      let s = this.SELECTORS.illust[KS[i]];
      let ovr = document.querySelector(s.ovr);
      if (this._isModalOpened(ovr)) {
        let tweet = ovr.querySelector(s.tweet);
        if (tweet) {
          return {
            'ovr': ovr,
            'content': ovr.querySelector(s.content),
            'tweet': tweet,
            'ownLink': tweet.querySelector(this.SELECTORS.illust.ownLink),
            'datetime': tweet.querySelector(this.SELECTORS.illust.datetime),
            'caption': tweet.querySelector(this.SELECTORS.illust.caption),
          };
        }
      }
    }
  }

  /**
   * モーダルは表示状態か？
   * @param ovr
   * @returns {*|boolean}
   * @private
   */
  _isModalOpened (ovr) {
   return ovr && getComputedStyle(ovr, '').getPropertyValue('display') === 'block';
  }

  /**
   *
   * @returns {boolean}
   */
  inIllustPage () {
    return !!this.getIllustId();
  }

  /**
   * ダウンロード情報の取得 (新UI用)
   * @param illustId
   * @returns {Promise.<{}>}
   * @private
   */
  async _getAnyContext (illustId) {
    /**
     * ダウンロード情報（画像パス）の取得
     * @param statuses
     * @returns {{thumbnail: null, original: Array}}
     */
    let getPathContext = (statuses) => {
      let images = statuses.entities.media.map((e) => {
        return { 'src': e.media_url_https+':orig' };
      });

      return {
        'thumbnail': null,
        'original': images
      };
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param statuses
     * @returns {{url: string, id, title: (string|*|string|XML|void), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (string|*|string|XML|void), R18: boolean}}
     */
    let getIllustContext = (statuses) => {
      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(statuses.created_at));

        let info = {
          'url': document.location.href,
          'id': statuses.id,
          'title': AnkUtils.trim(statuses.text),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': [],
          'caption': AnkUtils.trim(statuses.text),
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
     * @param statuses
     * @returns {{id: *, name: *, pixiv_id: *, memoized_name: null}}
     */
    let getMemberContext = (statuses) => {
      try {
        return {
          'id': statuses.user.id,
          'name': statuses.user.name,
          'pixiv_id': statuses.user.screen_name,
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    // FIXME 情報取得は DOM からではなく API(statuses/show/:id) を使うようにするべき

    const API_URL = 'https://api.twitter.com/1.1/statuses/show.json?id=';

    if (this.prefs.site.authToken) {
      let resp = await remote.get({
        'url': API_URL+illustId,
        'headers': [
          { 'name': 'authorization', 'value': this.prefs.site.authToken }
        ],
        'responseType': 'json',
        'timeout': this.prefs.xhrTimeout
      });

      if (resp) {
        let context = {};

        context.path = getPathContext(resp.json);
        context.illust = getIllustContext(resp.json);
        context.member = getMemberContext(resp.json);

        return context;
      }
    }
  }

  /**
   * ダウンロード情報の取得 (旧UI用)
   * @param modal
   * @returns {Promise.<{}>}
   * @private
   */
  async _getAnyContextOld (modal) {
    /**
     * ダウンロード情報（画像パス）の取得
     * @param modal
     * @returns {{thumbnail, original}}
     */
    let getPathContext = (modal) => {
      let getPhotoPath = (photos) => {
        let thumb = Array.prototype.map.call(photos, (e) => {
          return {'src': e.src};
        });

        let orig = thumb.map((e) => {
          return {'src': e.src.replace(/(?::large)?$/, ':orig')};
        });

        return {
          'thumbnail': thumb,
          'original': orig
        };
      };

      let getVideoPath = (video) => {
        let src = video.src;
        if (/^https?:\/\//.test(src)) {
          let m = [{'src': src}];
          return {
            'thumbnail': m,
            'original': m
          };
        }

        // ストリーム再生の動画(.m3u8/blob)には未対応
      };

      let photos = modal.tweet.querySelectorAll(this.SELECTORS.illust.photos);
      if (photos && photos.length > 0) {
        return getPhotoPath(photos);
      }

      let video = modal.tweet.querySelector(this.SELECTORS.illust.video);
      if (video) {
        return getVideoPath(video);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param modal
     * @returns {{url, id: *, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption, R18: boolean}}
     */
    let getIllustContext = (modal) => {
      try {
        let dd = new Date(parseInt(modal.datetime.getAttribute('data-time-ms'), 10));
        let posted = this.getPosted(() => AnkUtils.getDateData(dd));

        let info = {
          'url': modal.ownLink.href,
          'id': this.getIllustId(modal.ownLink.href),
          'title': AnkUtils.trim(modal.caption.textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': [],
          'caption': AnkUtils.trim(modal.caption.textContent),
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
     * @param modal
     * @returns {{id: string, name: string, pixiv_id: string, memoized_name: null}}
     */
    let getMemberContext = (modal) => {
      try {
        return {
          'id': modal.tweet.getAttribute('data-user-id'),
          'name': modal.tweet.getAttribute('data-name'),
          'pixiv_id': modal.tweet.getAttribute('data-screen-name'),
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    //

    let context = {};

    context.path = getPathContext(modal);
    context.illust = getIllustContext(modal);
    context.member = getMemberContext(modal);

    return context;
  }

  /**
   * ダウンロード情報の取得
   * @param mode
   * @returns {Promise.<{}>}
   */
  async getAnyContext (mode) {

    let illustId = this.getIllustId();
    if ( ! illustId) {
      return null;
    }

    let modal = this._getOpenedModal();
    if (modal) {
      return this._getAnyContextOld(modal);
    }

    return this._getAnyContext(illustId);
  }

  /**
   *
   * @param data
   */
  onHistoryChanged (data) {
    logger.debug('on history changed.');

    let illustId = this.getIllustId();
    if (illustId) {
      // ツイートを開いたとき
      this.resetMarkAndDisplay();
      if ( ! this.isContextCached(illustId)) {
        this.resetCondition();
      }
      this.displayDownloaded({'force': true}).then();
    }
    else {
      this.resetMarkAndDisplay();
      this.resetCondition();
    }
  }

  /**
   *
   */
  installFunctions () {

    // window.history.pushState に割り込む
    AnkUtils.overridePushState();

    // ギャラリーを開いたとき (旧UI)
    let displayWhenGallaryOpened = () => {
      let gallery_modal_ovr = document.querySelector(this.SELECTORS.illust.gallery_modal.ovr);
      if (!gallery_modal_ovr) {
        return false;
      }
      let content = gallery_modal_ovr.querySelector(this.SELECTORS.illust.gallery_modal.content);
      if (!content) {
        return false;
      }

      new MutationObserver(() => {
        if (this._isModalOpened(gallery_modal_ovr)) {
          this.resetMarkAndDisplay();
          this.resetCondition();
          this.displayDownloaded({'force': true}).then();
        }
        else {
          this.resetMarkAndDisplay();
          this.resetCondition();
        }
      }).observe(content, {'attributes': true});

      return true;
    };

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      if ( ! this.inIllustPage()) {
        return false;
      }

      this.displayDownloaded({'force': true}).then();
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': displayWhenGallaryOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenGallaryOpened'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'delayDisplaying'}),
    ])
      .catch((e) => logger.warn(e));
  }

}

// 開始

new AnkTwitter().start()
  .catch((e) => {
    console.error(e);
  });
