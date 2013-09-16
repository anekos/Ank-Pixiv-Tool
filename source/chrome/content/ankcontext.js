
function AnkContext (module) {

  if (!module)
    return null;

  let self = this;

  self.SERVICE_ID = module.SERVICE_ID;
  self.SITE_NAME  = module.SITE_NAME;

  self.downloadable = module.downloadable;

  self.in = {
    site:
      module.in.site,

    manga:
      module.in.manga,

    medium:
      module.in.medium,

    illustPage:
      module.in.illustPage,

    myPage:
      module.in.myPage,

    myIllust:
      module.in.myIllust,
  };

  self.elements = {
    illust: {
      downloadedDisplayParent:
        module.elements.illust.downloadedDisplayParent,
    },
  };

  self.info = {
    illust: {
      pageUrl:
        module.info.illust.pageUrl,

      id:
        module.info.illust.id,

      dateTime:
        module.info.illust.dateTime,

      size:
        module.info.illust.size,

      tags:
        module.info.illust.tags,

      shortTags:
        module.info.illust.shortTags,

      tools:
        module.info.illust.tools,

      width:
        module.info.illust.width,

      height:
        module.info.illust.height,

      server:
        module.info.illust.server,

      referer:
        module.info.illust.referer,

      title:
        module.info.illust.title,

      comment:
        module.info.illust.comment,

      R18:
        module.info.illust.R18,
    },

    member: {
      id:
        module.info.member.id,

      pixivId:
        module.info.member.pixivId,

      name:
        module.info.member.name,

      memoizedName:
        module.info.member.memoizedName,
    },

    path: {
      initDir:
        module.info.path.initDir,

      ext:
        module.info.path.ext,

      image:
        module.info.path.image,
    },
  }; // }}}

  return self;
}