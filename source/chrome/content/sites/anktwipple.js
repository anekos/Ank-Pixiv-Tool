
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://twipple.jp/';    // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'twipple.jp';            // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TPL';                  // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Twipple';              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.on = {
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/[^/]*twipple\.jp\//), // }}}
    },

    self.in = { // {{{
      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/p\.twipple\.jp\//) &&
        !self.info.illust.pageUrl.match(/\/user\//),
      // }}}

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
          query('#img_a_origin'),

        get datetime ()
          query('.date'),

        get title ()
          query('#item_tweet'),

        get comment ()
          illust.title,

        get avatar ()
          query('#comment > a > img'),

        get userName ()
          query('#item_screen_name > a'),

        get memberLink ()
          illust.userName,

        get tags ()
          null,

        get nextLink()
          let (e = query('a > img#prev_icon'))
            e && e.parentNode,

        get prevLink()
          let (e = query('a > img#next_icon'))
            e && e.parentNode,

        // require for AnkBase

        get downloadedDisplayParent ()
          query('#comment'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#wrapper'),

        get mediumImage ()
          query('#post_image'),

        get ads () {
          let header = query('#headerArea');
          let topad = query('#page_top_ad');

          return ([]).concat(header, topad);
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
          self.info.illust.pageUrl.match(/p\.twipple\.jp\/([^/]+?)(?:\?|$)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent),

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

        get mangaPages ()
          1,

        get worksData ()
          null,
      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/user\/(.+)(?:\?|$)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(self.elements.illust.userName.textContent).replace(/\u3055\u3093$/,''),   // ○○さん

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext ()
          '.jpg',   // 読み込んでみないとわからないのでとりあえずjpgで

        get mangaIndexPage ()
          null,

        get image () {
          return { images: [self.elements.illust.largeLink.href], facing: null, };
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

      let proc = function (mod) { // {{{
        // インストールに必用な各種要素
        // ※ついっぷるはイラストページを開いた後同じページにURLパラメータ付きでリダイレクトしている
        var body = mod.elements.illust.body;
        var wrapper = mod.elements.illust.wrapper;
        var medImg = mod.elements.illust.mediumImage;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && wrapper && medImg)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
          new AnkViewer(
            mod,
            function () mod.info.path.image
          );
        }

        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          ['#img_overlay_container', '#post_image'].forEach(function (v) {
            let e = mod.elements.doc.querySelector(v);
            if (e) {
              e.addEventListener(
                'click',
                function () AnkBase.downloadCurrentImageAuto(mod),
                true
              );
            }
          });
        } // }}}

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          mod.elements.illust.downloadedDisplayParent,
          mod.info.illust.id,
          mod.SERVICE_ID,
          mod.info.illust.R18
        );

        return true;
      };


      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 500, 20, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let proc = function (mod) {
        var doc = mod.elements.doc;
        var body = mod.elements.illust.body;

        if (!(body && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        mod.markDownloaded(doc,true);

        return true;
      };

      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 1000, 20, 'ls');  // おそい:interval=1000
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\/([^/]+?)(?:\?|$)/;
      const Targets = [
                        ['.simple_list_photo > div > a', 1],             // 一覧
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価
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
