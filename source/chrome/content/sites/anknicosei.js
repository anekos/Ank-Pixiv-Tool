
Components.utils.import("resource://gre/modules/Task.jsm");

(function (global) {

  let AnkPixivModule = function (doc) {

    var self = this;

    self.curdoc = doc;

    self.viewer;

    self.marked = false;

    self._functionsInstalled = false;

    self._image;

    /********************************************************************************
    * プロパティ
    ********************************************************************************/

    self.in = { // {{{
      get manga () {// {{{
        return self.info.illust.pageUrl.match(/seiga\.nicovideo\.jp\/watch\/mg/);
      }, // }}}

      get medium () { // {{{
        return self.in.illustPage;
      }, // }}}

      get illustPage () { // {{{
        return self.in.manga
          ||
          self.info.illust.pageUrl.match(/seiga\.nicovideo\.jp\/seiga\/im/);
      } // }}}
    }; // }}}

    self.elements = (function () { // {{{
      function query (q) {
        return self.elements.doc.querySelector(q);
      }

      function queryAll (q) {
        return self.elements.doc.querySelectorAll(q);
      }

      let illust =  {
        get images () {
          return self.in.manga && queryAll('#page_contents > .page img');
        },

        get datetime () {
          return self.in.manga && query('.created')
            ||
            query('.inner.cfix > .other_info > .date')  // seiga
            ||
            query('.bold');                             // shunga
        },

        get title () {
          return self.in.manga && queryAll('.title > h1 > *')
            ||
            query('.inner.cfix > .title')               // seiga
            ||
            query('.title_text');                       // shunga
        },

        get comment () {
          return self.in.manga && query('.description > .full')
            ||
            query('.inner.cfix > .discription')         // seiga
            ||
            query('.illust_user_exp');                  // shunga
        },

        get avatar () {
          return !self.in.manga && query('.illust_user_icon > a > img');
        },

        get userName () {
          return self.in.manga && query('.author_name')
            ||
            query('.user_name > strong')                // seiga
            ||
            query('.illust_user_name > a > strong');    // shunga
        },

        get memberLink () {
          return self.in.manga && null
            ||
            query('.user_link > a')                     // seiga
            ||
            query('.illust_user_name > a');             // shunga
        },

        get tags () {
          return query('.illust_tag.cfix.static')      // seiga
            ||
            query('#tag_block');                        // shunga & manga
        },

        get illustType () {
          return query('.illust_type > a');
        },

        get flvPlayer () {
          return self.in.manga && query('#main > #player');
        },

        // require for AnkBase

        get autoPagerizeTarget() {
          return query('.illust_list')               // ○○さんのｲﾗｽﾄ
            ||
            query('.my_contents .list');              // イラスト定点観測
        },

        get downloadedDisplayParent () {
          return self.in.manga && query('.title')
            ||
            query('.other_info')                        // seiga
            ||
            query('.exp_header > .info');
        },

        // require for AnkBase.Viewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper () {
          return query('#main');
        },

        get mediumImage () {
          return self.in.manga && self.elements.illust.images[0]
            ||
            query('#illust_link');
        },

/* future use.
        get openComment ()
          query('.fc_blk'),
*/

        get ads () {
          let ads = [] ;
          ['#siteHeaderInner','#header_cnt','.content_right'].
            forEach(function (v) {
              let e = query(v);
              if (e)
                ads.push(e);
            });

          return ads;
        }
      };

      return {
        illust: illust,
        get doc () {
          return self.curdoc;
        }
      };
    })(); // }}}

    self.info = (function () { // {{{
      let illust = {
        get pageUrl () {
          return self.elements.doc.location.href;
        },

        get id () {
          return self.getIllustId();
        },

        get dateTime () {
          return AnkUtils.decodeDateTimeText(self.elements.illust.datetime.textContent);
        },

        get size () {
          return null;
        },

        get tags () {
          let elem = self.elements.illust.tags;
          if (!elem)
            return [];

          let tags = AnkUtils.A(elem.querySelectorAll('.tag'))
            .map(e => AnkUtils.trim(e.textContent))
            .filter(s => s && s.length);
          return tags;
        },

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(it => it.length <= limit);
        },

        get tools () {
          return null;
        },

        get width () {
          return 0;
        },

        get height () {
          return 0;
        },

        get server () {
          if (!self.elements.illust.flvPlayer)
            return self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1];
        },

        get referer () {
          return self.info.path.referer || self.info.illust.pageUrl;
        },

        get title () {
          if (self.in.manga) {
            let title = self.elements.illust.title[0].textContent;
            let episode = self.elements.illust.title[1].textContent;
            return title+' '+episode;
          }
          else {
            return AnkUtils.trim(self.elements.illust.title.textContent);
          }
        },

        get comment () {
          let e = self.elements.illust.comment;
          return e ? AnkUtils.textContent(e) : '';
        },

        get R18 () {
          let e = self.elements.illust.illustType;
          return e && !!e.href.match(/\/shunga\//);
        },

        get mangaPages () {
          return self.info.path.image.images.length;
        },

        get worksData () {
          return null;
        }
      };

      let member = {
        get id () {
          if (self.in.manga) {
            if (self.elements.illust.memberLink)
              return self.elements.illust.memberLink.href.match(/\/manga\/list\?user_id=(.+?)(?:$|\?)/)[1];
            return member.name;
          }
          else {
            return self.elements.illust.memberLink.href.match(/\/user\/illust\/(.+?)(?:$|\?)/)[1]; 
          }
        },

        get pixivId () {
          return member.id;
        },

        get name () {
          return AnkUtils.trim(self.elements.illust.userName.textContent);
        },

        get memoizedName () {
          return null;
        }
      };

      let path = {
        get initDir () {
          return AnkBase.Prefs.get('initialDirectory.' + self.SITE_NAME);
        },

        get ext () {
          if (!self.elements.illust.flvPlayer)
            return AnkUtils.getFileExtension(path.image.images.length > 0 && path.image.images[0]);
        },

        get mangaIndexPage () {
          return null;
        },

        get image () {
          return self._image;
        },

        referer: null
      };

      return {
        illust: illust,
        member: member,
        path: path
      };
    })(); // }}}

  };

  AnkPixivModule.prototype = {

    /********************************************************************************
     * 定数
     ********************************************************************************/

    URL:        'http://seiga.nicovideo.jp/', // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'nicovideo.jp',               // CSSの適用対象となるドメイン
    SERVICE_ID: 'NCS',                        // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Nicosei',                    // ?site-name?で置換されるサイト名のデフォルト値 

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * このモジュールの対応サイトかどうか
     */
    isSupported: function (doc) {
      return doc.location.href.match(/^https?:\/\/seiga\.nicovideo\.jp\/(?:seiga|shunga|watch|comic|search|tag|my|user\/illust|illust\/(?:ranking|list))(?:\/|\?|$)/);
    },

    /**
     * ファンクションのインストール
     */
    initFunctions: function () {
      if (this._functionsInstalled)
        return;

      this._functionsInstalled = true;

      if (this.in.medium) {
        this.installMediumPageFunctions();
      }
      else {
        this.installListPageFunctions();
      }
    },

    /**
     * ダウンロード可能か
     */
    isDownloadable: function () {
      if (!this._functionsInstalled)
        return false;

      if (this.in.medium && this.elements.illust.flvPlayer)
        return false;    // ニコニコ形式マンガはDL対象外

      return { illust_id:this.getIllustId(), service_id:this.SERVICE_ID };
    },

    /**
     * イラストID
     */
    getIllustId: function () {
      return this.in.manga && this.curdoc.location.href.match(/\/watch\/(mg\d+)/)[1] ||
                              this.curdoc.location.href.match(/\/seiga\/(im\d+)/)[1];
    },

    /**
     * ダウンロード実行
     */
    downloadCurrentImage: function (useDialog, debug) {
      let self = this;
      Task.spawn(function () {
        let image = yield self.getImageUrlAsync();
        if (!image || image.images.length == 0) {
          window.alert(AnkBase.Locale.get('cannotFindImages'));
          return;
        }

        let context = new AnkBase.Context(self);
        let ev = AnkBase.createDownloadEvent(context, useDialog, debug);
        window.dispatchEvent(ev);
      }).then(null).catch(e => AnkUtils.dumpError(e,true));
    },

    /*
     * ダウンロード済みイラストにマーカーを付ける
     *    node:     対象のノード (AutoPagerize などで追加されたノードのみに追加するためにあるよ)
     *    force:    追加済みであっても、強制的にマークする
     */
    markDownloaded: function (node, force, ignorePref) { // {{{
      const IsIllust = /\/([^/]+?)(?:\?|$)/;
      const Targets = [
                        ['li.list_item > a', 1],                       // ○○さんのイラスト
                        ['div.illust_thumb > div > a', 2],             // マイページ
                        ['.episode_item > .episode > .thumb > a', 3],  // マンガ一覧
                        ['div.illust_list_img > div > a', 2],          // 検索結果
                        ['.list_item_cutout > a', 1],                  // イラストページ（他のイラスト・関連イラストなど）
                        ['.ranking_image > div > a', 2],               // イラストランキング
                        ['.center_img > a', 1],                        // 春画ページ（他のイラスト・関連イラストなど）
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, true, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する
     */
    setRating: function () { // {{{
      return true;
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * 画像URLリストの取得
     */
    getImageUrlAsync: function () {

      let self = this;

      return Task.spawn(function* () {

        // 取得済みならそのまま返す
        if (self._image && self._image.images.length > 0)
          return self._image;

        function setSelectedImage(image) {
          self._image = image;
          return image;
        }

        // マンガの大サイズ画像はないらしい
        if (self.in.manga) {
          let images = AnkUtils.A(self.elements.illust.images).filter(e => !!e.getAttribute('data-original')).map(e => e.getAttribute('data-original'));
          if (images.length == 0)
            return null;

          return setSelectedImage({images: images, facing: null});
        }

        let status = yield AnkUtils.remoteFileExistsAsync(self.elements.illust.mediumImage.href, self.curdoc.location.href);
        if (status) {
          if (status.type.match(/^image\//))
            return setSelectedImage({images: [status.url], facing: null});

          let html = yield AnkUtils.httpGETAsync(status.url, status.referer);
          let doc = AnkUtils.createHTMLDocument(html);
          let src = doc.querySelector('.illust_view_big').getAttribute('data-src');
          let href = status.url.replace(/^(https?:\/\/.+?)(?:\/.*)$/, "$1") + src;
          return setSelectedImage({images: [href], facing: null});
        }
      });
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /*
     * イラストページにviewerやダウンロードトリガーのインストールを行う
     */
    installMediumPageFunctions: function () { // {{{

      let proc = function () { // {{{
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;
        var flvPlayer = self.elements.illust.flvPlayer;

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && wrapper && (medImg || flvPlayer))) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        // ニコニコ形式マンガはDL対象外
        if (flvPlayer) {
          return true;
        }

        function createDebugMessageArea() {
        }

        function addMiddleClickEventListener () {
          if (useViewer)
            self.viewer = new AnkBase.Viewer(self);

          medImg.addEventListener(
            'click',
            function (e) {
              Task.spawn(function () {
                // mangaIndexPageへのアクセスが複数回実行されないように、getImageUrlAsync()を一度実行してからopenViewer()とdownloadCurrentImageAuto()を順次実行する
                let image = yield self.getImageUrlAsync();
                if (!image || image.images.length == 0) {
                  window.alert(AnkBase.Locale.get('cannotFindImages'));
                  return;
                }

                if (useViewer)
                  self.viewer.openViewer();
                if (useClickDownload)
                  AnkBase.downloadCurrentImageAuto(self);
              }).then(null).catch(e => AnkUtils.dumpError(e,true));

              e.preventDefault();
              e.stopPropagation();
            },
            true
          );
        }

        function addRatingEventListener () {
          if (!AnkBase.Prefs.get('downloadWhenRate', false))
            return;

          [
            '#clip_add_button',
            '.mylist_area > a',
            '.mylist_area > a+a',
            '.favorites_navigator > .favorite'
          ].forEach(function (v) {
            let e = doc.querySelector(v);
            if (e)
              e.addEventListener(
                'click',
                () => AnkBase.downloadCurrentImageAuto(self),
                true
              );
          });
        }

        /*
         * 
         */

        // デバッグ用
        if (AnkBase.Prefs.get('showDownloadedFilename', false))
          createDebugMessageArea();

        // 中画像クリック
        let useViewer = AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true);
        let useClickDownload = AnkBase.Prefs.get('downloadWhenClickMiddle', false);
        if (useViewer || useClickDownload)
          addMiddleClickEventListener();

        // レイティング("クリップ","マイリスト登録","とりあえず一発登録",""お気に入り登録)によるダウンロード
        if (AnkBase.Prefs.get('downloadWhenRate', false))
          addRatingEventListener();

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        // 他のイラスト・関連イラストなどにマーキング
        self.markDownloaded(doc,true);

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

      let autoPagerize = function () {
        var aptarget = self.elements.illust.autoPagerizeTarget;

        if (!(doc && aptarget)) {
          return false;     // リトライしてほしい
        }

        // AutoPagerizeによる継ぎ足し動作
        // TODO サイト別.jsに個別に書くのはよくない気がする
        doc.addEventListener(
          'AutoPagerize_DOMNodeInserted',
          function (e) {
            let a;
            [
             'div.illust_thumb',        // イラスト定点観測
             'li.list_item',            // ○○さんのイラスト
            ] .
              some(function (q) {
                let n = e.target.querySelectorAll(q);
                return n && n.length > 0 && !!(a = n);
              });
            if (a)
              setTimeout(
                function() {
                  AnkUtils.A(a) .
                    forEach(node => self.markDownloaded(node, true));
                },
                500     // ボックスの高さが確定するまでマーキングを遅延させる。値は適当
              );
          },
          false
        );

        return true;
      };

      let delayMarking = function () {
        var body = self.elements.illust.body;

        if (!(body && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        self.markDownloaded(doc,true);

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      // install now
      AnkBase.delayFunctionInstaller(autoPagerize, 500, 20, self.SITE_NAME, 'autoPagerize');
      AnkBase.delayFunctionInstaller(delayMarking, 500, 20, self.SITE_NAME, 'delayMarking');
    } // }}}

  };

  // --------
  global["SiteModule"] = AnkPixivModule;

})(this);