(function() {
  var HttpDuplex, backrx, cmdrx, createAction, fs, gitrx, handlers, infoResponse, inforx, nocache, services, spawn, tarrx;

  HttpDuplex = require("http-duplex");

  nocache = require("./nocache");

  infoResponse = require("./info");

  createAction = require("./service");

  fs = require("fs");

  spawn = require("child_process").spawn;

  gitrx = /^\/([\w-]+)\/([\w-]+\.git)([/\w_\-\.]*)$/;

  inforx = /\/(.+)\/info\/refs$/;

  cmdrx = /git-(.+)/;

  backrx = /\.\./;

  tarrx = /^\/(tar|zip)(\/([a-z0-9\.\-]*))*$/;

  services = ["upload-pack", "receive-pack"];

  module.exports = function(request, response, next, gitsvc) {
    var git, gitpath;
    gitpath = gitrx.exec(request.path);
    if (gitpath) {
      git = {
        svc: gitsvc,
        project: gitpath[1],
        repo: gitpath[2],
        cmd: gitpath[3]
      };
      if (handlers.info(request, response, git) === false) {
        if (handlers.head(request, response, git) === false) {
          if (handlers.post(request, response, git) === false) {
            if (handlers.archive(request, response, git) === false) {
              if (handlers.badmethod(request, response) === false) {
                response.statusCode = 404;
                return response.end('not found');
              }
            }
          }
        }
      }
    } else {
      return next();
    }
  };

  handlers = {
    archive: function(request, response, git) {
      var arch, method, version;
      arch = tarrx.exec(git.cmd);
      if (request.method !== "GET" || !arch) {
        return false;
      }
      method = arch[1];
      version = arch[3] || "master";
      return git.svc.authRead(request, response, git.project, git.repo, function(auth) {
        if (!auth) {
          response.statusCode = 401;
          response.end("Unauthorized");
          return;
        }
        return git.svc.dirMap(git.project, git.repo, function(err, dir) {
          var gitarch;
          if (err) {
            response.statusCode = 404;
            response.setHeader("content-type", "text/plain");
            response.end("repository not found");
            return;
          }
          gitarch = spawn("git", ["archive", version, "--format", method], {
            cwd: dir
          });
          response.set("Content-Type", "application/x-tar");
          gitarch.stdout.pipe(response);
          return gitarch.stderr.on("data", function(err) {
            return console.error(err.toString());
          });
        });
      });
    },
    info: function(request, response, git) {
      if (request.method !== "GET" || git.cmd !== "/info/refs") {
        return false;
      }
      if (backrx.test(git.repo)) {
        return false;
      }
      return git.svc.authRead(request, response, git.project, git.repo, function(auth) {
        var svc;
        if (!auth) {
          response.statusCode = 401;
          response.end("Unauthorized");
          return;
        }
        if (!request.query.service) {
          response.statusCode = 400;
          response.end("service parameter required");
          return;
        }
        svc = request.query.service.replace(/^git-/, "");
        if (services.indexOf(svc) < 0) {
          response.statusCode = 405;
          response.end("service not available");
          return;
        }
        return infoResponse({
          git: git,
          service: svc
        }, request, response);
      });
    },
    head: function(request, response, git) {
      if (request.method !== "GET" || git.cmd !== "HEAD") {
        return false;
      }
      if (backrx.test(git.repo)) {
        return false;
      }
      return git.svc.authRead(request, response, git.project, git.repo, function(auth) {
        if (!auth) {
          response.statusCode = 401;
          response.end("Unauthorized");
          return;
        }
        return git.svc.dirMap(git.project, git.repo, function(err, dir) {
          var next;
          if (err) {
            response.statusCode = 404;
            response.setHeader("content-type", "text/plain");
            response.end("repository not found");
            return;
          }
          next = function() {
            var file;
            file = path.join(dir, "HEAD");
            return fs.exists(file, function(ex) {
              if (ex) {
                return fs.createReadStream(file).pipe(response);
              } else {
                response.statusCode = 404;
                response.setHeader("content-type", "text/plain");
                response.end("repository not found");
              }
            });
          };
          return git.svc.exists(git.project, git.repo, function(ex) {
            var anyListeners, dup;
            anyListeners = git.svc.listeners('head').length > 0;
            dup = HttpDuplex(request, response);
            dup.exists = ex;
            dup.repo = git.repo;
            dup.cwd = dir;
            dup.accept = dup.emit.bind(dup, "accept");
            dup.reject = dup.emit.bind(dup, "reject");
            dup.once("reject", function(code) {
              response.statusCode = code || 500;
              response.end();
            });
            if (!ex && git.svc.autoCreate) {
              dup.once("accept", function() {
                return git.svc.create(request, response, git.project, git.repo, next);
              });
              git.svc.emit("head", dup);
              if (!anyListeners) {
                return dup.accept();
              }
            } else if (!ex) {
              response.statusCode = 404;
              response.setHeader("content-type", "text/plain");
              response.end("repository not found");
            } else {
              dup.once("accept", next);
              git.svc.emit("head", dup);
              if (!anyListeners) {
                return dup.accept();
              }
            }
          });
        });
      });
    },
    post: function(request, response, git) {
      var checkAuth, cm, service;
      if (request.method !== "POST") {
        return false;
      }
      cm = cmdrx.exec(git.cmd);
      if (!cm) {
        return false;
      }
      if (backrx.test(cm[1])) {
        return false;
      }
      service = cm[1];
      if (services.indexOf(service) < 0) {
        response.statusCode = 405;
        response.end("service not available");
        return;
      }
      if (service === "upload-pack") {
        checkAuth = "authRead";
      } else {
        checkAuth = "authWrite";
      }
      return git.svc[checkAuth](request, response, git.project, git.repo, function(auth) {
        if (!auth) {
          response.statusCode = 401;
          response.end("Unauthorized");
          return;
        }
        return git.svc.dirMap(git.project, git.repo, function(err, dir) {
          var action;
          if (err) {
            response.statusCode = 404;
            response.setHeader("content-type", "text/plain");
            response.end("repository not found");
            return;
          }
          response.set("content-type", "application/x-git-" + service + "-result");
          nocache(response);
          action = createAction({
            repo: git.repo,
            service: service,
            cwd: dir
          }, request, response);
          return action.on("header", function() {
            var anyListeners, evName;
            evName = action.evName;
            anyListeners = git.svc.listeners(evName).length > 0;
            git.svc.emit(evName, action);
            if (!anyListeners) {
              return action.accept();
            }
          });
        });
      });
    },
    badmethod: function(request, response) {
      if (request.method !== "GET" && request.method !== "POST") {
        response.statusCode = 405;
        return response.end("method not supported");
      } else {
        return false;
      }
    }
  };

}).call(this);
