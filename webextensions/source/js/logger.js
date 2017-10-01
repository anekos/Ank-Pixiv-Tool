"use strict";

{

  var logger ={};

  logger.LEVEL = {
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    OFF: 99
  };

  let METHODS = {
    'log': { level: logger.LEVEL.DEBUG },
    'info': { level: logger.LEVEL.INFO },
    'warn': { level: logger.LEVEL.WARN },
    'error': { level: logger.LEVEL.ERROR }
  };

  logger.setLevel = (level) => {
    Object.keys(METHODS).forEach((m) => {
      logger[m] = (() => {
        if (level <= METHODS[m].level) {
          let f = console[m] || console.log;
          return f.bind(console);
        }

        return () => {};
      })();
    });
  };

}