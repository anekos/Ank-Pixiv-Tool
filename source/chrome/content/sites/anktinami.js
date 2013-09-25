
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://www.tinami.com/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'tinami.com';             // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TNM';                    // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Tinami';                 // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]*tinami\.com\//), // }}}

      get manga () // {{{
        AnkUtils.A(self.elements.illust.typeImages).some(function (v) v.src.match(/\/ma\.gif$/)), // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/www\.tinami\.com\/view\//), // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }; // }}}

    self.elements = (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get images ()
          let (e = query('.captify'))
            e ? [e] : queryAll('.viewbody > * > img'),

        get datetime ()
          query('.view_info'),

        get title ()
          query('.viewdata > h1 > span'),

        get comment ()
          query('.description'),

        get userName ()
          query('.prof > p > a > strong'),

        get memberLink ()
          query('.prof > p > a'),

        get tags ()
          queryAll('.tag > span'),

        get typeImages ()
          queryAll('.viewdata > p > img'),

        get postParams ()
          queryAll('#open_original_content > input'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.description'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#container'),

        get mediumImage ()
          illust.images[0],

        get openComment ()
          query('#show_all'),

        get ads () {
          let header = query('#header');
          let controller = query('#controller');

          return ([]).concat(header, controller);
        },
      };

      let mypage = {
        get fantasyDisplay ()
          null, // under construction

        get fantasyDisplayNext ()
          null, // under construction
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
          self.info.illust.pageUrl.match(/www\.tinami\.com\/view\/([^/]+?)(?:\?|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent),

        get size ()
          null,

        get tags ()
          AnkUtils.A(self.elements.illust.tags).filter(function (e) AnkUtils.trim(e.textContent)),

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(function (it) (it.length <= limit));
        },

        get tools ()
          null,

        get width ()
          0,

        get height ()
          0,

        get server ()
          null,

        get referer ()
          self.info.illust.pageUrl,

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          AnkUtils.trim(self.elements.illust.comment.textContent),

        get R18 ()
          false,

      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/profile\/(.+)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          (self.info.path.image.images[0].match(/(\.\w+)(?:$|\?)/)[1].toLowerCase() || '.jpg'),

        get mangaIndexPage ()
          null,

        get image () {
          let images;
          if (self.in.manga) {
            // マンガの大サイズ画像はないらしい
            images = AnkUtils.A(self.elements.illust.images).map(function (e) e.src);
          } else {
            let params = AnkUtils.A(self.elements.illust.postParams).
              map(function (e) (e.getAttribute('name')+'='+e.getAttribute('value'))).
              join('&');
            let html = AnkUtils.httpGET(self.info.illust.referer, self.info.illust.referer, params);
            let doc = AnkUtils.createHTMLDocument(html);

            // 大サイズ画像ページが取れないことがある（セッション切れとか？）ので、その場合はalert等したいが、とりあえずダウンロード無効までで
            images = AnkUtils.A(doc.querySelectorAll('img')).
              filter(function (e) e.src.match(/^https?:\/\/img\.tinami\.com\/illust\d*\/img\//)).
              map(function (e) e.src);
          }

          return { images: images, facing: null, };
        },
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

      let installer = function () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+mod.SITE_NAME);
              return true;
            }

            try {
              var doc = mod.elements.doc;
              var body = mod.elements.illust.body;
              var wrapper = mod.elements.illust.wrapper;
              var medImg = mod.elements.illust.mediumImage;
              var openComment = mod.elements.illust.openComment;
              var images = mod.elements.illust.images;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!(body && wrapper && (images && images.length>0) && medImg)) {
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }

            // 大画像関係
            if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
              // jQuery.click()をunbindする
              let jq = doc.defaultView.wrappedJSObject.jQuery;
              if (jq) {
                jq(doc).ready(function () {
                  try {
                    jq(medImg).unbind('click');
                  } catch (e) {
                    AnkUtils.dumpError(e);
                  }
                });
              }

              new AnkViewer(
                mod,
                function () mod.info.path.image
              );
            }

            // 中画像クリック時に保存する
            if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
              medImg.addEventListener(
                'click',
                function () {
                  AnkBase.downloadCurrentImageAuto();
                },
                true
              );
            } // }}}

            // 保存済み表示
            AnkBase.insertDownloadedDisplayById(
              mod.elements.illust.downloadedDisplayParent,
              mod.info.illust.id,
              mod.SERVICE_ID,
              mod.info.illust.R18
            );

            // 続きを表示
            if (openComment && AnkBase.Prefs.get('openComment', false)) // {{{
              setTimeout(function () openComment.click(), 1000);
            // }}}

            AnkUtils.dump('installed: '+mod.SITE_NAME);
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
          return true;
        }

        //
        if (!proc())
          setTimeout(installer, interval);
      };

      // closure {{{
      let mod = this;
      let counter = 20;
      let interval = 500;
      // }}}

      return installer();
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      function installer () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+mod.SITE_NAME+' list');
              return true;
            }

            try {
              var doc = mod.elements.doc;
              var body = mod.elements.illust.body;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!(body && doc.readyState === 'complete')) {
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' list remains '+counter);
              return false;   // リトライしてほしい
            }

            // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
            mod.markDownloaded(doc,true);

            AnkUtils.dump('installed: '+mod.SITE_NAME+' list');
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
          return true;
        }

        //
        if (!proc())
          setTimeout(installer, interval);
      }

      // closure {{{
      let mod = this;
      let counter = 20;
      let interval = 500;
      // }}}

      return installer();
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      function marking () {
        let target = AnkBase.getMarkTarget(mod, node, force, ignorePref);
        if (!target)
          return;

        [
          ['td > p.capt + a', 1],                         // 一覧
          ['.title > .collection_form_checkbox + a', 1],  // コレクション
          ['.thumbs > li > ul > li > a', 1],              // 最近の投稿作品
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(target.node.querySelectorAll(selector)) .
            map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
            filter(function (m) m) .
            forEach(function ([link, id]) {
              if (!(target.illust_id && target.illust_id != id))
                AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, mod.SERVICE_ID, false);
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
    rate: function () { // {{{
      return true;
    },

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
