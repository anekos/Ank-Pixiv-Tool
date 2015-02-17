
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
      get manga () { // {{{
        return (!!self.elements.illust.slideshowFrame || !!self.elements.illust.photoFrame);
      }, // }}}

      get medium () { // {{{
        return self.in.illustPage;
      }, // }}}

      get illustPage () { // {{{
        return self.info.illust.pageUrl.match(/^https?:\/\/[^/]+?\.tumblr\.com\/post\//) &&
          (!!self.elements.illust.mediumImage || !!self.elements.illust.photoFrame);
      }, // }}}

      get listPage () {
        return self.info.illust.pageUrl.match(/\/archive$/);
      }
    }; // }}}

    self.elements = (function () { // {{{
      function query (q) {
        return self.elements.doc.querySelector(q);
      }

      function queryAll (q) {
        return self.elements.doc.querySelectorAll(q);
      }

      // 画像の面積を返す
      // XXX 過度に長細いものなどは、1 とかにするほうがいいかも…
      function getImageSize (e) {
        return ((e.offsetHeight || 1) * (e.offsetWidth || 1));
      }

      function getLargestImage () {
        let maxSize = 0, maxElement = null;

        for (let root of Array.slice(arguments)) {
          if (!root)
            continue;
          for (let it of root.querySelectorAll('img')) {
            let size = getImageSize(it);
            if (maxSize < size) {
              maxSize = size;
              maxElement = it;
            }
          }
        }

        return maxElement;
      }

      let illust =  {
        get date () {
          return query('.date > a') ||
            query('.date') ||
            query('.postmeta > a') ||
            query('.post-date a') ||
            query('.post-date');
        },


        get title () {
          return query('.copy > p') ||
            query('.caption > p') ||
            query('.post > p+p') ||
            query('.photo > p+p');
        },

        get userName () {
          return query('.footer-content > h5') ||
            query('#header > h1 > a');
        },

        get memberLink () {
          let e = query('#header > * > .profile-image');
          return e && e.parentNode;
        },

        get photoFrame () {
          return query('iframe.photoset');
        },

        get photoImage () {
          return illust.photoFrame && illust.photoFrame.contentDocument.querySelector('.photoset_row img');
        },

        get photoSet () {
          return illust.photoFrame && illust.photoFrame.contentDocument.querySelectorAll('.photoset_row img');
        },

        get slideshowFrame () {
          return query('.type-photoset');
        },

        get slideshowImage () {
          let e = illust.slideshowFrame;
          return e && e.querySelector('.photo-data img');
        },

        get slideshowSet () {
          let e = illust.slideshowFrame;
          return e && e.querySelectorAll('.photo-data img');
        },

        get archiveContent () {
          return query('.l-content');
        },

        // require for AnkBase

        get downloadedDisplayParent () {
          return query('.caption > p') ||
            query('.panel .post-date a') ||
            query('.post-panel .date a');
        },

        // require for AnkViewer

        get body () {
          let e = queryAll('body');
          return e && e.length > 0 && e[0];
        },

        get wrapper () {
          return query('.container.section') ||
            query('#newDay') ||
            query('#page') ||
            query('body');
        },

        get mediumImage () {
          if (illust.slideshowFrame)
            return illust.slideshowImage;
          if (illust.photoFrame)
            return illust.photoImage;
          return getLargestImage(query('.post'), query('.photo'));
        },

        get ads () {
          const Ads = [
                       '#header',
                       '#fb-root',
                       '.nav-menu-wrapper',
                       '.nav-menu-bg',
                       '.header-wrapper',
                       ];

          let a = [];
          Ads.forEach(q => AnkUtils.A(queryAll(q)).forEach(e => a.push(e)));
          return a;
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
          let dt = [ self.elements.illust.title, self.elements.illust.date ].filter(e => !!e).map(e => e.textContent);
          dt.push('cannot find datetime');
          return AnkUtils.decodeDateTimeText(dt);
        },

        get size () {
          return null;
        },

        get tags () {
          return [];
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
          return null;
        },

        get referer () {
          return self.info.illust.pageUrl;
        },

        get title () {
          let e = self.elements.illust.title;
          return e && AnkUtils.trim(e.textContent) || '';
        },

        get comment () {
          return illust.title;
        },

        get R18 () {
          return !!self.info.illust.pageUrl.match(/\.tumblr\.com\/post\/[^/]+?\/[^/]*r-?18/);
        },

        get mangaPages () {
          return self.info.path.image.images.length;
        }
      };

      let member = {
        get id () {
          return self.info.illust.pageUrl.match(/^https?:\/\/([^/]+?)\.tumblr\.com\/post\//)[1];
        },

        get pixivId () {
          return member.id;
        },

        get name () {
          return AnkUtils.trim(self.elements.illust.userName ? self.elements.illust.userName.textContent : self.info.member.id);
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

     URL:        'https://www.tumblr.com/',  // イラストページ以外でボタンを押したときに開くトップページのURL
     DOMAIN:     'tumblr.com',               // CSSの適用対象となるドメイン
     SERVICE_ID: 'TBR',                      // 履歴DBに登録するサイト識別子
     SITE_NAME:  'Tumblr',                   // ?site-name?で置換されるサイト名のデフォルト値

     EXPERIMENTAL: true,                     // 試験実装中のモジュール

     /********************************************************************************
      * 
      ********************************************************************************/

     /**
      * このモジュールの対応サイトかどうか
      */
     isSupported: function (doc) {
       return doc.location.href.match(/^https?:\/\/[^/]*tumblr\.com\//);
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
       let m = this.curdoc.location.href.match(/\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/);
       return m && m[1];
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
       const IsIllust = /\.tumblr\.com\/post\/([^/]+?)(?:\?|\/|$)/;
       const Targets = [
                         ['#portfolio  div.item > a', 1],   // 一覧
                         ['.post_micro.is_photo a', 2],  // archive
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

         if (self.elements.illust.slideshowFrame) {
           let m = AnkUtils.A(self.elements.illust.slideshowSet).map(e => e.src);
           return setSelectedImage({ images: m, facing: null });
         }
         else if (self.elements.illust.photoFrame) {
           let m = AnkUtils.A(self.elements.illust.photoSet).map(e => e.src);
           return setSelectedImage({ images: m, facing: null });
         }

         return setSelectedImage({ images: [self.elements.illust.mediumImage.src], facing: null });
       });
     },

     /********************************************************************************
      * 
      ********************************************************************************/

     /*
      * イラストページにviewerやダウンロードトリガーのインストールを行う
      */
    installMediumPageFunctions: function () { // {{{

      let proc = function () {
        var body = self.elements.illust.body;
        var wrapper = self.elements.illust.wrapper;
        var medImg = self.elements.illust.mediumImage;

        // FIXME imgがiframe中にある場合、iframe中の最初のimgの完了待ちしかしていないので、失敗するタイミングがあるかも
        if (!(body && medImg && wrapper)) {
          return false;   // リトライしてほしい
        }

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
              }).then(null).catch(e =>  AnkUtils.dumpError(e,true));

              if (useCapture) {
                e.preventDefault();
                e.stopPropagation();
              }
            },
            useCapture
          );
        };

        // 中画像クリック
        let useViewer = AnkBase.Prefs.get('largeOnMiddle', true) && AnkBase.Prefs.get('largeOnMiddle.'+self.SITE_NAME, true);
        let useClickDownload = AnkBase.Prefs.get('downloadWhenClickMiddle', false);
        if (useViewer || useClickDownload)
          addMiddleClickEventListener();

        // 保存済み表示
        AnkBase.insertDownloadedDisplayById(
          self.elements.illust.downloadedDisplayParent,
          self.info.illust.R18,
          self.info.illust.id,
          self.SERVICE_ID
        );

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      return AnkBase.delayFunctionInstaller(proc, 500, 20, self.SITE_NAME, '');
    }, // }}}

    /*
     * リストページ用ファンクション
     */
    installListPageFunctions: function () { /// {
      let followExpansion = function () {
        var archive = self.elements.illust.archiveContent;

        if (!archive) {
          return false;     // リトライしてほしい
        }

        // 伸びるおすすめリストに追随する
        new MutationObserver(function (o) {
          o.forEach(e => self.markDownloaded(e.target, true));
        }).observe(archive, {childList: true});

        return true;
      };

      let delayMarking = function () {
        var body = doc.getElementsByTagName('body');

        if (!((body && body.length>0) && doc.readyState === 'complete')) {
          return false;   // リトライしてほしい
        }

        // リスト表示が遅くてダウンロードマーク表示が漏れることがあるので、再度処理を実行
        self.markDownloaded(doc,true);

        return true;
      };

      var self = this;
      var doc = this.curdoc;

      AnkBase.delayFunctionInstaller(followExpansion, 500, 30, self.SITE_NAME, 'followExpansion');
      return AnkBase.delayFunctionInstaller(delayMarking, 500, 30, self.SITE_NAME, 'delayMarking');
    } // }}}

  };

  // --------
  global["SiteModule"] = AnkPixivModule;

})(this);