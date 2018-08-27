"use strict";

class AnkPixiv extends AnkSite {
  /**
   * コンストラクタ
   */
  constructor() {
    super();

    this.SITE_ID = 'PXV';

    this.USE_AJAX_PAGES_DATA = false;

    this._illustDataCache = {
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
      "illust": {
        "imgOvr": {"s": ".works_display, figure > div[role=\"presentation\"]"},
        "med": {
          "img": {"s": ".works_display > ._layout-thumbnail > img, figure > div[role=\"presentation\"] a[href^=\"https://i.pximg.net/\"] > img"},
          "bigImg": {"s": ".original-image, figure > div[role=\"presentation\"] a[href^=\"https://i.pximg.net/\"]"}
        },
        "mng": {
          "img": {"s": ".works_display > ._work > ._layout-thumbnail > img, figure > div[role=\"presentation\"] a[href^=\"/member_illust.php?mode=manga\"] > img"},
          "largeLink": {"s": ".works_display > a, figure > div[role=\"presentation\"] a[href^=\"/member_illust.php?mode=manga\"]"}
        },
        "ugo": {
          "img": {"s": ".works_display > ._ugoku-illust-player-container canvas"}
        }
      },
      "mngIdx": {
        "errorMessage": {"s": [".errorArea" ,".errortxt"]},

        "scripts": {"ALL": "script"},
        "images": {"ALL": ".manga > .item-container > img"},
        "largeLinks": {"ALL": ".manga > .item-container > a"}
      },
      "info": {
        "illust": {
          "datetime": {"s": ".work-info .meta > li, figcaption footer+ul+div"},
          "size": {"s": ".work-info .meta > li+li"},
          "tools": {"s": ".work-info .tools"},
          "title": {"s": ".work-info .title"},
          "R18": {"s": ".work-info .r-18, .work-info .r-18g"},
          "caption": {"s": ".work-info .caption"},
          "nice": {"s": ".work-info .js-nice-button, figure > div[role=\"presentation\"]+div section > div:nth-child(4) > button"},
          "update": {"s": ".bookmark_modal_thumbnail"},

          "tags": {"ALL": ".work-tags .tags > .tag > .text"}
        },
        "member": {
          "memberLink": {
            "s": ".profile .user-name"
          },
          "feedLink": {
            "s": ".column-header .tabs a[href^=\"/stacc/\"]"
          }
        }
      },
      "misc": {
        "content": {"s": "article figure"},
        "openCaption": {"s": ".ui-expander-container > .ui-expander-target > .expand, figcaption h1+div p+div > button"},
        "downloadedDisplayParent": {"s": ".score, article+aside section > *:last-child"},
        "recommendList": {"s": "#illust-recommend ._image-items"},
        "feedList": {"s": ["#stacc_timeline", "#stacc_center_timeline"]},
        "rankingList": {"s": ".ranking-items"},
        "discovery": {"s": "#js-mount-point-discovery"},
        "allContents": {"s": "nav div[role=\"rowgroup\"]"},
        "recommendContents": {"s": "header+div > div > aside:last-child"},
        "downloadedFilenameArea": {"s": ".ank-pixiv-downloaded-filename-text"},
        "nextLink": {"s": ".before > a, aside nav > a[href^=\"/member_illust.php?\"]:nth-child(1)"},
        "prevLink": {"s": ".after > a, aside nav > a[href^=\"/member_illust.php?\"]:nth-child(3)"}
      }
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
    return !!this.getIllustId(doc.location.href);
  }

  /**
   *
   * @param elm
   * @param mode
   * @returns {Promise.<*>}
   */
  async getAnyContext (elm, mode) {
    /**
     *
     * @param url
     * @returns {Promise.<*>}
     */
    let getPostData = async (url) => {
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
     *
     * @param elm
     * @returns {Promise.<void>}
     */
    let getIllustData = async (elm) => {
      let illustId = this.getIllustId(elm.doc.location.href);
      let url = 'https://www.pixiv.net/ajax/illust/'+illustId;

      return getPostData(url);
    };

    /**
     *
     * @param elm
     * @returns {Promise.<void>}
     */
    let getPagesData = async (illustId) => {
      let url = 'https://www.pixiv.net/ajax/illust/'+illustId+'/pages';

      return getPostData(url);
    };

    /**
     *
     * @param elm
     * @returns {Promise.<void>}
     */
    let getUgoiraMeta = async (illustId) => {
      let url = 'https://www.pixiv.net/ajax/illust/'+illustId+'/ugoira_meta';

      return getPostData(url);
    };

    /**
     * ダウンロード情報（画像パス）の取得
     * @param post_data
     * @returns {Promise.<{original: Array}>}
     */
    let getPathContext = async (illust_data) => {
      try {
        let loc = elm.doc.location.href;

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

        let original = genPages(orig_base, illust_data.pageCount);
        let thumbnail = genPages(thumb_base, illust_data.pageCount);

        if (this.USE_AJAX_PAGES_DATA) {
          // 存在するが使われていないAPIなので利用は保留
          let pages_data = await getPagesData(illust_data.illustId);
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
     * @returns {Promise.<{thumbnail, original}>}
     */
    let getUgoiraContext = async (illust_data) => {
      try {
        let f = (s, u) => {
          return [{
            'src': s,
            'frames': u.map((o) => {return {'f':o.file, 'd':o.delay}}),
            'referrer': elm.doc.location.href
          }];
        };

        let ugoira_meta = await getUgoiraMeta(illust_data.illustId);
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
          'url': elm.doc.location.href,
          'id': this.getIllustId(elm.doc.location.href),
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

    let illustId = this.getIllustId(elm.doc.location.href);

    let illust_data = this._illustDataCache.id === illustId && this._illustDataCache.data;
    if (!illust_data) {
      illust_data = await getIllustData(elm);
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

    // 旧サイト向け
    if (!context.path && (mode & this.GET_CONTEXT.PATH)) {
      context.path = await this._getPathContextOld(elm);
    }
    if (!context.illust) {
      context.illust = this._getIllustContextOld(elm);
    }
    if (!context.member) {
      context.member = this._getMemberContextOld(elm);
    }

    return context;
  }

  /**
   * ダウンロード情報（画像パス）の取得
   * @param elm
   * @returns {Promise}
   * @private
   */
  async _getPathContextOld (elm) {
    let getMedPath = async () => {
      return {
        'thumbnail': [{'src': elm.illust.med.img.src, 'referrer': elm.doc.location.href}],
        'original': [{'src': elm.illust.med.bigImg.getAttribute('data-src') || elm.illust.med.bigImg.getAttribute('href'), 'referrer': elm.doc.location.href}]
      };
    };

    let getMngPath = async () => {
      // 単ページ漫画
      let single_page_manga_path = (indexDoc, referrer) => {
        if (!/(?:\?|&)mode=big(?:&|$)/.test(indexDoc.URL)) {
          return;
        }

        let img = indexDoc.querySelector('img');
        if (!img) {
          return;
        }

        return {
          original: [{'src': img.src, 'referrer': referrer}]
        };
      };

      // ブック
      let book_path = (indexDoc, indexElm, referrer) => {
        if (!indexDoc.documentElement.classList.contains('_book-viewer')) {
          return;
        }

        const RE_THUMB = /pixiv\.context\.images\[\d+]\s*=\s*"(.+?)"/;
        const RE_ORIG = /pixiv\.context\.originalImages\[\d+]\s*=\s*"(.+?)"/;

        let thumbnail = [];
        let original = [];

        Array.prototype.forEach.call(indexElm.mngIdx.scripts, function (e) {
          let mThumb = RE_THUMB.exec(e.text);
          if (mThumb) {
            thumbnail.push({'src': mThumb[1].replace(/\\(.)/g, '$1'), 'referrer': referrer});
          }
          let mOrig = RE_ORIG.exec(e.text);
          if (mOrig) {
            original.push({'src': mOrig[1].replace(/\\(.)/g, '$1'), 'referrer': referrer});
          }
        });

        // 見開き方向の判定
        let left2right = !!indexDoc.documentElement.classList.contains('ltr');

        // 見開きを考慮したページ数のカウントと画像の並べ替え
        let swapLR = (a, i) => {
          let tmp = a[i-1];
          a[i-1] = a[i];
          a[i] = tmp;
        };

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

        return {
          'original': original,
          'thumbnail': thumbnail
        };
      };

      // マンガ
      let manga_path = async (indexDoc, indexElm, referrer) => {
        if (indexDoc.documentElement.classList.contains('_book-viewer')) {
          return;
        }

        const MAX_PAGE = 1000;

        let thumbnail = [];
        let original = [];

        Array.prototype.some.call(indexElm.mngIdx.images, (v, i) => {
          if (i > MAX_PAGE) {
            return true;
          }

          thumbnail.push({'src': v.getAttribute('data-src'), 'referrer': referrer});
        });

        // オリジナル画像
        const RE_BIG = /(_p\d+)\./;
        const REPLACE_BIG = '_big$1.';
        const RE_MASTER = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
        const REPLACE_MASTER = '$1/img-original/$2$3';

        // 個々の画像用に存在するページのURLをreferer用に生成
        let refs = (() => {
          let url = this.elements.doc.getElementsByTagName('a')[0];
          let base = url.protocol+'//'+url.host;
          return Array.prototype.map.call(indexElm.mngIdx.largeLinks, (a) => base + a.getAttribute('href'));
        })();

        for (let i = 0; i < refs.length && i < thumbnail.length; i++) {
          logger.info('ORIGINAL IMAGE PAGE: '+refs[i]+', '+indexURL);
          let respBig = await remote.get({
            url: refs[i],
            //headers: [{name:'Referer', value:indexPage}],
            responseType: 'document',
            timeout: this.prefs.xhrTimeout
          });

          let docBig = respBig.document;
          let elmBig = this.getElements(docBig);

          // サーバエラーのトラップ
          if (!docBig || elmBig.mngIdx.errorMessage) {
            //return Promise.reject(new Error(chrome.i18n.getMessage('msg_serverError')));
            return;
          }

          let src = docBig.querySelector('img').src;

          if (this.prefs.forceCheckMangaImagesAll) {
            original.push({'src': src, 'referrer': refs[i]});
            continue;
          }

          let thumb_src = thumbnail[0].src;

          // 最初の一枚以外は拡張子チェックを行わないモード
          if (thumb_src == src) {
            logger.info('MANGA IMAGE: plane mode');
            original = thumbnail;
          }
          else if (thumb_src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, '') == src.replace(/\.\w+$/, '')) {
            let replaceExt = /(\.\w+)$/.exec(src)[1];
            logger.info('MANGA IMAGE: master mode ... ', thumb_src, '->', thumb_src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
            original = thumbnail.map((v, j) => {
              return {'src': v.src.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt), 'referrer': refs[j]};
            });
          }
          else if (thumb_src.replace(RE_BIG, REPLACE_BIG) == src) {
            logger.info('MANGA IMAGE: big mode ... ', thumb_src, '->', thumb_src.replace(RE_BIG, REPLACE_BIG));
            original = thumbnail.map((v, j) => {
              return {'src': v.src.replace(RE_BIG, REPLACE_BIG), 'referrer': refs[j]};
            });
          }
          else {
            logger.warn('MANGA IMAGE: UNKNOWN MODE ... ', thumb_src, '->', src);
          }

          break;
        }

        return {
          'original': original,
          'thumbnail': thumbnail
        };
      };

      // マンガインデックスページを参照して画像URLリストを取得する
      let indexURL = elm.illust.mng.largeLink.href;
      let referrer = elm.doc.location.href;
      logger.info('MANGA INDEX PAGE:', indexURL, referrer);

      let respIndex = await remote.get({
        'url': indexURL,
        'responseType': 'document',
        'timeout': this.prefs.xhrTimeout
      });

      let docIndex = respIndex.document;
      let elmIndex = this.getElements(docIndex);

      // サーバエラーのトラップ
      if (!docIndex || elmIndex.mngIdx.errorMessage) {
        return Promise.reject(new Error(chrome.i18n.getMessage('msg_serverError')));
      }

      // マンガ形式だけど単ページイラストの場合
      let single_path = single_page_manga_path(docIndex, referrer);
      if (single_path) {
        return single_path;
      }

      // ブック形式 or マンガ形式
      let multi_path = book_path(docIndex, elmIndex, referrer) || await manga_path(docIndex, elmIndex, referrer);
      if (!multi_path || multi_path.thumbnail.length == 0) {
        return Promise.reject(new Error(chrome.i18n.getMessage('msg_cannotFindImages')));
      }

      if (multi_path.thumbnail[0].hasOwnProperty('facing')) {
        // 見開きがある場合
        logger.info("Facing Page Check:", "(thumb)",  multi_path.thumbnail.length, "(orig)", multi_path.original.length, "pics in",  multi_path.thumbnail[multi_path.thumbnail.length - 1].facingNo,  "pages");
      }
      else {
        // 見開きがない場合
        logger.info("Page Check:", "(thumb)",  multi_path.thumbnail.length, "(orig)", multi_path.original.length, "pics");
      }

      return multi_path;
    };

    let getUgoPath = async () => {
      let script = `
        ((c) => {
          let f = (u) => {
            if (u && u.src && u.frames) {
              return [{
                'src': u.src,
                'frames': u.frames.map((o) => {return {'f':o.file, 'd':o.delay}}),
                'referrer': document.location.href
              }];
            }
          };

          return {
            'thumbnail': f(c.ugokuIllustData),
            'original': f(c.ugokuIllustFullscreenData)
          }
        })(pixiv.context)`;

      let id = 'ank-pixiv-script-ugoinfo';
      let name = 'AnkPixiv.UgoInfo';

      return AnkUtils.executeSiteScript(id, name, script);
    };

    if (elm.illust.med.img) {
      return getMedPath();
    }
    if (elm.illust.mng.img) {
      return getMngPath();
    }
    if (elm.illust.ugo.img) {
      return getUgoPath();
    }
  }

  /**
   * ダウンロード情報（イラスト情報）の取得
   * @param elm
   * @returns {{url: string, id: *, title: (SELECTOR_ITEMS.info.illust.title|{s}|*|string|*|string|XML|void|string), posted: (boolean|*|Number), postedYMD: (boolean|string|*), size: {width, height}, tags: *, tools: (SELECTOR_ITEMS.info.illust.tools|{s}|string|*|string|XML|void|string), caption: (SELECTOR_ITEMS.info.illust.caption|{s}|*|string|*|string|XML|void|string), R18: boolean}}
   * @private
   */
  _getIllustContextOld (elm) {
    try {
      let posted = this.getPosted(() => AnkUtils.decodeTextToDateData(elm.info.illust.datetime.textContent));

      let tags = Array.prototype.map.call(elm.info.illust.tags, (e) => {
        let tag = AnkUtils.trim(e.textContent);
        let eTrans = e.querySelector('.illust-tag-translation');
        if (eTrans) {
          let trans = AnkUtils.trim(eTrans.textContent);
          if (trans.length > 0) {
            tag = AnkUtils.trim(tag.slice(0, -trans.length));
            if (this.prefs.saveTagsWithTranslation) {
              tag += '('+trans+')';
            }
          }
        }
        return tag;
      });

      let info = {
        'url': elm.doc.location.href,
        'id': this.getIllustId(elm.doc.location.href),
        'title': elm.info.illust.title && AnkUtils.trim(elm.info.illust.title.textContent) || '',
        'posted': !posted.fault && posted.timestamp,
        'postedYMD': !posted.fault && posted.ymd,
        'size': ((sz) => {
          let m = /(\d+)\xD7(\d+)/.exec(sz);
          if (m) {
            return {
              'width': m[1],
              'height': m[2]
            };
          }
          return sz || '';
        })(elm.info.illust.size && elm.info.illust.size.textContent),
        'tags': tags,
        'tools': elm.info.illust.tools && AnkUtils.trim(elm.info.illust.tools.textContent) || '',
        'caption': elm.info.illust.caption && AnkUtils.trim(AnkUtils.getTextContent(elm.info.illust.caption)) || '',
        'R18': !!elm.info.illust.R18
      };

      ((u) => {
        let t = u && this.getLastUpdate(u.getAttribute('data-src'));
        if (t) {
          let d = AnkUtils.getDateData(new Date(t), false);
          if (d.timestamp > posted.timestamp) {
            // 更新があった場合
            info.updated = d.timestamp;
            info.updatedYMD = d.ymd;
          }
        }
      })(elm.info.illust.update);

      return info;
    }
    catch (e) {
      logger.error(e);
    }
  }

  /**
   * ダウンロード情報（メンバー情報）の取得
   * @param elm
   * @returns {{id: *, pixiv_id: *, name: (string|*|string|XML|void), memoized_name: null}}
   * @private
   */
  _getMemberContextOld (elm) {
    try {
      return {
        'id': /\/member\.php\?id=(.+?)(?:&|$)/.exec(elm.info.member.memberLink.href)[1],
        'pixiv_id': /\/stacc\/([^?\/]+)/.exec(elm.info.member.feedLink.href)[1],
        'name': AnkUtils.trim(elm.info.member.memberLink.textContent),
        'memoized_name': null
      };
    }
    catch (e) {
      logger.error(e);
    }
  }

  /**
   * イラストIDの取得
   * @param loc
   * @returns {*}
   */
  getIllustId (loc) {
    if (/\/member_illust\.php\?/.test(loc) && /(?:&|\?)mode=medium(?:&|$)/.test(loc)) {
      return (/(?:&|\?)illust_id=(\d+)(?:&|$)/.exec(loc) || [])[1];
    }
  }

  /**
   * 最終更新日時の取得
   * @param loc
   * @returns {Array|{index: number, input: string}|number}
   */
  getLastUpdate (loc) {
    let m = /\/(20\d\d\/\d\d\/\d\d)\/(\d\d\/\d\d)\/\d\d\//.exec(loc);
    return m && new Date(m[1]+' '+m[2].replace(/\//g, ':')).getTime();
  }

  /**
   * サムネイルにダウンロード済みマークを付けるルールを返す
   * @returns {{queries: [*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*,*], getId: (function(*=)), getLastUpdate: (function(*)), method: undefined}}
   */
  getMarkingRules () {

    const MARKING_TARGETS = [
      {'q': '.image-item > .work', 'n': 1},               // 作品一覧、ブックマーク
      {'q': '.rank-detail a._work', 'n': 2},              // ホーム（ランキング）
      {'q': '.ranking-item a._work', 'n': 2},             // ランキング
      {'q': '.worksListOthersImg > ul > li > a', 'n': 1}, // プロファイル（ブックマーク、イメージレスポンス）
      {'q': '.worksImageresponseImg > a', 'n': 2},        // イラストページ（イメージレスポンス）
      {'q': 'li > a.response-in-work', 'n': 1},           // イラストページ（イメージレスポンス）
      {'q': '.search_a2_result > ul > li > a', 'n': 1},   // イメージレスポンス
      {'q': '.stacc_ref_illust_img > a', 'n': 3},         // フィード（お気に入りに追加したイラスト）
      {'q': '.stacc_ref_user_illust_img > a', 'n': 1},    // フィード（お気に入りに追加したユーザ内のイラスト）
      {'q': '.hotimage > a.work', 'n': 1},                // タグページ（週間ベスト）
      {'q': '.image-item > a:nth-child(1)', 'n': 1},      // タグページ（全期間＆新着）
      {'q': 'figure > div > a', 'n': 2},                  // ディスカバリー、タグページ
      {'q': '.sibling-items > .after > a', 'n': 1},       // 前の作品
      {'q': '.sibling-items > .before > a', 'n': 1},      // 次の作品
      // 以下新UI対応
      {'q': 'aside li a[href^="/member_illust.php?mode=medium"]:first-child', 'n': -1, 'r': 'div[style*="background-image:"]', 'm': 'border'},       // 関連作品
      {'q': 'nav div[role="rowgroup"] > div >  a[href^="/member_illust.php?mode=medium"]', 'n': -1, 'r': 'div[role="presentation"]', 'm': 'border'}, // すべて見る
      {'q': 'nav > a[href^="/member_illust.php?"]', 'n': -1, 'r': 'div[role="presentation"]', 'm': 'border'}                                         // 前後の作品
    ];

    return {
      'queries': MARKING_TARGETS,
      'getId': (href) => {
        return this.getIllustId(href);
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
    let nice = this.elements.info.illust.nice;
    if (!nice) {
      return;
    }
    if (nice.classList.contains('rated') || nice.disabled) {
      logger.info('already rated');
      return;
    }

    nice.click();
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

        imgOvr.addEventListener('click', mcHandler, true);
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
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      this.displayDownloaded().then();
      return true;
    };

    // イメレスのサムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (this.elements.doc.readyState !== "complete") {
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

      let caption = this.elements.misc.openCaption;
      if (!caption) {
        return;
      }

      setTimeout(() => {
        if (getComputedStyle(caption).getPropertyValue('display').indexOf('block') != -1) {
          caption.click();
        }
      }, this.prefs.openCaptionDelay);

      return true;
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

    // ajaxによるコンテンツの入れ替えを検出する
    let detectContentChange = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;   // リトライしてほしい
      }

      let content = this.elements.misc.content;
      if (!content) {
        return false;   // リトライしてほしい
      }

      // miniBrowseの中身が書き換わるのを検出する
      let moBrowse = new MutationObserver(() => {
        logger.debug('content changed.');
        this.resetElements();
        this.resetCondition();
        this.forceDisplayAndMarkDownloaded();
      });

      moBrowse.observe(content, {'childList': true});

      return true;
    };

    // 作品リストが自動伸長したらダウンロード済みマークを追加する
    let thumbnailListExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true})));
        }).observe(elm, {'childList': true});

        return true;
      };

      let alist = this.elements.misc.allContents;
      if (alist) {
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

      let alist = this.elements.misc.recommendContents;
      if (alist) {
        return observe(alist);
      }

    };

    //

    Promise.all([
      AnkUtils.delayFunctionInstaller({'func': middleClickEventFunc, 'retry': RETRY_VALUE, 'label': 'middleClickEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': delayDisplaying, 'retry': RETRY_VALUE, 'label': 'delayDisplaying'}),
      AnkUtils.delayFunctionInstaller({'func': delayMarking, 'retry': RETRY_VALUE, 'label': 'delayMarking'}),
      AnkUtils.delayFunctionInstaller({'func': openCaption, 'retry': RETRY_VALUE, 'label': 'openCaption'}),
      AnkUtils.delayFunctionInstaller({'func': niceEventFunc, 'retry': RETRY_VALUE, 'label': 'niceEventFunc'}),
      AnkUtils.delayFunctionInstaller({'func': detectContentChange, 'retry': RETRY_VALUE, 'label': 'detectContentChange'}),
      AnkUtils.delayFunctionInstaller({'func': thumbnailListExpansion, 'retry': RETRY_VALUE, 'label': 'thumbnailListExpansion'}),
      AnkUtils.delayFunctionInstaller({'func': recommendExpansion, 'retry': RETRY_VALUE, 'label': 'recommendExpansion'})
    ])
      .catch((e) => logger.warn(e));
  }

  /**
   * 機能のインストール（リストページ用）
   */
  installListPageFunction (RETRY_VALUE) {

    // サムネイルにダウンロード済みマークを表示する
    let delayMarking = () => {
      if (this.elements.doc.readyState !== "complete") {
        return false;
      }

      this.markDownloaded().then();
      return true;
    };

    // ページが自動伸長したらダウンロード済みマークを追加する
    let followExpansion = () => {
      let observe = (elm) => {
        new MutationObserver((o) => {
          o.forEach((e) => Array.prototype.forEach.call(e.addedNodes, (n) => this.markDownloaded({'node': n, 'force':true}).then()));
        }).observe(elm, {'childList': true});

        return true;
      };

      let alist = this.elements.misc.recommendList || this.elements.misc.feedList || this.elements.misc.rankingList;
      if (alist) {
        return observe(alist);
      }

      let discovery = this.elements.misc.discovery;
      if (discovery) {
        let container = discovery.querySelector('.column-title+div');
        if (container) {
          return observe(container);
        }
      }
    };

    // AutoPagerize/AutoPatchWork が継ぎ足し動作したらダウンロード済みマークを追加する
    let autoPagerize = () => {
      this.elements.doc.addEventListener('AutoPagerize_DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}).then(), false);
      this.elements.doc.addEventListener('AutoPatchWork.DOMNodeInserted', (e) => this.markDownloaded({'node': e.target, 'force':true}).then(), false);
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
