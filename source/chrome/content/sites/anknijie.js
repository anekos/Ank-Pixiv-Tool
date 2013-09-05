
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://nijie.info/',   // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'nijie.info',           // CSSの適用対象となるドメイン
    SERVICE_ID: 'NJE',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Nijie',                // ?site-name?で置換されるサイト名のデフォルト値 


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/nijie\.info\//), // }}}

      get manga () // {{{
        (self.info.illust.mangaPages > 1), // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/nijie\.info\/view\.php\?id=/), // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      function query (q)
        self.elements.doc.querySelector(q);

      function queryAll (q)
        self.elements.doc.querySelectorAll(q);

      let illust =  {
        get mediumImage ()
          query('img#view_img') ||      // "投稿イラスト"ページ
          query('p.image > img'),       // "同人"ページ

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


        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('div#view-honbun') ||
          query('div#infomation'),

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
        get doc () window.content.document
      };
    })(), // }}}

    info: (function () { // {{{
      let illust = {
        get id ()
          AnkBase.currentLocation.match(/id=(\d+)/)[1],

        get dateTime () {
          let m = self.elements.illust.datetime.textContent.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)
          if (!m)
            return null;

          return {
            year: AnkUtils.zeroPad(m[1], 4),
            month: AnkUtils.zeroPad(m[2], 2),
            day: AnkUtils.zeroPad(m[3], 2),
            hour: AnkUtils.zeroPad(m[4], 2),
            minute: AnkUtils.zeroPad(m[5], 2),
          };
        },

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
          AnkBase.currentLocation,

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
      function delay (msg, e) { // {{{
        if (installTryed == 10) {
          AnkUtils.dump(msg);
          if (e)
            AnkUtils.dumpError(e, AnkBase.Prefs.get('showErrorDialog'));
        }
        if (installTryed >= 20)
          return;
        setTimeout(installer, installInterval);
        installTryed++;
        AnkUtils.dump('tried: ' + installTryed);
      } // }}}

      // closure {{{
      let installInterval = 500;
      let installTryed = 0;
      let doc = self.elements.doc;
      // }}}

      let installer = function () { // {{{
        try {
          // インストールに必用な各種要素
          try { // {{{
            var body = doc.getElementsByTagName('body');
            var wrapper = doc.getElementById('main');
            var medImg = self.elements.illust.mediumImage;
            var openComment = doc.querySelector('p.open');
            var noComment = doc.querySelector('div.co2') || doc.querySelector('div#dojin_comment');
          } catch (e) {
            return delay("delay installation by error", e);
          } // }}}

          // 完全に読み込まれていないっぽいときは、遅延する
          if (!((body && body.length>0) && wrapper && medImg && (openComment || noComment))) // {{{
            return delay("delay installation by null");
          // }}}

          // 大画像関係
          if (AnkBase.Prefs.get('largeOnMiddle', true)) {
            new AnkViewer(
              self,
              body[0],
              wrapper,
              openComment,
              null,
              function () self.info.path.image.images
            );
          }

          // 中画像クリック時に保存する
          if (AnkBase.Prefs.get('downloadWhenClickMiddle')) { // {{{
            medImg.addEventListener(
              'click',
              function (e) {
                AnkBase.downloadCurrentImageAuto();
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
                    AnkBase.downloadCurrentImageAuto();
                  },
                  true
                );
              }
            });
          })(); // }}}

          // 保存済み表示
          AnkBase.insertDownloadedDisplayById(
            self.elements.illust.downloadedDisplayParent,
            self.info.illust.id,
            self.SERVICE_ID,
            self.info.illust.R18
          );

          // コメント欄を開く
          if (openComment && AnkBase.Prefs.get('openComment', false)) // {{{
            setTimeout(function () openComment.click(), 1000);
          // }}}

          AnkUtils.dump('installed: '+self.SITE_NAME);

        } catch (e) {
          AnkUtils.dumpError(e);
        }
      }; // }}}

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
      const IsIllust = /view\.php\?id=(\d+)/;

      let target = AnkBase.getMarkTarget(self, node, force, ignorePref);
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
