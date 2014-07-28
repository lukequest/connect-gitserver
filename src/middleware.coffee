# Require 3rd party modules
HttpDuplex = require "http-duplex"

# Require own modules
nocache = require "./nocache"
infoResponse = require "./info"
createAction = require "./service"

fs = require "fs"
{spawn} = require "child_process"

gitrx = /^\/([\w-]+)\/([\w-]+\.git)([/\w_\-\.]*)$/
inforx = /\/(.+)\/info\/refs$/
cmdrx = /git-(.+)/
backrx = /\.\./
tarrx = /^\/(tar|zip)(\/([a-z0-9\.\-]*))*$/

services = [ "upload-pack", "receive-pack" ]

module.exports = (request, response, next, gitsvc) ->
  # request.user
  gitpath = gitrx.exec request.path
  if gitpath
    git =
      svc: gitsvc
      project: gitpath[1]
      repo: gitpath[2]
      cmd: gitpath[3]
    if handlers.info(request, response, git) == false
      if handlers.head(request, response, git) == false
        if handlers.post(request, response, git) == false
          if handlers.archive(request, response, git) == false
            if handlers.badmethod(request, response) == false
              response.statusCode = 404
              response.end('not found')
  else
    next()


handlers =
  archive: (request, response, git) ->
    # Must be GET /tar|zip/[version]
    arch = tarrx.exec git.cmd
    if request.method != "GET" || !arch then return false
    method = arch[1]
    version = arch[3] || "master"

    # Check auth
    git.svc.authRead request, response, git.project, git.repo, (auth) ->
      if !auth
        response.statusCode = 401
        response.end "Unauthorized"
        return

      git.svc.dirMap git.project, git.repo, (err, dir) ->
        if err
          response.statusCode = 404
          response.setHeader "content-type", "text/plain"
          response.end "repository not found"
          return

        gitarch = spawn "git", ["archive", version, "--format", method], cwd: dir
        response.set "Content-Type", "application/x-tar"
        gitarch.stdout.pipe response
        gitarch.stderr.on "data", (err) ->
          console.error err.toString()


  info: (request, response, git) ->
    # Must be GET /info/refs
    if request.method != "GET" || git.cmd != "/info/refs" then return false
    if backrx.test(git.repo) then return false

    # Check auth
    git.svc.authRead request, response, git.project, git.repo, (auth) ->
      if !auth
        response.statusCode = 401
        response.end "Unauthorized"
        return

      # Service required
      if !request.query.service
        response.statusCode = 400
        response.end "service parameter required"
        return

      svc = request.query.service.replace /^git-/, ""

      if services.indexOf(svc) < 0
        response.statusCode = 405
        response.end "service not available"
        return

      infoResponse
        git: git,
        service: svc
      , request, response


  head: (request, response, git) ->
    # Must be GET HEAD
    if request.method != "GET" || git.cmd != "HEAD" then return false
    if backrx.test(git.repo) then return false

    # Check auth
    git.svc.authRead request, response, git.project, git.repo, (auth) ->
      if !auth
        response.statusCode = 401
        response.end "Unauthorized"
        return

      git.svc.dirMap git.project, git.repo, (err, dir) ->
        if err
          response.statusCode = 404
          response.setHeader "content-type", "text/plain"
          response.end "repository not found"
          return

        next = ->
          file = path.join dir, "HEAD"
          fs.exists file, (ex) ->
            if ex
              fs.createReadStream(file).pipe(response)
            else
              response.statusCode = 404
              response.setHeader "content-type", "text/plain"
              response.end "repository not found"
              return

        git.svc.exists git.project, git.repo, (ex) ->
          anyListeners = git.svc.listeners('head').length > 0
          dup = HttpDuplex(request, response)
          dup.exists = ex
          dup.repo = git.repo
          dup.cwd = dir

          dup.accept = dup.emit.bind dup, "accept"
          dup.reject = dup.emit.bind dup, "reject"

          dup.once "reject", (code) ->
            response.statusCode = code || 500
            response.end()
            return

          if !ex && git.svc.autoCreate
            dup.once "accept", ->
              git.svc.create request, response, git.project, git.repo, next
            git.svc.emit "head", dup
            if !anyListeners then dup.accept()
          else if !ex
            response.statusCode = 404
            response.setHeader "content-type", "text/plain"
            response.end "repository not found"
            return
          else
            dup.once "accept", next
            git.svc.emit "head", dup
            if !anyListeners then dup.accept()


  post: (request, response, git) ->
    # Must be GET HEAD
    if request.method != "POST" then return false
    cm = cmdrx.exec git.cmd
    if !cm then return false
    if backrx.test(cm[1]) then return false

    service = cm[1]

    if services.indexOf(service) < 0
      response.statusCode = 405
      response.end "service not available"
      return

    if service == "upload-pack" then checkAuth = "authRead" else checkAuth = "authWrite"

    # Check auth
    git.svc[checkAuth] request, response, git.project, git.repo, (auth) ->
      if !auth
        response.statusCode = 401
        response.end "Unauthorized"
        return

      git.svc.dirMap git.project, git.repo, (err, dir) ->
        if err
          response.statusCode = 404
          response.setHeader "content-type", "text/plain"
          response.end "repository not found"
          return

        response.set "content-type", "application/x-git-" + service + "-result"
        nocache response

        action = createAction
          repo: git.repo
          service: service
          cwd: dir
        , request, response

        action.on "header", ->
          evName = action.evName
          anyListeners = git.svc.listeners(evName).length > 0
          git.svc.emit evName, action
          if !anyListeners then action.accept()

  badmethod: (request, response) ->
    # Must be GET or POST
    if request.method != "GET" && request.method != "POST"
      response.statusCode = 405
      response.end "method not supported"
    else
      return false



