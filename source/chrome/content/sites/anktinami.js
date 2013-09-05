
try {

  let self = {

    /********************************************************************************
    * 定数
    ********************************************************************************/

    URL:        'http://www.tinami.com/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'tinami.com',             // CSSの適用対象となるドメイン
    SERVICE_ID: 'TNM',                    // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Tinami',                 // ?site-name?で置換されるサイト名のデフォルト値


    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    in: { // {{{
      get site () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/[^/]*tinami\.com\//), // }}}

      get manga () // {{{
        AnkUtils.A(self.elements.illust.typeImages).some(function (v) v.src.match(/\/ma\.gif$/)), // }}}

      get medium () // {{{
        self.in.illustPage, // }}}

      get illustPage () // {{{
        AnkBase.currentLocation.match(/^https?:\/\/www\.tinami\.com\/view\//), // }}}

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
        get images ()
          let (e = query('.captify'))
            e ? [e] : queryAll('.viewbody > * > img'),

        get datetime ()
          query('.view_info'),

        get title ()
          query('.viewdata > h1 > span'),

        get comment ()
          query('.description'),

        get userName ()
          query('.prof > p > a > strong'),

        get memberLink ()
          query('.prof > p > a'),

        get tags ()
          queryAll('.tag > span'),

        get typeImages ()
          queryAll('.viewdata > p > img'),

        get postParams ()
          queryAll('#open_original_content > input'),

        // elements.illust中ではdownloadedDisplayParentのみankpixiv.jsから呼ばれるので必須、他はこのソース内でしか使わない

        get downloadedDisplayParent ()
          query('.description'),
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
          AnkBase.currentLocation.match(/www\.tinami\.com\/view\/([^/]+?)(?:\?|$)/)[1],

        get dateTime () {
          let dtext  = self.elements.illust.datetime.textContent;
          let m = dtext.match(/(\d+).+?(\d+).+?(\d+).+?(\d+):(\d+):/);
          let dd = new Date();
          if (m) {
            dd.setFullYear(parseInt(m[1]));
            dd.setMonth(parseInt(m[2])-1);
            dd.setDate(parseInt(m[3]));
            dd.setHours(parseInt(m[4]));
            dd.setMinutes(parseInt(m[5]));
          } else {
            AnkUtils.dump(self.SERVICE_ID+': unknown datetime format = '+dtext);
          }

          return {
            year: AnkUtils.zeroPad(dd.getFullYear(), 4),
            month: AnkUtils.zeroPad(dd.getMonth()+1, 2),
            day: AnkUtils.zeroPad(dd.getDate(), 2),
            hour: AnkUtils.zeroPad(dd.getHours(), 2),
            minute: AnkUtils.zeroPad(dd.getMinutes(), 2),
          };
        },

        get size ()
          null,

        get tags ()
          AnkUtils.A(self.elements.illust.tags).filter(function (e) AnkUtils.trim(e.textContent)),

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
          AnkUtils.trim(self.elements.illust.title.textContent),

        get comment ()
          AnkUtils.trim(self.elements.illust.comment.textContent),

        get R18 ()
          false,

      };

      let member = {
        get id ()
          self.elements.illust.memberLink.href.match(/\/profile\/(.+)(?:\?|$)/)[1],

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
          '.jpg',   // 読み込んでみないとわからないのでとりあえずjpgで

        get mangaIndexPage ()
          null,

        get image () {
          let images;
          if (self.in.manga) {
            // マンガの大サイズ画像はないらしい
            images = AnkUtils.A(self.elements.illust.images).map(function (e) e.src);
          } else {
            let params ='';
            AnkUtils.A(self.elements.illust.postParams).forEach(function (e) params += e.getAttribute('name')+'='+e.getAttribute('value')+'&');
            let html = AnkUtils.httpGET(self.info.illust.referer, self.info.illust.referer, params);
            let doc = AnkUtils.createHTMLDocument(html);

            // 大サイズ画像ページが取れないことがある（セッション切れとか？）ので、その場合はalert等したいが、とりあえずダウンロード無効までで
            images = AnkUtils.A(doc.querySelectorAll('img')).
              filter(function (e) e.src.match(/^https?:\/\/img\.tinami\.com\/illust\d*\/img\//)).
              map(function (e) e.src);
          }

          return { images: images, facing: null, };
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

        function proc () {
          try {
            if (--counter <= 0) {
              AnkUtils.dump('installation failed: '+self.SITE_NAME);
              return true;
            }
  
            try {
              var body = doc.getElementsByTagName('body');
              var images = self.elements.illust.images;
            } catch (e) {
              AnkUtils.dumpError(e);
              return true;
            }
  
            if (!((body && body.length>0) && (images && images.length>0))) {
              AnkUtils.dump('delay installation: '+self.SITE_NAME+' remains '+counter);
              return false;   // リトライしてほしい
            }
  
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

        let installer = function () {
          if (!proc())
            return;                 // 次回に続く

          if (timer) {
            clearInterval(timer);   // 今回で終了
            timer = null;
          }
        }

        //

        let doc = self.elements.doc;
        let counter = 20;
        let interval = 500;
        let timer = undefined;
        if (!proc())
          timer = setInterval(installer, interval);
      }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      function proc () {
        try {
          if (--counter <= 0) {
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

      let installer = function () {
        if (!proc())
          return;

        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }

      //

      let doc = self.elements.doc;
      let counter = 20;
      let interval = 500;
      let timer = undefined;
      if (!proc())
        timer = setInterval(installer, interval);
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
        ['td > p.capt + a', 1],                         // 一覧
        ['.title > .collection_form_checkbox + a', 1],  // コレクション
        ['.thumbs > li > ul > li > a', 1],              // 最近の投稿作品
      ].forEach(function ([selector, nTrackback]) {
        AnkUtils.A(target.node.querySelectorAll(selector)) .
          map(function (link) link.href && let (m = link.href.split(/\//)) m.length >= 2 && [link, m.pop()]) .
          filter(function (m) m) .
          forEach(function ([link, id]) {
            if (!(target.illust_id && target.illust_id != id))
              AnkBase.markBoxNode(AnkUtils.trackbackParentNode(link, nTrackback), id, self.SERVICE_ID, false);
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
