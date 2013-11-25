
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

    self.ID_FANTASY_DISPLAY = 'ankpixiv-fantasy-display',

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () { // {{{
        try {
          return self.info.illust.pageUrl.match(/^https?:\/\/www\.pixiv\.net\//);
        } catch (e) {
          return false;
        }
      }, // }}}

      get manga () // {{{
        let (node = self.elements.illust.largeLink)
          node && node.href.match(/(?:&|\?)mode=manga(?:&|$)/), // }}}

      get medium () { // {{{
        let loc = self.info.illust.pageUrl;
        return (
          self.in.site &&
          loc.match(/member_illust\.php\?/) &&
          loc.match(/(?:&|\?)mode=medium(?:&|$)/) &&
          loc.match(/(?:&|\?)illust_id=\d+(?:&|$)/)
        );
      }, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/member_illust.php\?.*illust_id=/), // }}}

      get myPage () // {{{
        (self.info.illust.pageUrl == 'http://www.pixiv.net/mypage.php'), // }}}

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
        self.info.illust.pageUrl.match(/\.pixiv\.net\/member_illust.php\?id=/), // }}}

      get bookmarkNew () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_new_illust\.php/), // }}}

      get bookmarkAdd () // {{{
        self.info.illust.pageUrl.match(/\.pixiv\.net\/bookmark_add\.php\?/), // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q,parentq)
        let (e = !parentq && self.elements.doc || query(parentq))
          e && e.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get largeLink ()
          let (e = illust.mediumImage)
            e && e.parentNode,

        get datetime ()
          query('.meta > li'),

        get size ()
          query('.meta > li+li'),

        get title ()
          query('.title', '.work-info'),

        get comment ()
          query('.caption', '.work-info'),

        get avatar ()
          query('.profile-unit > a > img.user-image'),

        get userName ()
          query('.profile-unit > a > .user'),

        get memberLink ()
          query('.profile-unit > a.user-link'),

        get tags ()
          queryAll('.tags > .tag > .text'),

        get tools ()
          query('.tools'),

        get R18 ()
          query('.r-18') ||
          query('.r-18g'),

        get recommendList()
          AnkUtils.A(queryAll('.image-items')).pop(),

        get feedList()
          query('#stacc_timeline'),

        get rankingList()
          query('.ranking-items'),

        get autoPagerizeTarget()
          queryAll('._unit'),

        get nextLink()
          query('.before > a'),

        get prevLink()
          query('.after > a'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.meta', '.work-info'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#wrapper'),

        get mediumImage () {
          return (
            query('.works_display > a > img')
            ||
            query('.works_display > * > a > img')
          );
        },

        get openComment ()
          query('.comment-show-button'),

        get openCaption ()
          query('.ui-expander-container > .ui-expander-target > .expand'),

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
          let (e = self.elements.illust.largeLink)
            e && e.href.match(/illust_id=(\d+)/) && parseInt(RegExp.$1, 10),

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
          let (v = self.info.path.largeStandardImage)
            v && v.match(/^http:\/\/([^\/\.]+)\./i) && RegExp.$1,

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

      };

      let member = {
        get id ()
          let (e = self.elements.illust.memberLink)
            e && e.href.match(/\/member\.php\?id=(\d+)/) && RegExp.$1,

        // XXX 遅延が酷いとavatar.srcで例外発生？
        get pixivId ()
          let (m = (self.elements.illust.avatar.src.match(/\/profile\/([^\/]+)\//)
                    ||
                    self.info.path.largeStandardImage.match(/^https?:\/\/[^\.]+\.pixiv\.net\/(?:img\d+\/)?img\/([^\/]+)\//)))
            m.length > 0 && m[1],

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
          (self.info.path.largeStandardImage.match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          self.info.illust.pageUrl.replace(/(\?|&)mode=medium(&|$)/, "$1mode=manga$2"),

        // XXX 再投稿された、イラストのパスの末尾には、"?28737478..." のように数値がつく模様
        // 数値を除去してしまうと、再投稿前の画像が保存されてしまう。
        get largeStandardImage ()
          let (e = self.elements.illust.mediumImage)
            e && e.src.replace(/_m\./, '.'),

        get image ()
          self.getImageInfo(AnkBase.Prefs.get('downloadOriginalSize', false)),

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

      let installer = function () { // {{{
        function proc () {
          if (counter-- <= 0) {
            AnkUtils.dump('installation failed: '+mod.SITE_NAME);
            return true;
          }

          try {
            // インストールに必用な各種要素
            try { // {{{
              var doc = mod.elements.doc;
              var body = mod.elements.illust.body;
              var wrapper = mod.elements.illust.wrapper;
              var medImg = mod.elements.illust.mediumImage;
              var openComment = mod.elements.illust.openComment;
              var openCaption = mod.elements.illust.openCaption;
              var avatar = mod.elements.illust.avatar;
              var fitMode = AnkBase.Prefs.get('largeImageSize', AnkBase.FIT.NONE);
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            } // }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            if (!(body && medImg && wrapper && openComment && avatar)) { // {{{
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            } // }}}

            // 中画像クリック時に保存する
            if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
              medImg.addEventListener(
                'click',
                function (e) {
                  AnkBase.downloadCurrentImageAuto(mod);
                },
                true
              );
            } // }}}

            // 大画像関係
            if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
              new AnkViewer(
                mod,
                function () mod.getImageInfo(AnkBase.Prefs.get('viewOriginalSize', false))
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

            // コメント欄を開く
            if (AnkBase.Prefs.get('openComment', false)) // {{{
              setTimeout(function () openComment.click(), 1000);
            // }}}

            // キャプションを開く
            if (AnkBase.Prefs.get('openCaption', false) && openCaption && openCaption.style.display === 'block') // {{{
              setTimeout(function () openCaption.click(), 1000);
            // }}}

            AnkUtils.dump('installed: '+mod.SITE_NAME);

          } catch (e) {
            AnkUtils.dumpError(e);
          }

          return true;
        }; // }}}

        if (!proc())
          setTimeout(installer, interval);
      };

      // closure {{{
      let mod = this;
      let interval = 500;
      let counter = 20;
      // }}}

      return installer();
    }, // }}}

    /*
     * リストページのアイテムにダウンロード済みマークなどをつける
     */
    installListPageFunctions: function () { /// {

      let followExpansion = function (cnt) {
        function proc (counter) {
          if (counter <= 0) {
            AnkUtils.dump('installation failed fe: '+mod.SITE_NAME);
            return true;
          }

          try { // {{{
            var recommend = mod.elements.illust.recommendList;
            var feed = mod.elements.illust.feedList;
            var ranking = mod.elements.illust.rankingList;
          } catch (e) {
            AnkUtils.dumpError(e);
            return true;
          } // }}}

          let elm = recommend || feed || ranking;
          if (!elm) {
            AnkUtils.dump('delay installation fe: '+mod.SITE_NAME+' remains '+counter);
            return false;     // リトライしてほしい
          }

          // 伸びるおすすめリストに追随する
          if (MutationObserver) {
            new MutationObserver(function (o) {
              o.forEach(function (e) mod.markDownloaded(e.target, true));
            }).observe(elm, {childList: true});
          }

          AnkUtils.dump('installed fe: '+mod.SITE_NAME);
          return true;
        }

        if (mod.in.illustList || mod.in.bookmarkNew || mod.in.bookmarkAdd)
          return;

        if (!AnkBase.Prefs.get('markDownloaded', false))
          return;

        if (!proc(cnt))
          setTimeout(function() followExpansion(cnt-1), interval);
      };

      let autoPagerize = function (cnt) {
        function proc (counter) {
          if (counter <= 0) {
            AnkUtils.dump('installation failed ap: '+mod.SITE_NAME);
            return true;
          }

          try { // {{{
            var doc = mod.elements.doc;
            var aptarget = mod.elements.illust.autoPagerizeTarget;
          } catch (e) {
            AnkUtils.dumpError(e);
            return true;
          } // }}}

          if (!(doc && aptarget)) {
            AnkUtils.dump('delay installation ap: '+mod.SITE_NAME+' remains '+counter);
            return false;     // リトライしてほしい
          }

          // AutoPagerizeによる継ぎ足し動作
          // TODO サイト別.jsに個別に書くのはよくない気がする
          doc.addEventListener(
            'AutoPagerize_DOMNodeInserted',
            function (e) {
              let a;
              [
                 '.image-items > li',               // フォロー新着作品
                 '.display_works > ul > li',        // おすすめ
                 '.ranking-items > .ranking-item',  // ランキング
              ] .
                some(function (q)
                  let (n = e.target.querySelectorAll(q))
                    n && n.length > 0 && !!(a = n)
                );
              AnkUtils.A(a) .
                forEach(function (node) mod.markDownloaded(node, true));
            },
            false
          );

          AnkUtils.dump('installed ap: '+mod.SITE_NAME);
          return true;
        }

        if (!AnkBase.Prefs.get('markDownloaded', false))
          return;

        if (!proc(cnt))
          setTimeout(function() autoPagerize(cnt-1), interval);
      }

      let delayMarking = function (cnt) {
        function proc (counter) {
          if (counter <= 0) {
            AnkUtils.dump('installation failed dm: '+mod.SITE_NAME);
            return true;
          }

          try { // {{{
            var doc = mod.elements.doc;
          } catch (e) {
            AnkUtils.dumpError(e);
            return true;
          } // }}}

          if (typeof doc === 'undefined' || !doc || doc.readyState !== "complete") {
            AnkUtils.dump('delay installation dm: '+mod.SITE_NAME+' remains '+counter);
            return false;     // リトライしてほしい
          }

          // プレミアムユーザーでない絵師さんの作品一覧は遅延が発生するのでonFocusによる処理だけではマークがつかない
          mod.markDownloaded(doc,true);

          AnkUtils.dump('installed dm: '+mod.SITE_NAME);
          return true;
        }

        if (!AnkBase.Prefs.get('markDownloaded', false))
          return;

        if (!proc(cnt))
          setTimeout(function() delayMarking(cnt-1), interval);
      };

      // closure {{{
      let mod = this;
      let interval = 500;
      let counter_init = 20;
      // }}}

      followExpansion(counter_init);
      autoPagerize(counter_init);
      delayMarking(counter_init);
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */ 
    markDownloaded: function (node, force, ignorePref) { // {{{
      function marking () {
        const IsIllust = /&illust_id=(\d+)/;

        let target = AnkBase.getMarkTarget(mod, node, force, ignorePref);
        if (!target)
          return;

        [
          ['li > a.work', 1],                       // 作品一覧、ブックマーク
          ['li.rank-detail > a', 1],                // ホーム（ランキング）
          ['.ranking-item > a.work', 1],            // ランキング
          ['.worksListOthersImg > ul > li > a', 1], // ブックマーク（プロファイル）、イメージレスポンス（プロファイル）
          ['.search_a2_result > ul > li > a', 1],   // イメージレスポンス
          ['.stacc_ref_illust_img > a', 3]          // フィード
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(target.node.querySelectorAll(selector)) .
            map(function (link) link.href && let (m = IsIllust.exec(link.href)) m && [link, m]) .
            filter(function (m) m) .
            map(function ([link, m]) [link, parseInt(m[1], 10)]) .
            forEach(function ([link, id]) {
              if (!(target.illust_id && target.illust_id != id))
                AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, mod.SERVICE_ID);
            });
        });
      }

      // closure {{{
      let mod = this;
      // }}}

      return marking();
    }, // }}}

    /*
     * 評価する
     */
    rate: function (pt) { // {{{
      function setRating (pt) {
        if (!(mod.in.pixiv && mod.in.medium))
          throw 'not in pixiv';
        if (pt < 1 || 10 < pt)
          throw 'out of range';
        let rating = mod.elements.doc.defaultView.wrappedJSObject.pixiv.rating;
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
      }

      // closure {{{
      let mod = this;
      // }}}

      return setRating(pt);
    }, // }}}


    /********************************************************************************
    * Pixiv固有
    ********************************************************************************/

    /*
     * マンガのページ一覧を取得する（前段）
     */
    getImageInfo: function (originalSizeCheck) {
      if (!this.in.manga)
        return { images: [this.info.path.largeStandardImage], facing: null, };

      return this.getMangaPages(originalSizeCheck);
    },

    /*
     * マンガのページ一覧を取得する（後段）
     *  originalSizeCheck: オリジナルサイズで（ダウンロード｜表示）を行うかどうか
     *  return
     *    images:          画像のurlリスト
     *    facing:          見開きがある場合はurlに対応するページ番号のリスト、それ以外の場合はnull
     */
    getMangaPages: function (originalSizeCheck) { // {{{

      function replaceMangaImageUrl (v) {
        return (v.match(/_big_p\d+\./) ? v : v.replace(/_p(\d+)\./, '_big_p$1.'));
      }

      const MAX = 1000;

      const NULL_RET = { images: [], facing: null, };

      let manIdx = AnkUtils.httpGET(this.info.path.mangaIndexPage);
      let doc = AnkUtils.createHTMLDocument(manIdx);
      if (doc.querySelector('.errorArea') || doc.querySelector('.errortxt')) {
        window.alert(AnkBase.Locale('serverError'));
        return NULL_RET;
      }

      let mangaArea = doc.querySelector('.manga');
      if (!mangaArea) {
        window.alert(AnkBase.Locale('serverError'));
        return NULL_RET;
      }
      let im = [];
      let fp = [];
      AnkUtils.A(mangaArea.querySelectorAll('script')) .
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

      if (originalSizeCheck) {
        let bigurl = replaceMangaImageUrl(im[0]);
        if (bigurl) {
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

          if (AnkUtils.remoteFileExists(bigurl))
            im = im.map(function (v) replaceMangaImageUrl(v));
        }
      }

      return { images: im, facing: fp, };
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
