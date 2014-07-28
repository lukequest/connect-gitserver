# Require native modules
spawn = require("child_process").spawn

# Require 3rd party modules
through = require "through"
HttpDuplex = require "http-duplex"

module.exports = (opts, req, res) ->
  service = new Service(opts, req, res)

  Object.keys(opts).forEach (key) ->
    service[key] = opts[key]

  return service


headerRE =
  "receive-pack": "([0-9a-fA-F]+) ([0-9a-fA-F]+) refs\/(heads|tags)\/(.*?)( |00|\u0000)|^(0000)$"
  "upload-pack": "^\\S+ ([0-9a-fA-F]+)"


class Service extends HttpDuplex
  constructor: (opts, req, res) ->
    #_super.call @, req, res

    # Members
    @headers = req.headers
    @method = req.method
    @url = req.url
    @status = "pending"
    @repo = opts.repo
    @service = opts.service
    @cwd = opts.cwd

    buffered = through().pause()
    req.pipe(buffered)

    data = ""

    req.once "data", (buf) =>
      data += buf
      ops = data.match(new RegExp(headerRE[@service], 'gi'))

      if !ops then return
      data = undefined

      ops.forEach (op) =>
        m = op.match(new RegExp(headerRE[@service]))

        if @service == "receive-pack"
          @last = m[1]
          @commit = m[2]

          if m[3] == "heads"
            type = "branch"
            @evName = "push"
          else
            type = "version"
            @evName = "tag"

          headers =
            last: @last
            commit: @commit
          headers[type] = @type = m[4]
          @emit "header", headers
        else if @service == "upload-pack"
          @commit = m[1]
          @evName = "fetch"
          @emit "header", commit: @commit

    @once "accept", =>
      process.nextTick =>
        gitproc = spawn "git", [@service, "--stateless-rpc", @cwd]
        @emit "service", gitproc
        gitproc.stdout.pipe res
        buffered.pipe gitproc.stdin
        buffered.resume()
        gitproc.on "exit", @emit.bind(@, "exit")

    @once "reject", (code, msg) ->
      res.statusCode = code
      res.end msg


  accept: (dir) ->
    if @status != "pending" then return
    @status = "accepted"
    @emit "accept", dir


  reject: (code, msg) ->
    if @status != "pending" then return

    if msg == undefined && typeof code == "string"
      msg = code
      code = 500

    @status = "rejected"
    @emit "reject", code || 500, msg