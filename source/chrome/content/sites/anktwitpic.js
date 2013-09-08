
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://twitpic.com/',  // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twitpic.com',          // CSSの適用対象となるドメイン
    SERVICE_ID: 'TWP',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Twitpic',              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\//), // }}}

      get manga () // {{{
        false, // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\/[^/]+$/),
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      let illust =  {
        get mediumImage ()
          query('div#media > img'),

        get largeLink ()
          query('div#media-overlay > div > span > a'),

        get datetime ()
          self.elements.doc.querySelectorAll('div#media-stats > div.media-stat')[1],

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

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('div#content'),
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
          AnkBase.currentLocation.match(/^https?:\/\/twitpic\.com\/([^/]+)(?:\?|$)/)[1],

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
          self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          AnkBase.currentLocation,

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
    })(), // }}}

    get downloadable () {
      if (self.in.illustPage && !self.elements.illust.mediumImage)
        return false;// 動画は保存できない
      return true;
    },


    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、以下の３つのメソッドは空のメソッドのままでＯＫ

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{

      let installer = function () { // {{{
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }

            // インストールに必用な各種要素
            try { // {{{
              var body = doc.getElementsByTagName('body')[0];
              var largeLink = self.elements.illust.largeLink;
              var medImg = self.elements.illust.mediumImage;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            } // }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            if (!(body && largeLink && medImg)) { // {{{
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            } // }}}

            // viewerは作らない

            // 中画像クリック時に保存する
            if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
              largeLink.addEventListener(
                'click',
                function (e) {
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
        } // }}}

        //
        if (!proc())
          setTimeout(installer, interval);
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

      function installer () {
        function proc () {
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME+' list');
              return true;
            }

            try {
              var body = doc.getElementsByTagName('body');
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }

            if (!((body && body.length>0) && doc.readyState === 'complete')) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' list remains '+counter);
              return false;   // リトライしてほしい
            }

            // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
            self.markDownloaded(doc,true);

            AnkUtils.dump('installed: '+self.SITE_NAME+' list');
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
      let doc = self.elements.doc;
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

      let target = AnkBase.getMarkTarget(self, node, force, ignorePref);
      if (!target)
        return;

      [
        ['div.user-photo-wrap > div > a', 2],             // 一覧
        ['div#media-full > p > a', 2],                    // 'full'ページ
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, self.SERVICE_ID);
          });
      });
    }, // }}}


    /********************************************************************************
    * その他
    ********************************************************************************/

    rate: function (pt) { // {{{
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
