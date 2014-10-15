
/*
  connect-gitserver main module file.
 */

(function() {
  var Git, middleware;

  Git = require("./Git");

  middleware = require("./middleware");

  module.exports = function(opts) {
    var gitsys, ret;
    gitsys = new Git(opts);
    ret = {
      middleware: function(request, response, next) {
        return middleware(request, response, next, gitsys);
      },
      sys: gitsys
    };
    return ret;
  };

}).call(this);
