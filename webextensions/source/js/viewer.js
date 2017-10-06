"use strict";

{

  const FIT_CLASSES = ['fit_in_window', 'fit_in_height', 'fit_in_width', 'no_fit'];

  let prefs = null;

  let viewer = null;

  let scrollCtrl = null;
  let buttonCtrl = null;

  let currentPageIdx = 0;
  let totalPages = 0;
  let pageCache = null;

  let fitMode = 0;

  let start = () => {
    scrollCtrl = new ScrollCtrl();
    buttonCtrl = new ButtonCtrl();

    return {
      'open': openViewer,
      'close': closeViewer
    };
  };

  /*
   *
   */

  /**
   *
   * @param id
   * @returns {string}
   */
  let getElementId = (id) => {
    return 'ank-pixiv-viewer-' + id;
  };

  /**
   *
   * @param tagName
   * @param id
   * @param cls
   */
  let createElement = (tagName, id, cls) => {
    return AnkUtils.createElement(tagName, getElementId(id), null, cls && {'class': getElementId(cls)});
  };

  /**
   *
   * @param id
   * @returns {Element}
   */
  let queryElementById = (id) => {
    return document.getElementById(getElementId(id));
  };

  /**
   * 他のハンドラをキックさせない
   * @param func
   * @returns {function(...[*]=)}
   */
  let noMoreEvent = (func) => {
    return (...args) => {
      args[0].preventDefault();
      args[0].stopPropagation();
      return func.apply(this, args);
    };
  };

  /**
   * ビュアー表示中の画面スクロールの停止・再開
   * @returns {{pause: (function()), resume: (function())}}
   * @constructor
   */
  let ScrollCtrl = function () {

    let scrollPos = null;
    let barSize = null;

    let pause = () => {
      if (scrollPos) {
        return;
      }
      scrollPos = {
        'top': document.body.scrollTop,
        'left': document.body.scrollLeft
      };
      barSize = AnkUtils.getScrollbarSize();
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
      'resume': resume,
      get barSize () {
        return barSize;
      }
    };
  };

  /**
   * ボタンパネルの表示・非表示
   * @returns {{show: (function()), hide: hide}}
   * @constructor
   */
  let ButtonCtrl = function () {

    const FADEOUT_TIME = 500;

    let fadeOutTimer = 0;

    let show = () => {
      if (fadeOutTimer) {
        clearInterval(fadeOutTimer);
        fadeOutTimer = 0;
      }

      viewer.buttonPanel.setAttribute('data-opacity', prefs.maxPanelOpacity.toString());
    };

    let hide = function () {
      let decOpacity = () => {
        try {
          if (buttonOpacity > prefs.minPanelOpacity) {
            buttonOpacity--;
            viewer.buttonPanel.setAttribute('data-opacity', buttonOpacity.toString());
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
      let step = FADEOUT_TIME / (prefs.maxPanelOpacity - prefs.minPanelOpacity);

      if (step > 0) {
        fadeOutTimer = setInterval(fadeOutTimerHandler, step);
      }
    };

    return {
      'show': show,
      'hide': hide
    };
  };

  /**
   * 全ページの画像データの入れ物を用意する
   * @param imagePath
   * @param totalPages
   * @returns {Array}
   * @constructor
   */
  let PageCache = function (imagePath, totalPages) {
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
   *
   * @param ev
   */
  let autoResize = (ev) => {
    let resize = (p) => {
      let viw = Math.floor(iw * p);
      let vih = Math.floor(ih * p);
      let vfw = Math.floor(fw * p);
      let vfh = Math.floor(fh * p);

      let vcw = viw + vfw;
      let vch = vih > vfh ? vih : vfh;

      // 逆サイドが広くてスクロールバーが出る時は、panelの領域をスクロールバーの位置までに限定
      let vpw = (vch > ch) && (cw - vcw >= sw) ? (cw-sw) : cw;
      let vph = (vcw > cw) && (ch - vch >= sh) ? (ch-sh) : ch;

      let padLeft = (vpw > vcw) ? Math.floor((vpw - vcw) / 2) : 0;
      let padTop = (vph > vch) ? Math.floor((vph - vch) / 2) : 0;

      viewer.bigImg.style.width = viw + 'px';
      viewer.bigImg.style.height = vih + 'px';
      viewer.fpImg.style.width = vfw + 'px';
      viewer.fpImg.style.height = vfh + 'px';

      viewer.imgContainer.style.width = vcw + 'px';
      viewer.imgContainer.style.height = vch + 'px';
      viewer.imgContainer.style.setProperty('padding-left', padLeft + 'px', '');
      viewer.imgContainer.style.setProperty('padding-top', padTop + 'px', '');

      viewer.panel.style.width = vpw + 'px';
      viewer.panel.style.height = vph + 'px';
    };

    //

    if (!viewer.bigImg.complete || !viewer.fpImg.complete) {
      return;
    }

    let facing = viewer.panel.classList.contains('facing');

    let sw = scrollCtrl.barSize.width;
    let sh = scrollCtrl.barSize.height;

    let cw = window.innerWidth;
    let ch = window.innerHeight;

    let iw = viewer.bigImg.naturalWidth;
    let ih = viewer.bigImg.naturalHeight;
    let fw = facing ? viewer.fpImg.naturalWidth : 0;
    let fh = facing ? viewer.fpImg.naturalHeight : 0;

    let ph = ch / ih;
    if (Math.ceil(iw * ph) > cw) {
      ph = (ch - sh) / ih;
    }
    let pw = cw / iw;
    if (Math.ceil(ih * pw) > ch) {
      pw = (cw - sw) / iw;
    }

    let pp = ph < pw ? ph : pw;

    if (prefs.dontResizeIfSmall) {
      ph = ph > 1 ? 1 : ph;
      pw = pw > 1 ? 1 : pw;
      pp = pp > 1 ? 1 : pp;
    }

    let pa = [pp, ph, pw, 1];

    if (ev && ev.type === 'load') {
      resize(pa[fitMode])
    }
    else {
      FIT_CLASSES.some((c, i) => {
        if (viewer.panel.classList.contains(c)) {
          fitMode = (i+1) % FIT_CLASSES.length;
          viewer.panel.classList.remove(c);
          viewer.panel.classList.add(FIT_CLASSES[fitMode]);
          resize(pa[fitMode]);
          return true;
        }
      });
    }
  };

  /**
   * 指定のページを表示する
   * @param opts
   */
  let setPage = (opts) => {
    let setImgSrc = (e, c, p) => {
      e.classList.remove('loading');
      e.setAttribute('data-page-no', p);

      if (c.objurl) {
        return e.setAttribute('src', c.objurl);
      }

      if (prefs.useLoadProgress) {
        e.classList.add('loading');
      }
      e.setAttribute('src', c.src);
    };

    currentPageIdx = getNewPageIdx(opts, currentPageIdx, totalPages);
    if (currentPageIdx == -1) {
      return closeViewer();
    }

    let pgc = pageCache[currentPageIdx];

    if (pgc[1]) {
      viewer.fpImg.classList.remove('none');
      setImgSrc(viewer.fpImg, pgc[1], currentPageIdx);
    }
    else {
      viewer.fpImg.classList.add('none');
      viewer.fpImg.setAttribute('src', '');
    }

    if (pgc[0]) {
      setImgSrc(viewer.bigImg, pgc[0], currentPageIdx);
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
    if (opts.reverse ? opts.prevPage : opts.nextPage) {
      // 次へ
      let n = (currentPageIdx + 1) % totalPages;
      if (prefs.loopPage || currentPageIdx < n) {
        viewer.pageSelector.value = n;
        return n;
      }
    }
    else if (opts.reverse ? opts.nextPage : opts.prevPage) {
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

    return -1;
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
   * 画像データを先行読み込みする
   * @param pageIdx
   */
  // FIXME キャッシュサイズが無制限なのは問題だ
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

    return (async () => {
      if (!isNaN(pageIdx)) {
        // 指定ページ
        await loadImg(pageCache[pageIdx]);
      }
      else {
        // 全ページ
        for (let n=1; n < totalPages; n++) {
          await loadImg(pageCache[n]);  // P.1はonloadで処理されるはずなので、P.2から始める
        }
      }
    })().catch((e) => {
      logger.error(e);
    });
  };

  /**
   * imgへのsrcの読み込みが完了した際に実行する
   * @param e
   */
  let onImageLoadCompleted = (e) => {
    let img = e.target;
    if (!img.complete) {
      return;
    }

    autoResize(e);

    if (img.classList.contains('loading')) {
      // 半透明終了
      img.classList.remove('loading');

      // 未プリフェッチのsrcの場合は、imgのロードが完了してからキャッシュに入れる
      if (prefs.useImagePrefetch) {
        try {
          let p = parseInt(img.getAttribute('data-page-no'), 10);
          if (!isNaN(p)) {
            loadImageToCache(p)
              .then(() => {
                loadImageToCache();
              });
          }
        }
        catch (e) {}
      }
    }
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
    vw.prevButton.addEventListener('click', noMoreEvent(() => setPage({'prevPage': true, 'reverse': prefs.swapArrowButton})), true);
    vw.nextButton.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true, 'reverse': prefs.swapArrowButton})), true);

    fitMode = isNaN(prefs.largeImageSize) ? 0 : (prefs.largeImageSize % FIT_CLASSES.length);
    vw.panel.classList.add(FIT_CLASSES[fitMode]);

    vw.resizeButton.addEventListener('click', noMoreEvent((e) => autoResize(e)), true);

    vw.closeButton.addEventListener('click', noMoreEvent(() => closeViewer()), false);

    vw.bigImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);
    vw.fpImg.addEventListener('click', noMoreEvent(() => setPage({'nextPage': true})), true);

    vw.bigImg.addEventListener('load', onImageLoadCompleted, false);
    vw.fpImg.addEventListener('load', onImageLoadCompleted, false);

    vw.panel.addEventListener('click', noMoreEvent(() => closeViewer()), false);

    vw.buttonPanel.addEventListener('mouseover', buttonCtrl.show, false);
    vw.buttonPanel.addEventListener('mouseout', buttonCtrl.hide, false);

    return vw;
  };

  /**
   *
   */
  let addCustomStyle = () => {
    let css = [];
    for (let i=0; i<=10; i++) {
      css.push('#ank-pixiv-viewer-button-panel[data-opacity="'+i+'"]{opacity:'+(i/10.0)+';}');
    }
    let style = createElement('style', 'style');
    style.innerHTML = css.join('\n');
    document.head.appendChild(style);
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
    pageCache = new PageCache(path, totalPages);

    // viewerを構築する
    if (!viewer) {
      viewer = createViewerElements();
      addCustomStyle()
    }

    setFacingMode(pageCache.length < path.length);
    setPageSelectorOptions(totalPages);

    document.body.appendChild(viewer.panel);

    // 開く
    currentPageIdx = currentPageIdx == -1 ? 0 : currentPageIdx;
    setPage({'pageNo': currentPageIdx});
    buttonCtrl.show();
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

  var AnkViewer = start();

}