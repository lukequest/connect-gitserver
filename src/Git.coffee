
# Require native modules
fs = require "fs"
http = require "http"
spawn = require("child_process").spawn
EventEmitter = require("events").EventEmitter

# Require 3rd party modules
mkdirp = require "mkdirp"


class Git extends EventEmitter
  ###
    Git class. Contains all necessary info to manage git repositories.
  ###

  constructor: (opts) ->
    ###
      Constructor, generates the Git object.
    ###
    # Set members
    if typeof opts != "object" then opts = {}
    @autoCreate = !!opts.autoCreate
    @repopath = if typeof opts.repopath == "string" then opts.repopath else "./gitrepos"
    @authCreate = if typeof opts.authCreate == "function" then opts.authCreate else (rq, rs, p, r, cb) -> cb(true)
    @authRead = if typeof opts.authRead == "function" then opts.authRead else (rq, rs, p, r, cb) -> cb(true)
    @authWrite = if typeof opts.authWrite == "function" then opts.authWrite else (rq, rs, p, r, cb) -> cb(true)


  dirMap: require "./dirMap"


  list: (project, callback) ->
    ###
      List all repositories in a project.
    ###
    @dirMap project, (err, dir) =>
      fs.readdir dir, callback


  listProjects: (callback) ->
    ###
      List all projects.
    ###
    @dirMap (err, dir) =>
      if err
        callback err
        return
      fs.readdir dir, callback


  exists: (project, repo, callback) ->
    ###
      Check if a given repo exists.
    ###
    @dirMap project, repo, (err, dir) ->
      if err
        process.nextTick () ->
          callback false
        return
      fs.exists dir, callback


  create: (request, response, project, repo, callback) ->
    ###
      Create a new repository in a project.
    ###

    authChecked = (auth) =>
      doCreate = (err) =>
        if err then return callback err
        cproc = spawn "git", ["--bare", "init", newdir]
        err = ""
        cproc.on "data", (buf) => err += buf
        cproc.on "close", (code) =>
          if typeof callback == "function"
            if code == 0
              callback null
            else
              callback new Error err

      if !auth then return doCreate new Error "Authorization failed."
      newdir = ""
      @dirMap project, repo, (err, dir) =>
        newdir = dir
        if err
          doCreate err
          return
        fs.exists dir, (ex) =>
          if ex
            doCreate new Error "Path already exists!"
          else
            mkdirp dir, doCreate

    @authCreate request, response, project, repo, authChecked.bind(@)




module.exports = Git