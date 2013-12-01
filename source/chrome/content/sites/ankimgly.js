
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://img.ly/'; // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'img.ly';         // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'IMG';            // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Imgly';          // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/img\.ly\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/img\.ly\/[^/]+?(?:\?|$)/), // }}}

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
        get largeLink ()
          query('#button-fullview > a'),

        get date ()
          query('#image-date > strong'),

        get title ()
          query('#image-description'),

        get memberLink ()
          query('.name > a'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('#image-box'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#content'),

        get mediumImage ()
          query('#the-image'),

        get ads () {
          let header = query('#header');

          return ([]).concat(header);
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
          self.info.illust.pageUrl.match(/img\.ly\/([^/]+?)(?:\?|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.date.textContent),

        get size ()
          null,

        get tags ()
          [],

        get shortTags ()
          [],

        get tools ()
          null,

        get width ()
          0,

        get height ()
          0,

        get server ()
          null,

        get referer ()
          self.elements.illust.largeLink.href,

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          illust.title,

        get R18 ()
          false,

      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/^https?:\/\/img\.ly\/images\/([^/]+?)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.info.member.id),

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
          return { images: [self.elements.illust.mediumImage.src.replace(/\/large_/,'/original_')], facing: null, };
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
                  AnkBase.downloadCurrentImageAuto(mod);
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
      let mod = this;
      let interval = 500;
      let counter = 20;
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
      let interval = 1000;    // おそい
      let counter = 20;
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
          ['li.image-list-item > div+p > a', 2],              // 一覧
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(target.node.querySelectorAll(selector)) .
            map(function (link) link.href && let (m = link.href.match(/img\.ly\/([^/]+?)(?:\?|$)/)) m && [link, m[1]]) .
            filter(function (m) m) .
            forEach(function ([link, id]) {
              if (!(target.illust_id && target.illust_id != id))
                AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, mod, false);
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
