var system = require("sdk/system");
// PATH environment variable
console.log(system.env.PATH);
var platform = system.platform;
var tmpdir = system.pathFor('TmpD');
console.log(tmpdir)
