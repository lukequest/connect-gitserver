(function() {
  var path;

  path = require("path");

  module.exports = function() {

    /*
      Map a given directory name to a repo path.
     */
    var arglen, callback, err, project, projectDir, repo;
    arglen = Object.keys(arguments).length;
    projectDir = this.repopath;
    err = null;
    if (arglen === 0) {
      return this.repopath;
    }
    if (arglen >= 3) {
      project = arguments["0"];
      repo = arguments["1"];
      callback = arguments["2"];
      if (typeof project === "string" && typeof repo === "string") {
        projectDir = path.join(this.repopath, project, repo);
      } else {
        err = new Error("Invalid arguments.");
      }
    }
    if (arglen === 2) {
      project = arguments["0"];
      callback = arguments["1"];
      if (typeof project === "string") {
        projectDir = path.join(this.repopath, project);
      } else {
        err = new Error("Invalid arguments.");
      }
    }
    if (arglen === 1) {
      callback = arguments["0"];
    }
    if (typeof callback === "function") {
      return process.nextTick(function() {
        return callback(err, projectDir);
      });
    }
  };

}).call(this);
