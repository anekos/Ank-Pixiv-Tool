"use strict";

{
  let spawn = this.spawn || function (generatorFunc) {
      function continuer(verb, arg) {
        var result;
        try {
          result = generator[verb](arg);
        } catch (err) {
          return Promise.reject(err);
        }
        if (result.done) {
          return result.value;
        } else {
          return Promise.resolve(result.value).then(onFulfilled, onRejected);
        }
      }
      var generator = generatorFunc();
      var onFulfilled = continuer.bind(continuer, "next");
      var onRejected = continuer.bind(continuer, "throw");
      return onFulfilled();
    };
  
  let sleep = function (ms) {
    return new Promise(function (resolve) {
      setTimeout(() => resolve(), ms);
    });
  };
  
  var ugo = function (c) {
    let self = this;

    self.c = c;
    self.pr = null;
    self.pg = 0;
    self.step = 1;
    self.run = true;
    self.fit = false;
    self.asp = true;

    spawn(function* () {

      let qresize = null;

      let resizer = function (w) {
        if (!self.fit) {
          return;
        }
        var asp = w.innerWidth / w.innerHeight;
        if (asp > self.asp) {
          r.classList.add('fith');
          r.classList.remove('fitw');
          r.classList.remove('nofit');
        }
        else {
          r.classList.add('fitw');
          r.classList.remove('fith');
          r.classList.remove('nofit');
        }
      };

      let p = document.querySelector('#ugo_progress');
      p.setAttribute('max', c.length);

      let r = document.querySelector('#ugo_container');
      r.classList.add('nofit');

      let loadImage = function (o, i) {
        return new Promise(function (resolve) {
          o.e.onload = function (e) {
            e.onload = undefined;
            if (i == 0) {
              self.asp = e.target.naturalWidth / e.target.naturalHeight;
              resizer(window);
            }

            p.setAttribute('value', i+1);
            resolve();
          };

          o.e.setAttribute('src', o.s);
        });
      };

      for (let i=0; i<c.length; i++) {
        let o = c[i];
        o.e = document.createElement('img');
        if (i == 0) {
          o.e.classList.add('en');
        }
        r.appendChild(o.e);

        yield loadImage(o, i);
      }

      p.classList.add('disabled');

      window.addEventListener('resize', function (e) {
        if (!qresize) {
          clearTimeout(qresize);
        }

        qresize = setTimeout(() => { qresize = null; resizer(e.target); }, 200);
      });

      let ovr = document.querySelector('#ugo_overlay');
      ovr.addEventListener('click', e => self.run ? self.pause() : self.continue(), false);

      self.start();
    });
  };

  ugo.prototype.start = function () {
    console.log('hoge');
    let self = this;
    spawn(function* () {
      while (self.run) {
        let o = self.c[self.pg];
        o.e.classList.add("en");
        if (self.pr) {
          self.pr.classList.remove("en");
        }
        self.pr = o.e;
        self.pg = (self.pg + self.step) % (self.c.length);
        if (self.run) {
          yield sleep(o.w);
        }
      }
    });
  };

  ugo.prototype.pause = function () {
    this.run = false;
  };

  ugo.prototype.continue = function () {
    if (!this.run) {
      this.run = true;
      this.start();
    }
  };

  ugo.prototype.fw = function () {
    this.step = 1;
  };

  ugo.prototype.bw = function () {
    this.step = self.c.length - 1;
  };

}
