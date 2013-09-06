
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://www.pixiv.net/',
    DOMAIN:     'www.pixiv.net',
    SERVICE_ID: 'PXV',
    SITE_NAME:  'Pixiv',

    ID_FANTASY_DISPLAY: 'ankpixiv-fantasy-display',

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () { // {{{
        try {
          return self.elements.doc.location.hostname === 'www.pixiv.net';
        } catch (e) {
          return false;
        }
      }, // }}}

      get manga () { // {{{
        let node = self.elements.illust.largeLink;
        return node && node.href.match(/(?:&|\?)mode=manga(?:&|$)/);
      }, // }}}

      get medium () { // {{{
        let loc = AnkBase.currentLocation;
        return (
          self.in.site &&
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/), // }}}

      get myPage () // {{{
        (AnkBase.currentLocation == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !self.elements.illust.avatar, // }}}

      /*
       * 以下はモジュールローカル部品
       */

      //
      get pixiv () // {{{
        self.in.site, // }}}

      // elementsを使っているが確定後にしか使わないのでOK
      get feed () // {{{
        self.elements.illust.feedList, // }}}

      get illustList () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/member_illust.php\?id=/), // }}}

      get bookmarkNew () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/bookmark_new_illust\.php/), // }}}

      get bookmarkAdd () // {{{
        AnkBase.currentLocation.match(/\.pixiv\.net\/bookmark_add\.php\?/), // }}}
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      function queryAll (q)
        self.elements.doc.querySelectorAll(q);

      let illust =  {
        get mediumImage () {
          return (
            query('.works_display > a > img')
            ||
            query('.works_display > * > a > img')
          );
        },

        get largeLink () {
          return (
            query('.works_display > a')
            ||
            query('.works_display > * > a')
          );
        },

        get worksData ()
          query('.work-info'),

        get title ()
          query('.work-info > .title'),

        get comment ()
          query('.work-info > .caption'),

        get avatar ()
          query('.profile-unit > a > img.user-image'),

        get userName ()
          query('.profile-unit > a > .user'),

        get memberLink ()
          query('a.avatar_m'),

        get tags ()
          query('.tags'),

        get recommendList()
          AnkUtils.A(queryAll('.image-items')).pop(),

        get feedList()
          query('#stacc_timeline'),

        get downloadedDisplayParent ()
          query('.work-info'),

        get ads () {
          let obj = AnkUtils.A(queryAll('object'));
          let iframe = AnkUtils.A(queryAll('iframe'));
          let search = AnkUtils.A(queryAll('.ui-search'));
          // 検索欄も広告扱いしちゃうぞ
          let findbox = AnkUtils.A(queryAll('form.search2'));
          // ldrize
          let ldrize = AnkUtils.A(queryAll('#gm_ldrize'));
          // ヘッダ
          let header1 = AnkUtils.A(queryAll('#global-header'));
          let header2 = AnkUtils.A(queryAll('.header'));

          let toolbarItems = AnkUtils.A(queryAll('#toolbar-items'));

          return ([]).concat(obj, iframe, search, findbox, ldrize, header1, header2, toolbarItems);
        }
      };

      let mypage = {
        get fantasyDisplay ()
          query('#' + self.ID_FANTASY_DISPLAY),

        get fantasyDisplayNext ()
          query('#contents > div > div.area_pixivmobile'),
      };

      return {
        illust: illust,
        mypage: mypage,
        get doc () window.content.document
      };
    })(), // }}}

    info: (function () { // {{{
      let illust = {
        get id ()
          parseInt(self.elements.doc.querySelector('#rpc_i_id').textContent, 10),

        get dateTime ()
          self.info.illust.worksData.dateTime,

        get size ()
          self.info.illust.worksData.size,

        get tags () {
          let elem = self.elements.illust.tags;
          if (!elem)
            return [];
          return AnkUtils.A(elem.querySelectorAll('.tag > .text'))
                  .map(function (e) AnkUtils.trim(e.textContent))
                  .filter(function (s) s && s.length);
        },

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(function (it) (it.length <= limit));
        },

        get tools ()
          self.info.illust.worksData.tools,

        get width ()
          let (sz = illust.size) (sz && sz.width),

        get height ()
          let (sz = illust.size) (sz && sz.height),

        get server ()
          self.info.path.largeStandardImage.match(/^http:\/\/([^\/\.]+)\./i)[1],

        get referer () {
          let mode =
            !self.in.manga                                    ? 'big' :
            !AnkBase.Prefs.get('downloadOriginalSize', false) ? 'manga' :
                                                                'manga_big&page=0'; // @see downloadFiles#downloadNext()

          return AnkBase.currentLocation.replace(/mode=medium/, 'mode='+mode);
        },

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          let (e = self.elements.illust.comment)
            (e ? AnkUtils.textContent(e) : ''),

        get R18 ()
          self.info.illust.tags.some(function (v) 'R-18' == v),

        get mangaPages ()
          self.info.illust.worksData.mangaPages,

        get worksData () {
          let zp = AnkUtils.zeroPad;
          let items = AnkUtils.A(self.elements.illust.worksData.querySelectorAll('.meta > li'));
          let result = {};
          items.forEach(function (item) {
            item = item.textContent.replace(/\[ \u30DE\u30A4\u30D4\u30AF\u9650\u5B9A \]/, '').trim();
            let m;
            if (m = item.match(/(\d+)\/(\d+)\/(\d{4})[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[3], 4),
                month: zp(m[1], 2),
                day: zp(m[2], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
              };
            } else if (m = item.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)) {
              result.dateTime = {
                year: zp(m[1], 4),
                month: zp(m[2], 2),
                day: zp(m[3], 2),
                hour: zp(m[4], 2),
                minute: zp(m[5], 2),
              };
            } else if (m = item.match(/\u6F2B\u753B\s*(\d+)P/)) {
              result.mangaPages = parseInt(m[1], 10);
            } else if (m = item.match(/(\d+)\xD7(\d+)/)) {
              result.size = {
                width: parseInt(m[1], 10),
                height: parseInt(m[2], 10),
              };
            } else {
              result.tools = item;
            }
          });
          return result;
        }
      };

      let member = {
        get id ()
          AnkUtils.A(self.elements.doc.querySelectorAll('script'))
            .map(function(it) it.textContent.match(/pixiv.context.userId = '(\d+)';/))
            .filter(function(it) it)[0][1],

        get pixivId ()
          (self.elements.illust.avatar.src.match(/\/profile\/([^\/]+)\//)
           ||
           self.info.path.largeStandardImage.match(/^https?:\/\/[^\.]+\.pixiv\.net\/(?:img\d+\/)?img\/([^\/]+)\//))[1],

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          (self.info.path.largeStandardImage.match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          AnkBase.currentLocation.replace(/(\?|&)mode=medium(&|$)/, "$1mode=manga$2"),

        // XXX 再投稿された、イラストのパスの末尾には、"?28737478..." のように数値がつく模様
        // 数値を除去してしまうと、再投稿前の画像が保存されてしまう。
        get largeStandardImage ()
          self.elements.illust.mediumImage.src.replace(/_m\./, '.'),

        get image ()
          self.getImageInfo(true),
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}

    get downloadable ()
      true,

    getImageInfo: function (b) {
      if (!self.in.manga)
        return { images: [self.info.path.largeStandardImage], facing: null, };

      return self.getMangaPages(b);
    },

    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{
      function delay (msg, e) { // {{{
        if (installTryed == 20) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkBase.Prefs.get('showErrorDialog'));
        }
        if (installTryed > 100)
          return;
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      function noMoreEvent (func) { // {{{
        return function (e) {
          e.preventDefault();
          e.stopPropagation();
          return func.apply(this, arguments);
        };
      } // }}}

      // closure {{{
      let ut = AnkUtils;
      let installInterval = 500;
      let installTryed = 0;
      let con = content;
      let doc = self.elements.doc;
      let win = window.content.window;
      let images = undefined;
      let currentMangaPage = 0;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body')[0];
            var wrapper = doc.getElementById('wrapper');
            var medImg = self.elements.illust.mediumImage;
            var openComment = doc.querySelector('.comment-show-button');
            var worksData = self.elements.illust.worksData;
            var bgImage = doc.defaultView.getComputedStyle(doc.body, '').backgroundImage;
            var fitMode = AnkBase.Prefs.get('largeImageSize', AnkBase.FIT.NONE);
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれて以内っぽいときは、遅延する
          if (!(body && medImg && wrapper && openComment && worksData)) // {{{
            return delay("delay installation by null");
          // }}}

          // 中画像クリック時に保存する
          if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
            medImg.addEventListener(
              'click',
              function (e) {
                AnkBase.downloadCurrentImageAuto();
              },
              true
            );
          } // }}}

          // 大画像関係
          if (AnkBase.Prefs.get('largeOnMiddle', true)) {
            new AnkViewer(
              self,
              body,
              wrapper,
              openComment,
              function () self.getImageInfo(false).images
            );
          }

          // レイティングによるダウンロード
          (function () { // {{{
            if (!AnkBase.Prefs.get('downloadWhenRate', false))
              return;
            let point = AnkBase.Prefs.get('downloadRate', 10);
            AnkUtils.A(doc.querySelectorAll('.rating')).forEach(function (e) {
              e.addEventListener(
                'click',
                function () {
                  let klass = e.getAttribute('class', '');
                  let m = klass.match(/rate-(\d+)/);
                  if (m && (point <= parseInt(m[1], 10)))
                    AnkBase.downloadCurrentImageAuto();
                },
                true
              );
            });
          })(); // }}}

          // 保存済み表示
          AnkBase.insertDownloadedDisplayById(
            self.elements.illust.downloadedDisplayParent,
            self.info.illust.id,
            self.SERVICE_ID,
            self.info.illust.R18
          );

          // コメント欄を開く
          if (AnkBase.Prefs.get('openComment', false)) // {{{
            setTimeout(function () openComment.click(), 1000);
          // }}}

          AnkUtils.dump('installed: '+self.SITE_NAME);

        } catch (e) {
          AnkUtils.dumpError(e);
        }
      }; // }}}

      return installer();
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      // 伸びるおすすめリストに追随する
      function followExpansion () {
        let recommend = self.elements.illust.recommendList;
        let feed = self.elements.illust.feedList;

        let installTimer = setInterval(
          function () {
            if (!AnkBase.Prefs.get('markDownloaded', false))
              return;

            let elm = recommend || feed;
            if (!elm && counter > 0) {
              AnkUtils.dump('delay fe: '+self.SITE_NAME+', '+counter--);
              return;
            }
  
            clearInterval(installTimer);
            installTimer = null;

            if (!elm) {
              AnkUtils.dump('installation failed fe: '+self.SITE_NAME);
              return;
            }

            if (MutationObserver) {
              new MutationObserver(function (o) {
                o.forEach(function (e) self.markDownloaded(e.target, true));
              }).observe(elm, {childList: true});
            }
  
            AnkUtils.dump('installed fe: '+self.SITE_NAME);
          },
          interval
        );
      }

      // プレミアムユーザーでない絵師さんの作品一覧は遅延が発生するのでonFocusによる処理だけではマークがつかない
      function delayMarking () {
        let doc = self.elements.doc;

        let installTimer = setInterval(
            function () {
              if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
                if (counter > 0) {
                  AnkUtils.dump('delay dm: '+counter--);
                  return;
                }
              }

              clearInterval(installTimer);
              installTimer = null;

              if (typeof doc === 'undefined' || !doc ) {
                AnkUtils.dump('installation failed dm: '+self.SITE_NAME);
                return;
              }

              self.markDownloaded(doc,true);

              AnkUtils.dump('installed dm: '+self.SITE_NAME);
            },
            interval
          );
      }

      let counter = 20;
      let interval = 500;

      if (!(self.in.illustList || self.in.bookmarkNew || self.in.bookmarkAdd))
        followExpansion();

      delayMarking();
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const BoxTag = /^(li|div|article)$/i;

      function findBox (e, limit, cls) {
        if (limit <= 0)
          return null;
        if (BoxTag.test(e.tagName)) {
          if (!cls && self.in.feed)
            cls = 'stacc_ref_thumb_left';
          if (!cls || e.className.split(/ /).some(function (v) (v === cls)))
            return e;
        }
        return findBox(e.parentNode, limit - 1, cls);
      }

      let target = AnkBase.getMarkTarget(self, node, force, ignorePref);
      if (!target)
        return;

      [
        ['a > img', 1],
        ['a > p > img', 2],
        ['a > div > img', 2],
        ['a > p > div > img', 3]
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (img) AnkUtils.trackbackParentNode(img, nTrackback)) .
          map(function (link) link.href && let (m = IsIllust.exec(link.href)) m && [link, m]) .
          filter(function (m) m) .
          map(function ([link, m]) [link, parseInt(m[1], 10)]) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(findBox(link, 3), id, self.SERVICE_ID);
          });
      });
    }, // }}}

    /********************************************************************************
    * その他
    ********************************************************************************/

    /*
     * 評価する
     */
    rate: function (pt) { // {{{
      if (!(self.in.pixiv && self.in.medium))
        throw 'not in pixiv';
      if (pt < 1 || 10 < pt)
        throw 'out of range';
      let rating = window.content.window.wrappedJSObject.pixiv.rating;
      if (typeof rating.rate === 'number') {
        rating.rate = pt;
        rating.apply.call(rating, {});
        if (!AnkBase.Prefs.get('downloadWhenRate', false))
          return true;
        let point = AnkBase.Prefs.get('downloadRate', 10);
        if (point <= pt)
          AnkBase.downloadCurrentImage(undefined, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
      } else {
        return false;
      }

      return true;
    }, // }}}


    /********************************************************************************
    * Pixiv固有
    ********************************************************************************/

    replaceMangaImageUrl: function  (v) {
      return (v.match(/_big_p\d+\./) ? v : v.replace(/_p(\d+)\./, '_big_p$1.'));
    },

    /*
     * マンガのページ一覧を取得する。
     *
     *  return
     *    .images:     画像のurlリスト
     *    .facing:     見開きがある場合はurlに対応するページ番号のリスト、それ以外の場合はnull
     */
    getMangaPages: function (originalSizeCheck) { // {{{

      const MAX = 1000;

      const NULL_RET = { images: [], facing: null, };

      let doc = AnkUtils.createHTMLDocument(AnkUtils.httpGET(self.info.path.mangaIndexPage));
      if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
        window.alert(AnkBase.Locale('serverError'));
        return NULL_RET;
      }

      let im = [];
      let fp = [];
      AnkUtils.A(doc.querySelector('.manga').querySelectorAll('script')).
        some(function (v) {
          if (v.textContent.match(/pixiv\.context\.images\[\d+\]\s*=\s*'(.+?)'/)) {
            if (im.length > MAX)
              return true;
            im.push(RegExp.$1);
          } else if (v.textContent.match(/pixiv\.context\.pages\[(\d+)\]/)) {
            fp.push(1 + parseInt(RegExp.$1));
          }
        });

      if (im.length == 0) {
        window.alert(AnkBase.Locale('serverError'));
        return NULL_RET;
      }

      if (fp.length > 0 && fp[fp.length - 1] < fp.length) {
        // 見開きがある場合
        AnkUtils.dump("Facing Page Check: " + fp.length + " pics in " + fp[fp.length - 1] + " pages");
      }
      else {
        // 見開きがない場合
        fp = null;
      }

      if (originalSizeCheck && AnkBase.Prefs.get('downloadOriginalSize', false)) {
        let bigi = self.replaceMangaImageUrl(im[0]);
        if (bigi) {
          const cookieManager = Cc["@mozilla.org/cookiemanager;1"].getService(Ci.nsICookieManager2);
          cookieManager.add(
            '.pixiv.net',
            '/',
            'pixiv_embed',
            'pix',
            false,
            false,
            false,
            new Date().getTime() + (1000 * 60 * 60 * 24 * 365)
          );
  
          if (AnkUtils.remoteFileExists(bigi))
            im = im.map(function (v) self.replaceMangaImageUrl(v));
        }
      }

      return { images: im, facing: fp, };
    }, // }}}
  };

  /********************************************************************************
  * インストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkBase.addModule(self);

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
