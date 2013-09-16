
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'https://twitter.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'twitter.com',          // CSSの適用対象となるドメイン
    SERVICE_ID: 'TWT',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Twitter',              // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.com\//), // }}}

      get manga () // {{{
        false, // }}} // under construction

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        self.in.tweet ||         // ツイート
        self.in.gallery ||       // ポップアップ中
        self.in.illustGrid,      // '画像/動画'ページ
      // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction

      /*
       * 以下はモジュールローカル部品
       */

      get tweet () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.com\/[^/]+\/status\//), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get illustTweet() // {{{
        (self.elements.illust.mediumImage || self.elements.illust.photoFrame), // }}}

      // elementを見ているが、これに関しては問題ないはず
      get gallery () // {{{
        self.elements.illust.galleryEnabled, // }}}

      get illustGrid () // {{{
        self.info.illust.pageUrl.match(/^https?:\/\/twitter\.com\/[^/]+\/media\/grid/),
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q)

      function queryEither (gQuery, tQuery)
        self.in.gallery ? illust.gallery.querySelector(gQuery) :
                          (illust.tweet && illust.tweet.querySelector(tQuery))

      let illust =  {
        get mediumImage ()
          queryEither('img.media-image', '.media-thumbnail > img'),

        get photoFrame ()
          let (e = self.elements.illust.tweet.querySelector('.card2 > div > iframe'))
            (e && AnkUtils.trackbackParentNode(e, 2).getAttribute('data-card2-name') === 'photo') ? e : null, 

        get photoImage ()
          illust.photoFrame && illust.photoFrame.contentDocument.querySelector('.u-block'),

        get largeLink ()
          queryEither('.twitter-timeline-link', '.twitter-timeline-link'),

        get datetime ()
          queryEither('.tweet-timestamp', 'span.metadata > span'),

        get title ()
          queryEither('.tweet-text', '.tweet-text'),

        get comment ()
          illust.title,

        get avatar ()
          queryEither('.avatar', '.avatar'),

        get userName ()
          queryEither('.simple-tweet', '.user-actions'),

        get memberLink ()
          queryEither('.account-group', '.account-group'),

        get tags ()
          null,

        get tweet ()
          query('.permalink-tweet'),

        get gallery ()
          query('.gallery-container'),

        get galleryEnabled ()
          query('.gallery-enabled'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          queryEither('.stream-item-header', '.tweet-actions'),
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
        get pageUrl ()
          self.elements.doc.location.href,

        get id () {
          let e = self.elements.illust.largeLink;
          if (!e)
            return null;

          let (v = e.getAttribute('data-url')) {  // pic.twitter
            if (v && v.match(/^https?:\/\/pbs\.twimg\.com\/media\/([^/]+?)\./))
              return RegExp.$1;
          };

          let (v = e.href) {  // ツイート
            if (v && v.match(/\/([^/]+)(?:\?|$)/))
              return RegExp.$1;
          };

          return null;
        },  // いずれも 'http://t.co/'+id で作品のページに飛べる

        get dateTime ()
          AnkUtils.decodeDateTimeText(self.elements.illust.datetime.title),

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
          self.info.illust.pageUrl,

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
          self.elements.illust.userName.getAttribute('data-user-id'),

        get pixivId ()
          self.elements.illust.userName.getAttribute('data-screen-name'),

        get name ()
          self.elements.illust.userName.getAttribute('data-name'),

        get memoizedName ()
          AnkBase.memoizedName(member.id, self.SERVICE_ID),
      };

      let path = {
        get initDir ()
          AnkBase.Prefs.get('initialDirectory.'+self.SITE_NAME),

        get ext () 
         (path.image.images[0].match(/(\.\w+)(?::large|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get image () {
          let m = [
            self.in.gallery                 ? self.elements.illust.mediumImage.src :
            self.elements.illust.photoFrame ? self.elements.illust.photoImage.src :
                                              self.elements.illust.mediumImage.parentNode.getAttribute('data-url')
          ];
          return { images: m, facing: null, };
        },
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}

    get downloadable () { // {{{
      if (self.in.gallery)
        return true;    // ポップアップしているならどこでもOK
      if (self.in.tweet && self.in.illustTweet)
        return true;    // ツイートページはイラストが存在しているときのみOK
      return false;     // 上記以外はNG
    }, // }}}

    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、以下の３つのメソッドは空のメソッドのままでＯＫ

    /*
     * 遅延インストールのためにクロージャに doc などを保存しておく
     */
    installMediumPageFunctions: function () { // {{{

      let installer = function () { // {{{
        function proc () { // {{{
          try {
            if (counter-- <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }

            // インストールに必用な各種要素
            try { // {{{
              var body = doc.getElementsByTagName('body')[0];
              var gallery = self.elements.illust.gallery;
              var tweet = self.elements.illust.tweet;
              var largeLink = self.elements.illust.largeLink;
              var photoFrame = self.in.tweet ? self.elements.illust.photoFrame : null;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            } // }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            let cond = self.in.illustGrid ? true :
                       photoFrame         ? self.elements.illust.photoImage :
                                            largeLink;
            if (!(body && cond)) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }

            // viewerは作らない

            // 保存済み表示
            if (!self.in.illustGrid) {
              AnkBase.insertDownloadedDisplayById(
                self.elements.illust.downloadedDisplayParent,
                self.info.illust.id,
                self.SERVICE_ID,
                self.info.illust.R18
              );
            }

            AnkUtils.dump('installed: '+self.SITE_NAME);
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
      // 実装しない（外部の画像サービスを使っていると、DOMの情報とillust_idを関連付けしづらいため）

      // ギャラリーの移動時に保存済み表示を行う
      let tw = self.elements.doc.querySelector('.tweet-inverted');
      if (tw && MutationObserver) {
        new MutationObserver(function (o) {
          if (!self.info.illust.id)
            return;
          AnkBase.insertDownloadedDisplayById(
            self.elements.illust.downloadedDisplayParent,
            self.info.illust.id,
            self.SERVICE_ID,
            self.info.illust.R18
          );
        }).observe(tw, {childList: true});
      }

      AnkUtils.dump('installed: '+self.SITE_NAME+' list');
    }, // }}}

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      // 実装しない（同上）
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
