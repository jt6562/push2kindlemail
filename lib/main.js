const system = require("sdk/system");
const fileIO = require("sdk/io/file");
const uuid = require('sdk/util/uuid');
var tabs = require("sdk/tabs"); //.activeTab //.title .url .window .readyState
var tabUtils = require("sdk/tabs/utils");
var { viewFor } = require("sdk/view/core");
const { Cc, Ci, Cu} = require('chrome');
var caller = require("sdk/system/child_process");

//var platform = system.platform;
var tmpDir = system.pathFor('TmpD');
var UProfD = system.pathFor('ProfD');

var buttons = require('sdk/ui/button/action');
var button = buttons.ActionButton({
    id: "push2kindlemail",
    label: "push2kindlemail",
    icon: {
      "16": "./icon-16.png",
      "32": "./icon-32.png",
      "64": "./icon-64.png"
    },
    onClick: push2kindlemail
  });

function createTempDir() {
    var dirName = uuid.uuid().toString().slice(1, -1);
    var dirPath = tmpDir + "/" + dirName;
    fileIO.mkpath(dirPath)
    console.log("Create temp directory:", dirPath);
    return dirPath;
}

function walkDir(dirPath, fileFunc, dirFunc) {

}

function delTempDir() {

}

function downloadFile(remotePath, localDirPath) {
  var newPath = "";
  try {
    //new obj_URI object
    var obj_URI = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(remotePath, null, null);

    //new file object
    var obj_TargetFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

    //set file with path
    newPath = localDirPath+obj_URI.path;
    obj_TargetFile.initWithPath(newPath);
    //if file doesn't exist, create
    if(!obj_TargetFile.exists()) {
      obj_TargetFile.create(0x00,0644);
    }

    //new persistence object
    var obj_Persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);

    // with persist flags if desired
    const nsIWBP = Ci.nsIWebBrowserPersist;
    const flags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES;
    obj_Persist.persistFlags = flags | nsIWBP.PERSIST_FLAGS_FROM_CACHE;

    //save file to target
    obj_Persist.saveURI(obj_URI,null,null,null,null,obj_TargetFile,null);
  } catch (e) {
    console.log(e);
  }
  return newPath;
}

function downResource(tab, targetDir) {
    //get XUL tab
    tabXul = viewFor(tab);
    //htmlContent = tabXul.getElementsByTagName("html");
    //console.log(htmlContent.innerHTML);

    //get html content
    var browser = tabUtils.getBrowserForTab(tabXul);
    content = browser.contentDocument;
    doctype = content.doctype;
    html = content.documentElement.outerHTML;

    //parse html and download images
    imgs = content.images; //content.getElementsByTagName('img');
    console.log(imgs);
    for (var i=0; i<imgs.length; i++ ) {
        var newPath = downloadFile(imgs[i].src, targetDir);
        console.log("Downloaded image:", imgs[i].src);
        html = html.replace(imgs[i].src, newPath);
    }

    //save to disk
    filePath = targetDir+"/"+content.title+".html";
    console.log(filePath);
    var f = fileIO.open(filePath, "w");
    if (!f.closed) {
        header = "<!DOCTYPE "+doctype.name;
        header += ' PUBLIC "'+doctype.publicId+'"';
        header += ' "'+doctype.systemId+'"';
        header += ">\n";
        html = header + html.replace(/ charset=[^\"]+\">/i, ' charset=UTF-8">');
        f.write(html, "UTF-8");
        f.close();
    }

    return filePath;
}

console.log(UProfD);

function getKindlegen(dirPath) {
    console.log("Get kindlegen from xpi file")
    var jid = require("sdk/self").id;
    var zr = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    Cu.import('resource://gre/modules/osfile.jsm');
    Cu.import('resource://gre/modules/FileUtils.jsm');
    var pathToXpiToRead = UProfD+"/extensions/"+jid+".xpi";
    console.log(pathToXpiToRead);
    var nsiFileXpi = new FileUtils.File(pathToXpiToRead);
    zr.open(nsiFileXpi);
    kindlegenName = "";
    if (system.platform === "linux")
        kindlegenName = "kindlegen_linux";
    else if (system.platform === "winnt")
        kindlegenName = "kindlegen_win32.exe";
    else if (system.platform === "darwin")
        kindlegenName = "kindlegen_osx";

    var entries = zr.findEntries("*"+kindlegenName);
    var targetFile = new FileUtils.File(dirPath+"/kindlegen")
    zr.extract(entries.getNext(), targetFile);

}

function genKindleBook(htmlPath) {
    kindlegen = UProfD+"/kindlemail/kindlegen";
    if (!fileIO.exists(kindlegen)) {
        fileIO.mkpath(UProfD+"/kindlemail");
        getKindlegen(UProfD+"/kindlemail");
    }

    var kindle = caller.spawn(kindlegen, [htmlPath, '-c2', '-gif']);
    kindle.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
    });

    kindle.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });

    kindle.on('close', function (code) {
        console.log('child process exited with code ' + code);
    });

}

function push2kindlemail(state) {
    var targetDir = createTempDir();
    htmlPath = downResource(tabs.activeTab, targetDir);
    genKindleBook(htmlPath);

    //TODO:mailto
}

