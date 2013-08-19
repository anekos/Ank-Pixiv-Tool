
try {

  AnkNijie = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://nijie.info/',   // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'nijie.info',           // CSSの適用対象となるドメイン
    SERVICE_ID: 'NJE',                  // 履歴DBに登録するサイト識別子


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkPixiv.currentLocation.match(/^https?:\/\/nijie\.info\//), // }}}

      get manga () // {{{
        (AnkNijie.info.illust.mangaPages > 1), // }}}

      get medium () // {{{
        AnkNijie.in.illustPage, // }}}

      get illustPage () // {{{
        AnkPixiv.currentLocation.match(/^https?:\/\/nijie\.info\/view\.php\?id=/), // }}}

      get myPage ()
        false,  // under construction

      get myIllust ()
        false,  // under construction
    }, // }}}

    elements: (function () { // {{{
      let illust =  {
        get mediumImage ()
          AnkNijie.elements.doc.querySelector('img#view_img') ||      // "投稿イラスト"ページ
          AnkNijie.elements.doc.querySelector('p.image > img'),       // "同人"ページ

        get datetime ()
          AnkNijie.elements.doc.querySelector('div#view-honbun > p') ||
          AnkNijie.elements.doc.querySelector('div#created > p'),

        get title ()
          AnkNijie.elements.doc.querySelector('div#view-header > div#view-left > p') ||
          AnkNijie.elements.doc.querySelector('p.title'),

        get comment ()
          AnkNijie.elements.doc.querySelectorAll('div#view-honbun > p')[1] ||
          AnkNijie.elements.doc.querySelectorAll('div#dojin_text > p')[1],

        get avatar ()
          AnkNijie.elements.doc.querySelector('a.name > img'),        // "同人"ページではimgが存在しない

        get userName ()
          AnkNijie.elements.doc.querySelector('a.name') ||
          AnkNijie.elements.doc.querySelector('div#dojin_left > div.right > p.text > a'),

        get memberLink ()
          illust.userName,

        get tags ()
          AnkNijie.elements.doc.querySelector('div#view-tag') ||
          AnkNijie.elements.doc.querySelector('ul#tag'),

        get gallery ()
          AnkNijie.elements.doc.querySelector('div#gallery'),         // 両ページ共通

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          AnkNijie.elements.doc.querySelector('div#view-honbun') ||
          AnkNijie.elements.doc.querySelector('div#infomation'),
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
      let service = {
        get id ()
          AnkNijie.SERVICE_ID,

        get url ()
          AnkNijie.URL,

        get initDir ()
          AnkPixiv.Prefs.get('initialDirectory.Nijie') || AnkPixiv.Prefs.get('initialDirectory'),
      };

      let illust = {
        get id ()
          AnkPixiv.currentLocation.match(/id=(\d+)/)[1],

        get dateTime ()
          AnkNijie.info.illust.worksData.dateTime,

        get size ()
          AnkNijie.info.illust.worksData.size,

        get tags () {
          let elem = AnkNijie.elements.illust.tags;
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
          let limit = AnkPixiv.Prefs.get('shortTagsMaxLength', 8);
          return AnkNijie.info.illust.tags.filter(function (it) (it.length <= limit));
        },

        get tools ()
          null,

        get width ()
          0,

        get height ()
          0,

        get server ()
          AnkNijie.info.path.images[0].match(/^http:\/\/([^\/\.]+)\./i)[1],

        get referer ()
          AnkPixiv.currentLocation,

        get title ()
          AnkUtils.trim(AnkNijie.elements.illust.title.textContent),

        get comment ()
          let (e = AnkNijie.elements.illust.comment)
            (e ? AnkUtils.textContent(e) : ''),

        get R18 ()
          true,

        get mangaPages ()
          AnkNijie.info.illust.worksData.mangaPages,

        get worksData () {
          let zp = AnkUtils.zeroPad;
          let result = {};

          let m = AnkNijie.elements.illust.datetime.textContent.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+):(\d+)/)
          if (m) {
            result.dateTime = {
              year: zp(m[1], 4),
              month: zp(m[2], 2),
              day: zp(m[3], 2),
              hour: zp(m[4], 2),
              minute: zp(m[5], 2),
            };
          }

          result.mangaPages = AnkNijie.info.path.images.length;

          return result;
        }
      };
      'year month day hour minute'.split(/\s+/).forEach(function (name) {
        illust.__defineGetter__(name, function () illust.dateTime[name]);
      });

      let member = {
        get id ()
          AnkNijie.elements.illust.memberLink.href.match(/id=(\d+)/)[1],

        get pixivId ()
          member.id,

        get name ()
          AnkUtils.trim(AnkNijie.elements.illust.userName.textContent),

        get memoizedName ()
          AnkPixiv.memoizedName,
      };

      let path = {
        get ext ()
          (path.images[0].match(/(\.\w+)(?:$|\?)/)[1] || '.jpg'),

        get mangaIndexPage ()
          null,

        get images () {
          let sm = AnkUtils.A(AnkNijie.elements.illust.gallery.querySelectorAll('a'));
          let m = [];

          if (sm.filter(function (v) v.href.match(/dojin_main/)).length > 0)
            m.push(AnkNijie.elements.illust.mediumImage.src); // "同人"の場合は表紙をリストに追加

          sm.forEach(function (v) {
            m.push(v.href);
          });
          return m;
        }
        
      };

      return {
        service: service,
        illust: illust,
        member: member,
        path: path
      };
    })(), // }}}


    /********************************************************************************
    * ダウンロード＆ファイル関連
    ********************************************************************************/

    // ボタン押下でのダウンロードまでの実装であれば、methods内の３つのメソッドは空のメソッドのままでＯＫ

    methods: { // {{{
      /*
       * 遅延インストールのためにクロージャに doc などを保存しておく
       */
      installMediumPageFunctions: function () { // {{{
        function delay (msg, e) { // {{{
          if (installTryed == 10) {
            AnkUtils.dump(msg);
            if (e)
              AnkUtils.dumpError(e, AnkPixiv.Prefs.get('showErrorDialog'));
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
        let doc = AnkNijie.elements.doc;
        // }}}

        let installer = function () { // {{{
          try {
            // インストールに必用な各種要素
            try { // {{{
              var body = doc.getElementsByTagName('body')[0];
              var medImg = AnkNijie.elements.illust.mediumImage;
              var openComment = doc.querySelector('p.open');
              var noComment = doc.querySelector('div.co2') || doc.querySelector('div#dojin_comment');
            } catch (e) {
              return delay("delay installation by error", e);
            } // }}}

            // 完全に読み込まれていないっぽいときは、遅延する
            if (!(body && medImg && (openComment || noComment))) // {{{
              return delay("delay installation by null");
            // }}}

            // ニジエはデフォルトのviewerがあるので独自viewerはいらないと思う(fitは欲しいけど…)

            // 中画像クリック時に保存する
            if (AnkPixiv.Prefs.get('downloadWhenClickMiddle')) { // {{{
              medImg.addEventListener(
                'click',
                function (e) {
                  AnkPixiv.downloadCurrentImageAuto();
                },
                true
              );
            } // }}}

            // レイティング("抜いた","いいね")によるダウンロード
            (function () { // {{{
              if (!AnkPixiv.Prefs.get('downloadWhenRate', false))
                return;

              ['a#nuita','a#good'].forEach(function (v) {
                let e = doc.querySelector(v)
                if (e) {
                  e.addEventListener(
                    'click',
                    function () {
                      AnkPixiv.downloadCurrentImageAuto();
                    },
                    true
                  );
                }
              });
            })(); // }}}

            // 保存済み表示
            if (AnkPixiv.isDownloaded(AnkNijie.info.illust.id,AnkNijie.info.service.id)) { // {{{
              AnkPixiv.insertDownloadedDisplay(
                  AnkNijie.elements.illust.downloadedDisplayParent,
                  AnkNijie.info.illust.R18
              );
            } // }}}

            // コメント欄を開く
            if (openComment && AnkPixiv.Prefs.get('openComment', false)) // {{{
              setTimeout(function () openComment.click(), 1000);
            // }}}

            // 最大イラストIDの変更
            let (illust_id = AnkNijie.info.illust.id) { // {{{
              if (AnkPixiv.Prefs.get('maxIllustId', AnkPixiv.MAX_ILLUST_ID) < illust_id) {
                AnkPixiv.Prefs.set('maxIllustId', illust_id);
              }
            } // }}}

            AnkUtils.dump('installed: nijie');
          } catch (e) {
            AnkUtils.dumpError(e);
          }
        }; // }}}

        return installer();
      }, // }}}

      /*
       * ダウンロード済みイラストにマーカーを付ける
       *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
       *    force:    追加済みであっても、強制的にマークする
       */
      markDownloaded: function (node, force, ignorePref) { // {{{
        const IsIllust = /view\.php\?id=(\d+)/;

        function trackbackParentNode (node, n) {
          for (let i = 0; i< n; i++)
            node = node.parentNode;
          return node;
        }

        if (AnkNijie.in.medium || !AnkNijie.in.site)
          return;

        if (!AnkPixiv.Prefs.get('markDownloaded', false) && !ignorePref)
          return;

        if (!force && AnkPixiv.Store.document.marked)
          return;

        AnkPixiv.Store.document.marked = true;

        if (!node)
          node = AnkNijie.elements.doc;

        [
          ['div.nijie > div.picture > p.nijiedao > a', 3],  // 通常の一覧
          ['div.nijie > p.nijiedao > a', 2],                // "同人"の一覧
          ['div.nijie-bookmark > p > a', 2],                // "ブックマーク"の一覧
        ].forEach(function ([selector, nTrackback]) {
          AnkUtils.A(node.querySelectorAll(selector)) .
            map(function (link) link.href && let (m = IsIllust.exec(link.href)) m && [link, m]) .
            filter(function (m) m) .
            map(function ([link, m]) [link, parseInt(m[1], 10)]) .
            forEach(function ([link, id]) {
              if (!AnkPixiv.isDownloaded(id,AnkNijie.SERVICE_ID))
                return;
              let box = trackbackParentNode(link, nTrackback);
              if (box)
                box.className += ' ' + AnkPixiv.CLASS_NAME.DOWNLOADED;
            });
        });
      }, // }}}

      /*
       * remoteFileExists 用のクッキーをセットする
       */
      setCookies: function () {
        // under construction
      }, // }}}
    }, // }}}

  };

} catch (error) {
 dump("[" + error.name + "]\n" +
      "  message: " + error.message + "\n" +
      "  filename: " + error.fileName + "\n" +
      "  linenumber: " + error.lineNumber + "\n" +
      "  stack: " + error.stack + "\n");
}
