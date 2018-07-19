
((w) => {
  let f = (p, q) => {
    let fc = (i, k, o) => {
      if (typeof o == 'function') {
        let m = /\.exports\s*=\s*({.+?})/.exec(o.toString());
        if (m) {
          let r = new RegExp('^'+q.split('//').reverse().map((e,i) => '(?=.*\\b'+e+':"(.+?)")').join(''));
          let n = r.exec(m[1]);
          if (n) {
            x.push([n[1], i, k, m[1]]);
          }
        }
      }
    };

    let x = [];
    p.forEach((e, i) => {
      let o = e[1];
      if (Array.isArray(o)) {
        o.forEach((e, k) => fc(i, k, e));
      }
      else {
        for (let k in o) {
          fc(i, k, o[k]);
        }
      }
    });

    return x.length > 0 && x[0][0] || null;
  };

  let a = [
    "illustList",
    "illust",
    "illust//link",
    "illust//zoom",
    "badgeContainer",
    "play",
    "createDate",
    "seriesTitle",
    "contestBanners//title",
    "xRestrict",
    "contestBanners//description",
    "expandable//root",
    "liked//button",
    "tagMeta//tag",
    "authorMeta",
    "authorMeta//authorName",
    "sectionWithBorder//container",
    "expandable//expanderButton",
    "createDate",
    "thumbnailAll",
    "article//body",
    "illustBody",
    "next//link",
    "next",
    "prev",
    "thumbnailStrip",
    "recommendContainer//list",
    "thumbnailBadge//thumbnailLink",
    "thumbnailBadge//thumbnail"
  ];

  let o = {};
  a.forEach((e) => {
    o[e] = f(w, e);
  });

  console.log(JSON.stringify(o, null, ' '));

})(webpackJsonp);
