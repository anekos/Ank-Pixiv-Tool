"use strict";

{

  var AnkViewer = function (doc, prefs) {

    if (this === undefined || !(this instanceof AnkViewer)) {
      throw Error('Constructor called as a function');
    }

    let getElementId = function (id) {
      return 'ank-pixiv-viewer-' + id;
    };

    let createElement = function (tagName, id, cls) {
      return AnkUtils.createElement(tagName, getElementId(id), null, cls && {class:getElementId(cls)});
    };

    let queryElementById = function (id) {
      return doc.querySelector('#' + getElementId(id));
    };

    // 他のハンドラをキックさせない
    let noMoreEvent = function (func) {
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        return func.apply(this, arguments);
      };
    };

    // 画面のスクロールの停止
    let pauseScroll = function () {
      if (scrollPos) {
        return;
      }
      scrollPos = {
        top: doc.body.scrollTop,
        left: doc.body.scrollLeft
      };
      doc.documentElement.classList.add(getElementId('enabled'));
    };

    // 画面のスクロールの再開
    let resumeScroll = function () {
      if (!scrollPos) {
        return;
      }
      doc.documentElement.classList.remove(getElementId('enabled'));
      doc.body.scrollTop = scrollPos.top;
      doc.body.scrollLeft = scrollPos.left;
      scrollPos = null;
    };

    // キャッシュ済みでなく、ソースがblobやdataURLでない場合はリモートアクセスする
    let imageDataRequest = function (cp) {
      return spawn(function* () {
        if (!cp) {
          return;
        }

        if (!cp.blob && /^https?:\/\//.test(cp.src)) {
          let blob = yield AnkUtils.Remote.get({
            url: cp.src,
            timeout: prefs.xhrTimeout,
            responseType: 'blob'
          });

          AnkUtils.Logger.debug('FETCHED: ', cp.src);
          cp.blob = URL.createObjectURL(blob);
        }

        return cp;
      });
    };

    // 指定のページを表示
    let showPage = function (opt) {
      currentPage = (function () {
        if (opt.nextPage) {
          let n = (currentPage + 1) % totalPages;
          if (prefs.loopPage || currentPage < n) {
            viewer.pageSelector.value = n;
            return n;
          }
        }
        else if (opt.prevPage) {
          let n = (currentPage + totalPages - 1) % totalPages;
          if (prefs.loopPage || currentPage > n) {
            viewer.pageSelector.value = n;
            return n;
          }
        }
        else if (0 <= opt.pageNo && opt.pageNo < totalPages) {
          return opt.pageNo;
        }
      })();

      if (currentPage === undefined) {
        return self.close();
      }

      let pn = currentPage;  // 実行時点のページ番号
      let cd = cache[currentPage];
      return Promise.all([imageDataRequest(cd[0]), imageDataRequest(cd[1])]).then(r => {
        if (pn != currentPage) {
          // ロード中に別のページに移ってしまっていたのでキャンセル
          return;
        }

        if (r[1]) {
          viewer.fpImg.classList.remove('none');
          viewer.fpImg.setAttribute('src', r[1].blob || r[1].src);
        }
        else {
          viewer.fpImg.classList.add('none');
          viewer.fpImg.setAttribute('src', '');
        }

        if (r[0]) {
          viewer.bigImg.setAttribute('src', r[0].blob || r[0].src);
        }
      }).catch(e => AnkUtils.Logger.error(e));
    };

    //

    let self = this;
    let viewer = null;
    let currentPage = 0;
    let totalPages = 0;
    let cache = null;
    let scrollPos = null;

    //

    /**
     * 開く
     */
    self.open = function (obj) {
      let panel = queryElementById('panel');
      if (panel) {
        return;
      }

      let path = !prefs.viewOriginalSize && obj.thumbnail || obj.original;
      if (!path) {
        return;
      }

      // キャッシュを構成する
      currentPage = 0;

      totalPages = (function (p) {
        if (p.length == 1) {
          return 1;
        }

        let lp = p[p.length-1];
        if (lp.facing) {
          return lp.facing;
        }

        return p.length;
      })(path);

      cache = new Array(totalPages);
      path.forEach(function (v, i) {
        let n = v.facing > 0 && v.facing-1 || i;
        cache[n] = cache[n] || [];
        cache[n].push({
          src: v.src,
          blob: null
        })
      });

      // viewerを構築する
      pauseScroll();

      viewer = {
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

      doc.body.appendChild(viewer.panel);

      if (cache.length < path.length) {
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
        viewer.pageSelector.addEventListener('change', noMoreEvent(e => showPage({pageNo:e.target.value}), false));
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

      viewer.closeButton.addEventListener('click', noMoreEvent(() => self.close()), false);

      viewer.bigImg.addEventListener('click', noMoreEvent(() => showPage({nextPage:true})), true);
      viewer.fpImg.addEventListener('click', noMoreEvent(() => showPage({nextPage:true})), true);
      viewer.panel.addEventListener('click', noMoreEvent(() => self.close()), false);

      // 開く
      showPage({pageNo:0}).then(() => {
        if (prefs.useImagePrefetch) {
          // 先行読み込み
          spawn(function* () {
            for (let n=0; n < totalPages; n++) {
              let c = cache[(n+1) % totalPages];  // P.1は処理済みのはずなので、P.2から始める
              for (let i=0; i<c.length; i++) {
                let cp = c[i];
                if (!cp.blob) {
                  let blob = yield AnkUtils.Remote.get({
                    url: cp.src,
                    timeout: prefs.xhrTimeout,
                    responseType: 'blob'
                  });

                  AnkUtils.Logger.debug('PREFETCHED: ', cp.src);
                  cp.blob = URL.createObjectURL(blob);
                }
              }
            }
          });
        }
      });
    };

    /**
     * 閉じる
     */
    self.close = function () {
      if (!viewer) {
        return;
      }

      // キャッシュの開放
      for (let i=0; i < cache.length; i++) {
        let c = cache[i];
        for (let j=0; j<c.length; j++) {
          let cp = c[j];
          if (cp.blob) {
            AnkUtils.Logger.debug('REVOKED: ', cp.src);
            URL.revokeObjectURL(cp.blob);
          }
        }
      }

      resumeScroll();

      doc.body.removeChild(viewer.panel);
    };
  };

}