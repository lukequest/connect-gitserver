(function() {
  var EventEmitter, Git, fs, http, mkdirp, spawn,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  fs = require("fs");

  http = require("http");

  spawn = require("child_process").spawn;

  EventEmitter = require("events").EventEmitter;

  mkdirp = require("mkdirp");

  Git = (function(_super) {
    __extends(Git, _super);


    /*
      Git class. Contains all necessary info to manage git repositories.
     */

    function Git(opts) {

      /*
        Constructor, generates the Git object.
       */
      if (typeof opts !== "object") {
        opts = {};
      }
      this.autoCreate = !!opts.autoCreate;
      this.repopath = typeof opts.repopath === "string" ? opts.repopath : "./gitrepos";
      this.authCreate = typeof opts.authCreate === "function" ? opts.authCreate : function(rq, rs, p, r, cb) {
        return cb(true);
      };
      this.authRead = typeof opts.authRead === "function" ? opts.authRead : function(rq, rs, p, r, cb) {
        return cb(true);
      };
      this.authWrite = typeof opts.authWrite === "function" ? opts.authWrite : function(rq, rs, p, r, cb) {
        return cb(true);
      };
    }

    Git.prototype.dirMap = require("./dirMap");

    Git.prototype.list = function(project, callback) {

      /*
        List all repositories in a project.
       */
      return this.dirMap(project, (function(_this) {
        return function(err, dir) {
          return fs.readdir(dir, callback);
        };
      })(this));
    };

    Git.prototype.listProjects = function(callback) {

      /*
        List all projects.
       */
      return this.dirMap((function(_this) {
        return function(err, dir) {
          if (err) {
            callback(err);
            return;
          }
          return fs.readdir(dir, callback);
        };
      })(this));
    };

    Git.prototype.exists = function(project, repo, callback) {

      /*
        Check if a given repo exists.
       */
      return this.dirMap(project, repo, function(err, dir) {
        if (err) {
          process.nextTick(function() {
            return callback(false);
          });
          return;
        }
        return fs.exists(dir, callback);
      });
    };

    Git.prototype.create = function(request, response, project, repo, callback) {

      /*
        Create a new repository in a project.
       */
      var authChecked;
      authChecked = (function(_this) {
        return function(auth) {
          var doCreate, newdir;
          doCreate = function(err) {
            var cproc;
            if (err) {
              return callback(err);
            }
            cproc = spawn("git", ["--bare", "init", newdir]);
            err = "";
            cproc.on("data", function(buf) {
              return err += buf;
            });
            return cproc.on("close", function(code) {
              if (typeof callback === "function") {
                if (code === 0) {
                  return callback(null);
                } else {
                  return callback(new Error(err));
                }
              }
            });
          };
          if (!auth) {
            return doCreate(new Error("Authorization failed."));
          }
          newdir = "";
          return _this.dirMap(project, repo, function(err, dir) {
            newdir = dir;
            if (err) {
              doCreate(err);
              return;
            }
            return fs.exists(dir, function(ex) {
              if (ex) {
                return doCreate(new Error("Path already exists!"));
              } else {
                return mkdirp(dir, doCreate);
              }
            });
          });
        };
      })(this);
      return this.authCreate(request, response, project, repo, authChecked.bind(this));
    };

    return Git;

  })(EventEmitter);

  module.exports = Git;

}).call(this);
