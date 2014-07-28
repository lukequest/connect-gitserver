# Require native modules
spawn = require("child_process").spawn

# Require 3rd party modules
HttpDuplex = require "http-duplex"

# Require own modules
nocache = require "./nocache"

module.exports = (opts, request, response) ->
  git = opts.git
  dup = HttpDuplex(request, response)
  git.svc.dirMap git.project, git.repo, (err, dir) ->
    if err
      response.statusCode = 500
      response.end()
      return

    dup.cwd = dir

    dup.accept = dup.emit.bind dup, "accept"
    dup.reject = dup.emit.bind dup, "reject"

    dup.once "reject", (code) ->
      response.statusCode = code || 500
      response.end()
      return

    anyListeners = git.svc.listeners('info').length > 0

    git.svc.exists git.project, git.repo, (ex) ->
      dup.exists = ex

      if !ex && git.svc.autoCreate
        dup.once "accept", ->
          git.svc.create request, git.project, git.repo, next
        git.svc.emit "info", dup
        if !anyListeners then dup.accept()
      else if !ex
        response.statusCode = 404
        response.setHeader "content-type", "text/plain"
        response.end "repository not found"
        return
      else
        dup.once "accept", next
        git.svc.emit "info", dup
        if !anyListeners then dup.accept()

    next = (err) ->
      if err
        response.statusCode = code || 500
        response.end()
        return
      response.setHeader "content-type", "application/x-git-" + opts.service + "-advertisement"
      nocache response
      serviceRespond opts.service, dir, response

serviceRespond = (service, file, response) ->
  pack = (s) ->
    n = (4 + s.length).toString(16)
    return Array(4 - n.length + 1).join("0") + n + s

  response.write(pack("# service=git-" + service + "\n"))
  response.write("0000")

  gitproc = spawn "git", [service, "--stateless-rpc", "--advertise-refs", file]
  gitproc.stdout.pipe response
