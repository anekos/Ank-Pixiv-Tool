
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
        return (self.info.illust.mangaPages > 1);
      }, // }}}

      get medium () { // {{{
        return self.in.illustPage;
      }, // }}}

      get illustPage () { // {{{
        return self.info.illust.pageUrl.match(/^https?:\/\/nijie\.info\/view\.php\?id=/);
      }, // }}}

      // 外から使ってはいけない

      get doujinPage () {
        return !!self.elements.illust.doujinHeader;  // under construction
      }
    }; // }}}

    self.elements = (function () { // {{{
      function query (q) {
        return self.elements.doc.querySelector(q)
      }

      function queryAll (q) {
        return self.elements.doc.querySelectorAll(q)
      }

      let illust =  {
        get datetime () {
          return query('div#view-honbun > p') ||
            query('div#created > p');
        },

        get title () {
          return query('#view-header > #view-left > .illust_title') ||
            query('p.title');
        },

        get comment () {
          return queryAll('div#view-honbun > p')[1] ||
            queryAll('div#dojin_text > p')[1];
        },

        get avatar () {
          return query('a.name > img');        // "同人"ページではimgが存在しない
        },

        get userName () {
          return query('a.name') ||
            query('div#dojin_left > div.right > p.text > a');
        },

        get memberLink () {
          return illust.userName;
        },

        get tags () {
          return query('div#view-tag') ||
            query('ul#tag');
        },

        get gallery () {
          return query('#gallery') ||
            query('#gallery_new');
        },

        get doujinHeader () {
          return query('#dojin_header');
        },

        get nuita () {
          return query('a#nuita');
        },

        get good () {
          return query('a#good');
        },

        get nextLink() {
          return query('a#nextIllust');
        },

        get prevLink() {
          return query('a#backIllust');
        },

        // require for AnkBase

        get downloadedDisplayParent () {
          return query('div#view-honbun') ||
            query('div#infomation');
        },

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper () {
          return query('#main');
        },

        get mediumImage () {
          return query('#gallery  > #gallery_open > #img_filter > a > img') ||  // "投稿イラスト"ページ
            query('.image > .dojin_gallery > img');                              // "同人"ページ
        },

        get ads () {
          let header1 = query('#header-Container');
          let header2 = query('#top');

          return ([]).concat(header1, header2);
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
          let tags = AnkUtils.A(elem.querySelectorAll('span.tag_name'))
                       .map(e => AnkUtils.trim(e.textContent))
                         .filter(s => s && s.length);
          if (tags.length > 0)
            return tags;

          return AnkUtils.A(elem.querySelectorAll('li > a'))
                   .map(e => AnkUtils.trim(e.textContent))
                     .filter(s => s && s.length);
        },

        get shortTags () {
          let limit = AnkBase.Prefs.get('shortTagsMaxLength', 8);
          return self.info.illust.tags.filter(it => (it.length <= limit));
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
          return self.info.path.image.images[0].match(/^https?:\/\/([^\/\.]+)\./i)[1];
        },

        get referer () {
          return self.in.doujinPage ? self.info.illust.pageUrl : self.elements.illust.mediumImage.parentNode.href;
        },

        get title () {
          return AnkUtils.trim(self.elements.illust.title.textContent);
        },

        get comment () {
          let e = self.elements.illust.comment;
          return e ? AnkUtils.textContent(e) : '';
        },

        get R18 () {
          return true;
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
          return self.elements.illust.memberLink.href.match(/id=(\d+)/)[1];
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
          return AnkUtils.getFileExtension(path.image.images.length > 0 && path.image.images[0]);
        },

        get mangaIndexPage () {
          return null;
        },

        get image () {
          return self._image;
        }
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

    URL:        'http://nijie.info/',   // イラストページ以外でボタンを押したときに開くトップページのURL
    DOMAIN:     'nijie.info',           // CSSの適用対象となるドメイン
    SERVICE_ID: 'NJE',                  // 履歴DBに登録するサイト識別子
    SITE_NAME:  'Nijie',                // ?site-name?で置換されるサイト名のデフォルト値 

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * このモジュールの対応サイトかどうか
     */
    isSupported: function (doc) {
      return doc.location.href.match(/^https?:\/\/nijie\.info\//);
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

      if (this.in.medium)
        return { illust_id:this.getIllustId(), service_id:this.SERVICE_ID };
    },

    /**
     * イラストID
     */
    getIllustId: function () {
      let m = this.curdoc.location.href.match(/id=(\d+)/);
      return m && parseInt(m[1], 10);
    },

    /**
     * ダウンロード実行
     */
    downloadCurrentImage: function (useDialog, debug) {
      let self = this;
      Task.spawn(function () {
        let image = yield self.getImageUrlAsync(AnkBase.Prefs.get('downloadOriginalSize', false));
        if (!image || image.images.length == 0) {
          window.alert(AnkBase.Locale.get('cannotFindImages'));
          return;
        }

        let context = new AnkContext(self);
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
      const IsIllust = /view\.php\?id=(\d+)/;
      const Targets = [
                        ['div.nijie > div.picture > p.nijiedao > a', 3],  // 通常の一覧
                        ['div.nijie > p.nijiedao > a', 2],                // "同人"の一覧
                        ['div.nijie-bookmark > p > a', 2],                // "ブックマーク"の一覧
                        ['#okazu_list > a', -1],                          // おかず
                        ['#carouselInner-view > ul > li > a', 1],         // "こんな絵でも"
                      ];

      return AnkBase.markDownloaded(IsIllust, Targets, false, this, node, force, ignorePref);
    }, // }}}

    /*
     * 評価する（10ptなら抜いた、未満ならいいね）
     */
    setRating: function (pt) { // {{{
      function proc (pt) {
        if (!self.in.medium)
          throw 'not in nijie illust page';
        if (pt < 1 || 10 < pt)
          throw 'out of range';
        let rating = pt >= 10 ? self.elements.illust.nuita :
                                self.elements.illust.good;
        if (rating)
          rating.click();
      }

      var self = this;
      var doc = this.curdoc;

      return proc(pt);
    },

    /********************************************************************************
     * 
     ********************************************************************************/

    /**
     * 画像URLリストの取得
     */
    getImageUrlAsync: function (mangaOriginalSizeCheck) {

      let self = this;

      return Task.spawn(function* () {

        // 取得済みならそのまま返す
        if (self._image && self._image.images.length > 0)
          return self._image;

        function setSelectedImage (image) {
          self._image = image;
          return image;
        }

        let m = [];

        if (self.in.doujinPage) {
          m.push(self.elements.illust.mediumImage.src); // "同人"の場合は表紙をリストに追加
          AnkUtils.A(self.elements.illust.gallery.querySelectorAll('a')).forEach(v => m.push(v.href));
        }
        else {
          AnkUtils.A(self.elements.illust.gallery.querySelectorAll('a > img')).
            forEach(function (v) {
              m.push(v.src.replace((m.length == 0 ? /\/main\// : /\/small_light.+?\//),'/'));
            });
        }

        return setSelectedImage({ images: m, facing: null });
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

        // 完全に読み込まれていないっぽいときは、遅延する
        if (!(body && wrapper && medImg)) { // {{{
          return false;   // リトライしてほしい
        } // }}}

        let addMiddleClickEventListener = function () {
          if (useViewer)
            self.viewer = new AnkViewer(self);

          let useCapture = useViewer;

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

                self._image = image;

                if (useViewer)
                  self.viewer.openViewer();
                if (useClickDownload)
                  AnkBase.downloadCurrentImageAuto(self);
              }).then(null).catch(e => AnkUtils.dumpError(e,true));

              if (useCapture) {
                e.preventDefault();
                e.stopPropagation();
              }
            },
            useCapture
          );
        };

        let addRatingEventListener = function () {
          [
            self.elements.illust.nuita,
            self.elements.illust.good
          ].forEach(function (e) {
            if (e)
              e.addEventListener('click', () => AnkBase.downloadCurrentImageAuto(self), true);
          });
        };

        let markRecommended = function () {
          let elm = doc.querySelector('#carouselInner-view');
          if (elm && MutationObserver) {
            new MutationObserver(function (o) {
              o.forEach(e => self.markDownloaded(e.target, true));
            }).observe(elm, {childList: true});
          }
        };

        // 中画像クリック
        let useViewer = AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true);
        let useClickDownload = AnkBase.Prefs.get('downloadWhenClickMiddle', false);
        if (useViewer || useClickDownload)
          addMiddleClickEventListener();

        // レイティング("抜いた","いいね")によるダウンロード
        if (AnkBase.Prefs.get('downloadWhenRate', false))
          addRatingEventListener();

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        // こんな絵でも…にマーキング
        self.markDownloaded(doc,true);

        // おすすめのイラストにマーキング
        markRecommended();

        return true;
      }; // }}}

      var self = this;
      var doc = this.curdoc;

      // install now
      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {

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
      return AnkBase.delayFunctionInstaller(delayMarking, 500, 20, self.SITE_NAME, 'delayMarking');
    } // }}}

  };

  // --------
  global["SiteModule"] = AnkPixivModule;

})(this);