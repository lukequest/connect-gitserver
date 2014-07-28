path = require "path"

module.exports = () ->
  ###
    Map a given directory name to a repo path.
  ###
  arglen = Object.keys(arguments).length
  projectDir = @repopath
  err = null

  if arglen == 0
    return @repopath

  # (project, repo, callback)
  if arglen >= 3
    project = arguments["0"]
    repo = arguments["1"]
    callback = arguments["2"]
    if typeof project == "string" && typeof repo == "string"
      projectDir = path.join @repopath, project, repo
    else
      err = new Error "Invalid arguments."

  # (project, callback)
  if arglen == 2
    project = arguments["0"]
    callback = arguments["1"]
    if typeof project == "string"
      projectDir = path.join @repopath, project
    else
      err = new Error "Invalid arguments."

  # (callback)
  if arglen == 1
    callback = arguments["0"]

  if typeof callback == "function"
    process.nextTick () ->
      callback(err, projectDir)