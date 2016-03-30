"use strict";

{
  let AnkTwitter = function () {
    AbsSite.apply(this, arguments);

    let self = this;

    self.SITE_ID = 'TWT';

    self.curContext = null;

    self.ContextMode = (function () {
      let m = 0;

      return {
        isGallery: function () {
          return m == 1;
        },
        isTweet: function () {
          return m == 2;
        },
        setGallery: function () {
          m = 1;
        },
        setTweet: function () {
          m = 2;
        }
      };
    })();

    // focusイベント発生時に実行する機能のON・OFF
    self.onFocusUsage = {
      display: false,
      marking: false
    };
  };

  AnkTwitter.prototype = Object.create(AbsSite.prototype, {
    constructor: {
      value: AnkTwitter,
      enumerable: false
    }
  });

  //

  /**
   * 利用するクエリのまとめ
   * @param doc
   */
  AnkTwitter.prototype.getElements = function (doc) {

    function query (q) {
      return doc.querySelector(q);
    }

    function queryAll (q) {
      return doc.querySelectorAll(q);
    }

    return {
      illust: {
        get imgOvr () {
          return query('.works_display');
        },
        med: {
        }
      },
      info: {
        illust: {
          get datetime () {
            return query('.work-info .meta > li');
          },
          get size () {
            return query('.work-info .meta > li+li');
          },
          get tools () {
            return query('.work-info .tools');
          },
          get title () {
            return query('.work-info .title');
          },
          get R18 () {
            return query('.work-info .r-18, .work-info .r-18g');
          },
          get caption () {
            return query('.work-info .caption');
          },
          get rating () {
            return query('.work-info .rating');
          },
          get tags () {
            return queryAll('.work-tags .tags > .tag > .text');
          },
          get update () {
            return query('.bookmark_modal_thumbnail');
          }
        },
        member: {
          get memberLink () {
            return query('.profile-unit > .user-link');
          },
          get feedLink () {
            return Array.prototype.filter.call(queryAll('.tabs > li > a'), a => /\/stacc\//.test(a.href))[0];
          }
        }
      },
      misc: {
        get body () {
          return doc.body;
        },
        get content () {
          return query('#doc');
        },
        get permalink () {
          return query('#permalink-overlay .PermalinkOverlay-body');
        },
        get galleryTweet () {
          return query('.GalleryTweet');
        },
        get downloadedDisplayParent () {
          return query('.score');
        },
        get recommendList() {
          // この作品をブックマークした人はこんな作品もブックマークしています
          // あなたのブックマークタグ「○○」へのおすすめ作品
          return query('#illust-recommend ._image-items');
        },
        get feedList() {
          return query('#stacc_timeline') || query('#stacc_center_timeline');
        },
        get rankingList() {
          return query('.ranking-items');
        },
        get downloadedFilenameArea () {
          return query('.ank-pixiv-downloaded-filename-text');
        },
        get nextLink() {
          return query('.before > a');
        },
        get prevLink() {
          return query('.after > a');
        }
      },
      thumbnails: {
      },
      doc: doc
    };
  };

  /**
   * ダウンロード情報のまとめ
   * @param elm
   */
  AnkTwitter.prototype.getContext = function (elm) {

    function getIllustInfo () {
      try {
        let posted = self.getPosted(() => AnkUtils.decodeDateTimeText(elm.info.illust.datetime.textContent));
        let info = {
          url: elm.doc.location.href,
          id: self.getId(elm.doc.location.href),
          title: AnkUtils.trim(elm.info.illust.title.textContent),
          posted: !posted.fault && posted.timestamp,
          postedYMD: !posted.fault && posted.ymd,
          size: (function (sz) {
            sz = AnkUtils.trim(sz);
            let m = /(\d+)\xD7(\d+)/.exec(sz);
            if (m) {
              return {
                width: m[1],
                height: m[2]
              };
            }
            return sz;
          })(elm.info.illust.size.textContent),
          tags: Array.prototype.map.call(elm.info.illust.tags, e => AnkUtils.trim(e.textContent)),
          tools: elm.info.illust.tools && AnkUtils.trim(elm.info.illust.tools.textContent),
          caption: elm.info.illust.caption && AnkUtils.trim(elm.info.illust.caption.innerText),
          R18: !!elm.info.illust.R18
        };

        (function (u) {
          let t = u && self.getLastUpdate(u.getAttribute('data-src'));
          if (t) {
            let d = AnkUtils.getDecodedDateTime(new Date(t));
            if (d.timestamp > posted.timestamp) {
              // 更新があった場合
              info.updated = d.timestamp;
              info.updatedYMD = d.ymd;
            }
          }
        })(elm.info.illust.update);

        return Promise.resolve(info);
      }
      catch (e) {
        AnkUtils.Logger.debug(e);
        return Promise.resolve();
      }
    }

    function getMemberInfo () {
      try {
        let info = {
          id: /\/member\.php\?id=(.+?)(?:&|$)/.exec(elm.info.member.memberLink.href)[1],
          pixivId: /\/stacc\/([^\?\/]+)/.exec(elm.info.member.feedLink.href)[1],
          name: AnkUtils.trim(elm.info.member.memberLink.textContent),
          memoizedName: null
        };

        return Promise.resolve(info);
      }
      catch (e) {
        AnkUtils.Logger.debug(e);
        return Promise.resolve();
      }
    }

    //

    let self = this;
    let context = null;

    if (self.ContextMode.isIllust()) {
      let getPath = function () {
        function getMedPath () {
          return Promise.resolve({
            original: [{src:elm.illust.med.bigImg.getAttribute('data-src'), referrer:elm.doc.location.href}]
          });
        }

        function getMngPath () {
          return spawn(function* () {
            // マンガインデックスページを参照して画像URLリストを取得する
            let indexPage = elm.illust.mng.largeLink.href;
            let referrer = elm.doc.location.href;
            AnkUtils.Logger.debug('MANGA INDEX PAGE: '+indexPage+', '+referrer);

            let html = yield AnkUtils.Remote.get({
              url: indexPage,
              headers: [{name:'Referer', value:referrer}],
              timeout: self.prefs.xhrTimeout
            });
            let docIdx = AnkUtils.createHTMLDocument(html);
            let elmIdx = self.getElements(docIdx);

            // サーバエラーのトラップ
            if (!docIdx || elmIdx.mngIdx.errorMessage) {
              return Promise.reject(new Error(AnkUtils.Locale.getMessage('msg_serverError')));
            }

            // マンガ形式だけど単ページイラストの場合
            if (/(?:\?|&)mode=big(?:&|$)/.test(indexPage)) {
              let img = docIdx.querySelector('img');
              if (img) {
                return {
                  original: [{src:img.src, referrer:referrer}]
                };
              }
            }

            // ブック or マンガ
            let thumb = [];
            let orig = [];
            let thumbRef = [];
            let origRef = [];
            let facing = [];
            if (docIdx.documentElement.classList.contains('_book-viewer')) {
              // ブック
              // pixivの構成変更で、ページ単位で設定できていた見開き表示が、作品単位でしか設定できなくなったようだ

              const RE_THUMB = /pixiv\.context\.images\[\d+]\s*=\s*"(.+?)"/;
              const RE_ORIG = /pixiv\.context\.originalImages\[\d+]\s*=\s*"(.+?)"/;

              Array.prototype.forEach.call(elmIdx.mngIdx.scripts, function (e) {
                let mt = RE_THUMB.exec(e.text);
                if (mt) {
                  thumb.push(mt[1].replace(/\\(.)/g, '$1'));
                }
                let mo = RE_ORIG.exec(e.text);
                if (mo) {
                  orig.push(mo[1].replace(/\\(.)/g, '$1'));
                }
              });

              let ltr = docIdx.documentElement.classList.contains('ltr');

              thumbRef = indexPage;
              origRef = indexPage;

              let swap = function (a, i) {
                let tmp = a[i-1];
                a[i-1] = a[i];
                a[i] = tmp;
              };

              for (let i=0; i<thumb.length; i++) {
                let p = i+1;
                if (p == 1) {
                  facing.push(p);
                }
                else {
                  let odd = p % 2;
                  facing.push((p - odd) / 2 + 1);

                  // 見開きの向きに合わせて画像の順番を入れ替える
                  if (ltr && odd) {
                    swap(thumb, i);
                    swap(orig, i);
                  }
                }
              }
            }
            else {
              // マンガ
              const MAX_PAGE = 1000;

              Array.prototype.some.call(elmIdx.mngIdx.images, function (v, i) {
                if (i > MAX_PAGE) {
                  return true;
                }
                thumb.push(v.getAttribute('data-src'));
              });
              thumbRef = indexPage;

              if (self.prefs.viewOriginalSize) {
                // オリジナル画像
                const RE_BIG = /(_p\d+)\./;
                const REPLACE_BIG = '_big$1.';
                const RE_MASTER = /^(https?:\/\/[^/]+).*?\/img-master\/(.+?)_master\d+(\.\w+)$/;
                const REPLACE_MASTER = '$1/img-original/$2$3';

                // 個々の画像用に存在するページ
                origRef = (function () {
                  let url = document.getElementsByTagName('a')[0];
                  let base = url.protocol+'//'+url.host;
                  return Array.prototype.map.call(elmIdx.mngIdx.largeLinks, a => base + a.getAttribute('href'));
                })();

                for (let i = 0; i < origRef.length && i < thumb.length; i++) {
                  AnkUtils.Logger.debug('ORIGINAL IMAGE PAGE: '+origRef[i]+', '+indexPage);
                  let html = yield AnkUtils.Remote.get({
                    url: origRef[i],
                    headers: [{name:'Referer', value:indexPage}],
                    timeout: self.prefs.xhrTimeout
                  });
                  let docBig = AnkUtils.createHTMLDocument(html);
                  let elmBig = self.getElements(docBig);

                  // サーバエラーのトラップ
                  if (!docBig || elmBig.mngIdx.errorMessage) {
                    return Promise.reject(new Error(AnkUtils.Locale.getMessage('msg_serverError')));
                  }

                  let src = docBig.querySelector('img').src;

                  if (!self.prefs.forceCheckMangaImagesAll) {
                    // 最初の一枚以外は拡張子チェックを行わないモード
                    if (thumb[0] == src) {
                      AnkUtils.Logger.debug('MANGA IMAGE: plane mode');
                      orig = thumb;
                    }
                    else if (thumb[0].replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, '') == src.replace(/\.\w+$/, '')) {
                      let replaceExt = /(\.\w+)$/.exec(src)[1];
                      AnkUtils.Logger.debug('MANGA IMAGE: master mode ... '+thumb[0]+' -> '+thumb[0].replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
                      orig = thumb.map(v => v.replace(RE_MASTER, REPLACE_MASTER).replace(/\.\w+$/, replaceExt));
                    }
                    else if (thumb[0].replace(RE_BIG, REPLACE_BIG) == src) {
                      AnkUtils.Logger.debug('MANGA IMAGE: big mode ... '+thumb[0]+' -> '+thumb[0].replace(RE_BIG, REPLACE_BIG));
                      orig = thumb.map(v => v.replace(RE_BIG, REPLACE_BIG));
                    }
                    else {
                      AnkUtils.Logger.debug('MANGA IMAGE: UNKNOWN MODE ... '+thumb[0]+' -> '+src);
                    }

                    break;
                  }

                  orig.push(src);
                }
              }
            }

            if (thumb.length <= 0) {
              // FIXME
              return Promise.reject(new Error('HOGEHOGE'));
            }

            if (facing.length > 0 && facing[facing.length - 1] < facing.length) {
              // 見開きがある場合
              AnkUtils.Logger.debug("Facing Page Check: (thumb) " + thumb.length + ", (orig) "+orig.length+" pics in " + facing[facing.length - 1] + " pages");
            }
            else {
              // 見開きがない場合
              AnkUtils.Logger.debug("Facing Page Check: (thumb) " + thumb.length + ", (orig) "+orig.length+" pics");
              facing = null;
            }

            return (function (path) {
              thumb.forEach(function (t, i) {
                let to = { 'src': t, 'referrer': Array.isArray(thumbRef) ? thumbRef[i] : thumbRef};
                let oo = { 'src': orig[i], 'referrer': Array.isArray(origRef) ? origRef[i] : origRef};
                if (facing) {
                  to.facing = oo.facing = facing[i];
                }
                path.thumbnail.push(to);
                path.original.push(oo);
              });

              return path;
            })({
              thumbnail: [],
              original: []
            });
          });
        }

        function getUgoPath () {
          return spawn(function* () {
            const genObj = `
            (function (c) {
              function f (u) {
                if (u && u.src && u.frames) {
                  return [{
                    src: u.src,
                    frames: u.frames.map(o => {return {s:o.file, w:o.delay}}),
                    referrer: document.location.href
                  }];
                }
              }

              return {
                thumbnail: f(c.ugokuIllustData),
                original: f(c.ugokuIllustFullscreenData)
              }
            })(pixiv.context)`;

            let id = 'ank-pixiv-script-ugoinfo';
            let name = 'AnkPixiv.UgoInfo';

            return yield AnkUtils.PageScript.exec(elm.doc, id, name, genObj);
          });
        }

        //

        if (elm.illust.med.img) {
          return getMedPath();
        }
        if (elm.illust.mng.img) {
          return getMngPath();
        }
        if (elm.illust.ugo.img) {
          return getUgoPath();
        }

        return Promise.resolve();
      };

      return Promise.all([getPath(), getIllustInfo(), getMemberInfo()])
        .then(function (result) {
          context = {
            downloadable: !!result[0] && !!result[1] && !!result[2],
            serviceId: self.SITE_ID,
            siteName: self.sitePrefs.folder,
            path: result[0],
            info: {
              illust: result[1],
              member: result[2]
            }
          };

          AnkUtils.Logger.debug('CONTEXT: ', context);

          return context;
        });
    }
    else if (self.ContextMode.isNovel()) {
      let getPath = function () {
        return spawn(function* () {
          let getPageId = function (n) {
            return 'p-'+AnkUtils.zeroPad(n, 4);
          };

          let getPageName = function (n) {
            return getPageId(n)+'.xhtml';
          };

          let createXHTMLElement = function (tagName, id, text, attr) {
            return AnkUtils.createElementNS("http://www.w3.org/1999/xhtml", tagName, id, text, attr);
          };

          let createOpfElement = function (tagName, id, text, attr) {
            return AnkUtils.createElementNS(/^dc:/.test(tagName) ? "http://purl.org/dc/elements/1.1/" : "http://www.idpf.org/2007/opf", tagName, id, text, attr);
          };

          let createXHTMLDocument = function (o) {
            let xDocType = null;
            let xDoc = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'html', xDocType);
            xDoc.documentElement.setAttribute('xmlns:epub', 'http://www.idpf.org/2007/ops');
            xDoc.documentElement.setAttribute('xml:lang', 'ja');

            let xHead = createXHTMLElement('head');
            xHead.appendChild(createXHTMLElement('meta', null, null, {charset:'UTF-8'}));
            if (o.title) {
              xHead.appendChild(createXHTMLElement('title', null, o.title));
            }
            if (o.css) {
              xHead.appendChild(createXHTMLElement('link', null, null, {rel:'stylesheet', type:'text/css', href:o.css}));
            }
            if (o.meta) {
              o.meta.forEach(function (p) {
                xHead.appendChild(createXHTMLElement('meta', null, null, p));
              });
            }
            xDoc.documentElement.appendChild(xHead);

            let xBody = createXHTMLElement('body');

            xDoc.documentElement.appendChild(xBody);

            return xDoc;
          };

          let html2xhtml = function (src, root) {
            function cloneElement (src) {
              if (src.tagName) {
                let x = createXHTMLElement(src.tagName.toLocaleLowerCase());
                if (src.hasAttributes()) {
                  let attr = src.attributes;
                  for (let i = 0; i < attr.length; i++) {
                    let a = attr[i];
                    x.setAttribute(a.name, a.value);
                  }
                }
                return x;
              }
            }

            if (src.hasChildNodes()) {
              let children = src.childNodes;
              for (let i = 0; i < children.length; i++) {
                let c = children[i];
                let x = cloneElement(c);
                if (x) {
                  root.appendChild(html2xhtml(c, x));
                }
                else {
                  root.appendChild(c.cloneNode(true));
                }
              }
              return root;
            }
            else {
              let x = cloneElement(src);
              if (x) {
                return x;
              }
              else {
                return src.cloneNode(true);
              }
            }
          };

          let getCoverImage = function () {
            // TODO _s のカットではなく HTML を取得しに行くべき
            let src = elm.novel.cover.querySelector('img').src.replace(/_s\./, '.');
            let ext = AnkUtils.getFileExt(src) || 'jpg';
            let img = {
              src: src,
              referrer: doc.location.href,
              id: 'i-cover',
              filename: 'i-cover.'+ext
            };

            let text = (function () {
              let xDoc = createXHTMLDocument({
                title:context.info.illust.title,
                css:'../style/style.css',
                meta:[
                  {name:'viewport', content:'width=device-width,initial-scale=1.0'}
                ]}
              );

              xDoc.body.setAttribute('epub:type', 'cover');

              let xDiv = createXHTMLElement('div');

              xDiv.appendChild(createXHTMLElement('img', null, null, {src:'../image/'+img.filename}));

              xDoc.body.appendChild(xDiv);

              return '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html>'+new XMLSerializer().serializeToString(xDoc);
            })();

            return {
              img: img,
              chap: {filename:'p-cover.xhtml', title:'表紙'},
              text: {text:text, id:'p-cover', filename:'p-cover.xhtml'}
            };
          };

          let getChapters = function (d) {
            return Array.prototype.map.call(d.querySelectorAll('.chapter'), (e, i) => {
              e.id = 'chap-'+AnkUtils.zeroPad(1+i, 4);
              return {id:e.id, title:AnkUtils.trim(e.textContent)};
            });
          };

          let getArtworks = function (e) {
            let parent = e.parentNode;
            let link = e.querySelector('a');
            let img = link.querySelector('img');
            let cap = (function (e) {
              return !!e && e.classList.contains('caption') && e;
            })(e.nextElementSibling);

            let id = AnkUtils.zeroPad(1+artworkList.length, 4);
            let src = img.src;
            let ext = AnkUtils.getFileExt(src) || 'jpg';
            let info = {
              illust_id: self.getIllustId(link.href),
              src: src,
              referrer: doc.location.href,
              id: 'i-'+id,
              filename: 'i-'+id+'.'+ext
            };

            let newLink = doc.createElement('a');
            newLink.setAttribute('href', 'http://www.pixiv.net/member_illust.php?mode=medium&illust_id='+info.illust_id);

            let newImg = doc.createElement('img');
            newImg.setAttribute('id', info.id);
            newImg.setAttribute('src', '../image/'+info.id+'.jpg');
            newImg.classList.add('inline-image');
            newLink.appendChild(newImg);

            parent.replaceChild(newLink, e);

            if (cap) {
              parent.removeChild(cap);
            }

            return info;
          };

          let fixLinks = function (e) {
            let href = (function (h) {
              let m = /^.*?\/jump\.php\?(.+)$/.exec(h);
              if (m) {
                return decodeURIComponent(m[1]);
              }
              m = /^#(\d+)$/.exec(h);
              if (m) {
                return '../xhtml/'+getPageName(parseInt(m[1],10));
              }
            })(e.getAttribute('href'));

            if (href) {
              e.setAttribute('href', href);
            }
          };

          let getTextContent = function (d) {
            let xDoc = createXHTMLDocument({title:context.info.illust.title, css:'../style/style.css'});
            let xDiv = html2xhtml(d, createXHTMLElement('div'));
            xDoc.body.appendChild(xDiv);

            return '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html>'+new XMLSerializer().serializeToString(xDoc);
          };

          let getIndexContent = function () {
            let xDoc = createXHTMLDocument({title:context.info.illust.title, css:'../style/style.css'});

            let xDiv = createXHTMLElement('div');

            let xTitle = createXHTMLElement('p', 'index-title');
            xTitle.appendChild(createXHTMLElement('a', null, context.info.illust.title, {href:context.info.illust.url}));
            xDiv.appendChild(xTitle);

            let xMember = createXHTMLElement('p', 'index-creator', '作者：');
            xMember.appendChild(createXHTMLElement('a', null, context.info.member.name, {href:'http://www.pixiv.net/member.php?id='+context.info.member.id}));
            xDiv.appendChild(xMember);

            let xPublisher = createXHTMLElement('p', 'index-publisher', '掲載：');
            xPublisher.appendChild(createXHTMLElement('a', null, 'pixiv', {href:'http://www.pixiv.net/'}));
            xDiv.appendChild(xPublisher);

            let xUl = createXHTMLElement('ul');
            chapterList.forEach(function (toc) {
              let xLi = createXHTMLElement('li');
              xLi.appendChild(createXHTMLElement('a', null, toc.title, {'href':'../xhtml/'+toc.filename+(toc.id ? '#'+toc.id : '')}));
              xUl.appendChild(xLi);
            });

            xDiv.appendChild(xUl);

            xDoc.body.appendChild(xDiv);

            let text = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html>'+new XMLSerializer().serializeToString(xDoc);

            return {
              chap: {filename:'p-index.xhtml', title:'目次'},
              text: {text:text, id:'p-index', filename:'p-index.xhtml'}
            };

          };

          let getTocContent = function () {
            let xDoc = createXHTMLDocument({title:'Navigation'});

            let xNav = createXHTMLElement('nav', 'toc', null, {'epub:type':'toc'});

            xNav.appendChild(createXHTMLElement('h1', null, context.info.illust.title));
            let xUl = createXHTMLElement('ul');
            chapterList.forEach(function (toc) {
              let xLi = createXHTMLElement('li');
              xLi.appendChild(createXHTMLElement('a', null, toc.title, {'href':'xhtml/'+toc.filename+(toc.id ? '#'+toc.id : '')}));
              xUl.appendChild(xLi);
            });

            xNav.appendChild(xUl);

            xDoc.body.appendChild(xNav);

            return '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html>'+new XMLSerializer().serializeToString(xDoc);
          };

          let getStandardOpf = function () {
            let xDocType = null;
            let xDoc = document.implementation.createDocument('http://www.idpf.org/2007/opf', 'package', xDocType);
            xDoc.documentElement.setAttribute('version', '3.0');
            xDoc.documentElement.setAttribute('xml:lang', 'ja');
            xDoc.documentElement.setAttribute('unique-identifier', 'unique-id');
            xDoc.documentElement.setAttribute('prefix', 'rendition: http://www.idpf.org/vocab/rendition/#');

            {
              let xMeta = createOpfElement('metadata', null, null, {'xmlns:dc':'http://purl.org/dc/elements/1.1/'});

              xMeta.appendChild(createOpfElement('dc:title', 'title', context.info.illust.title));
              xMeta.appendChild(createOpfElement('dc:creator', 'creator01', context.info.member.name));
              xMeta.appendChild(createOpfElement('meta', null, 'aut', {refines:'#creator01', property:'role', scheme:'marc:relators'}));
              xMeta.appendChild(createOpfElement('dc:publisher', 'publisher', 'pixiv'));
              xMeta.appendChild(createOpfElement('dc:language', null, 'ja'));
              xMeta.appendChild(createOpfElement('dc:identifier', 'unique-id', 'urn:uuid:'+AnkUtils.createUUID()));
              xMeta.appendChild(createOpfElement('meta', null, new Date(context.info.illust.posted).toISOString(), {property:'dcterms:modified'}));

              xMeta.appendChild(createOpfElement('meta', null, 'reflowable', {property:'rendition:layout'}));
              xMeta.appendChild(createOpfElement('meta', null, 'auto', {property:'rendition:spread'}));
              xMeta.appendChild(createOpfElement('meta', null, 'auto', {property:'rendition:orientation'}));

              xDoc.documentElement.appendChild(xMeta);
            }

            {
              let xMani = createOpfElement('manifest');

              let nav = textList[0];
              xMani.appendChild(createOpfElement('item', 'toc', null, {'media-type':'application/xhtml+xml', href:nav.filename, properties:'nav'}));
              xMani.appendChild(createOpfElement('item', 'style', null, {'media-type':'text/css', href:'style/style.css'}));
              artworkList.forEach(function (o) {
                let ext = AnkUtils.getFileExt(o.filename);
                xMani.appendChild(createOpfElement('item', o.id, null, {'media-type':'image/'+(ext === 'jpg' ? 'jpeg' : ext), href:'image/'+o.filename, properties:o.id === 'i-cover' ? 'cover-image' : undefined}));
              });
              textList.forEach(function (o) {
                if (/^p-/.test(o.id)) {
                  xMani.appendChild(createOpfElement('item', o.id, null, {'media-type':'application/xhtml+xml', href:'xhtml/'+o.filename}));
                }
              });

              xDoc.documentElement.appendChild(xMani);
            }

            {
              let xSpine = createOpfElement('spine', null, null, {'page-progression-direction': 'ltr'});

              let nav = textList[0];
              textList.forEach(function (o) {
                if (/^p-/.test(o.id)) {
                  xSpine.appendChild(createOpfElement('itemref', null, null, {idref:o.id, linear:'yes', properties:'page-spread-left'}));
                }
              });

              xDoc.documentElement.appendChild(xSpine);
            }

            return '<?xml version="1.0" encoding="UTF-8"?>'+new XMLSerializer().serializeToString(xDoc);
          };

          let getNovelSource = function () {
            return spawn(function* () {
              let html = yield AnkUtils.Remote.get({
                url: elm.doc.location.href,
                timeout: self.prefs.xhrTimeout
              });

              let doc = AnkUtils.createHTMLDocument(html);

              let e = doc.querySelector('#novel_text');

              return e && e.innerText;
            });
          };

          //

          let doc = elm.doc;

          let chapterList = [];
          let artworkList = [];
          let textList = [];

          Array.prototype.forEach.call(elm.novel.pages, function (page, pageNo) {
            let d = page.cloneNode(true);
            let pageId = getPageId(1+pageNo);
            let pageName = getPageName(1+pageNo);

            getChapters(d).forEach(e => {
              e.pageNo = pageNo;
              e.filename = pageName;
              chapterList.push(e);
            });

            Array.prototype.forEach.call(d.querySelectorAll('.image_container'), e => artworkList.push(getArtworks(e)));

            Array.prototype.forEach.call(d.querySelectorAll('a'), e => fixLinks(e));

            textList.push({text:getTextContent(d), id:pageId, filename:pageName});
          });

          let xIdx = getIndexContent();
          chapterList.unshift(xIdx.chap);
          textList.unshift(xIdx.text);

          let xCov = getCoverImage();
          artworkList.unshift(xCov.img);
          chapterList.unshift(xCov.chap);
          textList.unshift(xCov.text);

          let xToc = getTocContent();
          textList.unshift({text:xToc, id:'toc', filename:'navigation-documents.xhtml'});

          let xOpf = getStandardOpf();
          textList.unshift({text:xOpf, id:'opf', filename:'standard.opf'});

          textList.push({url:chrome.extension.getURL('misc/epub/mimetype'), id:'fix', filename:'mimetype'});
          textList.push({url:chrome.extension.getURL('misc/epub/META-INF/container.xml'), id:'fix', filename:'META-INF/container.xml'});
          textList.push({url:chrome.extension.getURL('misc/epub/item/style/style.css'), id:'fix', filename:'item/style/style.css'});

          if (self.prefs.downloadNovelSource) {
            // XXX HTMLではなくこちらから生成した方がベターですが
            let xSrc = yield getNovelSource();
            textList.push({text:xSrc, id:'src', filename:'source.txt'});
          }

          return {
            artwork: artworkList,
            text: textList
          };
        });
      };

      return Promise.all([getIllustInfo(), getMemberInfo()])
        .then(function (result) {
          context = {
            downloadable: false,
            serviceId: self.SITE_ID,
            siteName: self.sitePrefs.folder,
            path: null,
            info: {
              illust: result[0],
              member: result[1]
            }
          };

          if (!result[0] || !result[1]) {
            return context;
          }

          if (self.elements.novel.nowLoading || self.elements.novel.nowLoadingImage || !self.elements.novel.cover) {
            // XXX プレーンテキストからHTMLを組んでいるので完了までの遅延が大きい
            return context;
          }

          return getPath().then(function (path) {
            context.downloadable = !!path && !!result[0] && !!result[1];
            if (context.downloadable) {
              context.path = {
                original: [path]
              };
            }
            return context;
          });
        });
    }

    return Promise.resolve();
  };

  /**
   * focusイベントのハンドラ
   */
  AnkTwitter.prototype.onFocusHandler = function () {
    let self = this;
  };

  /**
   * イラストページ用機能のインストール
   */
  AnkTwitter.prototype.installFunctions = function () {

    // ページ移動
    let addAddressbarChangeLister = function () {
      // FIXME アドレスバーの値の変更を検出する手段を探す（mozのprogresslistenerみたいなもの。onpopstateはNG）
      let content = self.elements.misc.content;
      let permalink = self.elements.misc.permalink;
      if (!content || !permalink) {
        return false;
      }

      // ツイート<->リプライ<->メディア 等の移動
      new MutationObserver(function () {
        let loc = self.elements.doc.location.href;
        if (loc == curloc) {
          return;
        }

        curloc = loc;
        AnkUtils.Logger.debug('rise contentChange (A): ', self.elements.doc.location.href);
      }).observe(content, {attributes: true});

      // 個別ツイートへの移動
      new MutationObserver(function () {
        let loc = self.elements.doc.location.href;
        if (loc == curloc) {
          return;
        }

        curloc = loc;
        AnkUtils.Logger.debug('rise contentChange (B): ', self.elements.doc.location.href);
      }).observe(permalink, {childList: true});

      return true;
    };

    // ギャラリーオープン
    let addGalleryOpenListener = function () {
      let body = self.elements.misc.body;
      if (!body) {
        return false;
      }

      new MutationObserver(function () {
        let shown = body && body.classList.contains('gallery-enabled');
        AnkUtils.Logger.debug('rise galleryOpen: shown='+shown);
      }).observe(body, {attributes: true});

      return true;
    };

    // ギャラリー移動
    let addGalleryChangeListener = function () {
      let galleryTweet = self.elements.misc.galleryTweet;
      if (!galleryTweet) {
        return false;
      }

      // FIXME 移動後に、移動前のギャラリーの処理結果で表示が上書きされてしまう
      new MutationObserver(function () {
        AnkUtils.Logger.debug('rise galleryChange');
      }).observe(galleryTweet, {childList: true});

      return true;
    };

    // 初期化

    let RETRY_VALUE = {
      max: 30,
      wait: 1000
    };

    let self = this;
    let curloc = null;

    return Promise.all([
        AnkUtils.delayFunctionInstaller({func:addAddressbarChangeLister, retry:RETRY_VALUE, label:'addAddressbarChangeLister'}),
        AnkUtils.delayFunctionInstaller({func:addGalleryOpenListener, retry:RETRY_VALUE, label:'addGalleryOpenListener'}),
        AnkUtils.delayFunctionInstaller({func:addGalleryChangeListener, retry:RETRY_VALUE, label:'addGalleryChangeListener'})
      ])
      .catch(e => AnkUtils.Logger.error(e));
  };

  // 開始

  new AnkTwitter().start();

}
