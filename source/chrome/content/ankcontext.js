
(function (global) {

  var AnkContext = function (module) {

    let self = this;

    self.SERVICE_ID = module.SERVICE_ID;
    self.SITE_NAME = module.SITE_NAME;

    self.in = (function () {
      return {
        manga: module.in.manga,

        medium: module.in.medium,

        illustPage: module.in.illustPage
      };
    })();

    self.info = (function () {
      return {
        illust: {
          pageUrl: module.info.illust.pageUrl,

          externalUrl: module.info.illust.externalUrl,

          id: module.info.illust.id,

          dateTime: module.info.illust.dateTime,

          updated: module.info.illust.updated,

          size: module.info.illust.size,

          tags: module.info.illust.tags || [],

          shortTags: module.info.illust.shortTags || [],

          tools: module.info.illust.tools,

          width: module.info.illust.width || 0,

          height: module.info.illust.height || 0,

          server: module.info.illust.server,

          referer: module.info.illust.referer,

          title: module.info.illust.title,

          comment: module.info.illust.comment,

          R18: module.info.illust.R18,

          animationFrames: module.info.illust.animationFrames
        },

        member: {
          id: module.info.member.id,

          pixivId: module.info.member.pixivId,

          name: module.info.member.name,

          get memoizedName() {
            return this._memoizedName;
          },

          set memoizedName(s) {
            return this._memoizedName = s;
          }
        },

        path: {
          initDir: module.info.path.initDir,

          ext: module.info.path.ext,

          image: module.info.path.image
        }
      };
    })(); // }}}

    self.metaText = (function () { // {{{
      //let pref = AnkBase.Prefs.get('infoText.ignore', 'illust.dateTime.');
      //let ignore = pref ? pref.split(/[,\s]+/) : [];

      // FIXME ignoreが機能していなかったので直そうかと思ったが、今まで出力されていたmeta.txtのいくつかの項目が急に出力されなくなるので、保留
      //ignore = [];
      function indent(s) {
        return (typeof s === 'undefined' ? '---' : s).toString().split(/\n/).map(v => "\t" + v).join("\n");
      }

      function textize(names, value) {
        let name = names.join('.');

        //if (ignore.some(function (v) name.indexOf(v) == 0))
        //  return '';

        if (typeof value === 'object') {
          let result = '';
          for (let [n, v] in Iterator(value)) {
            if (v && typeof v !== 'function')
              result += textize(names.concat([n]), v);
          }
          return result;
        } else {
          return value ? name + "\n" + indent(value) + "\n" : '';
        }
      }

      return textize([], self.info);
    })();
  };

  // --------
  global["AnkContext"] = AnkContext;

})(this);
