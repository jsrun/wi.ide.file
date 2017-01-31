/**
 *  __          __  _    _____ _____  ______   ______ _ _      
 *  \ \        / / | |  |_   _|  __ \|  ____| |  ____(_) |     
 *   \ \  /\  / /__| |__  | | | |  | | |__    | |__   _| | ___ 
 *    \ \/  \/ / _ \ '_ \ | | | |  | |  __|   |  __| | | |/ _ \
 *     \  /\  /  __/ |_) || |_| |__| | |____ _| |    | | |  __/
 *      \/  \/ \___|_.__/_____|_____/|______(_)_|    |_|_|\___| 
 *                                                                            
 *  @author André Ferreira <andrehrf@gmail.com>
 *  @license MIT
 */

"use strict";

let glob = require("glob"),
    fs = require("fs"),
    path = require('path'),
    es = require("event-stream"),
    mkdirp = require("mkdirp"),
    async = require("async"),
    zlib = require('zlib'),
    exec = require('child_process').exec,
    yaml = require('js-yaml'),
    DockerCompose = require("docker-compose-remote-api"),
    mime = require('mime-types'),
    git = require("nodegit"),
    promisify = require('promisify'),
    multipart = require('connect-multiparty'),
    targz = require('tar.gz'); 

module.exports = (_this, _, i18n, app, commands, navbar, terminal, run) => {  
    _this.extend("workspace", require(__dirname + "/workspace.js"));
    _this.extend("edit", require(__dirname + "/edit.js"));
    
    _this.insertJs(__dirname + "/node_modules/marked/lib/marked.js");
    _this.insertJs(__dirname + "/diff_match_patch.js");
    _this.insertJs(__dirname + "/node_modules/clipboard/dist/clipboard.min.js");
    //_this.insertJs(__dirname + "/minimap/dist/minimap.min.js");
    //_this.insertCss(__dirname + "/minimap/dist/minimap.min.css");
    
    //New Project
    commands.addCommand({name: "webide:newproject", bind: {mac: "Command-N", win: "Ctrl-Shift-N"}});
    navbar.addItem("Project/New Project...", {command: "webide:newproject"}, 10);
    
    app.get("/window/newproject", (req, res) => { res.render(__dirname + "/newproject.ejs", {projects: run.getRunners()}); });
    app.post("/window/newproject", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0;
        let socket = _.getSocket(req.body.socket);
        let workspaceDirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
        if(socket){
            //socket.emit("terminal:stdout", req.body.id, "Starting workspace creation...");
               
            async.series([function(n){//Clone github
                if(req.body.git.clone){
                    terminal.write(req.body.termID, "git clone " + req.body.git.clone + " " + (workspaceDirname + "/" + req.body.name), function(){
                        n();
                    });
                }
                else{
                    n();
                }
            }, function(n){//Make dir!
                socket.emit("stdout", req.body.terminal, "Creating directory...");
                /*if(!req.body.git.clone){
                    socket.emit("stdout", req.body.terminal, "Creating directory...");

                    fs.stat(workspaceDirname + "/" + req.body.name, function(err, stats){
                        if(stats){
                            if(stats.isDirectory()){
                                socket.emit("terminal:stderr", req.body.terminal, _this.i18n.__("Error trying to create workspace, there is already a directory with the same name"));
                                res.send("error");
                            }
                            else{
                                mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                    socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Directory created successfully!"));
                                    n();
                                });
                            }
                        }
                        else{
                            mkdirp(workspaceDirname + "/" + req.body.name, function (err) { 
                                socket.emit("terminal:stdout", req.body.terminal, _this.i18n.__("Directory created successfully!"));
                                n();
                            });
                        }
                    });
                }
                else{
                    n();
                }*/
            }, function(n){//Make Dockerfile
                socket.emit("terminal:stdout", req.body.terminal, i18n.__("Preparing the Dockerfile..."));
                let runner = run.getRunner(req.body.container.image);
                
                if(runner){
                    var Dockerfile = run.getDockerFile(runner.dockerfile);
                    Dockerfile = Dockerfile.replace("@version", req.body.container.version);
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/Dockerfile", Dockerfile);
                    
                    
                    var dockerComposer = {version: "3", services: {}};
                    dockerComposer.services[req.body.name] = runner.script;
                    
                    for(let key in req.body.ports){
                        if(typeof dockerComposer.services[req.body.name]["ports"] != "object")
                            dockerComposer.services[req.body.name]["ports"] = [];
                        
                        dockerComposer.services[req.body.name]["ports"].push(req.body.ports[key]);
                    }
                    
                    fs.writeFileSync(workspaceDirname + "/" + req.body.name + "/docker-compose.yml", yaml.safeDump(dockerComposer));
                    
                    //Build docker
                    var execDockerCompose = exec("docker-compose up -d --build --force-recreate", { cwd: workspaceDirname + "/" + req.body.name });
                    execDockerCompose.stdout.on('data', (data) => { socket.emit("terminal:stdout", req.body.terminal, data.toString()); });
                    execDockerCompose.stderr.on('data', (data) => { socket.emit("terminal:stderr", req.body.terminal, data.toString()); });
                    execDockerCompose.on('exit', () => { n(); });
                }
                else{
                    socket.emit("terminal:stderr", req.body.terminal, i18n.__("Could not find the selected container image"));
                    res.send("error");
                }
            }], function(){//Finish
                socket.emit("terminal:stdout", req.body.terminal, i18n.__("Workspace created successfully!"));
                //socket.emit("cwd", {cwd: "/" + req.body.name, _id: req.body.terminal});
                socket.emit("workspace:refresh");
                res.send("ok");
            });
        }        
    });
       
    //New File
    commands.addCommand({name: "file:new", bind: {mac: "Command-N", win: "Alt-N"}});
    navbar.addItem("File/New File...", {command: "file:new"}, 11);
    
    //New Template
    navbar.addItem("File/New Template...", {divide: true, submenu: [
        {
            display: "Node.js + Express",
            command: "webide:new:nodeexpress",
            divide: true
        },
        {
            display: "WebIDE Module",
            command: "webide:new:webidemodule"
        },
        {
            display: "WebIDE Plugin",
            command: "webide:new:webideplugin",
            divide: true
        },
        {
            display: "Web Extension",
            command: "webide:new:webextension"
        },
        {
            display: "Web Component",
            command: "webide:new:webcomponent"
        }
    ]}, 11);
    
    //Open
    commands.addCommand({
        name: "open",
        bind: {mac: "Command-E", win: "Ctrl-E"},
        event: "webide.windowRemote('/window/open', {'width': 1000, 'height': 550})"
    });
    
    navbar.addItem("File/Open...", {command: "open"}, 12);
    commands.addCommand({name: "openrecent"});
    
    navbar.addItem("File/Open Recent", {
        command: "openrecent",
        class: "wi-openrecent",
        submenu: true,
        divide: true
    }, 400);
    
    //Save
    commands.addCommand({name: "file:save", bind: {mac: "Command-S", win: "Ctrl-S"}});
    navbar.addItem("File/Save", {command: "file:save"}, 13);
    
    //Save As
    commands.addCommand({
        name: "file:saveas",
        bind: {mac: "Command-Shift-S", win: "Ctrl-Shift-S"}
    });
    
    navbar.addItem("File/Save As...", {command: "file:saveas"}, 14);
    
    //Save All
    navbar.addItem("File/Save All", {command: "file:saveall", divide: true}, 15);
    
    //Upload local files
    navbar.addItem("File/Upload Local Files...", {command: "file:uploadlocalfiles"}, 16);
    navbar.addItem("File/Download Project...", {command: "file:downloadproject", divide: true}, 17);
    
    //Close 
    commands.addCommand({
        name: "file:closefile",
        bind: {mac: "Option-W", win: "Alt-W"}
    });
    
    commands.addCommand({
        name: "file:closeallfiles",
        bind: {mac: "Option-Shift-W", win: "Alt-W"}
    });
    
    navbar.addItem("File/Close File", {command: "file:closefile"}, 18);
    navbar.addItem("File/Close All Files", {command: "file:closeallfiles"}, 19);
    
    app.get("/open", (req, res) => { 
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        if(/^.*?\.workspaces[\\|\/][0-9][\\|\/].*?[\\|\/].*?$/i.test(filename)){
            var projectName = (filename).match(/^.*?\.workspaces[\\|\/][0-9][\\|\/](.*?)[\\|\/].*?$/i)[1];
            var dirnameProject = (projectName) ? (dirname + "/" + projectName) : dirname;
        }
                
        try{ var projectGit = fs.statSync(dirnameProject + "/.git").isDirectory(); } catch(e) { var projectGit = false; }
        
        if(projectGit){
            git.Repository.open(dirnameProject + "/.git").then(function(repo) {
                let gitStatus = git.Status.file(repo, filename.replace(/\\/img, "/").replace(dirnameProject.replace(/\\/img, "/") + "/", ""));
                
                if(gitStatus == 256 || gitStatus == 2){
                    repo.getHeadCommit().then(function(commit) {
                        
                    });
                }
                
                fs.stat(filename, function(err, stat){
                    if(err) res.status(500).send(err);
                    else res.send({filename: filename.replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), basename: path.basename(filename), mime: mime.lookup(filename), stat: stat});
                }); 
            });
        }
        else{
            fs.stat(filename, function(err, stat){
                if(err) res.status(500).send(err);
                else res.send({filename: filename.replace(/\\/img, "/").replace(dirname.replace(/\\/img, "/"), ""), basename: path.basename(filename), mime: mime.lookup(filename), stat: stat});
            });   
        }        
    });
    
    app.get("/data", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        var mimeFile = mime.lookup(filename);
            
        if(!mimeFile)
            mimeFile = "text/plain";        
        
        res.sendFile(filename, {dotfiles: "allow", headers: {"Content-Type": mimeFile}});
    });
    
    app.get("/stream", (req, res) => {        
        let lines = "",
            _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),       
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20'))); 
        
        fs.stat(filename, function(err, stats){
            res.status(200).set({
                'Content-Type': mime.lookup(filename),
                'Content-disposition': 'attachment;filename=' + filename,
                'File-size': stats.size
            });

            fs.createReadStream(filename).pipe(es.split()).pipe(es.mapSync(function(line){ 
                lines += line + "\n";
            }).on('end', function () {  
                lines = lines.substr(lines, lines.length-2);
                res.send(new Buffer(lines, 'binary')); 
            }));
        });
    });
    
    app.get("/download", (req, res) => {        
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),        
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.query.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        if(fs.statSync(filename).isFile()){
            var mimetype = mime.lookup(filename);

            res.setHeader('Content-disposition', 'attachment; filename=' + path.basename(filename));
            res.setHeader('Content-type', mimetype);

            var filestream = fs.createReadStream(filename);
            filestream.pipe(res);
        }
        else{        
            res.setHeader('Content-disposition', 'attachment; filename=' + path.basename(filename, path.extname(filename)) + ".tar.gz");
            res.setHeader('Content-type', "application/tar+gzip");        
            targz().createReadStream(filename).pipe(res);
        }
    });
    
    app.post("/save", multipart(), (req, res) => {        
        if(typeof req.files.file == "object"){
            let _id = (req.user) ? req.user._id : 0,
                dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id);
        
            var inp = fs.createReadStream(req.files.file.path),
                out = fs.createWriteStream(dirname + req.files.file.originalFilename);
        
            inp.pipe(out).on('error', (err) => { 
                res.status(500).send(err);
            }).on('finish', () => {
                res.status(200).send("ok");
            });
        }
        else{
            res.status(500).send("Internal error");
        }
    });
    
    app.post("/rename", (req, res) => {  
        let _id = (req.user) ? req.user._id : 0,
            dirname = fs.realpathSync(__dirname + "/../../.workspaces/" + _id),
            filename = fs.realpathSync(dirname + "/" + decodeURIComponent((req.body.filename + '').replace(/%(?![\da-f]{2})/gi, function () {return '%25'}).replace(/\+/g, '%20')));
            
        try{
            fs.rename(filename, filename.replace(path.basename(filename), req.body.newname), function(err){
                if(err) res.send(err);
                else res.send("ok");
            });
        }
        catch(e){
            res.send(e.message);
        }
    });
    
    app.get("/editor/types", (req, res) => {  
        res.render(__dirname + "/types.ejs", {itens: {
            "actionscript": "Action Script",
            "applescript": "Apple Script",
            "batchfile": "Batch",
            "c_cpp": "C/C++",
            "csharp": "C#",
            "css": "CSS",
            "dart": "Dart",
            "html": "HTML",
            "markdown": "Markdown",
            "json": "JSON",
            "javascript": "JavaScript",
            "xml": "XML",
            "text": "Plain Text",
            "yaml": "YAML"
        }});
    });
    
    app.get("/js-yaml.min.js", (req, res) => { res.send(fs.readFileSync(__dirname + "/node_modules/js-yaml/dist/js-yaml.min.js").toString()); });
    app.get("/docker-compose-editor", (req, res) => { res.render(__dirname + "/dockercompose.editor.ejs"); });
};