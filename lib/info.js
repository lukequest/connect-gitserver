(function() {
  var HttpDuplex, nocache, serviceRespond, spawn;

  spawn = require("child_process").spawn;

  HttpDuplex = require("http-duplex");

  nocache = require("./nocache");

  module.exports = function(opts, request, response) {
    var dup, git;
    git = opts.git;
    dup = HttpDuplex(request, response);
    return git.svc.dirMap(git.project, git.repo, function(err, dir) {
      var anyListeners, next;
      if (err) {
        response.statusCode = 500;
        response.end();
        return;
      }
      dup.cwd = dir;
      dup.accept = dup.emit.bind(dup, "accept");
      dup.reject = dup.emit.bind(dup, "reject");
      dup.once("reject", function(code) {
        response.statusCode = code || 500;
        response.end();
      });
      anyListeners = git.svc.listeners('info').length > 0;
      git.svc.exists(git.project, git.repo, function(ex) {
        dup.exists = ex;
        if (!ex && git.svc.autoCreate) {
          dup.once("accept", function() {
            return git.svc.create(request, git.project, git.repo, next);
          });
          git.svc.emit("info", dup);
          if (!anyListeners) {
            return dup.accept();
          }
        } else if (!ex) {
          response.statusCode = 404;
          response.setHeader("content-type", "text/plain");
          response.end("repository not found");
        } else {
          dup.once("accept", next);
          git.svc.emit("info", dup);
          if (!anyListeners) {
            return dup.accept();
          }
        }
      });
      return next = function(err) {
        if (err) {
          response.statusCode = code || 500;
          response.end();
          return;
        }
        response.setHeader("content-type", "application/x-git-" + opts.service + "-advertisement");
        nocache(response);
        return serviceRespond(opts.service, dir, response);
      };
    });
  };

  serviceRespond = function(service, file, response) {
    var gitproc, pack;
    pack = function(s) {
      var n;
      n = (4 + s.length).toString(16);
      return Array(4 - n.length + 1).join("0") + n + s;
    };
    response.write(pack("# service=git-" + service + "\n"));
    response.write("0000");
    gitproc = spawn("git", [service, "--stateless-rpc", "--advertise-refs", file]);
    return gitproc.stdout.pipe(response);
  };

}).call(this);
