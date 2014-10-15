(function() {
  var egit, git;

  egit = require("./index");

  git = egit({
    autoCreate: true,
    repopath: "../../gitrepos"
  });

  git.sys.create(null, null, "testproject", "testrepo", function() {
    return console.log("done");
  });

}).call(this);
