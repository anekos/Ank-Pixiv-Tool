
try {

  let AnkModule = function (currentDoc) {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    var self = this;

    self.URL        = 'http://nijie.info/';   // イラストページ以外でボタンを押したときに開くトップページのURL
    self.DOMAIN     = 'nijie.info';           // CSSの適用対象となるドメイン
    self.SERVICE_ID = 'NJE';                  // 履歴DBに登録するサイト識別子
    self.SITE_NAME  = 'Nijie';                // ?site-name?で置換されるサイト名のデフォルト値 


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/nijie\.info\//), // }}}

      get manga () // {{{
        (self.info.illust.mangaPages > 1), // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/nijie\.info\/view\.php\?id=/), // }}}

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
        get datetime ()
          query('div#view-honbun > p') ||
          query('div#created > p'),

        get title ()
          query('div#view-header > div#view-left > p') ||
          query('p.title'),

        get comment ()
          queryAll('div#view-honbun > p')[1] ||
          queryAll('div#dojin_text > p')[1],

        get avatar ()
          query('a.name > img'),        // "同人"ページではimgが存在しない

        get userName ()
          query('a.name') ||
          query('div#dojin_left > div.right > p.text > a'),

        get memberLink ()
          illust.userName,

        get tags ()
          query('div#view-tag') ||
          query('ul#tag'),

        get gallery ()
          query('#gallery'),         // 両ページ共通

        get doujinHeader ()
          query('#dojin_header'),

        get noComment ()
          query('.co2') || query('#dojin_comment'),

        get nextLink()
          query('a#nextIllust'),

        get prevLink()
          query('a#backIllust'),

        // require for AnkBase

        get downloadedDisplayParent ()
          query('div#view-honbun') ||
          query('div#infomation'),

        // require for AnkViewer

        get body ()
          let (e = queryAll('body'))
            e && e.length > 0 && e[0],

        get wrapper ()
          query('#main'),

        get mediumImage ()
          query('img#view_img') ||      // "投稿イラスト"ページ
          query('p.image > img'),       // "同人"ページ

        get openComment ()
          query('.open'),

        get ads () {
          let header1 = query('#header-Container');
          let header2 = query('#top');

          return ([]).concat(header1, header2);
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
          self.info.illust.pageUrl.match(/id=(\d+)/)[1],

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent),

        get size ()
          null,

        get tags () {
          let elem = self.elements.illust.tags;
          if (!elem)
            return [];
          let tags = AnkUtils.A(elem.querySelectorAll('span.tag_name'))
            .map(function (e) AnkUtils.trim(e.textContent))
            .filter(function (s) s && s.length);
          if (tags.length > 0)
            return tags;

          return AnkUtils.A(elem.querySelectorAll('li > a'))
           .map(function (e) AnkUtils.trim(e.textContent))
           .filter(function (s) s && s.length);
        },

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
          self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          self.info.illust.pageUrl,

        get title ()
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          let (e = self.elements.illust.comment)
            (e ? AnkUtils.textContent(e) : ''),

        get R18 ()
          true,

        get mangaPages ()
          self.info.path.image.images.length,

        get worksData ()
          null,
      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/id=(\d+)/)[1],

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
          let m = [];

          if (self.elements.illust.doujinHeader)
            m.push(self.elements.illust.mediumImage.src); // "同人"の場合は表紙をリストに追加

          AnkUtils.A(self.elements.illust.gallery.querySelectorAll('a')).
            forEach(function (v) {
              m.push(v.href);
            });

          return { images: m, facing: null, };
        }
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
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+mod.SITE_NAME);
              return true;
            }

            // インストールに必用な各種要素
            try { // {{{
              var doc = mod.elements.doc;
              var body = mod.elements.illust.body;
              var wrapper = mod.elements.illust.wrapper;
              var medImg = mod.elements.illust.mediumImage;
              var openComment = mod.elements.illust.openComment;
              var noComment = mod.elements.illust.noComment;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }// }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            if (!(body && wrapper && medImg && (openComment || noComment))) { // {{{
              AnkUtils.dump('delay installation: '+mod.SITE_NAME+' remains '+counter);
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
              medImg.addEventListener(
                'click',
                function (e) {
                  AnkBase.downloadCurrentImageAuto(mod);
                },
                true
              );
            } // }}}

            // レイティング("抜いた","いいね")によるダウンロード
            (function () { // {{{
              if (!AnkBase.Prefs.get('downloadWhenRate', false))
                return;

              ['a#nuita','a#good'].forEach(function (v) {
                let e = doc.querySelector(v)
                if (e) {
                  e.addEventListener(
                    'click',
                    function () {
                      AnkBase.downloadCurrentImageAuto(mod);
                    },
                    true
                  );
                }
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
            if (openComment && AnkBase.Prefs.get('openComment', false)) // {{{
              setTimeout(function () openComment.click(), 1000);
            // }}}

            AnkUtils.dump('installed: '+mod.SITE_NAME);

          } catch (e) {
            AnkUtils.dumpError(e);
          }

          return true;
        } // }}}

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
        const IsIllust = /view\.php\?id=(\d+)/;

        let target = AnkBase.getMarkTarget(mod, node, force, ignorePref);
        if (!target)
          return;

        [
          ['div.nijie > div.picture > p.nijiedao > a', 3],  // 通常の一覧
          ['div.nijie > p.nijiedao > a', 2],                // "同人"の一覧
          ['div.nijie-bookmark > p > a', 2],                // "ブックマーク"の一覧
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
