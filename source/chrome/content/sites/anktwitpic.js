
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://twitpic.com/';  // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'twitpic.com';          // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'TWP';                  // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Twitpic';              // ?site-name?で置換されるサイト名のデフォルト値


     /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.on = {
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitpic\.com\//), // }}}
    },

    self.in = { // {{{
      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitpic\.com\/[^/]+$/),
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
          query('div#media-overlay > div > span > a'),

        get datetime ()
          let (e = queryAll('div.media-stat > p'))
            e && e.length >= 2 && e[1],

        get title ()
          self.elements.illust.mediumImage,

        get comment ()
          null,

        get avatar ()
          query('div#infobar-user-avatar > a > img'),

        get userName ()
          query('div#infobar-user-info > h2'),

        get memberLink ()
          query('div#infobar-user-info > h4 > a'),

        get tags ()
          null,

        // require for AnkBase

        get downloadedDisplayParent ()
          query('#infobar-right'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#content'),

        get mediumImage ()
          query('div#media > img'),

        get ads () {
          let header = query('#infobar-wrap');

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
          self.info.illust.pageUrl.match(/^https?:\/\/twitpic\.com\/([^/]+)(?:\?|$)/)[1],

        get dateTime ()
          let (e = self.elements.illust.datetime)
            e && AnkUtils.decodeDateTimeText(e.textContent),

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
          self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          self.info.illust.pageUrl,

        get title ()
          AnkUtils.trim(self.elements.illust.title.alt),

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
          self.elements.illust.memberLink.href.match(/\/photos\/(.+)(?:\?|$)/)[1],

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
          (path.image.images[0].match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get image () {
          // 本当は'full'ページから引かなければいけない？しかしサンプルがみつからず
          return { images: [self.elements.illust.mediumImage.src], facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

    Object.defineProperty(this, 'downloadable', {
      get: function () {
        return  !(self.in.illustPage && !self.elements.illust.mediumImage);   // 動画は保存できない
      },
    });

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
        var body = mod.elements.illust.body;
        var medImg = mod.elements.illust.mediumImage;
        var largeLink = mod.elements.illust.largeLink;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && medImg && largeLink)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        // 大画像関係
        if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+mod.SITE_NAME, true)) {
          new AnkViewer(
            mod,
            function () mod.info.path.image
          );
        }

        // 中画像クリック時に保存する
        if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
          largeLink.addEventListener(
            'click',
            function () AnkBase.downloadCurrentImageAuto(mod),
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

        return true;
      };


      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 1000, 20, '');  // おそい:interval=1000
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let proc = function (mod) {
        var doc = mod.elements.doc;
        var body = doc.getElementsByTagName('body');

        if (!((body && body.length>0) && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        mod.markDownloaded(doc,true);

        return true;
      };


      // install now
      return AnkBase.delayFunctionInstaller(this, proc, 1000, 40, 'ls');  // さらにおそい:interval=1000,retry=40
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\/([^/]+?)(?:\?|$)/;
      const Targets = [
                        ['div.user-photo-wrap > div > a', 2],             // 一覧
                        ['div#media-full > p > a', 2],                    // 'full'ページ
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
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
