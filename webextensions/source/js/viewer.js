"use strict";

{

  var AnkViewer = (() => {

    let doc = null;
    let prefs = null;
    let viewer = null;
    let currentPageIdx = 0;
    let totalPages = 0;
    let pageCache = null;

    //

    let getElementId = (id) => {
      return 'ank-pixiv-viewer-' + id;
    };

    let createElement = (tagName, id, cls) => {
      return AnkUtils.createElement(tagName, getElementId(id), null, cls && {'class': getElementId(cls)});
    };

    let queryElementById = (id) => {
      return doc.querySelector('#' + getElementId(id));
    };

    // 他のハンドラをキックさせない
    let noMoreEvent = (func) => {
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        return func.apply(this, arguments);
      };
    };

    // ビュアー表示中の画面スクロールの停止・再開
    let scrollCtrl = (() => {

      let scrollPos = null;

      let pause = () => {
        if (scrollPos) {
          return;
        }
        scrollPos = {
          top: doc.body.scrollTop,
          left: doc.body.scrollLeft
        };
        doc.documentElement.classList.add(getElementId('enabled'));
      };

      let resume = () => () => {
        if (!scrollPos) {
          return;
        }
        doc.documentElement.classList.remove(getElementId('enabled'));
        doc.body.scrollTop = scrollPos.top;
        doc.body.scrollLeft = scrollPos.left;
        scrollPos = null;
      };

      return {
        pause: pause,
        resume: resume
      }
    })();

    // キャッシュ済みでなく、ソースがblobやdataURLでない場合はリモートアクセスする
    let getImageSource = async (pc) => {
      if (!pc) {
        return;
      }

      if (!prefs.useImagePrefetch) {
        // 非キャッシュ設定の場合はsrcをそのまま渡す
        return pc;
      }

      if (!pc.blob && /^https?:\/\//.test(pc.src)) {
        let resp = await remote.get({
          url: pc.src,
          timeout: prefs.xhrTimeout,
          headers: [{name:'Referer', value:doc.location.href}],
          responseType: 'blob'
        });

        logger.info('FETCHED: ', pc.src);
        pc.blob = URL.createObjectURL(resp.blob);
      }
      return pc;
    };

    /**
     * 指定のページを表示する
     * @param opt
     * @returns {*}
     */
    let showPage = (opt) => {
      currentPageIdx = getNewPageIdx(opt, currentPageIdx, totalPages);
      if (currentPageIdx === undefined) {
        return closeViewer();
      }

      let pgidx = currentPageIdx;
      let pgc = pageCache[currentPageIdx];

      return Promise.all([
        getImageSource(pgc[0]),
        getImageSource(pgc[1])
      ]).then((imgs) => {
        if (pgidx != currentPageIdx) {
          // ロード中に別のページに移ってしまっていたのでキャンセル
          return;
        }

        if (imgs[1]) {
          viewer.fpImg.classList.remove('none');
          viewer.fpImg.setAttribute('src', imgs[1].blob || imgs[1].src);
        }
        else {
          viewer.fpImg.classList.add('none');
          viewer.fpImg.setAttribute('src', '');
        }

        if (imgs[0]) {
          viewer.bigImg.setAttribute('src', imgs[0].blob || imgs[0].src);
        }
      }).catch((e) => logger.error(e));
    };

    //

    /**
     * 移動先のページ番号を取得する
     * @param opt
     * @param currentPageIdx
     * @param totalPages
     * @returns {*}
     */
    let getNewPageIdx = (opt, currentPageIdx, totalPages) => {
      if (opt.nextPage) {
        // 次へ
        let n = (currentPageIdx + 1) % totalPages;
        if (prefs.loopPage || currentPageIdx < n) {
          viewer.pageSelector.value = n;
          return n;
        }
      }
      else if (opt.prevPage) {
        // 前へ
        let n = (currentPageIdx + totalPages - 1) % totalPages;
        if (prefs.loopPage || currentPageIdx > n) {
          viewer.pageSelector.value = n;
          return n;
        }
      }
      else if (0 <= opt.pageNo && opt.pageNo < totalPages) {
        // ページ番号指定
        return opt.pageNo;
      }
    };

    /**
     * 総ページ数を調べる（見開き考慮あり）
     * @param imagePath
     * @returns {*}
     */
    let getTotalPage = (imagePath) => {
      if (imagePath.length == 1) {
        return 1;
      }

      let lastImg = imagePath[imagePath.length-1];
      if (lastImg.facingNo) {
        return lastImg.facingNo;
      }

      return imagePath.length;
    };

    /**
     * 全ページの画像データの入れ物を用意する
     * @param imagePath
     * @param totalPages
     */
    let createPageCache = (imagePath, totalPages) => {
      let pageCache = new Array(totalPages);
      imagePath.forEach((img, i) => {
        let n = img.facingNo > 0 && img.facingNo-1 || i;
        pageCache[n] = pageCache[n] || [];
        pageCache[n].push({
          src: img.src,
          blob: null
        })
      });
      return pageCache;
    };

    /**
     * 全ページの画像データを先行読み込みする
     * @param pageCache
     * @param totalPages
     * @returns {Promise.<void>}
     */
    let loadImagesToCache = async (pageCache, totalPages) => {
      for (let n=0; n < totalPages; n++) {
        let pgc = pageCache[(n+1) % totalPages];  // P.1は処理済みのはずなので、P.2から始める
        for (let i=0; i<pgc.length; i++) {
          let imgc = pgc[i];
          if (!imgc.blob) {
            let resp = await remote.get({
              url: imgc.src,
              timeout: prefs.xhrTimeout,
              responseType: 'blob'
            });

            logger.info('PREFETCHED: ', imgc.src);
            imgc.blob = URL.createObjectURL(resp.blob);
          }
        }
      }
    };

    /**
     * ビュアーを構築する
     * @param doc
     * @param totalPages
     * @param facing
     * @returns {{panel, bigImg, fpImg, imgContainer, imgPanel, buttonPanel, prevButton, nextButton, resizeButton, closeButton, pageSelector}}
     */
    let createViewerElements = (doc, totalPages, facing) => {
      let viewer = {
        panel: createElement('div', 'panel'),
        bigImg: createElement('img', 'image', 'show_image'),
        fpImg: createElement('img', 'image-fp', 'show_image'),
        imgContainer: createElement('div', 'image-container'),
        imgPanel: createElement('div', 'image-panel'),
        buttonPanel: createElement('div', 'button-panel'),
        prevButton: createElement('button', 'prev-button', 'submit_button'),
        nextButton: createElement('button', 'next-button', 'submit_button'),
        resizeButton: createElement('button', 'resize-button', 'submit_button'),
        closeButton: createElement('button', 'close-button', 'submit_button'),
        pageSelector: createElement('select', 'page-selector', 'item_selector')
      };

      viewer.fpImg.classList.add('fp');

      viewer.prevButton.classList.add('for-multi');
      viewer.nextButton.classList.add('for-multi');
      viewer.pageSelector.classList.add('for-multi');

      viewer.panel.appendChild(viewer.imgPanel);
      viewer.imgPanel.appendChild(viewer.imgContainer);
      viewer.imgContainer.appendChild(viewer.fpImg);
      viewer.imgContainer.appendChild(viewer.bigImg);
      viewer.panel.appendChild(viewer.buttonPanel);
      viewer.buttonPanel.appendChild(viewer.pageSelector);
      viewer.buttonPanel.appendChild(viewer.prevButton);
      viewer.buttonPanel.appendChild(viewer.nextButton);
      viewer.buttonPanel.appendChild(viewer.resizeButton);
      viewer.buttonPanel.appendChild(viewer.closeButton);

      if (facing) {
        viewer.panel.classList.add('facing');
      }

      viewer.fpImg.classList.add('none');

      if (totalPages == 1) {
        viewer.buttonPanel.classList.add('single-image');
      }
      else {
        viewer.buttonPanel.classList.add('multi-image');
        for (let i=0; i<totalPages; i++) {
          let o = doc.createElement('option');
          o.textContent = [i+1, totalPages].join('/');
          o.value = i;
          viewer.pageSelector.appendChild(o);
        }
        viewer.pageSelector.addEventListener('change', noMoreEvent((e) => showPage({pageNo:e.target.value}), false));
        viewer.pageSelector.addEventListener('click', noMoreEvent(() => void 0), true);
        viewer.prevButton.addEventListener('click', noMoreEvent(() => showPage({prevPage:true})), true);
        viewer.nextButton.addEventListener('click', noMoreEvent(() => showPage({nextPage:true})), true);
      }

      // TODO
      viewer.panel.classList.add('fit_in_height');

      // FIXME 'FIT in Window'がないよ
      viewer.resizeButton.addEventListener('click', noMoreEvent(() => {
        if (viewer.panel.classList.contains('fit_in_height')) {
          viewer.panel.classList.remove('fit_in_height');
          viewer.panel.classList.add('fit_in_width');
        }
        else if (viewer.panel.classList.contains('fit_in_width')) {
          viewer.panel.classList.remove('fit_in_width');
        }
        else {
          viewer.panel.classList.add('fit_in_height');
        }
      }), true);

      viewer.closeButton.addEventListener('click', noMoreEvent(() => closeViewer()), false);

      viewer.bigImg.addEventListener('click', noMoreEvent(() => showPage({nextPage:true})), true);
      viewer.fpImg.addEventListener('click', noMoreEvent(() => showPage({nextPage:true})), true);
      viewer.panel.addEventListener('click', noMoreEvent(() => closeViewer()), false);

      return viewer;
    };

    /**
     * 開く
     * @param opts
     */
    let openViewer = (opts) => {

      doc = opts.doc;
      prefs = opts.prefs;

      let panel = queryElementById('panel');
      if (panel) {
        // 既に開いている
        return;
      }

      // サムネかオリジナル画像か選ぶ
      let imagePath = !prefs.viewOriginalSize && opts.path.thumbnail || opts.path.original;
      if (!imagePath) {
        // 引数にパスが見つからない
        return;
      }

      // ビュアーに隠れるページのスクロールを一時停止する
      scrollCtrl.pause();

      // FIXME 再度開いたとき、前回開いていたページを開きなおしたい
      currentPageIdx = 0;
      totalPages = getTotalPage(imagePath);
      pageCache = createPageCache(imagePath, totalPages);
      let facing = pageCache.length < imagePath.length;

      // viewerを構築する
      viewer = createViewerElements(doc, totalPages, facing);
      doc.body.appendChild(viewer.panel);

      // 開く
      showPage({pageNo: currentPageIdx})
        .then(() => {
          if (!prefs.useImagePrefetch) {
            return;
          }

          // 先行読み込み
          return loadImagesToCache(pageCache, totalPages);
        });
    };

    /**
     * 閉じる
     */
    let closeViewer = () => {
      if (!viewer) {
        return;
      }

      // キャッシュの開放
      for (let i=0; i < pageCache.length; i++) {
        let pgc = pageCache[i];
        for (let j=0; j<pgc.length; j++) {
          let imgc = pgc[j];
          if (imgc.blob) {
            logger.info('REVOKED: ', imgc.src);
            URL.revokeObjectURL(imgc.blob);
          }
        }
      }

      scrollCtrl.resume();

      doc.body.removeChild(viewer.panel);

      viewer = null;
      prefs = null;
      doc = null;
    };

    //

    return {
      open: openViewer,
      close: closeViewer
    };

  })();

}