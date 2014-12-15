
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://www.pixiv.net/';
    self.DOMAIN     = 'www.pixiv.net';
    self.SERVICE_ID = 'PXV';
    self.SITE_NAME  = 'Pixiv';

    self.ID_FANTASY_DISPLAY = 'ankpixiv-fantasy-display';

    var _images = null;
    var _imagesOriginal = null;

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.on = {
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/www\.pixiv\.net\//), // }}}
    },

    self.in = { // {{{
      get manga () // {{{
        let (v = self.info.path.mangaIndexPage)
          v && v.match(/(?:&|\?)mode=manga(?:&|$)/), // }}}

      get ugoira () // {{{
        let (e = self.elements.illust.mediumImage)
          e && e.tagName.toLowerCase() === 'canvas', // }}}

      get medium () { // {{{
        let loc = self.info.illust.pageUrl;
        return (
          self.on.site &&
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        self.in.medium, // }}}

      get myPage () // {{{
        (self.info.illust.pageUrl == 'http://www.pixiv.net/mypage.php'), // }}}

      get myIllust () // {{{
        !self.elements.illust.avatar, // }}}

      /*
       * 以下はモジュールローカル部品
       */

      //
      get pixiv () // {{{
        self.on.site, // }}}

      // elementsを使っているが確定後にしか使わないのでOK
      get feed () // {{{
        self.elements.illust.feedList, // }}}

      get illustList () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/member_illust.php\?id=/), // }}}

      get bookmarkNew () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_new_illust\.php/), // }}}

      get bookmarkAdd () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_add\.php\?/), // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get largeLink () {
          let (e = illust.ugoiraContainer) {
            if (e)
              return e.querySelector('a');
          };
          let (e = illust.mediumImage) {
            if (e)
              return e.parentNode.parentNode;
          };
        },

        get datetime ()
          query('.meta > li'),

        get size ()
          query('.meta > li+li'),

        get title ()
          query('.work-info .title'),

        get comment ()
          query('.work-info .caption'),

        get avatar ()
          query('.profile-unit > a > img.user-image'),

        get userName ()
          query('.profile-unit > a > .user'),

        get memberLink ()
          query('.profile-unit > a.user-link'),

        get userTags ()
          query('.user-tags'),

        get tags ()
          queryAll('.tags > .tag > .text'),

        get tools ()
          query('.tools'),

        get R18 ()
          query('.r-18')
          ||
          query('.r-18g'),

        get feedLink ()
          query('.tab-feed'),

        // この作品をブックマークした人はこんな作品もブックマークしています
        // あなたのブックマークタグ「○○」へのおすすめ作品
        get recommendList()
          AnkUtils.A(queryAll('._image-items')).pop(),

        get ugoiraContainer ()
          query('.works_display ._ugoku-illust-player-container'),

        get ugoiraFullscreenLink ()
          query('.works_display ._ugoku-illust-player-container .full-screen'),

        get feedList()
          query('#stacc_timeline')
          ||
          query('#stacc_center_timeline'),

        get rankingList()
          query('.ranking-items'),

        get autoPagerizeTarget()
          queryAll('._unit'),

        get nextLink()
          query('.before > a'),

        get prevLink()
          query('.after > a'),

        get uiLayoutWest ()
          query('.ui-layout-west'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.score'),

        get downloadedFilenameArea ()
          query('.ank-pixiv-downloaded-filename-text'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#wrapper'),

        get mediumImage () {
          return (
            query('.works_display > ._layout-thumbnail > img')
            ||
            query('.works_display > a > div > img')
            ||
            query('.works_display > * > a > div > img')
            ||
            query('.works_display canvas')
          );
        },

        get bigImage ()
          query('.original-image'),

        get imageOverlay ()
          query('.works_display ._illust_modal'), 

        get openCaption ()
          query('.ui-expander-container > .ui-expander-target > .expand'),

        get ads () {
          const Ads = [
                       'object',
                       'iframe',
                       '.ui-search',
                       'form.search2',          // 検索欄も広告扱いしちゃうぞ
                       '#global-header',        // ヘッダ
                       '.header',
                       '._header',
                       '#toolbar-items',        // toolbar
                       '#gm_ldrize',            // ldrize
                       '#header-banner',
                       ];

          let a = [];
          Ads.forEach(function (q) AnkUtils.A(queryAll(q)).forEach(function (e) a.push(e)));
          return a;
        },

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
        get doc () currentDoc ? currentDoc : window.content.document
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl ()
          self.elements.doc ? self.elements.doc.location.href : '',

        get id ()
          illust.pageUrl.match(/illust_id=(\d+)/) && parseInt(RegExp.$1, 10),

        get dateTime ()
          let (e = self.elements.illust.datetime)
            e && AnkUtils.decodeDateTimeText(e.textContent),

        get size ()
          let (e = self.elements.illust.size)
            e && e.textContent.match(/(\d+)\xD7(\d+)/) && { width: parseInt(RegExp.$1), height: parseInt(RegExp.$2) },

        get tags ()
          AnkUtils.A(self.elements.illust.tags) .
            map(function (e) AnkUtils.trim(e.textContent)) .
            filter(function (s) s && s.length),

        get shortTags ()
          let (limit = AnkBase.Prefs.get('shortTagsMaxLength', 8))
            illust.tags .
              filter(function (it) (it.length <= limit)),

        get tools ()
          let (e = self.elements.illust.tools)
            e && AnkUtils.trim(e.textContent),

        get width ()
          let (sz = illust.size) (sz && sz.width),

        get height ()
          let (sz = illust.size) (sz && sz.height),

        get server ()
          let (a = self.info.path.image.images)
            a.length > 0 && a[0].match(/^https?:\/\/([^\/\.]+)\./i) && RegExp.$1,

        get referer () {
          let mode =
            !self.in.manga                                    ? 'big' :
            !AnkBase.Prefs.get('downloadOriginalSize', false) ? 'manga' :
                                                                'manga_big&page=0'; // @see downloadFiles#downloadNext()

          return self.info.illust.pageUrl.replace(/mode=medium/, 'mode='+mode);
        },

        get title ()
          let (e = self.elements.illust.title)
            e && AnkUtils.trim(e.textContent),

        get comment ()
          let (e = self.elements.illust.comment)
            e && AnkUtils.textContent(e),

        get R18 ()
          !!self.elements.illust.R18,

        get animationFrames() {
          let ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustData;
          if (ugoku) {
            let frames = ugoku.frames;
            if (frames)
              return frames.map(function (o) o.file+','+o.delay);
          }
        },
      };

      let member = {
        get id ()
          let (e = self.elements.illust.memberLink)
            e && e.href.match(/\/member\.php\?id=(\d+)/) && RegExp.$1,

        // XXX 遅延が酷いとavatar.srcで例外発生？
        get pixivId () {
          let e = self.elements.illust.feedLink;
          let m = e && e.href.match(/\/stacc\/([^\?\/]+)/);
          if (!m) {
            e = self.elements.illust.avatar;
            m = e && e.src.match(/\/profile\/([^\/]+)\//);
          }
          if (m)
            return m[1];
        },

        get name ()
          let (e = self.elements.illust.userName)
            e && AnkUtils.trim(e.textContent),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          let (m = path.image.images[0].match(/(\.\w+)(?:$|\?)/))
            m && m[1] || '.jpg',

        get mangaIndexPage ()
          let (e = self.elements.illust.largeLink)
            e && e.href,

        get ugokuIllustSrc ()
          let (ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustData)
            ugoku && ugoku.src,

        get ugokuIllustFullscreenSrc ()
          let (ugoku = self.elements.doc.defaultView.wrappedJSObject.pixiv.context.ugokuIllustFullscreenData)
            ugoku && ugoku.src,

        get image () // {{{
          self.info.path._getImage(AnkBase.Prefs.get('downloadOriginalSize', false)), // }}}

        _getImage: function (mangaOriginalSizeCheck) {
          if (!mangaOriginalSizeCheck) {
            if (!_images)
              _images = self.info.path._getImageMain(mangaOriginalSizeCheck);
            return _images;
          }
          else {
            if (!_imagesOriginal)
              _imagesOriginal = self.info.path._getImageMain(mangaOriginalSizeCheck);
            return _imagesOriginal;
          }
        },

        _getImageMain: function (mangaOriginalSizeCheck) {
          if (self.in.ugoira) {
            // うごイラ
            return {
              images: [ self.info.path.ugokuIllustFullscreenSrc || self.info.path.ugokuIllustSrc ],
              facing: null,
            };
          }
          else {
            if (!self.in.manga && self.elements.illust.bigImage && self.elements.illust.bigImage.getAttribute('data-src')) {
              // イラスト
              return {
                images: [ self.elements.illust.bigImage.getAttribute('data-src') ],
                facing: null,
              }
            }

            try {
              let indexPage = path.mangaIndexPage;
              let html = AnkUtils.httpGET(indexPage, self.info.illust.pageUrl);
              let doc = AnkUtils.createHTMLDocument(html);

              // サーバエラーのトラップ
              if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
                window.alert(AnkBase.Locale('serverError'));
                return AnkBase.NULL_RET;
              }

              referer = indexPage;

              if (!self.in.manga) {
                // イラスト
                return {
                  images: [ doc.querySelector('img').src ],
                  facing: null,
                }
              }
              else {
                // マンガ or ブック
                const MAX = 1000;

                // TODO pixivの構成変更で見開き表示が正しく表示されなくなったので、pixivが直してくれるまで見開き対応は無効化
                let imMed = [];
                AnkUtils.A(doc.querySelectorAll('.manga > .item-container > img')) .
                some(function (v) {
                  if (imMed.length > MAX)
                    return true;
                  imMed.push(v.getAttribute('data-src'));
                });

                let im = [];
                let fp = [];
                if (!mangaOriginalSizeCheck) {
                  im = imMed;
                }
                else {
                  let reBig = /(_p\d+)\./;
                  let replaceBig = '_big$1.';
                  let reMaster = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
                  let replaceMaster = '$1/img-original/$2$3';

                  AnkUtils.A(doc.querySelectorAll('.manga > .item-container > a')) .
                    some(function (a) {
                      if (im.length > MAX)
                        return true;
                      let href = indexPage;
                      href = href.replace(/^(https?:\/\/.+?)(?:\/.*)$/,"$1")+a.href;
                      AnkUtils.dump(href);
                      let doc = AnkUtils.createHTMLDocument(AnkUtils.httpGET(href, indexPage));

                      // サーバエラーのトラップ
                      if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
                        window.alert(AnkBase.Locale('serverError'));
                        return AnkBase.NULL_RET;
                      }

                      let src = doc.querySelector('img').src;

                      if (!AnkBase.Prefs.get('forceCheckMangaImagesAll', false)) {
                        if (im.length == 0) {
                          if (imMed[0] ==  src) {
                            AnkUtils.dump('MANGA IMAGE: plane mode');
                            im = imMed;
                            return true;
                          }
                          else if (imMed[0].replace(reMaster, replaceMaster).replace(/\.\w+$/, '') == src.replace(/(\.\w+)$/, '')) {
                            let replaceExt = RegExp.$1;
                            AnkUtils.dump('MANGA IMAGE: master mode ... '+imMed[0]+' -> '+imMed[0].replace(reMaster, replaceMaster).replace(/\.\w+$/, replaceExt));
                            im = imMed.map(function (v) v.replace(reMaster, replaceMaster).replace(/\.\w+$/, replaceExt));
                            return true;
                          }
                          else if (imMed[0].replace(reBig, replaceBig) ==  src) {
                            AnkUtils.dump('MANGA IMAGE: big mode ... '+imMed[0]+' -> '+imMed[0].replace(reBig, replaceBig));
                            im = imMed.map(function (v) v.replace(reBig, replaceBig));
                            return true;
                          }
                          else {
                            AnkUtils.dump('MANGA IMAGE: UNKNOWN MODE ... '+imMed[0]+' -> '+src);
                          }
                        }
                      }

                      im.push(src);
                    });
                }

                // FIXME AnkUtils.createHTMLDocument()でHTML Elementのclass情報が欠けてしまうのでhtmlテキストに対してマッチングしているのを直す
                if (im.length == 0) {
                  // ブック
                  if (html.match(/<html[^>]+?class=\"(.+?)\"/) && RegExp.$1.indexOf('_book-viewer') != -1) {
                    let ltr = RegExp.$1.indexOf('ltr') != -1;
                    let re = mangaOriginalSizeCheck ? /pixiv\.context\.originalImages\[\d+\]\s*=\s*\"(.+?)\"/ : /pixiv\.context\.images\[\d+\]\s*=\s*\"(.+?)\"/;
                    AnkUtils.A(doc.querySelectorAll('script')) .
                      forEach(function (e) {
                        if (e.text.match(re)) {
                          let img = RegExp.$1; 
                          im.push(img.replace(/\\(.)/g, '$1'));
                        }
                      });
  
                    for (var i=1; i<=im.length; i++) {
                      if (i == 1) {
                        fp.push(i);
                      }
                      else {
                        fp.push((i - i%2) / 2 + 1)

                        // 見開きの向きに合わせて画像の順番を入れ替える
                        if (ltr && i % 2 == 0 && i < im.length-1) {
                          let tmp = im[i-1];
                          im[i-1] = im[i];
                          im[i] = tmp;
                        }
                      }
                    }
                  }
                }

                if (im.length > 0) {
                  if (fp.length > 0 && fp[fp.length - 1] < fp.length) {
                    // 見開きがある場合
                    AnkUtils.dump("Facing Page Check: " + fp.length + " pics in " + fp[fp.length - 1] + " pages");
                  }
                  else {
                    // 見開きがない場合
                    fp = null;
                  }
  
                  return { images: im, facing: fp, };
                }
              }
            }
            catch (e) {
              AnkUtils.dumpError(e);
            }
          }

          // error
          window.alert(AnkBase.Locale('serverError'));
          return AnkBase.NULL_RET;
        }, // }}}
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

    self.downloadable = true;

  };

  /********************************************************************************
  * メソッド
  ********************************************************************************/

  AnkModule.prototype = {

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function (mod) {
        // インストールに必用な各種要素
        var doc = mod.elements.doc;
        var body = mod.elements.illust.body;
        var wrapper = mod.elements.illust.wrapper;
        var medImg = mod.elements.illust.mediumImage;
        var largeLink = mod.elements.illust.largeLink;
        var openCaption = mod.elements.illust.openCaption;
        var userTags = mod.elements.illust.userTags;
        var imgOvr = mod.elements.illust.imageOverlay;
        var jq = doc.defaultView.wrappedJSObject.jQuery

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && medImg && wrapper && userTags)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        // デバッグ用
        if (AnkBase.Prefs.get('showDownloadedFilename', false)) {
          let e = mod.elements.illust.uiLayoutWest;
          if (e) {
            {
              let div = doc.createElement('div');
              div.classList.add('area_new');
              div.classList.add('ank-pixiv-downloaded-filename');
              let (d = doc.createElement('div')) {
                d.classList.add('area_title');
                d.classList.add('ank-pixiv-downloaded-filename-title');
                div.appendChild(d);
              }
              let (d = doc.createElement('div')) {
                d.classList.add('area_inside');
                d.classList.add('ank-pixiv-downloaded-filename-text');
                div.appendChild(d);
              }
  
              e.insertBefore(div, e.querySelector('.profile-unit+*'));
            }
          }
        }

        // FIXME AnkViewer無効時に、中クリックして、Pixivのデフォルト動作で大画像を見ると、ダウンロードマークが消える
        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          let e = imgOvr || largeLink;
          e.addEventListener(
            'click',
            function () AnkBase.downloadCurrentImageAuto(mod),
            true
          );
        } // }}}

        // 大画像関係
        if (!mod.in.ugoira) {
          if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
            if (imgOvr && jq) {
              jq(imgOvr).unbind('click');
            }

            new AnkViewer(
              mod,
              function () mod.info.path._getImage(AnkBase.Prefs.get('viewOriginalSize', false))
            );
          }
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
                  AnkBase.downloadCurrentImageAuto(mod);
              },
              true
            );
          });
        })(); // }}}

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          mod.elements.illust.downloadedDisplayParent,
          mod.info.illust.id,
          mod.SERVICE_ID,
          mod.info.illust.R18
        );

        // キャプションを開く
        if (AnkBase.Prefs.get('openCaption', false) && openCaption && openCaption.style.display === 'block') // {{{
          setTimeout(function () openCaption.click(), 1000);
        // }}}

        // イメレスにマーキング
        mod.markDownloaded(doc,true);

        return true;
      }; // }}}


      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 500, 20, '');
    }, // }}}

    /*
     * リストページのアイテムにダウンロード済みマークなどをつける
     */
    installListPageFunctions: function () { /// {

      let followExpansion = function (mod) {
        var recommend = mod.elements.illust.recommendList;
        var feed = mod.elements.illust.feedList;
        var ranking = mod.elements.illust.rankingList;

        let elm = recommend || feed || ranking;
        if (!elm) {
          return false;     // リトライしてほしい
        }

        // 伸びるおすすめリストに追随する
        if (MutationObserver) {
          new MutationObserver(function (o) {
            o.forEach(function (e) mod.markDownloaded(e.target, true));
          }).observe(elm, {childList: true});
        }

        return true;
      };

      let autoPagerize = function (mod) {
        var doc = mod.elements.doc;
        var aptarget = mod.elements.illust.autoPagerizeTarget;

        if (!(doc && aptarget)) {
          return false;     // リトライしてほしい
        }

        // AutoPagerizeによる継ぎ足し動作
        // TODO サイト別.jsに個別に書くのはよくない気がする
        doc.addEventListener(
          'AutoPagerize_DOMNodeInserted',
          function (e) {
            let a = [];
            if (e.target.classList.contains('image-item')) {
              a.push(e.target);
            }
            else {
              [
                '._image-items > li',              // フォロー新着作品＆○○さんの作品一覧
                '.ranking-items > .ranking-item',  // ランキング
              ] .
                some(function (q)
                  let (n = e.target.querySelectorAll(q))
                    n && n.length > 0 && !!(a = AnkUtils.A(n))
                );
            }
            if (a && a.length > 0)
              a.forEach(function (node) mod.markDownloaded(node, true));
          },
          false
        );

        return true;
      };

      let delayMarking = function (mod) {
        var doc = mod.elements.doc;

        if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
          return false;     // リトライしてほしい
        }

        // プレミアムユーザーでない絵師さんの作品一覧は遅延が発生するのでonFocusによる処理だけではマークがつかない
        mod.markDownloaded(doc,true);

        return true;
      };


      // install now
      if (AnkBase.Prefs.get('markDownloaded', false)) {
        if (!this.in.illustList && !this.in.bookmarkNew && !this.in.bookmarkAdd)
          AnkBase.delayFunctionInstaller(this, followExpansion, 500, 20, 'fe');
        AnkBase.delayFunctionInstaller(this, autoPagerize, 500, 20, 'ap');
        AnkBase.delayFunctionInstaller(this, delayMarking, 500, 20, 'dm');
      }
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */ 
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /&illust_id=(\d+)/;
      const Targets = [
                        ['li > a.work', 1],                       // 作品一覧、ブックマーク
                        ['.rank-detail a._work', 2],              // ホーム（ランキング）
                        ['.ranking-item a._work', 2],             // ランキング
                        ['.worksListOthersImg > ul > li > a', 1], // プロファイル（ブックマーク、イメージレスポンス）
                        ['.worksImageresponseImg > a', 2],        // イラストページ（イメージレスポンス）
                        ['li > a.response-in-work', 1],           // イラストページ（イメージレスポンス）
                        ['.search_a2_result > ul > li > a', 1],   // イメージレスポンス
                        ['.stacc_ref_illust_img > a', 3],         // フィード（お気に入りに追加したイラスト）
                        ['.stacc_ref_user_illust_img > a', 1],    // フィード（お気に入りに追加したユーザ内のイラスト）
                        ['.hotimage > a.work', 1],                // タグページ（週間ベスト）
                        ['.image-item > a:nth-child(1)', 1],      // タグページ（全期間＆新着）
                        ['.sibling-items > .after > a', 1],       // 前の作品
                        ['.sibling-items > .before > a', 1],      // 次の作品
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する
     */
    rate: function (pt) { // {{{
      function setRating (mod,pt) {
        if (!(mod.in.pixiv && mod.in.medium))
          throw 'not in pixiv';
        if (pt < 1 || 10 < pt)
          throw 'out of range';
        let rating = mod.elements.doc.defaultView.wrappedJSObject.pixiv.rating;
        if (typeof rating.rate === 'number') {
          rating.apply.call(rating, pt);
          if (!AnkBase.Prefs.get('downloadWhenRate', false))
            return true;
          let point = AnkBase.Prefs.get('downloadRate', 10);
          if (point <= pt)
            AnkBase.downloadCurrentImage(mod, AnkBase.Prefs.get('confirmExistingDownloadWhenAuto'));
        } else {
          return false;
        }
      }

      return setRating(this,pt);
    }, // }}}

  };


  /********************************************************************************
  * ベースとなるインスタンスの生成＋本体へのインストール - ankpixiv.xulにも登録を
  ********************************************************************************/

  AnkModule.prototype.dup = function () new AnkModule(this.elements.doc);

  AnkBase.addModule(new AnkModule());


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
