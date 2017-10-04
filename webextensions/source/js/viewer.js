"use strict";

{

  var AnkViewer = (() => {

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
      return document.querySelector('#' + getElementId(id));
    };

    // 他のハンドラをキックさせない
    let noMoreEvent = (func) => {
      return (...args) => {
        args[0].preventDefault();
        args[0].stopPropagation();
        return func.apply(this, args);
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
          'top': document.body.scrollTop,
          'left': document.body.scrollLeft
        };
        document.documentElement.classList.add(getElementId('enabled'));
      };

      let resume = () => {
        if (!scrollPos) {
          return;
        }
        document.documentElement.classList.remove(getElementId('enabled'));
        document.body.scrollTop = scrollPos.top;
        document.body.scrollLeft = scrollPos.left;
        scrollPos = null;
      };

      return {
        'pause': pause,
        'resume': resume
      };
    })();

    // ボタンパネルの表示・非表示
    let buttonCtrl = (() => {

      let fadeOutTimer = 0;

      let show = () => {
        if (fadeOutTimer) {
          clearInterval(fadeOutTimer);
          fadeOutTimer = 0;
        }

        viewer.buttonPanel.style.opacity = prefs.maxPanelOpacity / 100.0;
      };

      let hide = function () {
        let decOpacity = () => {
          try {
            if (buttonOpacity > prefs.minPanelOpacity) {
              buttonOpacity -= step;
              viewer.buttonPanel.style.opacity = buttonOpacity / 100.0;
              return false;   // please retry
            }
          } catch (e) {}
          return true;
        };

        let fadeOutTimerHandler = () => {
          if (decOpacity()) {
            clearInterval(fadeOutTimer);
            fadeOutTimer = 0;
          }
        };

        let buttonOpacity = prefs.maxPanelOpacity;
        let step = (prefs.maxPanelOpacity - prefs.minPanelOpacity) / 10.0;

        fadeOutTimer = setInterval(fadeOutTimerHandler, 100);
      };

      return {
        'show': show,
        'hide': hide
      };
    })();

    /**
     * 指定のページを表示する
     * @param opts
     */
    let setPage = (opts) => {
      currentPageIdx = getNewPageIdx(opts, currentPageIdx, totalPages);
      if (currentPageIdx === undefined) {
        return closeViewer();
      }

      let pgc = pageCache[currentPageIdx];

      if (pgc[1]) {
        viewer.fpImg.classList.remove('none');
        viewer.fpImg.setAttribute('src', pgc[1].objurl || pgc[1].src);
      }
      else {
        viewer.fpImg.classList.add('none');
        viewer.fpImg.setAttribute('src', '');
      }

      if (pgc[0]) {
        viewer.bigImg.setAttribute('src', pgc[0].objurl || pgc[0].src);
      }

      if (prefs.useImagePrefetch) {
        loadImageToCache(currentPageIdx);
      }
    };

    /**
     * 移動先のページ番号を取得する
     * @param opts
     * @param currentPageIdx
     * @param totalPages
     * @returns {*}
     */
    let getNewPageIdx = (opts, currentPageIdx, totalPages) => {
      if (opts.nextPage) {
        // 次へ
        let n = (currentPageIdx + 1) % totalPages;
        if (prefs.loopPage || currentPageIdx < n) {
          viewer.pageSelector.value = n;
          return n;
        }
      }
      else if (opts.prevPage) {
        // 前へ
        let n = (currentPageIdx + totalPages - 1) % totalPages;
        if (prefs.loopPage || currentPageIdx > n) {
          viewer.pageSelector.value = n;
          return n;
        }
      }
      else if (0 <= opts.pageNo && opts.pageNo < totalPages) {
        // ページ番号指定
        viewer.pageSelector.value = opts.pageNo;
        return opts.pageNo;
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
          'src': img.src,
          'referrer': img.referrer,
          'busy': false,
          'objurl': null
        })
      });
      return pageCache;
    };

    /**
     * 画像データを先行読み込みする
     * @param pageIdx
     */
    let loadImageToCache = (pageIdx) => {
      let loadImg = async (pageCache) => {
        for (let i=0; i<pageCache.length; i++) {
          let imgCache = pageCache[i];
          if (!imgCache.objurl && !imgCache.busy && /^https?:\/\//.test(imgCache.src)) {
            imgCache.busy = true;
            await remote.get({
              'url': imgCache.src,
              //'headers': imgCache.referrer && [{'name':'Referer', 'value': imgCache.referrer}],
              'timeout': prefs.xhrTimeout,
              'responseType': 'blob'
            }).then((resp) => {
              logger.debug('PREFETCHED:', imgCache.src);
              imgCache.objurl = URL.createObjectURL(resp.blob);
              imgCache.busy = false;
            });
          }
        }
      };

      (async () => {
        if (pageIdx) {
          // 指定ページ
          await loadImg(pageCache[pageIdx]);
        }
        else {
          // 全ページ
          for (let n=0; n < totalPages; n++) {
            await loadImg(pageCache[(n+1) % totalPages]);  // P.1は処理済みのはずなので、P.2から始める
          }
        }
      })().catch((e) => {
        logger.error(e);
      });
    };

    /**
     * ビュアーを構築する
     * @returns {{panel, bigImg, fpImg, imgContainer, imgPanel, buttonPanel, prevButton, nextButton, resizeButton, closeButton, pageSelector}}
     */
    let createViewerElements = () => {
      let vw = {
        'panel': createElement('div', 'panel'),
        'bigImg': createElement('img', 'image', 'show_image'),
        'fpImg': createElement('img', 'image-fp', 'show_image'),
        'imgContainer': createElement('div', 'image-container'),
        'imgPanel': createElement('div', 'image-panel'),
        'buttonPanel': createElement('div', 'button-panel'),
        'prevButton': createElement('button', 'prev-button', 'submit_button'),
        'nextButton': createElement('button', 'next-button', 'submit_button'),
        'resizeButton': createElement('button', 'resize-button', 'submit_button'),
        'closeButton': createElement('button', 'close-button', 'submit_button'),
        'pageSelector': createElement('select', 'page-selector', 'item_selector')
      };

      vw.fpImg.classList.add('fp');

      vw.prevButton.classList.add('for-multi');
      vw.nextButton.classList.add('for-multi');
      vw.pageSelector.classList.add('for-multi');

      vw.panel.appendChild(vw.imgPanel);
      vw.imgPanel.appendChild(vw.imgContainer);
      vw.imgContainer.appendChild(vw.fpImg);
      vw.imgContainer.appendChild(vw.bigImg);
      vw.panel.appendChild(vw.buttonPanel);
      vw.buttonPanel.appendChild(vw.pageSelector);
      vw.buttonPanel.appendChild(vw.prevButton);
      vw.buttonPanel.appendChild(vw.nextButton);
      vw.buttonPanel.appendChild(vw.resizeButton);
      vw.buttonPanel.appendChild(vw.closeButton);

      vw.fpImg.classList.add('none');

      vw.pageSelector.addEventListener('change', noMoreEvent((e) => setPage({'pageNo': e.target.value}), false));
      vw.pageSelector.addEventListener('click', noMoreEvent(() => {}), true);
      vw.prevButton.addEventListener('click', noMoreEvent(() => setPage({'prevPage': true})), true);
      vw.nextButton.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);

      // TODO
      vw.panel.classList.add('fit_in_height');

      // FIXME 'FIT in Window'がないよ
      vw.resizeButton.addEventListener('click', noMoreEvent(() => {
        if (vw.panel.classList.contains('fit_in_height')) {
          vw.panel.classList.remove('fit_in_height');
          vw.panel.classList.add('fit_in_width');
        }
        else if (vw.panel.classList.contains('fit_in_width')) {
          vw.panel.classList.remove('fit_in_width');
        }
        else {
          vw.panel.classList.add('fit_in_height');
        }
      }), true);

      vw.closeButton.addEventListener('click', noMoreEvent(() => closeViewer()), false);

      vw.bigImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);
      vw.fpImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);
      vw.panel.addEventListener('click', noMoreEvent(() => closeViewer()), false);

      vw.buttonPanel.addEventListener('mouseover', buttonCtrl.show, false);
      vw.buttonPanel.addEventListener('mouseout', buttonCtrl.hide, false);

      return vw;
    };

    /**
     * 見開きモードを設定する
     * @param facing
     */
    let setFacingMode = (facing) => {
      viewer.panel.classList.remove('facing');
      if (facing) {
        viewer.panel.classList.add('facing');
      }
    };

    /**
     * ページセレクタの選択肢を生成する
     * @param totalPages
     */
    let setPageSelectorOptions = (totalPages) => {
      viewer.buttonPanel.classList.remove('single-image', 'multi-image');
      if (totalPages == 1) {
        viewer.buttonPanel.classList.add('single-image');
      }
      else {
        viewer.buttonPanel.classList.add('multi-image');
      }

      while (viewer.pageSelector.firstChild) {
        viewer.pageSelector.removeChild(viewer.pageSelector.firstChild);
      }
      for (let i=0; i<totalPages; i++) {
        let o = document.createElement('option');
        o.textContent = [i+1, totalPages].join('/');
        o.value = i;
        viewer.pageSelector.appendChild(o);
      }
    };

    /**
     * 開く
     * @param opts
     */
    let openViewer = (opts) => {

      prefs = prefs || opts.prefs;

      let panel = queryElementById('panel');
      if (panel) {
        // 既に開いている
        return;
      }

      // サムネかオリジナル画像か選ぶ
      let path = prefs.viewOriginalSize && opts.path.original || opts.path.thumbnail || opts.path.original;
      if (!path) {
        // 引数にパスが見つからない
        return;
      }

      // ビュアーに隠れるページのスクロールを一時停止する
      scrollCtrl.pause();

      totalPages = getTotalPage(path);
      pageCache = createPageCache(path, totalPages);

      // viewerを構築する
      viewer = viewer || createViewerElements();
      setFacingMode(pageCache.length < path.length);
      setPageSelectorOptions(totalPages);

      document.body.appendChild(viewer.panel);

      // 開く
      currentPageIdx = currentPageIdx === undefined ? 0 : currentPageIdx;
      setPage({'pageNo': currentPageIdx});
      buttonCtrl.show();

      if (prefs.useImagePrefetch) {
        // 先行読み込み
        loadImageToCache();
      }
    };

    /**
     * 閉じる
     */
    let closeViewer = () => {
      let panel = queryElementById('panel');
      if (!panel) {
        // 開いていない
        return;
      }

      document.body.removeChild(panel);

      scrollCtrl.resume();

      // キャッシュの開放
      pageCache.forEach((pgc) => {
        pgc.forEach((imgc) => {
          imgc.busy = true;
          if (imgc.objurl) {
            logger.debug('REVOKED:', imgc.src);
            URL.revokeObjectURL(imgc.objurl);
          }
        });
      });
   };

    //

    return {
      'open': openViewer,
      'close': closeViewer
    };

  })();

}