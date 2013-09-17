
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'https://www.tumblr.com/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'tumblr.com';              // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TBR';                     // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Tumblr';                  // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]*tumblr\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]+?\.tumblr\.com\/post\//) &&
        !!self.elements.illust.mediumImage, // }}}

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
        get date ()
          query('.date') ||
          query('.postmeta > a'),

        get title ()
          query('.caption > p') ||
          query('.post > p+p') ||
          query('.photo > p+p'),

        get userName ()
          query('.footer-content > h5') ||
          query('#header > h1 > a'),

        get memberLink ()
          let (e = query('#header > * > .profile-image'))
            (e && e.parentNode),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('.caption > p'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('.container.section') ||
          query('#newDay') ||
          query('body'),

        get mediumImage ()
          query('.photo > div > a > img') ||
          query('.photo > div > img') ||
          query('.post > a > img') ||
          query('.photo > a > img'),

        get ads () {
          let header = query('#header');
          let header2 = query('#fb-root');

          return ([]).concat(header, header2);
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
          self.elements.doc.location.href,

        get id ()
          self.info.illust.pageUrl.match(/\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.date.textContent),

        get size ()
          null,

        get tags ()
          [],

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
          let (e = self.elements.illust.title)
           e && AnkUtils.trim(e.textContent),

        get comment ()
          illust.title,

        get R18 ()
          !!self.info.illust.pageUrl.match(/\.tumblr\.com\/post\/[^/]+?\/[^/]*r-?18/),

      };

      let member = {
        get id ()
          self.info.illust.pageUrl.match(/^https?:\/\/([^/]+?)\.tumblr\.com\/post\//)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName ? self.elements.illust.userName.textContent : self.info.member.id),

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
          return { images: [self.elements.illust.mediumImage.src], facing: null, };
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
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!(body && wrapper && medImg)) {
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }

            // 大画像関係
            if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
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

            AnkUtils.dump('installed: '+mod.SITE_NAME);
          }
          catch (e) {
            AnkUtils.dumpError(e);
          }
          return true;
        }

        if (!proc())
          timer = setTimeout(installer, interval);
      };

      // closure {{{
      let mod = new AnkModule(this.elements.doc);
      let interval = 500;
      let counter = 20;
      // }}}

      return installer();
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {
      // under construction
      AnkUtils.dump('installed: '+this.SITE_NAME+' list');
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
          ['#portfolio > div > * > .item > a', 1],              // 一覧
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(target.node.querySelectorAll(selector)) .
            map(function (link) link.href && let (m = link.href.match(/\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/)) m && [link, m[1]]) .
            filter(function (m) m) .
            forEach(function ([link, id]) {
              if (!(target.illust_id && target.illust_id != id))
                AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, mod.SERVICE_ID, true);
            });
        });
      }

      // closure {{{
      let mod = new AnkModule(this.elements.doc);
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

    AnkBase.addModule(new AnkModule());


} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
