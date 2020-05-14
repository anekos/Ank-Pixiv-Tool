"use strict";

class AnkPixiv extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor() {
    super();

    this.SITE_ID = 'PXV';

    this.USE_AJAX_PAGES_DATA = false;

    this.SELECTORS = {
      'illust': {
        'self_thumbnails': 'div > a[href*="/artworks/#ILLUST_ID#"] > div > img[src*="/img-master/"], div > a[href*="illust_id=#ILLUST_ID#"] > div > img[src*="/img-master/"]',
        'thumbnails': 'div > a[href*="/artworks/"] > div > img[src*="/img-master/"], div > a[href*="illust_id="] > div > img[src*="/img-master/"]',
        'thumbnail_container': 'div > a[href*="/artworks/"], div > a[href*="illust_id="]',
        'thumbnail_image': ':scope > div > img[src*="/img-master/"], :scope > div[style*="/img-master/"], :scope > div > figure',
        'R18': 'a[href*="R-18"]',
        'recommendZone': '.gtm-illust-recommend-zone'
      },
      'list': {
        'recommendList': '#illust-recommend ._image-items',
        'feedList': '#stacc_timeline, #stacc_center_timeline',
        'rankingList': '.ranking-items',
        'discovery': '#js-mount-point-discovery .column-title+div'
      }
    };

    this.LONG_RETRY_VALUE = {
      'max': 9999,
      'wait': 3000
    };

    this._illustDataCache = {
      'id': null,
      'data': null
    };

    this._installed_function = {
      'thumbnailListExpansion': null,
      'recommendExpansion': null
    };
  }

  /**
   * イラストページに居るかどうか
   * @returns {boolean}
   */
  inIllustPage () {
    // FIXME 新UIと旧UIが混在しているのでここで分ける。他のサイトモジュールとは inIllustPage() の用途が少し異なる
    return !! [
      /\/artworks\//,
      /\/member_illust\.php\?/,
      /\/member\.php\?/,
      /\/bookmark\.php\?/
    ].find((e) => e.test(document.location.href));
  }

  /**
   * ダウンロード情報の取得
   * @param mode
   * @returns {Promise.<*>}
   */
  async getAnyContext (mode) {

    /**
     * 各種情報(JSON形式)を要求する共通部品
     * @param url
     * @returns {Promise.<*>}
     */
    let callPixivAjax = async (url) => {
      try {
        let post_resp = await remote.get({
          'url': url,
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
     * 作品情報を要求する
     * @param illustId
     * @returns {Promise.<*>}
     */
    let reqIllustData = async (illustId) => {
      return callPixivAjax('https://www.pixiv.net/ajax/illust/'+illustId);
    };

    /**
     * 画像リストを要求する
     * @param illustId
     * @returns {Promise.<*>}
     */
    let reqPagesData = async (illustId) => {
      return callPixivAjax('https://www.pixiv.net/ajax/illust/'+illustId+'/pages');
    };

    /**
     * うごイラのメタ情報を要求する
     * @param illustId
     * @returns {Promise.<*>}
     */
    let reqUgoiraMeta = async (illustId) => {
      return callPixivAjax('https://www.pixiv.net/ajax/illust/'+illustId+'/ugoira_meta');
    };

    /**
     * ダウンロード情報（画像パス）の取得
     * @param illust_data
     * @returns {Promise.<*>}
     */
    let getPathContext = async (illust_data) => {
      try {
        let loc = document.location.href;

        let orig_base = illust_data.urls.original;
        let thumb_base = illust_data.urls.regular || orig_base;

        let genPages = (base, pages) => {
          return [...Array(pages).keys()].map((v, i) => {
            return {
              'src': base.replace('_p0', '_p'+i),
              'referrer': loc
            }
          });
        };

        // 一枚目の画像のURLから枚数分のURLを生成する
        let original = genPages(orig_base, illust_data.pageCount);
        let thumbnail = genPages(thumb_base, illust_data.pageCount);

        if (this.USE_AJAX_PAGES_DATA) {
          // 画像URLリストを取得するIFは存在するが使われている気配が無いなので利用は保留
          let pages_data = await reqPagesData(illust_data.illustId);
          if (!pages_data) {
            return null;
          }
          original = pages_data.map((e) => { return {'src': e.urls.original, 'referrer': loc}});
          thumbnail = pages_data.map((e) => { return {'src': e.urls.regular, 'referrer': loc}});
        }

        if (illust_data.illustType != 1) {
          let sp_book_style = illust_data.contestBanners && parseInt(illust_data.contestBanners.illust_book_style, 10);
          if (sp_book_style == 1 || sp_book_style == 2) {
            // 特殊な値を返してくるタイプのブックスタイルマンガ (ex. 46271807 ～ 事務局の作品でしか見かけないが？)
            illust_data.illustType = 1;
            illust_data.restrict = sp_book_style == 1 && 2 || 1;
          }
        }

        if (illust_data.restrict) {
          // ブックスタイルマンガ - ブックスタイルマンガは作品数が少ないので考慮漏れがあるかもしれない

          let swapLR = (a, i) => {
            let tmp = a[i-1];
            a[i-1] = a[i];
            a[i] = tmp;
          };

          // 見開き方向の判定
          let left2right = illust_data.restrict == 1;

          // 見開きを考慮したページ数のカウントと画像の並べ替え
          for (let i=0; i<thumbnail.length; i++) {
            let p = i + 1;
            let odd = p % 2;
            thumbnail[i].facingNo = original[i].facingNo = (p - odd) / 2 + 1;

            // 見開きの向きに合わせて画像の順番を入れ替える
            if (i > 0 && (left2right && odd)) {
              swapLR(thumbnail, i);
              swapLR(original, i);
            }
          }
        }

        return {
          'original': original,
          'thumbnail': thumbnail
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     * ダウンロード情報（うごイラパス）の取得
     * @param illust_data
     * @returns {Promise.<*>}
     */
    let getUgoiraContext = async (illust_data) => {
      try {
        let f = (s, u) => {
          return [{
            'src': s,
            'frames': u.map((o) => {return {'f':o.file, 'd':o.delay}}),
            'referrer': document.location.href
          }];
        };

        let ugoira_meta = await reqUgoiraMeta(illust_data.illustId);
        if (!ugoira_meta) {
          return null;
        }

        return {
          'thumbnail': f(ugoira_meta.src, ugoira_meta.frames),
          'original': f(ugoira_meta.originalSrc, ugoira_meta.frames)
        };
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     * ダウンロード情報（イラスト情報）の取得
     * @param illust_data
     * @returns {{url: string, id: *, title: (string|*|string|XML|void), posted: (boolean|*|Number), postedYMD: (boolean|string|*), size: ({width, height}|string), tags: Array, tools: string, caption: (string|*|string|XML|void), R18: boolean}}
     */
    let getIllustContext = (illust_data) => {
      let getLang = () => {
        let e = document.documentElement.lang.toLowerCase();
        switch (e) {
          case "zh-cn":
          case "zh":
            return "zh-CN";
          case "zh-tw":
            return "zh-TW";
          default:
            return e;
        }
      };

      try {
        let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(illust_data.createDate));
        let updated = this.getPosted(() => AnkUtils.decodeTextToDateData(illust_data.uploadDate));

        let lang = getLang();
        let tags = illust_data.tags.tags.map((e) => {
          let tag = AnkUtils.trim(e.tag);
          if (this.prefs.saveTagsWithTranslation && e.translation && e.translation.hasOwnProperty(lang)) {
              tag += '('+e.translation[lang]+')';
          }
          return tag;
        });

        let info = {
          'url': document.location.href,
          'id': illust_data.id,
          'title': AnkUtils.trim(illust_data.title),
          'posted': !posted.fault && posted.timestamp,
          'postedYMD': !posted.fault && posted.ymd,
          'size': illust_data.width && {
            'width': illust_data.width,
            'height': illust_data.height
          } || '',
          'tags': tags,
          'tools': '',
          'caption': AnkUtils.trim(AnkUtils.decodeTextContent(illust_data.description)),
          'R18': !!illust_data.xRestrict
        };

        if (updated.timestamp > posted.timestamp) {
          // 更新があった場合
          info.updated = updated.timestamp;
          info.updatedYMD = updated.ymd;
        }

        if (illust_data.seriesNavData) {
          info.seriesId = illust_data.seriesNavData.seriesId;
          info.seriesTitle = AnkUtils.trim(illust_data.seriesNavData.title);
          info.seriesOrder = illust_data.seriesNavData.order;
        }

        return info;
      }
      catch (e) {
        logger.error(e);
      }
    };

    /**
     * ダウンロード情報（メンバー情報）の取得
     * @param illust_data
     * @returns {{id, pixiv_id: *, name: (string|*|string|XML|void), memoized_name: null}}
     */
    let getMemberContext = (illust_data) => {
      try {
        return {
          'id': illust_data.userId,
          'pixiv_id': illust_data.userAccount,
          'name': AnkUtils.trim(illust_data.userName),
          'memoized_name': null
        };
      }
      catch (e) {
        logger.error(e);
      }

    };

    //

    let illustId = this.getIllustId();
    if ( ! illustId) {
      return null;
    }

    let illust_data = this._illustDataCache.id === illustId && this._illustDataCache.data;
    if (!illust_data) {
      illust_data = await reqIllustData(illustId);
      if (!illust_data) {
        return null;
      }

      this._illustDataCache.id = illustId;
      this._illustDataCache.data = illust_data;
    }

    let context = {};

    // 新サイト向け
    if (mode & this.GET_CONTEXT.PATH) {
      if (illust_data.illustType == 2) {
        context.path = await getUgoiraContext(illust_data);
      }
      else {
        context.path = await getPathContext(illust_data);
      }
    }
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
    let m = /\/artworks\/(\d+)/.exec(url);
    if (m) {
      return m[1];
    }
    m = /^(?=.*\/member_illust\.php\?)(?=.*(?:&|\?)mode=medium(?:&|$))(?=.*(?:&|\?)illust_id=(\d+)(?:&|$))/.exec(url);
    if (m) {
      return m[1];
    }
  }

  /**
   * 最終更新日時の取得
   * @param url
   * @returns {Array|{index: number, input: string}|number}
   */
  getLastUpdate (url) {
    let m = /\/(20\d\d\/\d\d\/\d\d)\/(\d\d\/\d\d)\/\d\d\//.exec(url);
    return m && new Date(m[1]+' '+m[2].replace(/\//g, ':')).getTime();
  }

  /**
   * サムネイルにダウンロード済みマークを付けるルールを返す
   * @returns {{queries: [*,*], getId: (function(*=)), getLastUpdate: (function(*)), method: undefined}}
   */
  getMarkingRules () {

    const MARKING_TARGETS = [
      {'q': this.SELECTORS.illust.thumbnail_container, 'n': 1 , 'm': 'border', 'h': this.SELECTORS.illust.thumbnail_image},   // 新UI
      {'q': '._layout-thumbnail > img[data-type="illust"]', 'n': 2 , 'a': 'data-src'}  // 旧UI
    ];

    return {
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return (/\/(\d+)[^/?]*?\.jpg/.exec(href) || /\/artworks\/(\d+)/.exec(href) || /illust_id=(\d+)/.exec(href) || [])[1];
      },
      'getLastUpdate': (e) => {
        let g = e.querySelector('img');
        let s = g && g.src || e.getAttribute('style');
        return s && this.getLastUpdate(s);
      },
      'method': undefined
    };

  }

  /**
   * いいね！する
   */
  setNice () {
    /*
    let nice = this.elements.info.illust.nice;
    if (!nice) {
      return;
    }
    if (nice.classList.contains('rated') || nice.disabled) {
      logger.info('already rated');
      return;
    }

    nice.click();
    */
  }

  /**
   *
   * @param data
   */
  onHistoryChanged (data) {

    logger.debug('on history changed.');

    // FIXME イベントリスナのリセットを実装するまでミドルクリック・自動伸長対応等は無効

    /*
     this.addedListeners.forEach((l) => {
     try {
     l.target.removeEventListener(l.type, l.callback);
     console.log('remove event listener:', l);
     }
     catch (e) {
     console.error(e);
     }
     });
     this.addedListeners = [];
     */

    this.resetMarkAndDisplay();
    this.resetElements();
    this.resetCondition();

    // FIXME history操作からサムネイルの入れ替えまでタイムラグがあるのだが、入れ替え完了を検出するのが難しいので苦肉の策として1秒待つ
    // FIXME 1秒待ってる間に別の入れ替えが発生する事あるのでは？
    AnkUtils.sleep(1000).then(() => {
      if ( ! this.inIllustPage()) {
        this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
      }
      else {
        this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      }
    });
  }

  /**
   * 機能のインストール（イラストページ用）
   */
  installIllustPageFunction (RETRY_VALUE) {
    // 中画像クリック関連
    let middleClickEventFunc = () => {
      // imgOvrの方になった場合は、medImgより広い領域がクリック可能となるが、ページ側の jQuery.on('click')を無効化できないため止む無し
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

        //imgOvr.addEventListener('click', mcHandler, true);
        //this.pushEventListener(imgOvr, 'click', mcHandler, true);
      };

      //

      // オーバーレイ
      let imgOvr = this.elements.illust.imgOvr;
      if (!imgOvr) {
        return;
      }

      let result = (() => {
        // うごイラ
        if (this.elements.illust.ugo.img) {
          return true;
        }

        // マンガ
        if (this.elements.illust.mng.img) {
          let largeLink = this.elements.illust.mng.largeLink;
          if (largeLink) {
            addMiddleClickEventListener(imgOvr);
            return true;
          }
        }

        // イラスト
        if (this.elements.illust.med.img) {
          let bigImg = this.elements.illust.med.bigImg;
          if (bigImg) {
            addMiddleClickEventListener(imgOvr);
            return true;
          }
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

      let illustId = this.getIllustId();
      if (illustId) {
        const SELF_THUMBNAILS_QUERY = this.SELECTORS.illust.self_thumbnails.replace('#ILLUST_ID#', illustId);

        // 前後サムネとall_listサムネの２か所に自分がいる
        let e = document.querySelectorAll(SELF_THUMBNAILS_QUERY);
        if (e.length < 1) {
          // ドキュメントが構築されていない
          return false;
        }
        if (e.length < 2) {
          // all listが構築されていない
          this.markDownloaded().then();
          return false;
        }

        this.markDownloaded({'node': document, 'force': true}).then(() => {
          let alist = AnkUtils.trackbackParentNode(e[0], 20, {'tag': 'nav'});
          if (alist) {
            thumbnailListExpansion(alist.firstChild);
          }
        });

        return true;
      }
      else {
        let e = document.querySelector(this.SELECTORS.illust.thumbnails);
        if ( ! e) {
          // ドキュメントが構築されていない
          return false;
        }

        this.markDownloaded().then();

        return true;
      }
    };

    // 作品リストが自動伸長したらダウンロード済みマークを追加する
    let thumbnailListExpansion = (alist) => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true})));
        }).observe(elm, {'childList': true});

        return true;
      };

      if (alist) {
        if (this._installed_function.thumbnailListExpansion === alist) {
          logger.debug('already installed: thumbnailListExpansion');
          return true;
        }

        this._installed_function.thumbnailListExpansion = alist;

        return observe(alist);
      }
    };

    // ページが自動伸長したらダウンロード済みマークを追加する
    let recommendExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => {
            if (n.tagName.toLowerCase() == 'li') {
              this.markDownloaded({'node': n, 'force':true}).then();
            }
          }));
        }).observe(elm, {'childList': true, 'subtree': true});

        return true;
      };

      // FIXME 表示されるまで領域が構築されないので間隔を広げて長時間待ち合わせている
      let alist = document.querySelector(this.SELECTORS.illust.recommendZone);
      if (alist) {
        if (this._installed_function.recommendExpansion === alist) {
          logger.debug('already installed: recommendExpansion');
          return true;
        }

        this._installed_function.recommendExpansion = alist;

        this.markDownloaded({'node': alist, 'force': true}).then();

        return observe(alist);
      }

    };

    // 評価したら自動ダウンロード
    let niceEventFunc = () => {
      if (!this.prefs.site.downloadWhenNice) {
        return true;
      }

      let nice = this.elements.info.illust.nice;
      if (!nice) {
        return;
      }

      let rated = nice.classList.contains('rated') || nice.disabled;
      if (rated) {
        return true;
      }

      nice.addEventListener('click', () => {
        let rated = nice.classList.contains('rated') || nice.disabled;
        if (rated) {
          return;
        }

        this.downloadCurrentImage({'autoDownload': true});
      }, false);

      return true;
    };

    //

    Promise.all([
      //AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': this.LONG_RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': recommendExpansion, 'retry': this.LONG_RETRY_VALUE, 'label': 'recommendExpansion'})
      //AnkUtils.delayFunctionInstaller({'func': niceEventFunc, 'retry': RETRY_VALUE, 'label': 'niceEventFunc'})
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

    // ページが自動伸長したらダウンロード済みマークを追加する
    let followExpansion = () => {
      let observe = (e) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true}).then()));
        }).observe(e, {'childList': true});

        return true;
      };

      let alist = document.querySelector(this.SELECTORS.list.recommendList) ||
        document.querySelector(this.SELECTORS.list.feedList) ||
        document.querySelector(this.SELECTORS.list.rankingList);
      if (alist) {
        return observe(alist);
      }

      let discovery = document.querySelector(this.SELECTORS.list.discovery);
      if (discovery) {
        return observe(discovery);
      }
    };

    // AutoPagerize/AutoPatchWork が継ぎ足し動作したらダウンロード済みマークを追加する
    let autoPagerize = () => {
      document.addEventListener('AutoPagerize_DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}).then(), false);
      document.addEventListener('AutoPatchWork.DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}).then(), false);
      return true;
    };

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': followExpansion, 'retry': RETRY_VALUE, 'label': 'followExpansion'}),
      AnkUtils.delayFunctionInstaller({'func': autoPagerize, 'retry': RETRY_VALUE, 'label': 'autoPagerize'})
    ])
      .catch((e) => logger.warn(e));
  }

  /**
   * 機能のインストールのまとめ
   */
  installFunctions () {

    // window.history.pushState に割り込む
    AnkUtils.overridePushState();

    if (this.inIllustPage()) {
      this.installIllustPageFunction(this.FUNC_INST_RETRY_VALUE);
      return;
    }

    this.installListPageFunction(this.FUNC_INST_RETRY_VALUE);
  }

}

// 開始

new AnkPixiv().start()
  .catch((e) => {
    console.error(e);
  });
