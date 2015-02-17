
// 起動時に読み込むサイト別モジュールの一覧はここに書く

(function (global) {

  var SiteModuleList = (function () {
    const SITES = [
      'sites/ankimgly.js',
      'sites/anknicosei.js',
      'sites/anknijie.js',
      'sites/ankpixiv.js',
      'sites/anktinami.js',
      'sites/anktumblr.js',
      'sites/anktwipple.js',
      'sites/anktwitpic.js',
      'sites/anktwitter.js'
    ];

    return {
      SITES: SITES
    };
  })();

  // --------
  global["exports"] = SiteModuleList;

})(this);
