
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'https://www.tumblr.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'tumblr.com',              // CSSの適用対象となるドメイン
    SERVICE_ID: 'TBR',                     // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Tumblr',                  // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/[^/]*tumblr\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/[^/]+?\.tumblr\.com\/post\//) &&
        !!self.elements.illust.largeLink, // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryAll (q)
        self.elements.doc.querySelectorAll(q)

      let illust =  {
        get largeLink () {
          let m;
          [
            query('.photo > div > a'),
            query('.post > a'),
            query('.photo > a'),
          ] .
          some(function (e) e && e.href.match(/\.tumblr\.com\/image\//) && !!(m = e));

          return m;
        },

        get mediumImage ()
          query('.photo > div > a > img') ||
          query('.post > a > img') ||
          query('.photo > a > img'),

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

        get wrapper ()
          query('.container.section') ||
          query('#newDay') ||
          query('body'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('.caption > p'),

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
        get doc () window.content.document
      };
    })(), // }}}

    info: (function () { // {{{
      let illust = {
        get id ()
          AnkBase.currentLocation.match(/\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/)[1],

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
          AnkBase.currentLocation,

        get title ()
          self.elements.illust.title && AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          illust.title,

        get R18 ()
          !!AnkBase.currentLocation.match(/\.tumblr\.com\/post\/[^/]+?\/[^/]*r-?18/),

      };

      let member = {
        get id ()
          AnkBase.currentLocation.match(/^https?:\/\/([^/]+?)\.tumblr\.com\/post\//)[1],

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
          '.jpg',   // 読み込んでみないとわからないのでとりあえずjpgで

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
    })(), // }}}

    get downloadable ()
      true,


    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、以下の３つのメソッドは空のメソッドのままでＯＫ

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{

      let installer = function () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }
  
            try {
              var body = doc.getElementsByTagName('body');
              var wrapper = self.elements.illust.wrapper;
              var medImg = self.elements.illust.mediumImage;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }
  
            if (!((body && body.length>0) && wrapper && medImg)) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }
  
            // 大画像関係
            if (AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true)) {
              new AnkViewer(
                self,
                body[0],
                wrapper,
                null,
                function () self.info.path.image
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
              self.elements.illust.downloadedDisplayParent,
              self.info.illust.id,
              self.SERVICE_ID,
              self.info.illust.R18
            );
  
            AnkUtils.dump('installed: '+self.SITE_NAME);
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
      let doc = self.elements.doc;
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
      AnkUtils.dump('installed: '+self.SITE_NAME+' list');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{

      let target = AnkBase.getMarkTarget(self, node, force, ignorePref);
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
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, self.SERVICE_ID, true);
          });
      });
    }, // }}}


    /********************************************************************************
    * その他
    ********************************************************************************/

    rate: function () { // {{{
      return true;
    },

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
