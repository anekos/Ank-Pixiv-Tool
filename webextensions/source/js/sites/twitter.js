"use strict";

class AnkTwitter extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor () {
    super();

    this.SITE_ID = 'TWT';

    this.USE_CONTEXT_CACHE = false;
  }

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  getElements (doc) {

    const SELECTOR_ITEMS = {
      "illust": {
        "tweet": {
          "ovr": {"s": "#permalink-overlay"},
          "tweet": {"s": "#permalink-overlay .permalink-tweet"},
          "content": {"s": "#permalink-overlay .PermalinkOverlay-content"}
        },
        "gallary": {
          "ovr": {"s": ".Gallery.with-tweet"},
          "tweet": {"s": ".Gallery.with-tweet .tweet"},
          "content": {"s": ".Gallery.with-tweet .Gallery-content"}
        },
        "video": {"s": ".AdaptiveMedia-container .AdaptiveMedia-videoContainer video"},

        "photos": {"ALL": ".AdaptiveMedia-container .AdaptiveMedia-photoContainer img"}
      },
      "info": {
        "illust": {
          "ownLink": {"s": ".time .tweet-timestamp"},
          "datetime": {"s": ".time  .tweet-timestamp ._timestamp"},
          "caption": {"s": ".tweet-text"}
        },
        "member": {
        }
      },
      "misc": {
        "downloadedDisplayParent": {"s": ".stream-item-footer"}
      }
    };

    let selectors = this.attachSelectorOverride({}, SELECTOR_ITEMS);

    let gElms = this.initSelectors({'doc': doc}, selectors, doc);

    return gElms;
  }

  /**
   *
   * @returns {*}
   */
  getOpenedModal () {
    const KS = ['gallary', 'tweet'];
    for (let i=0; i<KS.length; i++) {
      let e = this.elements.illust[KS[i]];
      if (e.ovr && getComputedStyle(e.ovr, '').getPropertyValue('display') === 'block') {
        return e;
      }
    }
  }

  /**
   *
   * @returns {boolean}
   */
  inIllustPage () {
    return !!this.getOpenedModal();
  }

  /**
   *
   * @param elm
   * @param mode
   * @returns {Promise.<{}>}
   */
  async getAnyContext (elm, mode) {

    /**
     * ダウンロード情報（画像パス）の取得
     * @param elm
     * @returns {{thumbnail, original}}
     */
    let getPathContext = (elm) => {
      let getPhotoPath = () => {
        let thumb = Array.prototype.map.call(elm.illust.photos, (e) => {
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

      let getVideoPath = () => {
        let src = elm.illust.video.src;
        if (/^https?:\/\//.test(src)) {
          let m = [{'src': src}];
          return {
            'thumbnail': m,
            'original': m
          };
        }

        // ストリーム再生の動画(.m3u8/blob)には未対応
      };

      if (elm.illust.photos && elm.illust.photos.length > 0) {
        return getPhotoPath();
      }
      if (elm.illust.video) {
        return getVideoPath();
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param elm
     * @returns {{url, id: string, title: (*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), tags: Array, caption: (*|string|XML|void|string), R18: boolean}}
     */
    let getIllustContext = (elm) => {
      try {
        let dd = new Date(parseInt(elm.info.illust.datetime.getAttribute('data-time-ms'), 10));
        let posted = this.getPosted(() => AnkUtils.getDateData(dd));

        let info = {
          'url': elm.info.illust.ownLink.href,
          'id': elm.doc.getAttribute('data-tweet-id'),
          'title': AnkUtils.trim(elm.info.illust.caption.textContent),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'tags': [],
          'caption': AnkUtils.trim(elm.info.illust.caption.textContent),
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
     * @param elm
     * @returns {Promise.<{id: string, name: string, pixiv_id: string, memoized_name: null}>}
     */
    let getMemberContext = (elm) => {
      try {
        return {
          'id': elm.doc.getAttribute('data-user-id'),
          'name': elm.doc.getAttribute('data-name'),
          'pixiv_id': elm.doc.getAttribute('data-screen-name'),
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    //

    let context = {};

    context.path = getPathContext(elm);
    context.illust = getIllustContext(elm);
    context.member = getMemberContext(elm);

    return context;
  }

  /**
   * override : getContext()
   * @param elm
   * @param mode
   * @returns {Promise.<*>}
   */
  async getContext (elm, mode) {

    let modal = this.getOpenedModal();
    if (!modal) {
      return false;
    }

    let elmTweet = this.getElements(modal.tweet);

    return super.getContext(elmTweet, mode);
  }

  /**
   * override : displayDownloaded()
   * @param opts
   * @returns {Promise.<boolean>}
   */
  async displayDownloaded (opts) {

    opts = opts || {};

    opts.getElms = () => {
      if (opts.elm) {
        return opts.elm;
      }

      let modal = this.getOpenedModal();
      if (modal) {
        return this.getElements(modal.tweet);
      }
    };

    return super.displayDownloaded(opts);
  }

  /**
   *
   */
  installFunctions () {

    // ギャラリーを開いたとき
    let displayWhenGallaryOpened = () => {
      let content = this.elements.illust.gallary.content;
      if (!content) {
        return false;
      }

      new MutationObserver(() => {
        let modal = this.getOpenedModal();
        if (modal && modal.tweet) {
          this.resetContext();
          this.displayDownloaded({'elm': this.getElements(modal.tweet), 'force': true}).then();
        }
      }).observe(content, {'attributes': true});

      return true;
    };

    // ツイートを開いたとき
    let displayWhenTweetOpened = () => {
      let content = this.elements.illust.tweet.content;
      if (!content) {
        return false;
      }

      new MutationObserver((o) => {
        o.forEach((e) => {
          if (e.target.classList.contains('permalink-tweet')) {
            if (getComputedStyle(e.target, '').getPropertyValue('display') === 'block') {
              this.resetContext();
              this.displayDownloaded({'elm': this.getElements(e.target), 'force': true}).then();
            }
          }
        });
      }).observe(content, {'attributes': true, 'subtree': true});

      return true;
    };

    // 「保存済み」を表示する
    let delayDisplaying = () => {
      let modal = this.getOpenedModal();
      if (!modal || !modal.tweet) {
        return false;
      }

      this.displayDownloaded({'elm': this.getElements(modal.tweet), 'force': true}).then();
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': displayWhenGallaryOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenGallaryOpened'}),
      AnkUtils.delayFunctionInstaller({'func': displayWhenTweetOpened, 'retry': this.FUNC_INST_RETRY_VALUE, 'label': 'displayWhenTweetOpened'}),
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
