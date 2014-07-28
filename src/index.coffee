###
  connect-gitserver main module file.
###

Git = require "./Git"
middleware = require "./middleware"

module.exports = (opts) ->
  # Create Git system object
  gitsys = new Git(opts)

  ret =
    middleware: (request, response, next) ->
      middleware request, response, next, gitsys
    sys: gitsys

  return ret