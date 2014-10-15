(function() {
  var HttpDuplex, Service, headerRE, spawn, through,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  spawn = require("child_process").spawn;

  through = require("through");

  HttpDuplex = require("http-duplex");

  module.exports = function(opts, req, res) {
    var service;
    service = new Service(opts, req, res);
    Object.keys(opts).forEach(function(key) {
      return service[key] = opts[key];
    });
    return service;
  };

  headerRE = {
    "receive-pack": "([0-9a-fA-F]+) ([0-9a-fA-F]+) refs\/(heads|tags)\/(.*?)( |00|\u0000)|^(0000)$",
    "upload-pack": "^\\S+ ([0-9a-fA-F]+)"
  };

  Service = (function(_super) {
    __extends(Service, _super);

    function Service(opts, req, res) {
      var buffered, data;
      this.headers = req.headers;
      this.method = req.method;
      this.url = req.url;
      this.status = "pending";
      this.repo = opts.repo;
      this.service = opts.service;
      this.cwd = opts.cwd;
      buffered = through().pause();
      req.pipe(buffered);
      data = "";
      req.once("data", (function(_this) {
        return function(buf) {
          var ops;
          data += buf;
          ops = data.match(new RegExp(headerRE[_this.service], 'gi'));
          if (!ops) {
            return;
          }
          data = void 0;
          return ops.forEach(function(op) {
            var headers, m, type;
            m = op.match(new RegExp(headerRE[_this.service]));
            if (_this.service === "receive-pack") {
              _this.last = m[1];
              _this.commit = m[2];
              if (m[3] === "heads") {
                type = "branch";
                _this.evName = "push";
              } else {
                type = "version";
                _this.evName = "tag";
              }
              headers = {
                last: _this.last,
                commit: _this.commit
              };
              headers[type] = _this.type = m[4];
              return _this.emit("header", headers);
            } else if (_this.service === "upload-pack") {
              _this.commit = m[1];
              _this.evName = "fetch";
              return _this.emit("header", {
                commit: _this.commit
              });
            }
          });
        };
      })(this));
      this.once("accept", (function(_this) {
        return function() {
          return process.nextTick(function() {
            var gitproc;
            gitproc = spawn("git", [_this.service, "--stateless-rpc", _this.cwd]);
            _this.emit("service", gitproc);
            gitproc.stdout.pipe(res);
            buffered.pipe(gitproc.stdin);
            buffered.resume();
            return gitproc.on("exit", _this.emit.bind(_this, "exit"));
          });
        };
      })(this));
      this.once("reject", function(code, msg) {
        res.statusCode = code;
        return res.end(msg);
      });
    }

    Service.prototype.accept = function(dir) {
      if (this.status !== "pending") {
        return;
      }
      this.status = "accepted";
      return this.emit("accept", dir);
    };

    Service.prototype.reject = function(code, msg) {
      if (this.status !== "pending") {
        return;
      }
      if (msg === void 0 && typeof code === "string") {
        msg = code;
        code = 500;
      }
      this.status = "rejected";
      return this.emit("reject", code || 500, msg);
    };

    return Service;

  })(HttpDuplex);

}).call(this);
