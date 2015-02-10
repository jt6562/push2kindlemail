const system = require("sdk/system");
const fileIO = require("sdk/io/file");
const uuid = require('sdk/util/uuid');
var tabs = require("sdk/tabs"); //.activeTab //.title .url .window .readyState
var tabUtils = require("sdk/tabs/utils");
var { viewFor } = require("sdk/view/core");
const { Cc, Ci, Cu} = require('chrome');
var caller = require("sdk/system/child_process");

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
    var dirPath = fileIO.join(tmpDir, dirName);
    fileIO.mkpath(dirPath)
    console.log("Create temp directory:", dirPath);
    return dirPath;
}

function delTempDir(targetPath) {
    if (fileIO.isFile(targetPath)) {
        fileIO.remove(targetPath);
        return;
    }

    var items = fileIO.list(targetPath);
    for (let i=0; i<items.length; i++) {
        delTempDir(fileIO.join(targetPath, items[i]));
    }

    fileIO.rmdir(targetPath);
    return;
}

function downloadFile(remotePath, localDirPath) {
  var newPath = "";
  try {
    //new obj_URI object
    var obj_URI = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(remotePath, null, null);

    //new file object
    var obj_TargetFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

    //set file with path
    var path = obj_URI.path;
    if (system.platform === "winnt")
        path.replace("/", "\\");
    newPath = localDirPath + path;

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
    newPath = obj_URI.path;
  } catch (e) {
    console.log("error:",e);
  }
  return newPath.slice(1);
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
    for (var i=0; i<imgs.length; i++ ) {
        var path = downloadFile(imgs[i].src, targetDir);
        console.log("Downloaded image:", imgs[i].src, path);
        html = html.replace(imgs[i].src, path);
    }

    //save to disk
    filePath = fileIO.join(targetDir, content.title+".html");
    console.log(filePath);
    var f = fileIO.open(filePath, "w");
    if (!f.closed) {
        header = "<!DOCTYPE "+doctype.name;
        header += ' PUBLIC "'+doctype.publicId+'"';
        header += ' "'+doctype.systemId+'"';
        header += ">\n";
        html = header + html.replace(/<meta.*charset=.*\">/i, '<meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>');
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
    var pathToXpiToRead = fileIO.join(UProfD, "extensions", jid+".xpi");
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
    var targetFile = new FileUtils.File(fileIO.join(dirPath, "kindlegen.exe"));
    zr.extract(entries.getNext(), targetFile);

}

//TODO, Can't find a useful lib to send a email with attachments
//Most of libs is based on nodejs, but firefox can't run right now.
//Next, I will implenment by C/C++ or lua
function send2email(filePath) {
    tabs.open("mailto:@kindle.cn?attach=\""+filePath.replace(".html",".mobi")+"\"");
}

function genKindleBook(htmlPath) {
    kindlegenDirPath = fileIO.join(UProfD, "kindlemail")
    kindlegenFilePath = fileIO.join(kindlegenDirPath, "kindlegen.exe");
    if (!fileIO.exists(kindlegenFilePath)) {
        fileIO.mkpath(kindlegenDirPath);
        getKindlegen(kindlegenDirPath);
    }

    var kindle = caller.spawn(kindlegenFilePath, [htmlPath, '-c2', '-gif']);
    //kindle.stdout.on('data', function (data) {
        //console.log('stdout: ' + data);
    //});

    kindle.stderr.on('data', function (data) {
        console.log('stderr: ' + data);
    });

    kindle.on('close', function (code) {
        console.log('child process exited with code ' + code);
        send2email(htmlPath);
    });

        //delTempDir(fileIO.dirname(htmlPath));
}

function push2kindlemail(state) {
    var targetDir = createTempDir();
    htmlPath = downResource(tabs.activeTab, targetDir);
    genKindleBook(htmlPath);

}

